import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="login-container" [class.is-dark]="themeService.darkMode()">
      <!-- Botón flotante para alternar tema solo si no hay header activo -->
      @if (!authService.userSignal()) {
        <button 
          type="button" 
          class="theme-toggle-floating" 
          (click)="themeService.toggleTheme()" 
          [attr.aria-label]="themeService.darkMode() ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
          [title]="themeService.darkMode() ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'">
          <span class="material-symbols-outlined">{{ themeService.darkMode() ? 'light_mode' : 'dark_mode' }}</span>
          <span class="toggle-text">{{ themeService.darkMode() ? 'Modo Claro' : 'Modo Oscuro' }}</span>
        </button>
      }

      <div class="notebook-page slide-in" [class.dark-notebook]="themeService.darkMode()">
        <!-- Binder holes simulation -->
        <div class="holes">
          <div class="hole"></div>
          <div class="hole"></div>
          <div class="hole"></div>
          <div class="hole"></div>
          <div class="hole"></div>
        </div>

        <div class="content">
          <h1 class="logo">Radar de Pagos</h1>
          <h2 class="subtitle">Tu libreta de apoyo para tus gastos e ingresos.</h2>
          
          @if (!isLoading) {
            <button class="btn-google" (click)="login()">
              <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google">
              Continuar con Google
            </button>
          } @else {
            <div class="loader-container">
              <span class="material-symbols-outlined draw-anim">edit</span>
              <div class="draw-line"></div>
              <p class="loading-text">Abriendo libreta...</p>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
      overflow: hidden;
      position: relative;
    }

    /* Botón flotante de alternar tema en la portada */
    .theme-toggle-floating {
      position: absolute;
      top: 24px;
      right: 24px;
      z-index: 10;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      background: var(--surface, #FFFFFF);
      color: var(--text, #0F172A);
      border: 2px solid var(--border-strong, #0F172A);
      border-radius: 9999px;
      font-family: 'Sora', sans-serif;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 3px 3px 0px var(--border-strong, #0F172A);
      transition: all 0.2s ease;

      .material-symbols-outlined {
        font-size: 18px;
      }

      &:hover {
        transform: translate(-1px, -1px);
        box-shadow: 4px 4px 0px var(--border-strong, #0F172A);
      }

      &:active {
        transform: translate(2px, 2px);
        box-shadow: 1px 1px 0px var(--border-strong, #0F172A);
      }
    }

    .is-dark .theme-toggle-floating {
      background: #111827;
      color: #F8FAFC;
      border-color: rgba(255, 255, 255, 0.25);
      box-shadow: 3px 3px 0px #030712;

      &:hover {
        border-color: #FFFFFF;
        box-shadow: 4px 4px 0px rgba(255, 255, 255, 0.2);
      }
    }
    
    .notebook-page {
      position: relative;
      padding: 60px 40px 60px 70px;
      max-width: 450px;
      width: 100%;
      text-align: center;
      transform: rotate(-2deg);
      transition: transform 0.3s, background-color 0.25s, border-color 0.25s, box-shadow 0.25s;
    }

    /* MODO CLARO (Libreta blanca tradicional) */
    .notebook-page:not(.dark-notebook) {
      background-color: #FFFFFF;
      background-image: 
        linear-gradient(90deg, transparent 40px, #E53935 40px, #E53935 42px, transparent 42px),
        linear-gradient(rgba(0, 0, 0, 0.06) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0, 0, 0, 0.06) 1px, transparent 1px);
      background-size: 100% 100%, 24px 24px, 24px 24px;
      background-position: left top;
      border: 2px solid #0F172A;
      box-shadow: 12px 12px 0px rgba(0, 0, 0, 1);

      .content {
        background: rgba(255, 255, 255, 0.92);
        border: 2px dashed rgba(0, 0, 0, 0.15);
      }

      .logo {
        color: #0F172A;
      }

      .subtitle {
        color: #475569;
      }

      .hole {
        background: var(--bg, #F8FAFC);
        border: 2px solid #0F172A;
        box-shadow: inset 2px 2px 0 rgba(0, 0, 0, 0.1);
      }

      .btn-google {
        background: #FFFFFF;
        color: #0F172A;
        border: 2px solid #0F172A;
        box-shadow: 4px 4px 0px #0F172A;

        &:hover {
          background: #F1F5F9;
        }
      }

      .draw-anim,
      .draw-line {
        color: #0F172A;
        background: #0F172A;
      }

      .loading-text {
        color: #475569;
      }
    }

    /* MODO OSCURO (Libreta grafito / carbón premium) */
    .notebook-page.dark-notebook {
      background-color: #111827;
      background-image: 
        linear-gradient(90deg, transparent 40px, #EF4444 40px, #EF4444 42px, transparent 42px),
        linear-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.07) 1px, transparent 1px);
      background-size: 100% 100%, 24px 24px, 24px 24px;
      background-position: left top;
      border: 2px solid rgba(255, 255, 255, 0.22);
      box-shadow: 12px 12px 0px #030712, 0 16px 36px rgba(0, 0, 0, 0.6);

      .content {
        background: rgba(17, 24, 39, 0.90);
        border: 2px dashed rgba(255, 255, 255, 0.18);
      }

      .logo {
        color: #F8FAFC;
        text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
      }

      .subtitle {
        color: #94A3B8;
      }

      .hole {
        background: #090D16;
        border: 2px solid rgba(255, 255, 255, 0.3);
        box-shadow: inset 2px 2px 0 rgba(0, 0, 0, 0.5);
      }

      /* Inversión en modo oscuro: botón Google con fondo blanco y texto oscuro */
      .btn-google {
        background: #FFFFFF;
        color: #090D16;
        border: 2px solid #FFFFFF;
        box-shadow: 4px 4px 0px rgba(255, 255, 255, 0.25);

        &:hover {
          background: #E2E8F0;
        }
      }

      .draw-anim {
        color: #F8FAFC;
      }

      .draw-line {
        background: #F8FAFC;
      }

      .loading-text {
        color: #94A3B8;
      }
    }

    .notebook-page:hover {
      transform: rotate(0deg);
    }

    .slide-in {
      animation: slideDownFade 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    }

    @keyframes slideDownFade {
      0% { opacity: 0; transform: translateY(-50px) rotate(-10deg); }
      100% { opacity: 1; transform: translateY(0) rotate(-2deg); }
    }

    .holes {
      position: absolute;
      left: 15px;
      top: 0;
      bottom: 0;
      display: flex;
      flex-direction: column;
      justify-content: space-evenly;
    }

    .hole {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      transition: background 0.25s, border-color 0.25s;
    }

    .content {
      position: relative;
      z-index: 2;
      padding: 24px 20px;
      border-radius: 8px;
      transition: background 0.25s, border-color 0.25s;
    }

    .logo {
      font-size: 32px;
      margin-top: 0;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: -0.05em;
      font-weight: 800;
      transition: color 0.25s;
    }

    .subtitle {
      font-size: 17px;
      font-weight: 500;
      margin-bottom: 36px;
      line-height: 1.4;
      font-style: italic;
      transition: color 0.25s;
    }

    .btn-google {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      width: 100%;
      font-weight: 700;
      font-size: 15px;
      padding: 14px;
      cursor: pointer;
      font-family: 'Sora', sans-serif;
      transition: all 0.2s;
    }

    .btn-google:active {
      transform: translate(2px, 2px);
    }

    .btn-google img {
      width: 24px;
      height: 24px;
    }

    /* Animación de carga creativa (Lápiz dibujando) */
    .loader-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-top: 20px;
      height: 80px;
    }

    .draw-anim {
      font-size: 30px;
      animation: scribble 1.5s infinite alternate ease-in-out;
      transform-origin: bottom left;
    }

    .draw-line {
      width: 0%;
      height: 3px;
      margin-top: -5px;
      border-radius: 3px;
      animation: drawLine 1.5s infinite alternate ease-in-out;
    }

    .loading-text {
      margin-top: 15px;
      font-weight: 600;
      animation: pulse 1s infinite alternate;
    }

    @keyframes scribble {
      0% { transform: translateX(-40px) rotate(-15deg); }
      20% { transform: translateX(-20px) rotate(5deg); }
      40% { transform: translateX(0px) rotate(-10deg); }
      60% { transform: translateX(20px) rotate(15deg); }
      80% { transform: translateX(30px) rotate(-5deg); }
      100% { transform: translateX(40px) rotate(10deg); }
    }

    @keyframes drawLine {
      0% { width: 0%; margin-left: -80px; }
      100% { width: 80px; margin-left: 0; }
    }

    @keyframes pulse {
      0% { opacity: 0.6; }
      100% { opacity: 1; }
    }

    @media (max-width: 768px) {
      .theme-toggle-floating {
        top: 16px;
        right: 16px;
        padding: 8px 12px;

        .toggle-text {
          display: none;
        }
      }

      .notebook-page {
        padding: 40px 15px 40px 30px;
        box-shadow: 6px 6px 0px rgba(0,0,0,1);
        border-width: 1.5px;
      }

      .notebook-page:not(.dark-notebook) {
        background-image: 
          linear-gradient(90deg, transparent 15px, #E53935 15px, #E53935 17px, transparent 17px),
          linear-gradient(rgba(0,0,0,0.06) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px);
      }

      .notebook-page.dark-notebook {
        background-image: 
          linear-gradient(90deg, transparent 15px, #EF4444 15px, #EF4444 17px, transparent 17px),
          linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px);
        box-shadow: 6px 6px 0px #030712;
      }

      .logo {
        font-size: 24px;
      }

      .subtitle {
        font-size: 15px;
        margin-bottom: 24px;
      }

      .btn-google {
        font-size: 14px;
        padding: 12px;
      }

      .holes {
        left: 4px;
      }

      .hole {
        width: 8px;
        height: 8px;
      }

      .draw-anim {
        animation: scribble-mobile 1.5s infinite alternate ease-in-out;
      }

      .draw-line {
        animation: drawLine-mobile 1.5s infinite alternate ease-in-out;
      }
    }

    @keyframes scribble-mobile {
      0% { transform: translateX(-20px) rotate(-10deg); }
      50% { transform: translateX(0px) rotate(-5deg); }
      100% { transform: translateX(20px) rotate(10deg); }
    }

    @keyframes drawLine-mobile {
      0% { width: 0%; margin-left: -40px; }
      100% { width: 40px; margin-left: 0; }
    }
  `]
})
export class LoginComponent {
  authService = inject(AuthService);
  themeService = inject(ThemeService);
  isLoading = false;

  login() {
    this.isLoading = true;
    setTimeout(() => {
      this.authService.loginWithGoogle();
    }, 800);
  }
}

