const fs=require('node:fs'),path=require('node:path');
const base='https://parthvevahare.github.io/Flowchart-Generator-/';
function validateSitemap(xml,expected){
  // This project deliberately emits the simple url/loc sitemap subset. Browser
  // tests also parse it with DOMParser to independently verify XML syntax.
  const root=xml.match(/^\s*<\?xml[^?]*\?>\s*<urlset\s+xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">([\s\S]*)<\/urlset>\s*$/);
  if(!root)throw Error('Expected a UTF-8 XML urlset, not an HTML error page or sitemap index.');
  const entries=[...root[1].matchAll(/<url>\s*<loc>([^<>]+)<\/loc>\s*<\/url>/g)];
  if(root[1].replace(/<url>\s*<loc>([^<>]+)<\/loc>\s*<\/url>/g,'').trim())throw Error('Unexpected sitemap structure.');
  const urls=entries.map(m=>m[1]);
  if(!urls.length||new Set(urls).size!==urls.length)throw Error('Sitemap is empty or contains duplicate URLs.');
  for(const value of urls){
    const url=new URL(value);
    if(!value.startsWith(base)||url.protocol!=='https:'||url.search||url.hash||url.pathname.includes('//'))throw Error('Noncanonical sitemap URL: '+value);
  }
  if(expected&&(urls.length!==expected.length||expected.some(x=>!urls.includes(x))))throw Error('Sitemap does not match the expected canonical public pages.');
  return urls;
}
async function main(){
  const root=path.resolve(__dirname,'..'),local=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');
  const expected=['','privacy.html','terms.html','guides/',...require('./guide-content.cjs').map(g=>'guides/'+g.slug+'.html')].map(x=>base+x);
  validateSitemap(local,expected);
  if(!process.argv.includes('--live')){
    for(const url of expected){const relative=url.slice(base.length),file=path.join(root,relative.endsWith('/')?relative+'index.html':relative||'index.html');if(!fs.readFileSync(file,'utf8').includes('rel="canonical" href="'+url+'"'))throw Error('Missing page or mismatched canonical: '+url);}
    console.log('Valid local sitemap: '+expected.length+' existing canonical URLs; no doubled path slashes.');return;
  }
  const sitemapUrl=base+'sitemap.xml';
  const response=await fetch(sitemapUrl,{signal:AbortSignal.timeout(20000),redirect:'error'});
  if(response.status!==200)throw Error('Sitemap HTTP status '+response.status+' at '+sitemapUrl);
  if(!/^(application|text)\/xml\b/i.test(response.headers.get('content-type')||''))throw Error('Sitemap is not served as XML.');
  if(/noindex|none/i.test(response.headers.get('x-robots-tag')||''))throw Error('Sitemap has an unexpected restrictive X-Robots-Tag.');
  validateSitemap(await response.text(),expected);
  for(const url of expected){
    const page=await fetch(url,{signal:AbortSignal.timeout(20000),redirect:'error'});
    if(page.status!==200)throw Error('Listed page HTTP status '+page.status+': '+url);
    const html=await page.text();if(!html.includes('rel="canonical" href="'+url+'"'))throw Error('Live canonical mismatch: '+url);
    if(/noindex|none/i.test(page.headers.get('x-robots-tag')||''))throw Error('Listed page has a restrictive X-Robots-Tag: '+url);
  }
  console.log('Live sitemap fetched as XML with HTTP 200. All '+expected.length+' canonical pages returned HTTP 200.');
  console.log('Search Console: if the prefix ends in /Flowchart-Generator-/, enter sitemap.xml with NO leading slash.');
}
module.exports={validateSitemap};
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
