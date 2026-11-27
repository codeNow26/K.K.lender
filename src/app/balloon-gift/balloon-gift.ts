import { DOCUMENT } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { AudioService } from '../services/audio.service';

const BALLOONS = [
  { light: '#ff8b79', mid: '#ed5043', dark: '#bb302f' },
  { light: '#ffe887', mid: '#edca43', dark: '#c79c25' },
  { light: '#91bbff', mid: '#5788df', dark: '#3454af' },
  { light: '#b0dd82', mid: '#79b75e', dark: '#4d8c46' },
] as const;

const SURPRISES = [
  'Ein Päckchen voller Schmeggels!',
  'Ein kleiner Kloanst für deine Tasche.',
  'Du hast 100 Gugugigi-Sternis gefunden!',
  'Ein Gutschein für eine extra lange Umarmung.',
  'Eine Portion gute Laune für heute.',
  'Ein Stück Inselglück für euch zwei.',
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

  ngOnInit(): void {
    this.schedule(5000);
  }

  ngOnDestroy(): void {
    this.clearTimers();
  }

  @HostListener('document:visibilitychange')
  onVisibility(): void {
    this.clearTimers();
    this.gift.set(null);
    this.reward.set('');
    if (!this.document.hidden) this.schedule(5000);
  }

  catchGift(): void {
    if (!this.gift()) return;
    this.gift.set(null);
    clearTimeout(this.flightTimer);
    this.audio.playDayClick();
    const offset = 1 + Math.floor(Math.random() * (SURPRISES.length - 1));
    this.lastReward = (this.lastReward + offset) % SURPRISES.length;
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
    this.schedule(35000 + Math.random() * 30000);
  }

  private schedule(delay: number): void {
    clearTimeout(this.nextTimer);
    if (this.document.hidden) return;
    this.nextTimer = setTimeout(() => {
      if (this.document.hidden) return;
      this.gift.set({
        palette: BALLOONS[Math.floor(Math.random() * BALLOONS.length)],
        reverse: Math.random() > 0.5,
      });
      // Also expires when animations are disabled or interrupted.
      this.flightTimer = setTimeout(() => this.finishFlight(), 24000);
    }, delay);
  }

  private clearTimers(): void {
    clearTimeout(this.nextTimer);
    clearTimeout(this.flightTimer);
    clearTimeout(this.rewardTimer);
  }
}
