import { Component, inject, signal } from '@angular/core';
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

  save() {
    this.financeService.updateExpenseCategories(this.expenseCats());
    this.financeService.updateIncomeCategories(this.incomeCats());
    this.location.back();
  }

  goBack() {
    this.location.back();
  }
}
