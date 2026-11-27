import { Component, HostListener, signal } from '@angular/core';

type Season = 'spring' | 'summer' | 'autumn' | 'winter';

function currentSeason(): Season {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}

@Component({
  selector: 'app-seasonal-background',
  templateUrl: './seasonal-background.html',
  styleUrl: './seasonal-background.scss',
})
export class SeasonalBackground {
  readonly season = signal(currentSeason());

  readonly particles = [
    { x: 4, size: 12, duration: 34, delay: -8, drift: 14 },
    { x: 12, size: 9, duration: 43, delay: -31, drift: -18 },
    { x: 24, size: 10, duration: 38, delay: -19, drift: 22 },
    { x: 37, size: 8, duration: 46, delay: -11, drift: -14 },
    { x: 48, size: 11, duration: 35, delay: -27, drift: 19 },
    { x: 61, size: 9, duration: 44, delay: -3, drift: -20 },
    { x: 76, size: 12, duration: 37, delay: -23, drift: 16 },
    { x: 86, size: 10, duration: 48, delay: -35, drift: -16 },
    { x: 94, size: 13, duration: 39, delay: -15, drift: -14 },
  ];

  @HostListener('window:focus')
  @HostListener('document:visibilitychange')
  refreshSeason(): void {
    this.season.set(currentSeason());
  }
}
