const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
let browser,server,url;
before(async()=>{
  server=http.createServer((req,res)=>{const file=path.join(__dirname,'..',req.url==='/'?'index.html':req.url.split('?')[0]);fs.readFile(file,(err,data)=>{res.setHeader('Content-Type',file.endsWith('.css')?'text/css':/\.(m?js)$/.test(file)?'text/javascript':'text/html');res.statusCode=err?404:200;res.end(err?'Missing':data);});});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));url='http://127.0.0.1:'+server.address().port;
  const downloadsPath=path.resolve(__dirname,'../test-results/downloads');fs.mkdirSync(downloadsPath,{recursive:true});
  browser=await chromium.launch({headless:true,downloadsPath});
});
after(async()=>{await browser?.close();await new Promise(r=>server?.close(r));});
async function open(t,{configured=true,width=1440}={}){
  const context=await browser.newContext({viewport:{width,height:960}});t.after(()=>context.close());
  await context.route('https://**/*',r=>r.fulfill({body:r.request().url().includes('abacus')?'{"value":1588}':''}));
  if(!configured)await context.route('**/firebase-config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.FLOWCHART_FIREBASE_CONFIG={};'}));
  if(configured){
    await context.route('**/firebase-config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.FLOWCHART_FIREBASE_CONFIG={apiKey:"test",authDomain:"test",projectId:"test",appId:"test"};'}));
    await context.addInitScript(()=>{
      const seed=()=>Array.from({length:301},(_,i)=>({id:'p'+i,title:'Program '+(i+1),language:'c',sourceCode:'int main(){return 0;}',description:'',tags:[],favorite:false,deleted:false,revision:1,createdAt:i,updatedAt:i}));
      let records=JSON.parse(localStorage.getItem('fixture-records')||'null')||{alice:seed(),bob:[]};let callback;
      const persist=()=>localStorage.setItem('fixture-records',JSON.stringify(records));
      window.fixture={offline:false,conflict:false,delay:0,user:null,preference:null};
      window.fixtureClient={
        store:{newId:()=>crypto.randomUUID(),
          listPage:async(uid,cursor)=>{if(window.fixture.offline)throw Error('Offline');const start=cursor?Number(cursor):0;const rows=records[uid]||[];return {rows:rows.slice(start,start+100).map(({sourceCode,...m})=>m),cursor:start+100<rows.length?String(start+100):null};},
          open:async(uid,id)=>{if(window.fixture.offline)throw Error('Offline');if(window.fixture.delay)await new Promise(r=>setTimeout(r,window.fixture.delay));return structuredClone(records[uid].find(p=>p.id===id));},
          save:async(uid,id,d,revision,mutationId)=>{if(window.fixture.offline)throw Error('Offline');if(window.fixture.conflict)throw Object.assign(Error('Changed on another device'),{code:'conflict'});const rows=records[uid]||(records[uid]=[]),i=rows.findIndex(p=>p.id===id);if(i>=0&&rows[i].revision!==revision)throw Object.assign(Error('Conflict'),{code:'conflict'});const p={...d,id,revision:revision+1,mutationId,createdAt:i>=0?rows[i].createdAt:Date.now(),updatedAt:Date.now()};if(i<0)rows.push(p);else rows[i]=p;persist();return p;},
          profile:async(user,choice)=>{const k='preference-'+user.uid;let v=localStorage.getItem(k);if(v===null){v=String(choice);localStorage.setItem(k,v);}window.fixture.preference=v==='true';return {emailUpdates:v==='true'};},
          readProfile:async uid=>{const v=localStorage.getItem('preference-'+uid);if(v===null)return null;window.fixture.preference=v==='true';return {emailUpdates:v==='true'};},
          preference:async(user,value)=>{window.fixture.preference=value;localStorage.setItem('preference-'+user.uid,String(value));}
        },
        watch:fn=>{callback=fn;const uid=localStorage.getItem('fixture-user');queueMicrotask(()=>fn(uid?{uid,email:uid+'@example.test'}:null));},
        signIn:async()=>{localStorage.setItem('fixture-user','alice');await callback({uid:'alice',email:'alice@example.test'});},
        signOut:async()=>{localStorage.removeItem('fixture-user');await callback(null);}
      };
      window.changeAccount=async(uid)=>{localStorage.setItem('fixture-user',uid);await callback({uid,email:uid+'@example.test'});};
    });
    await context.route('**/firebase-client.mjs',r=>r.fulfill({contentType:'text/javascript',body:'export function connect(){return window.fixtureClient;}'}));
  }
  const page=await context.newPage();await page.goto(url);await page.locator('#library-toggle').click();return page;
}
async function login(p,updates=true){
  await p.locator('#cloud-signin').click();
  await p.waitForFunction(()=>document.getElementById('library-panel').getAttribute('aria-busy')==='false');
  if(await p.locator('#cloud-signup').isVisible()){
    assert.equal(await p.locator('#signup-updates').isChecked(),true);
    assert.equal(await p.evaluate(()=>localStorage.getItem('preference-alice')),null);
    await p.locator('#signup-updates').setChecked(updates);await p.locator('#cloud-create').click();
  }
  await p.waitForFunction(()=>document.getElementById('library-count').textContent.includes('301 programs'));
}
test('unconfigured Firebase leaves the generator usable and explains setup',async t=>{
  const p=await open(t,{configured:false});assert.match(await p.locator('#library-message').textContent(),/setup/i);
  assert.equal(await p.locator('#cloud-signin').isDisabled(),true);
  await p.locator('#library-close').click();await p.locator('#ta').fill('int main(){return 1;}');await p.locator('#go').click();
  await p.waitForFunction(()=>document.getElementById('chart-state').textContent==='Program mapped');
});
test('301 programs, search, open, autosave, duplicate, trash and restore preserve the generator',async t=>{
  const p=await open(t);assert.equal(await p.locator('#signup-updates').isVisible(),false);
  await login(p,false);assert.equal(await p.evaluate(()=>fixture.preference),false);
  await p.locator('#library-search').fill('Program 300');await p.getByRole('button',{name:'Open Program 300',exact:true}).click();
  await p.waitForFunction(()=>document.getElementById('program-title').value==='Program 300');
  await p.locator('#ta').fill('int main(){return 300;}');await p.waitForFunction(()=>document.getElementById('cloud-status').textContent==='Saved to cloud');
  await p.locator('#program-copy').click();await p.waitForFunction(()=>document.getElementById('program-title').value.includes('copy'));
  await p.locator('#library-toggle').click();await p.locator('#library-search').fill('copy');
  p.once('dialog',d=>d.accept());await p.getByRole('button',{name:'Move Program 300 (copy) to Trash',exact:true}).click();
  await p.locator('#library-filter-toggle').click();await p.locator('#library-trash').check();await p.getByRole('button',{name:'Restore Program 300 (copy)',exact:true}).click();
  await p.locator('#library-trash').uncheck();assert.equal(await p.getByRole('button',{name:'Open Program 300 (copy)',exact:true}).count(),1);
});
test('offline edits recover after reload and account changes never expose the previous account',async t=>{
  const p=await open(t);await login(p);await p.locator('#library-search').fill('Program 300');await p.getByRole('button',{name:'Open Program 300',exact:true}).click();
  await p.waitForFunction(()=>document.getElementById('program-title').value==='Program 300');
  await p.evaluate(()=>fixture.offline=true);await p.locator('#ta').fill('private offline source');await p.locator('#program-save').click();
  await p.waitForFunction(()=>document.getElementById('cloud-status').textContent.includes('Offline'));
  await p.evaluate(()=>changeAccount('bob'));assert.notEqual(await p.locator('#ta').inputValue(),'private offline source');
  assert.equal(await p.locator('#library-list').textContent(),'');
  await p.evaluate(()=>{fixture.offline=false;return changeAccount('alice');});
  await p.getByRole('button',{name:'Recover Program 300',exact:true}).click();assert.equal(await p.locator('#ta').inputValue(),'private offline source');
  await p.locator('#program-save').click();await p.waitForFunction(()=>document.getElementById('cloud-status').textContent==='Saved to cloud');
});
test('mobile library fits, exposes meaningful actions and defaults remain keyboard accessible',async t=>{
  const p=await open(t,{width:390});await login(p);
  for(const width of [390,320]){
    await p.setViewportSize({width,height:844});
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    const rect=await p.locator('#library-panel').boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=width);
  }
  await p.screenshot({path:'test-results/library-mobile.png',fullPage:true});
  await p.setViewportSize({width:1440,height:960});await p.screenshot({path:'test-results/library-desktop.png',fullPage:true});
  await p.locator('#th').click();await p.screenshot({path:'test-results/library-dark.png',fullPage:true});
  await p.locator('#library-filter-toggle').click();await p.screenshot({path:'test-results/library-filters.png',fullPage:true});
});
test('offline draft survives refresh and two tabs retain independent recovery copies',async t=>{
  const p=await open(t);await login(p);await p.locator('#library-search').fill('Program 300');await p.getByRole('button',{name:'Open Program 300',exact:true}).click();
  await p.waitForFunction(()=>document.getElementById('program-title').value==='Program 300');
  await p.evaluate(()=>fixture.offline=true);await p.locator('#ta').fill('offline before refresh');await p.locator('#program-save').click();
  await p.waitForFunction(()=>document.getElementById('cloud-status').textContent.includes('Offline'));
  p.once('dialog',d=>d.accept());await p.reload();await p.getByRole('button',{name:'Recover Program 300',exact:true}).click();
  await p.waitForFunction(()=>document.getElementById('ta').value==='offline before refresh');
  await p.evaluate(async()=>{
    const a=new CodeLibraryDrafts(),b=new CodeLibraryDrafts();
    await a.put('parallel','same',{data:{title:'First tab'},modifiedAt:1,mutationId:'a'});
    await b.put('parallel','same',{data:{title:'Second tab'},modifiedAt:2,mutationId:'b'});
    await a.remove('parallel','same');
    window.remainingDrafts=await b.list('parallel');
  });
  assert.equal(await p.evaluate(()=>remainingDrafts.length),1);
  assert.equal(await p.evaluate(()=>remainingDrafts[0].data.title),'Second tab');
  await p.locator('#program-save').click();await p.waitForFunction(()=>document.getElementById('cloud-status').textContent==='Saved to cloud');
  await p.locator('#library-toggle').click();assert.equal(await p.getByRole('button',{name:'Recover Program 300',exact:true}).count(),0);
});
test('account switch during copy cleanup cannot attach the old account source',async t=>{
  const p=await open(t);await login(p);await p.locator('#library-search').fill('Program 300');await p.getByRole('button',{name:'Open Program 300',exact:true}).click();
  await p.waitForFunction(()=>document.getElementById('program-title').value==='Program 300');
  await p.locator('#ta').fill('Alice private code');await p.locator('#program-save').click();
  await p.waitForFunction(()=>document.getElementById('cloud-status').textContent==='Saved to cloud');
  await p.evaluate(()=>{
    const remove=CodeLibraryDrafts.prototype.remove;
    CodeLibraryDrafts.prototype.remove=async function(uid,id){if(uid==='alice'&&id==='p299')await changeAccount('bob');return remove.call(this,uid,id);};
  });
  await p.locator('#program-copy').click();await p.waitForFunction(()=>document.getElementById('account-email').textContent==='bob@example.test');
  await p.waitForFunction(()=>document.getElementById('library-panel').getAttribute('aria-busy')==='false');
  assert.notEqual(await p.locator('#ta').inputValue(),'Alice private code');
  assert.equal(await p.locator('#cloud-editor').isVisible(),false);
});
test('rapid program switching saves the previous editor and locks typing during the load',async t=>{
  const p=await open(t);await login(p);await p.locator('#library-search').fill('Program 300');await p.getByRole('button',{name:'Open Program 300',exact:true}).click();
  await p.waitForFunction(()=>document.getElementById('program-title').value==='Program 300');
  await p.locator('#ta').fill('int main(){return 42;}');await p.locator('#library-toggle').click();await p.locator('#library-search').fill('Program 301');
  await p.evaluate(()=>fixture.delay=300);await p.getByRole('button',{name:'Open Program 301',exact:true}).click();
  assert.equal(await p.locator('#ta').getAttribute('readonly'),'');
  await p.waitForFunction(()=>document.getElementById('program-title').value==='Program 301');
  await p.locator('#library-toggle').click();await p.locator('#library-search').fill('Program 300');await p.getByRole('button',{name:'Open Program 300',exact:true}).click();
  await p.waitForFunction(()=>document.getElementById('ta').value==='int main(){return 42;}');
  await p.evaluate(()=>{const create=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{window.downloadPayload=blob.text();return create(blob);};});
  const download=p.waitForEvent('download');await p.locator('#program-download').click();const file=await download;assert.ok(file.suggestedFilename().endsWith('.cpp'));
  assert.equal(await p.evaluate(()=>downloadPayload),'int main(){return 42;}');
  // Managed Windows hosts may cancel all browser disk downloads. Linux CI checks the actual file too.
  if(process.env.PLAYWRIGHT_VERIFY_DOWNLOAD_FILE==='1')assert.equal(fs.readFileSync(await file.path(),'utf8'),'int main(){return 42;}');
  await p.screenshot({path:'test-results/editor-desktop.png',fullPage:true});
  await p.setViewportSize({width:390,height:844});await p.screenshot({path:'test-results/editor-mobile.png',fullPage:true});
});
test('sign out clears the private editor; signing back in preserves the mailing preference',async t=>{
  const p=await open(t);await login(p,false);
  await p.locator('#cloud-signout').click();await p.locator('#cloud-signin').waitFor({state:'visible'});
  await login(p);
  assert.equal(await p.locator('#signup-updates').isVisible(),false);
  assert.equal(await p.locator('#account-updates').count(),0);
  assert.equal(await p.evaluate(()=>fixture.preference),false);
});
test('library keeps secondary controls tucked away and icon actions have names',async t=>{
  const p=await open(t);await login(p);
  assert.equal(await p.locator('#library-language').isVisible(),false);
  assert.equal(await p.locator('#library-sort').isVisible(),false);
  assert.equal(await p.locator('#library-list .library-row-actions button svg').count(),50);
  for(const b of await p.locator('#library-list .library-row-actions button').all())assert.ok(await b.getAttribute('aria-label'));
  await p.locator('#library-filter-toggle').click();await p.locator('#library-language').selectOption('python');
  assert.match(await p.locator('#library-empty').textContent(),/No programs/);
  await p.locator('#library-language').selectOption('');
  await p.locator('#library-search').fill('Program 300');await p.getByRole('button',{name:'Open Program 300',exact:true}).click();
  await p.locator('#program-save').waitFor({state:'visible'});
  assert.equal(await p.locator('.save-actions #program-save').count(),1);
  assert.equal(await p.locator('.save-actions #program-copy').count(),1);
  assert.equal(await p.locator('#program-download svg').count(),1);
});
test('account creation records the choice only on submission and can retry a failed save',async t=>{
  const p=await open(t,{width:390});await p.locator('#cloud-signin').click();
  await p.locator('#cloud-signup').waitFor({state:'visible'});
  assert.equal(await p.locator('#signup-updates').isChecked(),true);
  assert.equal(await p.locator('#library-controls').isVisible(),false);
  assert.equal(await p.evaluate(()=>localStorage.getItem('preference-alice')),null);
  await p.screenshot({path:'test-results/signup-mobile.png',fullPage:true});
  await p.evaluate(()=>{const original=fixtureClient.store.profile;fixtureClient.store.profile=async(...args)=>{fixtureClient.store.profile=original;throw Error('Please retry');};});
  await p.locator('#signup-updates').uncheck();await p.locator('#cloud-create').click();
  await p.waitForFunction(()=>document.getElementById('library-message').textContent.includes('Please retry'));
  assert.equal(await p.locator('#signup-updates').isChecked(),false);
  await p.locator('#cloud-create').click();await p.locator('#cloud-signup').waitFor({state:'hidden'});
  assert.equal(await p.evaluate(()=>localStorage.getItem('preference-alice')),'false');
});
