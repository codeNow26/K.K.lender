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
    { x: 4, size: 19, duration: 30, delay: -8, drift: 24 },
    { x: 10, size: 13, duration: 39, delay: -31, drift: -28 },
    { x: 16, size: 21, duration: 34, delay: -19, drift: 36 },
    { x: 23, size: 11, duration: 45, delay: -11, drift: -24 },
    { x: 29, size: 17, duration: 31, delay: -27, drift: 30 },
    { x: 35, size: 14, duration: 41, delay: -3, drift: -35 },
    { x: 41, size: 22, duration: 36, delay: -23, drift: 27 },
    { x: 47, size: 12, duration: 43, delay: -35, drift: -30 },
    { x: 53, size: 18, duration: 33, delay: -15, drift: 24 },
    { x: 59, size: 15, duration: 37, delay: -26, drift: -25 },
    { x: 65, size: 20, duration: 40, delay: -9, drift: 32 },
    { x: 71, size: 12, duration: 29, delay: -18, drift: -22 },
    { x: 77, size: 17, duration: 43, delay: -32, drift: 23 },
    { x: 83, size: 23, duration: 35, delay: -13, drift: -30 },
    { x: 89, size: 13, duration: 38, delay: -24, drift: 18 },
    { x: 95, size: 19, duration: 32, delay: -17, drift: -24 },
  ];

  @HostListener('window:focus')
  @HostListener('document:visibilitychange')
  refreshSeason(): void {
    this.season.set(currentSeason());
  }
}
