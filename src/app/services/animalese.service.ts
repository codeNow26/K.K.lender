import { DOCUMENT } from '@angular/common';
import { Injectable, OnDestroy, inject, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AnimaleseService implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  readonly enabled = signal(this.readPreference());
  private readonly letters = new Map<string, HTMLAudioElement>();
  private readonly values = new WeakMap<HTMLInputElement, string>();
  private readonly lengths = new WeakMap<HTMLInputElement, number>();
  private readonly buffers = new Map<string, AudioBuffer>();
  private context: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private current: HTMLAudioElement | null = null;
  private readonly unlock = () => this.unlockAudio();
  private readonly remember = (event: Event) => {
    const field = event.target;
    if (!(field instanceof HTMLInputElement)) return;
    if (field.type === 'password') this.lengths.set(field, field.value.length);
    else this.values.set(field, field.value);
  };

  constructor() {
    this.document.addEventListener('pointerup', this.unlock, true);
    this.document.addEventListener('touchend', this.unlock, true);
    this.document.addEventListener('keydown', this.unlock, true);
    this.document.addEventListener('focusin', this.remember, true);
  }

  toggle(): void {
    this.enabled.update((value) => !value);
    if (!this.enabled()) this.stop();
    try {
      this.document.defaultView?.localStorage.setItem('kklender-animalese', String(this.enabled()));
    } catch {
      /* Storage is optional. */
    }
  }

  onInput(event: Event, force = false, mask = false): void {
    const input = event as InputEvent;
    const field = event.target instanceof HTMLInputElement ? event.target : null;
    const type = input.inputType ?? '';
    let added = input.data ?? '';

    // Mobile IMEs may replace the entire composing word on every tap.
    // Compare the actual field values instead of rejecting composing events.
    if (field) {
      if (mask || field.type === 'password') {
        mask = true;
        const previousLength = this.lengths.get(field);
        this.lengths.set(field, field.value.length);
        if (previousLength !== undefined && field.value.length > previousLength) added = 'a';
        else if (previousLength !== undefined && (type.includes('Composition') || !added)) added = '';
      } else {
        const before = this.values.get(field);
        const after = field.value;
        this.values.set(field, after);
        if (before !== undefined) {
          let start = 0;
          while (start < before.length && start < after.length && before[start] === after[start]) start++;
          let end = 0;
          while (end < before.length - start && end < after.length - start &&
            before[before.length - 1 - end] === after[after.length - 1 - end]) end++;
          added = after.slice(start, after.length - end);
        } else if (!added) {
          added = after.slice(-1);
        }
      }
    }

    if ((!force && !this.enabled()) || this.document.hidden ||
        /^(delete|history|insertFromPaste|insertFromDrop|insertReplacementText)/.test(type) ||
        !added) return;

    // Password sounds are randomized; never speak password characters.
    const normalized = added.toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 's');
    const letter = mask ? String.fromCharCode(97 + Math.floor(Math.random() * 26)) :
      (normalized.match(/[a-z]$/)?.[0] ?? '');
    if (!letter) return;
    this.playLetter(letter);
  }

  private url(letter: string): string {
    return new URL(`Sound-effects/animalese/${letter}.mp3`, this.document.baseURI).href;
  }

  private unlockAudio(): void {
    if (typeof AudioContext === 'undefined') return;
    try {
      if (!this.context) {
        const context = new AudioContext();
        this.context = context;
        for (const letter of 'abcdefghijklmnopqrstuvwxyz') {
          void fetch(this.url(letter))
            .then(response => {
              if (!response.ok) throw new Error('Audio unavailable');
              return response.arrayBuffer();
            })
            .then(data => context.decodeAudioData(data))
            .then(buffer => { if (this.context === context) this.buffers.set(letter, buffer); })
            .catch(() => {});
        }
      }
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
    } catch {
      /* HTML audio remains available as a fallback. */
    }
  }

  private playLetter(letter: string): void {
    this.stop();
    const rate = 1.1 + Math.random() * 0.15;
    const buffer = this.buffers.get(letter);
    if (this.context?.state === 'running' && buffer) {
      const source = this.context.createBufferSource();
      const gain = this.context.createGain();
      source.buffer = buffer;
      source.playbackRate.value = rate;
      gain.gain.value = 0.18;
      source.connect(gain);
      gain.connect(this.context.destination);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        if (this.source === source) this.source = null;
      };
      this.source = source;
      source.start();
      return;
    }

    let audio = this.letters.get(letter);
    if (!audio) {
      audio = this.document.createElement('audio');
      audio.src = this.url(letter);
      audio.volume = 0.18;
      this.letters.set(letter, audio);
    }
    this.current = audio;
    audio.currentTime = 0;
    audio.playbackRate = rate;
    audio.preservesPitch = false;
    void audio.play().catch(() => {});
  }

  stop(): void {
    this.current?.pause();
    this.current = null;
    if (this.source) {
      try { this.source.stop(); } catch { /* Already ended. */ }
      this.source = null;
    }
  }

  ngOnDestroy(): void {
    this.stop();
    this.document.removeEventListener('pointerup', this.unlock, true);
    this.document.removeEventListener('touchend', this.unlock, true);
    this.document.removeEventListener('keydown', this.unlock, true);
    this.document.removeEventListener('focusin', this.remember, true);
    if (this.context) void this.context.close().catch(() => {});
    this.context = null;
  }

  private readPreference(): boolean {
    try {
      return this.document.defaultView?.localStorage.getItem('kklender-animalese') !== 'false';
    } catch {
      return true;
    }
  }
}
