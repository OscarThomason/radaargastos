import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="login-container">
      <div class="login-card">
        <h1 class="logo">Radar de Pagos</h1>
        <p class="subtitle">Inicia sesión para gestionar tus finanzas personales y sincronizar tu información.</p>
        
        <button class="btn-google" (click)="login()">
          <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google">
          Continuar con Google
        </button>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: var(--bg);
      padding: 20px;
    }
    .login-card {
      background: var(--surface);
      border: 1px solid var(--border);
      padding: 40px;
      max-width: 400px;
      width: 100%;
      text-align: center;
      box-shadow: 4px 4px 0px var(--border);
    }
    .logo {
      font-size: 28px;
      margin-top: 0;
      margin-bottom: 12px;
      color: var(--text);
    }
    .subtitle {
      color: var(--text-muted);
      font-size: 14px;
      margin-bottom: 30px;
      line-height: 1.5;
    }
    .btn-google {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      width: 100%;
      background: var(--surface);
      color: var(--text);
      border: 1px solid var(--border);
      font-weight: 600;
      font-size: 14px;
      padding: 12px;
      cursor: pointer;
      font-family: 'Inter', sans-serif;
      transition: background 0.2s;
    }
    .btn-google:hover {
      background: var(--surface2);
    }
    .btn-google img {
      width: 20px;
      height: 20px;
    }
  `]
})
export class LoginComponent {
  authService = inject(AuthService);

  login() {
    this.authService.loginWithGoogle();
  }
}
