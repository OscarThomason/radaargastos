import { Component, computed, inject } from '@angular/core';
import { FinanceService } from '../../core/services/finance.service';
import { CommonModule } from '@angular/common';
import { StatCardComponent } from '../../core/components/stat-card/stat-card.component';
import { CountdownCardComponent } from '../../core/components/countdown-card/countdown-card.component';

@Component({
  selector: 'app-resumen',
  standalone: true,
  imports: [CommonModule, StatCardComponent, CountdownCardComponent],
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

  onMarkPaid(event: {id: string, kind: string}) {
    this.financeService.markPaid(event.id, event.kind);
  }
}
