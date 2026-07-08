import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, computed, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, DoughnutController, ArcElement, Tooltip, Legend, BarController, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { FinanceService } from '../../core/services/finance.service';

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
  
  private financeService = inject(FinanceService);
  private chartExpCatInstance: Chart | null = null;
  private chartIncCatInstance: Chart | null = null;
  private chartMonthInstance: Chart | null = null;

  paletteExp = ['#2a78d6','#1baf7a','#eda100','#008300','#9085e9','#e34948','#e87ba4','#eb6834','#7C9CF5','#F0A93A'];
  paletteInc = ['#35D0A8', '#1baf7a', '#7C9CF5', '#008300'];
  
  expCatData = computed(() => {
    const now = new Date();
    const curMonthKey = now.toISOString().slice(0, 7);
    const catTotals: Record<string, number> = {};
    
    this.financeService.state().expenses
      .filter(e => e.date.slice(0, 7) === curMonthKey)
      .forEach(e => {
        catTotals[e.category] = (catTotals[e.category] || 0) + e.amount;
      });
      
    const labels = Object.keys(catTotals);
    const values = Object.values(catTotals);
    const total = values.reduce((a, b) => a + b, 0);
    
    return { labels, values, total };
  });

  incCatData = computed(() => {
    const now = new Date();
    const curMonthKey = now.toISOString().slice(0, 7);
    const catTotals: Record<string, number> = {};
    
    this.financeService.state().incomes
      .filter(i => i.date.slice(0, 7) === curMonthKey)
      .forEach(i => {
        const cat = i.category || 'Otros';
        catTotals[cat] = (catTotals[cat] || 0) + i.amount;
      });
      
    const labels = Object.keys(catTotals);
    const values = Object.values(catTotals);
    const total = values.reduce((a, b) => a + b, 0);
    
    return { labels, values, total };
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
      this.monthData();
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
  }

  renderCharts() {
    const exp = this.expCatData();
    if (this.chartExpCatInstance) this.chartExpCatInstance.destroy();
    if (exp.labels.length > 0 && this.chartExpCatRef) {
      this.chartExpCatInstance = new Chart(this.chartExpCatRef.nativeElement, {
        type: 'doughnut',
        data: { labels: exp.labels, datasets: [{ data: exp.values, backgroundColor: this.paletteExp }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
      });
    }

    const inc = this.incCatData();
    if (this.chartIncCatInstance) this.chartIncCatInstance.destroy();
    if (inc.labels.length > 0 && this.chartIncCatRef) {
      this.chartIncCatInstance = new Chart(this.chartIncCatRef.nativeElement, {
        type: 'doughnut',
        data: { labels: inc.labels, datasets: [{ data: inc.values, backgroundColor: this.paletteInc }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
      });
    }

    const month = this.monthData();
    if (this.chartMonthInstance) this.chartMonthInstance.destroy();
    if (month.keys.length > 0 && this.chartMonthRef) {
      this.chartMonthInstance = new Chart(this.chartMonthRef.nativeElement, {
        type: 'bar',
        data: { 
          labels: month.labels, 
          datasets: [
            { label: 'Ingresos', data: month.incValues, backgroundColor: '#35D0A8', borderRadius: 4 },
            { label: 'Gastos', data: month.expValues, backgroundColor: '#e34948', borderRadius: 4 }
          ] 
        },
        options: { 
          responsive: true, 
          maintainAspectRatio: false,
          plugins: { legend: { display: true, labels: { color: '#8FA0AF' } } },
          scales: { 
            y: { beginAtZero: true, grid: { color: '#2A3744' }, ticks: { color: '#8FA0AF' } }, 
            x: { grid: { display: false }, ticks: { color: '#8FA0AF' } } 
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
}
