import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FinanceService } from '../../core/services/finance.service';
import { ServiceItem } from '../../core/models/finance.model';
import { ConfirmModalComponent } from '../../core/components/confirm-modal/confirm-modal.component';

@Component({
  selector: 'app-servicios',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmModalComponent],
  templateUrl: './servicios.component.html',
  styleUrl: './servicios.component.scss'
})
export class ServiciosComponent {
  private financeService = inject(FinanceService);

  services = computed(() => this.financeService.state().services);
  
  editingId: string | null = null;
  expandedId: string | null = null;
  
  svName = '';
  svAmount: number | null = null;
  svFreq = 'mensual';
  svAnchor = new Date().toISOString().slice(0, 10);
  svNotes = '';
  isModalOpen = false;

  frequencies = ['semanal', 'quincenal', 'mensual', 'bimestral', 'anual'];

  toggleExpand(id: string) {
    this.expandedId = this.expandedId === id ? null : id;
  }

  openModal() {
    this.cancelEdit();
    this.isModalOpen = true;
  }

  saveService() {
    if (!this.svName || this.svAmount === null || !this.svAnchor) {
      alert('Completa nombre, costo y fecha de pago'); return;
    }
    
    const item: ServiceItem = {
      id: this.editingId || 's' + Date.now(),
      name: this.svName.trim(),
      amount: this.svAmount,
      frequency: this.svFreq,
      anchor: this.svAnchor,
      notes: this.svNotes.trim()
    };

    if (this.editingId) {
      this.financeService.updateService(this.editingId, item);
    } else {
      this.financeService.addService(item);
    }
    
    this.cancelEdit();
  }

  editService(id: string) {
    const item = this.services().find(s => s.id === id);
    if (!item) return;
    
    this.editingId = item.id;
    this.svName = item.name;
    this.svAmount = item.amount;
    this.svFreq = item.frequency || 'mensual';
    this.svAnchor = item.anchor || new Date().toISOString().slice(0, 10);
    this.svNotes = item.notes || '';
    this.isModalOpen = true;
  }

  cancelEdit() {
    this.editingId = null;
    this.svName = '';
    this.svAmount = null;
    this.svFreq = 'mensual';
    this.svAnchor = new Date().toISOString().slice(0, 10);
    this.svNotes = '';
    this.isModalOpen = false;
  }

  // -- Modal de Confirmación de Eliminar --
  confirmDeleteId: string | null = null;
  confirmDeleteName = '';

  askDeleteService(id: string, name: string) {
    this.confirmDeleteId = id;
    this.confirmDeleteName = name;
  }

  confirmDeleteService() {
    if (this.confirmDeleteId) {
      this.financeService.deleteService(this.confirmDeleteId);
      if (this.editingId === this.confirmDeleteId) this.cancelEdit();
      this.cancelDeleteService();
    }
  }

  cancelDeleteService() {
    this.confirmDeleteId = null;
    this.confirmDeleteName = '';
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
}
