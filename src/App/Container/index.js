import { Container } from 'nonaction';
import useText from './Hooks/useText.js';
import useTheme from './Hooks/useTheme.js';

export const TextContainer = Container(useText);
export const ThemeContainer = Container(useTheme);
