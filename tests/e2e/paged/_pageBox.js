/**
 * Page geometry in page units, not screen units.
 *
 * The paginated preview scales each sheet to fit the pane (`--wp-page-fit`, set
 * by Paginator.jsx), so `boundingBox()` returns a *scaled* rect. Assertions
 * about page geometry are about paper — "A4 portrait is about 794x1123 at
 * 96dpi", "A5 is narrower than A4" — and paper is never scaled: the fit is
 * screen-only CSS.
 *
 * Reading the scaled rect instead makes those assertions wrong in a way that is
 * easy to miss, because the fit is not constant. A5 gets a *larger* fit factor
 * than A4 precisely because it is smaller, so "A5 renders narrower than A4"
 * flips to false on screen while remaining true on paper.
 *
 * So divide the fit back out rather than mutating the DOM to disable it:
 * toggling the custom property would wake the component's ResizeObserver and
 * race the measurement.
 */

/** The fit currently applied to the sheets, or 1 when none is. */
export const pageFit = (page) =>
  page.evaluate(() => {
    const out = document.querySelector('.paginator-output');
    const value = Number(out?.style.getPropertyValue('--wp-page-fit'));
    return Number.isFinite(value) && value > 0 ? value : 1;
  });

/**
 * The nth sheet's box in page units.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} [index] zero-based sheet index
 */
export async function pageBox(page, index = 0) {
  const box = await page.locator('.pagedjs_page').nth(index).boundingBox();
  if (!box) return null;
  const fit = await pageFit(page);
  return {
    x: box.x / fit,
    y: box.y / fit,
    width: box.width / fit,
    height: box.height / fit,
  };
}

/**
 * Every sheet's box plus its descendants', all in page units.
 *
 * Used by the spill checks, which compare element rects against their page's
 * rect. Both are scaled by the same factor so the comparison survives scaling —
 * but the tolerances those checks allow are expressed in page pixels, and a
 * tolerance shrinks along with everything else when the sheet is scaled down.
 * Dividing the fit out keeps a 1px tolerance meaning one page pixel.
 */
export async function pageBoxesWithContent(page, selector) {
  const fit = await pageFit(page);
  const raw = await page.evaluate((sel) => {
    const rect = (el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    };
    return [...document.querySelectorAll('.pagedjs_page')].map((pg) => ({
      page: rect(pg),
      children: [...pg.querySelectorAll(sel)]
        .filter((el) => el.getBoundingClientRect().height > 0)
        .map((el) => ({ tag: el.tagName.toLowerCase(), ...rect(el) })),
    }));
  }, selector);

  const scale = (r) => ({
    top: r.top / fit,
    bottom: r.bottom / fit,
    left: r.left / fit,
    right: r.right / fit,
  });
  return raw.map((entry) => ({
    page: scale(entry.page),
    children: entry.children.map((c) => ({ tag: c.tag, ...scale(c) })),
  }));
}
