import { describe, it, expect } from 'vitest';
import {
  render,
  waitFor,
  waitForElementToBeRemoved,
} from '@testing-library/react';
import { Provider } from 'nonaction';
import { TextContainer } from '../../Container';
import Markdown from './index.jsx';

// Ported from upstream md2pdf src/App/Components/Markdown/index.test.js,
// updated for React 18 + Vitest.

describe('<Markdown />', () => {
  it('resolves the lazy Previewer and renders content', async () => {
    const { container } = render(
      <Provider inject={[TextContainer]}>
        <Markdown />
      </Provider>,
    );

    await waitForElementToBeRemoved(() =>
      container.querySelector('#suspense-loading'),
    );

    const preview = container.querySelector('.preview');
    expect(preview).toBeInTheDocument();
    expect(preview.textContent).not.toEqual('');
  });

  it('renders the initial document through markdown-it', async () => {
    const { container } = render(
      <Provider inject={[TextContainer]}>
        <Markdown />
      </Provider>,
    );

    // Not waitForElementToBeRemoved here: by this point the lazy Preview
    // module is already resolved in the module cache, so the Suspense fallback
    // may never commit. Wait on the outcome instead.
    // initialText opens with "# Markdown2PDF", so the parser must emit an h1.
    await waitFor(() =>
      expect(container.querySelector('.preview h1')).toBeInTheDocument(),
    );
  });
});
