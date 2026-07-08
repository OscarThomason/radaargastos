import { Injectable, inject, signal } from '@angular/core';
import { Auth, GoogleAuthProvider, signInWithPopup, signOut, user, User } from '@angular/fire/auth';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth = inject(Auth);
  private router = inject(Router);

  // Observable of the current user
  currentUser$ = user(this.auth);
  
  // Signal representation for easy consumption in components
  userSignal = signal<User | null>(null);

  constructor() {
    this.currentUser$.subscribe(u => {
      this.userSignal.set(u);
    });
  }

  async loginWithGoogle() {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(this.auth, provider);
      this.router.navigate(['/']);
    } catch (error) {
      console.error('Login error:', error);
      alert('Error al iniciar sesión con Google.');
    }
  }

  async logout() {
    try {
      await signOut(this.auth);
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
}
