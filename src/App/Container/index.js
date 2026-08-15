import { Container } from 'nonaction';
import useText from './Hooks/useText.js';
import useTheme from './Hooks/useTheme.js';
import useLanguage from './Hooks/useLanguage.js';
import useEncodingBanner from './Hooks/useEncodingBanner.js';

export const TextContainer = Container(useText);
export const ThemeContainer = Container(useTheme);
export const LanguageContainer = Container(useLanguage);
export const EncodingBannerContainer = Container(useEncodingBanner);
