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

  async refresh(userId: string): Promise<void> {
    if (!this.supported || this.busy()) return;
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) { this.enabled.set(false); return; }
      const { data } = await this.supabase.client.from('calendar_push_subscriptions')
        .select('endpoint').eq('user_id', userId).eq('endpoint', subscription.endpoint).maybeSingle();
      if (this.supabase.session()?.user.id === userId && !this.busy()) this.enabled.set(!!data);
    } catch { this.enabled.set(false); }
  }

  async toggle(): Promise<void> {
    if (this.busy() || !this.supported) return;
    this.busy.set(true);
    this.message.set('');
    try {
      if (this.enabled()) { await this.disable(); return; }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { this.message.set('Bitte erlaube Benachrichtigungen in den Browser-Einstellungen.'); return; }
      const user = this.supabase.session()?.user;
      if (!user) return;
      const { data, error } = await this.supabase.client.functions.invoke('calendar-push', { body: { action: 'key' } });
      if (error || typeof data?.publicKey !== 'string') throw Error('Inselpost noch nicht eingerichtet');
      const path = new URL('calendar-push-sw.js', document.baseURI);
      await navigator.serviceWorker.register(path);
      const registration = await navigator.serviceWorker.ready;
      const key = Uint8Array.from(atob(data.publicKey.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(data.publicKey.length / 4) * 4, '=')), c => c.charCodeAt(0));
      let subscription = await registration.pushManager.getSubscription();
      subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      const json = subscription.toJSON();
      if (!json.keys?.['p256dh'] || !json.keys?.['auth']) throw Error('Missing subscription keys');
      const { error: saveError } = await this.supabase.client.from('calendar_push_subscriptions').upsert({
        user_id: user.id, endpoint: subscription.endpoint, p256dh: json.keys['p256dh'], auth: json.keys['auth']
      }, { onConflict: 'user_id,endpoint' });
      if (saveError) { await subscription.unsubscribe(); throw saveError; }
      this.enabled.set(true);
      this.message.set('Inselpost ist auf diesem Gerät aktiviert. 🌿');
    } catch {
      this.message.set('Inselpost konnte nicht aktiviert werden. Bitte versuche es später erneut.');
    } finally { this.busy.set(false); }
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
