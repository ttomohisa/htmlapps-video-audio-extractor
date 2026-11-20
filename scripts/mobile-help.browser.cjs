'use strict';
// Run against the official generated files in the unprivileged PR build job.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const buildSelector = "#helpDialog .build-details";
const disclosureSelector = "#helpDialog .build-details details";


async function prepareApp(page,width,label){
 assert.equal(await page.locator('.mobile-tabs').isVisible(),width<=560,label+': functional page tabs');
 if(width<=560)assert.ok(await page.locator('.mobile-tabs').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}),label+': functional tabs fit');
}
async function smoke(page,results,file){
 const encoded=await page.evaluate(async()=>{
   const canvas=document.createElement('canvas');canvas.width=160;canvas.height=120;const c=canvas.getContext('2d');c.fillStyle='#16624f';c.fillRect(0,0,160,120);
   const audio=new AudioContext(),dest=audio.createMediaStreamDestination(),osc=audio.createOscillator();osc.frequency.value=440;osc.connect(dest);osc.start();await audio.resume();
   const stream=canvas.captureStream(10);stream.addTrack(dest.stream.getAudioTracks()[0]);const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8,opus'}),chunks=[];recorder.ondataavailable=e=>chunks.push(e.data);const stopped=new Promise(resolve=>recorder.onstop=resolve);recorder.start();await new Promise(resolve=>setTimeout(resolve,1000));recorder.stop();await stopped;osc.stop();stream.getTracks().forEach(track=>track.stop());await audio.close();
   return await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(new Blob(chunks,{type:'video/webm'}));});
 });
 await page.locator('#fileInput').setInputFiles({name:'synthetic-video.webm',mimeType:'video/webm',buffer:Buffer.from(encoded.split(',')[1],'base64')});await page.waitForFunction(()=>!document.querySelector('#extractButton').disabled,null,{timeout:60000});
 assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('has-source')),true,'selected video activates compact intro');
 assert.equal(await page.locator('#audioSummary .summary-item').count(),4,'audio metadata has all four values');
 await page.locator('.mobile-tab[data-page="audio"]').click();
 assert.equal(await page.locator('#audioPanel').isVisible(),true,'audio summary is visible before measuring text');
 assert.ok(await page.locator('#audioSummary .summary-item').first().evaluate(el=>{const s=getComputedStyle(el),item=el.getBoundingClientRect(),label=el.querySelector('.summary-label')?.getBoundingClientRect();return s.paddingLeft==='16px'&&s.paddingRight==='16px'&&label?.left-item.left>=15;}),'audio summary labels are inset on the smartphone');
 await page.locator('.mobile-tab[data-page="format"]').click();
 assert.equal(await page.locator('.page-intro').isVisible(),false,'mobile intro disappears entirely after choosing video');
 await page.locator('#outputFilename').fill('mobile-help-audio');await page.locator('#extractButton').click();await page.waitForFunction(()=>!document.querySelector('#saveButton').disabled,null,{timeout:60000});
 const pending=page.waitForEvent('download');await page.locator('#saveButton').click();const download=await pending;assert.equal(download.suggestedFilename(),'mobile-help-audio.opus');const target=path.join(results,file.includes('self-extract')?'synthetic-loader.opus':'synthetic-readable.opus');await download.saveAs(target);const bytes=fs.readFileSync(target);assert.ok(bytes.length>100);assert.equal(bytes.subarray(0,4).toString(),'OggS');
 const duration=await page.evaluate(async encoded=>{const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));const context=new AudioContext();try{return(await context.decodeAudioData(bytes.buffer)).duration;}finally{await context.close();}},bytes.toString('base64'));assert.ok(duration>0&&duration<5);
 // The existing embedded core decodes the audio to PCM WAV. Browser-local
 // trimming and peak normalization then operate without any external requests.
 await page.locator('.mobile-tab[data-page="format"]').click();
 await page.locator('#trimMode').selectOption('range');
 assert.equal(await page.locator('#waveLoadButton').isVisible(),true,'waveform load is available in range mode');
 await page.locator('#waveLoadButton').click();
 await page.waitForFunction(()=>{const ready=document.querySelector('#waveReady');const canvas=document.querySelector('#waveCanvas');return ready&&!ready.hidden&&canvas.width>0;},null,{timeout:60000});
 assert.equal(await page.locator('#waveLoadButton').isVisible(),false,'waveform preparation is reused');
 const wavCanvas=await page.locator('#waveCanvas').evaluate(el=>{const pixels=el.getContext('2d').getImageData(0,0,el.width,el.height).data;return{width:el.width,hasBars:pixels.some((v,i)=>i%4===3&&v>0)};});
 assert.ok(wavCanvas.width>=200&&wavCanvas.hasBars,'actual waveform contains sampled PCM peaks');
 await page.locator('#wavePlayButton').click();
 await page.waitForFunction(()=>{const a=document.querySelector('#waveAudio');return a&&!a.paused&&a.currentTime>.04;},null,{timeout:12000});
 await page.locator('#waveMarkStart').click();
 assert.notEqual(await page.locator('#trimStart').inputValue(),'0:00','start can be marked while audio plays');
 await page.locator('#wavePlayButton').click();
 assert.equal(await page.locator('#waveAudio').evaluate(a=>a.paused),true,'audio preview can be paused');
 const bounds=await page.locator('#wavePlot').boundingBox();
 await page.locator('#wavePlot').click({position:{x:bounds.width*.35,y:60}});
 await page.locator('#waveMarkStart').click();
 assert.ok(await page.locator('#trimStart').inputValue()!=='0:00','set start from selected playback position');
 await page.locator('#waveEndHandle').press('ArrowLeft');
 assert.ok(await page.locator('#trimEnd').inputValue()!=='','end marker supports keyboard adjustments');
 const knob=await page.locator('#waveStartHandle').boundingBox();
 await page.mouse.move(knob.x+knob.width/2,knob.y+knob.height/2);
 await page.mouse.down();
 await page.mouse.move(bounds.x+bounds.width*.2,bounds.y+bounds.height/2,{steps:8});
 await page.mouse.up();
 const selectedStart=await page.locator('#trimStart').inputValue();
 assert.ok(selectedStart!=='0:00'&&selectedStart!=='','start handle can be pointer dragged');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'waveform controls do not cause horizontal scroll');
 await page.locator('#trimStart').fill('0:00.2');
 await page.locator('#trimEnd').fill('0:00.7');
 await page.locator('#gainMode').selectOption('normalize');
 assert.equal(await page.locator('.format-choice[data-mode="copy"] input').isDisabled(),true,'copy is unavailable for edited audio');
 assert.equal(await page.locator('.format-choice[data-mode="mp3"] input').isDisabled(),true,'editing is WAV-only');
 assert.equal(await page.locator('.format-choice[data-mode="wav"] input').isChecked(),true,'edit visibly chooses WAV');
 assert.equal(await page.locator('#editNote').isVisible(),true,'WAV limitation is explained');
 assert.equal(await page.locator('#editError').isVisible(),false,'valid time range');
 await page.locator('#outputFilename').fill('time-and-volume');
 await page.locator('#extractButton').click();
 await page.waitForFunction(()=>!document.querySelector('#saveButton').disabled&&document.querySelector('#resultFormat')?.textContent==='WAV',null,{timeout:60000});
 const editedDuration=await page.locator('#resultDuration').textContent();
 assert.match(editedDuration,/0:00|0:01/);
 const pendingEdited=page.waitForEvent('download');
 await page.locator('#saveButton').click();
 const editedDownload=await pendingEdited;
 assert.equal(editedDownload.suggestedFilename(),'time-and-volume.wav');
 const editedPath=path.join(results,file.includes('self-extract')?'edited-self-extract.wav':'edited-readable.wav');
 await editedDownload.saveAs(editedPath);
 const editedBytes=fs.readFileSync(editedPath);
 assert.equal(editedBytes.toString('ascii',0,4),'RIFF','valid PCM container');
 assert.equal(editedBytes.toString('ascii',8,12),'WAVE','valid WAV header');
 const editedSeconds=await page.evaluate(async encoded=>{
   const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
   const ctx=new AudioContext();
   try{return(await ctx.decodeAudioData(bytes.buffer)).duration;}finally{await ctx.close()}
 },editedBytes.toString('base64'));
 assert.ok(editedSeconds>=.4&&editedSeconds<=.6,'range length near 0.5 sec');
 console.log('PASS generated Opus + WAV time trim and peak normalize '+file);
 console.log('PASS synthetic canvas/oscillator video to edited-name Opus and native audio decode '+file);
}

// Check rendered geometry, including clipping by an ancestor (isVisible alone misses it).
async function auditHeader(page, label) {
  const badge = page.locator('header #versionBadge');
  assert.equal(await badge.textContent(), 'v' + require('../app.config.json').version, label + ': current header version');
  assert.equal(await badge.isVisible(), true, label + ': version visible');
  const clipped = await badge.evaluate(el => {
    const r = el.getBoundingClientRect(), problems = [];
    if (r.width <= 0 || r.height <= 0 || r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1) problems.push('outside viewport');
    if (el.scrollWidth > el.clientWidth + 1) problems.push('version text clipped');
    for (let p = el.parentElement; p; p = p.parentElement) {
      const s = getComputedStyle(p), b = p.getBoundingClientRect();
      if (/hidden|clip|auto|scroll/.test(s.overflowX) && (r.left < b.left - 1 || r.right > b.right + 1)) problems.push('ancestor clips x: ' + p.className);
      if (/hidden|clip|auto|scroll/.test(s.overflowY) && (r.top < b.top - 1 || r.bottom > b.bottom + 1)) problems.push('ancestor clips y: ' + p.className);
    }
    return problems;
  });
  assert.deepEqual(clipped, [], label + ': complete header version remains readable');
  const help = page.locator('#helpButton svg');
  assert.equal(await help.isVisible(), true, label + ': Help icon visible');
  assert.ok(await help.evaluate(svg => {
    const paths = [...svg.querySelectorAll('path')], shape = paths.map(p => p.getAttribute('d')).join(' ');
    return /[aAcC]/.test(shape) && paths.some(p => /[hH]\.01/.test(p.getAttribute('d')) && getComputedStyle(p).strokeLinecap === 'round') && svg.getBBox().width > 0;
  }), label + ': question-mark curve and painted dot, not information icon');
  const shield = page.locator('.local-badge svg');
  if (await shield.count()) {
    assert.ok(await shield.evaluate(svg => [...svg.querySelectorAll('path')].some(p => /^M12 3 5 6/.test(p.getAttribute('d')))), label + ': local-processing shield');
  }
}

async function main() {
  const results = path.resolve(__dirname, '..', 'test-results', 'mobile-help');
  fs.mkdirSync(results, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const file of ['dist/index.html', 'dist/index.self-extract.html', 'video-audio-extractor.html']) {
      for (const language of ['ja', 'en']) {
        for (const [width, height] of [[1360, 900], [561, 568], [560, 568], [360, 640], [390,844], [320, 568], [393, 252]]) {
          const context = await browser.newContext({ viewport: { width, height }, locale: language, reducedMotion: 'reduce' });
          const page = await context.newPage();
          const errors = [], requests = [];
          page.on('pageerror', error => errors.push(error.message));
          page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
          page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
          const label = `${file} ${language} ${width}x${height}`;
          try {
            await page.goto(pathToFileURL(path.resolve(__dirname, '..', file)).href);
            await page.locator('#helpButton').waitFor();
            if (await page.locator('html').getAttribute('lang') !== language) await page.locator('#languageButton').click();
            await page.locator('#languageButton').click();await page.locator('#languageButton').click();
            assert.equal(await page.locator('html').getAttribute('lang'),language,label+': repeated language toggles');
            for(const id of ["buildVersion", "coreVersion"]){assert.equal(await page.locator('#'+id).count(),1,label+': unique metadata after toggles');assert.ok(!['','—','-'].includes((await page.locator('#'+id).textContent()).trim()),label+': populated metadata after toggles');}
            assert.equal(await page.locator('[data-i18n="localBadge"]').textContent(), language === 'en' ? 'Fully local processing' : '完全ローカル処理', label);
            assert.equal(await page.locator('.local-badge').isVisible(),width>560,label+': fully local label only shown on desktop');
            assert.equal(await page.locator('.page-intro p').isVisible(),true,label+': initial description visible before choosing a video');
            if (width <= 560) {
              const heroSpacing = await page.evaluate(() => {
                const header = document.querySelector('.app-header').getBoundingClientRect();
                const paragraph = document.querySelector('.page-intro p').getBoundingClientRect();
                const panel = document.querySelector('#videoPanel').getBoundingClientRect();
                return { top: paragraph.top - header.bottom, bottom: panel.top - paragraph.bottom };
              });
              assert.ok(heroSpacing.top >= 0 && heroSpacing.top <= 16, label + ': intro sits close below header: ' + JSON.stringify(heroSpacing));
              assert.ok(heroSpacing.bottom >= 0 && heroSpacing.bottom <= 16, label + ': intro sits close above first panel: ' + JSON.stringify(heroSpacing));
            }
            assert.equal(await page.locator('.page-intro h1').count(),0,label+': no visible hero title element');
            assert.equal(await page.locator('#useVideoNameButton').count(),0,label+': no unnecessary source-name reset button');
            assert.equal(await page.locator('#filenameHelp').count(),0,label+': no redundant filename helper text');
            const outputFactLayout = await page.evaluate(language => {
              const panel=document.querySelector('#formatPanel'), group=document.querySelector('.output-facts');
              const method=document.querySelector('#methodSummary'), size=document.querySelector('#outputEstimate');
              const hidden=getComputedStyle(panel).display==='none';
              if(hidden) panel.classList.add('mobile-active');
              const oldMethod=method.textContent, oldSize=size.textContent;
              method.textContent=language==='ja'?'MP3 320 kbps · ステレオ':'MP3 320 kbps · Stereo';
              size.textContent=language==='ja'?'目安 1.3 MB':'Approx. 1.3 MB';
              const a=method.getBoundingClientRect(),b=size.getBoundingClientRect(),g=group.getBoundingClientRect();
              const result={
                isGrouped:method.parentElement===group&&size.parentElement===group&&group.parentElement.classList.contains('action-row'),
                flex:getComputedStyle(group).display, direction:getComputedStyle(group).flexDirection,
                aligned:Math.abs(a.top-b.top)<2&&b.left>a.right&&b.right<=g.right+1,
                noOverflow:document.documentElement.scrollWidth<=innerWidth,
                filenameAreaHasEstimate:document.querySelector('.filename-row').contains(size),
                accessibleLabel:group.getAttribute('aria-label')
              };
              method.textContent=oldMethod;size.textContent=oldSize;
              if(hidden) panel.classList.remove('mobile-active');
              return result;
            },language);
            assert.equal(outputFactLayout.isGrouped,true,label+': estimated size and method share the action row');
            assert.equal(outputFactLayout.flex,'flex',label+': output facts use flex');
            assert.equal(outputFactLayout.direction,'row',label+': output facts flow horizontally');
            assert.equal(outputFactLayout.aligned,true,label+': MP3 facts sit side by side without wrapping');
            assert.equal(outputFactLayout.noOverflow,true,label+': output facts fit viewport');
            assert.equal(outputFactLayout.filenameAreaHasEstimate,false,label+': estimate is not beside filename');
            assert.equal(outputFactLayout.accessibleLabel,language==='ja'?'出力情報':'Output details',label+': group label is localized');
            assert.ok(await page.evaluate(()=>{const host=document.querySelector('#audioSummary');const item=document.createElement('div');item.className='summary-item';item.innerHTML='<span class="summary-label">Codec</span>';host.append(item);const style=getComputedStyle(item);const rect=item.getBoundingClientRect(),label=item.querySelector('span').getBoundingClientRect();const okay=style.paddingLeft==='16px'&&style.paddingRight==='16px'&&(rect.width===0||label.left-rect.left>=15);item.remove();return okay;}),label+': audio metadata label inset on desktop and mobile');
            assert.equal(await page.locator('main > h1.sr-only').count(),1,label+': retained semantic page heading');
            assert.ok(await page.locator('#videoPanel').evaluate(el=>getComputedStyle(el).boxShadow==='none'&&getComputedStyle(el).borderRadius==='8px'),label+': quiet workflow panel styling');
            assert.equal(await page.locator('#dropZone .drop-icon svg').count(),1,label+': download tray icon');
            assert.ok(await page.locator('#dropZone .drop-icon svg').evaluate(svg=>[...svg.querySelectorAll('path')].some(path=>path.getAttribute('d')==='M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3')),label+': reference tray geometry');
            assert.ok(await page.locator('.local-badge').evaluate(el => {
              const box = el.getBoundingClientRect();
              const range = document.createRange();
              range.selectNodeContents(el.querySelector('[data-i18n="localBadge"]'));
              return box.left >= 0 && box.right <= innerWidth && el.scrollWidth <= el.clientWidth + 1
                && [...range.getClientRects()].every(rect => rect.left >= box.left - 1 && rect.right <= box.right + 1 && rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1);
            }), label + ': badge text fits');
            assert.equal(await page.locator('main #buildVersion').count(), 0, label);
            assert.equal(await page.locator('footer').isVisible(), width > 560, label);
            await prepareApp(page, width, label);

            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label + ': page width');

            await auditHeader(page, label);
        if (file === 'dist/index.html' && [320,360,390,1360].includes(width)) await page.screenshot({path:path.join(results, `${language}-${width}-main.png`)});
        await page.locator('#helpButton').click();
        const visibleHelpText = await page.locator('#helpDialog').innerText();
        assert.doesNotMatch(visibleHelpText, /(?:EN\s*\/\s*JA|JA\s*[\/／]\s*EN|ヘッダーのEN|Use EN in the header)/, label + ': redundant language instructions removed');
        assert.doesNotMatch(visibleHelpText, /(?:ヘルプや確認画面は閉じるボタン|dismissing a confirmation keeps existing audio|Dismiss Help or confirmations)/i, label+': redundant modal instructions removed');
        assert.match(visibleHelpText, language === 'ja' ? /音声のない動画からは取り出せません/ : /Videos without audio cannot be extracted/, label+': useful audio limitation');
        assert.match(visibleHelpText, language === 'ja' ? /プレビューできない形式でも保存できます/ : /You can save even if preview is unavailable/, label+': useful download guidance');

            const body = page.locator('#helpDialog > .dialog-body');
            assert.ok(await body.evaluate(el => el.lastElementChild.contains(document.querySelector('#buildVersion'))), label + ': build is final body child');
            assert.equal(await page.locator(buildSelector).count(), 1, label);
            assert.equal(await page.locator(buildSelector).isVisible(), true, label);
            for (const id of ["buildVersion", "coreVersion"]) assert.equal(await page.locator('#' + id).count(), 1, label);

            if (await page.locator(disclosureSelector).getAttribute('open') === null) {
              const summary = page.locator(disclosureSelector).locator('summary');
              await summary.press('Enter');
              assert.equal(await page.locator(disclosureSelector).getAttribute('open'), '', label);
              assert.notEqual(await page.locator('#buildVersion').innerText(), '—', label);
              assert.ok(!['','—','-'].includes((await page.locator('#coreVersion').innerText()).trim()),label+': populated metadata');
            }
            await body.evaluate(el => { el.scrollTop = el.scrollHeight; });
            const finalItem = page.locator("#helpDialog .build-info [data-i18n=\"none\"]");
            const finalBox = await finalItem.boundingBox(), bodyBox = await body.boundingBox();
            console.log('GEOMETRY ' + label + ' ' + JSON.stringify({ finalBox, bodyBox, viewportHeight: height }));
            assert.ok(finalBox && bodyBox && finalBox.y >= 0 && finalBox.y + finalBox.height <= height && finalBox.y >= bodyBox.y - 1 && finalBox.y + finalBox.height <= bodyBox.y + bodyBox.height + 1, label + ': final Help item reachable');
            assert.ok(await body.evaluate(el => el.scrollWidth <= el.clientWidth + 1), label + ': Help width');
            const headerBox = await page.locator('#helpDialog .dialog-head').boundingBox();
            assert.ok(headerBox && headerBox.x >= 0 && headerBox.x + headerBox.width <= width && headerBox.y >= 0 && headerBox.y + headerBox.height <= height, label + ': header visible');
            const closeBox=await page.locator('#closeHelpButton').boundingBox();
            assert.ok(closeBox && closeBox.x>=0 && closeBox.x+closeBox.width<=width && closeBox.y>=headerBox.y && closeBox.y+closeBox.height<=headerBox.y+headerBox.height+1,label+': Close fits header');
            if (file === 'dist/index.html' && [1360, 320].includes(width)) {
              await page.screenshot({ path: path.join(results, `help-${language}-${width}.png`) });
            }
            const dialogBox = await page.locator('#helpDialog').boundingBox();
            assert.ok(finalBox.y >= dialogBox.y - 1 && finalBox.y + finalBox.height <= dialogBox.y + dialogBox.height + 1, label + ': final item inside dialog');
            assert.ok(dialogBox.y > 1, label + ': top coordinate is genuine backdrop');
            const beforeScroll = await page.evaluate(() => scrollY);
            await page.mouse.move(2, 1);
            await page.mouse.wheel(0, 400);
            await page.waitForTimeout(100);
            assert.equal(await page.evaluate(() => scrollY), beforeScroll, label + ': background locked');
            await page.keyboard.press('Escape');
            assert.equal(await page.locator('#helpDialog').isVisible(), false, label + ': Escape');
            await page.locator('#helpButton').click();
            await page.locator('#closeHelpButton').click();
            assert.equal(await page.locator('#helpDialog').isVisible(), false, label + ': reopen and Close');
            await page.locator('#helpButton').click();
            await page.mouse.click(2, 1);
            assert.equal(await page.locator('#helpDialog').isVisible(), false, label + ': backdrop');
            if(file!=='video-audio-extractor.html' && language==='ja' && width===360) await smoke(page,results,file);
            assert.deepEqual(errors, [], label + ': console errors');
            assert.deepEqual(requests, [], label + ': external runtime requests');
            console.log('PASS ' + label);
          } catch (error) {
            await page.screenshot({ path: path.join(results, `failure-${file.replace(/[^a-z0-9]/gi, '-')}-${language}-${width}x${height}.png`) }).catch(() => {});
            throw error;
          } finally {
            await context.close();
          }
        }
      }
    }
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
