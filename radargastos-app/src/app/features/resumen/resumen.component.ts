import { Component, computed, inject } from '@angular/core';
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
  
  next30 = computed(() => this.upcomingItems().filter(i => i.days <= 30));
  vencidos = computed(() => this.upcomingItems().filter(i => i.days < 0).length);

  totalMin = computed(() => {
    return this.financeService.state().debts.reduce((acc, d) => acc + (d.group === 'prestamo' ? (d.cuota || 0) : (d.minPayment || 0)), 0);
  });

  totalServ = computed(() => {
    return this.financeService.state().services.reduce((acc, s) => acc + s.amount, 0);
  });

  totalDeudaViva = computed(() => {
    return this.financeService.state().debts.reduce((acc, d) => {
      const debtAmount = d.group === 'prestamo' ? (d.total || 0) : (d.debt || 0);
      const paid = d.group === 'prestamo' ? (d.pagado || 0) : 0;
      return acc + (debtAmount - paid);
    }, 0);
  });

  money(amount: number) {
    return '$' + amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // --- Modal de Pagos Inteligente ---
  isPayModalOpen = false;
  payingDebt: any = null; // Usamos any para simplificar importación de Debt
  payAmountType: 'minimo' | 'noInterest' | 'otro' | 'cuota' = 'minimo';
  payCustomAmount: number | null = null;
  payRegisterAsExpense = false;

  onMarkPaid(event: {id: string, kind: string}) {
    if (event.kind === 'tarjeta' || event.kind === 'prestamo') {
      const item = this.financeService.state().debts.find(d => d.id === event.id);
      if (!item) return;
      this.payingDebt = JSON.parse(JSON.stringify(item));
      this.payRegisterAsExpense = false;
      this.payCustomAmount = null;
      
      if (item.group === 'prestamo') {
        this.payAmountType = 'cuota';
        this.payCustomAmount = item.cuota || 0;
      } else {
        this.payAmountType = 'minimo';
      }
      this.isPayModalOpen = true;
    } else {
      // Para servicios, se paga automáticamente sin modal extra
      this.financeService.markPaid(event.id, event.kind);
    }
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
    } else {
      amountPaid = this.payCustomAmount || debt.cuota || 0;
      debt.pagado = (debt.pagado || 0) + amountPaid;
      debt.cuotasPagadas = (debt.cuotasPagadas || 0) + 1;
    }

    if (this.payRegisterAsExpense && amountPaid > 0) {
      const today = new Date().toISOString().slice(0, 10);
      this.financeService.addExpense({
        id: 'e' + Date.now(),
        date: today,
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
}
