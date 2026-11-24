import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AnimaleseService } from './animalese.service';

describe('Animalese', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('speaks individual typed letters, including umlauts, but ignores paste and deletion', () => {
    const service = TestBed.inject(AnimaleseService);
    service.onInput(new InputEvent('input', { inputType: 'insertText', data: 'ä' }));
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce();
    service.onInput(new InputEvent('input', { inputType: 'insertFromPaste', data: 'hello' }));
    service.onInput(new InputEvent('input', { inputType: 'deleteContentBackward' }));
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce();
    service.toggle();
    service.onInput(new InputEvent('input', { inputType: 'insertText', data: 'a' }));
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce();
    expect(localStorage.getItem('kklender-animalese')).toBe('false');
  });
});
