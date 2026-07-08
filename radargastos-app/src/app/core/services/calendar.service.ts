import { Injectable, inject } from '@angular/core';
import { Auth, GoogleAuthProvider, signInWithPopup } from '@angular/fire/auth';
import { FinanceService } from './finance.service';

@Injectable({
  providedIn: 'root'
})
export class CalendarService {
  private auth = inject(Auth);
  private financeService = inject(FinanceService);

  async syncToCalendar() {
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/calendar.events');
      
      // Forzar selección de cuenta y pedir permisos de Calendar
      provider.setCustomParameters({ prompt: 'consent' });
      
      const result = await signInWithPopup(this.auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;
      
      if (!token) throw new Error('No se pudo obtener el token de Google Calendar.');

      const state = this.financeService.state();
      
      // Buscar eventos viejos creados por Radar para borrarlos y evitar duplicados
      await this.clearOldRadarEvents(token);

      let createdCount = 0;

      // 1. Crear eventos para Deudas
      for (const debt of state.debts) {
        if (debt.anchor) {
          await this.createEvent(token, `🚨 PAGO: ${debt.name}`, debt.anchor, 'Deuda: ' + (debt.notes || ''));
          createdCount++;
        }
      }

      // 2. Crear eventos para Servicios
      for (const serv of state.services) {
        // En los servicios no usábamos "anchor", sino dueDay e interval.
        // Vamos a calcular el próximo día de pago usando la misma lógica visual.
        // Pero si agregamos 'anchor' a servicios, mejor.
        // Veamos si serv tiene anchor o dueDay
        let nextDateStr = '';
        if ((serv as any).anchor) {
          nextDateStr = (serv as any).anchor;
        } else {
          // Fallback a calcular el próximo dueDay en el mes actual o siguiente
          const today = new Date();
          let month = today.getMonth() + 1;
          let year = today.getFullYear();
          if (today.getDate() > serv.dueDay) {
            month += 1;
            if (month > 12) { month = 1; year++; }
          }
          nextDateStr = `${year}-${month.toString().padStart(2, '0')}-${serv.dueDay.toString().padStart(2, '0')}`;
        }

        if (nextDateStr) {
          await this.createEvent(token, `🚨 PAGO: ${serv.name}`, nextDateStr, 'Servicio: ' + (serv.notes || ''));
          createdCount++;
        }
      }

      alert(`¡Sincronización exitosa! Se agendaron ${createdCount} eventos en tu Google Calendar.`);
      
    } catch (e: any) {
      console.error(e);
      alert('Error sincronizando calendario. Asegúrate de haber habilitado la Google Calendar API en Google Cloud.\n' + (e.message || e));
    }
  }

  private async clearOldRadarEvents(token: string) {
    const timeMin = new Date().toISOString();
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?q=RADAR_SYNC&timeMin=${timeMin}`;
    
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Falló conexión a la API de Calendar');
    
    const data = await res.json();
    
    if (data.items) {
      for (const event of data.items) {
        await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${event.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }
    }
  }

  private async createEvent(token: string, title: string, dateStr: string, description: string) {
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events`;
    
    const event = {
      summary: title,
      description: description + '\n\n[RADAR_SYNC]',
      start: { date: dateStr },
      end: { date: dateStr },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 24 * 60 }, // 1 día antes
          { method: 'popup', minutes: 9 * 60 }   // 9 horas antes
        ]
      }
    };

    await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event)
    });
  }
}
