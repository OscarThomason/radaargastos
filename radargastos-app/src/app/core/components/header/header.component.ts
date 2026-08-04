import { Component, inject, computed, signal, OnDestroy } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FinanceService } from '../../services/finance.service';
import { CalendarService } from '../../services/calendar.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnDestroy {
  authService = inject(AuthService);
  private financeService = inject(FinanceService);
  private calendarService = inject(CalendarService);

  private nowSignal = signal(Date.now());
  private timer: any;

  constructor() {
    this.timer = setInterval(() => {
      this.nowSignal.set(Date.now());
    }, 30000);
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  lastModificationText = computed(() => {
    const now = this.nowSignal();
    const history = this.financeService.state().history;
    if (history && history.length > 0) {
      const first = history[0];
      const timeMs = first.timeMs || this.parseTimestampToMs(first.timestamp);
      if (!timeMs) return null;

      const diffMs = Math.max(0, now - timeMs);
      const minutes = Math.floor(diffMs / 60000);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (minutes < 1) return 'Se actualizó hace un momento';
      if (minutes < 60) return `Se actualizó hace ${minutes} min`;
      if (hours < 24) return `Se actualizó hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
      if (days === 1) return 'Se actualizó ayer';
      return `Se actualizó hace ${days} días`;
    }
    return null;
  });

  private parseTimestampToMs(ts: string): number | null {
    if (!ts) return null;
    const clean = ts.replace(',', '');
    const parts = clean.split(' ');
    if (parts.length >= 2) {
      const dateParts = parts[0].split('/');
      const timeParts = parts[1].split(':');
      if (dateParts.length === 3 && timeParts.length >= 2) {
        const day = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1;
        const year = parseInt(dateParts[2], 10);
        const hours = parseInt(timeParts[0], 10);
        const minutes = parseInt(timeParts[1], 10);
        return new Date(year, month, day, hours, minutes).getTime();
      }
    }
    const parsed = Date.parse(ts);
    return isNaN(parsed) ? null : parsed;
  }

  get todayStr(): string {
    const d = new Date();
    const dayName = d.toLocaleDateString('es-MX', { weekday: 'long' });
    const dayNum = d.getDate();
    const monthName = d.toLocaleDateString('es-MX', { month: 'long' });
    const year = d.getFullYear();
    const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
    const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    return `${capitalizedDay}, ${dayNum} de ${capitalizedMonth} de ${year}`;
  }

  logout() {
    this.authService.logout();
  }

  async syncCalendar() {
    await this.calendarService.syncToCalendar();
  }
}

