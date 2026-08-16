import { useEffect, useRef } from 'react';
import { useProvided } from 'nonaction';
import { TextContainer } from '../Container';
import { parseFrontmatter, toOverrides } from '../Lib/parseFrontmatter.js';
import { setOverrides } from '../Lib/frontmatterOverrides.js';
import { toast } from './Toast.jsx';

/** Frontmatter is short and at the top; 300ms keeps typing responsive. */
const DEBOUNCE_MS = 300;

/**
 * Publishes frontmatter overrides as the document changes.
 *
 * Renders nothing. A component rather than an effect in App because App hosts
 * the Provider and so cannot read from it.
 *
 * Deliberately the only writer to the override store: one place decides what
 * the current document is asking for, and the three settings hooks just read.
 */
export default function FrontmatterWatcher() {
  const [text] = useProvided(TextContainer);
  const timer = useRef(null);
  // Only toast when the message changes, or every debounce tick would re-toast
  // the same syntax error while the user is still fixing it.
  const lastError = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const { frontmatter, error } = parseFrontmatter(text);
      setOverrides(toOverrides(frontmatter));

      if (error && error !== lastError.current) {
        toast(`Frontmatter parse error: ${error.split('\n')[0]}`);
      }
      lastError.current = error;
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer.current);
  }, [text]);

  return null;
}
