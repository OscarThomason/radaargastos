import { Component, ElementRef, ViewChild, inject, signal, effect, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiAdvisorService } from '../../services/ai-advisor.service';
import { FinanceService } from '../../services/finance.service';
import { AuthService } from '../../services/auth.service';
import { AppState, Income, Expense } from '../../models/finance.model';

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
  private authService = inject(AuthService);

  @ViewChild('messagesContainer') private messagesContainer!: ElementRef<HTMLDivElement>;

  isOpen = signal<boolean>(false);
  isThinking = signal<boolean>(false);
  userPrompt = '';

  sessionId = 'session_' + Date.now();

  get currentSessionId(): string {
    const user = this.authService.userSignal();
    const uid = user?.uid ? user.uid : 'oscar_thomason';
    return `${uid}_${this.sessionId}`;
  }

  messages = signal<ChatMessage[]>([]);

  // Píldoras de sugerencias rápidas
  quickSuggestions = [
    '¿Cuál es mi saldo libre disponible?',
    '¿Cuánto gasté en gasolina este mes?',
    '¿Cómo cerró mi mes anterior?',
    'Estadísticas y desglose 50/30/20',
    '¿Qué pagos tengo esta semana?',
    '¿Cómo van mis tarjetas de crédito?'
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
    this.sessionId = 'session_' + Date.now();
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

  /** Determina si un ingreso proviene de un préstamo recibido por el usuario (pasivo que no debe inflar ingresos propios) */
  private isLoanIncome(income?: Income | null): boolean {
    if (!income) return false;
    const cat = (income.category || '').toLowerCase().trim();
    const desc = (income.description || '').toLowerCase().trim();
    if (cat.includes('por cobrar') || cat.includes('cobrado') || desc.includes('cobro préstamo') || desc.includes('abono a préstamo')) {
      return false;
    }
    return cat.includes('préstamo') || cat.includes('prestamo') || /prestamo recibido|préstamo recibido|dinero prestado en mano/i.test(desc);
  }

  private formatMonthLabel(key: string): string {
    const parts = key.split('-');
    if (parts.length < 2) return key;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = new Date(y, m - 1, 1);
    const label = d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  /**
   * Computa el perfil financiero exacto para cualquier mes específico (YYYY-MM)
   */
  private computeMonthProfile(monthKey: string, s: AppState) {
    const expenses = (s.expenses || []).filter(e => (e.date || '').slice(0, 7) === monthKey);
    const incomes = (s.incomes || []).filter(i => (i.date || '').slice(0, 7) === monthKey);

    const ownIncomes = incomes.filter(i => !this.isLoanIncome(i));
    const totalIncomes = ownIncomes.reduce((acc, i) => acc + i.amount, 0);

    const ownExpenses = expenses.filter(e => e.fundingSource !== 'prestamo');
    const borrowedExpenses = expenses.filter(e => e.fundingSource === 'prestamo');
    const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
    const ownExpensesTotal = ownExpenses.reduce((acc, e) => acc + e.amount, 0);

    const netBalance = totalIncomes - totalExpenses;

    // Desglose de categorías de gastos en este mes
    const catExpMap: Record<string, { total: number; count: number }> = {};
    expenses.forEach(e => {
      const cat = e.category || 'Otros';
      if (!catExpMap[cat]) catExpMap[cat] = { total: 0, count: 0 };
      catExpMap[cat].total += e.amount;
      catExpMap[cat].count++;
    });

    const categoriesBreakdown = Object.keys(catExpMap)
      .map(cat => ({
        categoria: cat,
        monto: catExpMap[cat].total,
        porcentaje: totalExpenses > 0 ? Math.round((catExpMap[cat].total / totalExpenses) * 100) : 0,
        movimientos: catExpMap[cat].count
      }))
      .sort((a, b) => b.monto - a.monto);

    // Conceptos específicos analizados
    const gasolinaExpenses = expenses.filter(e =>
      /gasolina|combustible|pemex|shell|bp|gas\b/i.test(e.description || '') ||
      /gasolina/i.test(e.category || '')
    );
    const gasolinaTotal = gasolinaExpenses.reduce((sum, e) => sum + e.amount, 0);

    const transporteExpenses = expenses.filter(e =>
      /transporte|gasolina|uber|didi|cabify|camion|pasaje|caseta|estacionamiento|auto/i.test(e.description || '') ||
      (e.category || '').toLowerCase() === 'transporte'
    );
    const transporteTotal = transporteExpenses.reduce((sum, e) => sum + e.amount, 0);

    const alimentosExpenses = expenses.filter(e =>
      /alimento|despensa|super|súper|walmart|soriana|chedraui|oxxo|7-eleven|mercado|abarrotes/i.test(e.description || '') ||
      (e.category || '').toLowerCase() === 'alimentos'
    );
    const alimentosTotal = alimentosExpenses.reduce((sum, e) => sum + e.amount, 0);

    const restaurantesExpenses = expenses.filter(e =>
      /restaurante|café|cafe|starbucks|tacos|burguer|burger|pizza|bar|sushi|rappi|uber eats/i.test(e.description || '') ||
      (e.category || '').toLowerCase() === 'restaurantes'
    );
    const restaurantesTotal = restaurantesExpenses.reduce((sum, e) => sum + e.amount, 0);

    const ocioExpenses = expenses.filter(e =>
      /ocio|oscio|cine|juego|steam|playstation|xbox|nintendo|fiesta|concierto|entretenimiento|netflix|spotify|disney/i.test(e.description || '') ||
      (e.category || '').toLowerCase() === 'oscio' || (e.category || '').toLowerCase() === 'ocio'
    );
    const ocioTotal = ocioExpenses.reduce((sum, e) => sum + e.amount, 0);

    const deudasExpenses = expenses.filter(e =>
      (e.category || '').toLowerCase() === 'deudas' ||
      /abono|pago tarjeta|pago credito|prestamo|préstamo|kueski|tribu/i.test(e.description || '')
    );
    const deudasTotal = deudasExpenses.reduce((sum, e) => sum + e.amount, 0);

    const serviciosExpenses = expenses.filter(e =>
      (e.category || '').toLowerCase() === 'servicios' ||
      /luz|cfe|agua|gas|internet|telmex|izzi|totalplay/i.test(e.description || '')
    );
    const serviciosTotal = serviciosExpenses.reduce((sum, e) => sum + e.amount, 0);

    // Análisis 50/30/20 y esenciales
    const essentialAnalysis = this.aiAdvisor.analyzeEssentialVsNonEssential(expenses);

    // Promedio diario del mes
    const [y, m] = monthKey.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const promedioDiario = Math.round(totalExpenses / (daysInMonth || 30));

    // Tasa de ahorro
    const tasaAhorro = totalIncomes > 0 ? Math.max(0, Math.round((netBalance / totalIncomes) * 100)) : 0;

    return {
      clave: monthKey,
      nombre_mes: this.formatMonthLabel(monthKey),
      ingresos_totales: totalIncomes,
      gastos_totales: totalExpenses,
      gastos_propios: ownExpensesTotal,
      gastos_con_prestamo: borrowedExpenses.reduce((sum, e) => sum + e.amount, 0),
      balance_neto: netBalance,
      tasa_ahorro_porcentaje: tasaAhorro,
      promedio_gasto_diario: promedioDiario,
      categorias_desglose: categoriesBreakdown,
      diagnostico_50_30_20: {
        esenciales_total: essentialAnalysis.essentialTotal,
        esenciales_porcentaje: essentialAnalysis.essentialPercent,
        no_esenciales_total: essentialAnalysis.nonEssentialTotal,
        no_esenciales_porcentaje: essentialAnalysis.nonEssentialPercent
      },
      conceptos_clave: {
        gasolina: {
          total: gasolinaTotal,
          cantidad: gasolinaExpenses.length,
          movimientos: gasolinaExpenses.map(e => ({ descripcion: e.description, monto: e.amount, fecha: e.date }))
        },
        transporte_global: {
          total: transporteTotal,
          cantidad: transporteExpenses.length
        },
        alimentos_despensa: {
          total: alimentosTotal,
          cantidad: alimentosExpenses.length
        },
        restaurantes: {
          total: restaurantesTotal,
          cantidad: restaurantesExpenses.length
        },
        ocio_y_gustos: {
          total: ocioTotal,
          cantidad: ocioExpenses.length
        },
        servicios: {
          total: serviciosTotal,
          cantidad: serviciosExpenses.length
        },
        deudas_pagadas_en_gastos: {
          total: deudasTotal,
          cantidad: deudasExpenses.length,
          movimientos: deudasExpenses.map(e => ({ descripcion: e.description, monto: e.amount, fecha: e.date }))
        }
      },
      lista_gastos: expenses.map(e => ({
        fecha: e.date,
        descripcion: e.description,
        categoria: e.category,
        monto: e.amount,
        financiado_con: e.fundingSource === 'prestamo' ? 'Dinero Prestado' : 'Fondos Propios'
      }))
    };
  }

  /**
   * Construye el perfil estadístico financiero completo en tiempo real
   * con soporte nativo de mes actual, mes anterior e histórico de meses
   */
  private buildFinancialProfilePayload() {
    const s = this.financeService.state();
    const currency = this.financeService.currency();

    const now = new Date();
    const currentMonthKey = now.toISOString().slice(0, 7);
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthKey = lastMonthDate.toISOString().slice(0, 7);

    // 1. Perfiles estadísticos exactos de mes actual y mes anterior
    const periodoActual = this.computeMonthProfile(currentMonthKey, s);
    const periodoAnterior = this.computeMonthProfile(lastMonthKey, s);

    // 2. Histórico de los últimos meses disponibles
    const allMonthsSet = new Set<string>();
    allMonthsSet.add(currentMonthKey);
    allMonthsSet.add(lastMonthKey);
    (s.expenses || []).forEach(e => { if (e.date) allMonthsSet.add(e.date.slice(0, 7)); });
    (s.incomes || []).forEach(i => { if (i.date) allMonthsSet.add(i.date.slice(0, 7)); });

    const sortedMonthKeys = Array.from(allMonthsSet).sort().reverse().slice(0, 6);
    const historicoMeses = sortedMonthKeys.map(k => {
      const prof = this.computeMonthProfile(k, s);
      return {
        clave: k,
        nombre: prof.nombre_mes,
        ingresos: prof.ingresos_totales,
        gastos: prof.gastos_totales,
        balance: prof.balance_neto,
        top_categoria: prof.categorias_desglose[0] ? prof.categorias_desglose[0].categoria : 'N/A'
      };
    });

    // 3. Saldo acumulado de meses anteriores y liquidez operativa real
    const pastIn = (s.incomes || [])
      .filter(i => (i.date || '').slice(0, 7) < currentMonthKey && !this.isLoanIncome(i))
      .reduce((acc, i) => acc + i.amount, 0);
    const pastEx = (s.expenses || [])
      .filter(e => (e.date || '').slice(0, 7) < currentMonthKey && e.fundingSource !== 'prestamo')
      .reduce((acc, e) => acc + e.amount, 0);
    const pastBalance = pastIn - pastEx;
    const saldoDisponibleReal = pastBalance + periodoActual.ingresos_totales - periodoActual.gastos_propios;

    // 4. Próximos compromisos y pagos vencidos
    const upcoming = this.financeService.getUpcomingItems();
    const overdue = upcoming.filter(i => i.days < 0);
    const next7Days = upcoming.filter(i => i.days >= 0 && i.days <= 7);
    const totalDueNext7Days = next7Days.reduce((acc, item) => acc + item.amount, 0);
    const dineroRequerido = Math.max(0, totalDueNext7Days - saldoDisponibleReal);

    // 5. Tarjetas de crédito
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

    // 6. Préstamos a plazos y Deudas
    const consolidated = this.financeService.totalConsolidatedDebt();
    const loans = (s.debts || []).filter(d => d.group === 'prestamo').map(l => ({
      nombre: l.name,
      saldo_restante_a_liquidar: Math.max(0, (l.total || 0) - (l.pagado || 0)),
      total_original_prestamo: l.total || 0,
      cuota_mensual: l.cuota || 0,
      cat: l.cat || null
    }));

    // Dinero prestado a terceros (Préstamos por cobrar)
    const prestamosPorCobrarAbonos = (s.incomes || [])
      .filter(i => (i.category && (i.category.toLowerCase().includes('préstamo') || i.category.toLowerCase().includes('prestamo'))) || /préstamo cobrado|abono préstamo|pago de préstamo/i.test(i.description || ''))
      .reduce((acc, curr) => acc + curr.amount, 0);

    const prestamosPorCobrarOtorgados = (s.expenses || [])
      .filter(e => /presté|prestamo a|prestamo otorgado|dinero prestado/i.test(e.description || '') || (e.category && e.category.toLowerCase().includes('préstamo por cobrar')))
      .reduce((acc, curr) => acc + curr.amount, 0);

    // Dinero prestado recibido por el usuario (en mano / activo a partir de Octubre 2026)
    const gastosFinanciadosConPrestamo = (s.expenses || [])
      .filter(e => (e.date || '').slice(0, 7) >= '2026-10' && e.fundingSource === 'prestamo')
      .reduce((acc, e) => acc + e.amount, 0);
    const ingresosPrestamosRecibidos = (s.incomes || [])
      .filter(i => {
        const m = (i.date || '').slice(0, 7);
        const cat = (i.category || '').toLowerCase();
        const desc = (i.description || '').toLowerCase();
        const isCobrar = cat.includes('por cobrar') || cat.includes('cobrado');
        return m >= '2026-10' && !isCobrar && (cat.includes('préstamo') || cat.includes('prestamo') || /prestamo recibido|préstamo recibido/i.test(desc));
      })
      .reduce((acc, i) => acc + i.amount, 0);
    const dineroPrestadoEnMano = Math.max(0, ingresosPrestamosRecibidos - gastosFinanciadosConPrestamo);
    const saldoPendientePorCobrar = Math.max(0, prestamosPorCobrarOtorgados - prestamosPorCobrarAbonos);

    // Servicios activos
    const servicios = (s.services || []).map(svc => ({
      nombre: svc.name,
      monto: svc.amount,
      dia_pago: svc.dueDay || null,
      frecuencia: svc.frequency || 'mensual'
    }));

    return {
      moneda: currency,
      fecha_consulta: now.toISOString().slice(0, 10),

      // CAMPOS ESPERADOS DIRECTAMENTE POR EL WORKFLOW DE N8N
      resumen_mensual: {
        mes: periodoActual.nombre_mes,
        ingresos_mes: periodoActual.ingresos_totales,
        gastos_acumulados_mes: periodoActual.gastos_totales,
        gastos_propios: periodoActual.gastos_propios,
        gastos_con_prestamo: periodoActual.gastos_con_prestamo,
        saldo_libre_disponible: saldoDisponibleReal,
        compromiso_semana_7_dias: totalDueNext7Days,
        por_generar_esta_semana: dineroRequerido
      },
      top_categorias_gasto: periodoActual.categorias_desglose.map(c => ({
        categoria: c.categoria,
        monto: c.monto,
        porcentaje: c.porcentaje
      })),

      // DATOS COMPLETOS DEL MES ANTERIOR
      resumen_mes_anterior: {
        mes: periodoAnterior.nombre_mes,
        clave: periodoAnterior.clave,
        ingresos_mes: periodoAnterior.ingresos_totales,
        gastos_acumulados_mes: periodoAnterior.gastos_totales,
        balance_neto: periodoAnterior.balance_neto,
        top_categorias_gasto: periodoAnterior.categorias_desglose.map(c => ({
          categoria: c.categoria,
          monto: c.monto,
          porcentaje: c.porcentaje
        })),
        gasolina: periodoAnterior.conceptos_clave.gasolina,
        transporte_total: periodoAnterior.conceptos_clave.transporte_global.total
      },

      // DESGLOSE ESPECÍFICO DE CONCEPTOS FRECUENTES
      conceptos_frecuentes: {
        gasolina_mes_actual: periodoActual.conceptos_clave.gasolina,
        gasolina_mes_anterior: periodoAnterior.conceptos_clave.gasolina,
        transporte_mes_actual: periodoActual.conceptos_clave.transporte_global.total,
        transporte_mes_anterior: periodoAnterior.conceptos_clave.transporte_global.total
      },

      // PERFILES Y LISTAS COMPLETAS
      periodo_actual: periodoActual,
      periodo_anterior: periodoAnterior,
      comparativa_mensual: {
        variacion_gasto: periodoActual.gastos_totales - periodoAnterior.gastos_totales,
        variacion_ingreso: periodoActual.ingresos_totales - periodoAnterior.ingresos_totales
      },
      historico_reciente_meses: historicoMeses,
      resumen_liquidez_operativa: {
        saldo_anterior_acumulado: pastBalance,
        ingresos_mes_actual: periodoActual.ingresos_totales,
        gastos_propios_mes_actual: periodoActual.gastos_propios,
        saldo_libre_disponible: saldoDisponibleReal,
        compromiso_semana_7_dias: totalDueNext7Days,
        margen_tras_compromisos_7d: saldoDisponibleReal - totalDueNext7Days,
        por_generar_esta_semana: dineroRequerido
      },
      dinero_prestado_en_mano: {
        etiqueta: 'Dinero Prestado en Mano',
        monto_activo: dineroPrestadoEnMano,
        gastado_con_prestamo_este_mes: periodoActual.gastos_con_prestamo,
        criterio_liquidez: 'Capital temporal ajeno en mano. NO cuenta como ingreso propio ni saldo libre disponible.'
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
        detalle: creditCards,
        nota_contable: 'Deuda viva revolvente al día de hoy. NO confundir con el gasto de un mes.'
      },
      prestamos_a_plazos: {
        deuda_consolidada_total_prestamos: consolidated.loansDebt,
        suma_cuotas_mensuales: loans.reduce((acc, l) => acc + (l.cuota_mensual || 0), 0),
        detalle_prestamos: loans,
        alerta_contable: 'IMPORTANTE: saldo_restante_a_liquidar es la deuda acumulada a varios años. La cuota mensual es cuota_mensual. NUNCA decir que el saldo total es el gasto del mes anterior.'
      },
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

    const periodoActual = stats.periodo_actual;
    const periodoAnterior = stats.periodo_anterior;

    // Enriquecer mensaje para n8n con datos directos si pregunta por gasolina o mes anterior
    let enrichedMessage = query;
    if (/gasolina|combustible/i.test(query)) {
      enrichedMessage += `\n[DATOS REALES VERIFICADOS: En ${periodoActual.nombre_mes} llevas $${periodoActual.conceptos_clave.gasolina.total} en gasolina (${periodoActual.conceptos_clave.gasolina.movimientos.map((m: any) => m.descripcion + ': $' + m.monto).join(', ')}). En ${periodoAnterior.nombre_mes} gastaste $${periodoAnterior.conceptos_clave.gasolina.total} en gasolina (${periodoAnterior.conceptos_clave.gasolina.movimientos.map((m: any) => m.descripcion + ': $' + m.monto).join(', ')}).]`;
    } else if (/mes anterior|mes pasado/i.test(query)) {
      enrichedMessage += `\n[DATOS REALES VERIFICADOS DEL MES ANTERIOR (${periodoAnterior.nombre_mes}): Gastos totales: $${periodoAnterior.gastos_totales}, Ingresos totales: $${periodoAnterior.ingresos_totales}, Balance neto: $${periodoAnterior.balance_neto}, Principales categorías: ${periodoAnterior.categorias_desglose.slice(0, 4).map((c: any) => c.categoria + ': $' + c.monto).join(', ')}.]`;
    }

    // 1. CONSULTAR PRIORITARIAMENTE EL AGENTE IA DE N8N CON EL CONTEXTO ESTADÍSTICO
    try {
      const user = this.authService.userSignal();
      const n8nResult = await this.aiAdvisor.queryInteractiveFinancialAgent({
        message: enrichedMessage,
        sessionId: this.currentSessionId,
        perfil_usuario: { 
          nombre: user?.displayName || 'Oscar Thomason', 
          uid: user?.uid,
          rol: 'Usuario Principal' 
        },
        estadisticas_financieras: stats,
        historial_reciente: historial
      });

      if (n8nResult && n8nResult.reply && n8nResult.reply.trim().length > 0) {
        const rep = n8nResult.reply;
        const isEvasive = /no tengo el dato|no puedo revisar|no puedo ver|no tengo informaci|no incluye movimientos|bloque que compartiste|campos de gasto están vacíos|reenvíame el resumen|no dispongo/i.test(rep);
        if (!isEvasive && !rep.includes('"tipo_solicitud": "analisis_gasto"') && !rep.includes('No hay concepto ni contexto')) {
          return {
            id: 'bot_' + Date.now(),
            sender: 'bot',
            text: rep,
            timestamp: this.formatCurrentTime(),
            dataPoints: n8nResult.dataPoints
          };
        }
      }
    } catch (err) {
      console.warn('n8n error, usando motor local de respaldo:', err);
    }

    // 2. MOTOR LOCAL INTELIGENTE (RESPALDO MATEMÁTICO INMEDIATO DE ALTA PRECISIÓN)
    const s = this.financeService.state();
    const saldoDisponible = stats.resumen_liquidez_operativa.saldo_libre_disponible;
    const totalDueNext7Days = stats.resumen_liquidez_operativa.compromiso_semana_7_dias;
    const dineroRequerido = stats.resumen_liquidez_operativa.por_generar_esta_semana;
    const overdue = stats.compromisos_urgentes.lista_vencidos;
    const next7Days = stats.compromisos_urgentes.lista_proximos_7_dias;
    const cards = this.financeService.cardsWithBalance();
    const consolidated = this.financeService.totalConsolidatedDebt();

    const lowerQuery = query.toLowerCase();

    // --- REGLAS DEL ASESOR FINANCIERO ESTRATÉGICO ---

    // A. CONSULTAS SOBRE EL MES ANTERIOR / MES PASADO
    if (/mes anterior|mes pasado|mes previo|el mes pasado|el mes anterior|septiembre/i.test(lowerQuery)) {
      const ant = periodoAnterior;
      const act = periodoActual;
      const difGasto = act.gastos_totales - ant.gastos_totales;
      let compText = '';
      if (ant.gastos_totales > 0) {
        if (difGasto > 0) {
          compText = `• **Comparativa con este mes:** Llevas **${this.money(difGasto)}** más gastados en ${act.nombre_mes} frente al mes anterior.\n`;
        } else if (difGasto < 0) {
          compText = `• **Comparativa con este mes:** En ${ant.nombre_mes} gastaste **${this.money(Math.abs(difGasto))}** más de lo que llevas registrado este mes.\n`;
        }
      }

      let topCatsText = '';
      if (ant.categorias_desglose.length > 0) {
        topCatsText = ant.categorias_desglose.slice(0, 4)
          .map((c: any) => `   - **${c.categoria}:** ${this.money(c.monto)} (${c.porcentaje}%)`)
          .join('\n');
      }

      let text = `📅 **Cierre Estadístico del Mes Anterior (${ant.nombre_mes}):**\n\n` +
                 `• **Gastos Totales:** **${this.money(ant.gastos_totales)}**\n` +
                 `• **Ingresos Totales:** **${this.money(ant.ingresos_totales)}**\n` +
                 `• **Balance Neto:** **${this.money(ant.balance_neto)}**\n` +
                 `${compText}` +
                 (topCatsText ? `\n📊 **Categorías con mayor gasto en ${ant.nombre_mes}:**\n${topCatsText}\n\n` : '\n') +
                 `💡 *Nota:* Cifras calculadas estrictamente con tus movimientos registrados en ${ant.nombre_mes}.`;

      return {
        id: 'bot_' + Date.now(),
        sender: 'bot',
        text,
        timestamp: this.formatCurrentTime(),
        dataPoints: [
          { label: `Gastos ${ant.nombre_mes}`, value: this.money(ant.gastos_totales) },
          { label: `Ingresos ${ant.nombre_mes}`, value: this.money(ant.ingresos_totales) },
          { label: `Balance ${ant.nombre_mes}`, value: this.money(ant.balance_neto) }
        ]
      };
    }

    // B. CONSULTAS SOBRE GASOLINA / COMBUSTIBLE
    if (/gasolina|combustible|pemex|shell|bp/i.test(lowerQuery)) {
      const isLastMonth = /mes anterior|mes pasado|el mes pasado/i.test(lowerQuery);
      const target = isLastMonth ? periodoAnterior : periodoActual;
      const gasInfo = target.conceptos_clave.gasolina;
      const transInfo = target.conceptos_clave.transporte_global;

      let text = '';
      if (gasInfo.total > 0) {
        text = `⛽ Tu gasto en **gasolina** durante **${target.nombre_mes}** es de **${this.money(gasInfo.total)}**.\n\n`;
        if (gasInfo.movimientos.length > 0) {
          text += `• **Registros encontrados:**\n`;
          gasInfo.movimientos.forEach((m: any) => {
            text += `   - **${m.descripcion}:** ${this.money(m.monto)} (${m.fecha})\n`;
          });
          text += `\n`;
        }
        text += `• **Transporte global:** Llevas **${this.money(transInfo.total)}** acumulados en movilidad durante este periodo.\n\n` +
                `💡 Representa el **${target.gastos_totales > 0 ? Math.round((gasInfo.total / target.gastos_totales) * 100) : 0}%** de tus gastos totales de ${target.nombre_mes}.`;
      } else {
        text = `No tienes gastos registrados bajo el concepto de **gasolina** durante **${target.nombre_mes}**.\n\n` +
               `• Tu gasto en la categoría general de **Transporte** en ese periodo fue de **${this.money(transInfo.total)}**.`;
      }

      return {
        id: 'bot_' + Date.now(),
        sender: 'bot',
        text,
        timestamp: this.formatCurrentTime(),
        dataPoints: [
          { label: `Gasolina (${target.nombre_mes})`, value: this.money(gasInfo.total) },
          { label: `Transporte Total`, value: this.money(transInfo.total) }
        ]
      };
    }

    // C. CONSULTAS SOBRE TRANSPORTE GENERAL (UBER, DIDI, ETC.)
    if (/transporte|uber|didi|cabify|pasaje|camion|caseta/i.test(lowerQuery)) {
      const isLastMonth = /mes anterior|mes pasado/i.test(lowerQuery);
      const target = isLastMonth ? periodoAnterior : periodoActual;
      const transInfo = target.conceptos_clave.transporte_global;
      const gasInfo = target.conceptos_clave.gasolina;

      const text = `🚗 **Gastos en Transporte (${target.nombre_mes}):**\n\n` +
                   `• **Total en Transporte:** **${this.money(transInfo.total)}**\n` +
                   `• **De los cuales en Gasolina:** ${this.money(gasInfo.total)}\n` +
                   `• **Representa:** el **${target.gastos_totales > 0 ? Math.round((transInfo.total / target.gastos_totales) * 100) : 0}%** de tu presupuesto de gastos del mes.`;

      return {
        id: 'bot_' + Date.now(),
        sender: 'bot',
        text,
        timestamp: this.formatCurrentTime(),
        dataPoints: [
          { label: `Transporte ${target.nombre_mes}`, value: this.money(transInfo.total) },
          { label: 'Gasolina', value: this.money(gasInfo.total) }
        ]
      };
    }

    // D. CONSULTAS SOBRE ESTADÍSTICAS GLOBALES / 50-30-20 / TASA DE AHORRO
    if (/estadistica|estadística|50 30 20|50\/30\/20|tasa de ahorro|ahorro|esenciales|promedio diario/i.test(lowerQuery)) {
      const isLastMonth = /mes anterior|mes pasado/i.test(lowerQuery);
      const target = isLastMonth ? periodoAnterior : periodoActual;
      const diag = target.diagnostico_50_30_20;

      const text = `📈 **Estadísticas Financieras de ${target.nombre_mes}:**\n\n` +
                   `• **Gastos Esenciales (50% sugerido):** **${this.money(diag.esenciales_total)}** (${diag.esenciales_porcentaje}% del gasto total).\n` +
                   `• **Gastos No Esenciales / Ocio:** **${this.money(diag.no_esenciales_total)}** (${diag.no_esenciales_porcentaje}% del gasto total).\n` +
                   `• **Tasa de Ahorro del periodo:** **${target.tasa_ahorro_porcentaje}%** (Margen neto: ${this.money(target.balance_neto)}).\n` +
                   `• **Gasto promedio diario:** **${this.money(target.promedio_gasto_diario)} / día**.\n\n` +
                   `🎯 **Diagnóstico:** ${diag.no_esenciales_porcentaje > 35 ? 'Tus gastos no esenciales superan el 35%. Conviene moderar consumos discrecionales.' : 'Excelente disciplina: la mayor parte de tu capital se destina a compromisos indispensables.'}`;

      return {
        id: 'bot_' + Date.now(),
        sender: 'bot',
        text,
        timestamp: this.formatCurrentTime(),
        dataPoints: [
          { label: 'Esenciales', value: `${diag.esenciales_porcentaje}%` },
          { label: 'No Esenciales', value: `${diag.no_esenciales_porcentaje}%` },
          { label: 'Tasa Ahorro', value: `${target.tasa_ahorro_porcentaje}%` }
        ]
      };
    }

    // E. CONSULTAS SOBRE HISTORIAL O EVOLUCIÓN DE MESES
    if (/historico|histórico|ultimos meses|últimos meses|meses anteriores|evolucion|evolución/i.test(lowerQuery)) {
      const hist = stats.historico_reciente_meses || [];
      let text = `📊 **Historial de Ingresos y Gastos de los Últimos Meses:**\n\n`;
      hist.forEach((h: any) => {
        text += `• **${h.nombre}:** Gastos **${this.money(h.gastos)}** | Ingresos ${this.money(h.ingresos)} | Balance: **${this.money(h.balance)}**\n`;
      });
      text += `\n💡 Si deseas el desglose de algún mes específico, pregúntame por ejemplo: *"¿En qué gasté el mes pasado?"*`;

      return {
        id: 'bot_' + Date.now(),
        sender: 'bot',
        text,
        timestamp: this.formatCurrentTime(),
        dataPoints: hist.slice(0, 3).map((h: any) => ({ label: h.nombre, value: this.money(h.gastos) }))
      };
    }

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
                 `   - En Préstamos a Plazos: ${this.money(consolidated.loansDebt)}\n` +
                 `   - En Tarjetas de Crédito: ${this.money(consolidated.creditCardsDebt)}\n\n`;

      if (loans.length > 0) {
        text += `📋 **Tus préstamos activos:**\n`;
        loans.forEach(l => {
          const rest = Math.max(0, (l.total || 0) - (l.pagado || 0));
          text += `• **${l.name}:** Saldo restante de ${this.money(rest)} (Cuota mensual: ${this.money(l.cuota || 0)})\n`;
        });
        text += `\n`;
      }

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

    // 7. CONSULTA SOBRE CATEGORÍAS DE GASTOS / EN QUÉ HE GASTADO
    if (/en que he gastado|en qué he gastado|gastos|categoria|categorías|fuga|en que se va/i.test(lowerQuery)) {
      const isLastMonth = /mes anterior|mes pasado/i.test(lowerQuery);
      const target = isLastMonth ? periodoAnterior : periodoActual;
      const cats = target.categorias_desglose;

      if (cats.length === 0) {
        return {
          id: 'bot_' + Date.now(),
          sender: 'bot',
          text: `Aún no tienes gastos registrados en **${target.nombre_mes}** para analizar.`,
          timestamp: this.formatCurrentTime()
        };
      }

      let text = `🛍️ **Desglose de tus Gastos por Categoría en ${target.nombre_mes} (${this.money(target.gastos_totales)}):**\n\n`;
      cats.slice(0, 5).forEach((item: any, idx: number) => {
        text += `${idx + 1}. **${item.categoria}:** ${this.money(item.monto)} (${item.porcentaje}%)\n`;
      });

      return {
        id: 'bot_' + Date.now(),
        sender: 'bot',
        text,
        timestamp: this.formatCurrentTime(),
        dataPoints: cats.slice(0, 3).map((item: any) => ({ label: item.categoria, value: this.money(item.monto) }))
      };
    }

    // 8. RESPUESTA INTELIGENTE GENERAL DE RESPALDO
    return {
      id: 'bot_' + Date.now(),
      sender: 'bot',
      text: `Entendido tu consulta: "${query}".\n\n` +
            `En este mes (**${periodoActual.nombre_mes}**) llevas **${this.money(periodoActual.gastos_totales)}** en gastos acumulados y dispones de **${this.money(saldoDisponible)}** en saldo libre propio, con **${this.money(totalDueNext7Days)}** programados para los próximos 7 días.\n\n` +
            `¿Deseas revisar estadísticas detalladas, gastos en conceptos puntuales (gasolina, súper, restaurantes), tarjetas de crédito o comparar con el mes anterior?`,
      timestamp: this.formatCurrentTime(),
      dataPoints: [
        { label: 'Saldo Libre', value: this.money(saldoDisponible) },
        { label: `Gastos ${periodoActual.nombre_mes}`, value: this.money(periodoActual.gastos_totales) }
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
