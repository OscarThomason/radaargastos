import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FinanceService } from '../../core/services/finance.service';
import { Debt } from '../../core/models/finance.model';

@Component({
  selector: 'app-deudas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './deudas.component.html',
  styleUrl: './deudas.component.scss'
})
export class DeudasComponent {
  private financeService = inject(FinanceService);

  debts = computed(() => this.financeService.state().debts);
  
  frequencies = ['semanal', 'quincenal', 'mensual', 'bimestral', 'anual'];
  
  editingId: string | null = null;
  dGroup: 'tarjeta' | 'prestamo' = 'prestamo';
  dName = '';
  dTotal: number | null = null;
  dPagado: number | null = null;
  dCuota: number | null = null;
  dMinPayment: number | null = null;
  dNoInterest: number | null = null;
  dDebtTotal: number | null = null;
  dCuotasPagadas: number | null = null;
  dCuotasTotal: number | null = null;
  dFreq = 'mensual';
  dAnchor = new Date().toISOString().slice(0, 10);
  dNotes = '';
  isModalOpen = false;

  openModal() {
    this.cancelEdit();
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
      item.total = this.dTotal || 0;
      item.pagado = this.dPagado || 0;
      item.cuota = this.dCuota || 0;
      item.cuotasPagadas = this.dCuotasPagadas || 0;
      item.cuotasTotal = this.dCuotasTotal || 0;
    } else {
      item.minPayment = this.dMinPayment || 0;
      item.noInterest = this.dNoInterest || 0;
      item.debt = this.dDebtTotal || 0;
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
      this.dMinPayment = null;
      this.dNoInterest = null;
      this.dDebtTotal = null;
    } else {
      this.dMinPayment = item.minPayment || null;
      this.dNoInterest = item.noInterest || null;
      this.dDebtTotal = item.debt || null;
      this.dTotal = null;
      this.dPagado = null;
      this.dCuota = null;
      this.dCuotasPagadas = null;
      this.dCuotasTotal = null;
    }
    
    this.isModalOpen = true;
  }

  cancelEdit() {
    this.editingId = null;
    this.dName = '';
    this.dTotal = null;
    this.dPagado = null;
    this.dCuota = null;
    this.dCuotasPagadas = null;
    this.dCuotasTotal = null;
    this.dMinPayment = null;
    this.dNoInterest = null;
    this.dDebtTotal = null;
    this.dFreq = 'mensual';
    this.dAnchor = new Date().toISOString().slice(0, 10);
    this.dNotes = '';
    this.isModalOpen = false;
  }

  deleteDebt(id: string) {
    if (confirm('¿Eliminar deuda?')) {
      this.financeService.deleteDebt(id);
      if (this.editingId === id) this.cancelEdit();
    }
  }

  money(amount: number) {
    return '$' + amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
    const diffTime = anchorDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return `${Math.abs(diffDays)}d vencido`;
    if (diffDays === 0) return 'Hoy';
    return `${diffDays}d`;
  }
}
