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
    return this.next30().reduce((acc, item) => acc + item.amount, 0);
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
        category: 'Deudas',
        description: `Pago: ${debt.name}`,
        amount: amountPaid
      });
    }

    if (debt.group === 'servicio') {
      this.financeService.markPaid(debt.id, 'servicio');
      // markPaid ya avanza el anchor y genera el gasto (si no estuviera controlado por nosotros).
      // Pero como queremos controlar el expense nosotros con `payRegisterAsExpense`...
      // Vamos a delegar la actualización a financeService pero saltarnos su expense autogenerado.
      // Modificaremos financeService o simplemente lo usamos y reemplazamos el expense si diff.
      // Mejor actualizar el servicio directamente:
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
}
