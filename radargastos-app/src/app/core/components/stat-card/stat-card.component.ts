import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="stat-card">
      <div class="stat-card-header">
        <span class="label" [title]="label">{{ label }}</span>
        @if (icon) {
          <div class="icon-box" [ngClass]="valueClass">
            <span class="material-symbols-outlined">{{ icon }}</span>
          </div>
        }
      </div>
      <div class="value" [ngClass]="valueClass" [title]="value">{{ value }}</div>
      @if (subtext) {
        <div class="subtext">{{ subtext }}</div>
      }
    </div>
  `,
  styles: [`
    .stat-card {
      background: var(--surface, #ffffff);
      border: 1px solid var(--border, #e2e8f0);
      border-radius: 12px;
      padding: 10px 14px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02), 0 1px 2px rgba(0, 0, 0, 0.02);
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-height: 68px;
    }

    .stat-card:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.05);
    }

    .stat-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 6px;
    }

    .label {
      font-size: 10px;
      color: var(--text-muted, #64748b);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 700;
      white-space: normal;
      line-height: 1.2;
      flex: 1;
    }

    .icon-box {
      width: 24px;
      height: 24px;
      border-radius: 6px;
      background: var(--surface2, #f1f5f9);
      color: var(--text-muted, #64748b);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .icon-box .material-symbols-outlined {
      font-size: 15px;
    }

    .icon-box.danger,
    .icon-box.expense {
      background: #F1F5F9;
      color: #475569;
    }

    .icon-box.safe,
    .icon-box.income {
      background: #F0F9FF;
      color: #0284C7;
    }

    .icon-box.warn {
      background: #FEF3C7;
      color: #D97706;
    }

    .value {
      font-size: 17px;
      font-weight: 700;
      margin-top: 4px;
      font-family: 'Sora', sans-serif;
      color: var(--text, #0f172a);
      letter-spacing: -0.02em;
      white-space: normal;
      line-height: 1.2;
    }

    .value.danger,
    .value.expense {
      color: #334155;
    }

    .value.safe,
    .value.income {
      color: #0284C7;
    }

    .value.warn {
      color: #D97706;
    }

    .subtext {
      font-size: 10.5px;
      color: var(--text-muted, #64748b);
      margin-top: 3px;
    }

    @media (max-width: 600px) {
      .stat-card {
        padding: 8px 10px;
        border-radius: 10px;
        min-height: 60px;
      }

      .label {
        font-size: 10px;
        letter-spacing: 0.02em;
      }

      .icon-box {
        width: 26px;
        height: 26px;
        border-radius: 6px;
      }

      .icon-box .material-symbols-outlined {
        font-size: 15px;
      }

      .value {
        font-size: 17px;
        margin-top: 6px;
      }
    }
  `]
})
export class StatCardComponent {
  @Input() label: string = '';
  @Input() value: string = '';
  @Input() valueClass: 'danger' | 'warn' | 'safe' | 'expense' | 'income' | '' = '';
  @Input() icon?: string;
  @Input() subtext?: string;
}
