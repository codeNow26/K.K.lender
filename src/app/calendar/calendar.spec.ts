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
});
