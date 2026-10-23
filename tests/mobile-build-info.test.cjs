const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../src/index.template.html'),'utf8');
const originalBuild="<div class=\"build-details\"><details><summary data-i18n=\"detailsTitle\">このアプリについて</summary><div class=\"dialog-body\" style=\"padding-top:0\"><p data-i18n=\"detailsBody\">動画と作成した音声は端末内だけで処理され、実行中の外部通信はありません。動画全体をJavaScriptメモリへ複製せず、ブラウザーのファイルを直接読みながら処理します。</p></div><div class=\"build-info\"><div><span data-i18n=\"appVersion\">アプリバージョン</span><strong id=\"buildVersion\">—</strong></div><div><span data-i18n=\"coreVersion\">処理エンジン</span><strong id=\"coreVersion\">—</strong></div><div><span data-i18n=\"runtimeNetwork\">実行時通信</span><strong data-i18n=\"none\">なし</strong></div></div></details></div>";
test('exact existing metadata is unique and final inside the actual Help scroll body',()=>{
 assert.doesNotMatch(html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)[1],/id="buildVersion"/);
 const help=html.match(/<dialog[^>]*id="helpDialog"[^>]*>([\s\S]*?)<\/dialog>/)[1];const start=help.search(/<div class="dialog-body"[^>]*>/);let depth=0,end=-1;
 for(const m of help.slice(start).matchAll(/<div\b[^>]*>|<\/div>/g)){depth+=m[0].startsWith('</')?-1:1;if(depth===0){end=start+m.index;break;}}
 assert.ok(end>start);const body=help.slice(start,end);assert.ok(body.includes(originalBuild));assert.match(body.slice(body.indexOf(originalBuild)+originalBuild.length),/^\s*(?:<!--[^]*?-->\s*)?$/);
 for(const id of ["buildVersion", "coreVersion"])assert.equal((html.match(new RegExp(`id="${id}"`,'g'))||[]).length,1);
});
test('only the informational footer hides at the existing workflow breakpoint',()=>{
 const css=html.match(/<style>([\s\S]*?)<\/style>/)[1];const start=css.search(/@media\s*\(max-width:\s*560px\)\s*\{/);assert.ok(start>=0);
 const open=css.indexOf('{',start);let depth=1,end=open+1;for(;end<css.length&&depth;end++){if(css[end]==='{')depth++;if(css[end]==='}')depth--;}
 assert.match(css.slice(open+1,end-1),/(?:^|})\s*footer\s*\{\s*display:\s*none\s*;?\s*\}/);
});
