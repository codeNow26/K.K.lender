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
  it('speaks Android composing input without repeating unchanged text', () => {
    const service = TestBed.inject(AnimaleseService);
    const field = document.createElement('input');
    document.body.appendChild(field);
    field.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    field.addEventListener('input', event => service.onInput(event));
    field.value = 'h';
    field.dispatchEvent(new InputEvent('input', { inputType: 'insertCompositionText', data: 'h', isComposing: true }));
    field.value = 'ha';
    field.dispatchEvent(new InputEvent('input', { inputType: 'insertCompositionText', data: 'ha', isComposing: true }));
    field.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: 'ha' }));
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
    field.remove();
  });

  it('allows forced login sounds even when calendar Animalese is disabled', () => {
    const service = TestBed.inject(AnimaleseService);
    service.toggle();
    service.onInput(new InputEvent('input', { inputType: 'insertText', data: '4' }), true, true);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce();
  });
});
