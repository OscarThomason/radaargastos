import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, computed, inject, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, DoughnutController, ArcElement, Tooltip, Legend, BarController, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { FinanceService } from '../../core/services/finance.service';
import { AiAdvisorService } from '../../core/services/ai-advisor.service';

Chart.register(DoughnutController, ArcElement, Tooltip, Legend, BarController, CategoryScale, LinearScale, BarElement);

@Component({
  selector: 'app-estadisticas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './estadisticas.component.html',
  styleUrl: './estadisticas.component.scss'
})
export class EstadisticasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('chartExpCat') chartExpCatRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartIncCat') chartIncCatRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartMonth') chartMonthRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartEssential') chartEssentialRef!: ElementRef<HTMLCanvasElement>;
  
  private financeService = inject(FinanceService);
  private aiAdvisor = inject(AiAdvisorService);

  private chartExpCatInstance: Chart | null = null;
  private chartIncCatInstance: Chart | null = null;
  private chartMonthInstance: Chart | null = null;
  private chartEssentialInstance: Chart | null = null;

  // Paleta sobria y minimalista: Grises / Grafito para Gastos, Azules profesionales para Ingresos
  paletteExp = ['#0F172A', '#1E293B', '#334155', '#475569', '#64748B', '#94A3B8', '#CBD5E1', '#374151', '#4B5563', '#6B7280'];
  paletteInc = ['#0284C7', '#0369A1', '#075985', '#0EA5E9', '#38BDF8', '#2563EB', '#1D4ED8', '#60A5FA'];
  
  selectedMonthKey = signal<string>(new Date().toISOString().slice(0, 7));
  showHistorical = signal<boolean>(false);
  isAuditingWithN8n = signal<boolean>(false);
  globalAiDiagnosis = signal<string | null>(null);

  toggleHistorical() {
    const nextState = !this.showHistorical();
    this.showHistorical.set(nextState);
    if (nextState) {
      setTimeout(() => this.renderMonthChart(), 60);
    } else {
      if (this.chartMonthInstance) {
        this.chartMonthInstance.destroy();
        this.chartMonthInstance = null;
      }
    }
  }

  availableMonths = computed(() => {
    const monthsSet = new Set<string>();
    const now = new Date();
    const curMonthKey = now.toISOString().slice(0, 7);
    monthsSet.add(curMonthKey);

    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthKey = lastMonth.toISOString().slice(0, 7);
    monthsSet.add(lastMonthKey);

    this.financeService.state().expenses.forEach(e => {
      if (e.date) monthsSet.add(e.date.slice(0, 7));
    });
    this.financeService.state().incomes.forEach(i => {
      if (i.date) monthsSet.add(i.date.slice(0, 7));
    });

    return Array.from(monthsSet)
      .sort((a, b) => b.localeCompare(a))
      .map(k => {
        const [y, m] = k.split('-');
        const dateObj = new Date(parseInt(y), parseInt(m) - 1, 1);
        const label = dateObj.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
        const capitalizedLabel = label.charAt(0).toUpperCase() + label.slice(1);
        return { key: k, label: capitalizedLabel };
      });
  });

  selectedMonthLabel = computed(() => {
    const key = this.selectedMonthKey();
    const [y, m] = key.split('-');
    const dateObj = new Date(parseInt(y), parseInt(m) - 1, 1);
    const label = dateObj.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  });

  onMonthChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.selectedMonthKey.set(select.value);
    this.globalAiDiagnosis.set(null);
  }

  expCatData = computed(() => {
    const monthKey = this.selectedMonthKey();
    const catTotals: Record<string, number> = {};
    
    this.financeService.state().expenses
      .filter(e => e.date.slice(0, 7) === monthKey)
      .forEach(e => {
        catTotals[e.category] = (catTotals[e.category] || 0) + e.amount;
      });
      
    const labels = Object.keys(catTotals);
    const values = Object.values(catTotals);
    const total = values.reduce((a, b) => a + b, 0);
    
    return { labels, values, total };
  });

  incCatData = computed(() => {
    const monthKey = this.selectedMonthKey();
    const catTotals: Record<string, number> = {};
    
    this.financeService.state().incomes
      .filter(i => i.date.slice(0, 7) === monthKey)
      .forEach(i => {
        const cat = i.category || 'Otros';
        catTotals[cat] = (catTotals[cat] || 0) + i.amount;
      });
      
    const labels = Object.keys(catTotals);
    const values = Object.values(catTotals);
    const total = values.reduce((a, b) => a + b, 0);
    
    return { labels, values, total };
  });

  monthExpenses = computed(() => {
    const monthKey = this.selectedMonthKey();
    return this.financeService.state().expenses.filter(e => e.date.slice(0, 7) === monthKey);
  });

  monthIncomes = computed(() => {
    const monthKey = this.selectedMonthKey();
    return this.financeService.state().incomes.filter(i => i.date.slice(0, 7) === monthKey);
  });

  essentialAnalysis = computed(() => {
    return this.aiAdvisor.analyzeEssentialVsNonEssential(this.monthExpenses());
  });

  recurrentExpenses = computed(() => {
    const monthKey = this.selectedMonthKey();
    const recurrentList = this.financeService.state().expenses
      .filter(e => e.date.slice(0, 7) === monthKey && (e.category === 'Servicios' || e.category === 'Deudas'));
    const total = recurrentList.reduce((acc, curr) => acc + curr.amount, 0);
    return { list: recurrentList, total };
  });

  variableExpenses = computed(() => {
    const monthKey = this.selectedMonthKey();
    const total = this.financeService.state().expenses
      .filter(e => e.date.slice(0, 7) === monthKey && e.category !== 'Servicios' && e.category !== 'Deudas')
      .reduce((acc, curr) => acc + curr.amount, 0);
    return total;
  });

  recurrentPercentage = computed(() => {
    const rec = this.recurrentExpenses().total;
    const variable = this.variableExpenses();
    const total = rec + variable;
    if (total === 0) return 0;
    return Math.round((rec / total) * 100);
  });

  dailyAverage = computed(() => {
    const total = this.expCatData().total;
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return Math.round(total / daysInMonth);
  });

  savingsRate = computed(() => {
    const inc = this.incCatData().total;
    const exp = this.expCatData().total;
    if (inc === 0) return 0;
    const rem = inc - exp;
    return Math.max(0, Math.round((rem / inc) * 100));
  });

  globalMonthAnalysis = computed(() => {
    const monthKey = this.selectedMonthKey();
    const expensesList = this.financeService.state().expenses
      .filter(e => e.date.slice(0, 7) === monthKey);

    const totalExp = expensesList.reduce((sum, e) => sum + e.amount, 0);
    const incomesList = this.financeService.state().incomes
      .filter(i => i.date.slice(0, 7) === monthKey);
    const totalInc = incomesList.reduce((sum, i) => sum + i.amount, 0);

    const ocioExp = expensesList
      .filter(e => e.category === 'Oscio' || e.category === 'Restaurantes' || e.category === 'ropa o accesorios')
      .reduce((sum, e) => sum + e.amount, 0);

    const ratioToIncome = totalInc > 0 ? Math.round((totalExp / totalInc) * 100) : 0;
    const ratioOcioToIncome = totalInc > 0 ? Math.round((ocioExp / totalInc) * 100) : 0;
    const ratioOcioToExp = totalExp > 0 ? Math.round((ocioExp / totalExp) * 100) : 0;

    const incomeExceeded = totalInc > 0 && totalExp > totalInc;

    return {
      totalExp,
      totalInc,
      ocioExp,
      ratioToIncome,
      ratioOcioToIncome,
      ratioOcioToExp,
      incomeExceeded,
      exceededAmount: Math.max(0, totalExp - totalInc),
      netBalance: totalInc - totalExp
    };
  });

  rule503020 = computed(() => {
    const analysis = this.globalMonthAnalysis();
    const ess = this.essentialAnalysis();
    const totalInc = analysis.totalInc;
    const base = totalInc > 0 ? totalInc : analysis.totalExp;
    if (base === 0) return { essentialPct: 0, nonEssentialPct: 0, savingsPct: 0 };
    
    const essentialPct = Math.round((ess.essentialTotal / base) * 100);
    const nonEssentialPct = Math.round((ess.nonEssentialTotal / base) * 100);
    const savingsPct = totalInc > 0 ? Math.max(0, Math.round((analysis.netBalance / totalInc) * 100)) : 0;
    
    return {
      essentialPct,
      nonEssentialPct,
      savingsPct
    };
  });

  topExpenseCategory = computed(() => {
    const data = this.expCatData();
    if (data.labels.length === 0) return null;
    const maxVal = Math.max(...data.values);
    const maxIdx = data.values.indexOf(maxVal);
    return {
      name: data.labels[maxIdx],
      amount: data.values[maxIdx],
      percent: Math.round((data.values[maxIdx] / (data.total || 1)) * 100)
    };
  });

  potentialSavings = computed(() => {
    const ess = this.essentialAnalysis();
    const monthly = Math.round(ess.nonEssentialTotal * 0.3);
    const annual = monthly * 12;
    return { monthly, annual };
  });

  monthData = computed(() => {
    const expTotals: Record<string, number> = {};
    const incTotals: Record<string, number> = {};
    const keysSet = new Set<string>();

    this.financeService.state().expenses.forEach(e => {
      const k = e.date.slice(0, 7);
      expTotals[k] = (expTotals[k] || 0) + e.amount;
      keysSet.add(k);
    });
    
    this.financeService.state().incomes.forEach(i => {
      const k = i.date.slice(0, 7);
      incTotals[k] = (incTotals[k] || 0) + i.amount;
      keysSet.add(k);
    });
    
    const keys = Array.from(keysSet).sort().slice(-6);
    const labels = keys.map(k => {
      const [y, m] = k.split('-');
      return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('es-MX', { month: 'short', year: '2-digit' });
    });
    const expValues = keys.map(k => expTotals[k] || 0);
    const incValues = keys.map(k => incTotals[k] || 0);
    
    return { keys, labels, expValues, incValues };
  });

  constructor() {
    effect(() => {
      this.expCatData();
      this.incCatData();
      this.essentialAnalysis();
      setTimeout(() => {
        this.renderCharts();
        if (this.showHistorical()) {
          this.renderMonthChart();
        }
      }, 0);
    });
  }

  ngAfterViewInit() {
    this.renderCharts();
  }

  ngOnDestroy() {
    if (this.chartExpCatInstance) this.chartExpCatInstance.destroy();
    if (this.chartIncCatInstance) this.chartIncCatInstance.destroy();
    if (this.chartMonthInstance) this.chartMonthInstance.destroy();
    if (this.chartEssentialInstance) this.chartEssentialInstance.destroy();
  }

  renderCharts() {
    // 1. Gráfico Esenciales vs No Esenciales (Azul y Gris)
    const ess = this.essentialAnalysis();
    if (this.chartEssentialInstance) this.chartEssentialInstance.destroy();
    if ((ess.essentialTotal > 0 || ess.nonEssentialTotal > 0) && this.chartEssentialRef) {
      this.chartEssentialInstance = new Chart(this.chartEssentialRef.nativeElement, {
        type: 'doughnut',
        data: {
          labels: ['Gastos Esenciales', 'Gastos No Esenciales'],
          datasets: [{
            data: [ess.essentialTotal, ess.nonEssentialTotal],
            backgroundColor: ['#0284C7', '#64748B'], // Azul profesional & Gris pizarra
            borderWidth: 2,
            borderColor: '#ffffff',
            borderRadius: 6,
            spacing: 3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '68%',
          plugins: { legend: { display: false } }
        }
      });
    }

    // 2. Gráfico Gastos por Categoría (Escala de Grises Sobrios)
    const exp = this.expCatData();
    if (this.chartExpCatInstance) this.chartExpCatInstance.destroy();
    if (exp.labels.length > 0 && this.chartExpCatRef) {
      this.chartExpCatInstance = new Chart(this.chartExpCatRef.nativeElement, {
        type: 'doughnut',
        data: {
          labels: exp.labels,
          datasets: [{
            data: exp.values,
            backgroundColor: this.paletteExp,
            borderWidth: 2,
            borderColor: '#ffffff',
            borderRadius: 6,
            spacing: 3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '66%',
          plugins: { legend: { display: false } }
        }
      });
    }

    // 3. Gráfico Ingresos por Categoría (Escala de Azules)
    const inc = this.incCatData();
    if (this.chartIncCatInstance) this.chartIncCatInstance.destroy();
    if (inc.labels.length > 0 && this.chartIncCatRef) {
      this.chartIncCatInstance = new Chart(this.chartIncCatRef.nativeElement, {
        type: 'doughnut',
        data: {
          labels: inc.labels,
          datasets: [{
            data: inc.values,
            backgroundColor: this.paletteInc,
            borderWidth: 2,
            borderColor: '#ffffff',
            borderRadius: 6,
            spacing: 3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '66%',
          plugins: { legend: { display: false } }
        }
      });
    }
  }

  renderMonthChart() {
    const month = this.monthData();
    if (this.chartMonthInstance) this.chartMonthInstance.destroy();
    if (month.keys.length > 0 && this.chartMonthRef) {
      this.chartMonthInstance = new Chart(this.chartMonthRef.nativeElement, {
        type: 'bar',
        data: { 
          labels: month.labels, 
          datasets: [
            { label: 'Ingresos', data: month.incValues, backgroundColor: '#0284C7', borderRadius: 6, borderSkipped: false }, // Azul
            { label: 'Gastos', data: month.expValues, backgroundColor: '#64748B', borderRadius: 6, borderSkipped: false }     // Gris
          ] 
        },
        options: { 
          responsive: true, 
          maintainAspectRatio: false,
          plugins: { 
            legend: { 
              display: true, 
              labels: { 
                color: '#334155', 
                font: { family: "'Sora', sans-serif", size: 12, weight: 'bold' },
                boxWidth: 12,
                boxHeight: 12,
                borderRadius: 3
              } 
            } 
          },
          scales: { 
            y: { 
              beginAtZero: true, 
              grid: { color: 'rgba(0,0,0,0.04)' }, 
              ticks: { color: '#64748B', font: { family: "'Sora', sans-serif", size: 11 } } 
            }, 
            x: { 
              grid: { display: false }, 
              ticks: { color: '#64748B', font: { family: "'Sora', sans-serif", size: 11, weight: 'bold' } } 
            } 
          }
        }
      });
    }
  }

  getLegendItems(type: 'exp' | 'inc') {
    const data = type === 'exp' ? this.expCatData() : this.incCatData();
    const palette = type === 'exp' ? this.paletteExp : this.paletteInc;
    return data.labels.map((label, i) => ({
      label,
      color: palette[i % palette.length],
      percent: Math.round(data.values[i] / (data.total || 1) * 100)
    }));
  }

  abs(val: number): number {
    return Math.abs(val);
  }

  max(a: number, b: number): number {
    return Math.max(a, b);
  }

  money(amount: number) {

    return this.financeService.currency() + amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  async requestGlobalAiAudit() {
    const analysis = this.globalMonthAnalysis();
    if (analysis.totalExp === 0 && analysis.totalInc === 0) {
      alert('No hay movimientos registrados en este mes para generar un análisis.');
      return;
    }

    this.isAuditingWithN8n.set(true);

    const expData = this.expCatData();
    const essData = this.essentialAnalysis();
    const categoriesBreakdown = expData.labels
      .map((label, idx) => `- ${label}: $${expData.values[idx].toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN (${Math.round((expData.values[idx]/expData.total)*100)}% del gasto)`)
      .join('\n');

    const promptText = `
EVALUACIÓN Y DIAGNÓSTICO FINANCIERO GLOBAL DEL MES (${this.selectedMonthLabel()}):
- Ingreso Total: $${analysis.totalInc.toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN
- Gasto Total Acumulado: $${analysis.totalExp.toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN (${analysis.ratioToIncome}% de tus ingresos)
- Saldo / Margen Libre: $${analysis.netBalance.toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN
- Gastos Esenciales: $${essData.essentialTotal.toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN (${essData.essentialPercent}% del gasto total)
- Gastos No Esenciales / Ocio / Gustos: $${essData.nonEssentialTotal.toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN (${essData.nonEssentialPercent}% del gasto total, destinas $${analysis.ocioExp} a ocio/restaurantes)

DESGLOSE COMPLETO DE GASTOS POR CATEGORÍA:
${categoriesBreakdown}

INSTRUCCIÓN: Genera un informe financiero ejecutivo en formato continuo, sin listas repetitivas, analizando si la proporción de gasto compromete la solvencia y proponiendo optimizaciones cuantificables.
`;

    const res = await this.aiAdvisor.queryInteractiveFinancialAgent({
      message: promptText,
      estadisticas_financieras: {
        mes: this.selectedMonthLabel(),
        ingresos: analysis.totalInc,
        gastos: analysis.totalExp,
        balance_libre: analysis.netBalance,
        esenciales: essData.essentialTotal,
        no_esenciales: essData.nonEssentialTotal,
        ocio: analysis.ocioExp
      }
    });

    this.isAuditingWithN8n.set(false);

    if (res && res.reply) {
      const cleanReply = res.reply
        .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>');
      this.globalAiDiagnosis.set(cleanReply);
    } else {
      this.globalAiDiagnosis.set(this.generateAdvancedLocalDiagnosis());
    }
  }

  generateAdvancedLocalDiagnosis(): string {
    const analysis = this.globalMonthAnalysis();
    const essData = this.essentialAnalysis();
    const expData = this.expCatData();
    const month = this.selectedMonthLabel();
    const rule = this.rule503020();
    const topCat = this.topExpenseCategory();
    const potential = this.potentialSavings();

    const incStr = this.money(analysis.totalInc);
    const expStr = this.money(analysis.totalExp);
    const balStr = this.money(Math.abs(analysis.netBalance));
    const ocioStr = this.money(analysis.ocioExp);

    let html = `<div class="editorial-analysis-content">`;

    // 1. Evaluación de Balance y Liquidez
    html += `<div class="analysis-section">
      <h4 class="analysis-section-title">1. Balance Operativo y Solvencia</h4>
      <p class="analysis-paragraph">`;
    if (analysis.incomeExceeded) {
      html += `Durante <strong>${month}</strong> se registra un <strong>déficit presupuestario de ${this.money(analysis.exceededAmount)}</strong>. Los compromisos totales absorbieron el <strong>${analysis.ratioToIncome}%</strong> de los ingresos disponibles (${incStr}), lo que implica que se recurrió a ahorros previos o financiamiento con deuda para solventar la diferencia.`;
    } else if (analysis.ratioToIncome >= 90) {
      html += `Tus finanzas operan con un <strong>margen de maniobra sumamente ajustado</strong>. Los egresos consumieron el <strong>${analysis.ratioToIncome}%</strong> de tus ingresos (${incStr}), preservando únicamente un remanente libre de <strong>${balStr}</strong>.`;
    } else {
      html += `Mantienes una posición de <strong>solvencia y superávit saludable</strong>. Tus gastos consumieron el <strong>${analysis.ratioToIncome}%</strong> de tus ingresos, consolidando un margen neto de liquidez de <strong>${balStr}</strong> disponible para fondos de inversión o metas patrimoniales.`;
    }
    html += `</p></div>`;

    // 2. Desglose Estructural (Regla 50/30/20)
    html += `<div class="analysis-section">
      <h4 class="analysis-section-title">2. Distribución Presupuestaria (Metodología 50/30/20)</h4>
      <p class="analysis-paragraph">
        Tus gastos de primera necesidad (vivienda, alimentación, servicios, transporte y deudas primarias) representan el <strong>${rule.essentialPct}%</strong> (${this.money(essData.essentialTotal)}). 
        Por su parte, los desembolsos discrecionales en estilo de vida y ocio absorben el <strong>${rule.nonEssentialPct}%</strong> (${this.money(essData.nonEssentialTotal)}). 
        ${rule.savingsPct > 0 ? `Tu capacidad efectiva de ahorro se sitúa en un <strong>${rule.savingsPct}%</strong> del ingreso.` : `Actualmente no existe margen efectivo para conformar ahorro este mes.`}
      </p>
    </div>`;

    // 3. Fuga de Capital y Concentración
    if (topCat) {
      html += `<div class="analysis-section">
        <h4 class="analysis-section-title">3. Concentración de Egresos y Fugas</h4>
        <p class="analysis-paragraph">
          La partida con mayor peso financiero este periodo es <strong>${topCat.name}</strong>, acumulando <strong>${this.money(topCat.amount)}</strong> (${topCat.percent}% del gasto total). 
          ${analysis.ocioExp > 0 ? `Asimismo, el rubro de ocio y comidas fuera representó <strong>${ocioStr}</strong> (${analysis.ratioOcioToIncome}% del ingreso total).` : ''}
        </p>
      </div>`;
    }

    // 4. Estrategia de Optimización Cuantificable
    html += `<div class="analysis-section">
      <h4 class="analysis-section-title">4. Plan de Acción y Ahorro Proyectado</h4>
      <p class="analysis-paragraph">
        Si moderas un 30% los consumos no prioritarios durante las próximas semanas, recuperarías <strong>${this.money(potential.monthly)} MXN mensuales</strong>, lo que equivale a una capitalización anual proyectada de <strong>${this.money(potential.annual)} MXN</strong> para tu fondo de respaldo ante emergencias.
      </p>
    </div>`;

    html += `</div>`;
    return html;
  }
}
