import { forwardRef } from 'react';

const SearchIcon = () => (
  <svg
    className="wp-prefs-search-icon"
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    aria-hidden="true"
  >
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5 14 14" strokeLinecap="round" />
  </svg>
);

/**
 * Title, search, close.
 *
 * The search input takes the ref because focus lands there on open: it is the
 * one control that is useful without knowing where anything is, which is the
 * situation a user is in when they open preferences looking for one setting.
 */
const PreferencesHeader = forwardRef(function PreferencesHeader(
  { query, onQueryChange, onClose },
  searchRef,
) {
  return (
    <header className="wp-prefs-head">
      <h2 className="wp-prefs-title" id="wp-prefs-title">
        Preferences
      </h2>

      <div className="wp-prefs-search">
        <div className="wp-prefs-search-field">
          <SearchIcon />
          <input
            ref={searchRef}
            type="search"
            className="wp-prefs-search-input"
            placeholder="Search preferences"
            aria-label="Search preferences"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
        </div>
      </div>

      <button
        type="button"
        className="wp-prefs-close"
        onClick={onClose}
        aria-label="Close preferences"
      >
        &times;
      </button>
    </header>
  );
});

export default PreferencesHeader;
