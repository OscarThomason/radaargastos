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
- Gastos No Esenciales / Ocio / Gustos: $${essData.nonEssentialTotal.toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN (${essData.nonEssentialPercent}% del gasto total, destinas $${analysis.ocioExp} solo a ocio/restaurantes)

DESGLOSE COMPLETO DE GASTOS POR CATEGORÍA:
${categoriesBreakdown}

INSTRUCCIÓN: Genera un dictamen ejecutivo de salud financiera global en 2 o 3 párrafos. Analiza si la proporción de gasto en ocio o no esenciales compromete el margen de ahorro o la seguridad financiera ante imprevistos, proponiendo ajustes específicos.
`;

    const res = await this.aiAdvisor.queryN8nAgent({
      tipo_solicitud: 'consulta_compra',
      pregunta: promptText,
      descripcion: `Diagnóstico Financiero Global ${this.selectedMonthLabel()}`,
      monto: analysis.totalExp
    });

    this.isAuditingWithN8n.set(false);

    // Verificar si la respuesta de n8n es útil o si devolvió el mensaje por defecto de falta de concepto
    const n8nText = res?.analisis_financiero || '';
    const isInvalidN8nText = !res || !n8nText || n8nText.toLowerCase().includes('no hay concepto') || n8nText.toLowerCase().includes('información disponible no es posible');

    if (!isInvalidN8nText && res) {
      this.globalAiDiagnosis.set(res.analisis_financiero + (res.accion_recomendada ? `\n\n📌 Recomendación Clave: ${res.accion_recomendada}` : ''));
    } else {
      // Diagnóstico Financiero Global Inteligente Avanzado de Respaldo
      this.globalAiDiagnosis.set(this.generateAdvancedLocalDiagnosis(analysis, essData, expData));
    }
  }

  private generateAdvancedLocalDiagnosis(
    analysis: { totalExp: number; totalInc: number; ocioExp: number; ratioToIncome: number; ratioOcioToIncome: number; ratioOcioToExp: number; incomeExceeded: boolean; exceededAmount: number; netBalance: number },
    essData: { essentialTotal: number; nonEssentialTotal: number; essentialPercent: number; nonEssentialPercent: number },
    expData: { labels: string[]; values: number[]; total: number }
  ): string {
    const month = this.selectedMonthLabel();
    const incStr = `$${analysis.totalInc.toLocaleString('es-MX', {minimumFractionDigits: 2})}`;
    const expStr = `$${analysis.totalExp.toLocaleString('es-MX', {minimumFractionDigits: 2})}`;
    const balStr = `$${analysis.netBalance.toLocaleString('es-MX', {minimumFractionDigits: 2})}`;
    const ocioStr = `$${analysis.ocioExp.toLocaleString('es-MX', {minimumFractionDigits: 2})}`;

    let diagnosis = `📊 **Diagnóstico Ejecutivo de Finanzas (${month}):**\n\n`;

    if (analysis.incomeExceeded) {
      diagnosis += `⚠️ **Alerta de Déficit Presupuestario:** Tus gastos en ${month} (${expStr}) superaron tus ingresos (${incStr}) por un monto de $${analysis.exceededAmount.toLocaleString('es-MX', {minimumFractionDigits: 2})}. Tus consumos alcanzaron el ${analysis.ratioToIncome}% de tus recursos disponibles.\n\n`;
    } else if (analysis.ratioToIncome >= 90) {
      diagnosis += `⚡ **Margen Financiero Ajustado:** Tus gastos consumen el **${analysis.ratioToIncome}%** de tus ingresos totales (${incStr}), dejándote con un remanente libre reducido de únicamente **${balStr}** para ahorros o eventualidades.\n\n`;
    } else {
      diagnosis += `🟢 **Salud Financiera Estable:** Mantienes tus gastos (${expStr}) dentro del límite de tus ingresos (${incStr}), conservando una liquidez disponible de **${balStr}** (${100 - analysis.ratioToIncome}% de margen libre).\n\n`;
    }

    // Análisis de Ocio y Gustos Prescindibles
    if (analysis.ocioExp > 0) {
      diagnosis += `🎮 **Impacto de Ocio y Comida Fuera:** Destinas **${ocioStr}** a conceptos prescindibles (ocio, restaurantes y ropa), lo que equivale al **${analysis.ratioOcioToIncome}%** de tus ingresos de este mes (${analysis.ratioOcioToExp}% de tu gasto total). `;
      
      if (analysis.ratioToIncome >= 85 && analysis.ocioExp > analysis.netBalance) {
        const ahorroSugerido = Math.round(analysis.ocioExp * 0.35);
        diagnosis += `Debido a que tu margen libre actual es de solo ${balStr}, tus consumos en ocio absorben casi la totalidad de tu capacidad de ahorro. Si optimizas un 35% de esta categoría, recuperarías **$${ahorroSugerido.toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN** adicionales de liquidez mensual.\n\n`;
      } else {
        diagnosis += `Este nivel de consumo se encuentra en un rango de equilibrio respecto a tus ingresos.\n\n`;
      }
    }

    // Análisis por Categorías Principales
    if (expData.labels.length > 0) {
      const topCatIndex = expData.values.indexOf(Math.max(...expData.values));
      const topCatName = expData.labels[topCatIndex];
      const topCatAmount = expData.values[topCatIndex];
      const topCatPct = Math.round((topCatAmount / expData.total) * 100);

      diagnosis += `💡 **Concentración Principal:** La categoría con mayor impacto este mes es **${topCatName}** con $${topCatAmount.toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN (${topCatPct}% del presupuesto total).\n\n`;
    }

    // Recomendación Final
    diagnosis += `📌 **Recomendación Estratégica:** Prioriza cubrir tus compromisos esenciales (${essData.essentialPercent}% del presupuesto) y establece un tope mensual para consumos en ocio equivalente al 15% de tus ingresos para consolidar tu fondo de emergencia.`;

    return diagnosis;
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
