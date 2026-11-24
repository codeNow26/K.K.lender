import { DOCUMENT } from '@angular/common';
import { Injectable, OnDestroy, inject, signal } from '@angular/core';

type Music = 'menu' | 'event' | 'background';

@Injectable({ providedIn: 'root' })
export class AudioService implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  readonly musicEnabled = signal(this.readMusicPreference());
  private screen: 'login' | 'calendar' | null = null;
  private newEvent = false;
  private readonly tracks: Record<Music, HTMLAudioElement> = {
    menu: this.createAudio('Music/Menu-Music.mp3', 0.12, true),
    event: this.createAudio('Music/Bubblegum.mp3', 0.1, true),
    background: this.createAudio('Music/Background-Music.m4a', 0.035, true),
  };
  private readonly clicks = [1, 2, 3].map((number) =>
    this.createAudio(`Sound-effects/KKLender-click${number}.WAV`, 0.25),
  );
  private readonly loginSound = this.createAudio('Sound-effects/Login-Sound.WAV', 0.25);
  private current: Music | null = null;
  private click: HTMLAudioElement | null = null;
  private readonly retryPlayback = () => this.playCurrent();
  private readonly visibilityChanged = () => {
    if (this.document.hidden) {
      Object.values(this.tracks).forEach((audio) => audio.pause());
      this.loginSound.pause();
      this.click?.pause();
    } else {
      this.playCurrent();
    }
  };

  constructor() {
    // Retry blocked autoplay only after a real user interaction.
    this.document.addEventListener('pointerdown', this.retryPlayback);
    this.document.addEventListener('keydown', this.retryPlayback);
    this.document.addEventListener('touchend', this.retryPlayback);
    this.document.addEventListener('visibilitychange', this.visibilityChanged);
  }

  setScreen(screen: 'login' | 'calendar' | null): void {
    this.screen = screen;
    if (screen !== 'calendar') this.newEvent = false;
    this.updateMusic();
  }

  setNewEvent(open: boolean): void {
    this.newEvent = open;
    this.updateMusic();
  }

  toggleMusic(): void {
    this.musicEnabled.update((enabled) => !enabled);
    try {
      this.document.defaultView?.localStorage.setItem(
        'kklender-music',
        String(this.musicEnabled()),
      );
    } catch {
      /* Playback also works when storage is unavailable. */
    }
    if (!this.musicEnabled()) {
      Object.values(this.tracks).forEach((audio) => audio.pause());
    } else {
      this.playCurrent();
    }
  }

  playLoginSound(): void {
    if (this.document.hidden) return;
    this.loginSound.currentTime = 0;
    this.play(this.loginSound);
  }

  private readMusicPreference(): boolean {
    try {
      return this.document.defaultView?.localStorage.getItem('kklender-music') === 'true';
    } catch {
      return false;
    }
  }

  private updateMusic(): void {
    this.setMusic(
      this.screen === 'login'
        ? 'menu'
        : this.screen === 'calendar'
          ? this.newEvent
            ? 'event'
            : 'background'
          : null,
    );
  }

  playDayClick(): void {
    if (this.document.hidden) return;
    this.click?.pause();
    this.click = this.clicks[Math.floor(Math.random() * this.clicks.length)];
    this.click.currentTime = 0;
    this.play(this.click);
  }

  ngOnDestroy(): void {
    this.document.removeEventListener('pointerdown', this.retryPlayback);
    this.document.removeEventListener('keydown', this.retryPlayback);
    this.document.removeEventListener('touchend', this.retryPlayback);
    this.document.removeEventListener('visibilitychange', this.visibilityChanged);
    this.setMusic(null);
    this.click?.pause();
    this.loginSound.pause();
    Object.values(this.tracks).forEach((audio) => audio.pause());
  }

  private createAudio(path: string, volume: number, loop = false): HTMLAudioElement {
    const audio = this.document.createElement('audio');
    audio.src = new URL(path, this.document.baseURI).href;
    audio.volume = volume;
    audio.loop = loop;
    audio.preload = 'none';
    return audio;
  }

  private setMusic(next: Music | null): void {
    if (next !== this.current) {
      if (this.current && this.current !== 'background') {
        this.tracks[this.current].pause();
        this.tracks[this.current].currentTime = 0;
      }
      this.current = next;
    }
    // Keep the relaxing track advancing silently underneath Bubblegum.
    this.tracks.background.muted = next !== 'background';
    if (this.screen !== 'calendar') this.tracks.background.pause();
    this.playCurrent();
  }

  private playCurrent(): void {
    if (!this.current || !this.musicEnabled() || this.document.hidden) return;
    if (this.screen === 'calendar' && this.tracks.background.paused) {
      this.play(this.tracks.background);
    }
    const audio = this.tracks[this.current];
    if (this.current !== 'background' && audio.paused) this.play(audio);
  }

  private play(audio: HTMLAudioElement): void {
    // Autoplay restrictions and audio loading failures must not interrupt the app.
    void audio.play().catch(() => {});
  }
}
