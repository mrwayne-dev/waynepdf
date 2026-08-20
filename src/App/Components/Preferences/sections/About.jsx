import { SectionHeader } from '../Field.jsx';

export const LABELS = [];

/*
 * Read-only content, no Fields; these are section-level search terms.
 */
export const ALIASES = ['Version', 'License', 'Credits'];

/*
 * Injected at build time from package.json rather than imported.
 *
 * Importing package.json would pull the whole manifest — every dependency name
 * and version — into the client bundle to display one string.
 */
const VERSION = __WAYNEPDF_VERSION__;
const HOMEPAGE = __WAYNEPDF_HOMEPAGE__;

const MIT = `MIT License

Copyright (c) 2026 WaynePDF contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

export default function About() {
  return (
    <div className="wp-prefs-about">
      <SectionHeader title="About" />

      <p>
        <span className="wp-prefs-version" data-testid="wp-version">
          WaynePDF {VERSION}
        </span>
      </p>

      <p>
        A local-first Markdown editor and PDF typesetter. Documents never leave
        the browser — there is no server, and nothing is uploaded.
      </p>

      <h4 className="wp-prefs-group-title">Credits</h4>
      <p>
        WaynePDF is a fork and rewrite of{' '}
        <a
          href="https://github.com/realdennis/md2pdf"
          target="_blank"
          rel="noreferrer noopener"
        >
          realdennis/md2pdf
        </a>
        , whose editor/preview split is the shape this app grew out of.
      </p>
      {HOMEPAGE ? (
        <p>
          Home:{' '}
          <a href={HOMEPAGE} target="_blank" rel="noreferrer noopener">
            {HOMEPAGE}
          </a>
        </p>
      ) : null}

      <h4 className="wp-prefs-group-title">License</h4>
      <pre className="wp-prefs-license">{MIT}</pre>
    </div>
  );
}
