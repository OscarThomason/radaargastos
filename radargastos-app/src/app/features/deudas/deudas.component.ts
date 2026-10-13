import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { FinanceService } from '../../core/services/finance.service';
import { AiAdvisorService } from '../../core/services/ai-advisor.service';
import { Debt, Installment } from '../../core/models/finance.model';
import { ConfirmModalComponent } from '../../core/components/confirm-modal/confirm-modal.component';
import { TarjetasComponent } from '../tarjetas/tarjetas.component';

@Component({
  selector: 'app-deudas',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmModalComponent, TarjetasComponent],
  templateUrl: './deudas.component.html',
  styleUrl: './deudas.component.scss'
})
export class DeudasComponent {
  private financeService = inject(FinanceService);
  private aiAdvisor = inject(AiAdvisorService);
  private route = inject(ActivatedRoute);

  activeSection = signal<'general' | 'tarjetas' | 'prestamos'>('general');

  constructor() {
    this.route.queryParams.subscribe(params => {
      if (params['tab'] === 'tarjetas') {
        this.activeSection.set('tarjetas');
      } else if (params['tab'] === 'prestamos') {
        this.activeSection.set('prestamos');
      } else if (params['tab'] === 'general') {
        this.activeSection.set('general');
      }
    });
  }

  creditCardsCount = computed(() => this.financeService.cardsWithBalance().filter(c => c.type === 'credito').length);
  loansCount = computed(() => this.debts().filter(d => d.group === 'prestamo').length);

  debts = computed(() => this.financeService.state().debts);
  incomes = computed(() => this.financeService.state().incomes);
  expenses = computed(() => this.financeService.state().expenses);

  searchQuery = signal<string>('');
  sortBy = signal<'date' | 'name' | 'amount-desc' | 'amount-asc'>('date');

  // Análisis de Tendencia y Carga de Deudas
  debtAnalysis = computed(() => {
    return this.aiAdvisor.analyzeDebtsTrend(this.debts(), this.incomes(), this.expenses());
  });

  isAnalyzingWithN8n = signal(false);
  aiDiagnosisText = signal<string | null>(null);

  async requestDebtAiAnalysis() {
    const analysis = this.debtAnalysis();
    if (this.debts().length === 0) {
      alert('No hay deudas registradas para analizar.');
      return;
    }

    this.isAnalyzingWithN8n.set(true);

    const promptText = `
ANÁLISIS DE DEUDAS Y TENDENCIA DE PAGO:
- Total Adeudado Acumulado: $${analysis.totalDebt} MXN
- Compromiso Mensual en Cuotas: $${analysis.monthlyCommitment} MXN (${analysis.debtRatio}% de los ingresos del mes).
- Tendencia: ${analysis.trendText}
- Deuda con Mayor CAT: ${analysis.highestCatDebt ? `${analysis.highestCatDebt.name} (CAT ${analysis.highestCatDebt.cat}%)` : 'Ninguna tarjeta con CAT registrado'}.

Evalúa si los compromisos de deuda han aumentado o disminuido, y brinda una estrategia acelerada de pago (método avalancha) para liquidar primero las deudas de mayor tasa de interés.
`;

    const res = await this.aiAdvisor.queryN8nAgent({
      tipo_solicitud: 'consulta_compra',
      pregunta: promptText,
      monto: analysis.totalDebt
    });

    this.isAnalyzingWithN8n.set(false);

    if (res && res.analisis_financiero && !res.analisis_financiero.toLowerCase().includes('no hay concepto')) {
      let cleanDiagnosis = (res.analisis_financiero || '')
        .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
      let cleanAction = (res.accion_recomendada || '')
        .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

      this.aiDiagnosisText.set(cleanDiagnosis + (cleanAction ? `<br><br><strong><u>Estrategia Recomendada:</u></strong> ${cleanAction}` : ''));
    } else {
      // Diagnóstico de Respaldo Inteligente Local
      let diag = `<strong><u>Diagnóstico de Tendencia de Deudas:</u></strong><br><br>`;
      diag += `Actualmente acumulas <strong>$${analysis.totalDebt.toLocaleString('es-MX', {minimumFractionDigits:2})} MXN</strong> en compromisos de deuda. Tus cuotas mensuales requeridas ($${analysis.monthlyCommitment.toLocaleString('es-MX', {minimumFractionDigits:2})} MXN) representan el <strong>${analysis.debtRatio}%</strong> de tus ingresos.<br><br>`;
      diag += `<u>Tendencia de Pago:</u> ${analysis.trendText}<br><br>`;
      if (analysis.highestCatDebt) {
        diag += `<u>Estrategia Avalancha:</u> Prioriza abonar montos adicionales a la tarjeta/préstamo <strong>"${analysis.highestCatDebt.name}"</strong> por tener el mayor costo financiero (CAT ${analysis.highestCatDebt.cat}%). Esto te ahorrará intereses acumulados.`;
      } else {
        diag += `<u>Estrategia Recomendada:</u> Mantén la puntualidad en tus cuotas mensuales y procura realizar abonos a capital en la deuda de menor saldo para liberar liquidez rápidamente (método bola de nieve).`;
      }
      this.aiDiagnosisText.set(diag);
    }
  }

  filteredDebts = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const sort = this.sortBy();

    let list = this.debts();

    if (this.activeSection() === 'prestamos') {
      list = list.filter(d => d.group === 'prestamo');
    }

    if (q) {
      list = list.filter(d => 
        (d.name && d.name.toLowerCase().includes(q)) ||
        (d.notes && d.notes.toLowerCase().includes(q)) ||
        (d.group && d.group.toLowerCase().includes(q)) ||
        (d.frequency && d.frequency.toLowerCase().includes(q))
      );
    }

    return list.slice().sort((a, b) => {
      if (sort === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sort === 'amount-desc') {
        const amtA = a.group === 'prestamo' ? this.getNextUnpaidForDebt(a) : this.calcMinPaymentForDebt(a);
        const amtB = b.group === 'prestamo' ? this.getNextUnpaidForDebt(b) : this.calcMinPaymentForDebt(b);
        return amtB - amtA;
      }
      if (sort === 'amount-asc') {
        const amtA = a.group === 'prestamo' ? this.getNextUnpaidForDebt(a) : this.calcMinPaymentForDebt(a);
        const amtB = b.group === 'prestamo' ? this.getNextUnpaidForDebt(b) : this.calcMinPaymentForDebt(b);
        return amtA - amtB;
      }
      // default 'date'
      return (a.anchor || '').localeCompare(b.anchor || '');
    });
  });

  frequencies = ['semanal', 'quincenal', 'mensual', 'bimestral', 'anual'];

  editingId: string | null = null;
  expandedId: string | null = null;
  dGroup: 'tarjeta' | 'prestamo' = 'prestamo';
  dName = '';
  dFreq = 'mensual';
  dAnchor = new Date().toISOString().slice(0, 10);
  dNotes = '';
  isModalOpen = false;

  // -- Tarjeta de Crédito (Campos Completos) --
  dMinPayment: number | null = null;
  dNoInterest: number | null = null;
  dDebtTotal: number | null = null;
  dLimit: number | null = null;
  dCutoffDate = '';
  dInterestRate: number | null = null;
  dCatWithoutIva: number | null = null;
  dCat: number | null = null;
  dAnnualFee: number | null = null;
  dLatePaymentFee: number | null = null;
  dCreditTerm: number | null = null;
  dCardId: string | null = null;

  get dAvailableLimit(): number {
    const limit = this.dLimit || 0;
    const debt = this.dDebtTotal || 0;
    return Math.max(0, limit - debt);
  }

  consolidatedDebt = computed(() => this.financeService.totalConsolidatedDebt());

  // -- Préstamo --
  dTotal: number | null = null;
  dPagado: number | null = null;
  dCuota: number | null = null;
  dCuotasPagadas: number | null = null;
  dCuotasTotal: number | null = null;
  dUseVariableInstallments = false;
  dInstallments: Installment[] = [];

  // -- Modal de Pago --
  isPayModalOpen = false;
  payingDebt: Debt | null = null;
  payAmountType: 'minimo' | 'noInterest' | 'otro' | 'cuota' = 'minimo';
  payCustomAmount: number | null = null;
  payRegisterAsExpense = false;

  // -------- Cálculo de Pago Mínimo con CAT --------
  get calculatedMinPayment(): number {
    const debt = this.dDebtTotal || 0;
    const cat = this.dCat;
    const term = this.dCreditTerm;
    if (cat && term && debt > 0) {
      const monthlyRate = Math.pow(1 + cat / 100, 1 / 12) - 1;
      if (monthlyRate === 0) return Math.round((debt / term) * 100) / 100;
      const pmt = debt * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -term)));
      return Math.round(pmt * 100) / 100;
    }
    return this.dMinPayment || 0;
  }

  get usingCatFormula(): boolean {
    return !!(this.dCat && this.dCreditTerm && (this.dDebtTotal || 0) > 0);
  }

  // -------- Cuotas Variables --------
  get totalInstallmentsAmount(): number {
    return this.dInstallments.reduce((sum, i) => sum + (i.amount || 0), 0);
  }

  addInstallment() {
    this.dInstallments = [...this.dInstallments, { amount: 0, paid: false }];
  }

  removeInstallment(index: number) {
    this.dInstallments = this.dInstallments.filter((_, i) => i !== index);
  }

  getNextUnpaidForDebt(debt: Debt): number {
    if (!debt.useVariableInstallments || !debt.installments?.length) {
      return debt.cuota || 0;
    }
    const next = debt.installments.find(i => !i.paid);
    return next?.amount ?? 0;
  }

  getPaidCount(debt: Debt): number {
    if (!debt.installments?.length) return debt.cuotasPagadas || 0;
    return debt.installments.filter(i => i.paid).length;
  }

  getTotalCount(debt: Debt): number {
    if (!debt.installments?.length) return debt.cuotasTotal || 0;
    return debt.installments.length;
  }

  calcMinPaymentForDebt(debt: Debt): number {
    const d = debt.debt || 0;
    const cat = debt.cat;
    const term = debt.creditTerm;
    if (cat && term && d > 0) {
      const monthlyRate = Math.pow(1 + cat / 100, 1 / 12) - 1;
      if (monthlyRate === 0) return Math.round((d / term) * 100) / 100;
      const pmt = d * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -term)));
      return Math.round(pmt * 100) / 100;
    }
    return debt.minPayment || 0;
  }

  // -------- CRUD --------
  openModal(group?: 'prestamo' | 'tarjeta') {
    this.cancelEdit();
    if (group) {
      this.dGroup = group;
    } else if (this.activeSection() === 'tarjetas') {
      this.dGroup = 'tarjeta';
    } else if (this.activeSection() === 'prestamos') {
      this.dGroup = 'prestamo';
    }
    this.isModalOpen = true;
  }

  saveDebt() {
    if (!this.dName || !this.dAnchor) {
      alert('Nombre y próxima fecha de pago son obligatorios'); return;
    }

    const item: Debt = {
      id: this.editingId || 'd' + Date.now(),
      group: this.dGroup,
      name: this.dName.trim(),
      frequency: this.dFreq,
      anchor: this.dAnchor,
      notes: this.dNotes.trim()
    };

    if (this.dGroup === 'prestamo') {
      item.useVariableInstallments = this.dUseVariableInstallments;
      if (this.dUseVariableInstallments && this.dInstallments.length > 0) {
        item.installments = [...this.dInstallments];
        const next = item.installments.find(i => !i.paid);
        item.cuota = next?.amount ?? 0;
        item.cuotasTotal = item.installments.length;
        item.cuotasPagadas = item.installments.filter(i => i.paid).length;
        item.pagado = item.installments.filter(i => i.paid).reduce((s, i) => s + i.amount, 0);
        item.total = item.installments.reduce((s, i) => s + i.amount, 0);
      } else {
        item.total = this.dTotal || 0;
        item.pagado = this.dPagado || 0;
        item.cuota = this.dCuota || 0;
        item.cuotasPagadas = this.dCuotasPagadas || 0;
        item.cuotasTotal = this.dCuotasTotal || 0;
        item.installments = undefined;
      }
    } else {
      item.debt = this.dDebtTotal || 0;
      item.limit = this.dLimit || undefined;
      item.availableLimit = this.dLimit ? Math.max(0, this.dLimit - (this.dDebtTotal || 0)) : undefined;
      item.dueDate = this.dAnchor;
      item.cutoffDate = this.dCutoffDate || undefined;
      item.interestRate = this.dInterestRate || undefined;
      item.catWithoutIva = this.dCatWithoutIva || undefined;
      item.cat = this.dCat || this.dCatWithoutIva || undefined;
      item.annualFee = this.dAnnualFee || undefined;
      item.latePaymentFee = this.dLatePaymentFee || undefined;
      item.noInterest = this.dNoInterest || 0;
      item.creditTerm = this.dCreditTerm || undefined;
      item.minPayment = this.usingCatFormula ? this.calculatedMinPayment : (this.dMinPayment || 0);
      item.cardId = this.dCardId || undefined;
    }

    if (this.editingId) {
      this.financeService.updateDebt(this.editingId, item);
    } else {
      this.financeService.addDebt(item);
    }
    this.cancelEdit();
  }

  editDebt(id: string) {
    const item = this.debts().find(d => d.id === id);
    if (!item) return;
    this.editingId = item.id;
    this.dGroup = item.group;
    this.dName = item.name;
    this.dFreq = item.frequency || 'mensual';
    this.dAnchor = item.anchor || new Date().toISOString().slice(0, 10);
    this.dNotes = item.notes || '';

    if (item.group === 'prestamo') {
      this.dTotal = item.total || null;
      this.dPagado = item.pagado || null;
      this.dCuota = item.cuota || null;
      this.dCuotasPagadas = item.cuotasPagadas || null;
      this.dCuotasTotal = item.cuotasTotal || null;
      this.dUseVariableInstallments = item.useVariableInstallments || false;
      this.dInstallments = item.installments ? JSON.parse(JSON.stringify(item.installments)) : [];
      this.dMinPayment = null; this.dNoInterest = null; this.dDebtTotal = null;
      this.dLimit = null; this.dCutoffDate = ''; this.dInterestRate = null;
      this.dCatWithoutIva = null; this.dCat = null; this.dAnnualFee = null;
      this.dLatePaymentFee = null; this.dCreditTerm = null; this.dCardId = null;
    } else {
      this.dMinPayment = item.minPayment || null;
      this.dNoInterest = item.noInterest || null;
      this.dDebtTotal = item.debt || null;
      this.dLimit = item.limit || null;
      this.dCutoffDate = item.cutoffDate || '';
      this.dInterestRate = item.interestRate || null;
      this.dCatWithoutIva = item.catWithoutIva || null;
      this.dCat = item.cat || null;
      this.dAnnualFee = item.annualFee || null;
      this.dLatePaymentFee = item.latePaymentFee || null;
      this.dCreditTerm = item.creditTerm || null;
      this.dCardId = item.cardId || null;
      this.dTotal = null; this.dPagado = null; this.dCuota = null;
      this.dCuotasPagadas = null; this.dCuotasTotal = null;
      this.dUseVariableInstallments = false; this.dInstallments = [];
    }
    this.isModalOpen = true;
  }

  cancelEdit() {
    this.editingId = null;
    this.dName = '';
    this.dTotal = null; this.dPagado = null; this.dCuota = null;
    this.dCuotasPagadas = null; this.dCuotasTotal = null;
    this.dMinPayment = null; this.dNoInterest = null; this.dDebtTotal = null;
    this.dLimit = null; this.dCutoffDate = ''; this.dInterestRate = null;
    this.dCatWithoutIva = null; this.dCat = null; this.dAnnualFee = null;
    this.dLatePaymentFee = null; this.dCreditTerm = null; this.dCardId = null;
    this.dUseVariableInstallments = false; this.dInstallments = [];
    this.dFreq = 'mensual';
    this.dAnchor = new Date().toISOString().slice(0, 10);
    this.dNotes = '';
    this.isModalOpen = false;
  }

  // -- Modal de Confirmación de Eliminar --
  confirmDeleteId: string | null = null;
  confirmDeleteName = '';

  askDeleteDebt(id: string, name: string) {
    this.confirmDeleteId = id;
    this.confirmDeleteName = name;
  }

  confirmDeleteDebt() {
    if (this.confirmDeleteId) {
      this.financeService.deleteDebt(this.confirmDeleteId);
      if (this.editingId === this.confirmDeleteId) this.cancelEdit();
      this.cancelDeleteDebt();
    }
  }

  cancelDeleteDebt() {
    this.confirmDeleteId = null;
    this.confirmDeleteName = '';
  }

  // -------- LÓGICA DE PAGOS --------
  openPayModal(id: string) {
    const item = this.debts().find(d => d.id === id);
    if (!item) return;
    this.payingDebt = JSON.parse(JSON.stringify(item));
    this.payRegisterAsExpense = false;
    this.payCustomAmount = null;
    if (item.group === 'prestamo') {
      this.payAmountType = 'cuota';
      this.payCustomAmount = this.getNextUnpaidForDebt(item);
    } else {
      this.payAmountType = 'minimo';
    }
    this.isPayModalOpen = true;
  }

  cancelPay() {
    this.isPayModalOpen = false;
    this.payingDebt = null;
  }

  submitPayment() {
    if (!this.payingDebt) return;
    const debt = this.payingDebt;
    let amountPaid = 0;

    if (debt.group === 'tarjeta') {
      if (this.payAmountType === 'minimo') amountPaid = debt.minPayment || 0;
      else if (this.payAmountType === 'noInterest') amountPaid = debt.noInterest || 0;
      else amountPaid = this.payCustomAmount || 0;
      debt.debt = Math.max(0, (debt.debt || 0) - amountPaid);
      if (debt.creditTerm && debt.creditTerm > 1) debt.creditTerm--;
    } else {
      if (debt.useVariableInstallments && debt.installments?.length) {
        const idx = debt.installments.findIndex(i => !i.paid);
        if (idx !== -1) {
          debt.installments[idx].paid = true;
          amountPaid = debt.installments[idx].amount;
          debt.cuotasPagadas = (debt.cuotasPagadas || 0) + 1;
          debt.pagado = (debt.pagado || 0) + amountPaid;
          const nextIdx = debt.installments.findIndex(i => !i.paid);
          debt.cuota = nextIdx !== -1 ? debt.installments[nextIdx].amount : 0;
        }
      } else {
        amountPaid = this.payCustomAmount || debt.cuota || 0;
        debt.pagado = (debt.pagado || 0) + amountPaid;
        debt.cuotasPagadas = (debt.cuotasPagadas || 0) + 1;
      }
    }

    if (this.payRegisterAsExpense && amountPaid > 0) {
      this.financeService.addExpense({
        id: 'e' + Date.now(),
        date: new Date().toISOString().slice(0, 10),
        time: new Date().toTimeString().slice(0, 5),
        category: 'Deudas',
        description: `Pago: ${debt.name}`,
        amount: amountPaid
      });
    }

    if (debt.anchor) {
      debt.anchor = this.advanceAnchor(debt.anchor, debt.frequency || 'mensual');
    }
    this.financeService.updateDebt(debt.id, debt);
    this.cancelPay();
  }

  private advanceAnchor(dateStr: string, freq: string): string {
    const date = new Date(dateStr + 'T12:00:00');
    if (freq === 'semanal') date.setDate(date.getDate() + 7);
    else if (freq === 'quincenal') date.setDate(date.getDate() + 15);
    else if (freq === 'mensual') date.setMonth(date.getMonth() + 1);
    else if (freq === 'bimestral') date.setMonth(date.getMonth() + 2);
    else if (freq === 'anual') date.setFullYear(date.getFullYear() + 1);
    return date.toISOString().slice(0, 10);
  }

  money(amount: number) {
    return this.financeService.currency() + amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  formatDate(dateStr?: string) {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  getDaysRemaining(anchorStr?: string): string {
    if (!anchorStr) return '—';
    const anchorDate = new Date(anchorStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((anchorDate.getTime() - today.getTime()) / 86400000);
    if (diffDays < 0) return `${Math.abs(diffDays)}d vencido`;
    if (diffDays === 0) return 'Hoy';
    return `${diffDays}d`;
  }

  getDaysClass(anchorStr?: string): string {
    if (!anchorStr) return 'inherit';
    const anchorDate = new Date(anchorStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((anchorDate.getTime() - today.getTime()) / 86400000);
    if (diffDays < 0) return '#D32F2F';
    if (diffDays <= 2) return '#92400E';
    return 'inherit';
  }

  toggleExpand(id: string) {
    this.expandedId = this.expandedId === id ? null : id;
  }
}
