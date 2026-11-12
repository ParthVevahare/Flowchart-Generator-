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
test('small flowcharts automatically fill the canvas without a 130-percent cap',async t=>{
 const p=await open(t,{width:1920,height:1200});
 await p.locator('#ta').fill('int main(){return 0;}');await p.locator('#go').click();
 await p.waitForFunction(()=>document.getElementById('chart-state').textContent==='Program mapped');
 const bounds=await p.evaluate(()=>{
   const stage=document.getElementById('stage').getBoundingClientRect(),diagram=document.querySelector('#vp > rect').getBoundingClientRect();
   return {zoom:Number(document.getElementById('zoom-level').textContent.replace('%','')),fills:Math.max(diagram.width/stage.width,diagram.height/stage.height),inside:diagram.left>=stage.left+7&&diagram.right<=stage.right-7&&diagram.top>=stage.top+7&&diagram.bottom<=stage.bottom-7};
 });
 assert.ok(bounds.zoom>130,JSON.stringify(bounds));assert.ok(bounds.fills>.94,JSON.stringify(bounds));assert.ok(bounds.inside);
 await p.locator('#zi').click();const zoom=Number((await p.locator('#zoom-level').textContent()).replace('%',''));assert.ok(zoom>bounds.zoom);
 await p.locator('#fit').click();assert.equal(Number((await p.locator('#zoom-level').textContent()).replace('%','')),bounds.zoom);
});
test('narrow screens offer a jump to the current flowchart beside Generate',async t=>{
 const p=await open(t,{width:390,height:844});
 const go=p.locator('#go'),jump=p.locator('#view-flowchart'),ta=p.locator('#ta');
 for(const width of [390,320]){
   await p.setViewportSize({width,height:844});
   await ta.fill('print("Hello '+width+'")');
   assert.equal(await jump.isVisible(),false,'editing hides the previous result action');
   await go.scrollIntoViewIfNeeded();
   const scrollBefore=await p.evaluate(()=>scrollY);
   await go.click();
   await p.waitForFunction(()=>document.getElementById('chart-state').textContent==='Program mapped');
   assert.equal(await p.evaluate(()=>scrollY),scrollBefore,'generation leaves the user at the editor');
   const bounds=await jump.boundingBox();
   assert.ok(bounds&&bounds.x>=0&&bounds.x+bounds.width<=width&&bounds.height>=44,
     `at ${width}px the result action fits and has a 44px target: ${JSON.stringify(bounds)}`);
   assert.ok(bounds.y>=0&&bounds.y+bounds.height<=844,'the action appears in the visible editor');
   await jump.press('Enter');
   assert.equal(await p.evaluate(()=>document.activeElement.id),'stage');
   assert.ok(await p.locator('#stage').evaluate(el=>{
     const {top,bottom}=el.getBoundingClientRect();
     return top>=0&&top<innerHeight&&bottom>0;
   }),'activating the jump brings the chart into view');
 }
 await p.setViewportSize({width:1280,height:840});
 assert.equal(await jump.isVisible(),false,'the split workspace already shows the result');
 await p.setViewportSize({width:390,height:844});
 await invalid(p);
 assert.equal(await jump.isVisible(),false,'failed generation offers no result action');
});

test('large charts start at readable scale and keep their view beside explanations',async t=>{
 const p=await open(t,{width:1280,height:540});
 const readView=()=>p.evaluate(()=>({
   zoom:Number(document.getElementById('zoom-level').textContent.replace('%','')),
   transform:document.getElementById('vp').getAttribute('transform')
 }));
 for(const viewport of [{width:1280,height:540},{width:390,height:844}]){
   await p.setViewportSize(viewport);
   await p.locator('#go').click();
   await p.waitForFunction(()=>document.getElementById('chart-state').textContent==='Program mapped');
   const initial=await readView();
   assert.ok(initial.zoom>=100,JSON.stringify(initial));
   await p.locator('#fit').click();
   const fitted=await readView();
   assert.ok(fitted.zoom<initial.zoom,JSON.stringify(fitted));
   assert.ok(await p.evaluate(()=>{
     const s=document.getElementById('stage').getBoundingClientRect();
     const d=document.querySelector('#vp > rect').getBoundingClientRect();
     return d.top>=s.top&&d.bottom<=s.bottom&&d.left>=s.left&&d.right<=s.right;
   }),'Fit shows the complete diagram');
   await p.locator('#zi').click();
   await p.locator('#stage').press('ArrowDown');
   const chosen=await readView();
   for(const [button,panel,expanded] of [['#xp','#exp',true],['#pcb','#ps',true],['#pcb','#ps',false]]){
     await p.locator(button).click();
     assert.equal(await p.locator(button).getAttribute('aria-expanded'),String(expanded));
     assert.equal(await p.locator(panel).isVisible(),expanded);
     await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
     assert.deepEqual(await readView(),chosen);
     assert.ok(await p.evaluate(()=>{
       const pane=document.getElementById('pane').getBoundingClientRect();
       return document.querySelector('.canvas-footer').getBoundingClientRect().bottom<=pane.bottom+1;
     }),'chart status stays inside the workspace');
   }
 }
});

test('playgrounds fill the first desktop viewport and footer is reached by scrolling',async t=>{
 const p=await open(t);
 for(const viewport of [{width:1440,height:960},{width:1280,height:540},{width:1920,height:1080}]){
   await p.setViewportSize(viewport);await p.evaluate(()=>window.scrollTo(0,0));
   const bounds=await p.evaluate(()=>({footer:document.querySelector('.site-footer').getBoundingClientRect().top,editor:document.getElementById('editor').getBoundingClientRect().bottom,pane:document.getElementById('pane').getBoundingClientRect().bottom,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth}));
   assert.ok(bounds.footer>=bounds.height,JSON.stringify(bounds));assert.ok(bounds.editor>=bounds.height-20);assert.ok(bounds.pane>=bounds.height-20);assert.equal(bounds.overflow,false);
   await p.locator('.site-footer').scrollIntoViewIfNeeded();assert.ok(await p.evaluate(()=>scrollY>0));
   assert.ok(await p.locator('.site-footer').evaluate(e=>{const r=e.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0;}));
 }
});
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
  const stub='window.jspdf={jsPDF:class{constructor(options){window.pdfOptions=options;}addImage(){} output(){return new Blob(["%PDF-1.3"],{type:"application/pdf"})}}};';
  const p=await open(t,undefined,async r=>{requests++;if(requests===1)return r.abort();await r.fulfill({contentType:'application/javascript',body:stub});});
  assert.equal(requests,0,'initial page must not request PDF library');
  await p.locator('#exm').click();await p.locator('#ePdf').click();
  await p.waitForFunction(()=>document.getElementById('toast').textContent.includes('try again'));
  assert.equal(requests,1);assert.equal(await p.locator('#ePdf').getAttribute('aria-busy'),'false');
  await p.locator('#exm').click();const download=p.waitForEvent('download');await p.locator('#ePdf').click();
  assert.ok((await download).suggestedFilename().endsWith('.pdf'));assert.equal(requests,2);
  const pdf=await p.evaluate(()=>({options:window.pdfOptions,width:charts[cur].W,height:charts[cur].H}));
  assert.ok(Array.isArray(pdf.options.format));assert.ok(Math.abs(pdf.options.format[0]/pdf.options.format[1]-pdf.width/pdf.height)<1e-6);
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

test('PNG and vector SVG use natural diagram proportions',async t=>{
  const p=await open(t);
  const dimensions=await p.evaluate(()=>new Promise(resolve=>canvas(c=>resolve([c.width,c.height]))));
  const natural=await p.evaluate(()=>({width:charts[cur].W,height:charts[cur].H,scale:charts[cur].contentScale}));
  assert.equal(natural.scale,1);assert.notEqual(natural.width,794);
  assert.ok(Math.abs(dimensions[0]/dimensions[1]-natural.width/natural.height)<.005);
  await p.evaluate(()=>{dl=async blob=>window.downloadedSvg=await blob.text();});
  await p.locator('#exm').click();await p.locator('#eSvg').click();
  await p.waitForFunction(()=>!!window.downloadedSvg);
  const svg=await p.evaluate(()=>{
    const d=new DOMParser().parseFromString(window.downloadedSvg,'image/svg+xml');
    return{error:!!d.querySelector('parsererror'),width:d.documentElement.getAttribute('width'),height:d.documentElement.getAttribute('height'),viewBox:d.documentElement.getAttribute('viewBox'),nodes:d.querySelectorAll('[data-node]').length,images:d.querySelectorAll('image').length};
  });
  assert.equal(svg.error,false);assert.equal(Number(svg.width),natural.width);assert.equal(Number(svg.height),natural.height);
  assert.equal(svg.viewBox,'0 0 '+natural.width+' '+natural.height);assert.ok(svg.nodes>3);assert.equal(svg.images,0);
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

test('loading examples lets users restore their draft by button or keyboard',async t=>{
 const p=await open(t),ta=p.locator('#ta'),options=p.getByRole('button',{name:'Language and examples',exact:true});
 const source='def draft():\n    return "keep this"\n';
 for(const method of ['button','keyboard']){
  await ta.fill(source);
  await options.click();await p.locator('#lang').selectOption('python');await p.keyboard.press('Escape');
  await ta.press('Control+Home');await ta.press('Shift+ArrowRight');
  const selection=()=>ta.evaluate(el=>[el.selectionStart,el.selectionEnd,el.selectionDirection]);
  const originalSelection=await selection();
  assert.deepEqual(originalSelection,[0,1,'forward']);
  for(const value of ['3','4']){
   await options.click();await p.locator('#exs').selectOption(value);
   await p.waitForFunction(()=>document.getElementById('chart-state').textContent==='Program mapped');
   assert.notEqual(await ta.inputValue(),source);
  }
  if(method==='button')await p.getByRole('button',{name:'Restore',exact:true}).click();
  else await p.keyboard.press('Control+z');
  assert.equal(await ta.inputValue(),source);
  assert.equal(await p.locator('#lang').inputValue(),'python');
  assert.deepEqual(await selection(),originalSelection);
  assert.ok(await p.locator('#exm').isDisabled(),'the example chart cannot be exported after restoring source');
  assert.equal(await p.evaluate(()=>document.activeElement.id),'ta');
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
test('long function headings stay inside their natural diagram sections',async t=>{
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
