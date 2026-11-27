import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Calendar } from './calendar';
import { AudioService } from '../services/audio.service';
import { SupabaseService } from '../services/supabase.service';

describe('Calendar audio lifecycle', () => {
  const audio = { setNewEvent: vi.fn(), playDayClick: vi.fn() };
  const result = vi.fn();
  let calendar: Calendar;

  beforeEach(() => {
    vi.clearAllMocks();
    const query = { select: () => ({ maybeSingle: result }) };
    TestBed.configureTestingModule({
      providers: [
        { provide: AudioService, useValue: audio },
        {
          provide: SupabaseService,
          useValue: { client: { from: () => ({ insert: () => query }) } },
        },
      ],
    });
    calendar = TestBed.runInInjectionContext(() => new Calendar());
    calendar.isLoading.set(false);
  });

  it('keeps the existing draft when the header add button is tapped again', () => {
    calendar.openNewEvent();
    calendar.draftTitle = 'Nicht verwerfen';
    calendar.openNewEvent();
    expect(calendar.isFormOpen).toBe(true);
    expect(calendar.draftTitle).toBe('Nicht verwerfen');
  });

  it('starts for a new event and stops on cancel or component destruction', () => {
    calendar.openNewEvent();
    expect(audio.setNewEvent).toHaveBeenLastCalledWith(true);
    calendar.closeForm();
    expect(audio.setNewEvent).toHaveBeenLastCalledWith(false);
    calendar.openNewEvent();
    calendar.ngOnDestroy();
    expect(audio.setNewEvent).toHaveBeenLastCalledWith(false);
  });

  it('stops after a successful save but keeps playing on a failed save', async () => {
    calendar.openNewEvent();
    calendar.draftTitle = 'Inselbesuch';
    result.mockResolvedValueOnce({ data: null, error: new Error('offline') });
    await calendar.saveEvent();
    expect(calendar.isFormOpen).toBe(true);
    expect(audio.setNewEvent).toHaveBeenLastCalledWith(true);
    result.mockResolvedValueOnce({
      data: {
        id: '1',
        title: 'Inselbesuch',
        date: calendar.draftDate,
        time: null,
        owner: 'Gemeinsam',
      },
      error: null,
    });
    await calendar.saveEvent();
    expect(calendar.isFormOpen).toBe(false);
    expect(audio.setNewEvent).toHaveBeenLastCalledWith(false);
  });

  it('plays a day sound only when a day is selected', () => {
    calendar.changeMonth(1);
    expect(audio.playDayClick).not.toHaveBeenCalled();
    calendar.selectDay(12);
    expect(audio.playDayClick).toHaveBeenCalledOnce();
  });
  it('adjusts time across midnight and clears it for all-day events', () => {
    calendar.draftTime = '23:50';
    calendar.adjustTime(15);
    expect(calendar.draftTime).toBe('00:05');
    calendar.adjustTime(-15);
    expect(calendar.draftTime).toBe('23:50');
    calendar.setTimeEnabled(false);
    expect(calendar.draftTime).toBe('');
  });

  it('offers an optional end time and clears it for all-day events', () => {
    calendar.draftTime = '15:00';
    calendar.setEndTimeEnabled(true);
    expect(calendar.draftEndTime).toBe('16:00');
    calendar.setTimeEnabled(false);
    expect(calendar.draftEndTime).toBe('');
  });

  it('edits end time independently of the start time', () => {
    calendar.draftTime = '15:00';
    calendar.setEndTimeEnabled(true);
    calendar.setTimePart('hour', '17', true);
    calendar.setTimePart('minute', '30', true);
    calendar.adjustTime(15, true);
    expect(calendar.draftEndTime).toBe('17:45');
    calendar.adjustTime(-15, true);
    expect(calendar.draftEndTime).toBe('17:30');
    expect(calendar.draftTime).toBe('15:00');
  });

  it('rejects a range ending before or at the start', async () => {
    calendar.openNewEvent();
    calendar.draftTitle = 'Inselbesuch';
    calendar.draftTime = '15:00';
    calendar.draftEndTime = '14:00';
    await calendar.saveEvent();
    expect(result).not.toHaveBeenCalled();
    expect(calendar.saveError()).toContain('Endzeit');
  });

  it('rejects incomplete or invalid time instead of saving an all-day event', async () => {
    calendar.openNewEvent();
    calendar.draftTitle = 'Inselbesuch';
    calendar.draftTime = '25:00';
    await calendar.saveEvent();
    expect(result).not.toHaveBeenCalled();
    expect(calendar.saveError()).toContain('Uhrzeit');
    calendar.draftTime = ':30';
    await calendar.saveEvent();
    expect(result).not.toHaveBeenCalled();
  });
});
