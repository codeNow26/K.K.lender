import { DOCUMENT } from '@angular/common';
import { Injectable, OnDestroy, inject } from '@angular/core';

type Music = 'menu' | 'event';

@Injectable({ providedIn: 'root' })
export class AudioService implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly tracks: Record<Music, HTMLAudioElement> = {
    menu: this.createAudio('Music/Menu-Music.mp3', 0.12, true),
    event: this.createAudio('Music/Bubblegum.mp3', 0.12, true),
  };
  private readonly clicks = [1, 2, 3].map((number) =>
    this.createAudio(`Sound-effects/KKLender-click${number}.WAV`, 0.25),
  );
  private current: Music | null = null;
  private click: HTMLAudioElement | null = null;
  private readonly retryPlayback = () => this.playCurrent();
  private readonly visibilityChanged = () => {
    if (this.document.hidden) {
      if (this.current) this.tracks[this.current].pause();
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

  setLoginScreen(visible: boolean): void {
    if (visible) this.setMusic('menu');
    else if (this.current === 'menu') this.setMusic(null);
  }

  setNewEvent(open: boolean): void {
    if (open) this.setMusic('event');
    else if (this.current === 'event') this.setMusic(null);
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
    if (next === this.current) return;
    if (this.current) {
      this.tracks[this.current].pause();
      this.tracks[this.current].currentTime = 0;
    }
    this.current = next;
    this.playCurrent();
  }

  private playCurrent(): void {
    if (!this.current || this.document.hidden) return;
    const audio = this.tracks[this.current];
    if (audio.paused) this.play(audio);
  }

  private play(audio: HTMLAudioElement): void {
    // Autoplay restrictions and audio loading failures must not interrupt the app.
    void audio.play().catch(() => {});
  }
}
