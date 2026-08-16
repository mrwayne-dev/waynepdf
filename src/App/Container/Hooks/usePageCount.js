import { useState, useCallback, useMemo } from 'react';

/**
 * How many pages the last pagination produced.
 *
 * Its own container rather than a field on LayoutContainer because it is
 * derived runtime state, not a setting: it must never be normalised, validated
 * or written to localStorage. The Paginator produces it and the Header consumes
 * it, and they are siblings, so it has to live above both.
 */
const usePageCount = () => {
  const [pageCount, setCount] = useState(0);
  const setPageCount = useCallback((n) => setCount(Number(n) || 0), []);
  const actions = useMemo(() => ({ setPageCount }), [setPageCount]);
  return [pageCount, actions];
};

export default usePageCount;
