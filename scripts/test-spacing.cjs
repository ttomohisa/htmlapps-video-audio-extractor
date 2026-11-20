// Visual structure and 8px-spacing regressions for source and generated standalone HTML.
// DOM/CSS assertions only: real-device layout is exercised separately in Chromium.
'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { gunzipSync } = require('node:zlib');

const filename = path.resolve(process.argv[2] || path.join(__dirname, '../src/index.template.html'));
let html = fs.readFileSync(filename, 'utf8');
const compressed = html.match(/<script\s+id="self-extract-payload"\s+type="application\/octet-stream">([A-Za-z0-9+/=\r\n]+)<\/script>/);
if (compressed) html = gunzipSync(Buffer.from(compressed[1], 'base64')).toString('utf8');
const style = html.match(/<style>([\s\S]*?)<\/style>/);
assert.ok(style, 'standalone app style block is present');

test('all authored padding, margin and gap values align to an 8px grid', () => {
  const declarations = [...style[1].matchAll(/(?:^|[;{])\s*((?:margin|padding)(?:-(?:top|bottom|left|right|inline|block|inline-start|inline-end))?|gap|row-gap|column-gap)\s*:\s*([^;}]+)/g)];
  assert.ok(declarations.length > 150, 'check the entire app stylesheet');
  for (const [, property, value] of declarations) {
    for (const match of value.matchAll(/(-?\d+)px/g)) {
      const size = Number(match[1]);
      assert.equal(size % 8, 0, property + ': ' + value + ' (' + size + 'px)');
    }
  }
  for (const [, value] of html.matchAll(/\bstyle="([^"]+)"/g)) {
    for (const [, property, spacing] of value.matchAll(/(?:^|;)\s*((?:margin|padding)(?:-[\w-]+)?|gap)\s*:\s*([^;]+)/g)) {
      for (const match of spacing.matchAll(/(-?\d+)px/g)) {
        assert.equal(Number(match[1]) % 8, 0, property + ': ' + spacing + ' (inline)');
      }
    }
  }
});

test('intro omits a visible hero heading but retains a semantic page heading', () => {
  assert.match(html, /<h1\s+class="sr-only"\s+data-i18n="introTitle">/);
  const intro = html.match(/<section class="page-intro">([\s\S]*?)<\/section>/)?.[1];
  assert.ok(intro, 'intro is present');
  assert.doesNotMatch(intro, /<h[1-6]\b/);
  assert.match(intro, /data-i18n="lead"/);
  assert.match(html, /body\.has-source \.page-intro\{display:none\}/);
  assert.match(html, /\.local-badge\{display:none\}/);
});

test('workflow retains restrained panel boundaries and accessible selection states', () => {
  assert.match(html, /\.panel\{border-color:var\(--line\);border-radius:8px;box-shadow:none\}/);
  assert.match(html, /\.format-choice\.selected\{[^}]*box-shadow:inset 2px 0 var\(--accent\)/);
  assert.match(html, /\.track-option\.selected\{[^}]*box-shadow:inset 2px 0 var\(--accent\)/);
});
