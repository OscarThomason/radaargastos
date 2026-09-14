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

  paletteExp = ['#2a78d6','#1baf7a','#eda100','#008300','#9085e9','#e34948','#e87ba4','#eb6834','#7C9CF5','#F0A93A'];
  paletteInc = ['#35D0A8', '#1baf7a', '#7C9CF5', '#008300'];
  
  selectedMonthKey = signal<string>(new Date().toISOString().slice(0, 7));
  activeInsightIndex = signal<number>(0);

  nextInsight() {
    const total = this.aiInsights().length;
    if (total > 0) {
      this.activeInsightIndex.update(i => (i + 1) % total);
    }
  }

  prevInsight() {
    const total = this.aiInsights().length;
    if (total > 0) {
      this.activeInsightIndex.update(i => (i - 1 + total) % total);
    }
  }

  setInsightIndex(idx: number) {
    this.activeInsightIndex.set(idx);
  }

  availableMonths = computed(() => {
    const monthsSet = new Set<string>();
    
    // Asegurar mes actual y anterior
    const now = new Date();
    const curMonthKey = now.toISOString().slice(0, 7);
    monthsSet.add(curMonthKey);

    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthKey = lastMonth.toISOString().slice(0, 7);
    monthsSet.add(lastMonthKey);

    // Agregar meses de transacciones
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

  onMonthChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.selectedMonthKey.set(select.value);
    this.activeInsightIndex.set(0);
  }

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

  aiInsights = computed(() => {
    const debts = this.financeService.state().debts;
    return this.aiAdvisor.generateInsights(this.monthExpenses(), this.monthIncomes(), debts, this.selectedMonthLabel());
  });

  isAuditingWithN8n = signal(false);
  globalAiDiagnosis = signal<string | null>(null);

  globalMonthAnalysis = computed(() => {
    const monthKey = this.selectedMonthKey();
    const expensesList = this.financeService.state().expenses
      .filter(e => e.date.slice(0, 7) === monthKey);

    const totalExp = expensesList.reduce((sum, e) => sum + e.amount, 0);
    const incomesList = this.financeService.state().incomes
      .filter(i => i.date.slice(0, 7) === monthKey);
    const totalInc = incomesList.reduce((sum, i) => sum + i.amount, 0);

    // Ocio y Comida fuera
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
      exceededAmount: totalExp - totalInc,
      netBalance: totalInc - totalExp
    };
  });

  async requestGlobalAiAudit() {
    const analysis = this.globalMonthAnalysis();
    if (analysis.totalExp === 0 && analysis.totalInc === 0) {
      alert('No hay movimientos registrados en este mes para generar un análisis.');
      return;
    }

    this.isAuditingWithN8n.set(true);

    const promptText = `
ANÁLISIS FINANCIERO GLOBAL DEL MES (${this.selectedMonthLabel()}):
- Ingreso Total del Mes: $${analysis.totalInc} MXN
- Gasto Total del Mes: $${analysis.totalExp} MXN
- Gasto en Ocio, Restaurantes y Gustos: $${analysis.ocioExp} MXN (${analysis.ratioOcioToIncome}% del ingreso total, ${analysis.ratioOcioToExp}% del gasto total).
- Balance Resultante: $${analysis.netBalance} MXN.

Evalúa cómo influye la proporción de presupuesto destinada a Ocio/Restaurantes sobre la salud financiera general y el saldo libre del usuario. Brinda un diagnóstico ejecutivo global en 2-3 párrafos con recomendaciones concretas de rebalanceo presupuestal.
`;

    const res = await this.aiAdvisor.queryN8nAgent({
      tipo_solicitud: 'consulta_compra',
      pregunta: promptText,
      monto: analysis.totalExp
    });

    this.isAuditingWithN8n.set(false);

    if (res && res.analisis_financiero) {
      this.globalAiDiagnosis.set(res.analisis_financiero + (res.accion_recomendada ? `\n\n📌 Recomendación: ${res.accion_recomendada}` : ''));
    } else {
      // Diagnóstico inteligente generado localmente si n8n no responde
      let localDiag = `En el periodo ${this.selectedMonthLabel()}, tus gastos totales ($${analysis.totalExp.toLocaleString('es-MX', {minimumFractionDigits: 2})}) representan el ${analysis.ratioToIncome}% de tus ingresos totales ($${analysis.totalInc.toLocaleString('es-MX', {minimumFractionDigits: 2})}). `;
      if (analysis.ocioExp > 0) {
        localDiag += `De ese total, destinas $${analysis.ocioExp.toLocaleString('es-MX', {minimumFractionDigits: 2})} a Ocio, Comida Fuera y Gustos (${analysis.ratioOcioToIncome}% de tus ingresos). `;
        if (analysis.ratioOcioToIncome > 20) {
          localDiag += `Tener una proporción de ocio superior al 20% limita tu capacidad de ahorro y amortiguamiento ante imprevistos. Te recomendamos fijar un tope mensual del 15% para ocio.`;
        } else {
          localDiag += `Tu nivel de gasto en ocio se mantiene en un rango saludable (debajo del 20% de tus ingresos).`;
        }
      }
      this.globalAiDiagnosis.set(localDiag);
    }
  }

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

  constructor() {
    effect(() => {
      this.expCatData();
      this.incCatData();
      this.monthData();
      this.essentialAnalysis();
      setTimeout(() => this.renderCharts(), 0);
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
    // 1. Gráfico de Esenciales vs No Esenciales 3D
    const ess = this.essentialAnalysis();
    if (this.chartEssentialInstance) this.chartEssentialInstance.destroy();
    if ((ess.essentialTotal > 0 || ess.nonEssentialTotal > 0) && this.chartEssentialRef) {
      this.chartEssentialInstance = new Chart(this.chartEssentialRef.nativeElement, {
        type: 'doughnut',
        data: {
          labels: ['Gastos Esenciales', 'Gastos No Esenciales'],
          datasets: [{
            data: [ess.essentialTotal, ess.nonEssentialTotal],
            backgroundColor: ['#059669', '#DC2626'],
            borderWidth: 3,
            borderColor: '#ffffff',
            borderRadius: 8,
            spacing: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '64%',
          plugins: { legend: { display: false } }
        }
      });
    }

    // 2. Gráfico Gastos por Categoría 3D
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
            borderWidth: 3,
            borderColor: '#ffffff',
            borderRadius: 6,
            spacing: 3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '62%',
          plugins: { legend: { display: false } }
        }
      });
    }

    // 3. Gráfico Ingresos por Categoría 3D
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
            borderWidth: 3,
            borderColor: '#ffffff',
            borderRadius: 6,
            spacing: 3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '62%',
          plugins: { legend: { display: false } }
        }
      });
    }

    // 4. Gráfico Histórico 6 Meses 3D
    const month = this.monthData();
    if (this.chartMonthInstance) this.chartMonthInstance.destroy();
    if (month.keys.length > 0 && this.chartMonthRef) {
      this.chartMonthInstance = new Chart(this.chartMonthRef.nativeElement, {
        type: 'bar',
        data: { 
          labels: month.labels, 
          datasets: [
            { label: 'Ingresos', data: month.incValues, backgroundColor: '#059669', borderRadius: 8, borderSkipped: false },
            { label: 'Gastos', data: month.expValues, backgroundColor: '#DC2626', borderRadius: 8, borderSkipped: false }
          ] 
        },
        options: { 
          responsive: true, 
          maintainAspectRatio: false,
          plugins: { legend: { display: true, labels: { color: 'var(--text)', font: { weight: 'bold' } } } },
          scales: { 
            y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { color: 'var(--text-muted)' } }, 
            x: { grid: { display: false }, ticks: { color: 'var(--text-muted)' } } 
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
      percent: Math.round(data.values[i] / data.total * 100)
    }));
  }

  money(amount: number) {
    return this.financeService.currency() + amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
