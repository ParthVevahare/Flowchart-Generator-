const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),vm=require('node:vm');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..'),base='/Flowchart-Generator-/',canonical='https://parthvevahare.github.io'+base;
const files=['guides/','guides/python-to-flowchart.html','guides/c-to-flowchart.html','guides/cpp-to-flowchart.html','guides/java-to-flowchart.html','guides/loop-and-decision-flowcharts.html','guides/code-to-algorithm-and-pseudocode.html','guides/export-flowcharts.html'];
let browser,server,origin;
before(async()=>{
 server=http.createServer((req,res)=>{
   const pathname=new URL(req.url,'http://localhost').pathname;
   if(!pathname.startsWith(base)){res.writeHead(404);return res.end();}
   const relative=pathname.slice(base.length),file=path.join(root,relative.endsWith('/')?relative+'index.html':relative||'index.html');
   fs.readFile(file,(e,data)=>{res.writeHead(e?404:200,{'Content-Type':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.js')?'text/javascript':'text/html'});res.end(e?'Missing':data);});
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true});
});
after(async()=>{await browser?.close();await new Promise(r=>server?.close(r));});
test('all search guides are useful, distinct, linked and crawlable without JavaScript',async()=>{
 const context=await browser.newContext({javaScriptEnabled:false});
 try{
   const p=await context.newPage(),titles=new Set(),descriptions=new Set();
   await p.goto(origin+base);assert.ok(await p.locator('a[href="guides/"]').count()>0,'homepage links to guides');
   for(const file of files){
     assert.equal((await p.goto(origin+base+file)).status(),200,file);
     titles.add(await p.title());const desc=await p.locator('meta[name=description]').getAttribute('content');descriptions.add(desc);
     assert.ok(desc.length>=80&&desc.length<=180);assert.equal(await p.locator('h1').count(),1);
     assert.ok(await p.locator('main').isVisible());assert.ok((await p.locator('main').textContent()).split(/\s+/).length>=180);
     assert.equal(await p.locator('link[rel=canonical]').getAttribute('href'),canonical+file);
     assert.equal(await p.locator('meta[property="og:url"]').getAttribute('content'),canonical+file);
     assert.equal(await p.locator('meta[property="og:title"]').getAttribute('content'),await p.title());
     assert.equal(await p.locator('meta[name="twitter:title"]').getAttribute('content'),await p.title());
     const graph=JSON.parse(await p.locator('script[type="application/ld+json"]').textContent());
     assert.equal(graph['@context'],'https://schema.org');assert.ok(graph['@graph'].some(x=>x['@type']==='BreadcrumbList'));
     for(const item of graph['@graph'])assert.ok(!item.aggregateRating&&!item.review);
     for(const link of await p.locator('a[href],link[rel=stylesheet],link[rel=icon],img[src]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')||n.getAttribute('src')))){
       const url=new URL(link,p.url());if(url.origin!==origin)continue;
       assert.ok(url.pathname.startsWith(base));assert.equal((await context.request.get(url.href)).status(),200,url.href);
     }
     for(const width of [1440,390,320]){await p.setViewportSize({width,height:844});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),file+' overflow at '+width);}
   }
   assert.equal(titles.size,files.length);assert.equal(descriptions.size,files.length);
   const xml=await (await context.request.get(origin+base+'sitemap.xml')).text();
   for(const file of files)assert.ok(xml.includes('<loc>'+canonical+file+'</loc>'),file+' in sitemap');
 }finally{await context.close();}
});
test('published code examples parse and produce graphs with supported syntax',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const app=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('function parseC('));
 const ctx=vm.createContext({console});vm.runInContext(fs.readFileSync(path.join(root,'syntax.js'),'utf8'),ctx);
 vm.runInContext(app.slice(0,app.indexOf('/* ---------- app ---------- */'))+'\nglobalThis.parseProgram=parse;',ctx);
 const FG=require('../flowchart.js');
 for(const file of files.slice(1)){
   assert.ok(fs.existsSync(path.join(root,file)),file+' exists');
   const text=fs.readFileSync(path.join(root,file),'utf8'),examples=[...text.matchAll(/<pre data-language="(c|python|java)"><code>([\s\S]*?)<\/code><\/pre>/g)];
   assert.ok(examples.length>=1,file+' has a runnable example');
   for(const [,lang,encoded]of examples){const source=encoded.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');const p=ctx.parseProgram(source,lang);assert.ok(FG.build(p).functions.length);}
 }
});
test('guide example links load the selected source and explicit language into the generator',async()=>{
 const context=await browser.newContext();
 await context.route('https://**/*',r=>r.fulfill({body:r.request().url().includes('abacus')?'{"value":1588}':''}));
 try{
   const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
   for(const [slug,language,expected]of [['python-to-flowchart','python','n = int(input'],['c-to-flowchart','c','result *= i'],['cpp-to-flowchart','c','cin >> n'],['java-to-flowchart','java','System.out.println']]){
     await p.goto(origin+base+'guides/'+slug+'.html');await p.locator('.article-hero .button').click();
     await p.waitForFunction(()=>document.getElementById('chart-state')?.textContent==='Program mapped');
     assert.equal(await p.locator('#lang').inputValue(),language);assert.ok((await p.locator('#ta').inputValue()).includes(expected));
     assert.equal(await p.locator('link[rel=canonical]').getAttribute('href'),canonical);
   }
   await p.goto(origin+base+'?example=__proto__');await p.waitForFunction(()=>document.getElementById('chart-state').textContent==='Program mapped');
   assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
