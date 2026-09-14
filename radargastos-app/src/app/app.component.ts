import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './core/components/header/header.component';
import { ChatbotModalComponent } from './core/components/chatbot-modal/chatbot-modal.component';
import { AuthService } from './core/services/auth.service';
import { FinanceService } from './core/services/finance.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, ChatbotModalComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  authService = inject(AuthService);
  financeService = inject(FinanceService);
}
