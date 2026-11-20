// Synthetic DOM regressions for preview, result and bilingual error state.
// Not a substitute for real browser playback, codec or download tests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { gunzipSync } = require('node:zlib');

const filename = path.resolve(process.argv[2] || path.join(__dirname, '../src/index.template.html'));
let html = fs.readFileSync(filename, 'utf8');
const compressed = html.match(/<script\s+id="self-extract-payload"\s+type="application\/octet-stream">([A-Za-z0-9+/=\r\n]+)<\/script>/);
if (compressed) html = gunzipSync(Buffer.from(compressed[1], 'base64')).toString('utf8');

const lines = html.split('\n');
const translationsMatch = html.match(/const translations=(\{[\s\S]*?\n    \});/);
assert.ok(translationsMatch, 'production localization dictionary is available');
const functions = ['t', 'applyLanguage', 'renderDynamicText', 'setSourceError', 'renderResult', 'saveResult', 'formatName', 'durationText'];
const functionSource = functions.map(name => {
  const code = lines.find(line => line.trimStart().startsWith('function ' + name + '('));
  assert.ok(code, name + ' exists in the production app');
  return code;
}).join('\n');

function harness() {
  const elements = new Map(), downloads = [];
  const audio = {
    _src: null, srcWrites: 0, currentTime: 0, duration: NaN, hidden: true,
    get src() { return this._src || ''; },
    set src(value) { this._src = value; this.srcWrites++; this.currentTime = 0; },
    getAttribute(key) { return key === 'src' ? this._src : null; }
  };
  const $ = selector => {
    if (selector === '#audioPreview') return audio;
    if (!elements.has(selector)) elements.set(selector, {
      textContent:'',hidden:false,disabled:false,title:'',attributes:{},
      classList:{add(){},remove(){},toggle(){}},
      setAttribute(k,v){this.attributes[k]=v;}
    });
    return elements.get(selector);
  };
  const state = { language:'ja', sourceErrorKey:null, report:null, result:null, attempt:null };
  const document = {
    title:'', documentElement:{lang:'ja'}, body:{append(){}},
    createElement(tag) {
      assert.equal(tag,'a');
      return {href:'',download:'',click(){downloads.push({url:this.href,name:this.download});},remove(){}};
    }
  };
  const context = vm.createContext({
    state, $, $$:()=>[], document, APP_CONFIG:{name:'Video Audio Extractor',nameJa:'動画から音声抽出'},
    bytesText:n=>String(n), unlockTabs(){}, renderReport(){}, showToast(){}
  });
  vm.runInContext('const translations=' + translationsMatch[1] + ';\n' + functionSource, context, {filename});
  const useResult = (url='blob:test') => {
    const r={url,format:'mp3',ext:'mp3',duration:100,size:512,name:'recording.mp3',downloadRequested:false,previewUnavailable:false};
    state.result=r; state.attempt=null; return r;
  };
  return {context,state,$,audio,downloads,useResult,document};
}

test('repainting results, switching language and saving do not restart playback',()=>{
  const h=harness(), result=h.useResult();
  h.context.renderResult();assert.equal(h.audio.srcWrites,1);
  h.audio.currentTime=32;
  h.context.renderResult();assert.equal(h.audio.srcWrites,1);assert.equal(h.audio.currentTime,32);
  h.context.saveResult();assert.equal(h.audio.srcWrites,1);assert.equal(h.audio.currentTime,32);
  assert.equal(result.downloadRequested,true);assert.equal(h.downloads[0].name,'recording.mp3');
  h.state.language='en';h.context.applyLanguage();
  assert.equal(h.audio.srcWrites,1);assert.equal(h.audio.currentTime,32);
  assert.equal(h.$('#saveButton').textContent,'Save again');
});

test('unsupported preview stays hidden and its explanation follows the language',()=>{
  const h=harness();h.useResult();h.context.renderResult();
  h.audio.onerror();assert.equal(h.audio.hidden,true);
  assert.equal(h.$('#previewNote').textContent,h.context.t('previewUnavailable'));
  h.state.language='en';h.context.applyLanguage();
  assert.equal(h.audio.hidden,true);assert.equal(h.audio.srcWrites,1);
  assert.equal(h.$('#previewNote').textContent,h.context.t('previewUnavailable'));
  h.useResult('blob:next');h.context.renderResult();
  assert.equal(h.audio.hidden,false);assert.equal(h.audio.srcWrites,2);
  assert.equal(h.$('#previewNote').textContent,'');
});

test('audio metadata replaces the fallback duration without changing another result',()=>{
  const h=harness(), result=h.useResult();h.context.renderResult();
  h.audio.duration=6.8;h.audio.onloadedmetadata();
  assert.equal(result.duration,6.8);
  assert.equal(h.$('#resultDuration').textContent,'0:06');
  const next=h.useResult('blob:next');h.audio.duration=1;
  h.audio.onloadedmetadata();assert.equal(next.duration,100);
});

test('source errors and cancelled/failed attempt messages switch language',()=>{
  const h=harness();h.context.setSourceError('noAudio');
  assert.equal(h.$('#sourceErrorText').textContent,h.context.t('noAudio'));
  h.state.attempt={kind:'error',messageKey:'memoryError',diagnostic:'OOM'};
  h.context.renderResult();
  assert.equal(h.$('#resultAttemptText').textContent,h.context.t('memoryError'));
  h.state.language='en';h.context.applyLanguage();
  assert.equal(h.$('#sourceErrorText').textContent,h.context.t('noAudio'));
  assert.equal(h.$('#resultAttemptText').textContent,h.context.t('memoryError'));
  h.state.attempt={kind:'cancelled',messageKey:'noResultCreated',diagnostic:''};
  h.context.renderResult();
  assert.equal(h.$('#resultAttemptText').textContent,h.context.t('noResultCreated'));
});
