# Reglas del Proyecto RadarGastos

## Manejo de Préstamos por Cobrar y Liquidez
Cuando el usuario registre o consulte dinero prestado a terceros:
1. **Separación de capital:** Mantén el dinero prestado fuera de los "Ingresos Reales Disponibles". Regístralo bajo la etiqueta **"Préstamos por Cobrar"**.
2. **Impacto de liquidación:** 
   - Mientras no se pague: permanece visible únicamente como saldo pendiente por cobrar.
   - En cuanto se reciba el pago o abono: descuenta de inmediato ese monto de **"Préstamos por Cobrar"** e intégralo al **"Saldo Disponible / Ingreso Recuperado"** para el cálculo de flujo de efectivo.
3. **Criterio de análisis:** No consideres el dinero por cobrar como saldo disponible para gastos o compras inmediatas hasta que no esté efectivamente liquidado.
