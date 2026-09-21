import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FinanceService } from '../../core/services/finance.service';
import { Location } from '@angular/common';

@Component({
  selector: 'app-ajustes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ajustes.component.html',
  styleUrl: './ajustes.component.scss'
})
export class AjustesComponent {
  private financeService = inject(FinanceService);
  private location = inject(Location);

  // Load current categories
  expenseCats = signal<string[]>([...this.financeService.expenseCategories()]);
  incomeCats = signal<string[]>([...this.financeService.incomeCategories()]);
  timeFormat = signal<'12h' | '24h'>(this.financeService.timeFormat());
  currency = signal<string>(this.financeService.currency());

  // Load history (máximo 60 registros)
  history = computed(() => (this.financeService.state().history || []).slice(0, 60));

  newExCat = '';
  newInCat = '';

  addExpenseCat() {
    const val = this.newExCat.trim();
    if (val && !this.expenseCats().includes(val)) {
      this.expenseCats.update(c => [...c, val]);
    }
    this.newExCat = '';
  }

  removeExpenseCat(cat: string) {
    this.expenseCats.update(c => c.filter(x => x !== cat));
  }

  addIncomeCat() {
    const val = this.newInCat.trim();
    if (val && !this.incomeCats().includes(val)) {
      this.incomeCats.update(c => [...c, val]);
    }
    this.newInCat = '';
  }

  removeIncomeCat(cat: string) {
    this.incomeCats.update(c => c.filter(x => x !== cat));
  }

  setTimeFormat(fmt: '12h' | '24h') {
    this.timeFormat.set(fmt);
  }

  setCurrency(curr: string) {
    this.currency.set(curr);
  }

  save() {
    this.financeService.updateExpenseCategories(this.expenseCats());
    this.financeService.updateIncomeCategories(this.incomeCats());
    this.financeService.updateTimeFormat(this.timeFormat());
    this.financeService.updateCurrency(this.currency());
    this.location.back();
  }

  formatTimestamp(ts: string): string {
    if (!ts) return '';
    const parts = ts.split(' ');
    if (parts.length < 2) return ts;
    const formattedTime = this.financeService.formatTime(parts[1]);
    return `${parts[0]} ${formattedTime}`;
  }

  // Estado de uso de memoria
  storageInfo = computed(() => this.financeService.getStorageUsage());
  backupSuccessMessage = signal<string | null>(null);
  backupErrorMessage = signal<string | null>(null);

  exportJsonBackup() {
    this.financeService.exportBackupJson();
    this.backupSuccessMessage.set('Copia de seguridad descargada correctamente.');
    setTimeout(() => this.backupSuccessMessage.set(null), 4000);
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    this.backupSuccessMessage.set(null);
    this.backupErrorMessage.set(null);

    const ok = await this.financeService.importBackupJson(file);
    if (ok) {
      this.backupSuccessMessage.set(`¡Copia de seguridad "${file.name}" restaurada con éxito! Todos tus registros han sido recuperados.`);
    } else {
      this.backupErrorMessage.set('No se pudo procesar el archivo seleccionado. Asegúrate de que sea un archivo JSON de respaldo válido.');
    }
    input.value = '';
  }

  optimizeMemory() {
    this.financeService.optimizeStorage();
    this.backupSuccessMessage.set('Memoria optimizada. Se han comprimido los registros obsoletos manteniendo todos tus datos intactos.');
    setTimeout(() => this.backupSuccessMessage.set(null), 4000);
  }

  async resetProfileToEmpty() {
    if (confirm('⚠️ ¿Estás seguro de restablecer toda tu bitácora? Esto borrará tus gastos, ingresos, deudas y servicios actuales para dejar el perfil completamente en blanco.')) {
      await this.financeService.resetToEmptyState();
      this.backupSuccessMessage.set('Perfil restablecido con éxito. Toda la bitácora ahora está en blanco.');
      setTimeout(() => this.backupSuccessMessage.set(null), 4000);
    }
  }

  exportExcel() {
    this.financeService.exportDataToExcel();
  }

  goBack() {
    this.location.back();
  }
}
