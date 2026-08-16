import { describe, it, expect } from 'vitest';
import {
  md,
  hljs,
  LANGUAGES,
  EXTRA_ALIASES,
} from '@/App/Components/Previewer/Preview.jsx';

/*
 * The curated highlight.js set.
 *
 * These assert against the same hljs instance the app renders with, so a
 * dropped registration shows up here rather than as silently unhighlighted code
 * in someone's PDF.
 */

/** Real syntax per language — enough to produce at least one token span. */
const SAMPLES = {
  bash: '#!/usr/bin/env bash\nset -euo pipefail\nfor f in *.md; do\n  echo "$f"\ndone',
  c: '#include <stdio.h>\nint main(void) {\n  printf("hi\\n");\n  return 0;\n}',
  clojure:
    '(ns app.core)\n(defn greet [name]\n  (str "Hello, " name))\n(greet "world")',
  cpp: '#include <vector>\nint main() {\n  std::vector<int> v{1, 2, 3};\n  return v.size();\n}',
  csharp:
    'using System;\npublic class Greeter {\n  public string Greet(string n) => $"Hi {n}";\n}',
  css: '.selector {\n  color: #fff;\n  margin: 0 auto;\n}\n@media print { body { color: black; } }',
  dart: 'void main() {\n  final list = <int>[1, 2, 3];\n  print(list.length);\n}',
  diff: '--- a/file\n+++ b/file\n@@ -1 +1 @@\n-old line\n+new line',
  dockerfile:
    'FROM node:22-alpine\nWORKDIR /app\nCOPY . .\nRUN npm ci\nCMD ["node", "index.js"]',
  elixir:
    'defmodule Greeter do\n  def greet(name) do\n    "Hello, #{name}"\n  end\nend',
  erlang:
    '-module(greeter).\n-export([greet/1]).\ngreet(Name) ->\n  io:format("Hi ~s~n", [Name]).',
  fsharp:
    'module Greeter\nlet greet name =\n  sprintf "Hello, %s" name\nprintfn "%s" (greet "world")',
  go: 'package main\n\nimport "fmt"\n\nfunc main() {\n  fmt.Println("hi")\n}',
  graphql:
    'query GetUser($id: ID!) {\n  user(id: $id) {\n    name\n    email\n  }\n}',
  groovy:
    'class Greeter {\n  String greet(String name) {\n    return "Hello, $name"\n  }\n}',
  haskell:
    'module Main where\n\ngreet :: String -> String\ngreet n = "Hello, " ++ n\n\nmain = putStrLn (greet "world")',
  ini: '[server]\nhost = "localhost"\nport = 8080\nenabled = true',
  java: 'public class Greeter {\n  public static void main(String[] args) {\n    System.out.println("hi");\n  }\n}',
  javascript:
    "const greet = (name) => `Hello, ${name}`;\nexport default function App() {\n  return greet('world');\n}",
  json: '{\n  "name": "waynepdf",\n  "version": "1.0.0",\n  "private": true\n}',
  kotlin:
    'fun greet(name: String): String = "Hello, $name"\nfun main() {\n  println(greet("world"))\n}',
  latex:
    '\\documentclass{article}\n\\begin{document}\n\\section{Intro}\nHello \\textbf{world}.\n\\end{document}',
  less: '@primary: #333;\n.button {\n  color: @primary;\n  &:hover { color: lighten(@primary, 10%); }\n}',
  lua: 'local function greet(name)\n  return "Hello, " .. name\nend\nprint(greet("world"))',
  markdown:
    '# Heading\n\nSome **bold** and *italic* text.\n\n- item one\n- item two',
  matlab: 'function y = square(x)\n  y = x .^ 2;\nend\ndisp(square([1 2 3]));',
  nginx:
    'server {\n  listen 80;\n  server_name example.com;\n  location / {\n    root /usr/share/nginx/html;\n  }\n}',
  nix: '{ pkgs ? import <nixpkgs> {} }:\npkgs.mkShell {\n  buildInputs = [ pkgs.nodejs_22 ];\n}',
  objectivec:
    '#import <Foundation/Foundation.h>\n@interface Greeter : NSObject\n- (NSString *)greet:(NSString *)name;\n@end',
  perl: 'use strict;\nuse warnings;\nmy $name = "world";\nprint "Hello, $name\\n";',
  php: '<?php\nfunction greet(string $name): string {\n  return "Hello, $name";\n}\necho greet("world");',
  plaintext: 'Just some plain text.\nNo syntax at all.',
  powershell:
    '$name = "world"\nfunction Get-Greeting {\n  param([string]$Name)\n  Write-Output "Hello, $Name"\n}',
  python:
    'from typing import List\n\ndef greet(name: str) -> str:\n    return f"Hello, {name}"\n\nprint(greet("world"))',
  r: 'greet <- function(name) {\n  paste0("Hello, ", name)\n}\nprint(greet("world"))',
  ruby: 'require "json"\n\ndef greet(name)\n  "Hello, #{name}"\nend\n\nputs greet("world")',
  rust: 'use std::fmt;\n\nfn greet(name: &str) -> String {\n    format!("Hello, {}", name)\n}',
  scala:
    'object Greeter {\n  def greet(name: String): String = s"Hello, $name"\n  def main(args: Array[String]): Unit = println(greet("world"))\n}',
  scss: '$primary: #333;\n.button {\n  color: $primary;\n  &:hover { color: darken($primary, 10%); }\n}',
  sql: 'SELECT id, name\nFROM users\nWHERE active = 1\nORDER BY created_at DESC\nLIMIT 10;',
  swift:
    'import Foundation\n\nfunc greet(_ name: String) -> String {\n    return "Hello, \\(name)"\n}',
  typescript:
    'interface User {\n  id: number;\n  name: string;\n}\nexport const greet = (u: User): string => `Hi ${u.name}`;',
  xml: '<?xml version="1.0"?>\n<root>\n  <item id="1">value</item>\n</root>',
  yaml: 'name: waynepdf\non:\n  push:\n    branches: [main]\njobs:\n  build:\n    runs-on: ubuntu-latest',
};

const NAMES = Object.keys(LANGUAGES);

describe('registered language set', () => {
  it('registers 44 language modules', () => {
    // 45 names in the Phase 3.5 brief, but toml and ini are one module.
    expect(NAMES).toHaveLength(44);
  });

  it('has a sample for every registered language', () => {
    expect(Object.keys(SAMPLES).sort()).toEqual([...NAMES].sort());
  });

  it.each(NAMES)('%s is registered', (name) => {
    expect(hljs.getLanguage(name)).toBeTruthy();
  });

  it.each(NAMES)('%s highlights its sample into token spans', (name) => {
    const { value } = hljs.highlight(SAMPLES[name], { language: name });
    expect(value.length).toBeGreaterThan(0);
    if (name === 'plaintext') {
      // plaintext is registered so `text`/`txt` fences resolve; by definition it
      // emits no token spans.
      expect(value).not.toContain('class="hljs-');
      return;
    }
    expect(value, `${name} produced no token spans`).toContain('class="hljs-');
  });

  it('registers no languages beyond the curated set', () => {
    // Guards against a stray import creeping the bundle back up.
    const registered = hljs.listLanguages().sort();
    expect(registered).toEqual([...NAMES].sort());
  });
});

describe('aliases', () => {
  const CASES = [
    ['js', 'javascript'],
    ['jsx', 'javascript'],
    ['mjs', 'javascript'],
    ['ts', 'typescript'],
    ['tsx', 'typescript'],
    ['py', 'python'],
    ['rb', 'ruby'],
    ['sh', 'bash'],
    ['shell', 'bash'],
    ['zsh', 'bash'],
    ['yml', 'yaml'],
    ['md', 'markdown'],
    ['tex', 'latex'],
    ['objc', 'objectivec'],
    ['cs', 'csharp'],
    ['c#', 'csharp'],
    ['c++', 'cpp'],
    ['cxx', 'cpp'],
    ['cc', 'cpp'],
    ['docker', 'dockerfile'],
    ['text', 'plaintext'],
    ['txt', 'plaintext'],
    ['toml', 'ini'],
    ['html', 'xml'],
    ['svg', 'xml'],
    ['golang', 'go'],
    ['rs', 'rust'],
    ['kt', 'kotlin'],
    ['hs', 'haskell'],
    ['ex', 'elixir'],
    ['erl', 'erlang'],
    ['clj', 'clojure'],
    ['fs', 'fsharp'],
    ['gql', 'graphql'],
    ['patch', 'diff'],
    ['pl', 'perl'],
    ['ps1', 'powershell'],
  ];

  it.each(CASES)('%s resolves to %s', (alias, canonical) => {
    expect(hljs.getLanguage(alias)).toBe(hljs.getLanguage(canonical));
  });

  it('registers shell and zsh explicitly, since bash does not ship them', () => {
    // `shell` is a separate console-session language in highlight.js that we do
    // not register, so without EXTRA_ALIASES these would fall through to plain.
    expect(EXTRA_ALIASES.bash).toEqual(['shell', 'zsh']);
  });
});

describe('unknown languages', () => {
  it('getLanguage returns undefined for a made-up name', () => {
    expect(hljs.getLanguage('xyz123')).toBeUndefined();
    expect(hljs.getLanguage('made-up-lang')).toBeUndefined();
  });

  it('renders an unknown-language fence as plain escaped code', () => {
    const html = md.render('```xyz123\nSELECT 1;\n```');
    expect(html).toContain('class="hljs"');
    // No token spans: highlightAuto is gone, so nothing was detected.
    expect(html).not.toContain('class="hljs-');
    expect(html).not.toContain('language-xyz123');
  });

  it('renders an unlabeled fence as plain escaped code, not auto-detected', () => {
    // This exact content used to be detected as SQL by highlightAuto.
    const html = md.render(
      '```\nSELECT id, name FROM users WHERE active = 1;\n```',
    );
    expect(html).toContain('class="hljs"');
    expect(html).not.toContain('class="hljs-');
  });

  it('escapes HTML-sensitive characters in an unknown-language fence', () => {
    const html = md.render('```made-up-lang\n<script>alert(1)</script>\n```');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes HTML-sensitive characters in an unlabeled fence', () => {
    const html = md.render('```\n<img src=x onerror="alert(1)">\n```');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img');
  });

  it('does not throw on a fence whose label is an odd string', () => {
    for (const label of ['"', "'", '<b>', 'a b c', '../../etc', '💥']) {
      expect(() => md.render('```' + label + '\nbody\n```')).not.toThrow();
    }
  });
});

describe('labeled fences still highlight', () => {
  it.each([
    ['javascript', 'const a = 1;'],
    ['python', 'def f(): pass'],
    ['rust', 'fn main() {}'],
    ['sql', 'SELECT 1;'],
    ['yaml', 'key: value'],
    ['bash', 'echo hi'],
  ])('%s fence emits token spans and a language class', (lang, body) => {
    const html = md.render('```' + lang + '\n' + body + '\n```');
    expect(html).toContain(`language-${lang}`);
    expect(html).toContain('class="hljs-');
  });

  it('an aliased fence highlights under its alias label', () => {
    const html = md.render('```js\nconst a = 1;\n```');
    // Class carries the label the user wrote; highlighting resolves the alias.
    expect(html).toContain('language-js');
    expect(html).toContain('class="hljs-');
  });
});
