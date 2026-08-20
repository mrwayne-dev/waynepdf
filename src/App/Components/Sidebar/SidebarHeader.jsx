/**
 * The wordmark, and only the wordmark.
 *
 * Product identity belongs to the shell, not to the document surface — which is
 * why the top bar loses it in 7.2. 52px so it lines up with the preferences
 * header when that window is open.
 */
export default function SidebarHeader() {
  return (
    <header className="wp-sidebar-head">
      <p className="wp-sidebar-wordmark">WaynePDF</p>
    </header>
  );
}
