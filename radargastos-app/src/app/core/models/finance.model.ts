export interface Debt {
  id: string;
  group: 'tarjeta' | 'prestamo';
  name: string;
  dueDay?: number;
  interval?: number;
  minPayment?: number;
  noInterest?: number | null;
  debt?: number;
  notes: string;
  frequency?: string;
  anchor?: string;
  cuota?: number;
  cuotasPagadas?: number;
  cuotasTotal?: number;
  total?: number;
  pagado?: number;
}

export interface ServiceItem {
  id: string;
  name: string;
  amount: number;
  dueDay?: number;
  interval?: number;
  frequency?: string;
  anchor?: string;
  notes: string;
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
}

export interface Income {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
}

export interface WeeklyBudget {
  id: string;
  name: string;
  min: number;
  max: number;
}

export interface AppState {
  debts: Debt[];
  services: ServiceItem[];
  expenses: Expense[];
  incomes: Income[];
  weeklyBudgets: WeeklyBudget[];
  customExpenseCategories?: string[];
  customIncomeCategories?: string[];
}

export interface UpcomingItem {
  id: string;
  kind: string;
  name: string;
  amount: number;
  due: Date;
  days: number;
  noInterest?: number | null;
}
