# CJK Fixture

Establishes the baseline Han unification behaviour. Currently broken: the app
specifies `微軟正黑體` (Windows-only) with a generic `sans-serif` fallback, so the
host resolves Traditional Chinese text to whichever CJK face fontconfig prefers.

## Traditional Chinese

反選頁首與頁尾。這是一段繁體中文的測試文字，用來驗證字型與排版。

## Simplified Chinese

这是一段简体中文的测试文字，用来验证字体与排版。

## Japanese

これは日本語のテキストです。漢字、ひらがな、カタカナを含みます。

## Korean

한국어 텍스트입니다. 한글 렌더링을 확인합니다.

## Mixed run

繁體 / 简体 / 日本語 / 한국어 in one line.
