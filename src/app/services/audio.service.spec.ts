import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AudioService } from './audio.service';

describe('AudioService', () => {
  let service: AudioService;
  let played: HTMLMediaElement[];
  let paused: HTMLMediaElement[];

  beforeEach(() => {
    localStorage.clear();
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
    service.toggleMusic();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('switches quiet looping music and stops/reset it when the form closes', () => {
    service.setScreen('login');
    const menu = played.at(-1)!;
    expect(menu.src).toContain('/Music/Menu-Music.mp3');
    expect(menu.volume).toBe(0.12);
    expect(menu.loop).toBe(true);
    service.setScreen(null);
    expect(paused).toContain(menu);
    service.setScreen('calendar');
    service.setNewEvent(true);
    const event = played.at(-1)!;
    expect(event.src).toContain('/Music/Bubblegum.mp3');
    event.currentTime = 10;
    service.setNewEvent(false);
    expect(paused).toContain(event);
    expect(event.currentTime).toBe(0);
  });

  it('does not stop login music when the calendar is destroyed after logout', () => {
    service.setScreen('calendar');
    service.setNewEvent(true);
    service.setScreen('login');
    const menu = played.at(-1)!;
    service.setNewEvent(false);
    expect(paused).not.toContain(menu);
  });

  it('retries blocked autoplay after interaction, but never after leaving the screen', async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new Error('NotAllowedError'));
    service.setScreen('login');
    await Promise.resolve();
    document.dispatchEvent(new Event('pointerdown'));
    expect(played.at(-1)?.src).toContain('Menu-Music.mp3');
    service.setScreen(null);
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

  it('keeps background music muted underneath Bubblegum without rewinding', () => {
    service.setScreen('calendar');
    const background = played.at(-1)!;
    expect(background.volume).toBe(0.035);
    background.currentTime = 120;
    paused.length = 0;
    service.setNewEvent(true);
    expect(background.muted).toBe(true);
    expect(paused).not.toContain(background);
    background.currentTime = 135;
    service.setNewEvent(false);
    expect(background.muted).toBe(false);
    expect(background.currentTime).toBe(135);
  });

  it('mutes all music, remembers the choice and keeps click sounds available', () => {
    service.setScreen('calendar');
    service.toggleMusic();
    expect(service.musicEnabled()).toBe(false);
    expect(localStorage.getItem('kklender-music')).toBe('false');
    const count = played.length;
    document.dispatchEvent(new Event('pointerdown'));
    service.setNewEvent(true);
    expect(played.length).toBe(count);
    service.playDayClick();
    expect(played.length).toBe(count + 1);
    service.toggleMusic();
    expect(played.at(-1)?.src).toContain('Bubblegum.mp3');
  });

  it('pauses all tracks when hidden and does not resume muted music', () => {
    service.setScreen('calendar');
    service.setNewEvent(true);
    const event = played.at(-1)!;
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(paused).toContain(event);
    service.toggleMusic();
    const count = played.length;
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(played.length).toBe(count);
  });

  it('plays the login effect even when music is off', () => {
    service.toggleMusic();
    service.playLoginSound();
    expect(played.at(-1)?.src).toContain('Login-Sound.WAV');
  });
});
