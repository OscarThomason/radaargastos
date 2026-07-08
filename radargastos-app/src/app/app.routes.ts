import { Routes } from '@angular/router';
import { ResumenComponent } from './features/resumen/resumen.component';
import { DeudasComponent } from './features/deudas/deudas.component';
import { ServiciosComponent } from './features/servicios/servicios.component';
import { GastosComponent } from './features/gastos/gastos.component';
import { EstadisticasComponent } from './features/estadisticas/estadisticas.component';

export const routes: Routes = [
  { path: '', redirectTo: 'resumen', pathMatch: 'full' },
  { path: 'resumen', component: ResumenComponent },
  { path: 'deudas', component: DeudasComponent },
  { path: 'servicios', component: ServiciosComponent },
  { path: 'gastos', component: GastosComponent },
  { path: 'estadisticas', component: EstadisticasComponent },
  { path: '**', redirectTo: 'resumen' }
];
