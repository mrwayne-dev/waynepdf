import { useEffect } from 'react';
import { useProvided } from 'nonaction';
import { LayoutContainer } from '../Container';
import { applyLayoutCSS } from '../Lib/generateLayoutCSS.js';

/**
 * Keeps <style id="wp-layout-styles"> in sync with layout settings.
 *
 * Renders nothing. It exists as a component rather than an effect in App
 * because App hosts the Provider and therefore cannot read from it — the
 * containers are populated in the same render that creates the context.
 *
 * The generated CSS is also passed directly to paged.js at pagination time;
 * this copy is what makes the plain fragmentation properties (break-before,
 * orphans, widows) apply to the live DOM, and makes the whole sheet
 * inspectable in devtools and in tests.
 */
export default function LayoutStyles() {
  const [layout] = useProvided(LayoutContainer);

  useEffect(() => {
    applyLayoutCSS(layout);
  }, [layout]);

  return null;
}
