import { Component, inject, computed } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FinanceService } from '../../services/finance.service';
import { CalendarService } from '../../services/calendar.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  authService = inject(AuthService);
  private financeService = inject(FinanceService);
  private calendarService = inject(CalendarService);

  lastModification = computed(() => {
    const history = this.financeService.state().history;
    if (history && history.length > 0) {
      // timestamp tiene formato "14/07/2026 17:30"
      // Solo queremos extraer la hora
      const timePart = history[0].timestamp.split(' ')[1];
      return timePart;
    }
    return null;
  });

  get todayStr(): string {
    const d = new Date();
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day} / ${month} / ${year}`;
  }

  logout() {
    this.authService.logout();
  }

  async syncCalendar() {
    await this.calendarService.syncToCalendar();
  }
}
