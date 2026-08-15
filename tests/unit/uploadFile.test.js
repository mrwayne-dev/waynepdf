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

  it('throws when no CodeMirror element is mounted (documents the coupling)', () => {
    document.body.innerHTML = '';
    expect(() => uploadFile('x')).toThrow();
  });

  // REGRESSION: React 18 StrictMode + react-codemirror2 v8 leave two connected
  // .CodeMirror nodes, and only the last is wired to onChange. Writing to the
  // first (upstream's querySelector) silently broke upload and drag-and-drop.
  it('writes to the LAST CodeMirror instance when several are mounted', () => {
    const staleSetValue = vi.fn();
    const stale = document.createElement('div');
    stale.className = 'CodeMirror';
    stale.CodeMirror = { setValue: staleSetValue };
    // Insert the stale instance BEFORE the live one from beforeEach.
    document.body.insertBefore(stale, document.body.firstChild);

    uploadFile('# live');

    expect(staleSetValue).not.toHaveBeenCalled();
    expect(setValue).toHaveBeenCalledWith('# live');
  });
});
