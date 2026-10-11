const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const removed = [
  "ヘルプと確認画面は本文をスクロールしても閉じるボタンを表示します。",
  "Help and confirmations keep Close visible while their content scrolls. "
];
for (const file of ["src/index.template.html", "video-audio-extractor.html"]) {
  test(`${file}: user help omits implementation commentary`, () => {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    for (const text of removed) assert.ok(!html.includes(text), `Remove implementation copy from ${file}`);
  });
}
