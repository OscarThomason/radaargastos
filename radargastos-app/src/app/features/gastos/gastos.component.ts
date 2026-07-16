import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FinanceService } from '../../core/services/finance.service';
import { Expense, Income } from '../../core/models/finance.model';
import { StatCardComponent } from '../../core/components/stat-card/stat-card.component';

@Component({
  selector: 'app-gastos',
  standalone: true,
  imports: [CommonModule, FormsModule, StatCardComponent],
  templateUrl: './gastos.component.html',
  styleUrl: './gastos.component.scss'
})
export class GastosComponent {
  private financeService = inject(FinanceService);

  categories = this.financeService.expenseCategories;
  incomeCategories = this.financeService.incomeCategories;
  
  allExpenses = computed(() => this.financeService.state().expenses);
  allIncomes = computed(() => this.financeService.state().incomes);
  cards = computed(() => this.financeService.state().cards || []);

  selectedMonth = signal<string>(new Date().toISOString().slice(0, 7));
  showTotals = signal(true);

  toggleTotals() {
    this.showTotals.set(!this.showTotals());
  }

  availableMonths = computed(() => {
    const months = new Set<string>();
    this.allExpenses().forEach(e => months.add(e.date.slice(0, 7)));
    this.allIncomes().forEach(i => months.add(i.date.slice(0, 7)));
    months.add(new Date().toISOString().slice(0, 7)); 
    return Array.from(months).sort().reverse(); 
  });

  expenses = computed(() => {
    return this.allExpenses()
      .filter(e => e.date.slice(0, 7) === this.selectedMonth())
      .sort((a, b) => b.date.localeCompare(a.date));
  });

  incomes = computed(() => {
    return this.allIncomes()
      .filter(i => i.date.slice(0, 7) === this.selectedMonth())
      .sort((a, b) => b.date.localeCompare(a.date));
  });

  totalIncomes = computed(() => this.incomes().reduce((acc, curr) => acc + curr.amount, 0));
  totalExpenses = computed(() => this.expenses().reduce((acc, curr) => acc + curr.amount, 0));
  balance = computed(() => this.totalIncomes() - this.totalExpenses());

  exDate = new Date().toISOString().slice(0, 10);
  exCat = this.categories()[0];
  exDesc = '';
  exAmount: number | null = null;
  exPaymentMethod = 'efectivo';
  editingExId: string | null = null;

  inDate = new Date().toISOString().slice(0, 10);
  inCat = this.incomeCategories()[0];
  inDesc = '';
  inAmount: number | null = null;
  inPaymentMethod = 'efectivo';
  editingInId: string | null = null;

  editExpense(item: Expense) {
    this.editingExId = item.id;
    this.exDate = item.date;
    this.exCat = item.category;
    this.exDesc = item.description;
    this.exAmount = item.amount;
    this.exPaymentMethod = item.paymentMethod || 'efectivo';
  }

  editIncome(item: Income) {
    this.editingInId = item.id;
    this.inDate = item.date;
    this.inCat = item.category;
    this.inDesc = item.description;
    this.inAmount = item.amount;
    this.inPaymentMethod = item.paymentMethod || 'efectivo';
  }

  addExpense() {
    if (!this.exDate || this.exAmount === null) {
      alert('Completa fecha y monto'); return;
    }
    
    const item: Expense = {
      id: this.editingExId || 'e' + Date.now(),
      date: this.exDate,
      category: this.exCat,
      description: this.exDesc.trim(),
      amount: this.exAmount,
      paymentMethod: this.exPaymentMethod
    };

    if (this.editingExId) {
      this.financeService.updateExpense(this.editingExId, item);
      this.editingExId = null;
    } else {
      this.financeService.addExpense(item);
    }
    
    this.exDesc = '';
    this.exAmount = null;
  }

  cancelExEdit() {
    this.editingExId = null;
    this.exDate = new Date().toISOString().slice(0, 10);
    this.exDesc = '';
    this.exAmount = null;
    this.exPaymentMethod = 'efectivo';
  }

  deleteExpense(id: string) {
    this.financeService.deleteExpense(id);
  }

  addIncome() {
    if (!this.inDate || this.inAmount === null) {
      alert('Completa fecha y monto del ingreso'); return;
    }
    
    const item: Income = {
      id: this.editingInId || 'i' + Date.now(),
      date: this.inDate,
      category: this.inCat,
      description: this.inDesc.trim(),
      amount: this.inAmount,
      paymentMethod: this.inPaymentMethod
    };

    if (this.editingInId) {
      this.financeService.updateIncome(this.editingInId, item);
      this.editingInId = null;
    } else {
      this.financeService.addIncome(item);
    }
    
    this.inDesc = '';
    this.inAmount = null;
  }

  cancelInEdit() {
    this.editingInId = null;
    this.inDate = new Date().toISOString().slice(0, 10);
    this.inDesc = '';
    this.inAmount = null;
    this.inPaymentMethod = 'efectivo';
  }

  deleteIncome(id: string) {
    this.financeService.deleteIncome(id);
  }

  onMonthChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.selectedMonth.set(select.value);
  }

  formatMonth(monthKey: string) {
    const [y, m] = monthKey.split('-');
    const d = new Date(parseInt(y), parseInt(m) - 1, 1);
    const text = d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  money(amount: number) {
    return '$' + amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  getCardName(id?: string) {
    if (!id || id === 'efectivo') return 'Efectivo';
    const c = this.cards().find(x => x.id === id);
    return c ? c.name : 'Efectivo';
  }
}
