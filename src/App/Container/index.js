import { Container, useProvided } from 'nonaction';
import useText from './Hooks/useText.js';
import useTheme from './Hooks/useTheme.js';
import useLanguage from './Hooks/useLanguage.js';
import useEncodingBanner from './Hooks/useEncodingBanner.js';
import useLayout from './Hooks/useLayout.js';
import usePageCount from './Hooks/usePageCount.js';
import useCustomThemes from './Hooks/useCustomThemes.js';
import useExportFormat from './Hooks/useExportFormat.js';
import usePreferences from './Hooks/usePreferences.js';

export const TextContainer = Container(useText);
export const ThemeContainer = Container(useTheme);
export const LanguageContainer = Container(useLanguage);
export const EncodingBannerContainer = Container(useEncodingBanner);
export const LayoutContainer = Container(useLayout);
export const PageCountContainer = Container(usePageCount);
export const CustomThemesContainer = Container(useCustomThemes);
export const ExportFormatContainer = Container(useExportFormat);
export const PreferencesContainer = Container(usePreferences);

/**
 * The document store, which lives inside TextContainer's third slot.
 *
 * Not its own container: nonaction calls every container hook in one component,
 * so two containers over the same hook would be two independent stores rather
 * than one shared one. See the note at the top of Hooks/useDocuments.js.
 */
export const useDocumentsApi = () => useProvided(TextContainer)[2];
