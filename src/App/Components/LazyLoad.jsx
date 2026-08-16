import './LazyLoad.css';

/**
 * The single loading state for every lazily-loaded chunk.
 *
 * Phase 5 shipped its own inline "Loading paginator…" string; Phase 6 adds
 * Mermaid (~280 KB) and pandoc-wasm (~5 MB) on top. Three bespoke loading
 * states with three different cost profiles is how an app starts feeling
 * unpredictable, so they all route through here.
 *
 * `estimatedKb` is optional and deliberately only shown when supplied: a
 * pure compute step like pagination has no download cost, and inventing a
 * number for it would be worse than showing none.
 *
 * No progress bar. These are single fetches with no readable progress, so a bar
 * would have to fake its motion — a spinner is honest about not knowing.
 */
export default function LazyLoad({ label, estimatedKb }) {
  const size =
    typeof estimatedKb === 'number' && estimatedKb > 0
      ? estimatedKb >= 1024
        ? `≈ ${(estimatedKb / 1024).toFixed(1)} MB`
        : `≈ ${estimatedKb} KB`
      : null;

  return (
    <div className="wp-lazyload no-print" role="status" aria-live="polite">
      <span className="wp-lazyload-spinner" aria-hidden="true" />
      <span className="wp-lazyload-label">{label}</span>
      {size && <span className="wp-lazyload-size">{size}</span>}
    </div>
  );
}
