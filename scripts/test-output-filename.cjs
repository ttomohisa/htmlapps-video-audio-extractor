// Offline behavioral regressions. Synthetic DOM, runner outputs and downloads;
// this is not a browser, codec, layout or actual-file playback test.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { File } = require('node:buffer');
const { gunzipSync } = require('node:zlib');
const inputPath = path.resolve(process.argv[2] || path.join(__dirname, '../src/index.template.html'));
let html = fs.readFileSync(inputPath, 'utf8');
const payload = html.match(/<script\s+id="self-extract-payload"\s+type="application\/octet-stream">([A-Za-z0-9+/=\r\n]+)<\/script>/);
if (payload) html = gunzipSync(Buffer.from(payload[1], 'base64')).toString('utf8');
const lines = html.split('\n');
const functionNames = ['safeBase', 'defaultOutputBase', 'useVideoName', 'normalizedOutputBase', 'selectedTrack', 'outputSpec', 'virtualInputPath', 'workerFsBlob', 'isCurrentOperation', 'abortError', 'chooseDefaultTrack', 'loadSource', 'extract', 'saveResult', 'setPhase', 'renderFormat', 'cancelCurrent', 'formatName', 'revokeResult'];
const functions = functionNames.flatMap(name => lines.filter(line => new RegExp(`^\\s*(?:async )?function ${name}\\(`).test(line))).join('\n');
const events = lines.find(line => line.trimStart().startsWith("$('#extractButton').onclick=extract;"));
assert.ok(events, 'The app action handlers must be tested');
const translationCode = html.match(/const translations=(\{[\s\S]*?\n    \});/)[1];

function harness() {
  const elements = new Map(), downloads = [], calls = [], revoked = [], storage = [];
  let currentReport = {format:{name:'mov,mp4',duration:2,videoStreamCount:1,audioStreamCount:2},audioStreams:[
    {index:2,title:'First',duration:2,channels:2,sampleRate:48000,codec:{name:'opus',bitRate:128000},copy:{supported:true,format:'opus',extension:'opus'},transcode:{supported:true,formats:['m4a','mp3','wav']}},
    {index:7,default:true,title:'Selected',language:'eng',duration:2,channels:6,sampleRate:48000,codec:{name:'aac',bitRate:192000},copy:{supported:true,format:'m4a',extension:'m4a'},transcode:{supported:true,formats:['m4a','mp3','wav']}}
  ]};
  const element = id => {
    if (!elements.has(id)) elements.set(id, {value:'',disabled:false,hidden:false,textContent:'',style:{},attributes:{},listeners:{},focusCount:0,
      classList:{add(){},remove(){},toggle(){}},setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this.attributes[k];},replaceChildren(){},
      addEventListener(k,fn){this.listeners[k]=fn;},focus(){this.focusCount++;},click(){if(!this.disabled)this.onclick?.();}
    });
    return elements.get(id);
  };
  const state = {file:null,report:null,selectedIndex:null,result:null,attempt:null,phase:'empty',generation:0,operationId:0,abort:null,outputMode:'copy',mp3Channels:1,aacBitrateKbps:192,mp3BitrateKbps:256,language:'en'};
  let run = async options => ({files:[{name:options.outputs[0],data:new Uint8Array([1,2,3,4])}]});
  const runner = {run:async options=>{calls.push(options);return run(options);}};
  let getRunner = async()=>runner;
  let url = 0;
  const context = vm.createContext({state,$:element,$$:()=>[],Blob,File,AbortController,Uint8Array,Date,Number,Error,TypeError,
    console:{error(){}},matchMedia:()=>({matches:false}),URL:{createObjectURL:()=>`blob:synthetic-${++url}`,revokeObjectURL:u=>revoked.push(u)},
    document:{body:{append(){}},createElement(tag){assert.equal(tag,'a');return {href:'',download:'',click(){downloads.push({href:this.href,name:this.download});},remove(){}};}},
    BrowserFFmpeg:{videoAudioExtractorInspectArgs:x=>({kind:'inspect',...x}),videoAudioExtractorCopyArgs:x=>({kind:'copy',...x}),videoAudioExtractorTranscodeArgs:x=>({kind:'transcode',...x}),decodeJsonOutput:()=>currentReport},
    getRunner:()=>getRunner(),renderReport(){context.renderFormat();},renderResult(){},unlockTabs(){},setMobilePage(){},announce(){},showToast(){},setSourceError(){},clearAudioPreview(){},navigateToStep(){},
    bytesText:String,sourceFormatLabel:()=> 'MP4',t:s=>s,inspectErrorMessage:String,processErrorMessage:String,diagnosticText:String,
    writeStorage:(...args)=>storage.push(args),storageKeys:{outputMode:'output-mode',aacBitrate:'aac-bitrate',mp3Bitrate:'mp3-bitrate',mp3Channels:'mp3-channels'}
  });
  vm.runInContext(functions + '\n' + events, context, {filename:inputPath});
  const load = async name => context.loadSource(new File(['synthetic'],name,{type:'video/mp4'}));
  return {context,state,downloads,calls,element,load,revoked,storage,runner,setRun:fn=>{run=fn;},setGetRunner:fn=>{getRunner=fn;},setReport:value=>{currentReport=value;}};
}

test('baseline: source selection uses the actual default stream index and WORKERFS', async()=>{
  const h=harness();await h.load('meeting.mov');await h.context.extract();h.context.saveResult();
  assert.equal(h.state.selectedIndex,7);assert.equal(h.calls[1].args.streamIndex,7);assert.equal(h.calls[1].args.kind,'copy');
  assert.equal(h.calls[1].files[0].workerfs,true);assert.ok(h.calls[1].files[0].data instanceof Blob);
  assert.equal(h.downloads[0].name,'meeting-audio.m4a');
});

test('baseline: completed output keeps its captured filename after editing the next draft', async()=>{
  const h=harness();await h.load('meeting.mov');await h.context.extract();
  h.element('#outputFilename').value='next run';h.context.saveResult();assert.equal(h.downloads[0].name,'meeting-audio.m4a');
});

test('dotted source default survives repeated blur, extraction and save', async()=>{
  const h=harness();await h.load('lecture.part1.mov');
  assert.equal(h.element('#outputFilename').value,'lecture.part1-audio');
  h.element('#outputFilename').listeners.blur();h.element('#outputFilename').listeners.blur();
  await h.context.extract();h.context.saveResult();assert.equal(h.downloads[0].name,'lecture.part1-audio.m4a');
});

test('dotted custom basenames are idempotent and keep the managed extension separate', async()=>{
  const h=harness();await h.load('meeting.mov');
  for (const name of ['interview.v2.final','会議.最終版','sound.mp3','.hidden']) {
    h.element('#outputFilename').value=name;
    for(let i=0;i<3;i++)assert.equal(h.context.normalizedOutputBase(),name);
  }
  h.element('#outputFilename').value='interview.v2.final';await h.context.extract();h.context.saveResult();
  assert.equal(h.downloads[0].name,'interview.v2.final.m4a');
});

test('unsafe input, empty input and dotted device names sanitize safely and repeatedly',()=>{
  const h=harness();
  for(const [input,expected] of [['bad/name:take','bad-name-take'],['  ..  ','audio'],['','audio'],['CON','CON-file'],['CON'+' '.repeat(107)+'x','CON-file'],['CON.v2','CON-file.v2'],['CON .v2','CON-file.v2'],['lPt9.edit.final','lPt9-file.edit.final'],['NUL.txt','NUL-file.txt'],['take\u0000\u001f\u007f','take---'],['  試験.音声...  ','試験.音声'],['abc \u00a0...','abc'],['...\u00a0...','audio']]){
    h.element('#outputFilename').value=input;
    for(let i=0;i<3;i++)assert.equal(h.context.normalizedOutputBase(),expected,JSON.stringify(input));
  }
});

test('length limits cannot leave a trailing dot, split Unicode or drop the default suffix',async()=>{
  const h=harness();
  for(const name of ['x'.repeat(109)+'.trailing','x'.repeat(109)+'\u3000abc','😀'.repeat(120),'CON.'+'x'.repeat(150)]){
    h.element('#outputFilename').value=name;const first=h.context.normalizedOutputBase();
    assert.ok(first.length<=110);assert.doesNotMatch(first,/[.\s]$/);assert.equal(first.isWellFormed(),true);assert.equal(h.context.normalizedOutputBase(),first);
  }
  await h.load('😀'.repeat(150)+'.part.mov');const first=h.element('#outputFilename').value;
  assert.ok(first.endsWith('-audio'));assert.ok(first.length<=110);assert.equal(h.context.normalizedOutputBase(),first);
});

test('reset is a native bilingual action associated with the next-run field',()=>{
  assert.match(html,/<button\b[^>]*id="useVideoNameButton"[^>]*type="button"[^>]*data-i18n="useVideoName"[^>]*>/);
  assert.match(html,/<input\b[^>]*id="outputFilename"[^>]*aria-describedby="[^"]*filenameHelp/);
  const translations=vm.runInNewContext('('+translationCode+')');
  assert.deepEqual(Object.keys(translations.ja).sort(),Object.keys(translations.en).sort());
  assert.equal(translations.en.useVideoName,'Use video name');assert.equal(translations.ja.useVideoName,'動画名を使う');
  assert.match(translations.en.filenameHelp,/next extraction/i);assert.match(translations.en.helpFilename,/completed/i);
});

test('reset restores the current source default, focuses the field and leaves settings alone',async()=>{
  const h=harness();await h.load('lecture.part1.mov');
  h.state.outputMode='mp3';h.context.renderFormat();h.element('#outputFilename').value='custom.v2';
  assert.equal(typeof h.element('#useVideoNameButton').onclick,'function');h.element('#useVideoNameButton').click();
  assert.equal(h.element('#outputFilename').value,'lecture.part1-audio');assert.equal(h.element('#outputFilename').focusCount,1);
  assert.equal(h.state.outputMode,'mp3');assert.equal(h.state.selectedIndex,7);assert.equal(h.state.mp3Channels,1);assert.equal(h.state.mp3BitrateKbps,256);assert.equal(h.element('#filenameExtension').textContent,'.mp3');assert.deepEqual(h.storage,[]);
});

test('reset does not rename or revoke the completed result; next run uses the reset draft',async()=>{
  const h=harness();await h.load('meeting.part1.mov');h.element('#outputFilename').value='custom.v2';await h.context.extract();
  const old=h.state.result, oldURL=old.url;h.element('#useVideoNameButton').click();h.context.saveResult();
  assert.equal(h.state.result,old);assert.equal(old.url,oldURL);assert.equal(h.downloads[0].name,'custom.v2.m4a');assert.deepEqual(h.revoked,[]);
  await h.context.extract();h.context.saveResult();assert.equal(h.downloads[1].name,'meeting.part1-audio.m4a');assert.deepEqual(h.revoked,[oldURL]);
});

test('reset is disabled and programmatic invocation is harmless without an inspected source',async()=>{
  const h=harness();
  for(const phase of ['empty','inspecting','error']){h.context.setPhase(phase);h.element('#outputFilename').value='keep';assert.equal(h.element('#useVideoNameButton').disabled,true);h.context.useVideoName();assert.equal(h.element('#outputFilename').value,'keep');}
  h.setReport({format:{videoStreamCount:1,audioStreamCount:0},audioStreams:[]});await h.load('silent.mov');assert.equal(h.element('#useVideoNameButton').disabled,true);
});

test('reset stays disabled through preparation and processing, then recovers after cancel',async()=>{
  const h=harness();await h.load('meeting.mov');h.element('#outputFilename').value='keep.v2';
  let resolvePreparation;h.setGetRunner(()=>new Promise(resolve=>{resolvePreparation=resolve;}));
  const promise=h.context.extract();assert.equal(h.state.phase,'preparing');assert.equal(h.element('#useVideoNameButton').disabled,true);
  h.context.useVideoName();assert.equal(h.element('#outputFilename').value,'keep.v2');h.context.cancelCurrent();resolvePreparation(h.runner);await promise;
  assert.equal(h.element('#useVideoNameButton').disabled,false);
  let started;const processingStarted=new Promise(resolve=>{started=resolve;});
  h.setGetRunner(async()=>h.runner);h.setRun(options=>new Promise((resolve,reject)=>{options.signal.addEventListener('abort',()=>reject(h.context.abortError()));started();}));
  const processing=h.context.extract();await processingStarted;assert.equal(h.state.phase,'processing');assert.equal(h.element('#useVideoNameButton').disabled,true);
  h.context.useVideoName();assert.equal(h.element('#outputFilename').value,'keep.v2');h.context.cancelCurrent();await processing;assert.equal(h.element('#useVideoNameButton').disabled,false);
});

test('a failed retry preserves the completed name and URL and permits resetting the next draft',async()=>{
  const h=harness();await h.load('meeting.mov');h.element('#outputFilename').value='completed.v2';await h.context.extract();const old=h.state.result,oldURL=old.url;
  h.setRun(async()=>{throw new Error('synthetic failure');});h.element('#outputFilename').value='attempt.v3';await h.context.extract();
  assert.equal(h.state.result,old);assert.equal(h.element('#useVideoNameButton').disabled,false);h.element('#useVideoNameButton').click();h.context.saveResult();
  assert.equal(h.downloads[0].name,'completed.v2.m4a');assert.equal(h.downloads[0].href,oldURL);assert.deepEqual(h.revoked,[]);
});

test('changing sources replaces the default; copy and conversion keep the actual selected stream',async()=>{
  const h=harness();await h.load('first.part.mov');h.element('#outputFilename').value='old custom';await h.load('second.part.mp4');
  h.element('#outputFilename').value='new custom';h.element('#useVideoNameButton').click();assert.equal(h.element('#outputFilename').value,'second.part-audio');
  for(const mode of ['copy','m4a','mp3','wav']){h.state.outputMode=mode;h.context.renderFormat();await h.context.extract();const args=h.calls.at(-1).args;
    assert.equal(args.streamIndex,7);assert.equal(args.kind,mode==='copy'?'copy':'transcode');assert.equal(args.format,mode==='copy'?'m4a':mode);
    if(mode==='mp3'){assert.equal(args.bitrateKbps,256);assert.equal(args.channels,1);}assert.equal(h.state.result.name,`second.part-audio.${mode==='copy'?'m4a':mode}`);
  }
});

test('runtime privacy and preference boundaries remain unchanged',()=>{
  assert.match(html,/connect-src 'none'/);assert.match(html,/workerfs:true/);assert.doesNotMatch(functions,/\.arrayBuffer\(/);
  const keys=vm.runInNewContext('('+html.match(/const storageKeys=(\{[^\n]+\});/)[1]+')');assert.equal(Object.keys(keys).length,5);
  const appCode=html.slice(html.indexOf('const APP_CONFIG='));
  assert.doesNotMatch(appCode,/fetch\s*\(|XMLHttpRequest|sendBeacon\s*\(/);
});
