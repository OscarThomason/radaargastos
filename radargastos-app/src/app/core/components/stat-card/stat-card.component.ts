import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="stat-card">
      <div class="label">{{ label }}</div>
      <div class="value" [ngClass]="valueClass">{{ value }}</div>
    </div>
  `,
  styles: [`
    .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; }
    .label { font-size: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .value { font-size: 22px; font-weight: 700; margin-top: 6px; font-family: 'Inter', sans-serif; }
    .danger { color: var(--danger); }
    .warn { color: var(--warn); }
    .safe { color: var(--safe); }
  `]
})
export class StatCardComponent {
  @Input() label: string = '';
  @Input() value: string = '';
  @Input() valueClass: 'danger' | 'warn' | 'safe' | '' = '';
}
