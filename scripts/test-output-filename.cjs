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
const functionNames = ['safeBase', 'defaultOutputBase', 'sourceAudioDuration', 'normalizedOutputBase', 'selectedTrack', 'outputSpec', 'virtualInputPath', 'workerFsBlob', 'isCurrentOperation', 'abortError', 'chooseDefaultTrack', 'loadSource', 'extract', 'saveResult', 'setPhase', 'renderFormat', 'cancelCurrent', 'formatName', 'revokeResult'];
const functions = functionNames.flatMap(name => lines.filter(line => new RegExp(`^\\s*(?:async )?function ${name}\\(`).test(line))).join('\n');
const editingHelpers = html.match(/    function editsEnabled\(\)[\s\S]*?(?=    function bitrateText\()/)?.[0];
assert.ok(editingHelpers,'editing helper functions present');
const events = lines.find(line => line.trimStart().startsWith("$('#extractButton').onclick=extract;"));
assert.ok(events, 'The app action handlers must be tested');
const translationCode = html.match(/const translations=(\{[\s\S]*?\n    \});/)[1];

function harness() {
  const elements = new Map(), downloads = [], calls = [], revoked = [], storage = [], blobs = [];
  let currentReport = {format:{name:'mov,mp4',duration:2,videoStreamCount:1,audioStreamCount:2},audioStreams:[
    {index:2,title:'First',duration:2,channels:2,sampleRate:48000,codec:{name:'opus',bitRate:128000},copy:{supported:true,format:'opus',extension:'opus'},transcode:{supported:true,formats:['m4a','mp3','wav']}},
    {index:7,default:true,title:'Selected',language:'eng',duration:2,channels:6,sampleRate:48000,codec:{name:'aac',bitRate:192000},copy:{supported:true,format:'m4a',extension:'m4a'},transcode:{supported:true,formats:['m4a','mp3','wav']}}
  ]};
  const element = id => {
    if (!elements.has(id)) elements.set(id, {value:'',disabled:false,hidden:false,textContent:'',style:{},attributes:{},listeners:{},focusCount:0,
      classList:{add(){},remove(){},toggle(){}},setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this.attributes[k];},replaceChildren(){},pause(){this.paused=true;},load(){},
      addEventListener(k,fn){this.listeners[k]=fn;},focus(){this.focusCount++;},click(){if(!this.disabled)this.onclick?.();}
    });
    return elements.get(id);
  };
  const state = {file:null,report:null,selectedIndex:null,result:null,attempt:null,trimEndAuto:true,trimMode:'full',trimStart:'0:00',trimEnd:'',gainMode:'none',wavePreview:null,waveLoading:false,waveAbort:null,waveRequestId:0,waveErrorKey:null,phase:'empty',generation:0,operationId:0,abort:null,outputMode:'copy',mp3Channels:1,aacBitrateKbps:192,mp3BitrateKbps:256,language:'en'};
  let run = async options => ({files:[{name:options.outputs[0],data:new Uint8Array([1,2,3,4])}]});
  const runner = {run:async options=>{calls.push(options);return run(options);}};
  let getRunner = async()=>runner;
  let url = 0;
  const context = vm.createContext({state,$:element,$$:()=>[],Blob,File,AbortController,Uint8Array,Date,Number,Error,TypeError,
    console:{error(){}},setTimeout,requestAnimationFrame:()=>{},matchMedia:()=>({matches:false}),URL:{createObjectURL:blob=>{const uri=`blob:synthetic-${++url}`;blobs.push({uri,blob});return uri;},revokeObjectURL:u=>revoked.push(u)},
    document:{body:{append(){},classList:{add(){},remove(){}}},createElement(tag){assert.equal(tag,'a');return {href:'',download:'',click(){downloads.push({href:this.href,name:this.download});},remove(){}};}},
    BrowserFFmpeg:{videoAudioExtractorInspectArgs:x=>({kind:'inspect',...x}),videoAudioExtractorCopyArgs:x=>({kind:'copy',...x}),videoAudioExtractorTranscodeArgs:x=>({kind:'transcode',...x}),decodeJsonOutput:()=>currentReport},
    getRunner:()=>getRunner(),renderReport(){context.renderFormat();},renderResult(){},unlockTabs(){},setMobilePage(){},announce(){},showToast(){},setSourceError(){},clearAudioPreview(){},navigateToStep(){},
    bytesText:String,sourceFormatLabel:()=> 'MP4',t:s=>s,inspectErrorMessage:String,processErrorMessage:String,diagnosticText:String,
    writeStorage:(...args)=>storage.push(args),storageKeys:{outputMode:'output-mode',aacBitrate:'aac-bitrate',mp3Bitrate:'mp3-bitrate',mp3Channels:'mp3-channels'}
  });
  vm.runInContext(editingHelpers + '\n' + functions + '\n' + events, context, {filename:inputPath});
  const load = async name => context.loadSource(new File(['synthetic'],name,{type:'video/mp4'}));
  return {context,state,downloads,calls,element,load,revoked,storage,blobs,runner,setRun:fn=>{run=fn;},setGetRunner:fn=>{getRunner=fn;},setReport:value=>{currentReport=value;}};
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

test('uncluttered filename field retains its name, extension and bilingual labels',()=>{
  assert.doesNotMatch(html, /id="useVideoNameButton"|id="filenameHelp"|class="filename-actions"/);
  assert.match(html, /<input\b[^>]*id="outputFilename"[^>]*aria-describedby="filenameExtension"/);
  const translations=vm.runInNewContext('('+translationCode+')');
  assert.deepEqual(Object.keys(translations.ja).sort(),Object.keys(translations.en).sort());
  assert.equal(translations.ja.outputFilename,'出力ファイル名');
  assert.equal(translations.en.outputFilename,'Output filename');
  assert.ok(!('useVideoName' in translations.ja));
  assert.ok(!('filenameHelp' in translations.en));
  assert.match(translations.en.helpLimitsNote,/preview is unavailable/i);
  assert.equal(translations.en.help1.startsWith('Choose a video.'),true);
  assert.equal(translations.ja.help3,'「音声を取り出す」を押し、完了したら保存します。');
  assert.ok(!('helpEdit' in translations.en)&&!('helpFilename' in translations.ja));
});

test('source selection prefills an editable output name without a reset control',async()=>{
  const h=harness();await h.load('lecture.part1.mov');
  assert.equal(h.element('#outputFilename').value,'lecture.part1-audio');
  h.state.outputMode='mp3';h.context.renderFormat();h.element('#outputFilename').value='custom.v2';
  assert.equal(h.context.normalizedOutputBase(),'custom.v2');
  assert.equal(h.state.outputMode,'mp3');
  assert.equal(h.state.selectedIndex,7);
  assert.equal(h.state.mp3Channels,1);
  assert.equal(h.state.mp3BitrateKbps,256);
  assert.equal(h.element('#filenameExtension').textContent,'.mp3');
  assert.deepEqual(h.storage,[]);
});

test('editing the next filename does not rename or revoke an existing completed result',async()=>{
  const h=harness();await h.load('meeting.part1.mov');
  h.element('#outputFilename').value='custom.v2';await h.context.extract();
  const old=h.state.result, oldURL=old.url;
  h.element('#outputFilename').value='second.v3';
  h.context.saveResult();
  assert.equal(h.state.result,old);
  assert.equal(old.url,oldURL);
  assert.equal(h.downloads[0].name,'custom.v2.m4a');
  assert.deepEqual(h.revoked,[]);
  await h.context.extract();h.context.saveResult();
  assert.equal(h.downloads[1].name,'second.v3.m4a');
  assert.deepEqual(h.revoked,[oldURL]);
});

test('filename remains an input-only field, with no secondary reset UI',async()=>{
  const h=harness();h.context.setPhase('empty');
  assert.equal(h.element('#outputFilename').disabled,false);
  assert.equal(h.element('#outputFilename').onclick,undefined);
  h.setReport({format:{videoStreamCount:1,audioStreamCount:0},audioStreams:[]});
  await h.load('silent.mov');
  assert.equal(h.element('#outputFilename').value,'silent-audio');
  h.element('#outputFilename').value='custom';
  assert.equal(h.context.normalizedOutputBase(),'custom');
});

test('filename edits are locked during preparation and processing, then unlocked after cancel',async()=>{
  const h=harness();await h.load('meeting.mov');
  h.element('#outputFilename').value='keep.v2';
  let resolvePreparation;h.setGetRunner(()=>new Promise(resolve=>{resolvePreparation=resolve;}));
  const promise=h.context.extract();
  assert.equal(h.state.phase,'preparing');assert.equal(h.element('#outputFilename').disabled,true);
  h.context.cancelCurrent();resolvePreparation(h.runner);await promise;
  assert.equal(h.element('#outputFilename').disabled,false);
  let started;const processingStarted=new Promise(resolve=>{started=resolve;});
  h.setGetRunner(async()=>h.runner);
  h.setRun(options=>new Promise((resolve,reject)=>{options.signal.addEventListener('abort',()=>reject(h.context.abortError()));started();}));
  const processing=h.context.extract();await processingStarted;
  assert.equal(h.state.phase,'processing');assert.equal(h.element('#outputFilename').disabled,true);
  h.context.cancelCurrent();await processing;
  assert.equal(h.element('#outputFilename').disabled,false);
  assert.equal(h.element('#outputFilename').value,'keep.v2');
});

test('failed retry retains prior completed result while keeping the next draft editable',async()=>{
  const h=harness();await h.load('meeting.mov');h.element('#outputFilename').value='completed.v2';
  await h.context.extract();const old=h.state.result,oldURL=old.url;
  h.setRun(async()=>{throw new Error('synthetic failure');});
  h.element('#outputFilename').value='attempt.v3';await h.context.extract();
  assert.equal(h.state.result,old);
  assert.equal(h.element('#outputFilename').disabled,false);
  assert.equal(h.element('#outputFilename').value,'attempt.v3');
  h.context.saveResult();
  assert.equal(h.downloads[0].name,'completed.v2.m4a');
  assert.equal(h.downloads[0].href,oldURL);
  assert.deepEqual(h.revoked,[]);
});

test('changing sources refills the default; copy and conversion keep the actual selected stream',async()=>{
  const h=harness();await h.load('first.part.mov');
  h.element('#outputFilename').value='old custom';await h.load('second.part.mp4');
  assert.equal(h.element('#outputFilename').value,'second.part-audio');
  for(const mode of ['copy','m4a','mp3','wav']){
    h.state.outputMode=mode;h.context.renderFormat();await h.context.extract();
    const args=h.calls.at(-1).args;
    assert.equal(args.streamIndex,7);
    assert.equal(args.kind,mode==='copy'?'copy':'transcode');
    assert.equal(args.format,mode==='copy'?'m4a':mode);
    if(mode==='mp3'){assert.equal(args.bitrateKbps,256);assert.equal(args.channels,1);}
    assert.equal(h.state.result.name,`second.part-audio.${mode==='copy'?'m4a':mode}`);
  }
});

test('selected audio duration takes priority over container and processing snapshots settings', async()=>{
  const h=harness();
  h.setReport({format:{name:'mov,mp4',duration:240,videoStreamCount:1,audioStreamCount:2},audioStreams:[
    {index:2,duration:240,channels:2,sampleRate:48000,codec:{name:'opus',bitRate:128000},copy:{supported:true,format:'opus',extension:'opus'},transcode:{supported:true,formats:['m4a','mp3','wav']}},
    {index:7,default:true,duration:12.5,channels:6,sampleRate:48000,codec:{name:'aac',bitRate:192000},copy:{supported:true,format:'m4a',extension:'m4a'},transcode:{supported:true,formats:['m4a','mp3','wav']}}
  ]});
  await h.load('lecture.mov');h.state.outputMode='mp3';h.state.mp3BitrateKbps=320;h.context.renderFormat();
  h.element('#outputFilename').value='captured.v2';
  let continuePreparation;h.setGetRunner(()=>new Promise(resolve=>{continuePreparation=resolve;}));
  const promise=h.context.extract();
  assert.equal(h.state.phase,'preparing');
  for(const selector of ['#outputFilename','#aacBitrate','#mp3Bitrate','#mp3Channels'])assert.equal(h.element(selector).disabled,true,selector);
  // Programmatic mutations simulate a stale handler firing despite disabled controls.
  h.element('#outputFilename').value='late-edit';h.state.mp3BitrateKbps=128;h.state.mp3Channels=2;
  continuePreparation(h.runner);await promise;
  assert.equal(h.calls.at(-1).args.kind,'transcode');assert.equal(h.calls.at(-1).args.bitrateKbps,320);
  assert.equal(h.calls.at(-1).args.channels,1);assert.equal(h.state.result.name,'captured.v2.mp3');
  assert.equal(h.state.result.duration,12.5);assert.equal(h.context.sourceAudioDuration(h.state.report.audioStreams[0]),240);
  assert.equal(h.element('#outputFilename').disabled,false);assert.equal(h.element('#mp3Bitrate').disabled,false);
});

test('missing track duration falls back to positive container duration only', async()=>{
  const h=harness();await h.load('fallback.mov');
  const tr=h.state.report.audioStreams.find(x=>x.index===7);
  assert.equal(h.context.sourceAudioDuration(tr),2);
  tr.duration=0;assert.equal(h.context.sourceAudioDuration(tr),2);
  tr.duration=Number.NaN;h.state.report.format.duration=-3;assert.equal(h.context.sourceAudioDuration(tr),null);
});

test('encoding method and size estimate occupy one row next to Extract audio',async()=>{
  assert.match(html, /<div class="action-row"><div class="output-facts"[^>]*><span class="estimate" id="methodSummary"><\/span><span class="estimate" id="outputEstimate"><\/span><\/div><button class="button primary" id="extractButton"/);
  const filename=html.match(/<div class="filename-row">([\s\S]*?)<div class="action-row">/);
  assert.ok(filename && !filename[1].includes('id="outputEstimate"'), 'size estimate is not beside filename');
  const h=harness();await h.load('meeting.mov');
  h.state.outputMode='wav';h.context.renderFormat();
  assert.equal(h.element('#methodSummary').textContent,'wavMethod');
  assert.equal(h.element('#outputEstimate').textContent,'approx');
  h.state.outputMode='mp3';h.context.renderFormat();
  assert.equal(h.element('#methodSummary').textContent,'mp3Method');
  assert.equal(h.element('#outputEstimate').textContent,'approx');
});


function syntheticWav(rate=8000,channels=1,seconds=2,amplitude=1000){
  const frames=Math.round(rate*seconds),bytes=frames*channels*2;
  const out=new Uint8Array(44+bytes),v=new DataView(out.buffer);
  for(const [at,tag] of [[0,'RIFF'],[8,'WAVE'],[12,'fmt '],[36,'data']])for(let i=0;i<tag.length;i++)out[at+i]=tag.charCodeAt(i);
  v.setUint32(4,36+bytes,true);v.setUint32(16,16,true);v.setUint16(20,1,true);
  v.setUint16(22,channels,true);v.setUint32(24,rate,true);v.setUint32(28,rate*channels*2,true);
  v.setUint16(32,channels*2,true);v.setUint16(34,16,true);v.setUint32(40,bytes,true);
  for(let i=0;i<frames*channels;i++)v.setInt16(44+i*2,amplitude,true);
  return out;
}


test('waveform envelope reads local WAV and preserves the whole duration',()=>{
  const h=harness(),source=syntheticWav(8000,1,2,1000);
  const info=h.context.inspectWavePcm(source),peaks=h.context.waveformPeaks(source);
  assert.equal(info.frames,16000);
  assert.equal(info.duration,2);
  assert.equal(peaks.duration,2);
  assert.equal(peaks.peaks.length,640);
  assert.ok(peaks.peaks.every(v=>v>0&&v<0.05));
  assert.equal(h.context.waveTime(65.25),'1:05.25');
  assert.equal(h.context.waveTime(3661),'1:01:01');
});

test('cached full-track waveform is reused when exporting a time-range WAV',async()=>{
  const h=harness();await h.load('meeting.mov');
  const tr=h.state.report.audioStreams.find(x=>x.index===7);tr.channels=1;tr.sampleRate=8000;
  const data=syntheticWav(8000,1,2,1250),before=h.calls.length;
  h.state.wavePreview={data,url:'blob:wave-cache',duration:2,trackIndex:tr.index,generation:h.state.generation,rate:8000,peaks:new Float32Array(640)};
  h.state.trimMode='range';h.element('#trimStart').value='0:00.2';h.element('#trimEnd').value='0:00.7';
  h.context.renderFormat();await h.context.extract();
  assert.equal(h.calls.length,before,'cached WAV should avoid a second FFmpeg operation');
  assert.equal(h.state.result.duration,.5);
  const exported=new Uint8Array(await h.blobs.at(-1).blob.arrayBuffer());
  assert.equal(new DataView(exported.buffer).getInt16(44,true),1250);
  assert.equal(exported.length,44+8000);
  await h.load('other.mov');
  assert.ok(h.revoked.includes('blob:wave-cache'),'new source releases waveform preview');
  assert.equal(h.state.wavePreview,null);
});


test('source duration prefills End and toggling range prepares waveform without a separate button',async()=>{
  const h=harness();await h.load('lecture.mov');
  assert.equal(h.element('#trimEnd').value,'0:02');
  assert.equal(h.state.trimEndAuto,true);
  assert.doesNotMatch(html,/id="trimHint"|data-i18n="waveHint"/);
  assert.match(html,/id="waveLoadButton"[^>]*hidden/,'reload action starts hidden');
  assert.ok(!html.includes('>波形を表示</button>'),'no explicit Show waveform action');

  const tr=h.state.report.audioStreams.find(x=>x.index===7);
  tr.channels=1;tr.sampleRate=8000;
  h.setRun(async options=>({files:[{name:options.outputs[0],data:syntheticWav(8000,1,2,1000)}]}));
  const change=h.element('#trimMode').listeners.change;
  assert.equal(typeof change,'function');
  change({target:{value:'range'}});
  for(let i=0;i<15&&!h.state.wavePreview;i++)await new Promise(resolve=>setTimeout(resolve,0));
  assert.ok(h.state.wavePreview,'waveform prepared automatically');
  assert.equal(h.state.wavePreview.duration,2);
  assert.equal(h.element('#trimEnd').value,'0:02');
  assert.equal(h.element('#waveLoadButton').hidden,true,'no extra waveform button');
  assert.equal(h.calls.at(-1).args.format,'wav','preview uses pinned WAV decoder');

  h.element('#trimEnd').value='0:01.25';
  h.element('#trimEnd').listeners.input();
  assert.equal(h.state.trimEndAuto,false,'manual end is no longer default-controlled');
  assert.equal(h.element('#trimEnd').value,'0:01.25');
  h.element('#trimMode').listeners.change({target:{value:'full'}});
  assert.equal(h.state.wavePreview,null,'switching off range releases waveform');
});


test('cancelling an in-flight waveform load aborts its worker and allows retry',async()=>{
  const h=harness();await h.load('first.mov');
  const tr=h.state.report.audioStreams.find(x=>x.index===7);tr.channels=1;tr.sampleRate=8000;
  h.state.trimMode='range';
  let pending;
  h.setRun(options=>new Promise(resolve=>{pending={resolve,options};}));
  const first=h.context.loadWavePreview();
  for(let i=0;i<10&&!pending;i++)await new Promise(resolve=>setTimeout(resolve,0));
  assert.ok(pending,'wave runner started');
  assert.equal(h.state.waveLoading,true);
  h.context.cancelWaveLoad();
  assert.equal(pending.options.signal.aborted,true,'worker cancellation signaled');
  assert.equal(h.state.waveLoading,false);
  assert.equal(h.state.waveErrorKey,'waveCancelled');
  pending.resolve({files:[{name:pending.options.outputs[0],data:syntheticWav()}]});
  await first;
  assert.equal(h.state.wavePreview,null,'late waveform is discarded');
  h.setRun(async options=>({files:[{name:options.outputs[0],data:syntheticWav()}]}));
  await h.context.loadWavePreview();
  assert.equal(h.state.wavePreview?.duration,2,'retry can load waveform');
  assert.equal(h.state.waveErrorKey,null);
});

test('switching source invalidates a pending waveform and discards late PCM data',async()=>{
  const h=harness();await h.load('first.mov');
  const tr=h.state.report.audioStreams.find(x=>x.index===7);tr.channels=1;tr.sampleRate=8000;
  h.state.trimMode='range';
  let pending;
  h.setRun(options=>new Promise(resolve=>{pending={resolve,options};}));
  const wave=h.context.loadWavePreview();
  for(let i=0;i<10&&!pending;i++)await new Promise(resolve=>setTimeout(resolve,0));
  assert.ok(pending,'wave runner started');
  const oldPending=pending;
  h.setRun(async options=>({files:[{name:options.outputs[0],data:syntheticWav()}]}));
  const promise=h.load('second.mov');
  assert.equal(oldPending.options.signal.aborted,true,'old waveform worker aborted');
  oldPending.resolve({files:[{name:oldPending.options.outputs[0],data:syntheticWav()}]});
  await wave;
  await promise;
  assert.equal(h.state.wavePreview,null,'old source cannot set new waveform');
  assert.equal(h.state.trimMode,'full','new source starts without stale trim setting');
  assert.equal(h.element('#trimEnd').value,'0:02','new source end reset');
});

test('time entry accepts m:ss and h:mm:ss but rejects malformed input',()=>{
  const h=harness();
  assert.equal(h.context.parseAudioTime('5:00'),300);
  assert.equal(h.context.parseAudioTime('1:02:03.5'),3723.5);
  assert.equal(h.context.parseAudioTime('20.25'),20.25);
  for(const value of ['','-1','1:60','1:03:69','1:2:3:4','abc','1:xx'])assert.equal(h.context.parseAudioTime(value),null,value);
});

test('turning off edits restores the previously selected audio output',async()=>{
  const h=harness();await h.load('meeting.mov');
  h.state.outputMode='mp3';h.context.renderFormat();
  h.state.trimMode='range';h.element('#trimStart').value='0:00';h.element('#trimEnd').value='0:01';
  h.context.renderFormat();
  assert.equal(h.state.outputMode,'wav');
  assert.equal(h.state.preEditOutputMode,'mp3');
  h.state.trimMode='full';h.context.renderFormat();
  assert.equal(h.state.outputMode,'mp3');
  assert.equal(h.state.preEditOutputMode,null);
});

test('time-range edit cuts precisely to WAV and increases gain without changing the input',async()=>{
  const h=harness();await h.load('meeting.mov');
  const track=h.state.report.audioStreams.find(x=>x.index===7);
  track.channels=1;track.sampleRate=8000;
  const original=syntheticWav();
  h.setRun(async options=>({files:[{name:options.outputs[0],data:original}]}));
  h.state.trimMode='range';h.state.gainMode='6';
  h.element('#trimStart').value='0:00.25';h.element('#trimEnd').value='0:00.75';
  h.context.renderFormat();
  assert.equal(h.state.outputMode,'wav');
  assert.equal(h.context.outputSpec().mode,'edit');
  assert.equal(h.element('#editError').hidden,true);
  await h.context.extract();
  assert.equal(h.calls.at(-1).args.format,'wav');
  assert.equal(h.state.result.name,'meeting-audio.wav');
  assert.equal(h.state.result.duration,.5);
  const bytes=new Uint8Array(await h.blobs.at(-1).blob.arrayBuffer()),view=new DataView(bytes.buffer);
  assert.equal(bytes.length,44+8000);
  assert.equal(view.getUint32(24,true),8000);
  assert.ok(view.getInt16(44,true)>1900&&view.getInt16(44,true)<2100);
  assert.equal(new DataView(original.buffer).getInt16(44,true),1000,'source untouched');
});

test('peak normalization reaches -1 dBFS and rejects invalid or oversize ranges',async()=>{
  const h=harness();await h.load('meeting.mov');
  const tr=h.state.report.audioStreams.find(x=>x.index===7);tr.channels=1;tr.sampleRate=8000;
  h.setRun(async options=>({files:[{name:options.outputs[0],data:syntheticWav(8000,1,2,1000)}]}));
  h.state.gainMode='normalize';
  h.context.renderFormat();assert.equal(h.element('#editError').hidden,true);
  await h.context.extract();
  const wave=new Uint8Array(await h.blobs.at(-1).blob.arrayBuffer());
  const value=new DataView(wave.buffer).getInt16(44,true);
  assert.ok(value>=29100&&value<=29300,'normalized peak near -1 dBFS');
  h.state.trimMode='range';h.element('#trimStart').value='1:58';
  h.element('#trimEnd').value='1:00';
  assert.equal(h.context.editConfiguration(tr).error,'trimInvalid');
  tr.duration=100000;
  assert.equal(h.context.editConfiguration(tr).error,'editTooLarge');
});


test('silent peak normalization remains silence, even across stereo channels',async()=>{
  const h=harness(),source=syntheticWav(8000,2,0.4,0);
  const done=await h.context.editWavPcm16(source,{start:0,end:.4,gain:'normalize',maxBytes:1e7},null);
  assert.equal(done.duration,.4);
  const bytes=done.data,view=new DataView(bytes.buffer);
  assert.equal(view.getUint16(22,true),2);
  assert.equal(view.getUint32(40,true),8000*.4*4);
  assert.equal(view.getInt16(44,true),0);
  assert.equal(view.getInt16(bytes.length-2,true),0);
});

test('positive gain clips safely at PCM16 bounds without wrapping',async()=>{
  const h=harness(),source=syntheticWav(8000,2,.2,25000);
  const edited=await h.context.editWavPcm16(source,{start:0,end:.2,gain:'6',maxBytes:1e7},null);
  const view=new DataView(edited.data.buffer);
  assert.equal(view.getInt16(44,true),32767);
  assert.equal(view.getInt16(46,true),32767);
  assert.equal(new DataView(source.buffer).getInt16(44,true),25000,'original unchanged');
});

test('PCM editing rejects malformed and over-budget files, and respects cancellation',async()=>{
  const h=harness();
  await assert.rejects(h.context.editWavPcm16(new Uint8Array(44),{start:0,end:.2,gain:'none',maxBytes:1e7},null),/WAV|header|chunk|PCM/i);
  await assert.rejects(h.context.editWavPcm16(syntheticWav(),{start:0,end:1,gain:'none',maxBytes:3},null),/memory limit/i);
  const controller=new AbortController();controller.abort();
  await assert.rejects(h.context.editWavPcm16(syntheticWav(),{start:0,end:1,gain:'normalize',maxBytes:1e7},controller.signal),e=>e?.name==='AbortError');
  const done=await h.context.editWavPcm16(syntheticWav(8000,1,.2,100),{start:.05,end:.1,gain:'none',maxBytes:1e7},null);
  assert.ok(Math.abs(done.duration-.05)<1e-8);
  assert.equal(done.data.length,44+800,'short boundary output');
});

test('the cached editing path switches progress to determinate and reaches 100%',async()=>{
  const h=harness();await h.load('meeting.mov');
  const tr=h.state.report.audioStreams.find(x=>x.index===7);
  tr.channels=1;tr.sampleRate=8000;
  const progress=h.element('#progressTrack');
  const removed=[];progress.classList.remove=x=>removed.push(x);
  h.state.wavePreview={data:syntheticWav(),url:'blob:wave-preview',duration:2,trackIndex:tr.index,generation:h.state.generation,rate:8000,peaks:new Float32Array(640)};
  h.state.trimMode='range';h.element('#trimStart').value='0:00.1';h.element('#trimEnd').value='0:00.6';
  h.context.renderFormat();await h.context.extract();
  assert.ok(removed.includes('indeterminate'),'WAV PCM pass must leave indeterminate mode');
  assert.equal(h.element('#progressBar').style.width,'100%','cached editing reaches 100%');
  assert.equal(progress.attributes['aria-valuenow'],undefined,'completed state clears busy progress ARIA value');
});

test('runtime privacy and preference boundaries remain unchanged',()=>{
  assert.match(html,/connect-src 'none'/);assert.match(html,/workerfs:true/);assert.doesNotMatch(functions,/\.arrayBuffer\(/);
  const keys=vm.runInNewContext('('+html.match(/const storageKeys=(\{[^\n]+\});/)[1]+')');assert.equal(Object.keys(keys).length,5);
  const appCode=html.slice(html.indexOf('const APP_CONFIG='));
  assert.doesNotMatch(appCode,/fetch\s*\(|XMLHttpRequest|sendBeacon\s*\(/);
});
