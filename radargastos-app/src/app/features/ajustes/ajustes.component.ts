import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FinanceService } from '../../core/services/finance.service';
import { Location } from '@angular/common';

@Component({
  selector: 'app-ajustes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ajustes.component.html',
  styleUrl: './ajustes.component.scss'
})
export class AjustesComponent {
  private financeService = inject(FinanceService);
  private location = inject(Location);

  // Load current categories
  expenseCats = signal<string[]>([...this.financeService.expenseCategories()]);
  incomeCats = signal<string[]>([...this.financeService.incomeCategories()]);
  timeFormat = signal<'12h' | '24h'>(this.financeService.timeFormat());

  // Load history (máximo 60 registros)
  history = computed(() => (this.financeService.state().history || []).slice(0, 60));

  newExCat = '';
  newInCat = '';

  addExpenseCat() {
    const val = this.newExCat.trim();
    if (val && !this.expenseCats().includes(val)) {
      this.expenseCats.update(c => [...c, val]);
    }
    this.newExCat = '';
  }

  removeExpenseCat(cat: string) {
    this.expenseCats.update(c => c.filter(x => x !== cat));
  }

  addIncomeCat() {
    const val = this.newInCat.trim();
    if (val && !this.incomeCats().includes(val)) {
      this.incomeCats.update(c => [...c, val]);
    }
    this.newInCat = '';
  }

  removeIncomeCat(cat: string) {
    this.incomeCats.update(c => c.filter(x => x !== cat));
  }

  setTimeFormat(fmt: '12h' | '24h') {
    this.timeFormat.set(fmt);
  }

  save() {
    this.financeService.updateExpenseCategories(this.expenseCats());
    this.financeService.updateIncomeCategories(this.incomeCats());
    this.financeService.updateTimeFormat(this.timeFormat());
    this.location.back();
  }

  formatTimestamp(ts: string): string {
    if (!ts) return '';
    const parts = ts.split(' ');
    if (parts.length < 2) return ts;
    const formattedTime = this.financeService.formatTime(parts[1]);
    return `${parts[0]} ${formattedTime}`;
  }

  exportExcel() {
    this.financeService.exportDataToExcel();
  }

  goBack() {
    this.location.back();
  }
}
