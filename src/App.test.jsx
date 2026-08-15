import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import App from './App';

// Ported from the upstream project's src/App.test.js, updated for
// React 18 + Vitest.

describe('<App />', () => {
  it('renders without crashing', () => {
    const { container } = render(<App />);
    expect(container.querySelector('#waynepdf-app')).toBeTruthy();
  });
});
