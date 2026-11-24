import { DOCUMENT } from '@angular/common';
import { Injectable, OnDestroy, inject, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AnimaleseService implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  readonly enabled = signal(this.readPreference());
  private readonly letters = new Map<string, HTMLAudioElement>();
  private current: HTMLAudioElement | null = null;

  toggle(): void {
    this.enabled.update((value) => !value);
    if (!this.enabled()) this.current?.pause();
    try {
      this.document.defaultView?.localStorage.setItem('kklender-animalese', String(this.enabled()));
    } catch {
      /* Storage is optional. */
    }
  }

  onInput(event: Event, force = false, mask = false): void {
    const input = event as InputEvent;
    if (
      (!force && !this.enabled()) ||
      this.document.hidden ||
      input.isComposing ||
      input.inputType !== 'insertText' ||
      !input.data ||
      [...input.data].length !== 1
    )
      return;
    const letter = mask ? String.fromCharCode(97 + Math.floor(Math.random() * 26)) : input.data
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace('ß', 's');
    if (!/^[a-z]$/.test(letter)) return;
    let audio = this.letters.get(letter);
    if (!audio) {
      audio = this.document.createElement('audio');
      audio.src = new URL(`Sound-effects/animalese/${letter}.mp3`, this.document.baseURI).href;
      audio.volume = 0.18;
      this.letters.set(letter, audio);
    }
    this.current?.pause();
    this.current = audio;
    audio.currentTime = 0;
    audio.playbackRate = 1.1 + Math.random() * 0.15;
    audio.preservesPitch = false;
    void audio.play().catch(() => {});
  }

  stop(): void {
    this.current?.pause();
  }
  ngOnDestroy(): void {
    this.stop();
  }

  private readPreference(): boolean {
    try {
      return this.document.defaultView?.localStorage.getItem('kklender-animalese') !== 'false';
    } catch {
      return true;
    }
  }
}
