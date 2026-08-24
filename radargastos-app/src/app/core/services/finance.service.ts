import { Injectable, signal, inject, effect, computed } from '@angular/core';
import { Firestore, doc, setDoc, onSnapshot } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { AppState, Debt, Expense, Income, ServiceItem, UpcomingItem, WeeklyBudget, Card } from '../models/finance.model';
import * as XLSX from 'xlsx';

const CATEGORIES = ['Servicios', 'Deudas', 'Transporte', 'Alimentos', 'Restaurantes', 'Oscio', 'Salud', 'nutricion y gym', 'ropa o accesorios', 'casa', 'viaje', 'mascota', 'Otros'];

const DEFAULT_STATE: AppState = {
  debts: [],
  services: [],
  expenses: [],
  incomes: [],
  weeklyBudgets: [],
  customExpenseCategories: [...CATEGORIES],
  customIncomeCategories: ['Sueldo', 'Negocio', 'Préstamos', 'Regalías'],
  cards: [],
  history: [],
  currency: '$'
};

@Injectable({
  providedIn: 'root'
})
export class FinanceService {
  state = signal<AppState>(JSON.parse(JSON.stringify(DEFAULT_STATE)));
  
  timeFormat = computed(() => this.state().timeFormat || '12h');
  currency = computed(() => this.state().currency || '$');

  expenseCategories = computed(() => {
    const s = this.state();
    return s.customExpenseCategories && s.customExpenseCategories.length > 0 
      ? s.customExpenseCategories 
      : [...CATEGORIES];
  });

  incomeCategories = computed(() => {
    const s = this.state();
    return s.customIncomeCategories && s.customIncomeCategories.length > 0 
      ? s.customIncomeCategories 
      : ['Sueldo', 'Negocio', 'Préstamos', 'Regalías'];
  });

  /** Formatea una hora en formato 'HH:MM' según la preferencia del usuario ('12h' o '24h') */
  formatTime(timeStr?: string): string {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1].padStart(2, '0');
    if (isNaN(hours)) return timeStr;

    if (this.timeFormat() === '24h') {
      return `${hours.toString().padStart(2, '0')}:${minutes}`;
    } else {
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      if (hours === 0) hours = 12;
      return `${hours}:${minutes} ${ampm}`;
    }
  }

  cardsWithBalance = computed(() => {
    const s = this.state();
    const cards = s.cards || [];
    const expenses = s.expenses || [];
    const incomes = s.incomes || [];

    return cards.map(c => {
      let currentBalance = c.balance || 0;
      const relatedEx = expenses.filter(e => e.paymentMethod === c.id);
      const relatedIn = incomes.filter(i => i.paymentMethod === c.id);

      const totalSpent = relatedEx.reduce((sum, e) => sum + e.amount, 0);
      const totalIn = relatedIn.reduce((sum, i) => sum + i.amount, 0);

      if (c.type === 'credito') {
        // En crédito, los gastos suben la deuda y los ingresos (pagos) la bajan
        currentBalance = currentBalance + totalSpent - totalIn;
      } else {
        // En débito, los gastos bajan el dinero y los ingresos lo suben
        currentBalance = currentBalance - totalSpent + totalIn;
      }

      return { ...c, computedBalance: currentBalance };
    });
  });

  isLoading = signal<boolean>(true);

  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private unsubSnapshot: any = null;

  constructor() {
    // Cargar caché local inmediatamente para respuesta instantánea
    const saved = localStorage.getItem('finanzas:state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.state.set({ ...DEFAULT_STATE, ...parsed });
      } catch (e) {
        console.error('Error al parsear estado local inicial', e);
      }
    }

    // Duración mínima de la animación de carga de libreta (1.4s)
    setTimeout(() => {
      this.isLoading.set(false);
    }, 1400);

    effect(() => {
      const user = this.authService.userSignal();
      if (user) {
        this.listenToCloudState(user.uid);
      } else {
        if (this.unsubSnapshot) {
          this.unsubSnapshot();
          this.unsubSnapshot = null;
        }
        this.state.set(JSON.parse(JSON.stringify(DEFAULT_STATE)));
        localStorage.removeItem('finanzas:state');
        this.isLoading.set(false);
      }
    });
  }

  private listenToCloudState(uid: string) {
    const userDocRef = doc(this.firestore, `users/${uid}`);

    this.unsubSnapshot = onSnapshot(userDocRef, (snapshot) => {
      if (snapshot.exists()) {
        // Cargar datos de la nube
        const data = snapshot.data() as AppState;
        this.state.set({ ...DEFAULT_STATE, ...data });
        // Sincronizar cache local por seguridad
        localStorage.setItem('finanzas:state', JSON.stringify(data));
      } else {
        // MIGRACIÓN: Si la nube está vacía, subir los datos locales
        const saved = localStorage.getItem('finanzas:state');
        let dataToUpload = JSON.parse(JSON.stringify(DEFAULT_STATE));
        if (saved) {
          try {
            dataToUpload = { ...DEFAULT_STATE, ...JSON.parse(saved) };
          } catch (e) {
            console.error('Error parseando estado local para migración', e);
          }
        }
        setDoc(userDocRef, dataToUpload);
      }
    });
  }

  private async saveState(newState: AppState) {
    // Actualización inmediata en memoria para UI rápida
    this.state.set(newState);

    // Caché local (offline fallback)
    localStorage.setItem('finanzas:state', JSON.stringify(newState));

    // Persistencia en la nube
    const user = this.authService.userSignal();
    if (user) {
      try {
        const userDocRef = doc(this.firestore, `users/${user.uid}`);
        await setDoc(userDocRef, newState);
      } catch (err) {
        console.error('Error guardando en Firestore', err);
      }
    }
  }

  private logAction(current: AppState, action: string) {
    if (!current.history) current.history = [];
    
    // Obtener fecha y hora en formato local (Ej. 14/07/2026, 17:30)
    const now = new Date();
    const formattedDate = now.toLocaleDateString('es-MX') + ' ' + now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

    const newLog = {
      id: 'h' + Date.now() + Math.random().toString(36).substr(2, 5),
      timestamp: formattedDate,
      timeMs: now.getTime(),
      action
    };
    current.history = [newLog, ...current.history].slice(0, 60);
  }

  // Helpers

  private advanceDateByFrequency(d: Date, frequency?: string) {
    if (frequency === 'semanal') d.setDate(d.getDate() + 7);
    else if (frequency === 'quincenal') d.setDate(d.getDate() + 15);
    else if (frequency === 'bimestral') d.setMonth(d.getMonth() + 2);
    else if (frequency === 'anual') d.setFullYear(d.getFullYear() + 1);
    else d.setMonth(d.getMonth() + 1);
  }

  nextOccurrence(dueDay: number | undefined, interval: number = 1, anchor: string | null | undefined, frequency?: string): Date {
    const today = new Date(); 
    today.setHours(0, 0, 0, 0);
    
    if (anchor) {
      // Si hay anchor, esa es la fecha de cobro actual. Si no se paga, se queda en el pasado (atrasado).
      return new Date(anchor + 'T00:00:00');
    }
    
    let candidate = new Date(today.getFullYear(), today.getMonth(), dueDay || 1);
    if (candidate < today) { candidate.setMonth(candidate.getMonth() + 1); }
    return candidate;
  }

  daysBetween(date: Date): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return Math.round((d.getTime() - today.getTime()) / 86400000);
  }

  statusFor(days: number): 'danger' | 'warn' | 'safe' {
    if (days < 0) return 'danger';
    if (days <= 2) return 'warn';
    return 'safe';
  }

  getUpcomingItems(): UpcomingItem[] {
    const current = this.state();
    const items: UpcomingItem[] = [];

    current.debts.forEach(d => {
      const due = this.nextOccurrence(d.dueDay, d.interval, d.anchor, d.frequency);
      const amount = d.group === 'prestamo' ? (d.cuota || 0) : (d.minPayment || 0);
      items.push({
        id: d.id,
        kind: d.group,
        name: d.name,
        amount,
        due,
        days: this.daysBetween(due),
        noInterest: d.noInterest
      });
    });

    current.services.forEach(s => {
      const due = this.nextOccurrence(s.dueDay, s.interval, s.anchor);
      items.push({
        id: s.id,
        kind: 'servicio',
        name: s.name,
        amount: s.amount,
        due,
        days: this.daysBetween(due)
      });
    });

    items.sort((a, b) => a.days - b.days);
    return items;
  }

  markPaid(id: string, kind: string) {
    const current = { ...this.state() };
    let name = '';
    let amount = 0;

    if (kind === 'servicio') {
      const idx = current.services.findIndex(s => s.id === id);
      if (idx === -1) return;
      const svc = { ...current.services[idx] };

      const due = this.nextOccurrence(svc.dueDay, svc.interval, svc.anchor, svc.frequency);
      this.advanceDateByFrequency(due, svc.frequency);
      svc.anchor = due.toISOString().slice(0, 10);

      current.services = [...current.services];
      current.services[idx] = svc;

      name = svc.name;
      amount = svc.amount;
    } else {
      const idx = current.debts.findIndex(d => d.id === id);
      if (idx === -1) return;
      const debt = { ...current.debts[idx] };

      if (debt.group === 'prestamo') {
        debt.pagado = (debt.pagado || 0) + (debt.cuota || 0);
        debt.cuotasPagadas = (debt.cuotasPagadas || 0) + 1;
      }

      const due = this.nextOccurrence(debt.dueDay, debt.interval, debt.anchor, debt.frequency);
      this.advanceDateByFrequency(due, debt.frequency);
      debt.anchor = due.toISOString().slice(0, 10);
      amount = debt.group === 'prestamo' ? (debt.cuota || 0) : (debt.minPayment || 0);

      current.debts = [...current.debts];
      current.debts[idx] = debt;

      name = debt.name;
    }

    const newExpense: Expense = {
      id: 'e' + Date.now(),
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toTimeString().slice(0, 5),
      category: kind === 'servicio' ? 'Servicios' : 'Deudas',
      description: `Pago de ${name}`,
      amount: amount
    };
    current.expenses = [...current.expenses, newExpense];

    this.logAction(current, `Se registró el pago de ${name}`);
    this.saveState(current);
  }

  addDebt(debt: Debt) {
    const current = { ...this.state() };
    current.debts = [...current.debts, debt];
    this.logAction(current, `Se añadió la deuda: ${debt.name}`);
    this.saveState(current);
  }

  deleteDebt(id: string) {
    const current = { ...this.state() };
    const d = current.debts.find(x => x.id === id);
    current.debts = current.debts.filter(x => x.id !== id);
    this.logAction(current, `Se eliminó la deuda: ${d?.name || 'Desconocida'}`);
    this.saveState(current);
  }

  updateDebt(id: string, debt: Debt) {
    const current = { ...this.state() };
    const idx = current.debts.findIndex(d => d.id === id);
    if (idx !== -1) {
      current.debts = [...current.debts];
      current.debts[idx] = debt;
      this.logAction(current, `Se actualizó la deuda: ${debt.name}`);
      this.saveState(current);
    }
  }

  addService(service: ServiceItem) {
    const current = { ...this.state() };
    current.services = [...current.services, service];
    this.logAction(current, `Se añadió el servicio: ${service.name}`);
    this.saveState(current);
  }

  deleteService(id: string) {
    const current = { ...this.state() };
    const s = current.services.find(x => x.id === id);
    current.services = current.services.filter(x => x.id !== id);
    this.logAction(current, `Se eliminó el servicio: ${s?.name || 'Desconocido'}`);
    this.saveState(current);
  }

  updateService(id: string, service: ServiceItem) {
    const current = { ...this.state() };
    const idx = current.services.findIndex(s => s.id === id);
    if (idx !== -1) {
      current.services = [...current.services];
      current.services[idx] = service;
      this.logAction(current, `Se actualizó el servicio: ${service.name}`);
      this.saveState(current);
    }
  }

  addExpense(expense: Expense) {
    const current = { ...this.state() };
    current.expenses = [...current.expenses, expense];
    this.logAction(current, `Se registró un gasto de ${expense.amount} en ${expense.category}`);
    this.saveState(current);
  }

  updateExpense(id: string, expense: Expense) {
    const current = { ...this.state() };
    const idx = current.expenses.findIndex(e => e.id === id);
    if (idx !== -1) {
      current.expenses = [...current.expenses];
      current.expenses[idx] = expense;
      this.logAction(current, `Se actualizó el gasto: ${expense.description}`);
      this.saveState(current);
    }
  }

  deleteExpense(id: string) {
    const current = { ...this.state() };
    const e = current.expenses.find(x => x.id === id);
    current.expenses = current.expenses.filter(x => x.id !== id);
    this.logAction(current, `Se eliminó el gasto de ${e?.amount || ''}`);
    this.saveState(current);
  }

  addIncome(income: Income) {
    const current = { ...this.state() };
    current.incomes = [...current.incomes, income];
    this.logAction(current, `Se registró un ingreso de ${income.amount} por ${income.category}`);
    this.saveState(current);
  }

  updateIncome(id: string, income: Income) {
    const current = { ...this.state() };
    const idx = current.incomes.findIndex(i => i.id === id);
    if (idx !== -1) {
      current.incomes = [...current.incomes];
      current.incomes[idx] = income;
      this.logAction(current, `Se actualizó el ingreso: ${income.description}`);
      this.saveState(current);
    }
  }

  deleteIncome(id: string) {
    const current = { ...this.state() };
    const i = current.incomes.find(x => x.id === id);
    current.incomes = current.incomes.filter(x => x.id !== id);
    this.logAction(current, `Se eliminó el ingreso de ${i?.amount || ''}`);
    this.saveState(current);
  }

  updateExpenseCategories(categories: string[]) {
    const current = { ...this.state() };
    current.customExpenseCategories = [...categories];
    this.logAction(current, `Se modificaron las categorías de gastos`);
    this.saveState(current);
  }

  updateIncomeCategories(categories: string[]) {
    const current = { ...this.state() };
    current.customIncomeCategories = [...categories];
    this.logAction(current, `Se modificaron las categorías de ingresos`);
    this.saveState(current);
  }

  addCard(card: Card) {
    const current = { ...this.state() };
    if (!current.cards) current.cards = [];
    current.cards = [...current.cards, card];
    this.logAction(current, `Se añadió la tarjeta: ${card.name}`);
    this.saveState(current);
  }

  updateCard(id: string, card: Card) {
    const current = { ...this.state() };
    if (!current.cards) current.cards = [];
    const idx = current.cards.findIndex(c => c.id === id);
    if (idx !== -1) {
      current.cards = [...current.cards];
      current.cards[idx] = card;
      this.logAction(current, `Se actualizó la tarjeta: ${card.name}`);
      this.saveState(current);
    }
  }

  deleteCard(id: string) {
    const current = { ...this.state() };
    if (!current.cards) current.cards = [];
    const c = current.cards.find(x => x.id === id);
    current.cards = current.cards.filter(x => x.id !== id);
    this.logAction(current, `Se eliminó la tarjeta: ${c?.name || ''}`);
    this.saveState(current);
  }

  updateTimeFormat(format: '12h' | '24h') {
    const current = { ...this.state() };
    current.timeFormat = format;
    this.logAction(current, `Se cambió el formato de hora a ${format}`);
    this.saveState(current);
  }

  updateCurrency(currency: string) {
    const current = { ...this.state() };
    current.currency = currency;
    this.logAction(current, `Se cambió la moneda del sistema a ${currency}`);
    this.saveState(current);
  }

  exportDataToExcel() {
    const state = this.state();
    const wb = XLSX.utils.book_new();

    const getCardName = (id?: string) => {
      if (!id || id === 'efectivo') return 'Efectivo';
      const c = state.cards?.find(x => x.id === id);
      return c ? c.name : 'Efectivo';
    };

    // 1. Hoja de Resumen General
    const summaryData = [
      { 'Métrica / Registro': 'Fecha de Generación del Reporte', 'Valor': new Date().toLocaleDateString('es-MX') + ' ' + new Date().toLocaleTimeString('es-MX') },
      { 'Métrica / Registro': 'Total Gastos del Registro', 'Valor': `$${state.expenses.reduce((acc, e) => acc + e.amount, 0).toLocaleString('es-MX', {minimumFractionDigits:2})}` },
      { 'Métrica / Registro': 'Total Ingresos del Registro', 'Valor': `$${state.incomes.reduce((acc, i) => acc + i.amount, 0).toLocaleString('es-MX', {minimumFractionDigits:2})}` },
      { 'Métrica / Registro': 'Cantidad de Deudas Registradas', 'Valor': state.debts.length.toString() },
      { 'Métrica / Registro': 'Cantidad de Servicios Activos', 'Valor': state.services.length.toString() }
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen');

    // 2. Hoja de Gastos
    const gastosData = state.expenses.map(e => ({
      'Fecha': e.date,
      'Hora': this.formatTime(e.time),
      'Categoría': e.category || 'General',
      'Descripción': e.description || '',
      'Monto ($)': e.amount,
      'Método / Cuenta': getCardName(e.paymentMethod)
    }));
    const wsGastos = XLSX.utils.json_to_sheet(gastosData.length ? gastosData : [{'Mensaje': 'No hay gastos registrados'}]);
    XLSX.utils.book_append_sheet(wb, wsGastos, 'Gastos');

    // 3. Hoja de Ingresos
    const ingresosData = state.incomes.map(i => ({
      'Fecha': i.date,
      'Hora': this.formatTime(i.time),
      'Categoría': i.category || 'General',
      'Descripción': i.description || '',
      'Monto ($)': i.amount,
      'Método / Cuenta': getCardName(i.paymentMethod)
    }));
    const wsIngresos = XLSX.utils.json_to_sheet(ingresosData.length ? ingresosData : [{'Mensaje': 'No hay ingresos registrados'}]);
    XLSX.utils.book_append_sheet(wb, wsIngresos, 'Ingresos');

    // 4. Hoja de Deudas
    const deudasData = state.debts.map(d => {
      const isLoan = d.group === 'prestamo';
      return {
        'Nombre de Deuda': d.name,
        'Tipo': isLoan ? 'Préstamo' : 'Tarjeta de Crédito',
        'Monto Total / Deuda ($)': isLoan ? (d.total || 0) : (d.debt || 0),
        'Cuota / Pago Mínimo ($)': isLoan ? (d.cuota || 0) : (d.minPayment || 0),
        'Pago sin Intereses ($)': d.noInterest || 'N/A',
        'CAT (%)': d.cat ? `${d.cat}%` : 'N/A',
        'Frecuencia': d.frequency || 'mensual',
        'Próximo Vencimiento': d.anchor || 'N/A'
      };
    });
    const wsDeudas = XLSX.utils.json_to_sheet(deudasData.length ? deudasData : [{'Mensaje': 'No hay deudas registradas'}]);
    XLSX.utils.book_append_sheet(wb, wsDeudas, 'Deudas');

    // 5. Hoja de Servicios
    const serviciosData = state.services.map(s => ({
      'Nombre del Servicio': s.name,
      'Costo ($)': s.amount,
      'Frecuencia': s.frequency || 'mensual',
      'Próximo Pago': s.anchor || 'N/A'
    }));
    const wsServicios = XLSX.utils.json_to_sheet(serviciosData.length ? serviciosData : [{'Mensaje': 'No hay servicios registrados'}]);
    XLSX.utils.book_append_sheet(wb, wsServicios, 'Servicios');

    // Descargar archivo Excel .xlsx
    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Reporte_Financiero_Radargastos_${today}.xlsx`);

    // Log action
    const current = { ...this.state() };
    this.logAction(current, `Se exportó la información a Excel (.xlsx)`);
    this.saveState(current);
  }
}
