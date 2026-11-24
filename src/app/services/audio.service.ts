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
    event: this.createAudio('Music/Bubblegum.mp3', 0.07, true),
    background: this.createAudio('Music/Background-Music.m4a', 0.035, true),
  };
  private readonly clicks = [1, 2, 3].map((number) =>
    this.createAudio(`Sound-effects/KKLender-click${number}.WAV`, 0.25),
  );
  private readonly loginSound = this.createAudio('Sound-effects/Login-Sound.WAV', 0.25);
  private readonly levels: Record<Music, number> = { menu: 0.12, event: 0.07, background: 0.035 };
  private readonly fades = new Map<Music, ReturnType<typeof setInterval>>();
  private current: Music | null = null;
  private click: HTMLAudioElement | null = null;
  private readonly retryPlayback = () => this.playCurrent();
  private readonly restartMenu = () => {
    if (this.current !== 'menu' || !this.musicEnabled() || this.document.hidden) return;
    this.tracks.menu.currentTime = 5;
    this.play(this.tracks.menu);
  };
  private readonly visibilityChanged = () => {
    if (this.document.hidden) {
      this.stopTracks();
      this.loginSound.pause();
      this.click?.pause();
    } else {
      this.playCurrent();
    }
  };

  constructor() {
    this.tracks.menu.loop = false;
    this.tracks.menu.preload = 'auto';
    this.tracks.menu.currentTime = 5;
    this.tracks.menu.addEventListener('ended', this.restartMenu);
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
      for (const track of ['menu', 'event', 'background'] as const) this.fade(track, 0);
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
      return this.document.defaultView?.localStorage.getItem('kklender-music') !== 'false';
    } catch {
      return true;
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
    this.tracks.menu.removeEventListener('ended', this.restartMenu);
    this.document.removeEventListener('pointerdown', this.retryPlayback);
    this.document.removeEventListener('keydown', this.retryPlayback);
    this.document.removeEventListener('touchend', this.retryPlayback);
    this.document.removeEventListener('visibilitychange', this.visibilityChanged);
    this.setMusic(null);
    this.click?.pause();
    this.loginSound.pause();
    this.stopTracks();
  }

  private createAudio(path: string, volume: number, loop = false): HTMLAudioElement {
    const audio = this.document.createElement('audio');
    audio.src = new URL(path, this.document.baseURI).href;
    audio.volume = volume;
    audio.loop = loop;
    audio.preload = 'none';
    return audio;
  }

  private stopTracks(): void {
    for (const timer of this.fades.values()) clearInterval(timer);
    this.fades.clear();
    Object.values(this.tracks).forEach((audio) => { audio.pause(); audio.volume = 0; });
  }

  private fade(track: Music, target: number): void {
    const audio = this.tracks[track];
    const previous = this.fades.get(track);
    if (previous !== undefined) clearInterval(previous);
    this.fades.delete(track);
    if (target > 0 && audio.paused) {
      audio.volume = 0;
      if (track === 'menu' && audio.currentTime < 5) audio.currentTime = 5;
      this.play(audio);
    }
    const from = audio.volume;
    const finish = () => {
      audio.volume = target;
      if (target === 0 && !(track === 'background' && this.screen === 'calendar' && this.musicEnabled())) {
        audio.pause();
        if (track !== this.current && track !== 'background') audio.currentTime = track === 'menu' ? 5 : 0;
      }
    };
    if (from === target) { finish(); return; }
    const started = Date.now();
    const timer = setInterval(() => {
      const progress = Math.min(1, (Date.now() - started) / 1500);
      audio.volume = from + (target - from) * progress;
      if (progress === 1) {
        clearInterval(timer);
        this.fades.delete(track);
        finish();
      }
    }, 30);
    this.fades.set(track, timer);
  }

  private setMusic(next: Music | null): void {
    if (next === this.current) { this.playCurrent(); return; }
    this.current = next;
    if (!this.musicEnabled() || this.document.hidden) { this.stopTracks(); return; }
    for (const track of ['menu', 'event', 'background'] as const) {
      this.fade(track, track === next ? this.levels[track] : 0);
    }
    this.playCurrent();
  }

  private playCurrent(): void {
    if (!this.current || !this.musicEnabled() || this.document.hidden) return;
    if (this.screen === 'calendar' && this.tracks.background.paused && this.current !== 'background') {
      this.tracks.background.volume = 0;
      this.play(this.tracks.background);
    }
    const audio = this.tracks[this.current];
    if (audio.paused || (!this.fades.has(this.current) && audio.volume !== this.levels[this.current])) {
      this.fade(this.current, this.levels[this.current]);
    }
  }

  private play(audio: HTMLAudioElement): void {
    // Autoplay restrictions and audio loading failures must not interrupt the app.
    void audio.play().catch(() => {});
  }
}
