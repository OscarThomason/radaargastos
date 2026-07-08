import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="login-container">
      <div class="notebook-page slide-in">
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
      /* Eliminar cualquier background porque se hereda del body global que ya tiene el patron */
      padding: 20px;
      overflow: hidden;
    }
    
    .notebook-page {
      position: relative;
      background-color: #FFFFFF;
      background-image: 
        linear-gradient(90deg, transparent 40px, #E53935 40px, #E53935 42px, transparent 42px),
        linear-gradient(rgba(0,0,0,0.06) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px);
      background-size: 100% 100%, 24px 24px, 24px 24px;
      background-position: left top;
      
      padding: 60px 40px 60px 70px;
      max-width: 450px;
      width: 100%;
      text-align: center;
      border: 2px solid var(--border);
      box-shadow: 12px 12px 0px rgba(0,0,0,1);
      transform: rotate(-2deg);
      transition: transform 0.3s;
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
      background: var(--bg);
      border-radius: 50%;
      border: 2px solid var(--border);
      box-shadow: inset 2px 2px 0 rgba(0,0,0,0.1);
    }

    .content {
      position: relative;
      z-index: 2;
      background: rgba(255,255,255,0.85); /* Legibilidad extra sobre la cuadricula */
      padding: 20px;
      border-radius: 8px;
      border: 2px dashed rgba(0,0,0,0.1);
    }

    .logo {
      font-size: 32px;
      margin-top: 0;
      margin-bottom: 12px;
      color: var(--text);
      text-transform: uppercase;
      letter-spacing: -0.05em;
    }

    .subtitle {
      color: var(--text);
      font-size: 18px;
      font-weight: 500;
      margin-bottom: 40px;
      line-height: 1.4;
      font-style: italic;
    }

    .btn-google {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      width: 100%;
      background: var(--surface);
      color: var(--text);
      border: 2px solid var(--border);
      font-weight: 700;
      font-size: 15px;
      padding: 14px;
      cursor: pointer;
      font-family: 'Inter', sans-serif;
      transition: all 0.2s;
      box-shadow: 4px 4px 0px var(--border);
    }

    .btn-google:active {
      transform: translate(2px, 2px);
      box-shadow: 2px 2px 0px var(--border);
    }

    .btn-google:hover {
      background: #f8f8f8;
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
      color: var(--text);
      animation: scribble 1.5s infinite alternate ease-in-out;
      transform-origin: bottom left;
    }

    .draw-line {
      width: 0%;
      height: 3px;
      background: var(--text);
      margin-top: -5px;
      border-radius: 3px;
      animation: drawLine 1.5s infinite alternate ease-in-out;
    }

    .loading-text {
      margin-top: 15px;
      font-weight: 600;
      color: var(--text-muted);
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
      .notebook-page {
        padding: 40px 20px 40px 50px;
        background-image: 
          linear-gradient(90deg, transparent 20px, #E53935 20px, #E53935 22px, transparent 22px),
          linear-gradient(rgba(0,0,0,0.06) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px);
      }
      .holes {
        left: 5px;
      }
    }
  `]
})
export class LoginComponent {
  authService = inject(AuthService);
  isLoading = false;

  login() {
    this.isLoading = true;
    // Agregamos un ligero delay visual para que se aprecie la animación antes de que Google tome el control
    setTimeout(() => {
      this.authService.loginWithGoogle();
    }, 800);
  }
}
