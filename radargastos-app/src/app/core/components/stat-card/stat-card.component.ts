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
      border-radius: 14px;
      padding: 16px 18px;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.03), 0 1px 3px rgba(0, 0, 0, 0.02);
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .stat-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 22px rgba(0, 0, 0, 0.06);
    }

    .stat-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 6px;
    }

    .label {
      font-size: 11px;
      color: var(--text-muted, #64748b);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
    }

    .icon-box {
      width: 30px;
      height: 30px;
      border-radius: 8px;
      background: var(--surface2, #f1f5f9);
      color: var(--text-muted, #64748b);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .icon-box .material-symbols-outlined {
      font-size: 18px;
    }

    .icon-box.danger {
      background: #FEE2E2;
      color: #DC2626;
    }

    .icon-box.safe {
      background: #D1FAE5;
      color: #059669;
    }

    .icon-box.warn {
      background: #FEF3C7;
      color: #D97706;
    }

    .value {
      font-size: 22px;
      font-weight: 800;
      margin-top: 8px;
      font-family: 'Sora', sans-serif;
      color: var(--text, #0f172a);
      letter-spacing: -0.02em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .value.danger {
      color: #DC2626;
    }

    .value.safe {
      color: #059669;
    }

    .value.warn {
      color: #D97706;
    }

    .subtext {
      font-size: 11px;
      color: var(--text-muted, #64748b);
      margin-top: 4px;
    }

    @media (max-width: 600px) {
      .stat-card {
        padding: 12px 14px;
        border-radius: 12px;
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
  @Input() valueClass: 'danger' | 'warn' | 'safe' | '' = '';
  @Input() icon?: string;
  @Input() subtext?: string;
}
