// Run with node --test tests/ui.test.cjs after installing Playwright and Chromium.
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
let browser;
before(async()=>{browser=await chromium.launch({headless:true});});
after(async()=>{await browser?.close();});
const url=pathToFileURL(path.resolve(__dirname,'../index.html')).href;
async function open(t,viewport={width:1440,height:960},pdfRoute){
  const context=await browser.newContext({viewport});t.after(()=>context.close());
  await context.route('https://**/*',async route=>{
    if(route.request().url().includes('jspdf'))return pdfRoute?pdfRoute(route):route.fulfill({body:''});
    return route.request().url().includes('abacus.jasoncameron.dev')?route.fulfill({json:{value:1588}}):route.fulfill({body:''});
  });
  const page=await context.newPage();await page.goto(url);
  await page.waitForFunction(()=>document.getElementById('chart-state').textContent==='Program mapped');
  return page;
}
async function invalid(page,source='hello world'){
  await page.locator('#ta').fill(source);await page.locator('#go').click();
  await page.waitForFunction(()=>document.getElementById('chart-state').textContent==='Check your code');
}
test('Tab and Shift+Tab leave the editor without modifying source',async t=>{
  const p=await open(t),ta=p.locator('#ta'),source=await ta.inputValue();
  await ta.focus();await p.keyboard.press('Tab');assert.notEqual(await p.evaluate(()=>document.activeElement.id),'ta');
  await ta.focus();await p.keyboard.press('Shift+Tab');assert.notEqual(await p.evaluate(()=>document.activeElement.id),'ta');
  assert.equal(await ta.inputValue(),source);
  await ta.focus();await ta.evaluate(e=>e.setSelectionRange(0,0));await p.keyboard.press('Control+]');
  assert.equal(await ta.inputValue(),'    '+source);
});
test('normal text contrast passes in both themes and primary hover',async t=>{
  const p=await open(t);
  for(const dark of [false,true]){
    await p.evaluate(d=>setTh(d),dark);
    for(const hover of [false,true]){
      if(hover)await p.locator('#go').hover();else await p.mouse.move(0,0);
      const pairs=await p.evaluate(()=>{
        const style=e=>getComputedStyle(e),ta=document.getElementById('ta'),go=style(document.getElementById('go'));
        return [[go.color,go.backgroundColor],[style(document.querySelector('.brand-caption')).color,style(document.body).backgroundColor],[getComputedStyle(ta,'::placeholder').color,style(ta).backgroundColor],[style(document.getElementById('g')).color,style(ta).backgroundColor]];
      });
      for(const [fg,bg]of pairs){
        const lum=c=>c.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
        const [lo,hi]=[lum(fg),lum(bg)].sort((a,b)=>a-b);assert.ok((hi+.05)/(lo+.05)>=4.5,`${dark?'dark':'light'} ${hover?'hover':''}: ${fg} on ${bg}`);
      }
    }
  }
});
test('Generate stays fully reachable after errors in short windows',async t=>{
  const p=await open(t);await invalid(p);
  for(const height of [640,600,540]){
    await p.setViewportSize({width:1280,height});
    assert.ok(await p.locator('#go').evaluate(e=>{const b=e.getBoundingClientRect(),card=document.getElementById('editor').getBoundingClientRect();return b.top>=card.top&&b.bottom<=card.bottom&&document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.closest('button')===e;}),`height ${height}`);
  }
});
test('long-file errors scroll the actual line into view and expose invalid state',async t=>{
  const p=await open(t);await invalid(p,'int main(){\nint n=0;\n'+'n++;\n'.repeat(300)+'n=;\n}');
  const result=await p.locator('#ta').evaluate(e=>{const s=getComputedStyle(e),line=Number(document.getElementById('err').textContent.match(/Line (\d+)/)[1]),y=(line-1)*parseFloat(s.lineHeight)+parseFloat(s.paddingTop);return{visible:y>=e.scrollTop&&y+parseFloat(s.lineHeight)<=e.scrollTop+e.clientHeight,invalid:e.getAttribute('aria-invalid'),described:e.getAttribute('aria-describedby')};});
  assert.ok(result.visible);assert.equal(result.invalid,'true');assert.ok(result.described.includes('err'));
  await p.locator('#ta').fill('int main(){return 0;}');assert.notEqual(await p.locator('#ta').getAttribute('aria-invalid'),'true');
});
test('Reset recovers the exact source with Restore and Ctrl+Z',async t=>{
  const p=await open(t),ta=p.locator('#ta'),source='int main(){\n  return 0;\n}';await ta.fill(source);
  await p.locator('#rs').click();assert.equal(await ta.inputValue(),'');
  await p.locator('#rs').click();assert.equal(await ta.inputValue(),source);
  await p.locator('#rs').click();await ta.press('Control+z');assert.equal(await ta.inputValue(),source);
  await p.locator('#rs').click();await ta.fill('new source');await ta.press('Control+z');assert.notEqual(await ta.inputValue(),source,'editing must discard the stale reset snapshot');
});
test('PDF loads only on demand and failed loading can be retried',async t=>{
  let requests=0;
  const stub='window.jspdf={jsPDF:class{addImage(){} output(){return new Blob(["%PDF-1.3"],{type:"application/pdf"})}}};';
  const p=await open(t,undefined,async r=>{requests++;if(requests===1)return r.abort();await r.fulfill({contentType:'application/javascript',body:stub});});
  assert.equal(requests,0,'initial page must not request PDF library');
  await p.locator('#exm').click();await p.locator('#ePdf').click();
  await p.waitForFunction(()=>document.getElementById('toast').textContent.includes('try again'));
  assert.equal(requests,1);assert.equal(await p.locator('#ePdf').getAttribute('aria-busy'),'false');
  await p.locator('#exm').click();const download=p.waitForEvent('download');await p.locator('#ePdf').click();
  assert.ok((await download).suggestedFilename().endsWith('.pdf'));assert.equal(requests,2);
});
test('pending PDF export deduplicates requests and never exports stale code',async t=>{
  let requests=0,release;const pending=new Promise(resolve=>release=resolve);
  const p=await open(t,undefined,async r=>{requests++;await pending;await r.fulfill({contentType:'application/javascript',body:'window.jspdf={jsPDF:class{}};'});});
  const downloads=[];p.on('download',d=>downloads.push(d));
  await p.locator('#exm').click();await p.locator('#ePdf').click();
  await p.waitForFunction(()=>document.getElementById('ePdf').getAttribute('aria-busy')==='true');
  await p.evaluate(()=>document.getElementById('ePdf').onclick());
  assert.equal(requests,1);
  await p.locator('#ta').fill('int main(){return 1;}');release();
  await p.waitForFunction(()=>document.getElementById('ePdf').getAttribute('aria-busy')==='false');
  assert.equal(downloads.length,0);assert.equal(await p.locator('#ePdf').isDisabled(),true);
  assert.match(await p.locator('#toast').textContent(),/Code changed/);
});
test('mobile controls are readable, touch sized, and fit without overflow',async t=>{
  const p=await open(t,{width:390,height:844});
  for(const width of [390,320]){
    await p.setViewportSize({width,height:844});
    const result=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,controls:['zi','zo','fit','fs','xp','pcb','exm','go','rs','th','lang','exs'].map(id=>{const e=document.getElementById(id),b=e.getBoundingClientRect();return{id,width:b.width,height:b.height,font:parseFloat(getComputedStyle(e).fontSize)};})}));
    assert.equal(result.overflow,false);
    for(const b of result.controls){assert.ok(b.width>=44&&b.height>=44,`${width}: ${b.id} ${b.width}×${b.height}`);assert.ok(b.font>=12,`${b.id} ${b.font}px`);}
  }
});
