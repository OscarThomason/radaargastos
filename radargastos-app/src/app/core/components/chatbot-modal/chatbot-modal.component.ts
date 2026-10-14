import { Component, ElementRef, ViewChild, inject, signal, effect, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiAdvisorService } from '../../services/ai-advisor.service';
import { FinanceService } from '../../services/finance.service';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  dataPoints?: { label: string; value: string }[];
}

@Component({
  selector: 'app-chatbot-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot-modal.component.html',
  styleUrl: './chatbot-modal.component.scss'
})
export class ChatbotModalComponent implements AfterViewChecked {
  private aiAdvisor = inject(AiAdvisorService);
  private financeService = inject(FinanceService);

  @ViewChild('messagesContainer') private messagesContainer!: ElementRef<HTMLDivElement>;

  isOpen = signal<boolean>(false);
  isThinking = signal<boolean>(false);
  userPrompt = '';

  messages = signal<ChatMessage[]>([]);

  // Píldoras de sugerencias rápidas
  quickSuggestions = [
    '¿Cuál es mi saldo libre disponible?',
    '¿Qué pagos tengo esta semana?',
    '¿Cómo van mis tarjetas de crédito?',
    '¿Puedo gastar $1,500 hoy?',
    'Resumen de mis deudas y préstamos',
    '¿En qué he gastado más este mes?'
  ];

  private shouldScrollToBottom = false;

  constructor() {
    this.initWelcomeMessage();
  }

  ngAfterViewChecked() {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  private scrollToBottom(): void {
    try {
      if (this.messagesContainer?.nativeElement) {
        this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
      }
    } catch {}
  }

  initWelcomeMessage() {
    const welcome: ChatMessage = {
      id: 'welcome_' + Date.now(),
      sender: 'bot',
      text: '¡Hola! Soy tu Asistente Financiero inteligente. Conozco en tiempo real toda tu situación financiera: saldo disponible, gastos, deudas, tarjetas de crédito y próximos vencimientos. ¿Qué te gustaría consultar hoy?',
      timestamp: this.formatCurrentTime()
    };
    this.messages.set([welcome]);
  }

  toggleOpen() {
    this.isOpen.update(v => !v);
    if (this.isOpen()) {
      this.shouldScrollToBottom = true;
    }
  }

  close() {
    this.isOpen.set(false);
  }

  clearChat() {
    this.initWelcomeMessage();
    this.shouldScrollToBottom = true;
  }

  askQuick(question: string) {
    this.userPrompt = question;
    this.sendQuestion();
  }

  async sendQuestion() {
    const query = this.userPrompt.trim();
    if (!query || this.isThinking()) return;

    // 1. Agregar mensaje del usuario
    const userMsg: ChatMessage = {
      id: 'usr_' + Date.now(),
      sender: 'user',
      text: query,
      timestamp: this.formatCurrentTime()
    };

    this.messages.update(list => [...list, userMsg]);
    this.userPrompt = '';
    this.isThinking.set(true);
    this.shouldScrollToBottom = true;

    // 2. Procesar con contexto financiero integral
    try {
      const botResponse = await this.resolveFinancialQuery(query);
      this.messages.update(list => [...list, botResponse]);
    } catch (e) {
      this.messages.update(list => [
        ...list,
        {
          id: 'bot_err_' + Date.now(),
          sender: 'bot',
          text: 'Ocurrió un inconveniente al procesar tu solicitud, pero tus datos financieros están a salvo. Puedes intentar de nuevo.',
          timestamp: this.formatCurrentTime()
        }
      ]);
    } finally {
      this.isThinking.set(false);
      this.shouldScrollToBottom = true;
    }
  }

  /**
   * Construye el perfil estadístico financiero completo en tiempo real
   */
  private buildFinancialProfilePayload() {
    const s = this.financeService.state();
    const currency = this.financeService.currency();

    // 1. Resumen mensual de liquidez
    const totalIn = s.incomes.reduce((acc, curr) => acc + curr.amount, 0);
    const totalEx = s.expenses.reduce((acc, curr) => acc + curr.amount, 0);
    const saldoDisponible = totalIn - totalEx;

    // 2. Próximos compromisos y pagos vencidos
    const upcoming = this.financeService.getUpcomingItems();
    const overdue = upcoming.filter(i => i.days < 0);
    const next7Days = upcoming.filter(i => i.days >= 0 && i.days <= 7);
    const totalDueNext7Days = next7Days.reduce((acc, item) => acc + item.amount, 0);
    const dineroRequerido = Math.max(0, totalDueNext7Days - saldoDisponible);

    // 3. Tarjetas de crédito
    const cards = this.financeService.cardsWithBalance();
    const creditCards = cards.filter(c => c.type === 'credito').map(c => ({
      nombre: c.name,
      deuda_actual: c.computedDebt || 0,
      limite_total: c.limit || 0,
      disponible: c.availableLimit || Math.max(0, (c.limit || 0) - (c.computedDebt || 0)),
      pago_para_no_generar_intereses: c.noInterest || null,
      pago_minimo: c.minPayment || null,
      fecha_limite_pago: c.dueDate || null,
      fecha_corte: c.cutoffDate || null,
      cat: c.cat || null
    }));
    const totalCreditDebt = creditCards.reduce((acc, c) => acc + c.deuda_actual, 0);
    const totalCreditLimit = creditCards.reduce((acc, c) => acc + c.limite_total, 0);

    // 4. Préstamos por cobrar y Deudas
    const consolidated = this.financeService.totalConsolidatedDebt();
    const loans = (s.debts || []).filter(d => d.group === 'prestamo').map(l => ({
      nombre: l.name,
      saldo_restante: Math.max(0, (l.total || 0) - (l.pagado || 0)),
      total_original: l.total || 0,
      cuota_mensual: l.cuota || 0,
      cat: l.cat || null
    }));

    // Dinero prestado a terceros (Préstamos por cobrar)
    const prestamosPorCobrarAbonos = s.incomes
      .filter(i => (i.category && (i.category.toLowerCase().includes('préstamo') || i.category.toLowerCase().includes('prestamo'))) || /préstamo cobrado|abono préstamo|pago de préstamo/i.test(i.description || ''))
      .reduce((acc, curr) => acc + curr.amount, 0);

    const prestamosPorCobrarOtorgados = s.expenses
      .filter(e => /presté|prestamo a|prestamo otorgado|dinero prestado/i.test(e.description || '') || (e.category && e.category.toLowerCase().includes('préstamo por cobrar')))
      .reduce((acc, curr) => acc + curr.amount, 0);

    const saldoPendientePorCobrar = Math.max(0, prestamosPorCobrarOtorgados - prestamosPorCobrarAbonos);

    // 5. Gastos desglosados por categoría
    const catMap: { [cat: string]: number } = {};
    s.expenses.forEach(e => {
      const c = e.category || 'Otros';
      catMap[c] = (catMap[c] || 0) + e.amount;
    });
    const topCategorias = Object.keys(catMap)
      .map(cat => ({
        categoria: cat,
        monto: catMap[cat],
        porcentaje: totalEx > 0 ? Math.round((catMap[cat] / totalEx) * 100) : 0
      }))
      .sort((a, b) => b.monto - a.monto);

    // 6. Servicios activos
    const servicios = (s.services || []).map(svc => ({
      nombre: svc.name,
      monto: svc.amount,
      dia_pago: svc.dueDay || null,
      frecuencia: svc.frequency || 'mensual'
    }));

    return {
      moneda: currency,
      resumen_mensual: {
        ingresos_mes: totalIn,
        gastos_acumulados_mes: totalEx,
        saldo_libre_disponible: saldoDisponible,
        compromiso_semana_7_dias: totalDueNext7Days,
        por_generar_esta_semana: dineroRequerido
      },
      prestamos_por_cobrar: {
        etiqueta: 'Préstamos por Cobrar',
        saldo_pendiente_por_cobrar: saldoPendientePorCobrar,
        abonos_o_pagos_recibidos: prestamosPorCobrarAbonos,
        criterio_liquidez: 'El capital por cobrar permanece FUERA de los ingresos disponibles hasta que esté efectivamente liquidado.'
      },
      compromisos_urgentes: {
        pagos_vencidos_total: overdue.length,
        lista_vencidos: overdue.map(o => ({
          nombre: o.name,
          monto: o.amount,
          dias_vencido: Math.abs(o.days)
        })),
        lista_proximos_7_dias: next7Days.map(item => ({
          nombre: item.name,
          monto: item.amount,
          fecha: item.due.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }),
          dias_restantes: item.days
        }))
      },
      tarjetas_credito: {
        deuda_total_tarjetas: totalCreditDebt,
        limite_total_credito: totalCreditLimit,
        porcentaje_uso: totalCreditLimit > 0 ? Math.round((totalCreditDebt / totalCreditLimit) * 100) : 0,
        detalle: creditCards
      },
      deudas_y_prestamos: {
        deuda_consolidada_total: consolidated.total,
        deuda_prestamos: consolidated.loansDebt,
        prestamos_activos: loans
      },
      top_categorias_gasto: topCategorias.slice(0, 5),
      servicios_fijos: servicios
    };
  }

  /**
   * Genera una respuesta completa utilizando el Agente IA de n8n con las estadísticas
   * y un motor local de alta precisión como respaldo
   */
  private async resolveFinancialQuery(query: string): Promise<ChatMessage> {
    const stats = this.buildFinancialProfilePayload();
    const historial = this.messages().slice(-6).map(m => ({
      rol: m.sender === 'user' ? 'usuario' : 'asistente',
      texto: m.text
    }));

    // 1. CONSULTAR PRIORITARIAMENTE EL AGENTE IA DE N8N CON EL CONTEXTO ESTADÍSTICO
    try {
      const n8nResult = await this.aiAdvisor.queryInteractiveFinancialAgent({
        message: query,
        perfil_usuario: { nombre: 'Oscar Thomason', rol: 'Usuario Principal' },
        estadisticas_financieras: stats,
        historial_reciente: historial
      });

      if (n8nResult && n8nResult.reply && n8nResult.reply.trim().length > 0) {
        // Si no es un json crudo no deseado
        if (!n8nResult.reply.includes('"tipo_solicitud": "analisis_gasto"') && !n8nResult.reply.includes('No hay concepto ni contexto')) {
          return {
            id: 'bot_' + Date.now(),
            sender: 'bot',
            text: n8nResult.reply,
            timestamp: this.formatCurrentTime(),
            dataPoints: n8nResult.dataPoints
          };
        }
      }
    } catch (err) {
      console.warn('n8n error, usando motor local de respaldo:', err);
    }

    // 2. MOTOR LOCAL INTELIGENTE (RESPALDO MATEMÁTICO INMEDIATO)
    const s = this.financeService.state();
    const saldoDisponible = stats.resumen_mensual.saldo_libre_disponible;
    const totalIn = stats.resumen_mensual.ingresos_mes;
    const totalEx = stats.resumen_mensual.gastos_acumulados_mes;
    const totalDueNext7Days = stats.resumen_mensual.compromiso_semana_7_dias;
    const dineroRequerido = stats.resumen_mensual.por_generar_esta_semana;
    const overdue = stats.compromisos_urgentes.lista_vencidos;
    const next7Days = stats.compromisos_urgentes.lista_proximos_7_dias;
    const cards = this.financeService.cardsWithBalance();
    const consolidated = this.financeService.totalConsolidatedDebt();

    const lowerQuery = query.toLowerCase();

    // --- REGLAS DEL ASESOR FINANCIERO ESTRATÉGICO ---

    // 1. CONSULTA DE SALDO O DINERO DISPONIBLE
    if (/saldo|disponible|cuanto tengo|cuánto tengo|dinero libre|liquidez|efectivo libre/i.test(lowerQuery)) {
      const libreReal = saldoDisponible - totalDueNext7Days;
      let text = '';
      if (saldoDisponible <= 0) {
        text = `Tu saldo disponible propio está en déficit (**-${this.money(Math.abs(saldoDisponible))}**).\n\n` +
               `• **Foco rojo:** No hay liquidez para consumos discrecionales.\n` +
               `• **Compromisos a 7 días:** Requieres **${this.money(totalDueNext7Days)}** para pagos inmediatos.\n\n` +
               `**Acción inmediata:** Detén cualquier compra no esencial hoy y cubre tus compromisos prioritarios.`;
      } else if (libreReal < 0) {
        text = `Cuentas con **${this.money(saldoDisponible)}** en caja, pero tienes compromisos por **${this.money(totalDueNext7Days)}** en los próximos 7 días.\n\n` +
               `• **Margen real:** Tu saldo disponible propio no cubre tus vencimientos inmediatos (déficit de **${this.money(Math.abs(libreReal))}**).\n` +
               `• **Riesgo:** Gastar ahora comprometerá tus pagos obligatorios.\n\n` +
               `**Acción inmediata:** Reserva los **${this.money(saldoDisponible)}** íntegros para los vencimientos de esta semana.`;
      } else {
        text = `Tu saldo disponible propio es de **${this.money(saldoDisponible)}**, con un margen libre real de **${this.money(libreReal)}** tras descontar los compromisos de los próximos 7 días (**${this.money(totalDueNext7Days)}**).\n\n` +
               `• **Posición:** Finanzas en orden y con liquidez para operar.\n` +
               `• **Foco clave:** Conservar este excedente para tu colchón de ahorro o amortización a capital.\n\n` +
               `**Acción inmediata:** Mantén intacta tu reserva semanal y canaliza el remanente a tus metas de ahorro.`;
      }

      return {
        id: 'bot_' + Date.now(),
        sender: 'bot',
        text,
        timestamp: this.formatCurrentTime(),
        dataPoints: [
          { label: 'Saldo propio', value: this.money(saldoDisponible) },
          { label: 'Compromisos 7d', value: this.money(totalDueNext7Days) }
        ]
      };
    }

    // 2. CONSULTA SOBRE COMPRAS ESPECÍFICAS ("¿Puedo comprar...?", "¿Me alcanza...?")
    if (/comprar|compro|puedo gastar|me alcanza|adquirir|vale la pena gastar|comprarme/i.test(lowerQuery) || /\$\s*\d+/.test(query)) {
      const match = query.match(/\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+)/);
      const monto = match ? parseFloat(match[1].replace(/,/g, '')) : 0;

      if (monto > 0) {
        const margenTrasGasto = saldoDisponible - monto - totalDueNext7Days;
        let text = '';

        if (monto > saldoDisponible) {
          const faltante = monto - saldoDisponible;
          text = `**No es viable realizar esta compra de ${this.money(monto)}.**\n\n` +
                 `Supera tu saldo propio disponible (**${this.money(saldoDisponible)}**) por una brecha de **${this.money(faltante)}**.\n\n` +
                 `**Plan B:**\n` +
                 `• Pospón la adquisición al menos 15 días hasta acumular nuevo flujo de efectivo.\n` +
                 `• Alternativa: Busca un modelo o versión equivalente por debajo de **${this.money(Math.max(0, saldoDisponible - totalDueNext7Days))}**.\n\n` +
                 `**Acción inmediata:** No efectúes el desembolso hoy para evitar endeudamiento con intereses.`;
        } else if (margenTrasGasto < 0) {
          text = `**Desaconsejo realizar esta compra de ${this.money(monto)} en este momento.**\n\n` +
                 `Aunque cuentas con el dinero nominal en cuenta (**${this.money(saldoDisponible)}**), realizar el gasto te dejaría sin liquidez para cubrir los **${this.money(totalDueNext7Days)}** de compromisos indispensables en los próximos 7 días (faltante de **${this.money(Math.abs(margenTrasGasto))}**).\n\n` +
                 `**Plan B:**\n` +
                 `• Liquida primero tus vencimientos programados de esta semana.\n` +
                 `• Si es imprescindible, recorta **${this.money(Math.abs(margenTrasGasto))}** en ocio y restaurantes antes del fin de semana.\n\n` +
                 `**Acción inmediata:** Congela esta compra hasta liquidar tus pagos de los próximos 7 días.`;
        } else {
          text = `**La compra de ${this.money(monto)} es financieramente viable.**\n\n` +
                 `Tras cubrir este artículo y reservar los **${this.money(totalDueNext7Days)}** para tus compromisos inmediatos de la semana, conservarás un saldo libre de **${this.money(margenTrasGasto)}**.\n\n` +
                 `**Plan de ejecución:**\n` +
                 `• Liquida preferentemente en una sola exhibición o con débito propio.\n` +
                 `• Conserva el remanente de **${this.money(margenTrasGasto)}** sin comprometerlo.\n\n` +
                 `**Acción inmediata:** Puedes proceder con la compra manteniendo tu control de presupuesto.`;
        }

        return {
          id: 'bot_' + Date.now(),
          sender: 'bot',
          text,
          timestamp: this.formatCurrentTime(),
          dataPoints: [
            { label: 'Costo', value: this.money(monto) },
            { label: 'Saldo Propio', value: this.money(saldoDisponible) },
            { label: 'Compromisos 7d', value: this.money(totalDueNext7Days) }
          ]
        };
      }
    }

    // 3. CONSULTA DE VENCIMIENTOS Y PAGOS PRÓXIMOS (FOCOS ROJOS)
    if (/vence|vencen|vencimiento|esta semana|pagos|proximos|próximos|pendiente|tengo que pagar|cuando pago/i.test(lowerQuery)) {
      let text = '';
      if (overdue.length > 0) {
        text += `**Foco rojo prioritario: Tienes ${overdue.length} pago(s) vencido(s).**\n\n`;
        overdue.forEach(o => {
          text += `• **${o.nombre}:** **${this.money(o.monto)}** (retraso de **${o.dias_vencido}** días).\n`;
        });
        text += `\n**Acción inmediata:** Liquida hoy mismo los vencidos para frenar intereses moratorios.`;
      } else if (next7Days.length > 0) {
        text += `**Compromisos indispensables para los próximos 7 días: ${this.money(totalDueNext7Days)}.**\n\n`;
        next7Days.forEach(item => {
          text += `• **${item.nombre}:** **${this.money(item.monto)}** — vence el **${item.fecha}**.\n`;
        });
        text += `\n**Acción inmediata:** Reserva **${this.money(dineroRequerido > 0 ? dineroRequerido : totalDueNext7Days)}** en tu cuenta operativa hoy.`;
      } else {
        text = `**Cuentas al corriente.** No tienes pagos vencidos ni vencimientos en los próximos 7 días.\n\n` +
               `**Acción inmediata:** Mantén tu disciplina de gasto y monitorea el corte de tus tarjetas.`;
      }

      return {
        id: 'bot_' + Date.now(),
        sender: 'bot',
        text,
        timestamp: this.formatCurrentTime(),
        dataPoints: [
          { label: 'Vencidos', value: `${overdue.length}` },
          { label: 'Próximos 7d', value: this.money(totalDueNext7Days) }
        ]
      };
    }

    // 4. CONSULTA DE TARJETAS DE CRÉDITO
    if (/tarjeta|tarjetas|credito|crédito|limite|límite|corte|linea de credito/i.test(lowerQuery)) {
      const creditCards = cards.filter(c => c.type === 'credito');
      if (creditCards.length === 0) {
        return {
          id: 'bot_' + Date.now(),
          sender: 'bot',
          text: 'No tienes tarjetas de crédito registradas en el sistema actualmente.',
          timestamp: this.formatCurrentTime()
        };
      }

      let text = `💳 **Estado detallado de tus Tarjetas de Crédito:**\n\n`;
      let totalDebtCards = 0;
      let totalLimit = 0;

      creditCards.forEach(c => {
        const debt = c.computedDebt || 0;
        const limit = c.limit || 0;
        const avail = c.availableLimit || Math.max(0, limit - debt);
        totalDebtCards += debt;
        totalLimit += limit;

        text += `• **${c.name}**\n` +
                `   - Deuda actual: **${this.money(debt)}**\n` +
                `   - Límite total: ${this.money(limit)} (Disponible: ${this.money(avail)})\n`;
        if (c.noInterest) text += `   - Para no generar intereses: ${this.money(c.noInterest)}\n`;
        if (c.minPayment) text += `   - Pago mínimo: ${this.money(c.minPayment)}\n`;
        if (c.dueDate) text += `   - Fecha límite de pago: ${c.dueDate}\n`;
        text += `\n`;
      });

      const usageRate = totalLimit > 0 ? Math.round((totalDebtCards / totalLimit) * 100) : 0;
      text += `📊 **Utilización global de crédito:** ${usageRate}%\n`;
      if (usageRate > 40) {
        text += `💡 *Consejo:* Procura mantener tu uso de tarjetas por debajo del 30-40% para maximizar tu puntaje crediticio.`;
      }

      return {
        id: 'bot_' + Date.now(),
        sender: 'bot',
        text,
        timestamp: this.formatCurrentTime(),
        dataPoints: [
          { label: 'Deuda Tarjetas', value: this.money(totalDebtCards) },
          { label: 'Crédito Total', value: this.money(totalLimit) },
          { label: 'Uso de Crédito', value: `${usageRate}%` }
        ]
      };
    }

    // 5. CONSULTA DE DINERO PRESTADO A TERCEROS / PRÉSTAMOS POR COBRAR
    if (/prestado|presté|dinero prestado|me deben|por cobrar|préstamos por cobrar|prestamos por cobrar|abono de préstamo|liquidar préstamo por cobrar/i.test(lowerQuery)) {
      return {
        id: 'bot_' + Date.now(),
        sender: 'bot',
        text: `📌 **Manejo de Préstamos por Cobrar y Liquidez:**\n\n` +
              `1. **Separación de capital:** El dinero prestado a terceros se mantiene fuera de tus "Ingresos Reales Disponibles" y se registra bajo la etiqueta **"Préstamos por Cobrar"**.\n\n` +
              `2. **Impacto de liquidación:**\n` +
              `   • **Mientras no se pague:** Permanece visible únicamente como saldo pendiente por cobrar (activo circulante), nunca como saldo para gastar.\n` +
              `   • **En cuanto recibas el pago o abono:** Se descuenta de "Préstamos por Cobrar" y se integra de inmediato a tu **"Saldo Disponible / Ingreso Recuperado"** para el cálculo de flujo de efectivo real.\n\n` +
              `3. **Criterio de análisis:** No consideres el dinero por cobrar como saldo disponible para gastos o compras inmediatas hasta que no esté efectivamente liquidado y depositado.`,
        timestamp: this.formatCurrentTime(),
        dataPoints: [
          { label: 'Estatus', value: 'Por Cobrar' },
          { label: 'Criterio', value: 'No disponible hasta liquidar' }
        ]
      };
    }

    // 6. CONSULTA DE DEUDAS Y PRÉSTAMOS POR PAGAR (TOTALES Y ESTRATEGIA)
    if (/deuda|deudas|prestamo|préstamos|cuanto debo|cuánto debo|desendeudamiento|liquidar deudas/i.test(lowerQuery)) {
      const debts = s.debts || [];
      const loans = debts.filter(d => d.group === 'prestamo');

      let text = `📊 **Resumen Consolidado de Deudas:**\n\n` +
                 `• **Deuda Total Viva:** **${this.money(consolidated.total)}**\n` +
                 `   - En Préstamos: ${this.money(consolidated.loansDebt)}\n` +
                 `   - En Tarjetas de Crédito: ${this.money(consolidated.creditCardsDebt)}\n\n`;

      if (loans.length > 0) {
        text += `📋 **Tus préstamos activos:**\n`;
        loans.forEach(l => {
          const rest = Math.max(0, (l.total || 0) - (l.pagado || 0));
          text += `• **${l.name}:** Saldo restante de ${this.money(rest)} (Cuota mensual: ${this.money(l.cuota || 0)})\n`;
        });
        text += `\n`;
      }

      // Buscar la deuda con mayor CAT
      const debtsWithCat = debts.filter(d => d.cat && d.cat > 0).sort((a, b) => (b.cat || 0) - (a.cat || 0));
      if (debtsWithCat.length > 0) {
        const top = debtsWithCat[0];
        text += `🎯 **Estrategia sugerida (Método Avalancha):**\n` +
                `Te conviene enfocar cualquier abono extraordinario en **${top.name}**, ya que cobra el mayor costo anual (CAT ${top.cat}%). Liquidarla primero te ahorrará miles de pesos en intereses.`;
      }

      return {
        id: 'bot_' + Date.now(),
        sender: 'bot',
        text,
        timestamp: this.formatCurrentTime(),
        dataPoints: [
          { label: 'Deuda Consolidada', value: this.money(consolidated.total) },
          { label: 'Préstamos', value: this.money(consolidated.loansDebt) },
          { label: 'Tarjetas', value: this.money(consolidated.creditCardsDebt) }
        ]
      };
    }

    // 6. CONSULTA SOBRE CATEGORÍAS DE GASTOS / EN QUÉ HE GASTADO
    if (/en que he gastado|en qué he gastado|gastos|categoria|categorías|fuga|en que se va/i.test(lowerQuery)) {
      const expenses = s.expenses || [];
      if (expenses.length === 0) {
        return {
          id: 'bot_' + Date.now(),
          sender: 'bot',
          text: 'Aún no tienes gastos registrados este mes para analizar.',
          timestamp: this.formatCurrentTime()
        };
      }

      const catMap: { [cat: string]: number } = {};
      expenses.forEach(e => {
        const c = e.category || 'Otros';
        catMap[c] = (catMap[c] || 0) + e.amount;
      });

      const sorted = Object.keys(catMap)
        .map(name => ({ name, amount: catMap[name] }))
        .sort((a, b) => b.amount - a.amount);

      let text = `🛍️ **Desglose de tus Gastos por Categoría este mes (${this.money(totalEx)}):**\n\n`;
      sorted.slice(0, 5).forEach((item, idx) => {
        const pct = totalEx > 0 ? Math.round((item.amount / totalEx) * 100) : 0;
        text += `${idx + 1}. **${item.name}:** ${this.money(item.amount)} (${pct}%)\n`;
      });

      return {
        id: 'bot_' + Date.now(),
        sender: 'bot',
        text,
        timestamp: this.formatCurrentTime(),
        dataPoints: sorted.slice(0, 3).map(s => ({ label: s.name, value: this.money(s.amount) }))
      };
    }

    // 7. RESPUESTA INTELIGENTE GENERAL DE RESPALDO (SIN LLAMAR AL FLUJO VIEJO)
    return {
      id: 'bot_' + Date.now(),
      sender: 'bot',
      text: `Entendido tu consulta: "${query}".\n\n` +
            `Actualmente dispones de **${this.money(saldoDisponible)}** en saldo libre, con **${this.money(totalDueNext7Days)}** programados en pagos para esta semana y una deuda viva consolidada de **${this.money(consolidated.total)}**.\n\n` +
            `¿Deseas que analicemos algún rubro en específico, como tus tarjetas de crédito, recortar gastos prescindibles o simular una compra?`,
      timestamp: this.formatCurrentTime(),
      dataPoints: [
        { label: 'Saldo Libre', value: this.money(saldoDisponible) },
        { label: 'Deuda Consolidada', value: this.money(consolidated.total) }
      ]
    };
  }

  formatCurrentTime(): string {
    const d = new Date();
    return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  }

  money(val?: number): string {
    if (val === undefined || val === null) return '$0.00';
    return this.financeService.currency() + val.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  formatMessageText(text: string): string {
    if (!text) return '';
    let safe = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    safe = safe.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    safe = safe.replace(/\n/g, '<br>');
    return safe;
  }
}
