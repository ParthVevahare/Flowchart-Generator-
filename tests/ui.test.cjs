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
        const editorBackground=style(ta.parentElement).backgroundColor;
        return [[go.color,go.backgroundColor],[style(document.querySelector('.brand-caption')).color,style(document.body).backgroundColor],[getComputedStyle(ta,'::placeholder').color,editorBackground],[style(document.getElementById('g')).color,editorBackground]];
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
    const result=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,controls:['zi','zo','fit','fs','xp','pcb','exm','go','rs','th','editor-options'].map(id=>{const e=document.getElementById(id),b=e.getBoundingClientRect();return{id,width:b.width,height:b.height,font:parseFloat(getComputedStyle(e).fontSize)};})}));
    assert.equal(result.overflow,false);
    for(const b of result.controls){assert.ok(b.width>=44&&b.height>=44,`${width}: ${b.id} ${b.width}×${b.height}`);assert.ok(b.font>=12,`${b.id} ${b.font}px`);}
  }
});

test('PNG is a 300-DPI A4 page and SVG download contains scalable vector markup',async t=>{
  const p=await open(t);
  const dimensions=await p.evaluate(()=>new Promise(resolve=>canvas(c=>resolve([c.width,c.height]))));
  assert.deepEqual(dimensions,[2480,3508]);
  await p.evaluate(()=>{dl=async blob=>window.downloadedSvg=await blob.text();});
  await p.locator('#exm').click();await p.locator('#eSvg').click();
  await p.waitForFunction(()=>!!window.downloadedSvg);
  const svg=await p.evaluate(()=>{
    const d=new DOMParser().parseFromString(window.downloadedSvg,'image/svg+xml');
    return{error:!!d.querySelector('parsererror'),width:d.documentElement.getAttribute('width'),height:d.documentElement.getAttribute('height'),viewBox:d.documentElement.getAttribute('viewBox'),nodes:d.querySelectorAll('[data-node]').length,images:d.querySelectorAll('image').length};
  });
  assert.equal(svg.error,false);assert.equal(svg.width,'210mm');assert.equal(svg.height,'297mm');
  assert.equal(svg.viewBox,'0 0 794 1123');assert.ok(svg.nodes>3);assert.equal(svg.images,0);
  const density=await p.evaluate(()=>new Promise(resolve=>canvas(async c=>{
    const b=new Uint8Array(await (await DiagramExport.png(c)).arrayBuffer()),v=new DataView(b.buffer);
    for(let o=8;o<b.length;o+=v.getUint32(o)+12){if(String.fromCharCode(...b.slice(o+4,o+8))==='pHYs')return resolve([v.getUint32(o+8),v.getUint32(o+12),b[o+16]]);}
    resolve(null);
  })));
  assert.deepEqual(density,[11811,11811,1],'PNG print density is 300 DPI');
});

test('editor options stay tucked away, escape cleanly, and preserve language/example actions',async t=>{
 const p=await open(t),ta=p.locator('#ta'),source=await ta.inputValue(),options=p.getByRole('button',{name:'Language and examples',exact:true});
 assert.equal(await p.locator('#lang').isVisible(),false);assert.equal(await p.locator('#exs').isVisible(),false);
 assert.ok((await ta.boundingBox()).height>550,'collapsed options leave more room for source');
 await options.click();assert.equal(await options.getAttribute('aria-expanded'),'true');
 assert.ok(await p.getByRole('combobox',{name:'Source language'}).isVisible());
 await p.keyboard.press('Escape');assert.equal(await p.locator('#lang').isVisible(),false);
 assert.equal(await p.evaluate(()=>document.activeElement.id),'editor-options');assert.equal(await ta.inputValue(),source);
 await options.click();await p.locator('#lang').focus();await p.keyboard.press('ArrowDown');await p.keyboard.press('ArrowDown');
 assert.equal(await p.locator('#lang').inputValue(),'python');assert.ok(await p.locator('#lang').isVisible(),'keyboard selection keeps native options reachable');
 await p.locator('#exs').selectOption('3');await p.waitForFunction(()=>document.getElementById('chart-state').textContent==='Program mapped');
 assert.notEqual(await ta.inputValue(),source);assert.equal(await p.locator('#lang').inputValue(),'auto');assert.equal(await p.locator('#exs').isVisible(),false);
 await p.locator('#exm').click();assert.equal(await p.getByRole('button',{name:'Copy SVG',exact:true}).count(),0);assert.ok(await p.locator('#eSvg').isVisible());
 assert.equal(await p.locator('.site-footer a').filter({hasText:'Flowchart Generator'}).count(),0);
 for(const width of [390,320]){
  await p.setViewportSize({width,height:844});assert.ok((await ta.boundingBox()).height>=360,'mobile source uses the freed space');await options.click();
  const b=await p.locator('#editor-settings').boundingBox();assert.ok(b.x>=8&&b.x+b.width<=width-8);
  for(const id of ['lang','exs'])assert.ok((await p.locator('#'+id).boundingBox()).height>=44);
  await ta.click();assert.equal(await p.locator('#lang').isVisible(),false);
 }
});

test('an old automatic layout cannot overwrite a newer generation',async t=>{
  const p=await open(t);
  await p.evaluate(()=>{
    const actual=FlowGraph.layout;let release;
    window.layoutStarted=false;window.releaseLayout=()=>release();
    FlowGraph.layout=async graph=>{
      const old=!window.layoutStarted;
      if(old){window.layoutStarted=true;await new Promise(r=>release=r);}
      const result=await actual(graph);if(old)window.oldLayoutFinished=true;return result;
    };
  });
  await p.locator('#ta').fill('int main(){printf("OLD");return 0;}');await p.locator('#go').click();
  await p.waitForFunction(()=>window.layoutStarted);
  await p.locator('#ta').fill('int main(){printf("NEW");return 0;}');await p.locator('#go').click();
  await p.waitForFunction(()=>document.getElementById('chart-state').textContent==='Program mapped');
  await p.evaluate(()=>window.releaseLayout());
  await p.waitForFunction(()=>window.oldLayoutFinished);
  assert.match(await p.locator('#stage').textContent(),/NEW/);assert.doesNotMatch(await p.locator('#stage').textContent(),/OLD/);
});
test('long function headings stay inside their section and A4 bounds',async t=>{
 const p=await open(t),name='W'.repeat(45);
 await p.locator('#ta').fill('int '+name+'(){return 1;}int main(){return 0;}');await p.locator('#go').click();
 await p.waitForFunction(()=>document.getElementById('chart-state').textContent==='Program mapped');
 const bounds=await p.evaluate(()=>[...document.querySelectorAll('#stage [data-function]')].map(g=>{
   const rect=g.querySelector('rect').getBBox(),title=g.querySelector('text').getBBox();
   return{left:title.x,right:title.x+title.width,width:rect.width};
 }));
 for(const b of bounds)assert.ok(b.left>=10&&b.right<=b.width-10,JSON.stringify(b));
});

test('syntax colors follow language, preserve typing and track both scroll directions',async t=>{
 const p=await open(t),source='int main(){\n // comment\n printf("hello");\n return 42;\n}\n';
 await p.locator('#ta').fill(source);
 await p.waitForFunction(()=>document.querySelector('#code-tokens .token.keyword'));
 assert.equal(await p.locator('#ta').inputValue(),source);assert.equal(await p.locator('#code-colors').getAttribute('aria-hidden'),'true');
 for(const token of ['keyword','string','number','comment'])assert.ok(await p.locator('#code-tokens .token.'+token).count());
 await p.locator('#ta').focus();await p.locator('#ta').evaluate(e=>e.setSelectionRange(e.value.length,e.value.length));await p.keyboard.type('// typing');
 assert.equal(await p.locator('#ta').inputValue(),source+'// typing');
 await p.locator('#ta').fill(('int value = 42; '+'x'.repeat(250)+'\n').repeat(100));
 await p.evaluate(()=>{const e=document.getElementById('ta');e.scrollTop=900;e.scrollLeft=10000;e.dispatchEvent(new Event('scroll'));});
 const metrics=await p.evaluate(()=>{const a=document.getElementById('ta'),b=document.getElementById('code-colors');return{top:[a.scrollTop,b.scrollTop],left:[a.scrollLeft,b.scrollLeft],width:[a.clientWidth,b.clientWidth],font:[getComputedStyle(a).font,getComputedStyle(b).font]};});
 assert.deepEqual(metrics.top,[900,900]);assert.ok(metrics.left[0]>0);assert.equal(metrics.left[0],metrics.left[1]);assert.equal(metrics.width[0],metrics.width[1]);assert.equal(metrics.font[0],metrics.font[1]);
 await p.locator('#ta').fill('def hello():\n    return "world"\n');await p.locator('#editor-options').click();await p.locator('#lang').selectOption('python');
 await p.waitForFunction(()=>document.getElementById('code-tokens').dataset.language==='python');assert.ok(await p.locator('#code-tokens .token.keyword').count());
 const before=await p.locator('#code-tokens .token.keyword').first().evaluate(e=>getComputedStyle(e).color);await p.evaluate(()=>setTh(true));
 const after=await p.locator('#code-tokens .token.keyword').first().evaluate(e=>getComputedStyle(e).color);assert.notEqual(before,after);
});

test('syntax tokens have readable contrast in both themes and safely display HTML-like strings',async t=>{
 const p=await open(t);
 await p.locator('#ta').fill('int main(){ // comment\n printf("<img src=x onerror=alert(1)>"); return 42; }');
 await p.waitForFunction(()=>document.querySelector('#code-tokens .token.string'));
 assert.equal(await p.locator('#code-tokens img').count(),0);
 for(const dark of [false,true]){
  await p.evaluate(d=>setTh(d),dark);
  const pairs=await p.evaluate(()=>[...document.querySelectorAll('#code-tokens .token')].map(e=>[getComputedStyle(e).color,getComputedStyle(document.getElementById('code-colors')).backgroundColor]));
  for(const [fg,bg]of pairs){
   const lum=c=>c.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
   const [lo,hi]=[lum(fg),lum(bg)].sort((a,b)=>a-b);assert.ok((hi+.05)/(lo+.05)>=4.5,`${dark?'dark':'light'} ${fg} on ${bg}`);
  }
 }
});
