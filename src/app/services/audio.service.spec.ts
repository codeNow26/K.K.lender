import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AudioService } from './audio.service';

describe('AudioService', () => {
  let service: AudioService;
  let played: HTMLMediaElement[];
  let paused: HTMLMediaElement[];

  beforeEach(() => {
    played = [];
    paused = [];
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (
      this: HTMLMediaElement,
    ) {
      played.push(this);
      return Promise.resolve();
    });
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (
      this: HTMLMediaElement,
    ) {
      paused.push(this);
    });
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    service = TestBed.inject(AudioService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('switches quiet looping music and stops/reset it when the form closes', () => {
    service.setLoginScreen(true);
    const menu = played.at(-1)!;
    expect(menu.src).toContain('/Music/Menu-Music.mp3');
    expect(menu.volume).toBe(0.12);
    expect(menu.loop).toBe(true);
    service.setLoginScreen(false);
    expect(paused).toContain(menu);
    service.setNewEvent(true);
    const event = played.at(-1)!;
    expect(event.src).toContain('/Music/Bubblegum.mp3');
    event.currentTime = 10;
    service.setNewEvent(false);
    expect(paused).toContain(event);
    expect(event.currentTime).toBe(0);
  });

  it('does not stop login music when the calendar is destroyed after logout', () => {
    service.setNewEvent(true);
    service.setLoginScreen(true);
    const menu = played.at(-1)!;
    service.setNewEvent(false);
    expect(paused).not.toContain(menu);
  });

  it('retries blocked autoplay after interaction, but never after leaving the screen', async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new Error('NotAllowedError'));
    service.setLoginScreen(true);
    await Promise.resolve();
    document.dispatchEvent(new Event('pointerdown'));
    expect(played.at(-1)?.src).toContain('Menu-Music.mp3');
    service.setLoginScreen(false);
    const count = played.length;
    document.dispatchEvent(new Event('keydown'));
    expect(played.length).toBe(count);
  });

  it('randomly selects all three day sounds and cuts off the previous click', () => {
    const random = vi.spyOn(Math, 'random');
    for (let index = 0; index < 3; index++) {
      random.mockReturnValue(index / 3);
      service.playDayClick();
      expect(played.at(-1)?.src).toContain(`KKLender-click${index + 1}.WAV`);
    }
    expect(paused).toContain(played[0]);
    expect(paused).toContain(played[1]);
  });

  it('pauses in the background and resumes only while its screen is active', () => {
    service.setNewEvent(true);
    const event = played.at(-1)!;
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(paused).toContain(event);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(played.length).toBe(2);
    service.setNewEvent(false);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(played.length).toBe(2);
  });
});
