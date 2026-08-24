import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UpcomingItem } from '../../models/finance.model';
import { FinanceService } from '../../services/finance.service';

@Component({
  selector: 'app-countdown-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './countdown-card.component.html',
  styleUrl: './countdown-card.component.scss'
})
export class CountdownCardComponent {
  @Input() item!: UpcomingItem;
  @Output() markPaid = new EventEmitter<{id: string, kind: string}>();
  private financeService = inject(FinanceService);

  get statusClass() {
    if (this.item.days < 0) return 'status-danger';
    if (this.item.days <= 2) return 'status-warn';
    return 'status-safe';
  }

  get absDays() {
    return Math.abs(this.item.days);
  }

  get dayUnitLabel() {
    if (this.item.days < 0) return 'días vencido';
    if (this.item.days === 0) return 'HOY';
    if (this.item.days === 1) return 'día';
    return 'días';
  }

  get formattedDate() {
    return this.item.due.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  }

  get kindBadgeClass() {
    if (this.item.kind === 'prestamo') return 'accent-pill-purple';
    if (this.item.kind === 'tarjeta') return 'accent-pill-sky';
    return 'accent-pill-blue';
  }

  money(amount: number) {
    return this.financeService.currency() + amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
