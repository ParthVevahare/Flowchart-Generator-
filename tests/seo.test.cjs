const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),base='/Flowchart-Generator-/';
const canonical='https://parthvevahare.github.io'+base;
const pages=['','privacy.html','terms.html'];
let browser,server,origin;
before(async()=>{
  server=http.createServer((req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(!pathname.startsWith(base)){res.writeHead(404);return res.end();}
    const file=path.join(root,pathname.slice(base.length)||'index.html');
    fs.readFile(file,(error,data)=>{res.writeHead(error?404:200,{'Content-Type':file.endsWith('.xml')?'application/xml':file.endsWith('.css')?'text/css':/\.m?js$/.test(file)?'text/javascript':file.endsWith('.png')?'image/png':file.endsWith('.svg')?'image/svg+xml':'text/html'});res.end(error?'Missing':data);});
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true});
});
after(async()=>{await browser?.close();await new Promise(r=>server?.close(r));});

test('public pages expose unique metadata, crawlable content and working links without JavaScript',async()=>{
  const context=await browser.newContext({javaScriptEnabled:false});
  try{
    const p=await context.newPage(),titles=new Set(),descriptions=new Set();
    for(const file of pages){
      assert.equal((await p.goto(origin+base+file)).status(),200);
      titles.add(await p.title());
      const description=await p.locator('meta[name="description"]').getAttribute('content');
      assert.ok(description.length>50);descriptions.add(description);
      assert.equal(await p.locator('link[rel="canonical"]').getAttribute('href'),canonical+file);
      assert.equal(await p.locator('meta[property="og:url"]').getAttribute('content'),canonical+file);
      assert.equal(await p.locator('meta[property="og:title"]').getAttribute('content'),await p.title());
      assert.equal(await p.locator('meta[name="twitter:title"]').getAttribute('content'),await p.title());
      assert.match(await p.locator('meta[name="robots"]').getAttribute('content'),/^index,\s*follow/);
      assert.equal(await p.locator('h1').count(),1);
      assert.equal(await p.locator('link[rel="icon"]').count(),1);
      if(!file){
        assert.equal(await p.locator('#about').count(),0);
        assert.equal(await p.locator('#how-to-use').isVisible(),false);
        assert.match(await p.locator('#how-to-use').textContent(),/C\/C\+\+.*Python.*Java/s);
      }
      const links=await p.locator('a[href],link[rel="stylesheet"],link[rel="icon"],script[src],img[src]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')||n.getAttribute('src')));
      for(const link of new Set(links)){
        const target=new URL(link,p.url());
        if(target.origin!==origin)continue;
        assert.ok(target.pathname.startsWith(base),link+' escapes project base');
        if(target.hash&&target.pathname===new URL(p.url()).pathname)assert.equal(await p.locator('[id="'+target.hash.slice(1)+'"]').count(),1);
        assert.equal((await context.request.get(target.href)).status(),200,target.href);
      }
    }
    assert.equal(titles.size,3);assert.equal(descriptions.size,3);
  }finally{await context.close();}
});

test('sitemap and structured data identify only canonical public content',async()=>{
  const p=await browser.newPage({javaScriptEnabled:false});
  try{
    await p.goto(origin+base);
    const graph=JSON.parse(await p.locator('script[type="application/ld+json"]').textContent());
    assert.equal(graph['@context'],'https://schema.org');
    assert.deepEqual(graph['@graph'].map(x=>x['@type']),['WebSite','WebApplication']);
    for(const item of graph['@graph']){assert.equal(item.url,canonical);assert.ok(!item.aggregateRating&&!item.review);}
    assert.equal(graph['@graph'][1].isAccessibleForFree,true);
    const xml=await (await p.request.get(origin+base+'sitemap.xml')).text();
    const parsed=await p.evaluate(text=>{const d=new DOMParser().parseFromString(text,'application/xml');return {errors:d.querySelectorAll('parsererror').length,namespace:d.documentElement.namespaceURI,urls:[...d.querySelectorAll('loc')].map(x=>x.textContent),dates:d.querySelectorAll('lastmod').length};},xml);
    assert.equal(parsed.errors,0);assert.equal(parsed.namespace,'http://www.sitemaps.org/schemas/sitemap/0.9');
    assert.deepEqual(parsed.urls,pages.map(x=>canonical+x));assert.equal(parsed.dates,0);
  }finally{await p.close();}
});

test('guide and editor fit mobile and short desktop screens under the project base path',async()=>{
  const context=await browser.newContext();
  await context.route('https://**/*',r=>r.fulfill({body:r.request().url().includes('abacus')?'{"value":1588}':''}));
  try{
    const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.goto(origin+base);await p.waitForFunction(()=>document.getElementById('chart-state').textContent==='Program mapped');
    for(const viewport of [{width:1440,height:960},{width:1280,height:540},{width:390,height:844},{width:320,height:480},{width:568,height:320}]){
      await p.setViewportSize(viewport);
      assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow at '+viewport.width);
      assert.ok(await p.locator('#stage').evaluate(e=>e.clientHeight>=180));
      assert.equal(await p.locator('#how-to-use').isVisible(),false);
      await p.locator('#help-open').click();
      for(let step=0;step<3;step++){
        assert.ok(await p.locator('#help-step-'+step).isVisible());
        assert.ok(await p.locator('#how-to-use').evaluate(e=>{const r=e.getBoundingClientRect();return e.scrollHeight<=e.clientHeight&&r.top>=0&&r.bottom<=innerHeight;}),'popup must fit without scrolling');
        await p.locator('#help-next').click();
      }
      assert.equal(await p.locator('#how-to-use').isVisible(),false);
      await p.waitForFunction(()=>document.activeElement.id==='ta');
      await p.locator('#help-open').click();await p.keyboard.press('Escape');
      assert.equal(await p.locator('#how-to-use').isVisible(),false);
      await p.waitForFunction(()=>document.activeElement.id==='help-open');
    }
    assert.deepEqual(errors,[]);
  }finally{await context.close();}
});
