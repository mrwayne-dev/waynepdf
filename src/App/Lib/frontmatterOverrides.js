/*
 * Per-document setting overrides, driven by YAML frontmatter.
 *
 * A module-level store rather than a nonaction container, for a structural
 * reason: container hooks all run inside the Provider, above the context they
 * populate, so useTheme cannot read a FrontmatterContainer (Phase 3 hit the same
 * wall with useLanguage). The alternative — merging overrides at every consumer
 * — would scatter the precedence rule across a dozen components. Here each of
 * the three settings hooks subscribes once and merges in one place.
 *
 * Nothing here is persisted. Overrides live only as long as the document that
 * declared them: delete the frontmatter block and the user's own settings come
 * straight back.
 */

let overrides = {};
const listeners = new Set();

/** Keys we act on. Anything else in the frontmatter is ignored silently. */
export const OVERRIDABLE = {
  theme: 'theme',
  lang: 'language',
  dir: 'language',
  pageSize: 'layout',
  orientation: 'layout',
  margin: 'layout',
  toc: 'layout',
  watermark: 'layout',
  title: 'layout',
  subtitle: 'layout',
  author: 'layout',
  date: 'layout',
  cover: 'layout',
};

export function getOverrides() {
  return overrides;
}

export function setOverrides(next) {
  const value = next && typeof next === 'object' ? next : {};
  // Reference equality is the cheap guard against re-rendering three containers
  // on every keystroke that leaves the frontmatter untouched.
  if (shallowEqualJSON(value, overrides)) return;
  overrides = value;
  for (const fn of listeners) fn(overrides);
}

export function clearOverrides() {
  setOverrides({});
}

export function subscribeOverrides(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * JSON comparison rather than a deep walk: the values are YAML scalars and
 * small plain objects, so serialising is both correct and cheaper than the
 * recursion it replaces.
 */
function shallowEqualJSON(a, b) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/** Test-only reset so suites do not leak overrides into each other. */
export function __resetOverridesForTests() {
  overrides = {};
  listeners.clear();
}
