import { Component, computed, inject, signal } from '@angular/core';
import { FinanceService } from '../../core/services/finance.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StatCardComponent } from '../../core/components/stat-card/stat-card.component';
import { CountdownCardComponent } from '../../core/components/countdown-card/countdown-card.component';

@Component({
  selector: 'app-resumen',
  standalone: true,
  imports: [CommonModule, FormsModule, StatCardComponent, CountdownCardComponent],
  templateUrl: './resumen.component.html',
  styleUrl: './resumen.component.scss'
})
export class ResumenComponent {
  private financeService = inject(FinanceService);

  upcomingItems = computed(() => this.financeService.getUpcomingItems());
  
  dineroRequeridoSemana = computed(() => {
    const vencimientosSemana = this.upcomingItems().filter(i => i.days <= 7);
    const totalGastosSemana = vencimientosSemana.reduce((acc, item) => acc + item.amount, 0);

    const totalIn = this.financeService.state().incomes.reduce((acc, curr) => acc + curr.amount, 0);
    const totalEx = this.financeService.state().expenses.reduce((acc, curr) => acc + curr.amount, 0);
    const saldoDisponible = totalIn - totalEx;

    const requerido = totalGastosSemana - saldoDisponible;
    return requerido > 0 ? requerido : 0;
  });
  
  showTotals = signal(true);

  toggleTotals() {
    this.showTotals.set(!this.showTotals());
  }

  next30 = computed(() => this.upcomingItems().filter(i => i.days <= 30));
  vencidos = computed(() => this.upcomingItems().filter(i => i.days < 0).length);

  next30Grouped = computed(() => {
    const items = this.next30();
    const groups: { month: string, items: typeof items }[] = [];
    
    items.forEach(item => {
      const monthStr = item.due.toLocaleDateString('es-MX', { month: 'long' });
      const monthName = monthStr.charAt(0).toUpperCase() + monthStr.slice(1);
      
      let group = groups.find(g => g.month === monthName);
      if (!group) {
        group = { month: monthName, items: [] };
        groups.push(group);
      }
      group.items.push(item);
    });
    
    return groups;
  });

  compromisoCiclo = computed(() => {
    const calendarDate = this.currentCalendarDate();
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    return this.upcomingItems()
      .filter(item => {
        const itemDate = new Date(item.due);
        return itemDate.getFullYear() === year && itemDate.getMonth() === month;
      })
      .reduce((acc, item) => acc + item.amount, 0);
  });

  totalDeudaViva = computed(() => {
    return this.financeService.state().debts.reduce((acc, d) => {
      const debtAmount = d.group === 'prestamo' ? (d.total || 0) : (d.debt || 0);
      const paid = d.group === 'prestamo' ? (d.pagado || 0) : 0;
      return acc + (debtAmount - paid);
    }, 0);
  });

  money(amount: number) {
    return this.financeService.currency() + amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // --- Modal de Pagos Inteligente ---
  isPayModalOpen = false;
  payingDebt: any = null; // Usamos any para simplificar importación de Debt
  payAmountType: 'minimo' | 'noInterest' | 'otro' | 'cuota' = 'minimo';
  payCustomAmount: number | null = null;
  payRegisterAsExpense = false;

  onMarkPaid(event: {id: string, kind: string}) {
    let item;
    if (event.kind === 'servicio') {
      item = this.financeService.state().services.find(s => s.id === event.id);
    } else {
      item = this.financeService.state().debts.find(d => d.id === event.id);
    }
    
    if (!item) return;
    this.payingDebt = JSON.parse(JSON.stringify(item));
    
    // Inject group if it's a service to reuse the modal logic
    if (event.kind === 'servicio') {
      this.payingDebt.group = 'servicio';
    }
    
    this.payRegisterAsExpense = false;
    this.payCustomAmount = null;
    
    if (this.payingDebt.group === 'prestamo') {
      this.payAmountType = 'cuota';
      this.payCustomAmount = this.payingDebt.cuota || 0;
    } else if (this.payingDebt.group === 'servicio') {
      this.payAmountType = 'cuota'; // Usamos la misma UI de préstamo
      this.payCustomAmount = this.payingDebt.amount || 0;
    } else {
      this.payAmountType = 'minimo';
    }
    this.isPayModalOpen = true;
  }

  cancelPay() {
    this.isPayModalOpen = false;
    this.payingDebt = null;
  }

  submitPayment() {
    if (!this.payingDebt) return;
    const debt = this.payingDebt;
    let amountPaid = 0;

    if (debt.group === 'tarjeta') {
      if (this.payAmountType === 'minimo') amountPaid = debt.minPayment || 0;
      else if (this.payAmountType === 'noInterest') amountPaid = debt.noInterest || 0;
      else amountPaid = this.payCustomAmount || 0;

      debt.debt = Math.max(0, (debt.debt || 0) - amountPaid);
    } else if (debt.group === 'prestamo') {
      amountPaid = this.payCustomAmount || debt.cuota || 0;
      debt.pagado = (debt.pagado || 0) + amountPaid;
      debt.cuotasPagadas = (debt.cuotasPagadas || 0) + 1;
    } else {
      // Servicio
      amountPaid = this.payCustomAmount || debt.amount || 0;
    }

    if (this.payRegisterAsExpense && amountPaid > 0) {
      const today = new Date().toISOString().slice(0, 10);
      this.financeService.addExpense({
        id: 'e' + Date.now(),
        date: today,
        time: new Date().toTimeString().slice(0, 5),
        category: debt.group === 'servicio' ? 'Servicios' : 'Deudas',
        description: `Pago: ${debt.name}`,
        amount: amountPaid
      });
    }

    if (debt.group === 'servicio') {
      if (debt.anchor) {
        debt.anchor = this.advanceAnchor(debt.anchor, debt.frequency || 'mensual');
      }
      this.financeService.updateService(debt.id, debt);
    } else {
      if (debt.anchor) {
        debt.anchor = this.advanceAnchor(debt.anchor, debt.frequency || 'mensual');
      }
      this.financeService.updateDebt(debt.id, debt);
    }
    this.cancelPay();
  }

  private advanceAnchor(dateStr: string, freq: string): string {
    const date = new Date(dateStr + 'T12:00:00');
    if (freq === 'semanal') date.setDate(date.getDate() + 7);
    else if (freq === 'quincenal') date.setDate(date.getDate() + 15);
    else if (freq === 'mensual') date.setMonth(date.getMonth() + 1);
    else if (freq === 'bimestral') date.setMonth(date.getMonth() + 2);
    else if (freq === 'anual') date.setFullYear(date.getFullYear() + 1);
    return date.toISOString().slice(0, 10);
  }

  // --- Calendario Mensual Reactivo ---
  currentCalendarDate = signal<Date>(new Date());

  currentMonthName = computed(() => {
    const d = this.currentCalendarDate();
    const str = d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    return str.charAt(0).toUpperCase() + str.slice(1);
  });

  prevMonth() {
    const d = this.currentCalendarDate();
    this.currentCalendarDate.set(new Date(d.getFullYear(), d.getMonth() - 1, 1));
    this.selectedWeekIndex.set(0);
  }

  nextMonth() {
    const d = this.currentCalendarDate();
    this.currentCalendarDate.set(new Date(d.getFullYear(), d.getMonth() + 1, 1));
    this.selectedWeekIndex.set(0);
  }

  getUpcomingItemsForDate(d: Date): any[] {
    const items = this.upcomingItems();
    return items.filter(item => {
      const itemDate = new Date(item.due);
      return itemDate.getFullYear() === d.getFullYear() &&
             itemDate.getMonth() === d.getMonth() &&
             itemDate.getDate() === d.getDate();
    });
  }

  getDayStatusClass(items: any[]): string {
    if (!items || items.length === 0) return '';
    const hasDanger = items.some(item => item.days < 0);
    if (hasDanger) return 'status-danger';
    const hasWarn = items.some(item => item.days >= 0 && item.days <= 2);
    if (hasWarn) return 'status-warn';
    return 'status-safe';
  }

  selectedWeekIndex = signal<number>(0);

  onChangeWeek(val: any) {
    this.selectedWeekIndex.set(parseInt(val, 10) || 0);
  }

  semanasConCompromiso = computed(() => {
    return this.calendarWeeks().map((week, idx) => {
      const sum = week.reduce((acc: number, day: any) => {
        return acc + day.items.reduce((sumEx: number, item: any) => sumEx + item.amount, 0);
      }, 0);
      return {
        index: idx,
        label: `Semana ${idx + 1}`,
        amount: sum
      };
    });
  });

  compromisoSemanaSeleccionada = computed(() => {
    const list = this.semanasConCompromiso();
    const idx = this.selectedWeekIndex();
    if (idx >= 0 && idx < list.length) {
      return list[idx].amount;
    }
    return 0;
  });

  calendarWeeks = computed(() => {
    const baseDate = this.currentCalendarDate();
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const daysInMonth = lastDay.getDate();
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const gridDays: { date: Date; dayNum: number; isCurrentMonth: boolean; isToday: boolean; items: any[] }[] = [];
    const today = new Date();
    today.setHours(0,0,0,0);

    // Mes anterior
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      d.setHours(0,0,0,0);
      gridDays.push({
        date: d,
        dayNum: d.getDate(),
        isCurrentMonth: false,
        isToday: d.getTime() === today.getTime(),
        items: this.getUpcomingItemsForDate(d)
      });
    }

    // Mes actual
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      d.setHours(0,0,0,0);
      gridDays.push({
        date: d,
        dayNum: i,
        isCurrentMonth: true,
        isToday: d.getTime() === today.getTime(),
        items: this.getUpcomingItemsForDate(d)
      });
    }

    // Mes siguiente
    const totalSlots = gridDays.length;
    const remainingSlots = (7 - (totalSlots % 7)) % 7;
    for (let i = 1; i <= remainingSlots; i++) {
      const d = new Date(year, month + 1, i);
      d.setHours(0,0,0,0);
      gridDays.push({
        date: d,
        dayNum: i,
        isCurrentMonth: false,
        isToday: d.getTime() === today.getTime(),
        items: this.getUpcomingItemsForDate(d)
      });
    }

    const weeks: any[][] = [];
    for (let i = 0; i < gridDays.length; i += 7) {
      weeks.push(gridDays.slice(i, i + 7));
    }
    return weeks;
  });
}
