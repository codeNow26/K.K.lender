import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Calendar } from './calendar/calendar';
import { AudioService } from './services/audio.service';
import { SupabaseService } from './services/supabase.service';

@Component({
  selector: 'app-root',
  imports: [FormsModule, Calendar],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly auth = inject(SupabaseService);
  readonly audio = inject(AudioService);

  constructor() {
    effect(() => {
      this.audio.setScreen(
        this.auth.isInitializing() ? null : this.auth.session() ? 'calendar' : 'login',
      );
    });
  }

  readonly isBusy = signal(false);
  readonly errorMessage = signal('');

  email = '';
  password = '';

  async login(): Promise<void> {
    if (this.isBusy() || !this.email.trim() || !this.password) {
      return;
    }

    this.audio.playLoginSound();
    this.isBusy.set(true);
    this.errorMessage.set('');

    try {
      await this.auth.signIn(this.email, this.password);
      this.password = '';
    } catch (error: unknown) {
      const code = this.getErrorCode(error);

      if (code === 'invalid_credentials') {
        this.errorMessage.set('E-Mail oder Passwort stimmt nicht.');
      } else if (code === 'email_not_confirmed') {
        this.errorMessage.set('Deine E-Mail-Adresse ist noch nicht bestätigt.');
      } else {
        this.errorMessage.set(
          'Die Anmeldung hat nicht geklappt. Prüfe deine Verbindung und versuche es erneut.',
        );
      }
    } finally {
      this.isBusy.set(false);
    }
  }

  async logout(): Promise<void> {
    if (this.isBusy()) {
      return;
    }

    this.isBusy.set(true);
    this.errorMessage.set('');

    try {
      await this.auth.signOut();
      this.password = '';
    } catch {
      this.errorMessage.set('Die Abmeldung hat nicht geklappt. Bitte versuche es erneut.');
    } finally {
      this.isBusy.set(false);
    }
  }

  private getErrorCode(error: unknown): string | undefined {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string'
    ) {
      return error.code;
    }

    return undefined;
  }
}
