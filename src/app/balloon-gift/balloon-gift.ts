import { DOCUMENT } from '@angular/common';
import { Component, HostListener, Input, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { AudioService } from '../services/audio.service';

const BALLOONS = [
  { light: '#ff8b79', mid: '#ed5043', dark: '#bb302f' },
  { light: '#ffe887', mid: '#edca43', dark: '#c79c25' },
  { light: '#91bbff', mid: '#5788df', dark: '#3454af' },
  { light: '#b0dd82', mid: '#79b75e', dark: '#4d8c46' },
] as const;

const SURPRISES = [
  "Du hast 100 Gugugigi-Sternis gefunden!",
  "Du hast einen originalen Phjelepp-Furz im Einmachglas gefunden.",
  "Lilly hat dein Geschenk geöffnet. Es tut ihr nicht leid.",
  "Du hast einen seltenen Kloanst gefunden. Er macht >.<",
  "Du hast einen Liebesbrief gefunden. Darin steht nur: I lieb di, du Kloanst.",
  "Du hast eine Portion Liebi mit Spuren von Schröds Katzenhaaren enthalten.",
] as const;

@Component({
  selector: 'app-balloon-gift',
  templateUrl: './balloon-gift.html',
  styleUrl: './balloon-gift.scss',
})
export class BalloonGift implements OnInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly audio = inject(AudioService);
  readonly gift = signal<{ palette: typeof BALLOONS[number]; reverse: boolean } | null>(null);
  readonly reward = signal('');
  private nextTimer?: ReturnType<typeof setTimeout>;
  private flightTimer?: ReturnType<typeof setTimeout>;
  private rewardTimer?: ReturnType<typeof setTimeout>;
  private lastReward = -1;
  private dueAt = 0;
  private initialized = false;
  private editorOpen = false;

  @Input() set paused(value: boolean) {
    if (this.editorOpen === value) return;
    this.editorOpen = value;
    if (this.initialized) this.updateAvailability();
  }

  ngOnInit(): void {
    this.initialized = true;
    this.schedule(20000 + Math.random() * 10000);
  }

  ngOnDestroy(): void {
    this.initialized = false;
    this.clearTimers();
  }

  @HostListener('document:visibilitychange')
  onVisibility(): void {
    if (this.initialized) this.updateAvailability();
  }

  private get unavailable(): boolean {
    return this.editorOpen || this.document.hidden;
  }

  private updateAvailability(): void {
    if (this.unavailable) {
      this.clearTimers();
      if (this.gift()) {
        // An interrupted flight was not missed; let it reappear when safe.
        this.gift.set(null);
        this.dueAt = Date.now() + 1000;
      }
      this.reward.set('');
    } else if (!this.gift()) {
      this.armTimer();
    }
  }

  catchGift(): void {
    if (!this.gift()) return;
    this.gift.set(null);
    clearTimeout(this.flightTimer);
    this.audio.playDayClick();
    const offset = 1 + Math.floor(Math.random() * (SURPRISES.length - 1));
    this.lastReward = this.lastReward < 0
      ? Math.floor(Math.random() * SURPRISES.length)
      : (this.lastReward + offset) % SURPRISES.length;
    this.reward.set(SURPRISES[this.lastReward]);
    this.rewardTimer = setTimeout(() => this.reward.set(''), 5500);
    this.scheduleNext();
  }

  finishFlight(): void {
    if (!this.gift()) return;
    clearTimeout(this.flightTimer);
    this.gift.set(null);
    this.scheduleNext();
  }

  private scheduleNext(): void {
    this.schedule(120000);
  }

  private schedule(delay: number): void {
    this.dueAt = Date.now() + delay;
    this.armTimer();
  }

  private armTimer(): void {
    clearTimeout(this.nextTimer);
    if (!this.initialized || this.unavailable || this.gift()) return;
    this.nextTimer = setTimeout(() => {
      if (!this.initialized || this.unavailable || this.gift()) return;
      this.gift.set({
        palette: BALLOONS[Math.floor(Math.random() * BALLOONS.length)],
        reverse: Math.random() > 0.5,
      });
      // Also expires when animations are disabled or interrupted.
      this.flightTimer = setTimeout(() => this.finishFlight(), 24000);
    }, Math.max(0, this.dueAt - Date.now()));
  }

  private clearTimers(): void {
    clearTimeout(this.nextTimer);
    clearTimeout(this.flightTimer);
    clearTimeout(this.rewardTimer);
  }
}
