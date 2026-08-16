export default function NewTabButton({ onClick }) {
  return (
    <button
      type="button"
      className="wp-tab-new"
      aria-label="New document"
      title="New document"
      onClick={onClick}
    >
      +
    </button>
  );
}
