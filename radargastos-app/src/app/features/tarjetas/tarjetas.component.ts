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

  /** Busca la deuda de tarjeta asociada a la tarjeta por nombre (case insensitive) */
  getLinkedDebt(cardName: string) {
    const n = cardName.toLowerCase();
    return this.debts().find(d => d.group === 'tarjeta' && d.name.toLowerCase().includes(n));
  }

  /** Calcula el pago mínimo con CAT para una tarjeta dada (si tiene deuda vinculada) */
  calcMinPayment(cardName: string, currentDebt: number): number {
    const debt = this.getLinkedDebt(cardName);
    if (!debt) return 0;
    const d = currentDebt; // usa la deuda actual calculada (puede diferir de debt.debt)
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

  // Form
  isAdding = false;
  newName = '';
  newType: 'credito' | 'debito' = 'credito';
  newLimit: number | null = null;
  newBalance: number | null = null;

  money(amount: number) {
    return this.financeService.currency() + amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  addCard() {
    if (!this.newName.trim()) return;
    
    const card: Card = {
      id: 'c' + Date.now(),
      name: this.newName.trim(),
      type: this.newType,
      balance: this.newBalance || 0
    };

    if (this.newType === 'credito') {
      if (!this.newLimit) return;
      card.limit = this.newLimit;
    }

    this.financeService.addCard(card);
    this.cancelAdd();
  }

  cancelAdd() {
    this.isAdding = false;
    this.newName = '';
    this.newType = 'credito';
    this.newLimit = null;
    this.newBalance = null;
  }

  // -- Modal de Confirmación de Eliminar --
  confirmDeleteId: string | null = null;
  confirmDeleteName = '';

  askDeleteCard(id: string, name: string) {
    this.confirmDeleteId = id;
    this.confirmDeleteName = name;
  }

  confirmDeleteCard() {
    if (this.confirmDeleteId) {
      this.financeService.deleteCard(this.confirmDeleteId);
      this.cancelDeleteCard();
    }
  }

  cancelDeleteCard() {
    this.confirmDeleteId = null;
    this.confirmDeleteName = '';
  }
}
