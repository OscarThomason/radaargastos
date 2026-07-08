import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UpcomingItem } from '../../models/finance.model';

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

  get statusClass() {
    if (this.item.days <= 3) return 'status-danger';
    if (this.item.days <= 7) return 'status-warn';
    return 'status-safe';
  }

  get statusColorVar() {
    if (this.item.days <= 3) return 'var(--danger)';
    if (this.item.days <= 7) return 'var(--warn)';
    return 'var(--safe)';
  }

  get dayLabel() {
    if (this.item.days < 0) return `${Math.abs(this.item.days)}d vencido`;
    if (this.item.days === 0) return 'Hoy';
    return `${this.item.days}d`;
  }

  get formattedDate() {
    return this.item.due.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  }

  money(amount: number) {
    return '$' + amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
