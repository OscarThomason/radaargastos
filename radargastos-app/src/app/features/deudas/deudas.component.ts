import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FinanceService } from '../../core/services/finance.service';
import { Debt, Installment } from '../../core/models/finance.model';
import { ConfirmModalComponent } from '../../core/components/confirm-modal/confirm-modal.component';

@Component({
  selector: 'app-deudas',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmModalComponent],
  templateUrl: './deudas.component.html',
  styleUrl: './deudas.component.scss'
})
export class DeudasComponent {
  private financeService = inject(FinanceService);

  debts = computed(() => this.financeService.state().debts);

  searchQuery = signal<string>('');
  sortBy = signal<'date' | 'name' | 'amount-desc' | 'amount-asc'>('date');

  filteredDebts = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const sort = this.sortBy();

    let list = this.debts();

    if (q) {
      list = list.filter(d => 
        (d.name && d.name.toLowerCase().includes(q)) ||
        (d.notes && d.notes.toLowerCase().includes(q)) ||
        (d.group && d.group.toLowerCase().includes(q)) ||
        (d.frequency && d.frequency.toLowerCase().includes(q))
      );
    }

    return list.slice().sort((a, b) => {
      if (sort === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sort === 'amount-desc') {
        const amtA = a.group === 'prestamo' ? this.getNextUnpaidForDebt(a) : this.calcMinPaymentForDebt(a);
        const amtB = b.group === 'prestamo' ? this.getNextUnpaidForDebt(b) : this.calcMinPaymentForDebt(b);
        return amtB - amtA;
      }
      if (sort === 'amount-asc') {
        const amtA = a.group === 'prestamo' ? this.getNextUnpaidForDebt(a) : this.calcMinPaymentForDebt(a);
        const amtB = b.group === 'prestamo' ? this.getNextUnpaidForDebt(b) : this.calcMinPaymentForDebt(b);
        return amtA - amtB;
      }
      // default 'date'
      return (a.anchor || '').localeCompare(b.anchor || '');
    });
  });

  frequencies = ['semanal', 'quincenal', 'mensual', 'bimestral', 'anual'];

  editingId: string | null = null;
  expandedId: string | null = null;
  dGroup: 'tarjeta' | 'prestamo' = 'prestamo';
  dName = '';
  dFreq = 'mensual';
  dAnchor = new Date().toISOString().slice(0, 10);
  dNotes = '';
  isModalOpen = false;

  // -- Tarjeta de Crédito --
  dMinPayment: number | null = null;
  dNoInterest: number | null = null;
  dDebtTotal: number | null = null;
  dCat: number | null = null;
  dCreditTerm: number | null = null;

  // -- Préstamo --
  dTotal: number | null = null;
  dPagado: number | null = null;
  dCuota: number | null = null;
  dCuotasPagadas: number | null = null;
  dCuotasTotal: number | null = null;
  dUseVariableInstallments = false;
  dInstallments: Installment[] = [];

  // -- Modal de Pago --
  isPayModalOpen = false;
  payingDebt: Debt | null = null;
  payAmountType: 'minimo' | 'noInterest' | 'otro' | 'cuota' = 'minimo';
  payCustomAmount: number | null = null;
  payRegisterAsExpense = false;

  // -------- Cálculo de Pago Mínimo con CAT --------
  get calculatedMinPayment(): number {
    const debt = this.dDebtTotal || 0;
    const cat = this.dCat;
    const term = this.dCreditTerm;
    if (cat && term && debt > 0) {
      const monthlyRate = Math.pow(1 + cat / 100, 1 / 12) - 1;
      if (monthlyRate === 0) return Math.round((debt / term) * 100) / 100;
      const pmt = debt * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -term)));
      return Math.round(pmt * 100) / 100;
    }
    return this.dMinPayment || 0;
  }

  get usingCatFormula(): boolean {
    return !!(this.dCat && this.dCreditTerm && (this.dDebtTotal || 0) > 0);
  }

  // -------- Cuotas Variables --------
  get totalInstallmentsAmount(): number {
    return this.dInstallments.reduce((sum, i) => sum + (i.amount || 0), 0);
  }

  addInstallment() {
    this.dInstallments = [...this.dInstallments, { amount: 0, paid: false }];
  }

  removeInstallment(index: number) {
    this.dInstallments = this.dInstallments.filter((_, i) => i !== index);
  }

  getNextUnpaidForDebt(debt: Debt): number {
    if (!debt.useVariableInstallments || !debt.installments?.length) {
      return debt.cuota || 0;
    }
    const next = debt.installments.find(i => !i.paid);
    return next?.amount ?? 0;
  }

  getPaidCount(debt: Debt): number {
    if (!debt.installments?.length) return debt.cuotasPagadas || 0;
    return debt.installments.filter(i => i.paid).length;
  }

  getTotalCount(debt: Debt): number {
    if (!debt.installments?.length) return debt.cuotasTotal || 0;
    return debt.installments.length;
  }

  calcMinPaymentForDebt(debt: Debt): number {
    const d = debt.debt || 0;
    const cat = debt.cat;
    const term = debt.creditTerm;
    if (cat && term && d > 0) {
      const monthlyRate = Math.pow(1 + cat / 100, 1 / 12) - 1;
      if (monthlyRate === 0) return Math.round((d / term) * 100) / 100;
      const pmt = d * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -term)));
      return Math.round(pmt * 100) / 100;
    }
    return debt.minPayment || 0;
  }

  // -------- CRUD --------
  openModal() {
    this.cancelEdit();
    this.isModalOpen = true;
  }

  saveDebt() {
    if (!this.dName || !this.dAnchor) {
      alert('Nombre y próxima fecha de pago son obligatorios'); return;
    }

    const item: Debt = {
      id: this.editingId || 'd' + Date.now(),
      group: this.dGroup,
      name: this.dName.trim(),
      frequency: this.dFreq,
      anchor: this.dAnchor,
      notes: this.dNotes.trim()
    };

    if (this.dGroup === 'prestamo') {
      item.useVariableInstallments = this.dUseVariableInstallments;
      if (this.dUseVariableInstallments && this.dInstallments.length > 0) {
        item.installments = [...this.dInstallments];
        const next = item.installments.find(i => !i.paid);
        item.cuota = next?.amount ?? 0;
        item.cuotasTotal = item.installments.length;
        item.cuotasPagadas = item.installments.filter(i => i.paid).length;
        item.pagado = item.installments.filter(i => i.paid).reduce((s, i) => s + i.amount, 0);
        item.total = item.installments.reduce((s, i) => s + i.amount, 0);
      } else {
        item.total = this.dTotal || 0;
        item.pagado = this.dPagado || 0;
        item.cuota = this.dCuota || 0;
        item.cuotasPagadas = this.dCuotasPagadas || 0;
        item.cuotasTotal = this.dCuotasTotal || 0;
        item.installments = undefined;
      }
    } else {
      item.debt = this.dDebtTotal || 0;
      item.noInterest = this.dNoInterest || 0;
      item.cat = this.dCat || undefined;
      item.creditTerm = this.dCreditTerm || undefined;
      item.minPayment = this.usingCatFormula ? this.calculatedMinPayment : (this.dMinPayment || 0);
    }

    if (this.editingId) {
      this.financeService.updateDebt(this.editingId, item);
    } else {
      this.financeService.addDebt(item);
    }
    this.cancelEdit();
  }

  editDebt(id: string) {
    const item = this.debts().find(d => d.id === id);
    if (!item) return;
    this.editingId = item.id;
    this.dGroup = item.group;
    this.dName = item.name;
    this.dFreq = item.frequency || 'mensual';
    this.dAnchor = item.anchor || new Date().toISOString().slice(0, 10);
    this.dNotes = item.notes || '';

    if (item.group === 'prestamo') {
      this.dTotal = item.total || null;
      this.dPagado = item.pagado || null;
      this.dCuota = item.cuota || null;
      this.dCuotasPagadas = item.cuotasPagadas || null;
      this.dCuotasTotal = item.cuotasTotal || null;
      this.dUseVariableInstallments = item.useVariableInstallments || false;
      this.dInstallments = item.installments ? JSON.parse(JSON.stringify(item.installments)) : [];
      this.dMinPayment = null; this.dNoInterest = null; this.dDebtTotal = null;
      this.dCat = null; this.dCreditTerm = null;
    } else {
      this.dMinPayment = item.minPayment || null;
      this.dNoInterest = item.noInterest || null;
      this.dDebtTotal = item.debt || null;
      this.dCat = item.cat || null;
      this.dCreditTerm = item.creditTerm || null;
      this.dTotal = null; this.dPagado = null; this.dCuota = null;
      this.dCuotasPagadas = null; this.dCuotasTotal = null;
      this.dUseVariableInstallments = false; this.dInstallments = [];
    }
    this.isModalOpen = true;
  }

  cancelEdit() {
    this.editingId = null;
    this.dName = '';
    this.dTotal = null; this.dPagado = null; this.dCuota = null;
    this.dCuotasPagadas = null; this.dCuotasTotal = null;
    this.dMinPayment = null; this.dNoInterest = null; this.dDebtTotal = null;
    this.dCat = null; this.dCreditTerm = null;
    this.dUseVariableInstallments = false; this.dInstallments = [];
    this.dFreq = 'mensual';
    this.dAnchor = new Date().toISOString().slice(0, 10);
    this.dNotes = '';
    this.isModalOpen = false;
  }

  // -- Modal de Confirmación de Eliminar --
  confirmDeleteId: string | null = null;
  confirmDeleteName = '';

  askDeleteDebt(id: string, name: string) {
    this.confirmDeleteId = id;
    this.confirmDeleteName = name;
  }

  confirmDeleteDebt() {
    if (this.confirmDeleteId) {
      this.financeService.deleteDebt(this.confirmDeleteId);
      if (this.editingId === this.confirmDeleteId) this.cancelEdit();
      this.cancelDeleteDebt();
    }
  }

  cancelDeleteDebt() {
    this.confirmDeleteId = null;
    this.confirmDeleteName = '';
  }

  // -------- LÓGICA DE PAGOS --------
  openPayModal(id: string) {
    const item = this.debts().find(d => d.id === id);
    if (!item) return;
    this.payingDebt = JSON.parse(JSON.stringify(item));
    this.payRegisterAsExpense = false;
    this.payCustomAmount = null;
    if (item.group === 'prestamo') {
      this.payAmountType = 'cuota';
      this.payCustomAmount = this.getNextUnpaidForDebt(item);
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
      if (debt.creditTerm && debt.creditTerm > 1) debt.creditTerm--;
    } else {
      if (debt.useVariableInstallments && debt.installments?.length) {
        const idx = debt.installments.findIndex(i => !i.paid);
        if (idx !== -1) {
          debt.installments[idx].paid = true;
          amountPaid = debt.installments[idx].amount;
          debt.cuotasPagadas = (debt.cuotasPagadas || 0) + 1;
          debt.pagado = (debt.pagado || 0) + amountPaid;
          const nextIdx = debt.installments.findIndex(i => !i.paid);
          debt.cuota = nextIdx !== -1 ? debt.installments[nextIdx].amount : 0;
        }
      } else {
        amountPaid = this.payCustomAmount || debt.cuota || 0;
        debt.pagado = (debt.pagado || 0) + amountPaid;
        debt.cuotasPagadas = (debt.cuotasPagadas || 0) + 1;
      }
    }

    if (this.payRegisterAsExpense && amountPaid > 0) {
      this.financeService.addExpense({
        id: 'e' + Date.now(),
        date: new Date().toISOString().slice(0, 10),
        time: new Date().toTimeString().slice(0, 5),
        category: 'Deudas',
        description: `Pago: ${debt.name}`,
        amount: amountPaid
      });
    }

    if (debt.anchor) {
      debt.anchor = this.advanceAnchor(debt.anchor, debt.frequency || 'mensual');
    }
    this.financeService.updateDebt(debt.id, debt);
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

  money(amount: number) {
    return this.financeService.currency() + amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  formatDate(dateStr?: string) {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  getDaysRemaining(anchorStr?: string): string {
    if (!anchorStr) return '—';
    const anchorDate = new Date(anchorStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((anchorDate.getTime() - today.getTime()) / 86400000);
    if (diffDays < 0) return `${Math.abs(diffDays)}d vencido`;
    if (diffDays === 0) return 'Hoy';
    return `${diffDays}d`;
  }

  getDaysClass(anchorStr?: string): string {
    if (!anchorStr) return 'inherit';
    const anchorDate = new Date(anchorStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((anchorDate.getTime() - today.getTime()) / 86400000);
    if (diffDays < 0) return '#D32F2F';
    if (diffDays <= 2) return '#92400E';
    return 'inherit';
  }

  toggleExpand(id: string) {
    this.expandedId = this.expandedId === id ? null : id;
  }
}
