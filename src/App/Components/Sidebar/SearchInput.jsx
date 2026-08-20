const SearchIcon = () => (
  <svg
    className="wp-sidebar-search-icon"
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
 * Filters the document list by title.
 *
 * A plain substring match. Fuzzy matching sounds better than it reads: with a
 * handful of documents it mostly surfaces the ones you did not mean, and the
 * titles here are derived from first headings, so they are already the words
 * the user would type.
 */
export default function SearchInput({ value, onChange }) {
  return (
    <div className="wp-sidebar-search">
      <SearchIcon />
      <input
        type="search"
        className="wp-sidebar-search-input"
        placeholder="Search documents"
        aria-label="Search documents"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {value ? (
        <button
          type="button"
          className="wp-sidebar-search-clear"
          aria-label="Clear search"
          onClick={() => onChange('')}
        >
          &times;
        </button>
      ) : null}
    </div>
  );
}
