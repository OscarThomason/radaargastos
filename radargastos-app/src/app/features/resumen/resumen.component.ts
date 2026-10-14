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
  
  /** Rango estricto de Lunes a Domingo de la semana actual */
  currentWeekRange = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return { monday, sunday };
  });

  currentWeekRangeFormatted = computed(() => {
    const { monday, sunday } = this.currentWeekRange();
    const monStr = monday.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
    const sunStr = sunday.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
    return `${monStr} al ${sunStr}`;
  });

  currentWeekItems = computed(() => {
    const { monday, sunday } = this.currentWeekRange();
    return this.upcomingItems().filter(item => {
      const itemDate = new Date(item.due);
      return itemDate >= monday && itemDate <= sunday;
    });
  });

  totalCompromisosSemanaActual = computed(() => {
    return this.currentWeekItems().reduce((acc, item) => acc + item.amount, 0);
  });

  /** Rango estricto de Lunes a Domingo de la próxima semana */
  nextWeekRange = computed(() => {
    const { monday } = this.currentWeekRange();
    const nextMonday = new Date(monday);
    nextMonday.setDate(monday.getDate() + 7);
    nextMonday.setHours(0, 0, 0, 0);

    const nextSunday = new Date(nextMonday);
    nextSunday.setDate(nextMonday.getDate() + 6);
    nextSunday.setHours(23, 59, 59, 999);

    return { monday: nextMonday, sunday: nextSunday };
  });

  nextWeekRangeFormatted = computed(() => {
    const { monday, sunday } = this.nextWeekRange();
    const monStr = monday.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
    const sunStr = sunday.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
    return `${monStr} al ${sunStr}`;
  });

  nextWeekItems = computed(() => {
    const { monday, sunday } = this.nextWeekRange();
    return this.upcomingItems().filter(item => {
      const itemDate = new Date(item.due);
      return itemDate >= monday && itemDate <= sunday;
    });
  });

  totalCompromisosProximaSemana = computed(() => {
    return this.nextWeekItems().reduce((acc, item) => acc + item.amount, 0);
  });

  saldoDisponiblePropio = computed(() => {
    const totalIn = this.financeService.state().incomes.reduce((acc, curr) => acc + curr.amount, 0);
    const totalEx = this.financeService.state().expenses.reduce((acc, curr) => acc + curr.amount, 0);
    return Math.max(0, totalIn - totalEx);
  });
  
  dineroRequeridoSemana = computed(() => {
    const totalGastosSemana = this.totalCompromisosSemanaActual();
    const saldoDisponible = this.saldoDisponiblePropio();

    const requerido = totalGastosSemana - saldoDisponible;
    return requerido > 0 ? requerido : 0;
  });

  dineroRequeridoProximaSemana = computed(() => {
    const totalGastosEstaSemana = this.totalCompromisosSemanaActual();
    const saldoDisponible = this.saldoDisponiblePropio();

    // El remanente disponible tras cubrir esta semana amortigua la siguiente
    const remanenteParaProxima = Math.max(0, saldoDisponible - totalGastosEstaSemana);
    const requerido = this.totalCompromisosProximaSemana() - remanenteParaProxima;
    return requerido > 0 ? requerido : 0;
  });
  
  showTotals = signal(true);
  showReminderToast = signal(true);

  upcomingWeekPaymentInfo = computed(() => {
    const weekItems = this.currentWeekItems();
    if (weekItems.length === 0) return null;

    const totalNeeded = weekItems.reduce((acc, item) => acc + item.amount, 0);
    const firstItem = weekItems[0];
    const dateFormatted = firstItem.due.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' });

    return {
      totalNeeded,
      count: weekItems.length,
      firstName: firstItem.name,
      firstDate: dateFormatted
    };
  });

  activeReminder = computed(() => {
    const weekInfo = this.upcomingWeekPaymentInfo();
    const vencidosCount = this.vencidos();
    const requerido = this.dineroRequeridoSemana();
    const totalDeuda = this.totalDeudaViva();

    const reminders: { title: string; icon: string; text: string }[] = [];

    if (vencidosCount > 0) {
      reminders.push({
        title: 'Pagos Pendientes Vencidos',
        icon: 'warning',
        text: `Tienes ${vencidosCount} compromiso(s) con fecha vencida. Te sugerimos ponernos al día para mantener tus finanzas sanas.`
      });
    }

    if (weekInfo) {
      reminders.push({
        title: 'Compromiso de la Semana',
        icon: 'event',
        text: `Esta semana requieres ${this.money(weekInfo.totalNeeded)} para ${weekInfo.count} pago(s). Próximo: ${weekInfo.firstName} (${weekInfo.firstDate}).`
      });
    }

    if (requerido > 0) {
      reminders.push({
        title: 'Falta por Generar',
        icon: 'trending_up',
        text: `Faltan ${this.money(requerido)} de liquidez para completar los vencimientos programados de los próximos 7 días.`
      });
    }

    if (totalDeuda > 0) {
      reminders.push({
        title: 'Estrategia de Desendeudamiento',
        icon: 'account_balance_wallet',
        text: `Tu saldo actual en deudas es de ${this.money(totalDeuda)}. Abonar montos extra a capital acelera tu libertad financiera.`
      });
    }

    // Consejos financieros generales variados
    reminders.push({
      title: 'Optimización de Suscripciones',
      icon: 'subscriptions',
      text: 'Revisa periódicamente tus servicios fijos y cancela las plataformas digitales que no utilices activamente.'
    });

    reminders.push({
      title: 'Regla del 50/30/20',
      icon: 'pie_chart',
      text: 'Procura destinar el 50% de tu ingreso a necesidades primarias, 30% a compromisos/ahorro y máximo 20% a ocio.'
    });

    reminders.push({
      title: 'Control de Gastos Hormiga',
      icon: 'receipt_long',
      text: 'Registrar diariamente hasta las compras más pequeñas te ayuda a evitar fugas invisibles de dinero.'
    });

    // Seleccionar uno de manera aleatoria cada vez que se evalúa o carga
    const index = Math.floor(Math.random() * reminders.length);
    return reminders[index];
  });

  dismissReminderToast() {
    this.showReminderToast.set(false);
  }

  constructor() {
    // Auto-ocultar el pop-up después de 8 segundos
    setTimeout(() => {
      this.showReminderToast.set(false);
    }, 8000);
  }

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
    return this.financeService.totalConsolidatedDebt().total;
  });

  money(amount: number) {
    return this.financeService.currency() + amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  formatDayTooltipDate(d: Date): string {
    const s = d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  abs(n: number): number {
    return Math.abs(n);
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

  // --- Calendario Mensual Reactivo Tipo Agenda Minimalista ---
  currentCalendarDate = signal<Date>(new Date());

  currentYear = computed(() => this.currentCalendarDate().getFullYear());

  currentMonthTitle = computed(() => {
    const d = this.currentCalendarDate();
    const str = d.toLocaleDateString('es-MX', { month: 'long' });
    return str.charAt(0).toUpperCase() + str.slice(1);
  });

  currentMonthName = computed(() => {
    const d = this.currentCalendarDate();
    const str = d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    return str.charAt(0).toUpperCase() + str.slice(1);
  });

  monthDebtsList = computed(() => {
    const base = this.currentCalendarDate();
    const m = base.getMonth();
    const y = base.getFullYear();
    return this.upcomingItems().filter(item => {
      const itemDate = new Date(item.due);
      return itemDate.getFullYear() === y && itemDate.getMonth() === m;
    });
  });

  activeSelectedDate = signal<Date | null>(null);

  selectDay(d: Date) {
    this.activeSelectedDate.set(d);
  }

  isSelectedDay(d: Date): boolean {
    const sel = this.activeSelectedDate();
    if (!sel) return false;
    return sel.getFullYear() === d.getFullYear() &&
           sel.getMonth() === d.getMonth() &&
           sel.getDate() === d.getDate();
  }

  isActiveDay(d: Date, isToday: boolean): boolean {
    // El recuadro verde siempre pertenece exclusivamente al día de hoy como guía fija
    return isToday;
  }

  // --- REPROGRAMACIÓN Y DESPLAZAMIENTO (DRAG & DROP / CLIC) ---
  isMoveDateModalOpen = signal<boolean>(false);
  movingItem = signal<any>(null);
  selectedNewDay = signal<number>(1);
  draggedItem = signal<any>(null);
  dragOverDayDate = signal<string | null>(null);

  moveModalDate = signal<Date>(new Date());

  moveModalMonthTitle = computed(() => {
    const d = this.moveModalDate();
    const str = d.toLocaleDateString('es-MX', { month: 'long' });
    return str.charAt(0).toUpperCase() + str.slice(1);
  });

  moveModalYear = computed(() => this.moveModalDate().getFullYear());

  prevMoveModalMonth() {
    const d = this.moveModalDate();
    const nextD = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    this.moveModalDate.set(nextD);
    this.adjustSelectedNewDayLimit(nextD);
  }

  nextMoveModalMonth() {
    const d = this.moveModalDate();
    const nextD = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    this.moveModalDate.set(nextD);
    this.adjustSelectedNewDayLimit(nextD);
  }

  private adjustSelectedNewDayLimit(baseDate: Date) {
    const maxDays = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0).getDate();
    if (this.selectedNewDay() > maxDays) {
      this.selectedNewDay.set(maxDays);
    }
  }

  moveModalCalendarWeeks = computed(() => {
    const baseDate = this.moveModalDate();
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startDayOfWeek = firstDay.getDay(); // 0 = Domingo
    const daysInMonth = lastDay.getDate();
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const currentItem = this.movingItem();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const gridDays: any[] = [];

    // Días del mes anterior
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      d.setHours(0, 0, 0, 0);
      gridDays.push({
        date: d,
        dayNum: d.getDate(),
        isCurrentMonth: false,
        isToday: d.getTime() === today.getTime(),
        isOriginalDay: false,
        items: [],
        otherItems: [],
        hasOtherDebts: false,
        hasOverdue: false,
        otherTotalAmount: 0
      });
    }

    // Días del mes actual
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      d.setHours(0, 0, 0, 0);
      const allItems = this.getUpcomingItemsForDate(d);
      const otherItems = currentItem ? allItems.filter(it => it.id !== currentItem.id) : allItems;
      const isOriginalDay = currentItem ? (new Date(currentItem.due).toDateString() === d.toDateString()) : false;

      gridDays.push({
        date: d,
        dayNum: i,
        isCurrentMonth: true,
        isToday: d.getTime() === today.getTime(),
        isOriginalDay,
        items: allItems,
        otherItems,
        hasOtherDebts: otherItems.length > 0,
        hasOverdue: otherItems.some(it => it.days < 0),
        otherTotalAmount: otherItems.reduce((sum, it) => sum + (it.amount || 0), 0)
      });
    }

    // Días del mes siguiente para completar la cuadrícula
    const totalSlots = gridDays.length;
    const remainingSlots = (7 - (totalSlots % 7)) % 7;
    for (let i = 1; i <= remainingSlots; i++) {
      const d = new Date(year, month + 1, i);
      d.setHours(0, 0, 0, 0);
      gridDays.push({
        date: d,
        dayNum: i,
        isCurrentMonth: false,
        isToday: d.getTime() === today.getTime(),
        isOriginalDay: false,
        items: [],
        otherItems: [],
        hasDebts: false,
        hasOtherDebts: false,
        hasOverdue: false,
        otherTotalAmount: 0
      });
    }

    const weeks: any[][] = [];
    for (let i = 0; i < gridDays.length; i += 7) {
      weeks.push(gridDays.slice(i, i + 7));
    }
    return weeks;
  });

  selectedDayInfoInMoveModal = computed(() => {
    const dayNum = this.selectedNewDay();
    const base = this.moveModalDate();
    const d = new Date(base.getFullYear(), base.getMonth(), dayNum);
    d.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isToday = d.getTime() === today.getTime();

    const currentItem = this.movingItem();
    const isOriginal = currentItem ? (new Date(currentItem.due).toDateString() === d.toDateString()) : false;

    const allItems = this.getUpcomingItemsForDate(d);
    const otherItems = currentItem ? allItems.filter(it => it.id !== currentItem.id) : allItems;
    const otherTotal = otherItems.reduce((sum, it) => sum + (it.amount || 0), 0);

    return {
      dayNum,
      isToday,
      isOriginal,
      otherCount: otherItems.length,
      otherTotal,
      otherNames: otherItems.map(it => it.name).join(', ')
    };
  });

  getDayMoveTooltip(day: any): string {
    if (!day || !day.isCurrentMonth) return '';
    let txt = `Día ${day.dayNum}`;
    if (day.isToday) txt += ' (Hoy)';
    if (day.isOriginalDay) txt += ' [Fecha actual]';
    if (day.hasOtherDebts) {
      txt += ` • ${day.otherItems.length} otro(s) pago(s): ${day.otherItems.map((i: any) => i.name).join(', ')}`;
    } else {
      txt += ' • Sin otros compromisos';
    }
    return txt;
  }

  daysInCurrentCalendarMonth = computed(() => {
    const base = this.moveModalDate();
    const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    return Array.from({ length: lastDay }, (_, i) => i + 1);
  });

  openMoveDateModal(item: any, event?: Event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    if (item.kind === 'tarjeta') return; // Excluir tarjetas de crédito
    this.movingItem.set(item);
    const itemDate = new Date(item.due);
    this.moveModalDate.set(new Date(itemDate.getFullYear(), itemDate.getMonth(), 1));
    this.selectedNewDay.set(itemDate.getDate());
    this.isMoveDateModalOpen.set(true);
  }

  closeMoveDateModal() {
    this.isMoveDateModalOpen.set(false);
    this.movingItem.set(null);
  }

  confirmMoveDate() {
    const item = this.movingItem();
    if (!item) return;
    const base = this.moveModalDate();
    const targetDate = new Date(base.getFullYear(), base.getMonth(), this.selectedNewDay());
    this.moveItemToDate(item, targetDate);
    this.closeMoveDateModal();
  }

  moveItemToDay(item: any, dayNumber: number) {
    const cur = this.moveModalDate();
    const targetDate = new Date(cur.getFullYear(), cur.getMonth(), dayNumber);
    this.moveItemToDate(item, targetDate);
  }

  moveItemToDate(item: any, targetDate: Date) {
    if (item.kind === 'tarjeta') return; // Solo aplica a deudas y servicios, pagos de tarjeta NO

    const y = targetDate.getFullYear();
    const m = String(targetDate.getMonth() + 1).padStart(2, '0');
    const d = String(targetDate.getDate()).padStart(2, '0');
    const newDateStr = `${y}-${m}-${d}`;
    const newDueDay = targetDate.getDate();

    if (item.kind === 'servicio') {
      const svc = this.financeService.state().services.find(s => s.id === item.id);
      if (svc) {
        const updated = {
          ...svc,
          anchor: newDateStr,
          dueDay: newDueDay
        };
        this.financeService.updateService(svc.id, updated);
      }
    } else {
      // Deuda o préstamo
      const debt = this.financeService.state().debts.find(db => db.id === item.id);
      if (debt) {
        const updated = {
          ...debt,
          anchor: newDateStr,
          dueDay: newDueDay
        };
        this.financeService.updateDebt(debt.id, updated);
      }
    }
  }

  // --- Handlers para Drag & Drop nativo ---
  onItemDragStart(event: DragEvent, item: any) {
    if (item.kind === 'tarjeta') {
      event.preventDefault();
      return;
    }
    this.draggedItem.set(item);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', item.id);
    }
  }

  onItemDragEnd(_event: DragEvent) {
    this.draggedItem.set(null);
    this.dragOverDayDate.set(null);
  }

  onDayDragOver(event: DragEvent, day: any) {
    const item = this.draggedItem();
    if (!item || !day.isCurrentMonth || item.kind === 'tarjeta') return;
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    const dateKey = day.date.toISOString().slice(0, 10);
    if (this.dragOverDayDate() !== dateKey) {
      this.dragOverDayDate.set(dateKey);
    }
  }

  onDayDragLeave(event: DragEvent, day: any) {
    const dateKey = day.date.toISOString().slice(0, 10);
    if (this.dragOverDayDate() === dateKey) {
      this.dragOverDayDate.set(null);
    }
  }

  onDayDrop(event: DragEvent, day: any) {
    event.preventDefault();
    this.dragOverDayDate.set(null);
    const item = this.draggedItem();
    this.draggedItem.set(null);
    if (!item || !day.isCurrentMonth || item.kind === 'tarjeta') return;
    this.moveItemToDate(item, day.date);
  }

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

    // Inicio en Domingo (0 = Domingo, 1 = Lunes, ..., 6 = Sábado) acorde a diseño
    const startDayOfWeek = firstDay.getDay();

    const daysInMonth = lastDay.getDate();
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const gridDays: {
      date: Date;
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      items: any[];
      hasDebts: boolean;
      hasOverdue: boolean;
      totalAmount: number;
    }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Mes anterior
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      d.setHours(0, 0, 0, 0);
      const items = this.getUpcomingItemsForDate(d);
      gridDays.push({
        date: d,
        dayNum: d.getDate(),
        isCurrentMonth: false,
        isToday: d.getTime() === today.getTime(),
        items,
        hasDebts: items.length > 0,
        hasOverdue: items.some(it => it.days < 0),
        totalAmount: items.reduce((sum, it) => sum + (it.amount || 0), 0)
      });
    }

    // Mes actual
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      d.setHours(0, 0, 0, 0);
      const items = this.getUpcomingItemsForDate(d);
      gridDays.push({
        date: d,
        dayNum: i,
        isCurrentMonth: true,
        isToday: d.getTime() === today.getTime(),
        items,
        hasDebts: items.length > 0,
        hasOverdue: items.some(it => it.days < 0),
        totalAmount: items.reduce((sum, it) => sum + (it.amount || 0), 0)
      });
    }

    // Mes siguiente
    const totalSlots = gridDays.length;
    const remainingSlots = (7 - (totalSlots % 7)) % 7;
    for (let i = 1; i <= remainingSlots; i++) {
      const d = new Date(year, month + 1, i);
      d.setHours(0, 0, 0, 0);
      const items = this.getUpcomingItemsForDate(d);
      gridDays.push({
        date: d,
        dayNum: i,
        isCurrentMonth: false,
        isToday: d.getTime() === today.getTime(),
        items,
        hasDebts: items.length > 0,
        hasOverdue: items.some(it => it.days < 0),
        totalAmount: items.reduce((sum, it) => sum + (it.amount || 0), 0)
      });
    }

    const weeks: any[][] = [];
    for (let i = 0; i < gridDays.length; i += 7) {
      weeks.push(gridDays.slice(i, i + 7));
    }
    return weeks;
  });
}
