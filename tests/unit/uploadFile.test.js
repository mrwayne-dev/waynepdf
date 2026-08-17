import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import uploadFile from '@/App/Lib/uploadFile.js';

// uploadFile reaches into the DOM for CodeMirror's instance rather than going
// through React state — upstream calls this a "Little dirty solution".
// These tests pin the contract so a later refactor has something to break.

describe('uploadFile', () => {
  let setValue;

  beforeEach(() => {
    setValue = vi.fn();
    const el = document.createElement('div');
    el.className = 'CodeMirror';
    el.CodeMirror = { setValue };
    document.body.appendChild(el);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('writes the given value into the CodeMirror instance', () => {
    uploadFile('# hello');
    expect(setValue).toHaveBeenCalledTimes(1);
    expect(setValue).toHaveBeenCalledWith('# hello');
  });

  it('passes content through verbatim, including Unicode', () => {
    uploadFile('反選頁首與頁尾 ☕');
    expect(setValue).toHaveBeenCalledWith('反選頁首與頁尾 ☕');
  });

  it('passes an empty string through unchanged', () => {
    uploadFile('');
    expect(setValue).toHaveBeenCalledWith('');
  });

  it('reports rather than throws when no CodeMirror element is mounted', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    document.body.innerHTML = '';
    expect(() => uploadFile('x')).not.toThrow();
    // Silence here would make a dropped file simply vanish.
    expect(error).toHaveBeenCalled();
  });

  it('ignores a .CodeMirror node with no editor attached', () => {
    const bare = document.createElement('div');
    bare.className = 'CodeMirror';
    document.body.appendChild(bare);
    expect(() => uploadFile('# ok')).not.toThrow();
    expect(setValue).toHaveBeenCalledWith('# ok');
  });

  /*
   * REGRESSION (Phase 6.5c). StrictMode + react-codemirror2 v8 leave two
   * connected .CodeMirror nodes. Phase 0 wrote to the LAST one, reasoning that
   * the live instance is the newest — true at first mount, and false after
   * Phase 6b.2 made a tab switch remount the editor. Which node survives is not
   * deterministic, so neither "first" nor "last" is a safe choice and dropping a
   * file after switching tabs silently did nothing.
   *
   * Writing to all of them is what makes it deterministic. Unmounted instances
   * accept the value and emit no change event, so exactly one dispatch reaches
   * the store however the nodes happen to be ordered.
   */
  it('writes to EVERY mounted CodeMirror instance, not one chosen by position', () => {
    const otherSetValue = vi.fn();
    const other = document.createElement('div');
    other.className = 'CodeMirror';
    other.CodeMirror = { setValue: otherSetValue };
    document.body.insertBefore(other, document.body.firstChild);

    uploadFile('# live');

    expect(otherSetValue).toHaveBeenCalledWith('# live');
    expect(setValue).toHaveBeenCalledWith('# live');
  });

  it('writes to all three when a third turns up', () => {
    const calls = [];
    for (const tag of ['a', 'b']) {
      const el = document.createElement('div');
      el.className = 'CodeMirror';
      el.CodeMirror = { setValue: (v) => calls.push([tag, v]) };
      document.body.appendChild(el);
    }
    uploadFile('# all');
    expect(calls).toEqual([
      ['a', '# all'],
      ['b', '# all'],
    ]);
    expect(setValue).toHaveBeenCalledWith('# all');
  });
});
