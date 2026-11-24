import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Session, createClient } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private readonly destroyRef = inject(DestroyRef);

  readonly client = createClient(
    'https://penlkhrkfbexlzgermdv.supabase.co',
    'sb_publishable_ZHieENk4UNZoidlbdYjszw_t-WhLLeb',
  );

  readonly session = signal<Session | null>(null);
  readonly isInitializing = signal(true);

  constructor() {
    const { data } = this.client.auth.onAuthStateChange(
      (_event, session) => {
        this.session.set(session);
        this.isInitializing.set(false);
      },
    );

    this.destroyRef.onDestroy(() => {
      data.subscription.unsubscribe();
    });
  }

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await this.client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      throw error;
    }
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut({
      scope: 'local',
    });

    if (error) {
      throw error;
    }
  }
}