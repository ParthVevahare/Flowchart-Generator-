const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..');
test('local script and stylesheet URLs identify the deployed source version',()=>{
 const files=['index.html',...fs.readdirSync(path.join(root,'guides')).filter(x=>x.endsWith('.html')).map(x=>'guides/'+x)];
 for(const file of files){
  const html=fs.readFileSync(path.join(root,file),'utf8');
  const urls=[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"|<link\b(?=[^>]*\brel="stylesheet")[^>]*\bhref="([^"]+)"/g)].map(m=>m[1]||m[2]);
  for(const url of urls){if(/^(?:https?:)?\/\//.test(url))continue;
   const parsed=new URL(url,'https://local/'),asset=path.resolve(root,path.dirname(file),url.split(/[?#]/)[0]);
   const hash=crypto.createHash('sha256').update(fs.readFileSync(asset,'utf8').replace(/\r\n/g,'\n')).digest('hex').slice(0,12);
   assert.equal(parsed.searchParams.get('v'),hash,file+': '+url+' must bypass stale cached versions');
  }
 }
});
