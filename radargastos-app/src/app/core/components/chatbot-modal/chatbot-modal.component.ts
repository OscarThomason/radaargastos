import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiAdvisorService } from '../../services/ai-advisor.service';
import { FinanceService } from '../../services/finance.service';
import { N8nAgentResponse } from '../../models/finance.model';

@Component({
  selector: 'app-chatbot-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot-modal.component.html',
  styleUrl: './chatbot-modal.component.scss'
})
export class ChatbotModalComponent {
  private aiAdvisor = inject(AiAdvisorService);
  private financeService = inject(FinanceService);

  isOpen = signal(false);
  isThinking = signal(false);

  itemQuestion = '';
  itemAmount: number | null = null;
  itemNotes = '';

  lastResponse = signal<N8nAgentResponse | null>(null);

  toggleOpen() {
    this.isOpen.update(v => !v);
  }

  close() {
    this.isOpen.set(false);
  }

  quickAsk(concept: string, amount: number) {
    this.itemQuestion = concept;
    this.itemAmount = amount;
    this.sendConsultation();
  }

  async sendConsultation() {
    if (!this.itemQuestion.trim()) return;

    this.isThinking.set(true);
    this.lastResponse.set(null);

    const totalInc = this.financeService.state().incomes.reduce((acc, curr) => acc + curr.amount, 0);
    const totalExp = this.financeService.state().expenses.reduce((acc, curr) => acc + curr.amount, 0);
    const saldo = totalInc - totalExp;

    const extraContext = `Ingresos del mes: $${totalInc}, Gastos acumulados: $${totalExp}, Saldo disponible actual: $${saldo}. ${this.itemNotes}`.trim();

    const response = await this.aiAdvisor.queryN8nAgent({
      tipo_solicitud: 'consulta_compra',
      pregunta: this.itemQuestion.trim(),
      monto: this.itemAmount || 0,
      notas: extraContext
    });

    this.isThinking.set(false);

    if (response) {
      this.lastResponse.set(response);
    } else {
      this.lastResponse.set({
        tipo_solicitud: 'consulta_compra',
        veredicto_consejero: 'Posponer',
        analisis_financiero: 'No se pudo conectar con el agente n8n en este momento, pero te aconsejamos aplicar la regla de las 24-48 horas antes de realizar la compra.',
        accion_recomendada: 'Reflexiona si este artículo satisface una necesidad esencial o un impulso temporal.'
      });
    }
  }

  resetForm() {
    this.itemQuestion = '';
    this.itemAmount = null;
    this.itemNotes = '';
    this.lastResponse.set(null);
  }

  money(amount?: number) {
    if (!amount) return '$0.00';
    return '$' + amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
