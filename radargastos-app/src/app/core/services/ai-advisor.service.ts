import { Injectable } from '@angular/core';
import { Expense, Income, Debt, EssentialAnalysis, EssentialCategoryGroup, AiInsight, N8nAgentResponse } from '../models/finance.model';

@Injectable({
  providedIn: 'root'
})
export class AiAdvisorService {
  readonly n8nWebhookUrl = 'https://n8n-n8n.bg5sbc.easypanel.host/webhook/401316c1-d12f-49ef-94a8-ed3fc88c72bb';

  private essentialCategories = [
    'servicios', 'deudas', 'transporte', 'alimentos', 'salud',
    'nutricion y gym', 'casa', 'mascota', 'renta', 'supermercado'
  ];

  /**
   * Consulta el Agente n8n FinOps para análisis de gasto o consulta pre-compra
   */
  async queryN8nAgent(payload: {
    tipo_solicitud: 'analisis_gasto' | 'consulta_compra';
    descripcion?: string;
    pregunta?: string;
    monto?: number | string;
    moneda?: string;
    fecha?: string;
    metodo_pago?: string;
    notas?: string;
    categorias_validas?: string;
  }): Promise<N8nAgentResponse | null> {
    try {
      const defaultCategories = ['Servicios', 'Deudas', 'Transporte', 'Alimentos', 'Restaurantes', 'Oscio', 'Salud', 'nutricion y gym', 'ropa o accesorios', 'casa', 'viaje', 'mascota', 'Otros'];
      const categoriasValidas = payload.categorias_validas || defaultCategories.join(', ');

      const response = await fetch(this.n8nWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo_solicitud: payload.tipo_solicitud,
          descripcion: payload.descripcion || payload.pregunta || '',
          pregunta: payload.pregunta || payload.descripcion || '',
          monto: payload.monto ? String(payload.monto) : 'No especificado',
          moneda: payload.moneda || 'MXN',
          fecha: payload.fecha || new Date().toISOString().slice(0, 10),
          metodo_pago: payload.metodo_pago || 'No especificado',
          notas: payload.notas || 'Sin notas',
          categorias_validas: categoriasValidas
        })
      });

      if (!response.ok) {
        throw new Error(`n8n HTTP ${response.status}`);
      }

      const text = await response.text();
      let json: any;

      try {
        json = JSON.parse(text);
      } catch {
        // En caso de que venga envuelto en formato markdown ```json ... ```
        const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
        json = JSON.parse(cleanText);
      }

      if (Array.isArray(json) && json.length > 0) {
        json = json[0].json || json[0];
      } else if (json.json) {
        json = json.json;
      }

      return json as N8nAgentResponse;
    } catch (error) {
      console.warn('Advertencia: El webhook de n8n no respondió o devolvió un formato no válido:', error);
      return null;
    }
  }

  /**
   * Mapea la categoría textual enviada por n8n a una de las categorías estándar de la App
   */
  mapN8nCategoryToAppCategory(n8nCategory?: string): string {
    if (!n8nCategory) return 'Otros';
    const clean = n8nCategory.toLowerCase().trim();

    if (clean.includes('servicio') || clean.includes('vivienda')) return 'Servicios';
    if (clean.includes('deuda') || clean.includes('financier')) return 'Deudas';
    if (clean.includes('transporte') || clean.includes('movilidad') || clean.includes('auto') || clean.includes('uber')) return 'Transporte';
    if (clean.includes('básica') || clean.includes('super') || clean.includes('alimentación') || clean.includes('despensa')) return 'Alimentos';
    if (clean.includes('restaurante') || clean.includes('fuera') || clean.includes('delivery')) return 'Restaurantes';
    if (clean.includes('ocio') || clean.includes('suscrip') || clean.includes('digital') || clean.includes('entretenimiento')) return 'Oscio';
    if (clean.includes('salud') || clean.includes('bienestar') || clean.includes('farmacia')) return 'Salud';
    if (clean.includes('ropa') || clean.includes('cuidado') || clean.includes('vestimenta')) return 'ropa o accesorios';
    if (clean.includes('casa') || clean.includes('mantenimiento') || clean.includes('hogar')) return 'casa';
    if (clean.includes('viaje') || clean.includes('hotel') || clean.includes('vuelo')) return 'viaje';
    if (clean.includes('mascota') || clean.includes('perro') || clean.includes('gato')) return 'mascota';

    return 'Otros';
  }

  /**
   * Asesor Pre-Compra (Modo 2: consulta_compra)
   */
  async askPrePurchaseAdvice(pregunta: string, monto?: number, notas?: string): Promise<N8nAgentResponse | null> {
    return this.queryN8nAgent({
      tipo_solicitud: 'consulta_compra',
      pregunta,
      monto,
      notas
    });
  }

  isEssential(categoryName?: string): boolean {
    if (!categoryName) return false;
    const clean = categoryName.trim().toLowerCase();
    return this.essentialCategories.some(cat => clean.includes(cat));
  }

  analyzeEssentialVsNonEssential(expenses: Expense[]): EssentialAnalysis {
    let essentialTotal = 0;
    let nonEssentialTotal = 0;

    const essentialMap: { [cat: string]: number } = {};
    const nonEssentialMap: { [cat: string]: number } = {};

    expenses.forEach(e => {
      const cat = e.category || 'Otros';
      const isEss = this.isEssential(cat);

      if (isEss) {
        essentialTotal += e.amount;
        essentialMap[cat] = (essentialMap[cat] || 0) + e.amount;
      } else {
        nonEssentialTotal += e.amount;
        nonEssentialMap[cat] = (nonEssentialMap[cat] || 0) + e.amount;
      }
    });

    const grandTotal = essentialTotal + nonEssentialTotal;
    const essentialPercent = grandTotal > 0 ? Math.round((essentialTotal / grandTotal) * 100) : 0;
    const nonEssentialPercent = grandTotal > 0 ? Math.round((nonEssentialTotal / grandTotal) * 100) : 0;

    const mapToGroups = (map: { [cat: string]: number }, total: number): EssentialCategoryGroup[] => {
      return Object.keys(map)
        .map(name => ({
          name,
          amount: map[name],
          percent: total > 0 ? Math.round((map[name] / total) * 100) : 0
        }))
        .sort((a, b) => b.amount - a.amount);
    };

    return {
      essentialTotal,
      nonEssentialTotal,
      essentialPercent,
      nonEssentialPercent,
      essentialCategories: mapToGroups(essentialMap, essentialTotal),
      nonEssentialCategories: mapToGroups(nonEssentialMap, nonEssentialTotal)
    };
  }

  generateInsights(expenses: Expense[], incomes: Income[], debts: Debt[], monthLabel: string): AiInsight[] {
    const insights: AiInsight[] = [];
    const analysis = this.analyzeEssentialVsNonEssential(expenses);

    const totalExp = expenses.reduce((acc, e) => acc + e.amount, 0);
    const totalInc = incomes.reduce((acc, i) => acc + i.amount, 0);

    // 1. Diagnóstico de Gastos No Esenciales
    if (analysis.nonEssentialTotal > 0 && totalExp > 0) {
      if (analysis.nonEssentialPercent > 35) {
        insights.push({
          id: 'non-essential-warning',
          type: 'warning',
          title: 'Alto consumo en gastos prescindibles',
          description: `El ${analysis.nonEssentialPercent}% de tus gastos en ${monthLabel} ($${analysis.nonEssentialTotal.toLocaleString('es-MX', {minimumFractionDigits:2})}) corresponden a conceptos no esenciales (ocio, restaurantes, compras).`,
          impactAmount: Math.round(analysis.nonEssentialTotal * 0.2),
          icon: 'warning'
        });
      } else {
        insights.push({
          id: 'essential-balance-good',
          type: 'success',
          title: 'Excelente control de gastos esenciales',
          description: `El ${analysis.essentialPercent}% de tu capital se destina a necesidades prioritarias (alimentos, servicios, transporte). ¡Vas por muy buen camino!`,
          icon: 'check_circle'
        });
      }
    }

    // 2. Oportunidad de Ahorro (Plan de recolección de sobrantes)
    if (analysis.nonEssentialTotal > 0) {
      const potentialSavings = Math.round(analysis.nonEssentialTotal * 0.25);
      insights.push({
        id: 'potential-savings',
        type: 'opportunity',
        title: 'Oportunidad de Ahorro Estimada',
        description: `Si optimizas un 25% de tus compras en categorías no esenciales (como ${analysis.nonEssentialCategories.slice(0, 2).map(c => c.name).join(', ')}), podrías recuperar $${potentialSavings.toLocaleString('es-MX', {minimumFractionDigits:2})} este mes.`,
        impactAmount: potentialSavings,
        icon: 'savings'
      });
    }

    // 3. Balance de Ingresos vs Gastos
    if (totalInc > 0) {
      const deficit = totalExp - totalInc;
      if (deficit > 0) {
        insights.push({
          id: 'deficit-alert',
          type: 'warning',
          title: 'Superas tus ingresos del mes',
          description: `Tus gastos acumulados en ${monthLabel} superan tus ingresos por $${deficit.toLocaleString('es-MX', {minimumFractionDigits:2})}. Procura limitar nuevos consumos no prioritarios.`,
          icon: 'trending_down'
        });
      } else {
        const remaining = totalInc - totalExp;
        const savingRate = Math.round((remaining / totalInc) * 100);
        insights.push({
          id: 'savings-rate',
          type: 'success',
          title: `Tasa de Ahorro proyectada: ${savingRate}%`,
          description: `Te quedan $${remaining.toLocaleString('es-MX', {minimumFractionDigits:2})} libres de tu ingreso del mes. Te recomendamos destinar una parte a tu fondo de emergencia o abono a deudas.`,
          icon: 'insights'
        });
      }
    }

    // 4. Diagnóstico de Deudas Activas
    const activeDebts = debts.filter(d => (d.group === 'prestamo' ? (d.total || 0) - (d.pagado || 0) > 0 : (d.debt || 0) > 0));
    if (activeDebts.length > 0) {
      const topCatDebt = activeDebts.sort((a, b) => (b.cat || 0) - (a.cat || 0))[0];
      if (topCatDebt && topCatDebt.cat) {
        insights.push({
          id: 'high-cat-debt',
          type: 'tip',
          title: `Estrategia de Deudas: Prioriza ${topCatDebt.name}`,
          description: `La deuda "${topCatDebt.name}" genera el mayor interés (CAT ${topCatDebt.cat}%). Te sugerimos aplicar abonos a capital prioritarios en esta tarjeta o préstamo.`,
          icon: 'lightbulb'
        });
      }
    }

    return insights;
  }
}
