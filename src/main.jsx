import React from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import 'normalize.css';

// Bundled variable faces. WOFF2 with unicode-range subsetting, served from our
// own origin — the offline claim means no CDN.
import '@fontsource-variable/inter';
import '@fontsource-variable/source-serif-4';
import '@fontsource-variable/jetbrains-mono';

import './styles/theme/index.css';
import './styles/markdown/index.css';
import './styles/app.css';

// hljs themes are fetched as URLs, not imported as stylesheets, so all four can
// sit in the document at once with only one enabled. See installHljsThemes.
import githubCss from 'highlight.js/styles/github.css?url';
import githubDarkCss from 'highlight.js/styles/github-dark.css?url';
import atomOneLightCss from 'highlight.js/styles/atom-one-light.css?url';
import vsCss from 'highlight.js/styles/vs.css?url';

import App from './App';

const rootElement = document.getElementById('root');

/**
 * Injects the four highlight.js stylesheets, all disabled. applyTheme enables
 * exactly one. Disabled links are not fetched, so the three inactive themes
 * cost nothing until a user actually switches to them.
 */
function installHljsThemes() {
  const themes = [
    ['hljs-github', githubCss],
    ['hljs-github-dark', githubDarkCss],
    ['hljs-atom-one-light', atomOneLightCss],
    ['hljs-vs', vsCss],
  ];
  for (const [id, href] of themes) {
    if (document.getElementById(id)) continue;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.id = id;
    link.href = href;
    link.dataset.hljsTheme = '';
    link.disabled = true;
    document.head.appendChild(link);
  }
}

installHljsThemes();

// [Prevent] The redirect of file drop
window.addEventListener('drop', (e) => e.preventDefault(), true);
window.addEventListener('dragover', (e) => e.preventDefault(), true);
// Ported verbatim from the upstream project's src/index.js:14-17
window.addEventListener('beforeunload', (e) => {
  const msg = 'Please check and backup the change before refresh or leave.';
  return ((e || window.event).returnValue = msg);
});

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Replaces CRA's serviceWorkerRegistration.js + the 12 workbox packages.
registerSW({ immediate: true });
