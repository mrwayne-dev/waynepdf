import { useProvided } from 'nonaction';
import { EncodingBannerContainer } from '../Container';
import './EncodingBanner.css';

/**
 * One-line notice above the editor after a file load.
 *
 * `role="status"` rather than `alert` even for the warning variant: the text is
 * already on screen and readable, so interrupting the screen reader mid-sentence
 * would be worse than announcing it politely.
 */
export default function EncodingBanner() {
  const [banner, { dismissBanner }] = useProvided(EncodingBannerContainer);
  if (!banner) return null;

  return (
    <div
      className={`wp-encoding-banner no-print is-${banner.variant}`}
      role="status"
      aria-live="polite"
    >
      <span className="wp-encoding-banner-text">{banner.message}</span>
      <button
        type="button"
        className="wp-encoding-banner-close"
        onClick={dismissBanner}
        aria-label="Dismiss notice"
      >
        &times;
      </button>
    </div>
  );
}
