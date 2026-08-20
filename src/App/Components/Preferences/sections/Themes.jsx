import CustomThemeList from '../controls/CustomThemeList.jsx';
import { SectionHeader } from '../Field.jsx';

export const LABELS = [];

/*
 * CustomThemeList is rendered whole; this is a section-level search term.
 */
export const ALIASES = ['Custom themes'];

/**
 * The user's own palettes.
 *
 * The editor stays a modal opened from here rather than becoming inline section
 * content. A full-window preferences surface is enough restructuring for one
 * phase, and the editor is a focused task with its own save/cancel contract —
 * nesting it into a scrolling pane would put two different "done" semantics on
 * one screen. Closing it returns here.
 */
export default function Themes() {
  return (
    <>
      <SectionHeader
        title="Themes"
        caption="Build your own palette from any preset. Custom themes appear alongside the presets in Appearance."
      />
      <CustomThemeList inline />
    </>
  );
}
