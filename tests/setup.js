import '@testing-library/jest-dom/vitest';

// CodeMirror 5 reaches for this legacy IE API during init; jsdom does not
// provide it. Ported from upstream md2pdf src/setupTests.js.
global.document.body.createTextRange = () => ({
  setEnd: () => {},
  setStart: () => {},
  getBoundingClientRect: () => ({}),
  getClientRects: () => [],
});

// jsdom implements neither of these; CodeMirror and the print flow call them.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

if (!window.print) {
  window.print = () => {};
}

if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => [];
  Range.prototype.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  });
}
