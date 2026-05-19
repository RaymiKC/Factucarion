import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { LayoutComponent } from './components/layout.component';
import { AuthService } from './services/auth.service';
import { ThemeService } from './services/theme.service';
import { PermissionsService } from './services/permissions.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, LayoutComponent],
  template: `
    <ng-container *ngIf="auth.isAuthenticated(); else loginView">
      <app-layout [activePage]="activePage()" (pageChange)="navigate($event)" (logoutEvent)="router.navigate(['/login'])">
        <router-outlet></router-outlet>
      </app-layout>
    </ng-container>
    <ng-template #loginView>
      <router-outlet></router-outlet>
    </ng-template>
  `
})
export class App implements OnInit {
  activePage = signal('dashboard');

  constructor(public auth: AuthService, public router: Router, private theme: ThemeService, private perms: PermissionsService) {}

  ngOnInit() {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe((e) => {
      const url = (e as NavigationEnd).urlAfterRedirects;
      const seg = url.split('/').filter(Boolean)[0] ?? 'dashboard';
      this.activePage.set(seg);
    });

    const u = this.auth.user();
    if (u) {
      this.perms.load(u.id, u.role);
      if (u.preferredTheme) this.theme.setTheme(u.preferredTheme as 'light' | 'dark' | 'system');
    }
  }

  navigate(page: string) {
    this.activePage.set(page);
    this.router.navigate(['/' + page]);
  }
}
