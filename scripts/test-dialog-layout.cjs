'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test');
let html=fs.readFileSync(process.argv[2]||path.join(__dirname,'../src/index.template.html'),'utf8');
const payload=html.match(/<script id="self-extract-payload"[^>]*>([A-Za-z0-9+/=\s]+)<\/script>/);
if(payload)html=require('node:zlib').gunzipSync(Buffer.from(payload[1],'base64')).toString('utf8');
// CSS contracts supplement native viewport/focus checks. Removing the sizing
// allocation or modal lock must fail before any browser retest is claimed.
test('native modals lock both scrolling roots only while modal',()=>{
  assert.match(html,/html:has\(dialog:modal\),body:has\(dialog:modal\)\{overflow:hidden\}/);
});
test('Help and confirmation use open-only flex with a fixed header and scrolling body',()=>{
  assert.match(html,/\.help-dialog\[open\],\.confirm-dialog\[open\]\{display:flex;flex-direction:column\}/);
  assert.match(html,/\.help-dialog,\.confirm-dialog\{[^}]*overflow:hidden/);
  assert.match(html,/\.dialog-head\{[^}]*flex:none/);
  assert.match(html,/\.dialog-body\{[^}]*min-height:0;flex:1;[^}]*overflow:auto;overscroll-behavior:contain/);
  assert.match(html,/\.icon-button\{[^}]*flex:none/);
});
test('narrow header wraps its complete title and keeps version and actions visible',()=>{
  assert.match(html,/@media\(max-width:560px\)\{[^\n]*\.brand-name\{[^}]*white-space:normal;overflow:visible;overflow-wrap:anywhere/);
  assert.match(html,/\.header-actions\{[^}]*flex-shrink:0/);
  assert.match(html,/\.version-badge\{[^}]*white-space:nowrap/);
});
test('existing local-processing badge keeps the decorative shared shield',()=>{
  const badge=html.match(/<[^>]+class="local-badge"[^>]*>([\s\S]*?)<\/div>/)?.[1];
  assert.ok(badge);assert.match(badge,/<svg[^>]*aria-hidden="true"[^>]*><path d="M12 3 5 6v5c0 4\.6 2\.8 8 7 10 4\.2-2 7-5\.4 7-10V6z"\/><path d="m9 12 2 2 4-5"\//);
});

function confirmHarness(){
  const elements=new Map(),document={activeElement:null};
  const $=id=>{if(!elements.has(id))elements.set(id,{id,isConnected:true,open:false,listeners:{},focus(){document.activeElement=this},showModal(){this.open=true},close(){this.open=false},addEventListener(name,fn){this.listeners[name]=fn},getBoundingClientRect(){return{left:20,right:300,top:28,bottom:252}}});return elements.get(id)};
  const line=html.split('\n').find(s=>s.startsWith('    const Confirm='));assert.ok(line,'execute actual Confirm implementation');
  const context=vm.createContext({$,document,requestAnimationFrame:fn=>fn()});vm.runInContext(line.replace('const Confirm=','globalThis.Confirm='),context);
  const opener=$('#replaceButton');opener.focus();const promise=context.Confirm.ask('Synthetic unsaved result');
  assert.equal(document.activeElement,$('#confirmCancel'));
  return{$,document,opener,promise,dialog:$('#confirmDialog')};
}
test('all four outside confirmation edges cancel and restore opener focus',async()=>{
  for(const [clientX,clientY] of [[19,100],[301,100],[100,27],[100,253]]){
    const h=confirmHarness();h.dialog.listeners.click?.({target:h.dialog,clientX,clientY});
    assert.equal(h.dialog.open,false,'outside backdrop closes confirmation');assert.equal(await h.promise,false);assert.equal(h.document.activeElement,h.opener);
  }
});
test('inside and child keyboard clicks preserve confirmation; existing routes settle once',async()=>{
  for(const route of ['#confirmClose','#confirmCancel','#confirmOk','Escape']){
    const h=confirmHarness();h.dialog.listeners.click?.({target:h.dialog,clientX:100,clientY:100});h.dialog.listeners.click?.({target:{},clientX:0,clientY:0});assert.equal(h.dialog.open,true);
    if(route==='Escape'){let prevented=false;h.dialog.listeners.cancel({preventDefault(){prevented=true}});assert.ok(prevented)}else h.$(route).onclick();
    assert.equal(await h.promise,route==='#confirmOk');assert.equal(h.dialog.open,false);assert.equal(h.document.activeElement,h.opener);
  }
});
