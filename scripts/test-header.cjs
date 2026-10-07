// Execute the real localization and click handlers with a synthetic DOM.
// This checks text, accessible names and preference behavior, not browser layout.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { gunzipSync } = require('node:zlib');
const inputPath = path.resolve(process.argv[2] || path.join(__dirname, '../src/index.template.html'));
let source = fs.readFileSync(inputPath, 'utf8');
const payload = source.match(/<script\s+id="self-extract-payload"\s+type="application\/octet-stream">([A-Za-z0-9+/=\r\n]+)<\/script>/);
if (payload) source = gunzipSync(Buffer.from(payload[1], 'base64')).toString('utf8');
const lines = source.split('\n');
const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../app.config.json'), 'utf8'));

function harness(storage = new Map(), browserLanguage = 'en-US') {
  const elements = [];
  for (const match of source.slice(0, source.indexOf('<script>')).matchAll(/<[a-z][\w-]*\b([^>]*?)>/g)) {
    const attributes = Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(a => [a[1], a[2]]));
    const dataset = Object.fromEntries(Object.entries(attributes).filter(([k]) => k.startsWith('data-')).map(([k, v]) => [k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v]));
    elements.push({ attributes, dataset, textContent: '',
      get title() { return this.attributes.title || ''; }, set title(value) { this.attributes.title = value; },
      setAttribute(key, value) { this.attributes[key] = value; }, click() { this.onclick?.(); }
    });
  }
  const $ = selector => elements.find(el => el.attributes.id === selector.slice(1));
  const $$ = selector => elements.filter(el => selector.slice(1, -1) in el.attributes);
  const document = { documentElement: {} };
  const state = { language: null, file: null, result: null, phase: 'empty' };
  const context = vm.createContext({ document, $, $$, state, APP_CONFIG: config, navigator: { language: browserLanguage },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }, renderDynamicText() {}
  });
  const translations = source.match(/    const translations=\{[\s\S]*?\n    \};/);
  const functions = ['readStorage', 'storedChoice', 'detectLanguage', 't', 'applyLanguage'].map(name => lines.find(line => line.startsWith(`    function ${name}(`)));
  const storageKeys = lines.find(line => line.startsWith('    const storageKeys='));
  const clickHandler = lines.find(line => line.startsWith("    $('#languageButton').onclick="))?.split(';const help=')[0];
  assert.ok(translations && storageKeys && clickHandler && functions.every(Boolean), 'test actual translation, initialization and click handler');
  vm.runInContext([translations[0], storageKeys, ...functions, clickHandler, 'applyLanguage();'].join('\n'), context);
  return { $, document, state, elements, storage };
}

for (const [language, visible, target, help, privacy] of [
  ['ja', 'EN', '英語に切り替え', '使い方と注意事項', '完全ローカル処理'],
  ['en', 'JA', 'Switch to Japanese', 'How to use & notes', 'Fully local processing']
]) {
  test(`${language}: language button names its target with EN/JA`, () => {
    const h = harness(new Map(), language);
    assert.equal(h.document.documentElement.lang, language);
    assert.equal(h.$('#languageButton').textContent, visible);
    assert.equal(h.$('#languageButton').attributes['aria-label'], target);
  });
  test(`${language}: language tooltip uses the current UI language`, () => {
    assert.equal(harness(new Map(), language).$('#languageButton').title, target);
  });
  test(`${language}: Help accessible name and tooltip are localized`, () => {
    const h = harness(new Map(), language);
    assert.equal(h.$('#helpButton').attributes['aria-label'], help);
    assert.equal(h.$('#helpButton').title, help);
  });
  test(`${language}: local-processing copy remains accurate`, () => {
    assert.equal(harness(new Map(), language).elements.find(el => el.dataset.i18n === 'localBadge').textContent, privacy);
  });
}

test('repeated language clicks persist the choice and reload restores it without changing media state', () => {
  const storage = new Map();
  const h = harness(storage, 'ja-JP');
  const before = { ...h.state };
  for (const [language, label] of [['en', 'JA'], ['ja', 'EN'], ['en', 'JA']]) {
    h.$('#languageButton').click();
    assert.equal(h.document.documentElement.lang, language);
    assert.equal(h.$('#languageButton').textContent, label);
    assert.equal(storage.get('video-audio-extractor.language'), language);
  }
  assert.deepEqual({ ...h.state, language: before.language }, before);
  assert.equal(harness(storage, 'ja-JP').document.documentElement.lang, 'en');
  assert.equal(storage.size, 1);
});

function helpHarness() {
  const elements = new Map();
  const document = { activeElement: null };
  const $ = key => {
    if (!elements.has(key)) elements.set(key, {
      isConnected: true, open: false, focusCount: 0, listeners: {},
      showModal() { this.open = true; }, close() { this.open = false; },
      focus() { this.focusCount++; document.activeElement = this; },
      addEventListener(type, handler) { this.listeners[type] = handler; },
      getBoundingClientRect() { return { left: 270, right: 881, top: 71, bottom: 676 }; },
      click() { this.onclick?.(); }
    });
    return elements.get(key);
  };
  const code = lines.find(line => line.startsWith("    $('#languageButton').onclick="));
  assert.ok(code?.includes(';const help='), 'exercise the production Help handlers');
  vm.runInNewContext('const help=' + code.split(';const help=')[1], { $, document, requestAnimationFrame: fn => fn() });
  const opener = $('#helpButton'), help = $('#helpDialog');
  opener.focus(); opener.click();
  assert.equal(help.open, true);
  assert.equal(document.activeElement, $('#closeHelpButton'));
  return { $, opener, help, document };
}

test('Help backdrop clicks outside each dialog edge close it and restore opener focus', () => {
  for (const [clientX, clientY] of [[1000, 160], [269, 160], [500, 70], [500, 677]]) {
    const h = helpHarness();
    h.help.listeners.click?.({ target: h.help, clientX, clientY });
    assert.equal(h.help.open, false, `backdrop at ${clientX},${clientY} closes Help`);
    assert.equal(h.document.activeElement, h.opener);
  }
});

test('Help content and boundary clicks stay open; Close and Escape still restore focus', () => {
  for (const [clientX, clientY] of [[270, 71], [881, 676], [500, 300]]) {
    const h = helpHarness();
    h.help.listeners.click?.({ target: h.help, clientX, clientY });
    assert.equal(h.help.open, true);
    h.help.listeners.click?.({ target: {}, clientX: 0, clientY: 0 });
    assert.equal(h.help.open, true, 'child click is not a backdrop click');
    h.$('#closeHelpButton').click();
    assert.equal(h.help.open, false);
    assert.equal(h.document.activeElement, h.opener);
    h.opener.click();
    let prevented = false;
    h.help.listeners.cancel({ preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(h.help.open, false);
    assert.equal(h.document.activeElement, h.opener);
  }
});
