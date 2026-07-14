import { Routes } from '@angular/router';
import { ResumenComponent } from './features/resumen/resumen.component';
import { DeudasComponent } from './features/deudas/deudas.component';
import { ServiciosComponent } from './features/servicios/servicios.component';
import { GastosComponent } from './features/gastos/gastos.component';
import { EstadisticasComponent } from './features/estadisticas/estadisticas.component';
import { AjustesComponent } from './features/ajustes/ajustes.component';

import { LoginComponent } from './features/auth/login.component';
import { authGuard } from './core/services/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'resumen', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'resumen', component: ResumenComponent, canActivate: [authGuard] },
  { path: 'deudas', component: DeudasComponent, canActivate: [authGuard] },
  { path: 'servicios', component: ServiciosComponent, canActivate: [authGuard] },
  { path: 'gastos', component: GastosComponent, canActivate: [authGuard] },
  { path: 'estadisticas', component: EstadisticasComponent, canActivate: [authGuard] },
  { path: 'ajustes', component: AjustesComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: 'resumen' }
];
