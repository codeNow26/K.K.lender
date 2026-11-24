import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { App } from './app';
import { AudioService } from './services/audio.service';
import { SupabaseService } from './services/supabase.service';

describe('App', () => {
  it('plays menu music only after auth initialization on the login screen', async () => {
    const auth = { isInitializing: signal(true), session: signal(null) };
    const audio = { setLoginScreen: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: SupabaseService, useValue: auth },
        { provide: AudioService, useValue: audio },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(audio.setLoginScreen).toHaveBeenLastCalledWith(false);
    auth.isInitializing.set(false);
    fixture.detectChanges();
    expect(audio.setLoginScreen).toHaveBeenLastCalledWith(true);
    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain('K.K.Lender');
  });
});
