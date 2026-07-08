import { Injectable, signal } from '@angular/core';
import { AppState, Debt, Expense, Income, ServiceItem, UpcomingItem, WeeklyBudget } from '../models/finance.model';

const CATEGORIES = ['Servicios','Deudas','Transporte','Alimentos','Restaurantes','Oscio','Salud','nutricion y gym','ropa o accesorios','casa','viaje','mascota','Otros'];

const DEFAULT_STATE: AppState = {
  debts: [
    {id:'nu', group:'tarjeta', name:'NU Crédito', dueDay:3, interval:1, minPayment:938.08, noInterest:null, debt:9353.02, notes:'Pago atrasado del mínimo mensual'},
    {id:'banamex', group:'tarjeta', name:'Banamex Costco', dueDay:24, interval:1, minPayment:360, noInterest:4143.67, debt:4143.67, notes:'Corte día 3'},
    {id:'bbva', group:'tarjeta', name:'BBVA', dueDay:23, interval:1, minPayment:1323.43, noInterest:4220.44, debt:12723.43, notes:'Corte día 3, sobregirado sobre línea de 11,400'},
    {id:'stori', group:'tarjeta', name:'Stori', dueDay:17, interval:1, minPayment:527.95, noInterest:4933.09, debt:4933.09, notes:''},
    {id:'branders', group:'tarjeta', name:'Branders Card', dueDay:20, interval:1, minPayment:568.90, noInterest:5688.98, debt:5688.98, notes:'Corte día 25'},
    {id:'kueski1', group:'prestamo', name:'Kueski · Amazon #1', frequency:'quincenal', anchor:'2026-07-15', cuota:662, cuotasPagadas:1, total:662, pagado:0, notes:'Última cuota'},
    {id:'kueski2', group:'prestamo', name:'Kueski · Amazon #2', frequency:'quincenal', anchor:'2026-07-15', cuota:1134, cuotasPagadas:2, total:2553.03, pagado:257.93, notes:''},
    {id:'kueski3', group:'prestamo', name:'Kueski · ETN', frequency:'quincenal', anchor:'2026-07-15', cuota:1044.40, cuotasPagadas:2, total:6624.40, pagado:1044.00, notes:'Monto de cuota ajustado'},
    {id:'kueski4', group:'prestamo', name:'Kueski · Amazon #3', frequency:'quincenal', anchor:'2026-07-15', cuota:872, cuotasPagadas:3, total:3465.98, pagado:1705.89, notes:''},
    {id:'kueski5', group:'prestamo', name:'Kueski · Amazon #4', frequency:'quincenal', anchor:'2026-07-15', cuota:1134, cuotasPagadas:3, total:6980.14, pagado:2200.17, notes:''},
    {id:'kueski6', group:'prestamo', name:'Kueski · Préstamo personal', frequency:'quincenal', anchor:'2026-07-15', cuota:1956, cuotasPagadas:2, total:15818.95, pagado:1956.00, notes:''}
  ],
  services: [
    {id:'luz', name:'Luz (CFE)', amount:350, dueDay:27, interval:2, notes: ''},
    {id:'renta', name:'Renta', amount:7750, dueDay:5, interval:1, notes: ''},
    {id:'telmex', name:'Telmex', amount:708, dueDay:13, interval:1, notes: ''},
    {id:'telcel', name:'Telcel', amount:550, dueDay:27, interval:1, notes: ''},
    {id:'spotify', name:'Spotify', amount:189, dueDay:1, interval:1, notes:'Sin día fijo confirmado, ajústalo si sabes la fecha exacta'}
  ],
  expenses: [],
  incomes: [],
  weeklyBudgets: [
    {id:'gasolina', name:'Gasolina', min:600, max:800}
  ]
};

@Injectable({
  providedIn: 'root'
})
export class FinanceService {
  state = signal<AppState>(this.loadState());
  categories = CATEGORIES;

  constructor() {}

  private loadState(): AppState {
    const saved = localStorage.getItem('finanzas:state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_STATE, ...parsed };
      } catch (e) {
        console.error('Error parsing state', e);
      }
    }
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }

  private saveState(newState: AppState) {
    localStorage.setItem('finanzas:state', JSON.stringify(newState));
    this.state.set(newState);
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
      let d = new Date(anchor + 'T00:00:00');
      while (d < today) {
        this.advanceDateByFrequency(d, frequency);
      }
      return d;
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
    if (days <= 3) return 'danger';
    if (days <= 7) return 'warn';
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
      category: kind === 'servicio' ? 'Servicios' : 'Deudas',
      description: `Pago de ${name}`,
      amount: amount
    };
    current.expenses = [...current.expenses, newExpense];

    this.saveState(current);
  }

  addDebt(debt: Debt) {
    const current = { ...this.state() };
    current.debts = [...current.debts, debt];
    this.saveState(current);
  }

  deleteDebt(id: string) {
    const current = { ...this.state() };
    current.debts = current.debts.filter(d => d.id !== id);
    this.saveState(current);
  }

  updateDebt(id: string, debt: Debt) {
    const current = { ...this.state() };
    const idx = current.debts.findIndex(d => d.id === id);
    if (idx !== -1) {
      current.debts = [...current.debts];
      current.debts[idx] = debt;
      this.saveState(current);
    }
  }

  addService(service: ServiceItem) {
    const current = { ...this.state() };
    current.services = [...current.services, service];
    this.saveState(current);
  }

  deleteService(id: string) {
    const current = { ...this.state() };
    current.services = current.services.filter(s => s.id !== id);
    this.saveState(current);
  }

  updateService(id: string, service: ServiceItem) {
    const current = { ...this.state() };
    const idx = current.services.findIndex(s => s.id === id);
    if (idx !== -1) {
      current.services = [...current.services];
      current.services[idx] = service;
      this.saveState(current);
    }
  }

  addExpense(expense: Expense) {
    const current = { ...this.state() };
    current.expenses = [...current.expenses, expense];
    this.saveState(current);
  }

  updateExpense(id: string, expense: Expense) {
    const current = { ...this.state() };
    const idx = current.expenses.findIndex(e => e.id === id);
    if (idx !== -1) {
      current.expenses = [...current.expenses];
      current.expenses[idx] = expense;
      this.saveState(current);
    }
  }

  deleteExpense(id: string) {
    const current = { ...this.state() };
    current.expenses = current.expenses.filter(e => e.id !== id);
    this.saveState(current);
  }

  addIncome(income: Income) {
    const current = { ...this.state() };
    current.incomes = [...current.incomes, income];
    this.saveState(current);
  }

  updateIncome(id: string, income: Income) {
    const current = { ...this.state() };
    const idx = current.incomes.findIndex(i => i.id === id);
    if (idx !== -1) {
      current.incomes = [...current.incomes];
      current.incomes[idx] = income;
      this.saveState(current);
    }
  }

  deleteIncome(id: string) {
    const current = { ...this.state() };
    current.incomes = current.incomes.filter(i => i.id !== id);
    this.saveState(current);
  }
}
