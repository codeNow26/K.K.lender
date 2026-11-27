import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class PushService {
  private readonly supabase = inject(SupabaseService);
  readonly supported = typeof window !== 'undefined' && window.isSecureContext &&
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  readonly enabled = signal(false);
  readonly busy = signal(false);
  readonly message = signal('');

  private readonly automaticAttempts = new Set<string>();

  private optedOut(userId: string): boolean {
    try { return localStorage.getItem('kklender-push-off:' + userId) === 'true'; }
    catch { return true; }
  }

  private rememberChoice(userId: string, off: boolean): void {
    try { localStorage.setItem('kklender-push-off:' + userId, String(off)); } catch {}
  }

  async refresh(userId: string): Promise<void> {
    if (!this.supported || this.busy()) return;
    if (Notification.permission !== 'granted' || this.optedOut(userId)) {
      this.enabled.set(false);
      return;
    }
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const { data, error } = await this.supabase.client.from('calendar_push_subscriptions')
          .select('endpoint').eq('user_id', userId).eq('endpoint', subscription.endpoint).maybeSingle();
        if (error) throw error;
        if (this.supabase.session()?.user.id !== userId || this.busy()) return;
        this.enabled.set(!!data);
        if (data) return;
      }
      // Never request notification permission automatically. Respect an explicit switch-off.
      if (this.automaticAttempts.has(userId) || this.busy() ||
          this.supabase.session()?.user.id !== userId) return;
      this.automaticAttempts.add(userId);
      this.busy.set(true);
      try { await this.subscribe(userId); }
      catch { /* Some browsers require a user gesture even with permission granted. */ }
      finally { this.busy.set(false); }
    } catch { this.enabled.set(false); }
  }

  async toggle(): Promise<void> {
    if (this.busy() || !this.supported) return;
    this.busy.set(true);
    this.message.set('');
    try {
      if (this.enabled()) {
        const user = this.supabase.session()?.user;
        if (user) this.rememberChoice(user.id, true);
        await this.disable();
        return;
      }
      const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (permission !== 'granted') { this.message.set('Bitte erlaube Benachrichtigungen in den Browser-Einstellungen.'); return; }
      const user = this.supabase.session()?.user;
      if (!user) return;
      await this.subscribe(user.id);
      this.rememberChoice(user.id, false);
      this.message.set('Inselpost ist auf diesem Gerät aktiviert. 🌿');
    } catch {
      this.message.set('Inselpost konnte nicht aktiviert werden. Bitte versuche es später erneut.');
    } finally { this.busy.set(false); }
  }

  private async subscribe(userId: string): Promise<void> {
      if (Notification.permission !== 'granted') throw Error('Permission required');
      const { data, error } = await this.supabase.client.functions.invoke('calendar-push', { body: { action: 'key' } });
      if (error || typeof data?.publicKey !== 'string') throw Error('Inselpost noch nicht eingerichtet');
      const path = new URL('calendar-push-sw.js', document.baseURI);
      await navigator.serviceWorker.register(path);
      const registration = await navigator.serviceWorker.ready;
      const key = Uint8Array.from(atob(data.publicKey.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(data.publicKey.length / 4) * 4, '=')), c => c.charCodeAt(0));
      let subscription = await registration.pushManager.getSubscription();
      subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      if (this.supabase.session()?.user.id !== userId) throw Error('Session changed');
      const json = subscription.toJSON();
      if (!json.keys?.['p256dh'] || !json.keys?.['auth']) throw Error('Missing subscription keys');
      const { error: saveError } = await this.supabase.client.from('calendar_push_subscriptions').upsert({
        user_id: userId, endpoint: subscription.endpoint, p256dh: json.keys['p256dh'], auth: json.keys['auth']
      }, { onConflict: 'user_id,endpoint' });
      if (saveError) { await subscription.unsubscribe(); throw saveError; }
      this.enabled.set(true);
  }

  async disable(): Promise<void> {
    if (!this.supported) return;
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      // Unsubscribe first, so even a failed database cleanup cannot send to this device.
      await subscription.unsubscribe();
      const user = this.supabase.session()?.user;
      if (user) await this.supabase.client.from('calendar_push_subscriptions')
        .delete().eq('user_id', user.id).eq('endpoint', subscription.endpoint);
    }
    this.enabled.set(false);
    this.message.set('');
  }
}
