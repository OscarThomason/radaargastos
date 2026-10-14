import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FinanceService } from '../../core/services/finance.service';
import { AiAdvisorService } from '../../core/services/ai-advisor.service';
import { Expense, Income, N8nAgentResponse, Card } from '../../core/models/finance.model';
import { StatCardComponent } from '../../core/components/stat-card/stat-card.component';
import { ConfirmModalComponent } from '../../core/components/confirm-modal/confirm-modal.component';

@Component({
  selector: 'app-gastos',
  standalone: true,
  imports: [CommonModule, FormsModule, StatCardComponent, ConfirmModalComponent],
  templateUrl: './gastos.component.html',
  styleUrl: './gastos.component.scss'
})
export class GastosComponent {
  private financeService = inject(FinanceService);
  private aiAdvisor = inject(AiAdvisorService);

  categories = this.financeService.expenseCategories;
  incomeCategories = this.financeService.incomeCategories;

  allExpenses = computed(() => this.financeService.state().expenses);
  allIncomes = computed(() => this.financeService.state().incomes);
  debts = computed(() => this.financeService.state().debts || []);
  cards = computed(() => this.financeService.cardsWithBalance());

  selectedMonth = signal<string>(new Date().toISOString().slice(0, 7));
  showTotals = signal(true);

  toggleTotals() {
    this.showTotals.set(!this.showTotals());
  }

  /** Determina si un ingreso proviene de un préstamo recibido por el usuario (pasivo que no debe inflar ingresos propios) */
  isLoanIncome(income?: Income | null): boolean {
    if (!income) return false;
    const cat = (income.category || '').toLowerCase().trim();
    const desc = (income.description || '').toLowerCase().trim();

    // Préstamos por cobrar representan préstamos otorgados por el usuario a terceros (activos recuperados), sí son dinero propio
    if (cat.includes('por cobrar') || cat.includes('cobrado') || desc.includes('cobro préstamo') || desc.includes('abono a préstamo')) {
      return false;
    }

    return cat.includes('préstamo') || cat.includes('prestamo') || /prestamo recibido|préstamo recibido|dinero prestado en mano/i.test(desc);
  }

  // --- Lógica de Dinero Prestado Activo en Mano (Ajuste por Fecha: Vigencia a partir de Octubre 2026) ---
  private readonly startBorrowedTrackingMonth = '2026-10';

  // 1. Ingresos clasificados como préstamos recibidos en mano desde Octubre 2026 hasta el mes seleccionado
  activeBorrowedIncomes = computed(() => {
    const activeMonth = this.selectedMonth();
    return this.allIncomes()
      .filter(i => {
        const m = i.date.slice(0, 7);
        return m >= this.startBorrowedTrackingMonth && m <= activeMonth && this.isLoanIncome(i);
      })
      .reduce((sum, i) => sum + i.amount, 0);
  });

  // 2. Gastos financiados con dinero prestado activo desde Octubre 2026 hasta el mes seleccionado
  activeBorrowedSpent = computed(() => {
    const activeMonth = this.selectedMonth();
    return this.allExpenses()
      .filter(e => {
        const m = e.date.slice(0, 7);
        return m >= this.startBorrowedTrackingMonth && m <= activeMonth && e.fundingSource === 'prestamo';
      })
      .reduce((sum, e) => sum + e.amount, 0);
  });

  // 3. Saldo disponible real en mano de Dinero Prestado Activo
  activeBorrowedMoney = computed(() => {
    return Math.max(0, this.activeBorrowedIncomes() - this.activeBorrowedSpent());
  });

  // Tarjetas de crédito y Crédito disponible a usar global
  creditCards = computed(() => this.cards().filter(c => c.type === 'credito'));
  totalAvailableCredit = computed(() => {
    return this.creditCards().reduce((sum, c) => {
      const avail = c.availableLimit !== undefined ? c.availableLimit : Math.max(0, (c.limit || 0) - (c.computedDebt || 0));
      return sum + Math.max(0, avail);
    }, 0);
  });

  availableMonths = computed(() => {
    const months = new Set<string>();
    this.allExpenses().forEach(e => months.add(e.date.slice(0, 7)));
    this.allIncomes().forEach(i => months.add(i.date.slice(0, 7)));
    months.add(new Date().toISOString().slice(0, 7)); 
    return Array.from(months).sort().reverse(); 
  });

  searchQuery = signal<string>('');
  sortBy = signal<'date' | 'name' | 'amount-desc' | 'amount-asc'>('date');

  expenses = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const sort = this.sortBy();

    let list = this.allExpenses().filter(e => e.date.slice(0, 7) === this.selectedMonth());

    if (q) {
      list = list.filter(e => 
        (e.description && e.description.toLowerCase().includes(q)) ||
        (e.category && e.category.toLowerCase().includes(q))
      );
    }

    return list.slice().sort((a, b) => {
      if (sort === 'name') {
        const descA = a.description || a.category || '';
        const descB = b.description || b.category || '';
        return descA.localeCompare(descB);
      }
      if (sort === 'amount-desc') {
        return b.amount - a.amount;
      }
      if (sort === 'amount-asc') {
        return a.amount - b.amount;
      }
      // default 'date'
      return b.date.localeCompare(a.date);
    });
  });

  incomes = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const sort = this.sortBy();

    let list = this.allIncomes().filter(i => i.date.slice(0, 7) === this.selectedMonth());

    if (q) {
      list = list.filter(i => 
        (i.description && i.description.toLowerCase().includes(q)) ||
        (i.category && i.category.toLowerCase().includes(q))
      );
    }

    return list.slice().sort((a, b) => {
      if (sort === 'name') {
        const descA = a.description || a.category || '';
        const descB = b.description || b.category || '';
        return descA.localeCompare(descB);
      }
      if (sort === 'amount-desc') {
        return b.amount - a.amount;
      }
      if (sort === 'amount-asc') {
        return a.amount - b.amount;
      }
      // default 'date'
      return b.date.localeCompare(a.date);
    });
  });

  // Saldo anterior acumulado de meses previos (sin distorsión retroactiva)
  pastBalance = computed(() => {
    const activeMonth = this.selectedMonth();
    const pastIn = this.allIncomes()
      .filter(i => i.date.slice(0, 7) < activeMonth)
      .reduce((acc, curr) => acc + curr.amount, 0);
    const pastEx = this.allExpenses()
      .filter(e => e.date.slice(0, 7) < activeMonth)
      .reduce((acc, curr) => acc + curr.amount, 0);
    return pastIn - pastEx;
  });

  // Total de ingresos del mes: únicamente ingresos ordinarios propios (aislando préstamos recibidos para no inflar liquidez)
  totalIncomes = computed(() => {
    return this.incomes()
      .filter(i => !this.isLoanIncome(i))
      .reduce((acc, curr) => acc + curr.amount, 0);
  });

  // Gastos del mes con fondos propios
  ownExpenses = computed(() => {
    return this.expenses()
      .filter(e => e.fundingSource !== 'prestamo')
      .reduce((acc, curr) => acc + curr.amount, 0);
  });

  // Gastos del mes financiados con dinero prestado activo
  borrowedExpenses = computed(() => {
    return this.expenses()
      .filter(e => e.fundingSource === 'prestamo')
      .reduce((acc, curr) => acc + curr.amount, 0);
  });

  // Total de gastos del mes registrados
  totalExpenses = computed(() => this.expenses().reduce((acc, curr) => acc + curr.amount, 0));

  // Balance disponible propio en tiempo real (Saldo anterior + Ingresos propios - Gastos propios)
  balance = computed(() => this.pastBalance() + this.totalIncomes() - this.ownExpenses());

  // Modales
  isExpenseModalOpen = false;
  isIncomeModalOpen = false;
  selectedDetailItem: { type: 'expense' | 'income'; data: any } | null = null;

  exDate = new Date().toISOString().slice(0, 10);
  exTime = '';
  exCat = this.categories()[0];
  exDesc = '';
  exAmount: number | null = null;
  exPaymentMethod = 'efectivo';
  exFundingSource: 'propios' | 'prestamo' = 'propios';
  editingExId: string | null = null;
  editingExOriginalBorrowedAmount = 0;
  editingExOriginalAmount: number | null = null;
  editingExOriginalPaymentMethod: string | null = null;

  // Cupo de préstamo disponible para el modal actual (incluyendo el monto original si se está editando)
  availableBorrowedForModal = computed(() => {
    return this.activeBorrowedMoney() + this.editingExOriginalBorrowedAmount;
  });

  /** Retorna el saldo o límite disponible de una tarjeta, contemplando edición de gasto previo */
  getCardAvailable(card: Card): number {
    let available = 0;
    if (card.type === 'credito') {
      available = card.availableLimit !== undefined ? card.availableLimit : 0;
    } else {
      available = card.computedBalance !== undefined ? card.computedBalance : 0;
    }

    // Si estamos editando un gasto y este gasto ya estaba pagado con esta tarjeta, le sumamos de vuelta el monto original
    if (this.editingExId && this.editingExOriginalPaymentMethod === card.id && this.editingExOriginalAmount) {
      available += this.editingExOriginalAmount;
    }

    return Math.max(0, available);
  }

  /** Determina si una tarjeta debe estar deshabilitada por saldo <= 0 o por no cubrir el monto ingresado */
  isCardDisabled(card: Card): boolean {
    const available = this.getCardAvailable(card);
    if (available <= 0) return true;
    if (this.exAmount !== null && this.exAmount > 0 && this.exAmount > available) {
      return true;
    }
    return false;
  }

  /** Determina si Dinero Prestado debe estar deshabilitado por saldo <= 0 o por no cubrir el monto ingresado */
  isBorrowedDisabled(): boolean {
    const available = this.availableBorrowedForModal();
    if (available <= 0) return true;
    if (this.exAmount !== null && this.exAmount > 0 && this.exAmount > available) {
      return true;
    }
    return false;
  }

  /** Verifica si el método de pago actualmente seleccionado no cubre el monto ingresado */
  isCurrentPaymentMethodInsufficient(): boolean {
    if (this.exAmount === null || this.exAmount <= 0) return false;

    if (this.exPaymentMethod === 'dinero_prestado') {
      return this.exAmount > this.availableBorrowedForModal();
    }

    if (this.exPaymentMethod !== 'efectivo') {
      const card = this.cards().find(c => c.id === this.exPaymentMethod);
      if (card) {
        return this.exAmount > this.getCardAvailable(card);
      }
    }

    return false;
  }

  inDate = new Date().toISOString().slice(0, 10);
  inCat = this.incomeCategories()[0];
  inDesc = '';
  inAmount: number | null = null;
  inPaymentMethod = 'efectivo';
  editingInId: string | null = null;

  openAddExpenseModal() {
    this.editingExId = null;
    this.editingExOriginalBorrowedAmount = 0;
    this.editingExOriginalAmount = null;
    this.editingExOriginalPaymentMethod = null;
    this.exDate = new Date().toISOString().slice(0, 10);
    this.exTime = new Date().toTimeString().slice(0, 5);
    this.exCat = this.categories()[0] || 'General';
    this.exDesc = '';
    this.exAmount = null;
    this.exPaymentMethod = 'efectivo';
    this.exFundingSource = 'propios';
    this.isExpenseModalOpen = true;
  }

  openAddIncomeModal() {
    this.editingInId = null;
    this.inDate = new Date().toISOString().slice(0, 10);
    this.inCat = this.incomeCategories()[0] || 'Ingreso';
    this.inDesc = '';
    this.inAmount = null;
    this.inPaymentMethod = 'efectivo';
    this.isIncomeModalOpen = true;
  }

  get selectedDetailData() {
    return this.selectedDetailItem?.data;
  }

  get selectedDetailIsExpense() {
    return this.selectedDetailItem?.type === 'expense';
  }

  showItemDetails(type: 'expense' | 'income', item: Expense | Income) {
    this.selectedDetailItem = { type, data: item };
  }

  closeItemDetails() {
    this.selectedDetailItem = null;
  }

  editFromDetails() {
    if (!this.selectedDetailItem) return;
    const { type, data } = this.selectedDetailItem;
    this.closeItemDetails();
    if (type === 'expense') {
      this.editExpense(data as Expense);
      this.isExpenseModalOpen = true;
    } else {
      this.editIncome(data as Income);
      this.isIncomeModalOpen = true;
    }
  }

  deleteFromDetails() {
    if (!this.selectedDetailItem) return;
    const { type, data } = this.selectedDetailItem;
    this.closeItemDetails();
    if (type === 'expense') {
      this.askDeleteExpense(data.id, (data as Expense).description);
    } else {
      this.askDeleteIncome(data.id, (data as Income).description);
    }
  }

  editExpense(item: Expense) {
    this.editingExId = item.id;
    this.editingExOriginalAmount = item.amount;
    this.editingExOriginalPaymentMethod = item.paymentMethod || 'efectivo';
    this.exDate = item.date;
    this.exTime = item.time || '';
    this.exCat = item.category;
    this.exDesc = item.description;
    this.exAmount = item.amount;
    const isBorrowed = item.fundingSource === 'prestamo' || item.paymentMethod === 'dinero_prestado';
    this.exPaymentMethod = isBorrowed ? 'dinero_prestado' : (item.paymentMethod || 'efectivo');
    this.exFundingSource = isBorrowed ? 'prestamo' : 'propios';
    this.editingExOriginalBorrowedAmount = isBorrowed ? item.amount : 0;
  }

  onPaymentMethodChange(val: string) {
    this.exPaymentMethod = val;
    this.exFundingSource = val === 'dinero_prestado' ? 'prestamo' : 'propios';
  }

  editIncome(item: Income) {
    this.editingInId = item.id;
    this.inDate = item.date;
    this.inCat = item.category;
    this.inDesc = item.description;
    this.inAmount = item.amount;
    this.inPaymentMethod = item.paymentMethod || 'efectivo';
  }

  addExpense() {
    if (!this.exDate || this.exAmount === null) {
      alert('Completa fecha y monto'); return;
    }

    if (this.exAmount <= 0) {
      alert('Ingresa un monto válido mayor a cero'); return;
    }

    const isBorrowed = this.exPaymentMethod === 'dinero_prestado' || this.exFundingSource === 'prestamo';

    // Validación de Dinero Prestado Activo
    if (isBorrowed) {
      const availableBorrowed = this.availableBorrowedForModal();
      if (this.exAmount > availableBorrowed) {
        alert(`El monto ingresado (${this.money(this.exAmount)}) supera el saldo disponible de Dinero Prestado Activo (${this.money(availableBorrowed)}).`);
        return;
      }
    }

    // Validación de Tarjetas de Crédito / Débito
    if (this.exPaymentMethod !== 'efectivo' && !isBorrowed) {
      const selectedCard = this.cards().find(c => c.id === this.exPaymentMethod);
      if (selectedCard) {
        const available = this.getCardAvailable(selectedCard);
        if (this.exAmount > available) {
          const tipoTexto = selectedCard.type === 'credito' ? 'límite de crédito disponible' : 'saldo disponible';
          alert(`La tarjeta "${selectedCard.name}" solo cuenta con ${this.money(available)} de ${tipoTexto} y no cubre este importe de ${this.money(this.exAmount)}.`);
          return;
        }
      }
    }

    const isEss = this.aiAdvisor.isEssential(this.exCat);
    
    const item: Expense = {
      id: this.editingExId || 'e' + Date.now(),
      date: this.exDate,
      time: this.exTime || undefined,
      category: this.exCat,
      description: this.exDesc.trim(),
      amount: this.exAmount,
      paymentMethod: this.exPaymentMethod,
      fundingSource: isBorrowed ? 'prestamo' : 'propios',
      esEvitable: !isEss,
      nivelNecesidad: isEss ? 'Esencial' : 'Opcional'
    };

    if (this.editingExId) {
      this.financeService.updateExpense(this.editingExId, item);
      this.editingExId = null;
    } else {
      this.financeService.addExpense(item);
    }
    
    this.cancelExEdit();
  }

  cancelExEdit() {
    this.editingExId = null;
    this.editingExOriginalBorrowedAmount = 0;
    this.editingExOriginalAmount = null;
    this.editingExOriginalPaymentMethod = null;
    this.exDate = new Date().toISOString().slice(0, 10);
    this.exTime = '';
    this.exDesc = '';
    this.exAmount = null;
    this.exPaymentMethod = 'efectivo';
    this.exFundingSource = 'propios';
    this.isExpenseModalOpen = false;
  }

  addIncome() {
    if (!this.inDate || this.inAmount === null) {
      alert('Completa fecha y monto del ingreso'); return;
    }
    
    const item: Income = {
      id: this.editingInId || 'i' + Date.now(),
      date: this.inDate,
      category: this.inCat,
      description: this.inDesc.trim(),
      amount: this.inAmount,
      paymentMethod: this.inPaymentMethod
    };

    if (this.editingInId) {
      this.financeService.updateIncome(this.editingInId, item);
      this.editingInId = null;
    } else {
      this.financeService.addIncome(item);
    }
    
    this.cancelInEdit();
  }

  cancelInEdit() {
    this.editingInId = null;
    this.inDate = new Date().toISOString().slice(0, 10);
    this.inDesc = '';
    this.inAmount = null;
    this.inPaymentMethod = 'efectivo';
    this.isIncomeModalOpen = false;
  }

  // -- Modal de Confirmación de Eliminar --
  confirmDeleteId: string | null = null;
  confirmDeleteName = '';
  confirmDeleteType: 'expense' | 'income' = 'expense';

  askDeleteExpense(id: string, desc: string) {
    this.confirmDeleteId = id;
    this.confirmDeleteName = desc || 'este gasto';
    this.confirmDeleteType = 'expense';
  }

  askDeleteIncome(id: string, desc: string) {
    this.confirmDeleteId = id;
    this.confirmDeleteName = desc || 'este ingreso';
    this.confirmDeleteType = 'income';
  }

  confirmDelete() {
    if (this.confirmDeleteId) {
      if (this.confirmDeleteType === 'expense') {
        this.financeService.deleteExpense(this.confirmDeleteId);
      } else {
        this.financeService.deleteIncome(this.confirmDeleteId);
      }
      this.cancelDelete();
    }
  }

  cancelDelete() {
    this.confirmDeleteId = null;
    this.confirmDeleteName = '';
  }

  onMonthChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.selectedMonth.set(select.value);
  }

  formatMonth(monthKey: string) {
    const [y, m] = monthKey.split('-');
    const d = new Date(parseInt(y), parseInt(m) - 1, 1);
    const text = d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  money(amount: number) {
    return this.financeService.currency() + amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  getCardName(id?: string) {
    if (!id || id === 'efectivo') return 'Efectivo';
    if (id === 'dinero_prestado') return 'Dinero Prestado Activo';
    const c = this.cards().find(x => x.id === id);
    return c ? c.name : 'Efectivo';
  }

  formatTime(timeStr?: string) {
    return this.financeService.formatTime(timeStr);
  }

  getCategoryEmoji(category?: string): string {
    if (!category) return '💸';
    const cat = category.toLowerCase().trim();

    if (cat.includes('servicio')) return '⚡';
    if (cat.includes('deuda')) return '💳';
    if (cat.includes('transporte') || cat.includes('gasolina') || cat.includes('auto') || cat.includes('uber')) return '🚗';
    if (cat.includes('alimento') || cat.includes('super') || cat.includes('despensa') || cat.includes('comida')) return '🛒';
    if (cat.includes('restaurante') || cat.includes('cenar') || cat.includes('comida fuera')) return '🍔';
    if (cat.includes('ocio') || cat.includes('oscio') || cat.includes('cine') || cat.includes('entretenimiento') || cat.includes('juego')) return '🎮';
    if (cat.includes('salud') || cat.includes('farmacia') || cat.includes('médico') || cat.includes('doctor')) return '💊';
    if (cat.includes('gym') || cat.includes('nutricion') || cat.includes('deporte') || cat.includes('ejercicio')) return '🏋️‍♂️';
    if (cat.includes('ropa') || cat.includes('accesorios') || cat.includes('moda') || cat.includes('zapatos')) return '🛍️';
    if (cat.includes('casa') || cat.includes('hogar') || cat.includes('renta') || cat.includes('mantenimiento')) return '🏠';
    if (cat.includes('viaje') || cat.includes('hotel') || cat.includes('vuelo') || cat.includes('vacaciones')) return '✈️';
    if (cat.includes('mascota') || cat.includes('perro') || cat.includes('gato') || cat.includes('vet')) return '🐶';
    if (cat.includes('sueldo') || cat.includes('salario') || cat.includes('nómina')) return '💼';
    if (cat.includes('negocio') || cat.includes('ventas') || cat.includes('ganancia')) return '📈';
    if (cat.includes('préstamo') || cat.includes('prestamo')) return '🤝';
    if (cat.includes('regalía') || cat.includes('regalia') || cat.includes('inversión')) return '👑';

    return '🏷️';
  }
}
