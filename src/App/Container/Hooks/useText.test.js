import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useText from './useText.js';
import { initialText } from './InitialText.js';

// Ported from upstream md2pdf src/App/Container/Hooks/useText.test.js,
// updated for React 18 (@testing-library/react now ships renderHook, so
// @testing-library/react-hooks is no longer needed).

describe('useText', () => {
  it('should set initial', () => {
    const { result } = renderHook(() => useText());
    expect(result.current[0]).toEqual(initialText);
  });

  it('should change text', () => {
    const { result } = renderHook(() => useText());
    act(() => result.current[1]('work'));
    expect(result.current[0]).toBe('work');
  });

  it('should accept an explicit initial value', () => {
    const { result } = renderHook(() => useText('# custom'));
    expect(result.current[0]).toBe('# custom');
  });
});
