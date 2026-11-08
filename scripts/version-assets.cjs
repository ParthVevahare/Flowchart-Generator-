/* Content-version entry-point assets so an old browser cache cannot mix APIs. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),check=process.argv.includes('--check');
const files=['index.html',...fs.readdirSync(path.join(root,'guides')).filter(x=>x.endsWith('.html')).map(x=>'guides/'+x)];
let stale=false;
for(const file of files){
 const target=path.join(root,file),html=fs.readFileSync(target,'utf8');
 const updated=html.replace(/(<script\b[^>]*\bsrc="|<link\b(?=[^>]*\brel="stylesheet")[^>]*\bhref=")([^"]+)/g,(match,prefix,url)=>{
  if(/^(?:https?:)?\/\//.test(url))return match;
  const [relative]=url.split(/[?#]/),asset=path.resolve(root,path.dirname(file),relative);
  const canonical=fs.readFileSync(asset,'utf8').replace(/\r\n/g,'\n');
  const hash=crypto.createHash('sha256').update(canonical).digest('hex').slice(0,12);
  return prefix+relative+'?v='+hash;
 });
 if(updated!==html){if(check){console.error('Stale asset versions: '+file);stale=true;}else fs.writeFileSync(target,updated);}
}
if(stale)process.exitCode=1;else console.log(check?'Asset versions match their source.':'Updated content-versioned script and stylesheet URLs.');
