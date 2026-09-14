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
      pregunta: `¿Me conviene comprar ${this.itemQuestion.trim()} por un monto de $${this.itemAmount || 0} MXN?`,
      descripcion: this.itemQuestion.trim(),
      monto: this.itemAmount || 0,
      notas: extraContext
    });

    this.isThinking.set(false);

    if (response && response.analisis_financiero && !response.analisis_financiero.toLowerCase().includes('no hay concepto') && response.veredicto_consejero !== 'Gasto Realizado') {
      this.lastResponse.set(response);
    } else {
      // Evaluador Inteligente de Respaldo Pre-Compra
      const concept = this.itemQuestion.trim();
      const amount = this.itemAmount || 0;
      const isLowAmount = amount <= 500;
      const hasGoodBalance = saldo > amount * 2;

      let verdict: 'Recomendado' | 'Posponer' | 'Evitar' = 'Posponer';
      let analysis = '';
      let action = '';

      if (hasGoodBalance && (isLowAmount || /hallowen|fiesta|decoracion|ropa|cine|comida|regalo/i.test(concept))) {
        verdict = 'Recomendado';
        analysis = `La compra de "${concept}" por $${amount.toLocaleString('es-MX', {minimumFractionDigits:2})} MXN es un gasto de ocio/gusto personal. Tu saldo disponible ($${saldo.toLocaleString('es-MX', {minimumFractionDigits:2})}) absorbe fácilmente este consumo.`;
        action = 'Puedes realizar la compra con tranquilidad siempre que sea en 1 solo pago de contado.';
      } else if (saldo < amount) {
        verdict = 'Evitar';
        analysis = `El monto de "${concept}" ($${amount.toLocaleString('es-MX', {minimumFractionDigits:2})} MXN) supera tu saldo disponible actual ($${saldo.toLocaleString('es-MX', {minimumFractionDigits:2})}). Adquirirlo ahora pondría tus finanzas en déficit.`;
        action = 'Se sugiere posponer la compra hasta acumular el fondo necesario sin recurrir a deuda.';
      } else {
        verdict = 'Posponer';
        analysis = `La compra de "${concept}" por $${amount.toLocaleString('es-MX', {minimumFractionDigits:2})} MXN representa un compromiso importante sobre tu saldo libre ($${saldo.toLocaleString('es-MX', {minimumFractionDigits:2})}).`;
        action = 'Aplica la regla de las 48 horas: si en dos días sigues considerándolo esencial, realiza la compra.';
      }

      this.lastResponse.set({
        tipo_solicitud: 'consulta_compra',
        categoria: 'Consulta Pre-Compra',
        veredicto_consejero: verdict,
        analisis_financiero: analysis,
        accion_recomendada: action
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
