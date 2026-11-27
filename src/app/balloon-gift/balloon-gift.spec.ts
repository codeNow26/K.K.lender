import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AudioService } from '../services/audio.service';
import { BalloonGift } from './balloon-gift';

describe('Balloon gift timing', () => {
  let gift: BalloonGift;
  let documentState: { hidden: boolean };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    documentState = { hidden: false };
    TestBed.configureTestingModule({
      providers: [
        { provide: DOCUMENT, useValue: documentState },
        { provide: AudioService, useValue: { playDayClick: vi.fn() } },
      ],
    });
    gift = TestBed.runInInjectionContext(() => new BalloonGift());
    gift.ngOnInit();
  });

  afterEach(() => {
    gift.ngOnDestroy();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('first arrives after 20–30 seconds and next arrives two minutes after capture', () => {
    vi.advanceTimersByTime(24999);
    expect(gift.gift()).toBeNull();
    vi.advanceTimersByTime(1);
    expect(gift.gift()).not.toBeNull();
    gift.catchGift();
    expect(gift.gift()).toBeNull();
    vi.advanceTimersByTime(119999);
    expect(gift.gift()).toBeNull();
    vi.advanceTimersByTime(1);
    expect(gift.gift()).not.toBeNull();
  });

  it('keeps the first deadline across a tab switch', () => {
    vi.advanceTimersByTime(20000);
    documentState.hidden = true;
    gift.onVisibility();
    vi.advanceTimersByTime(10000);
    expect(gift.gift()).toBeNull();
    documentState.hidden = false;
    gift.onVisibility();
    vi.advanceTimersByTime(1);
    expect(gift.gift()).not.toBeNull();
  });

  it('keeps the two-minute deadline across visibility changes', () => {
    vi.advanceTimersByTime(25000);
    gift.finishFlight();
    vi.advanceTimersByTime(60000);
    documentState.hidden = true;
    gift.onVisibility();
    vi.advanceTimersByTime(40000);
    documentState.hidden = false;
    gift.onVisibility();
    vi.advanceTimersByTime(19999);
    expect(gift.gift()).toBeNull();
    vi.advanceTimersByTime(1);
    expect(gift.gift()).not.toBeNull();
  });

  it('replays a flight interrupted by a hidden tab', () => {
    vi.advanceTimersByTime(25000);
    documentState.hidden = true;
    gift.onVisibility();
    expect(gift.gift()).toBeNull();
    vi.advanceTimersByTime(10000);
    documentState.hidden = false;
    gift.onVisibility();
    vi.advanceTimersByTime(1);
    expect(gift.gift()).not.toBeNull();
  });
});
