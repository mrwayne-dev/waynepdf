import React from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import 'normalize.css';
import './styles.css';
import App from './App';

const rootElement = document.getElementById('root');

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
