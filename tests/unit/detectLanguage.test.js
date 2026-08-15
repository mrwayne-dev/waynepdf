import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  detectLanguage,
  LANG_LABELS,
  RTL_LANGS,
} from '../../src/App/Lib/detectLanguage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.resolve(__dirname, '../fixtures');
const read = (name) => fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf8');

describe('detectLanguage: fixtures', () => {
  it.each([
    ['basic.md', 'en'],
    ['cjk-tc.md', 'zh-Hant'],
    ['cjk-sc.md', 'zh-Hans'],
    ['cjk-ja.md', 'ja'],
    ['cjk-ko.md', 'ko'],
    ['rtl-arabic.md', 'ar'],
    ['rtl-hebrew.md', 'he'],
  ])('%s -> %s', (file, lang) => {
    expect(detectLanguage(read(file)).lang).toBe(lang);
  });

  it.each([
    ['basic.md'],
    ['cjk-tc.md'],
    ['cjk-sc.md'],
    ['cjk-ja.md'],
    ['cjk-ko.md'],
    ['rtl-arabic.md'],
    ['rtl-hebrew.md'],
  ])('%s is detected confidently', (file) => {
    expect(detectLanguage(read(file)).confidence).toBeGreaterThanOrEqual(0.7);
  });
});

describe('detectLanguage: mixed content', () => {
  it('calls a majority-English document with Arabic passages English', () => {
    // 28% Arabic vs 72% Latin. Rule order alone would say Arabic; the
    // must-beat-Latin guard is what makes this English.
    const result = detectLanguage(read('mixed-directional.md'));
    expect(result.lang).toBe('en');
    expect(result.breakdown.arabic).toBeGreaterThan(15);
  });

  it('still calls a majority-Arabic document Arabic', () => {
    expect(detectLanguage(read('rtl-arabic.md')).lang).toBe('ar');
  });

  it('picks Japanese over Han when a little kana is present', () => {
    // Japanese prose is mostly Han by character count, so kana has to outrank
    // Han unconditionally or every Japanese document reads as Chinese.
    const result = detectLanguage(read('cjk-ja.md'));
    expect(result.lang).toBe('ja');
    expect(result.breakdown.han).toBeGreaterThan(15);
  });

  it('ignores fenced code, which is usually English', () => {
    const doc =
      '# 繁體中文標題\n\n```js\n' +
      'const someVeryLongEnglishVariableName = anotherEnglishIdentifier;\n'.repeat(
        6,
      ) +
      '```\n\n這是一段中文內容，應該決定整份文件的語言。';
    expect(detectLanguage(doc).lang).toBe('zh-Hant');
  });

  it('ignores link targets, which are usually ASCII URLs', () => {
    const doc =
      '# 日本語\n\n[リンク](https://example.com/a/very/long/english/path/segment)\n\nこれは日本語の文章です。';
    expect(detectLanguage(doc).lang).toBe('ja');
  });
});

describe('detectLanguage: TC vs SC disambiguation', () => {
  it('a document containing only 个 is Simplified', () => {
    expect(detectLanguage('个个个个个个个个个个').lang).toBe('zh-Hans');
  });

  it('a document containing only 個 is Traditional', () => {
    expect(detectLanguage('個個個個個個個個個個').lang).toBe('zh-Hant');
  });

  it('defaults to Simplified when no divergent characters appear', () => {
    // 人口大山川 are identical in both scripts, so there is no signal.
    expect(detectLanguage('人口大山川人口大山川').lang).toBe('zh-Hans');
  });

  it('reports low confidence when the Han script was a coin toss', () => {
    const result = detectLanguage('人口大山川人口大山川');
    expect(result.lang).toBe('zh-Hans');
    expect(result.confidence).toBeLessThanOrEqual(0.5);
  });

  it('reports high confidence when divergent characters decided it', () => {
    expect(detectLanguage(read('cjk-tc.md')).confidence).toBeGreaterThan(0.5);
    expect(detectLanguage(read('cjk-sc.md')).confidence).toBeGreaterThan(0.5);
  });

  it('the curated lists do not overlap', () => {
    // An overlapping character would count for whichever side is tested first,
    // silently biasing every ambiguous document.
    const tc = detectLanguage('個為這們麼對從說樣時');
    const sc = detectLanguage('个为这们么对从说样时');
    expect(tc.lang).toBe('zh-Hant');
    expect(sc.lang).toBe('zh-Hans');
  });
});

describe('detectLanguage: degenerate input', () => {
  it.each([
    ['empty string', ''],
    ['whitespace only', '   \n\n\t  '],
    ['digits only', '12345 67890'],
    ['punctuation only', '!!! ??? ... ---'],
    ['emoji only', '🎉🎊✨🚀'],
  ])('%s returns und with zero confidence', (_label, text) => {
    const result = detectLanguage(text);
    expect(result.lang).toBe('und');
    expect(result.confidence).toBe(0);
  });

  it.each([[null], [undefined], [42], [{}], [[]]])(
    'non-string input %s returns und',
    (input) => {
      expect(detectLanguage(input).lang).toBe('und');
    },
  );

  it('a document of only markdown syntax returns und', () => {
    expect(detectLanguage('# \n\n---\n\n> \n\n- \n').lang).toBe('und');
  });
});

describe('detectLanguage: breakdown', () => {
  it('sums to at most 100%', () => {
    for (const file of ['basic.md', 'cjk-ja.md', 'mixed-directional.md']) {
      const { breakdown } = detectLanguage(read(file));
      const sum = Object.values(breakdown).reduce((a, b) => a + b, 0);
      expect(sum).toBeLessThanOrEqual(100.01); // float tolerance
    }
  });

  it('reports every tracked script, including zeroes', () => {
    const { breakdown } = detectLanguage('hello world');
    expect(Object.keys(breakdown).sort()).toEqual([
      'arabic',
      'cyrillic',
      'han',
      'hangul',
      'hebrew',
      'kana',
      'latin',
    ]);
  });
});

describe('language metadata', () => {
  it('labels every detectable language', () => {
    for (const lang of [
      'en',
      'zh-Hant',
      'zh-Hans',
      'ja',
      'ko',
      'ar',
      'he',
      'ru',
      'und',
    ]) {
      expect(LANG_LABELS[lang]).toBeTruthy();
    }
  });

  it('marks exactly Arabic and Hebrew as RTL', () => {
    expect([...RTL_LANGS].sort()).toEqual(['ar', 'he']);
  });
});
