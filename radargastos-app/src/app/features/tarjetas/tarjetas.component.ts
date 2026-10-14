import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FinanceService } from '../../core/services/finance.service';
import { Card } from '../../core/models/finance.model';
import { ConfirmModalComponent } from '../../core/components/confirm-modal/confirm-modal.component';

@Component({
  selector: 'app-tarjetas',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmModalComponent],
  templateUrl: './tarjetas.component.html',
  styleUrl: './tarjetas.component.scss'
})
export class TarjetasComponent {
  private financeService = inject(FinanceService);

  cards = this.financeService.cardsWithBalance;
  debts = computed(() => this.financeService.state().debts);

  debitCards = computed(() => this.cards().filter(c => c.type === 'debito'));
  creditCards = computed(() => this.cards().filter(c => c.type === 'credito'));

  // Métricas Consolidadas
  totalCreditLimit = computed(() => this.creditCards().reduce((sum, c) => sum + (c.limit || 0), 0));
  totalCreditDebt = computed(() => this.creditCards().reduce((sum, c) => sum + (c.computedDebt || 0), 0));
  totalCreditAvailable = computed(() => Math.max(0, this.totalCreditLimit() - this.totalCreditDebt()));
  consolidatedDebt = computed(() => this.financeService.totalConsolidatedDebt());

  // Formulario de Tarjeta (Añadir / Editar)
  isModalOpen = false;
  editingId: string | null = null;
  cName = '';
  cType: 'credito' | 'debito' = 'credito';
  cLimit: number | null = null;
  cDebt: number | null = null;
  cBalance: number | null = null;
  cDueDate = '';
  cCutoffDate = '';
  cInterestRate: number | null = null;
  cCatWithoutIva: number | null = null;
  cCat: number | null = null;
  cAnnualFee: number | null = null;
  cLatePaymentFee: number | null = null;
  cNoInterest: number | null = null;
  cMinPayment: number | null = null;
  cCreditTerm: number | null = null;
  cNotes = '';

  get cAvailableLimit(): number {
    const limit = this.cLimit || 0;
    const debt = this.cDebt || 0;
    return Math.max(0, limit - debt);
  }

  // Modal de Pago a Tarjeta
  isPayModalOpen = false;
  payingCard: Card | null = null;
  payAmountType: 'minimo' | 'noInterest' | 'otro' = 'noInterest';
  payCustomAmount: number | null = null;
  payRegisterAsExpense = true;

  // Modal de Confirmación de Eliminar
  confirmDeleteId: string | null = null;
  confirmDeleteName = '';

  money(amount: number): string {
    return this.financeService.currency() + (amount || 0).toLocaleString('es-MX', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return 'No definida';
    const [y, m, d] = dateStr.split('-');
    if (!y || !m || !d) return dateStr;
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  getDaysRemaining(dueDate?: string): string {
    if (!dueDate) return '—';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate + 'T00:00:00');
    const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return `Vencido hace ${Math.abs(diffDays)}d`;
    if (diffDays === 0) return 'Vence hoy';
    if (diffDays === 1) return 'Vence mañana';
    return `En ${diffDays} días`;
  }

  getDaysClass(dueDate?: string): string {
    if (!dueDate) return 'var(--text-muted)';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate + 'T00:00:00');
    const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return '#0369A1';
    if (diffDays <= 3) return '#0284C7';
    return '#64748B';
  }

  getCreditUsagePercent(card: Card): number {
    const limit = card.limit || 0;
    if (limit <= 0) return 0;
    const debt = card.computedDebt !== undefined ? card.computedDebt : (card.debt || 0);
    return Math.min(100, Math.max(0, Math.round((debt / limit) * 100)));
  }

  calcMinPayment(card: Card): number {
    const debt = card.computedDebt !== undefined ? card.computedDebt : (card.debt || 0);
    const cat = card.cat || card.catWithoutIva;
    const term = card.creditTerm;
    if (cat && term && debt > 0) {
      const monthlyRate = Math.pow(1 + cat / 100, 1 / 12) - 1;
      if (monthlyRate === 0) return Math.round((debt / term) * 100) / 100;
      const pmt = debt * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -term)));
      return Math.round(pmt * 100) / 100;
    }
    return card.minPayment || 0;
  }

  openAddModal(type: 'credito' | 'debito' = 'credito') {
    this.closeModal();
    this.cType = type;
    this.cDueDate = new Date().toISOString().slice(0, 10);
    this.isModalOpen = true;
  }

  openEditModal(card: Card) {
    this.editingId = card.id;
    this.cName = card.name;
    this.cType = card.type;
    this.cLimit = card.limit || null;
    this.cDebt = card.debt !== undefined ? card.debt : (card.computedDebt || null);
    this.cBalance = card.type === 'debito' ? (card.computedBalance !== undefined ? card.computedBalance : card.balance) : null;
    this.cDueDate = card.dueDate || '';
    this.cCutoffDate = card.cutoffDate || '';
    this.cInterestRate = card.interestRate || null;
    this.cCatWithoutIva = card.catWithoutIva || null;
    this.cCat = card.cat || card.catWithoutIva || null;
    this.cAnnualFee = card.annualFee || null;
    this.cLatePaymentFee = card.latePaymentFee || null;
    this.cNoInterest = card.noInterest || null;
    this.cMinPayment = card.minPayment || null;
    this.cCreditTerm = card.creditTerm || null;
    this.cNotes = card.notes || '';
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
    this.editingId = null;
    this.cName = '';
    this.cType = 'credito';
    this.cLimit = null;
    this.cDebt = null;
    this.cBalance = null;
    this.cDueDate = '';
    this.cCutoffDate = '';
    this.cInterestRate = null;
    this.cCatWithoutIva = null;
    this.cCat = null;
    this.cAnnualFee = null;
    this.cLatePaymentFee = null;
    this.cNoInterest = null;
    this.cMinPayment = null;
    this.cCreditTerm = null;
    this.cNotes = '';
  }

  saveCard() {
    if (!this.cName.trim()) {
      alert('Por favor ingresa un nombre para la tarjeta.');
      return;
    }

    const cardId = this.editingId || ('c' + Date.now());
    const existing = this.editingId ? this.cards().find(c => c.id === this.editingId) : null;

    const cardData: Card = {
      id: cardId,
      name: this.cName.trim(),
      type: this.cType,
      balance: this.cType === 'credito' ? (this.cDebt || 0) : (this.cBalance || 0),
      notes: this.cNotes.trim()
    };

    if (this.cType === 'credito') {
      cardData.limit = this.cLimit || 0;
      cardData.debt = this.cDebt || 0;
      cardData.availableLimit = Math.max(0, (this.cLimit || 0) - (this.cDebt || 0));
      cardData.dueDate = this.cDueDate || undefined;
      cardData.cutoffDate = this.cCutoffDate || undefined;
      cardData.interestRate = this.cInterestRate || undefined;
      cardData.catWithoutIva = this.cCatWithoutIva || undefined;
      cardData.cat = this.cCat || this.cCatWithoutIva || undefined;
      cardData.annualFee = this.cAnnualFee || undefined;
      cardData.latePaymentFee = this.cLatePaymentFee || undefined;
      cardData.noInterest = this.cNoInterest || undefined;
      cardData.minPayment = this.cMinPayment || undefined;
      cardData.creditTerm = this.cCreditTerm || undefined;
      cardData.linkedDebtId = existing?.linkedDebtId || ('d_' + cardId);
    }

    if (this.editingId) {
      this.financeService.updateCard(this.editingId, cardData);
    } else {
      this.financeService.addCard(cardData);
    }

    this.closeModal();
  }

  // --- Abono / Pago a Tarjeta ---
  openPayModal(card: Card) {
    this.payingCard = card;
    this.payAmountType = 'noInterest';
    this.payCustomAmount = card.noInterest || card.computedDebt || 0;
    this.payRegisterAsExpense = true;
    this.isPayModalOpen = true;
  }

  closePayModal() {
    this.isPayModalOpen = false;
    this.payingCard = null;
    this.payCustomAmount = null;
  }

  submitPayment() {
    if (!this.payingCard) return;

    let amount = 0;
    if (this.payAmountType === 'noInterest') {
      amount = this.payingCard.noInterest || this.payingCard.computedDebt || 0;
    } else if (this.payAmountType === 'minimo') {
      amount = this.calcMinPayment(this.payingCard);
    } else {
      amount = Number(this.payCustomAmount) || 0;
    }

    if (amount <= 0) {
      alert('Ingresa un monto válido mayor a 0');
      return;
    }

    this.financeService.payCreditCard(this.payingCard.id, amount, this.payRegisterAsExpense);
    this.closePayModal();
  }

  // --- Confirmación de Eliminar ---
  askDeleteCard(id: string, name: string) {
    this.confirmDeleteId = id;
    this.confirmDeleteName = name;
  }

  confirmDeleteCard() {
    if (this.confirmDeleteId) {
      this.financeService.deleteCard(this.confirmDeleteId);
      if (this.editingId === this.confirmDeleteId) this.closeModal();
      this.cancelDeleteCard();
    }
  }

  cancelDeleteCard() {
    this.confirmDeleteId = null;
    this.confirmDeleteName = '';
  }
}
