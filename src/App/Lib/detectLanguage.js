/*
 * Script-based language detection, purpose-built.
 *
 * We only need to separate nine categories, and the separation is almost
 * entirely a question of which Unicode blocks the text occupies — not
 * vocabulary or n-grams. That makes a general detector (franc-all is 300KB+,
 * cld3 is WASM) both oversized and, for the one genuinely hard case here,
 * no better: distinguishing Traditional from Simplified Chinese is a
 * character-set question, which is what the curated lists below answer.
 */

export const LANG_LABELS = {
  en: 'English',
  'zh-Hant': 'Chinese (Traditional)',
  'zh-Hans': 'Chinese (Simplified)',
  ja: 'Japanese',
  ko: 'Korean',
  ar: 'Arabic',
  he: 'Hebrew',
  ru: 'Russian',
  und: 'Other',
};

export const RTL_LANGS = new Set(['ar', 'he']);

/** How much of the document to look at. Enough to be representative, cheap. */
const SAMPLE_BYTES = 4096;

/*
 * High-frequency characters that diverged in the 1956 simplification, and
 * exist on only one side. Disambiguation, not linguistics — a document using
 * any of these in quantity has told us which script it is.
 *
 * Characters shared by both scripts (的, 是, 我, 不 …) are deliberately absent:
 * they carry no signal and would only dilute the counts.
 */
const TC_ONLY = new Set([
  ...'個為這們麼對從說樣時幾給應該過頭學開覺實現點無萬與東車門問題與經濟發',
  ...'計種產業會員區長轉載體積極權變導師範圍讀寫語書畫醫藥療養護衛態勢',
  ...'憂鬱靈繪畫劇場藝術鐵鋼銀錢貨幣價買賣賺賠鄉鎮縣總統選舉黨',
  ...'雜誌報紙電視聽覺視覺嚴謹準確華麗豐貧窮飢餓飽滿營養',
]);

const SC_ONLY = new Set([
  ...'个为这们么对从说样时几给应该过头学开觉实现点无万与东车门问题经济发',
  ...'计种产业会员区长转载体积极权变导师范围读写语书画医药疗养护卫态势',
  ...'忧郁灵绘画剧场艺术铁钢银钱货币价买卖赚赔乡镇县总统选举党',
  ...'杂志报纸电视听觉视觉严谨准确华丽丰贫穷饥饿饱满营养',
]);

/** Strip the markup that would otherwise skew the Latin ratio. */
function sample(text) {
  return text
    .slice(0, SAMPLE_BYTES)
    .replace(/```[\s\S]*?```/g, ' ') // fenced code is usually English
    .replace(/`[^`]*`/g, ' ')
    .replace(/<[^>]+>/g, ' ') // raw HTML tags
    .replace(/\]\([^)]*\)/g, ' ') // link targets are usually ASCII URLs
    .replace(/https?:\/\/\S+/g, ' ');
}

const inRange = (cp, lo, hi) => cp >= lo && cp <= hi;

/**
 * Counts characters by script. Whitespace, digits and punctuation are excluded
 * from the denominator: a CJK document is still mostly CJK even when half its
 * bytes are markdown syntax, and including them would push every ratio under
 * the thresholds.
 */
function countBlocks(text) {
  const counts = {
    hangul: 0,
    kana: 0,
    hebrew: 0,
    arabic: 0,
    cyrillic: 0,
    han: 0,
    latin: 0,
  };
  let total = 0;

  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp <= 0x20) continue;
    // Skip shared punctuation and digits — they belong to no script.
    if (inRange(cp, 0x21, 0x40) || inRange(cp, 0x5b, 0x60)) continue;
    if (inRange(cp, 0x7b, 0x7e)) continue;

    let bucket = null;
    if (inRange(cp, 0xac00, 0xd7af) || inRange(cp, 0x1100, 0x11ff)) {
      bucket = 'hangul';
    } else if (inRange(cp, 0x3040, 0x309f) || inRange(cp, 0x30a0, 0x30ff)) {
      bucket = 'kana';
    } else if (inRange(cp, 0x0590, 0x05ff) || inRange(cp, 0xfb1d, 0xfb4f)) {
      bucket = 'hebrew';
    } else if (
      inRange(cp, 0x0600, 0x06ff) ||
      inRange(cp, 0x0750, 0x077f) ||
      inRange(cp, 0xfb50, 0xfdff) ||
      inRange(cp, 0xfe70, 0xfeff)
    ) {
      bucket = 'arabic';
    } else if (inRange(cp, 0x0400, 0x04ff) || inRange(cp, 0x0500, 0x052f)) {
      bucket = 'cyrillic';
    } else if (
      inRange(cp, 0x4e00, 0x9fff) ||
      inRange(cp, 0x3400, 0x4dbf) ||
      inRange(cp, 0xf900, 0xfaff) ||
      inRange(cp, 0x20000, 0x2a6df)
    ) {
      bucket = 'han';
    } else if (inRange(cp, 0x41, 0x5a) || inRange(cp, 0x61, 0x7a)) {
      bucket = 'latin';
    }

    if (bucket) counts[bucket]++;
    total++;
  }

  return { counts, total };
}

/** Which Han script, by counting characters that exist on only one side. */
function disambiguateHan(text) {
  let tc = 0;
  let sc = 0;
  for (const ch of text) {
    if (TC_ONLY.has(ch)) tc++;
    else if (SC_ONLY.has(ch)) sc++;
  }
  if (tc > sc) return { lang: 'zh-Hant', tc, sc };
  if (sc > tc) return { lang: 'zh-Hans', tc, sc };
  // Tie, including the both-zero case: Simplified has the larger user base.
  return { lang: 'zh-Hans', tc, sc };
}

/**
 * Confidence is how decisively the winning ratio cleared its threshold:
 * 0.7+ at twice the threshold, 0.5 at exactly the threshold. It feeds the
 * Settings caption, which should read "Detected: Other" rather than assert a
 * language it barely believes.
 */
function confidenceFor(ratio, threshold) {
  if (ratio >= threshold * 2)
    return Math.min(0.99, 0.7 + (ratio - threshold * 2));
  if (ratio >= threshold) return 0.5 + (0.2 * (ratio - threshold)) / threshold;
  return ratio / threshold / 2;
}

export function detectLanguage(text) {
  const empty = {
    lang: 'und',
    confidence: 0,
    breakdown: {
      hangul: 0,
      kana: 0,
      hebrew: 0,
      arabic: 0,
      cyrillic: 0,
      han: 0,
      latin: 0,
    },
  };
  if (typeof text !== 'string' || text.trim() === '') return empty;

  const sampled = sample(text);
  const { counts, total } = countBlocks(sampled);
  if (total === 0) return empty;

  const ratio = (key) => counts[key] / total;
  const breakdown = Object.fromEntries(
    Object.keys(counts).map((k) => [k, +(ratio(k) * 100).toFixed(2)]),
  );

  const decide = (lang, key, threshold, extra) => ({
    lang,
    confidence: +confidenceFor(ratio(key), threshold).toFixed(2),
    breakdown,
    ...extra,
  });

  /*
   * Ordered by discriminating power, not by ratio: kana is checked before Han
   * because Japanese prose is mostly Han by count, so a little kana is
   * decisive. Hangul and kana therefore outrank everything unconditionally.
   *
   * Hebrew, Arabic and Cyrillic are different. They occupy the same
   * "alphabetic body text" role as Latin, so between those two the majority
   * script genuinely is the document's language — an English article quoting a
   * few Arabic passages is English, not Arabic. Those three must beat Latin as
   * well as their own threshold, otherwise rule order alone would hand
   * mixed-directional.md (28% Arabic, 72% Latin) to Arabic.
   */
  if (ratio('hangul') > 0.15) return decide('ko', 'hangul', 0.15);
  if (ratio('kana') > 0.05) return decide('ja', 'kana', 0.05);
  const beatsLatin = (key) => ratio(key) >= ratio('latin');
  if (ratio('hebrew') > 0.15 && beatsLatin('hebrew')) {
    return decide('he', 'hebrew', 0.15);
  }
  if (ratio('arabic') > 0.15 && beatsLatin('arabic')) {
    return decide('ar', 'arabic', 0.15);
  }
  if (ratio('cyrillic') > 0.15 && beatsLatin('cyrillic')) {
    return decide('ru', 'cyrillic', 0.15);
  }
  if (ratio('han') > 0.15) {
    const { lang, tc, sc } = disambiguateHan(sampled);
    const base = confidenceFor(ratio('han'), 0.15);
    // A Han document with no divergent characters was a coin toss; say so.
    const decisive = tc + sc > 0;
    return {
      lang,
      confidence: +(decisive ? base : Math.min(base, 0.5)).toFixed(2),
      breakdown,
    };
  }
  if (ratio('latin') > 0.2) return decide('en', 'latin', 0.2);

  return { lang: 'und', confidence: 0, breakdown };
}
