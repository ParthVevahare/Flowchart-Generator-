const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
let checker;try{checker=require('../scripts/check-sitemap.cjs');}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;}
const base='https://parthvevahare.github.io/Flowchart-Generator-/';
const xml=urls=>'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(u=>'<url><loc>'+u+'</loc></url>').join('')+'</urlset>';
test('sitemap rejects doubled path slashes, duplicates, off-site and missing URLs',()=>{
 assert.ok(checker,'sitemap checker exists');
 const expected=[base,base+'guides/'];assert.deepEqual(checker.validateSitemap(xml(expected),expected),expected);
 for(const bad of [[base,base+'/sitemap.xml'],[base,base],[base,'https://example.com/'],[base]])assert.throws(()=>checker.validateSitemap(xml(bad),expected));
 assert.throws(()=>checker.validateSitemap('<html>not XML</html>',expected));
});
test('sitemap contains exactly the existing canonical public pages',()=>{
 assert.ok(checker);
 const root=path.join(__dirname,'..'),sitemap=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');
 const expected=['','privacy.html','terms.html','guides/',...['python-to-flowchart','c-to-flowchart','cpp-to-flowchart','java-to-flowchart','loop-and-decision-flowcharts','code-to-algorithm-and-pseudocode','export-flowcharts'].map(x=>'guides/'+x+'.html')].map(x=>base+x);
 const urls=checker.validateSitemap(sitemap,expected);
 for(const url of urls){const relative=url.slice(base.length),filename=path.join(root,relative.endsWith('/')?relative+'index.html':relative||'index.html');const html=fs.readFileSync(filename,'utf8');assert.ok(html.includes('rel="canonical" href="'+url+'"'),url+' agrees with canonical');}
});
