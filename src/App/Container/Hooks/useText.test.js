import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import useText from './useText.js';
import { initialText } from './InitialText.js';
import { clearAll } from '../../Lib/db.js';

/*
 * Originally ported from the upstream project's useText test. useText is no
 * longer the source of truth — it proxies the active document — so these now
 * assert that the `[text, setText]` pair still behaves identically from a
 * consumer's point of view, which is the whole contract of the refactor.
 */

beforeEach(async () => {
  await clearAll();
});

/** Documents load asynchronously; nothing is meaningful before that. */
const mount = async () => {
  const rendered = renderHook(() => useText());
  await waitFor(() => expect(rendered.result.current[2].ready).toBe(true));
  return rendered;
};

describe('useText', () => {
  it('should set initial', async () => {
    const { result } = await mount();
    expect(result.current[0]).toEqual(initialText);
  });

  it('should change text', async () => {
    const { result } = await mount();
    await act(async () => result.current[1]('work'));
    expect(result.current[0]).toBe('work');
  });

  it('keeps setText identity stable, as its consumers depend on', async () => {
    const { result, rerender } = await mount();
    const setText = result.current[1];
    rerender();
    expect(result.current[1]).toBe(setText);
  });

  it('reads through to whichever document is active', async () => {
    const { result } = await mount();
    await act(async () => result.current[1]('first'));

    let secondId;
    await act(async () => {
      secondId = result.current[2].create();
    });
    await act(async () => {
      await result.current[2].open(secondId);
    });
    expect(result.current[0]).toBe('');

    await act(async () => result.current[1]('second'));
    expect(result.current[0]).toBe('second');

    // Switching back must show the first document's text, not the last thing
    // typed anywhere.
    await act(async () => {
      await result.current[2].open(result.current[2].documents[0].id);
    });
    expect(result.current[0]).toBe('first');
  });

  it('writes through to the active document record', async () => {
    const { result } = await mount();
    await act(async () => result.current[1]('# Written'));
    expect(result.current[2].activeDocument.body).toBe('# Written');
  });
});
