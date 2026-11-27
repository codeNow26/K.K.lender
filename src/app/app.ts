import { Component, HostListener, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Calendar } from './calendar/calendar';
import { AnimaleseService } from './services/animalese.service';
import { AudioService } from './services/audio.service';
import { SupabaseService } from './services/supabase.service';
import { PushService } from './services/push.service';
import { BalloonGift } from './balloon-gift/balloon-gift';

interface InstallPromptEvent extends Event {
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

@Component({
  selector: 'app-root',
  imports: [FormsModule, Calendar, BalloonGift],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly auth = inject(SupabaseService);
  readonly audio = inject(AudioService);
  readonly animalese = inject(AnimaleseService);
  readonly push = inject(PushService);

  private installPrompt: InstallPromptEvent | null = null;
  readonly installRequested = signal(
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('install') === '1' &&
    !window.matchMedia('(display-mode: standalone)').matches
  );
  readonly installHelp = signal(false);
  readonly installReady = signal(false);
  private readonly isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

  openInChrome(): void {
    const url = new URL(window.location.href);
    url.searchParams.set('install', '1');
    url.searchParams.set('chrome', '1');
    const fallback = encodeURIComponent(url.href);
    window.location.href = 'intent://' + url.host + url.pathname + url.search +
      '#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=' + fallback + ';end';
  }

  @HostListener('window:beforeinstallprompt', ['$event'])
  onInstallPrompt(event: Event): void {
    if (!this.installRequested()) return;
    event.preventDefault();
    this.installPrompt = event as InstallPromptEvent;
    this.installReady.set(true);
    this.installHelp.set(false);
  }

  @HostListener('window:appinstalled')
  onAppInstalled(): void {
    this.installPrompt = null;
    this.dismissInstall();
  }

  dismissInstall(): void {
    this.installRequested.set(false);
    this.installHelp.set(false);
    const url = new URL(window.location.href);
    url.searchParams.delete('install');
    url.searchParams.delete('chrome');
    window.history.replaceState(window.history.state, '', url);
  }

  async installApp(): Promise<void> {
    const prompt = this.installPrompt;
    if (!prompt) {
      this.installHelp.set(true);
      if (this.isAndroid && !new URLSearchParams(window.location.search).has('chrome')) {
        this.openInChrome();
      }
      return;
    }
    this.installPrompt = null;
    this.installReady.set(false);
    try {
      const result = await prompt.prompt();
      if (result.outcome === 'accepted') this.dismissInstall();
      else this.installHelp.set(true);
    } catch {
      this.installHelp.set(true);
    }
  }

  constructor() {
    effect(() => {
      const user = this.auth.session()?.user.id;
      if (user) void this.push.refresh(user);
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
      await this.push.disable();
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
