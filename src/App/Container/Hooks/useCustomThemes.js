import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import {
  PRESET_PALETTES,
  PRESET_NAMES,
  EDITABLE_TOKENS,
} from '../../Lib/presetPalettes.js';
import { applyCustomThemeCSS } from '../../Lib/generateCustomThemeCSS.js';
import { registerReset, unregisterReset } from '../../Lib/resetAll.js';

/*
 * User-made palettes.
 *
 * A custom theme is a preset plus a partial override map — not a free-form
 * palette. That keeps the editor to eight colour rows instead of fifteen, and it
 * means a token the user never touched keeps tracking its base, so a theme built
 * on Dark still has Dark's borders and blockquote colours.
 *
 * localStorage rather than IndexedDB: the whole set is a few kilobytes, and it
 * has to be readable synchronously during the first render for the same reason
 * theme settings are — reading it in an effect would paint one frame of the
 * wrong palette.
 */

export const CUSTOM_THEMES_KEY = 'waynepdf.customThemes.v1';

/**
 * Ten.
 *
 * Not a technical limit — the swatch row is one wrapping flex line in a 320px
 * panel, and past ten the row is taller than the section it belongs to. Also
 * bounds the generated stylesheet, which is regenerated in full on every edit.
 */
export const MAX_CUSTOM_THEMES = 10;

export const MAX_NAME_LENGTH = 30;

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * Coerces one stored record, or returns null to drop it.
 *
 * localStorage is hostile input — anything on the origin can write to it — and a
 * malformed theme would otherwise emit broken CSS that breaks the *whole*
 * stylesheet, not just its own block. Dropping is silent by design: this runs at
 * boot, where there is nothing useful to say and nobody to say it to.
 */
export function normalizeCustomTheme(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.id !== 'string' || raw.id.length === 0) return null;

  const name =
    typeof raw.name === 'string'
      ? raw.name.trim().slice(0, MAX_NAME_LENGTH)
      : '';
  if (!name) return null;

  const basedOn = PRESET_NAMES.includes(raw.basedOn) ? raw.basedOn : 'light';

  // Only the eight editable tokens, and only well-formed hex. An override on a
  // token the editor cannot reach would be unremovable through the UI.
  const overrides = {};
  const rawOverrides =
    raw.overrides && typeof raw.overrides === 'object' ? raw.overrides : {};
  for (const token of EDITABLE_TOKENS) {
    const value = rawOverrides[token];
    if (typeof value === 'string' && HEX.test(value)) overrides[token] = value;
  }

  const now = Date.now();
  return {
    id: raw.id,
    name,
    basedOn,
    overrides,
    createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : now,
    updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : now,
  };
}

export function loadCustomThemes() {
  let stored;
  try {
    stored = window.localStorage.getItem(CUSTOM_THEMES_KEY);
  } catch {
    return [];
  }
  if (stored == null) return [];
  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeCustomTheme)
      .filter(Boolean)
      .slice(0, MAX_CUSTOM_THEMES);
  } catch {
    return [];
  }
}

export function saveCustomThemes(themes) {
  try {
    window.localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(themes));
  } catch {
    /* best effort, same as every other settings key */
  }
}

/** The value a token currently resolves to for a theme: override, else base. */
export function resolvedToken(theme, token) {
  const base = PRESET_PALETTES[theme?.basedOn] ?? PRESET_PALETTES.light;
  return theme?.overrides?.[token] ?? base[token];
}

const useCustomThemes = () => {
  // Synchronous init and an immediate first apply, so the stylesheet exists
  // before anything can select a custom theme.
  const [themes, setThemes] = useState(() => {
    const initial = loadCustomThemes();
    applyCustomThemeCSS(initial);
    return initial;
  });

  /*
   * A synchronous mirror of `themes`.
   *
   * The updaters below validate against the current list and return a result to
   * their caller — "name taken", "at the limit" — so they cannot do that work
   * inside a setState updater: React is free to defer the updater until render,
   * and a value assigned in there is not readable on the next line. Reading one
   * anyway is how the first version of this hook reported "Could not create the
   * theme" instead of the real reason. useDocuments keeps the same kind of
   * mirror for the same reason.
   */
  const themesRef = useRef(themes);

  /** The single write path: mirror, state, storage and stylesheet together. */
  const commit = useCallback((next) => {
    themesRef.current = next;
    setThemes(next);
    saveCustomThemes(next);
    applyCustomThemeCSS(next);
    return next;
  }, []);

  const updaters = useMemo(() => {
    const nameTaken = (name, exceptId) =>
      themesRef.current.some(
        (t) => t.id !== exceptId && t.name.toLowerCase() === name.toLowerCase(),
      );

    const checkName = (name, exceptId) => {
      if (!name) return 'Name is required.';
      if (name.length > MAX_NAME_LENGTH) {
        return `Name must be ${MAX_NAME_LENGTH} characters or fewer.`;
      }
      if (nameTaken(name, exceptId)) return 'A theme with that name exists.';
      return null;
    };

    return {
      /** @returns {{ok: true, id: string} | {ok: false, error: string}} */
      create: ({ name, basedOn = 'light', overrides = {} } = {}) => {
        const clean = typeof name === 'string' ? name.trim() : '';
        if (themesRef.current.length >= MAX_CUSTOM_THEMES) {
          return {
            ok: false,
            error: 'Custom theme limit reached. Delete one to create another.',
          };
        }
        const problem = checkName(clean);
        if (problem) return { ok: false, error: problem };

        const now = Date.now();
        const created = normalizeCustomTheme({
          id: uuid(),
          name: clean,
          basedOn,
          overrides,
          createdAt: now,
          updatedAt: now,
        });
        if (!created)
          return { ok: false, error: 'Could not create the theme.' };

        commit([...themesRef.current, created]);
        return { ok: true, id: created.id };
      },

      update: (id, patch = {}) => {
        const current = themesRef.current;
        const index = current.findIndex((t) => t.id === id);
        if (index === -1) return { ok: false, error: 'Theme not found.' };

        const renaming = typeof patch.name === 'string';
        const clean = renaming ? patch.name.trim() : undefined;
        if (renaming) {
          const problem = checkName(clean, id);
          if (problem) return { ok: false, error: problem };
        }

        const merged = normalizeCustomTheme({
          ...current[index],
          ...patch,
          ...(renaming ? { name: clean } : {}),
          id,
          createdAt: current[index].createdAt,
          updatedAt: Date.now(),
        });
        if (!merged) return { ok: false, error: 'Invalid theme.' };

        const next = [...current];
        next[index] = merged;
        commit(next);
        return { ok: true, id };
      },

      remove: (id) => {
        const next = themesRef.current.filter((t) => t.id !== id);
        if (next.length === themesRef.current.length) {
          return { ok: false, error: 'Theme not found.' };
        }
        commit(next);
        return { ok: true };
      },

      /** In-memory only; resetAll has already cleared the storage key. */
      reset: () => {
        themesRef.current = [];
        setThemes([]);
        applyCustomThemeCSS([]);
      },
    };
  }, [commit]);

  useEffect(() => {
    registerReset('customThemes', updaters.reset);
    return () => unregisterReset('customThemes');
  }, [updaters]);

  const byId = useMemo(
    () => new Map(themes.map((theme) => [theme.id, theme])),
    [themes],
  );

  return [
    {
      themes,
      byId,
      count: themes.length,
      atLimit: themes.length >= MAX_CUSTOM_THEMES,
      limit: MAX_CUSTOM_THEMES,
    },
    updaters,
  ];
};

export default useCustomThemes;
