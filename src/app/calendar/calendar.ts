import { Component, HostListener, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { AnimaleseService } from '../services/animalese.service';
import { AudioService } from '../services/audio.service';
import { SupabaseService } from '../services/supabase.service';

type EventOwner = 'Philipp' | 'Adriana' | 'Gemeinsam';

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string | null;
  end_time?: string | null;
  owner: EventOwner;
}

@Component({
  selector: 'app-calendar',
  imports: [FormsModule],
  templateUrl: './calendar.html',
  styleUrl: './calendar.scss',
})
export class Calendar implements OnInit, OnDestroy {
  readonly animalese = inject(AnimaleseService);
  private readonly audio = inject(AudioService);
  private readonly supabase = inject(SupabaseService);
  private readonly document = inject(DOCUMENT);
  private readonly events = signal<CalendarEvent[]>([]);

  private realtimeChannel: RealtimeChannel | null = null;
  private isDestroyed = false;
  private loadInProgress = false;
  private reloadPending = false;

  readonly weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly deletingId = signal<string | null>(null);

  readonly loadError = signal('');
  readonly saveError = signal('');
  readonly actionError = signal('');
  readonly successMessage = signal('');
  readonly syncStatus = signal('Live-Verbindung wird aufgebaut …');

  displayedMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  selectedDate = new Date();
  readonly formOpen = signal(false);
  get isFormOpen(): boolean { return this.formOpen(); }
  set isFormOpen(value: boolean) { this.formOpen.set(value); }
  editingId: string | null = null;

  draftTitle = '';
  draftDate = '';
  draftTime = '';
  draftEndTime = '';
  draftOwner: EventOwner = 'Gemeinsam';

  ngOnInit(): void {
    void this.loadEvents();
    this.connectRealtime();
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.audio.setNewEvent(false);
    this.animalese.stop();

    if (this.realtimeChannel) {
      void this.supabase.client.removeChannel(this.realtimeChannel);
    }
  }

  @HostListener('window:focus')
  onWindowFocus(): void {
    this.refreshWhenVisible();
  }

  @HostListener('window:online')
  onOnline(): void {
    this.refreshWhenVisible();
  }

  @HostListener('window:offline')
  onOffline(): void {
    this.syncStatus.set('Offline · Live-Aktualisierung pausiert');
  }

  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    this.refreshWhenVisible();
  }

  get isBusy(): boolean {
    return this.isSaving() || this.deletingId() !== null;
  }

  get monthLabel(): string {
    return this.displayedMonth.toLocaleDateString('de-DE', {
      month: 'long',
      year: 'numeric',
    });
  }

  get selectedDateLabel(): string {
    return this.selectedDate.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  get days(): (number | null)[] {
    const year = this.displayedMonth.getFullYear();
    const month = this.displayedMonth.getMonth();
    const offset = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: (number | null)[] = Array(offset).fill(null);

    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    while (days.length % 7 !== 0) {
      days.push(null);
    }

    return days;
  }

  get selectedEvents(): CalendarEvent[] {
    const date = this.toDateKey(this.selectedDate);

    return this.events()
      .filter((event) => event.date === date)
      .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
  }

  async loadEvents(): Promise<void> {
    if (this.isDestroyed) return;

    if (this.isBusy || this.loadInProgress) {
      this.reloadPending = true;
      return;
    }

    this.loadInProgress = true;
    this.reloadPending = false;
    this.isLoading.set(true);
    this.loadError.set('');

    try {
      const events: CalendarEvent[] = [];
      const pageSize = 500;

      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await this.supabase.client
          .from('events')
          .select('*')
          .order('id')
          .range(offset, offset + pageSize - 1)
          .returns<CalendarEvent[]>();

        if (this.isDestroyed) return;
        if (error) throw error;

        const page = data ?? [];
        events.push(...page);

        if (page.length < pageSize) break;
      }

      this.events.set(events);
    } catch {
      if (!this.isDestroyed) {
        this.loadError.set('Die Termine konnten nicht geladen werden. Bitte versuche es erneut.');
      }
    } finally {
      this.loadInProgress = false;

      if (!this.isDestroyed) {
        this.isLoading.set(false);
        this.runPendingReload();
      }
    }
  }

  setTimeEnabled(enabled: boolean): void {
    this.draftTime = enabled ? '09:00' : '';
    if (!enabled) this.draftEndTime = '';
  }

  setEndTimeEnabled(enabled: boolean): void {
    this.draftEndTime = enabled ? this.draftTime : '';
    if (enabled && /^\d{2}:\d{2}$/.test(this.draftTime)) {
      const [h, m] = this.draftTime.split(':').map(Number);
      const total = Math.min(1439, h * 60 + m + 60);
      this.draftEndTime = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    }
  }

  private normalizeTime(value: string): string {
    return value.split(':').map(part => part.padStart(2, '0')).join(':');
  }

  setTimePart(part: 'hour' | 'minute', value: string, end = false): void {
    const [hour, minute] = (end ? this.draftEndTime : this.draftTime).split(':');
    const next = part === 'hour' ? `${value}:${minute}` : `${hour}:${value}`;
    if (end) this.draftEndTime = next;
    else this.draftTime = next;
  }

  adjustTime(minutes: number, end = false): void {
    const draft = end ? this.draftEndTime : this.draftTime;
    const value = /^([01]?\d|2[0-3]):([0-5]?\d)$/.test(draft) ? draft : '09:00';
    const [hour, minute] = value.split(':').map(Number);
    const total = ((hour * 60 + minute + minutes) % 1440 + 1440) % 1440;
    const next = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    if (end) this.draftEndTime = next;
    else this.draftTime = next;
  }

  changeMonth(direction: number): void {
    this.displayedMonth = new Date(
      this.displayedMonth.getFullYear(),
      this.displayedMonth.getMonth() + direction,
      1,
    );
  }

  goToToday(): void {
    const today = new Date();

    this.displayedMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    this.selectedDate = today;
  }

  selectDay(day: number): void {
    this.audio.playDayClick();
    this.selectedDate = new Date(
      this.displayedMonth.getFullYear(),
      this.displayedMonth.getMonth(),
      day,
    );
  }

  isToday(day: number): boolean {
    return this.isSameDay(day, new Date());
  }

  isSelected(day: number): boolean {
    return this.isSameDay(day, this.selectedDate);
  }

  readonly ownerChoices: readonly EventOwner[] = ['Gemeinsam', 'Philipp', 'Adriana'];
  readonly ownerLabels: Record<EventOwner, string> = {
    Philipp: 'Phjelepp',
    Adriana: 'Adrietz',
    Gemeinsam: 'Together',
  };

  readonly ownerIcons: Record<EventOwner, string> = {
    Philipp: 'images/huschke-head.png',
    Adriana: 'images/ione-head.png',
    Gemeinsam: 'https://dodo.ac/np/images/5/59/Emotion_Love_NH_Icon.png',
  };

  ownersOnDay(day: number): EventOwner[] {
    const key = this.toDateKey(
      new Date(this.displayedMonth.getFullYear(), this.displayedMonth.getMonth(), day),
    );
    return (['Philipp', 'Adriana', 'Gemeinsam'] as EventOwner[]).filter((owner) =>
      this.events().some((event) => event.date === key && event.owner === owner),
    );
  }

  eventsOnDay(day: number): CalendarEvent[] {
    const key = this.toDateKey(new Date(this.displayedMonth.getFullYear(), this.displayedMonth.getMonth(), day));
    return this.events().filter(event => event.date === key)
      .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
  }

  previewTitleParts(title: string): { text: string; keepTogether: boolean }[] {
    return title.split(/(\s+)/).filter(Boolean).map((text) => ({
      text,
      keepTogether: /^(?:[\p{P}\p{S}]{2,8}|[><^oO0Tt;:][._-][><^oO0Tt;:]|[:;=8xX][-^']?[)(/\\DPpOo]|[xX]D|[uUoO][wW][uUoO])$/u.test(text),
    }));
  }

  eventTitlesOnDay(day: number): string {
    return this.eventsOnDay(day).map(event => event.title).join(', ');
  }

  hasEvents(day: number): boolean {
    const date = this.toDateKey(
      new Date(this.displayedMonth.getFullYear(), this.displayedMonth.getMonth(), day),
    );

    return this.events().some((event) => event.date === date);
  }

  openNewEvent(): void {
    if (this.isBusy || this.isFormOpen) return;

    this.editingId = null;
    this.draftTitle = '';
    this.draftDate = this.toDateKey(this.selectedDate);
    this.draftTime = '';
    this.draftEndTime = '';
    this.draftOwner = 'Gemeinsam';

    this.clearMessages();
    this.isFormOpen = true;
    this.audio.setNewEvent(true);
  }

  editEvent(event: CalendarEvent): void {
    if (this.isBusy) return;

    if (
      this.isFormOpen &&
      !this.document.defaultView?.confirm(
        'Das offene Formular verwerfen und diesen Termin bearbeiten?',
      )
    ) {
      return;
    }

    this.audio.setNewEvent(false);
    this.animalese.stop();
    this.editingId = event.id;
    this.draftTitle = event.title;
    this.draftDate = event.date;
    this.draftTime = event.time?.slice(0, 5) ?? '';
    this.draftEndTime = event.end_time?.slice(0, 5) ?? '';
    this.draftOwner = event.owner;

    this.clearMessages();
    this.isFormOpen = true;
  }

  closeForm(): void {
    if (this.isBusy) return;

    this.audio.setNewEvent(false);
    this.animalese.stop();
    this.isFormOpen = false;
    this.editingId = null;
    this.saveError.set('');
  }

  async saveEvent(): Promise<void> {
    if (this.isBusy || this.isLoading()) return;

    const title = this.draftTitle.trim();
    const editingId = this.editingId;

    this.clearMessages();

    if (!title || title.length > 100 || !this.draftDate) {
      this.saveError.set('Bitte gib einen Titel und ein Datum ein.');
      return;
    }

    const [year, month, day] = this.draftDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    if (
      Number.isNaN(date.getTime()) ||
      year < 1900 ||
      year > 9999 ||
      this.toDateKey(date) !== this.draftDate
    ) {
      this.saveError.set('Bitte wähle ein gültiges Datum.');
      return;
    }

    if (this.draftTime && !/^([01]?\d|2[0-3]):([0-5]?\d)$/.test(this.draftTime)) {
      this.saveError.set('Bitte gib eine gültige Uhrzeit ein.');
      return;
    }

    const start = this.draftTime ? this.normalizeTime(this.draftTime) : null;
    const end = this.draftEndTime ? this.normalizeTime(this.draftEndTime) : null;
    if (end && (!start || !/^([01]?\d|2[0-3]):([0-5]?\d)$/.test(this.draftEndTime) || end <= start)) {
      this.saveError.set('Die Endzeit muss am selben Tag nach der Startzeit liegen.');
      return;
    }

    const existing = this.events().find(event => event.id === editingId);
    const values = {
      title,
      date: this.draftDate,
      time: start,
      ...(end || existing?.end_time !== undefined ? { end_time: end } : {}),
      owner: this.draftOwner,
    };

    this.isSaving.set(true);

    try {
      const query = editingId
        ? this.supabase.client.from('events').update(values).eq('id', editingId)
        : this.supabase.client.from('events').insert(values);

      const { data, error } = await query
        .select('*')
        .maybeSingle<CalendarEvent>();

      if (this.isDestroyed) return;
      if (error) throw error;

      if (!data) {
        this.saveError.set(
          'Der Termin ist nicht mehr verfügbar oder du hast keinen Zugriff. Bitte aktualisiere die Termine.',
        );
        this.reloadPending = true;
        return;
      }

      this.events.update((events) => [...events.filter((event) => event.id !== data.id), data]);

      this.selectedDate = date;
      this.displayedMonth = new Date(year, month - 1, 1);
      this.audio.setNewEvent(false);
      this.animalese.stop();
      this.isFormOpen = false;
      this.editingId = null;

      this.successMessage.set(
        editingId ? 'Dein Termin wurde geändert. 🌿' : 'Dein Termin wurde gespeichert. 🌿',
      );
    } catch (error: unknown) {
      if (this.isDestroyed) return;

      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'PGRST204') {
        this.saveError.set('Die Endzeit ist in dieser Datenbank noch nicht freigeschaltet.');
      } else if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '42501'
      ) {
        this.saveError.set(
          'Dein Konto hat keine Schreibberechtigung. Prüfe den Eintrag in calendar_members.',
        );
      } else {
        this.saveError.set(
          'Das Speichern konnte nicht bestätigt werden. Aktualisiere die Termine und prüfe den Stand vor einem erneuten Versuch.',
        );
      }
    } finally {
      if (!this.isDestroyed) {
        this.isSaving.set(false);
        this.runPendingReload();
      }
    }
  }

  async deleteEvent(event: CalendarEvent): Promise<void> {
    if (this.isBusy || this.isLoading()) return;

    const confirmed = this.document.defaultView?.confirm(
      `„${event.title}“ wirklich für euch beide löschen?`,
    );

    if (!confirmed) return;

    this.clearMessages();
    this.deletingId.set(event.id);

    try {
      const { data, error } = await this.supabase.client
        .from('events')
        .delete()
        .eq('id', event.id)
        .select('id')
        .maybeSingle<{ id: string }>();

      if (this.isDestroyed) return;
      if (error) throw error;

      if (!data) {
        this.actionError.set('Der Termin wurde bereits entfernt oder du hast keinen Zugriff.');
        this.reloadPending = true;
        return;
      }

      this.events.update((events) => events.filter((item) => item.id !== event.id));

      if (this.editingId === event.id) {
        this.audio.setNewEvent(false);
        this.animalese.stop();
        this.isFormOpen = false;
        this.editingId = null;
      }

      this.successMessage.set('Der Termin wurde gelöscht.');
    } catch {
      if (!this.isDestroyed) {
        this.actionError.set(
          'Das Löschen konnte nicht bestätigt werden. Bitte aktualisiere die Termine und prüfe den Stand.',
        );
      }
    } finally {
      if (!this.isDestroyed) {
        this.deletingId.set(null);
        this.runPendingReload();
      }
    }
  }

  private connectRealtime(): void {
    this.realtimeChannel = this.supabase.client
      .channel('terminook-events')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
        },
        () => {
          void this.loadEvents();
        },
      )
      .subscribe((status) => {
        if (this.isDestroyed) return;

        if (status === 'SUBSCRIBED') {
          this.syncStatus.set('Live verbunden 🌿');
          void this.loadEvents();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          this.syncStatus.set('Live-Verbindung unterbrochen · Bei Bedarf Termine aktualisieren');
        }
      });
  }

  private refreshWhenVisible(): void {
    if (this.document.visibilityState === 'visible') {
      void this.loadEvents();
    }
  }

  private runPendingReload(): void {
    if (this.reloadPending && !this.isDestroyed && !this.isBusy && !this.loadInProgress) {
      this.reloadPending = false;
      void this.loadEvents();
    }
  }

  private clearMessages(): void {
    this.saveError.set('');
    this.actionError.set('');
    this.successMessage.set('');
  }

  private isSameDay(day: number, date: Date): boolean {
    return (
      day === date.getDate() &&
      this.displayedMonth.getMonth() === date.getMonth() &&
      this.displayedMonth.getFullYear() === date.getFullYear()
    );
  }

  private toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}
