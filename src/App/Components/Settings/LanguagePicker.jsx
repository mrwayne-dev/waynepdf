import { useId } from 'react';
import { useProvided } from 'nonaction';
import { LanguageContainer } from '../../Container';
import { LANG_OPTIONS, DIRECTIONS } from '../../Container/Hooks/useLanguage.js';
import { LANG_LABELS } from '../../Lib/detectLanguage.js';

const DIRECTION_LABELS = { auto: 'Auto', ltr: 'LTR', rtl: 'RTL' };

/** Below ~0.5 the detector is guessing; do not put words in its mouth. */
const CONFIDENT_ENOUGH = 0.5;

export default function LanguagePicker() {
  const [
    { lang, direction, detectedLang, detectedConfidence },
    { setLang, setDirection },
  ] = useProvided(LanguageContainer);
  const selectId = useId();

  const detectedLabel =
    detectedConfidence >= CONFIDENT_ENOUGH
      ? (LANG_LABELS[detectedLang] ?? LANG_LABELS.und)
      : LANG_LABELS.und;

  return (
    <>
      <div className="wp-field">
        <div className="wp-field-head">
          <label className="wp-label" htmlFor={selectId}>
            Language
          </label>
        </div>
        <select
          id={selectId}
          className="wp-select wp-select-language"
          value={lang}
          onChange={(e) => setLang(e.target.value)}
        >
          {LANG_OPTIONS.map((id) => (
            <option key={id} value={id}>
              {id === 'auto' ? 'Auto' : LANG_LABELS[id]}
            </option>
          ))}
        </select>
        {lang === 'auto' && (
          <p className="wp-hint wp-detected-lang">Detected: {detectedLabel}</p>
        )}
      </div>

      <fieldset className="wp-fieldset">
        <legend className="wp-label">Text direction</legend>
        <div className="wp-pills">
          {DIRECTIONS.map((id) => (
            <label
              key={id}
              className={`wp-pill${direction === id ? ' is-active' : ''}`}
            >
              <input
                type="radio"
                name="wp-direction"
                value={id}
                checked={direction === id}
                onChange={() => setDirection(id)}
              />
              {DIRECTION_LABELS[id]}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}
