export default function NewDocumentButton({ onClick }) {
  return (
    <button
      type="button"
      className="wp-sidebar-new"
      onClick={onClick}
      title="New document (⌘N)"
    >
      <span aria-hidden="true">+</span> New Document
    </button>
  );
}
