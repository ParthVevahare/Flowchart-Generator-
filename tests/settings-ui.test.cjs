const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path'),fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
let browser;
before(async()=>{browser=await chromium.launch({headless:true});});
after(async()=>{await browser?.close();});
async function open(t,viewport={width:1440,height:960},init,setupRoutes){
 const context=await browser.newContext({viewport});t.after(()=>context.close());
 await context.route('https://**/*',r=>r.fulfill({body:r.request().url().includes('abacus')?'{"value":1588}':''}));
 if(init)await context.addInitScript(init);
 if(setupRoutes)await setupRoutes(context);
 const p=await context.newPage();await p.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
 await p.waitForFunction(()=>document.getElementById('chart-state').textContent==='Program mapped');return p;
}
test('new HTML bypasses an old cached flowchart module',async t=>{
 const oldFlowGraph=fs.readFileSync(path.join(__dirname,'fixtures','flowchart-before-settings.js'),'utf8');
 let oldRequests=0;
 const p=await open(t,undefined,undefined,async context=>{
   await context.route('**/flowchart.js',route=>{oldRequests++;return route.fulfill({contentType:'text/javascript',body:oldFlowGraph});});
 });
 assert.equal(oldRequests,0,'an updated page must use a versioned URL, not the cached unversioned module');
 assert.equal(await p.locator('#err').textContent(),'');
 await p.locator('#diagram-settings-open').click();await p.locator('#setting-theme').selectOption('ocean');await p.locator('#settings-apply').click();
 await p.waitForFunction(()=>document.getElementById('chart-state').textContent==='Program mapped');
 assert.equal(await p.locator('#stage #vp > rect').getAttribute('fill'),'#f4faff');
});
test('settings apply to chart and vector export, persist, and never edit source',async t=>{
 const p=await open(t);assert.equal(await p.locator('#diagram-settings-open').count(),1,'diagram settings entry exists');
 const source=await p.locator('#ta').inputValue();
 await p.locator('#diagram-settings-open').click();
 await p.locator('#setting-trueLabel').fill('<True & safe>');await p.locator('#setting-falseLabel').fill('False');
 await p.locator('#setting-theme').selectOption('dark');await p.locator('#setting-direction').selectOption('RIGHT');
 await p.locator('#setting-fontSize').fill('20');await p.locator('#setting-decorateLabels').uncheck();
 await p.locator('#settings-apply').click();await p.waitForFunction(()=>document.getElementById('chart-state').textContent==='Program mapped');
 assert.equal(await p.locator('#ta').inputValue(),source);assert.match(await p.locator('#stage').textContent(),/<True & safe>/);
 assert.equal(await p.locator('#stage [data-node] text').first().getAttribute('font-size'),'20');
 await p.evaluate(()=>{const actual=dl;dl=async(blob,name)=>{window.exportedSvg=await blob.text();return actual(blob,name);};});
 await p.locator('#exm').click();const pending=p.waitForEvent('download');await p.locator('#eSvg').click();
 const download=await pending;
 assert.ok(download.suggestedFilename().endsWith('.svg'));
 // Match the repository's optional on-disk check: managed Windows Chrome can
 // cancel file writes even when the download event and generated SVG succeed.
 const svg=process.env.PLAYWRIGHT_VERIFY_DOWNLOAD_FILE==='1'?fs.readFileSync(await download.path(),'utf8'):await p.evaluate(()=>window.exportedSvg);
 assert.match(svg,/&lt;True &amp; safe&gt;/);assert.match(svg,/fill="#111827"/);assert.match(svg,/font-size="20"/);
 await p.reload();await p.waitForFunction(()=>document.getElementById('chart-state').textContent==='Program mapped');
 await p.locator('#diagram-settings-open').click();assert.equal(await p.locator('#setting-direction').inputValue(),'RIGHT');assert.equal(await p.locator('#setting-fontSize').inputValue(),'20');
});
test('cancel, Escape, reset, validation and focus work at narrow and short sizes',async t=>{
 const p=await open(t);
 for(const viewport of [{width:1440,height:960},{width:1280,height:540},{width:320,height:480},{width:568,height:320}]){
   await p.setViewportSize(viewport);await p.locator('#diagram-settings-open').click();
   assert.ok(await p.locator('#diagram-settings').evaluate(e=>{const b=e.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth+1&&b.top>=0&&b.bottom<=innerHeight+1;}));
   await p.locator('#setting-fontSize').fill('999');await p.locator('#settings-apply').click();
   assert.equal(await p.locator('#setting-fontSize').getAttribute('aria-invalid'),'true');assert.ok(await p.locator('#settings-error').isVisible());
   await p.locator('#settings-reset').click();assert.equal(await p.locator('#setting-fontSize').inputValue(),'12.5');
   await p.locator('#setting-trueLabel').fill('Discard me');await p.keyboard.press('Escape');
   assert.equal(await p.locator('#diagram-settings').isVisible(),false);assert.equal(await p.evaluate(()=>document.activeElement.id),'diagram-settings-open');
   await p.locator('#diagram-settings-open').click();assert.equal(await p.locator('#setting-trueLabel').inputValue(),'Yes');
   await p.locator('#settings-cancel').click();
 }
});
test('every setting has an accessible label and a relevant decorative SVG',async t=>{
 const p=await open(t);await p.locator('#diagram-settings-open').click();
 for(const name of ['trueLabel','falseLabel','optimizeCommon','decorateLabels','theme','direction','widthScale','heightScale','fontSize','compact']){
   const label=p.locator('label').filter({has:p.locator('#setting-'+name)});
   assert.equal(await label.count(),1,name+' has a label');
   assert.equal(await label.locator('svg[aria-hidden="true"]').count(),1,name+' has a decorative icon');
   const href=await label.locator('use').getAttribute('href');assert.equal(await p.locator(href+' path,'+href+' rect,'+href+' circle').count()>0,true,name+' references a drawn symbol');
 }
 await p.keyboard.press('Tab');assert.ok(await p.evaluate(()=>document.getElementById('diagram-settings').contains(document.activeElement)));
});
test('large fonts reserve enough node width for non-Latin output strings',async t=>{
 const p=await open(t);
 const result=await p.evaluate(async()=>{
   const source='int main(){printf("'+ '漢字'.repeat(18)+'");return 0;}';
   const chart=await buildProgram(parse(source,'c'),{fontSize:24,widthScale:2});
   const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.innerHTML=chart.inner;document.body.appendChild(svg);
   try{return [...svg.querySelectorAll('[data-node]')].map(node=>{
     const shape=node.querySelector(':scope > g > rect, :scope > g > polygon').getBBox(),text=node.querySelector(':scope > text').getBBox();
     return {kind:node.dataset.kind,left:text.x,right:text.x+text.width,nodeLeft:shape.x,nodeRight:shape.x+shape.width};
   });}finally{svg.remove();}
 });
 for(const bounds of result)assert.ok(bounds.left>=bounds.nodeLeft+8&&bounds.right<=bounds.nodeRight-8,JSON.stringify(bounds));
});
test('settings remain usable with invalid code and blocked storage',async t=>{
 const p=await open(t,undefined,()=>{Storage.prototype.setItem=function(){throw Error('blocked');};});
 await p.locator('#ta').fill('bad code');await p.locator('#go').click();await p.waitForFunction(()=>document.getElementById('chart-state').textContent==='Check your code');
 await p.locator('#diagram-settings-open').click();await p.locator('#setting-theme').selectOption('ocean');await p.locator('#settings-apply').click();
 assert.match(await p.locator('#toast').textContent(),/could not be saved/);assert.equal(await p.locator('#ta').inputValue(),'bad code');
 assert.equal(await p.locator('#stage [data-node]').count(),0);
 await p.locator('#ta').fill('int main(){return 0;}');await p.locator('#go').click();await p.waitForFunction(()=>document.getElementById('chart-state').textContent==='Program mapped');
 assert.equal(await p.locator('#stage #vp > rect').getAttribute('fill'),'#f4faff');
});
