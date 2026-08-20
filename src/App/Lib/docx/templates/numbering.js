/*
 * List definitions.
 *
 * OOXML splits a list in two: an *abstract* definition describing the marker and
 * indent at each level, and a *concrete* instance that paragraphs point at with
 * w:numId. A paragraph then picks its depth with w:ilvl.
 *
 * Two abstracts, three levels each — bullets and decimals. Every bullet list in
 * a document shares numId 1 and every ordered list shares numId 2. That is the
 * simplification worth knowing about: two separate ordered lists continue one
 * sequence rather than restarting at 1. Per-list concrete instances would fix it
 * and are not worth the bookkeeping here.
 *
 * The glyph fonts (Symbol / Courier New / Wingdings) are the trio Word itself
 * uses for its three default levels; a literal bullet character renders
 * inconsistently across viewers.
 */

const LEFT_TWIPS = [720, 1440, 2160];

const bulletLevel = (level, char, font) =>
  `<w:lvl w:ilvl="${level}"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="${char}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${LEFT_TWIPS[level]}" w:hanging="360"/></w:pPr><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:hint="default"/></w:rPr></w:lvl>`;

const numberLevel = (level, format, text) =>
  `<w:lvl w:ilvl="${level}"><w:start w:val="1"/><w:numFmt w:val="${format}"/><w:lvlText w:val="${text}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${LEFT_TWIPS[level]}" w:hanging="360"/></w:pPr></w:lvl>`;

export const NUMBERING_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${bulletLevel(0, '●', 'Symbol')}${bulletLevel(1, '○', 'Courier New')}${bulletLevel(2, '▪', 'Wingdings')}</w:abstractNum><w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>${numberLevel(0, 'decimal', '%1.')}${numberLevel(1, 'lowerLetter', '%2.')}${numberLevel(2, 'lowerRoman', '%3.')}</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num></w:numbering>`;

/** numId values document.xml references. */
export const BULLET_NUM_ID = 1;
export const ORDERED_NUM_ID = 2;

/** Deepest level numbering.xml defines. Deeper nesting is clamped to it. */
export const MAX_LIST_LEVEL = 2;
