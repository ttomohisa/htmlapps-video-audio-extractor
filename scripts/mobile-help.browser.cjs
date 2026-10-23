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
 await page.locator('#outputFilename').fill('mobile-help-audio');await page.locator('#extractButton').click();await page.waitForFunction(()=>!document.querySelector('#saveButton').disabled,null,{timeout:60000});
 const pending=page.waitForEvent('download');await page.locator('#saveButton').click();const download=await pending;assert.equal(download.suggestedFilename(),'mobile-help-audio.opus');const target=path.join(results,file.includes('self-extract')?'synthetic-loader.opus':'synthetic-readable.opus');await download.saveAs(target);const bytes=fs.readFileSync(target);assert.ok(bytes.length>100);assert.equal(bytes.subarray(0,4).toString(),'OggS');
 const duration=await page.evaluate(async encoded=>{const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));const context=new AudioContext();try{return(await context.decodeAudioData(bytes.buffer)).duration;}finally{await context.close();}},bytes.toString('base64'));assert.ok(duration>0&&duration<5);
 console.log('PASS synthetic canvas/oscillator video to edited-name Opus and native audio decode '+file);
}

async function main() {
  const results = path.resolve(__dirname, '..', 'test-results', 'mobile-help');
  fs.mkdirSync(results, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const file of ['dist/index.html', 'dist/index.self-extract.html', 'video-audio-extractor.html']) {
      for (const language of ['ja', 'en']) {
        for (const [width, height] of [[1360, 900], [561, 568], [560, 568], [360, 640], [320, 568], [393, 252]]) {
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

            await page.locator('#helpButton').click();
            const body = page.locator('#helpDialog > .dialog-body');
            assert.ok(await body.evaluate(el => el.lastElementChild.contains(document.querySelector('#buildVersion'))), label + ': build is final body child');
            assert.equal(await page.locator(buildSelector).count(), 1, label);
            assert.equal(await page.locator(buildSelector).isVisible(), true, label);
            for (const id of ["buildVersion", "coreVersion"]) assert.equal(await page.locator('#' + id).count(), 1, label);

            if (await page.locator(disclosureSelector).getAttribute('open') === null) {
              const summary = page.locator(disclosureSelector).locator('summary');
              await summary.focus();
              await page.keyboard.press('Enter');
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
