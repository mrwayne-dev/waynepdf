import { useId, useState } from 'react';
import { useProvided } from 'nonaction';
import { LayoutContainer } from '../../Container';
import {
  PAGE_SIZES,
  ORIENTATIONS,
  MARGIN_PRESET_NAMES,
} from '../../Container/Hooks/useLayout.js';

const PAGE_SIZE_LABELS = {
  a4: 'A4',
  letter: 'Letter',
  legal: 'Legal',
  a5: 'A5',
  a3: 'A3',
  custom: 'Custom',
};
const MARGIN_LABELS = {
  small: 'Small',
  normal: 'Normal',
  wide: 'Wide',
  custom: 'Custom',
};
const PLACEHOLDER_HINT = 'Placeholders: {title}, {page}, {pages}, {date}';

/** Pill group, matching the font-family and direction pickers. */
function Pills({ name, value, options, labels, onChange }) {
  return (
    <div className="wp-pills">
      {options.map((id) => (
        <label
          key={id}
          className={`wp-pill${value === id ? ' is-active' : ''}`}
        >
          <input
            type="radio"
            name={name}
            value={id}
            checked={value === id}
            onChange={() => onChange(id)}
          />
          {labels[id]}
        </label>
      ))}
    </div>
  );
}

/**
 * Collapsed by default. This is UI state, not a preference, so it is
 * deliberately not persisted — the panel already has nine sections and
 * remembering which were open across reloads would be more surprising than
 * helpful.
 */
function Collapsible({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="wp-collapsible">
      <button
        type="button"
        className="wp-collapsible-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="wp-collapsible-caret">{open ? '▾' : '▸'}</span>
        {title}
      </button>
      {open && <div className="wp-collapsible-body">{children}</div>}
    </div>
  );
}

function NumberField({ label, value, onChange, min = 0, max = 2000 }) {
  const id = useId();
  return (
    <div className="wp-number">
      <label className="wp-number-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        className="wp-number-input"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function TextField({ label, value, onChange, placeholder }) {
  const id = useId();
  return (
    <div className="wp-field">
      <label className="wp-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="text"
        className="wp-text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export default function LayoutPicker() {
  const [layout, u] = useProvided(LayoutContainer);
  const pageSizeId = useId();
  const marginId = useId();

  return (
    <>
      <fieldset className="wp-fieldset">
        <legend className="wp-label">Preview mode</legend>
        <Pills
          name="wp-preview-mode"
          value={layout.previewMode}
          options={['flowing', 'paged']}
          labels={{ flowing: 'Flowing', paged: 'Paged' }}
          onChange={u.setPreviewMode}
        />
      </fieldset>

      <div className="wp-field">
        <label className="wp-label" htmlFor={pageSizeId}>
          Page size
        </label>
        <select
          id={pageSizeId}
          className="wp-select wp-select-page-size"
          value={layout.pageSize}
          onChange={(e) => u.setPageSize(e.target.value)}
        >
          {PAGE_SIZES.map((id) => (
            <option key={id} value={id}>
              {PAGE_SIZE_LABELS[id]}
            </option>
          ))}
        </select>
        {layout.pageSize === 'custom' && (
          <div className="wp-number-grid">
            <NumberField
              label="Width (mm)"
              value={layout.customWidth}
              onChange={u.setCustomWidth}
              min={20}
            />
            <NumberField
              label="Height (mm)"
              value={layout.customHeight}
              onChange={u.setCustomHeight}
              min={20}
            />
          </div>
        )}
      </div>

      <fieldset className="wp-fieldset">
        <legend className="wp-label">Orientation</legend>
        <Pills
          name="wp-orientation"
          value={layout.orientation}
          options={ORIENTATIONS}
          labels={{ portrait: 'Portrait', landscape: 'Landscape' }}
          onChange={u.setOrientation}
        />
      </fieldset>

      <div className="wp-field">
        <label className="wp-label" htmlFor={marginId}>
          Margins
        </label>
        <select
          id={marginId}
          className="wp-select wp-select-margins"
          value={layout.marginPreset}
          onChange={(e) => u.setMarginPreset(e.target.value)}
        >
          {MARGIN_PRESET_NAMES.map((id) => (
            <option key={id} value={id}>
              {MARGIN_LABELS[id]}
            </option>
          ))}
        </select>
        {layout.marginPreset === 'custom' && (
          <div className="wp-number-grid">
            <NumberField
              label="Top"
              value={layout.marginTop}
              onChange={u.setMarginTop}
              max={100}
            />
            <NumberField
              label="Right"
              value={layout.marginRight}
              onChange={u.setMarginRight}
              max={100}
            />
            <NumberField
              label="Bottom"
              value={layout.marginBottom}
              onChange={u.setMarginBottom}
              max={100}
            />
            <NumberField
              label="Left"
              value={layout.marginLeft}
              onChange={u.setMarginLeft}
              max={100}
            />
          </div>
        )}
      </div>

      <Collapsible title="Header">
        <TextField
          label="Left"
          value={layout.headerLeft}
          onChange={u.setHeaderLeft}
        />
        <TextField
          label="Center"
          value={layout.headerCenter}
          onChange={u.setHeaderCenter}
        />
        <TextField
          label="Right"
          value={layout.headerRight}
          onChange={u.setHeaderRight}
        />
        <p className="wp-hint">{PLACEHOLDER_HINT}</p>
      </Collapsible>

      <Collapsible title="Footer">
        <TextField
          label="Left"
          value={layout.footerLeft}
          onChange={u.setFooterLeft}
        />
        <TextField
          label="Center"
          value={layout.footerCenter}
          onChange={u.setFooterCenter}
        />
        <TextField
          label="Right"
          value={layout.footerRight}
          onChange={u.setFooterRight}
        />
        <p className="wp-hint">{PLACEHOLDER_HINT}</p>
      </Collapsible>

      <Collapsible title="Cover page">
        <label className="wp-check">
          <input
            type="checkbox"
            checked={layout.cover.enabled}
            onChange={(e) => u.setCover({ enabled: e.target.checked })}
          />
          Add a cover page
        </label>
        <TextField
          label="Title"
          value={layout.cover.title}
          onChange={(v) => u.setCover({ title: v })}
          placeholder="Defaults to the first heading"
        />
        <TextField
          label="Subtitle"
          value={layout.cover.subtitle}
          onChange={(v) => u.setCover({ subtitle: v })}
        />
        <TextField
          label="Author"
          value={layout.cover.author}
          onChange={(v) => u.setCover({ author: v })}
        />
        <TextField
          label="Date"
          value={layout.cover.date}
          onChange={(v) => u.setCover({ date: v })}
          placeholder="Defaults to today"
        />
      </Collapsible>

      <Collapsible title="Watermark">
        <TextField
          label="Text"
          value={layout.watermark.text}
          onChange={(v) => u.setWatermark({ text: v })}
          placeholder="Empty disables the watermark"
        />
        <div className="wp-field">
          <div className="wp-field-head">
            <span className="wp-label">Opacity</span>
            <span className="wp-readout" aria-hidden="true">
              {layout.watermark.opacity.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            className="wp-range"
            min={0}
            max={1}
            step={0.02}
            value={layout.watermark.opacity}
            aria-label="Watermark opacity"
            onChange={(e) =>
              u.setWatermark({ opacity: Number(e.target.value) })
            }
          />
        </div>
        <label className="wp-check">
          <input
            type="checkbox"
            checked={layout.watermark.showInPreview}
            onChange={(e) =>
              u.setWatermark({ showInPreview: e.target.checked })
            }
          />
          Show in preview
        </label>
      </Collapsible>

      <Collapsible title="Table of contents">
        <label className="wp-check">
          <input
            type="checkbox"
            checked={layout.toc.enabled}
            onChange={(e) => u.setToc({ enabled: e.target.checked })}
          />
          Generate a table of contents
        </label>
        <div className="wp-field">
          <div className="wp-field-head">
            <span className="wp-label">Depth</span>
            <span className="wp-readout" aria-hidden="true">
              H1–H{layout.toc.depth}
            </span>
          </div>
          <input
            type="range"
            className="wp-range"
            min={1}
            max={3}
            step={1}
            value={layout.toc.depth}
            aria-label="Table of contents depth"
            onChange={(e) => u.setToc({ depth: Number(e.target.value) })}
          />
        </div>
      </Collapsible>
    </>
  );
}
