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
  anchor?: string; // Próxima fecha de pago / fecha límite de pago
  // Tarjeta de Crédito (campos avanzados)
  limit?: number;           // Línea de crédito total
  availableLimit?: number;  // Límite disponible
  dueDate?: string;         // Fecha límite de pago
  cutoffDate?: string;      // Fecha de corte
  interestRate?: number;    // Tasa de interés anual (%)
  catWithoutIva?: number;   // CAT sin IVA (%)
  cat?: number;             // CAT anual en %
  annualFee?: number;       // Comisión de Anualidad ($)
  latePaymentFee?: number;  // Comisión de Pago Tardío ($)
  creditTerm?: number;      // Meses de plazo restante para cálculo de pago mínimo
  cardId?: string;          // Vínculo con registro en cards
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

export interface N8nAgentResponse {
  tipo_solicitud?: 'analisis_gasto' | 'consulta_compra';
  categoria?: string;
  subcategoria_sugerida?: string;
  es_evitable?: boolean | null;
  nivel_necesidad?: 'Esencial' | 'Opcional' | 'Impulso' | 'Inversión';
  veredicto_consejero?: 'Recomendado' | 'Posponer' | 'Evitar' | 'Gasto Realizado';
  analisis_financiero?: string;
  accion_recomendada?: string;
  datos_sanitizados?: boolean;
}

export interface Expense {
  id: string;
  date: string;
  time?: string; // formato "HH:MM" (opcional)
  category: string;
  description: string;
  amount: number;
  paymentMethod?: string; // id de tarjeta o 'efectivo'
  fundingSource?: 'propios' | 'prestamo'; // Método de financiamiento: 'propios' (por defecto) o 'prestamo'
  // Campos de Inteligencia IA FinOps (n8n)
  esEvitable?: boolean | null;
  nivelNecesidad?: 'Esencial' | 'Opcional' | 'Impulso' | 'Inversión';
  veredictoConsejero?: string;
  analisisFinanciero?: string;
  accionRecomendada?: string;
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
  balance: number; // deuda actual/inicial (crédito) o dinero disponible (débito)
  // Campos avanzados para Tarjetas de Crédito
  limit?: number;           // Línea de crédito total
  debt?: number;            // Deuda actual utilizada
  availableLimit?: number;  // Límite disponible (línea - deuda)
  dueDate?: string;         // Fecha límite de pago
  cutoffDate?: string;      // Fecha o día de corte
  interestRate?: number;    // Tasa de interés anual (%)
  catWithoutIva?: number;   // CAT sin IVA (%)
  cat?: number;             // CAT anual (%)
  annualFee?: number;       // Comisión de Anualidad ($)
  latePaymentFee?: number;  // Comisión de Pago Tardío / cobranza ($)
  noInterest?: number | null;// Pago para no generar intereses ($)
  minPayment?: number;      // Pago mínimo ($)
  creditTerm?: number;      // Plazo en meses
  notes?: string;
  linkedDebtId?: string;    // Vínculo con registro en debts
  computedBalance?: number; // Saldo computado en tiempo real con gastos/pagos
  computedDebt?: number;    // Deuda computada en tiempo real
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
  currency?: string;
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
