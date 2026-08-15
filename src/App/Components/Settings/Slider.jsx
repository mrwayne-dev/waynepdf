import { useId } from 'react';

/**
 * A labelled range input with its current value shown numerically.
 *
 * `format` exists because the three sliders read differently: sizes want
 * "16px", line height wants "1.60". The readout is aria-hidden and the value is
 * carried to assistive tech by aria-valuetext instead, so it is announced once
 * rather than twice.
 */
export default function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format = (v) => String(v),
}) {
  const id = useId();
  return (
    <div className="wp-field">
      <div className="wp-field-head">
        <label className="wp-label" htmlFor={id}>
          {label}
        </label>
        <span className="wp-readout" aria-hidden="true">
          {format(value)}
        </span>
      </div>
      <input
        id={id}
        type="range"
        className="wp-range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={format(value)}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
