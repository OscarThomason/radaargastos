import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FinanceService } from '../../core/services/finance.service';
import { Card } from '../../core/models/finance.model';

@Component({
  selector: 'app-tarjetas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tarjetas.component.html',
  styleUrl: './tarjetas.component.scss'
})
export class TarjetasComponent {
  private financeService = inject(FinanceService);

  cards = this.financeService.cardsWithBalance;
  
  debitCards = computed(() => this.cards().filter(c => c.type === 'debito'));
  creditCards = computed(() => this.cards().filter(c => c.type === 'credito'));

  // Form
  isAdding = false;
  newName = '';
  newType: 'credito' | 'debito' = 'credito';
  newLimit: number | null = null;
  newBalance: number | null = null;

  money(amount: number) {
    return '$' + amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

  deleteCard(id: string) {
    if (confirm('¿Estás seguro de eliminar esta tarjeta?')) {
      this.financeService.deleteCard(id);
    }
  }
}
