import React from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import 'normalize.css';

// Bundled variable faces. WOFF2 with unicode-range subsetting, served from our
// own origin — the offline claim means no CDN.
import '@fontsource-variable/inter';
import '@fontsource-variable/source-serif-4';
import '@fontsource-variable/jetbrains-mono';

// CJK / Arabic / Hebrew coverage, so output does not depend on which fonts the
// host OS happens to have. Non-variable at weights 400 and 700 only: variable
// axes buy little for these scripts and cost a great deal per subset.
//
// Each CJK face is split into ~100-125 unicode-range subsets, so a document
// fetches only the two or three that contain its characters — a few hundred KB,
// not the multi-megabyte family. See vite.config.js for how they are cached.
import '@fontsource/noto-sans-tc/400.css';
import '@fontsource/noto-sans-tc/700.css';
import '@fontsource/noto-sans-sc/400.css';
import '@fontsource/noto-sans-sc/700.css';
import '@fontsource/noto-sans-jp/400.css';
import '@fontsource/noto-sans-jp/700.css';
import '@fontsource/noto-sans-kr/400.css';
import '@fontsource/noto-sans-kr/700.css';
import '@fontsource/noto-sans-arabic/400.css';
import '@fontsource/noto-sans-arabic/700.css';
import '@fontsource/noto-sans-hebrew/400.css';
import '@fontsource/noto-sans-hebrew/700.css';

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
/*
 * The upstream project's beforeunload nag ("Please check and backup the change
 * before refresh or leave.") is gone. It fired on every navigation, including
 * ones that lost nothing, and the thing it warned about no longer happens:
 * documents autosave to IndexedDB. useDocuments installs its own beforeunload
 * listener, but that one writes and returns nothing — it never prompts.
 */

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Replaces CRA's serviceWorkerRegistration.js + the 12 workbox packages.
registerSW({ immediate: true });
