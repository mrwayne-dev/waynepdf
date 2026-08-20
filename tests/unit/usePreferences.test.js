import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import usePreferences, {
  SECTIONS,
  DEFAULT_SECTION,
} from '@/App/Container/Hooks/usePreferences.js';
import {
  __registeredResetNames,
  __getRegisteredReset as getRegisteredReset,
  __resetRegistryForTests,
} from '@/App/Lib/resetAll.js';

beforeEach(() => {
  __resetRegistryForTests();
});

const mount = () => renderHook(() => usePreferences());
const state = (r) => r.current[0];
const api = (r) => r.current[1];

describe('usePreferences', () => {
  it('starts closed on the default section with no search', () => {
    const { result } = mount();
    expect(state(result)).toEqual({
      open: false,
      activeSection: DEFAULT_SECTION,
      searchQuery: '',
    });
  });

  it('opens and closes', () => {
    const { result } = mount();
    act(() => api(result).open());
    expect(state(result).open).toBe(true);
    act(() => api(result).close());
    expect(state(result).open).toBe(false);
  });

  it('toggle flips the open state either way', () => {
    const { result } = mount();
    act(() => api(result).toggle());
    expect(state(result).open).toBe(true);
    act(() => api(result).toggle());
    expect(state(result).open).toBe(false);
  });

  it('opening twice does not lose the original opener', () => {
    /*
     * open() is idempotent on purpose. The gear button calls it, and a second
     * call while already open would otherwise record the *close* button as the
     * opener and return focus there after closing — into an element that no
     * longer exists.
     */
    const first = document.createElement('button');
    const second = document.createElement('button');
    document.body.append(first, second);
    const { result } = mount();

    first.focus();
    act(() => api(result).open());
    second.focus();
    act(() => api(result).open());

    act(() => api(result).close());
    let restored;
    act(() => {
      restored = api(result).restoreFocus();
    });
    expect(restored).toBe(true);
    expect(document.activeElement).toBe(first);
    first.remove();
    second.remove();
  });

  it('restoreFocus reports false when the opener is gone', () => {
    // The opener can be unmounted while preferences is up — a sidebar row's
    // gear, say, after a reset emptied the list.
    const button = document.createElement('button');
    document.body.append(button);
    const { result } = mount();
    button.focus();
    act(() => api(result).open());
    button.remove();

    let restored;
    act(() => {
      restored = api(result).restoreFocus();
    });
    expect(restored).toBe(false);
  });

  it.each(SECTIONS.map((s) => s.id))('setSection accepts %s', (id) => {
    const { result } = mount();
    act(() => api(result).setSection(id));
    expect(state(result).activeSection).toBe(id);
  });

  it('setSection ignores an unknown id', () => {
    // An unknown id would render an empty pane under a rail with nothing
    // selected, which reads as a broken window rather than a no-op.
    const { result } = mount();
    act(() => api(result).setSection('layout'));
    act(() => api(result).setSection('not-a-section'));
    expect(state(result).activeSection).toBe('layout');
  });

  it('setSearch stores the query and coerces nullish to empty', () => {
    const { result } = mount();
    act(() => api(result).setSearch('font'));
    expect(state(result).searchQuery).toBe('font');
    act(() => api(result).setSearch(undefined));
    expect(state(result).searchQuery).toBe('');
  });

  it('registers a resetter', () => {
    mount();
    expect(__registeredResetNames()).toContain('preferences');
  });

  it('reset restores the default section and clears the search', async () => {
    const { result } = mount();
    act(() => {
      api(result).setSection('about');
      api(result).setSearch('license');
    });

    await act(async () => {
      await getRegisteredReset('preferences')();
    });

    expect(state(result).activeSection).toBe(DEFAULT_SECTION);
    expect(state(result).searchQuery).toBe('');
  });

  it('reset leaves an open window open', () => {
    /*
     * Reset is triggered from this window's own footer. Closing it as part of
     * the reset would yank the surface out from under the user mid-action; the
     * page reload that follows is what actually dismisses it.
     */
    const { result } = mount();
    act(() => api(result).open());
    act(() => getRegisteredReset('preferences')());
    expect(state(result).open).toBe(true);
  });
});
