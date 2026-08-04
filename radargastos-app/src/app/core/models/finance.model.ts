export interface Installment {
  amount: number;
  paid: boolean;
}

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
  // Tarjeta de Crédito
  cat?: number;         // CAT anual en %
  creditTerm?: number;  // meses de plazo restante para cálculo de pago mínimo
  // Préstamo
  cuota?: number;
  cuotasPagadas?: number;
  cuotasTotal?: number;
  total?: number;
  pagado?: number;
  useVariableInstallments?: boolean;        // activar cuotas de monto variable
  installments?: Installment[];             // lista de cuotas con su monto y estado
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
  time?: string; // formato "HH:MM" (opcional)
  category: string;
  description: string;
  amount: number;
  paymentMethod?: string; // id de tarjeta o 'efectivo'
}

export interface Income {
  id: string;
  date: string;
  time?: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod?: string; // id de tarjeta o 'efectivo'
}

export interface Card {
  id: string;
  name: string;
  type: 'credito' | 'debito';
  limit?: number;
  balance: number; // deuda actual (crédito) o dinero disponible (débito)
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
  cards?: Card[];
  history?: HistoryLog[];
  timeFormat?: '12h' | '24h';
}

export interface HistoryLog {
  id: string;
  timestamp: string;
  timeMs?: number;
  action: string;
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

export interface AiInsight {
  id: string;
  type: 'warning' | 'opportunity' | 'success' | 'tip';
  title: string;
  description: string;
  impactAmount?: number;
  icon: string;
}

export interface EssentialCategoryGroup {
  name: string;
  amount: number;
  percent: number;
}

export interface EssentialAnalysis {
  essentialTotal: number;
  nonEssentialTotal: number;
  essentialPercent: number;
  nonEssentialPercent: number;
  essentialCategories: EssentialCategoryGroup[];
  nonEssentialCategories: EssentialCategoryGroup[];
}
