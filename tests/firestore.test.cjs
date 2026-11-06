const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {initializeTestEnvironment,assertFails}=require('@firebase/rules-unit-testing');
const sdk=require('firebase/firestore');
const {createStore}=require('../library-store.js');
const {selectPrograms}=require('../library-core.js');
let env,alice,bob,store;
const data=(n)=>({title:'Program '+n,language:'c',sourceCode:'int main(){return '+n+';}',description:'Example',tags:['practice'],favorite:false,deleted:false});
before(async()=>{
  env=await initializeTestEnvironment({projectId:'demo-flowchart-library',firestore:{host:'127.0.0.1',port:8080,rules:fs.readFileSync('firestore.rules','utf8')}});
  alice=env.authenticatedContext('alice',{email:'alice@example.test',email_verified:true}).firestore();
  bob=env.authenticatedContext('bob',{email:'bob@example.test',email_verified:true}).firestore();
  store=createStore(alice,sdk);
});
after(async()=>env?.cleanup());
test('301 independent programs survive paged reload, edit, duplicate and recoverable deletion',async()=>{
  for(let i=1;i<=301;i++)await store.save('alice','p'+String(i).padStart(4,'0'),data(i),0,'create-'+i);
  const rows=[];let cursor=null;
  do{const page=await store.listPage('alice',cursor);rows.push(...page.rows);cursor=page.cursor;}while(cursor);
  assert.equal(rows.length,301);assert.ok(rows.every(d=>!('sourceCode' in d)));
  assert.equal(selectPrograms(rows,{search:'program 300'}).length,1);
  let program=await store.open('alice','p0300');assert.equal(program.sourceCode,data(300).sourceCode);
  await store.save('alice','p0300',{...program,title:'Edited 300'},program.revision,'edit-300');
  program=await store.open('alice','p0300');assert.equal(program.title,'Edited 300');assert.equal(program.revision,2);
  await store.save('alice','duplicate',{...program,title:'Copy'},0,'duplicate');
  assert.equal((await store.open('alice','duplicate')).sourceCode,program.sourceCode);
  await store.save('alice','duplicate',{...program,title:'Copy',deleted:true},1,'trash');
  assert.equal((await store.open('alice','duplicate')).deleted,true);
  await store.save('alice','duplicate',{...program,title:'Copy',deleted:false},2,'restore');
  assert.equal((await store.open('alice','duplicate')).deleted,false);
});
test('stale concurrent edits fail and repeated acknowledged operations are idempotent',async()=>{
  const p=await store.open('alice','p0300');
  await store.save('alice','p0300',{...p,title:'Other device'},p.revision,'other-device');
  await assert.rejects(store.save('alice','p0300',{...p,title:'Stale edit'},p.revision,'stale'),e=>e.code==='conflict');
  const replay=await store.save('alice','p0300',{...p,title:'Other device'},p.revision,'other-device');
  assert.equal(replay.revision,p.revision+1);
});
test('guests and other accounts cannot list, read or write private source and profiles',async()=>{
  const guest=env.unauthenticatedContext().firestore();
  for(const db of [bob,guest]){
    await assertFails(sdk.getDocs(sdk.collection(db,'users/alice/codes')));
    await assertFails(sdk.getDoc(sdk.doc(db,'users/alice/codes/p0300')));
    await assertFails(sdk.getDoc(sdk.doc(db,'users/alice/codes/p0300/content/source')));
    await assertFails(sdk.setDoc(sdk.doc(db,'users/alice/codes/p0300'),data(1)));
    await assertFails(sdk.getDoc(sdk.doc(db,'users/alice')));
  }
  const own=createStore(bob,sdk);await own.save('bob','private',data(9),0,'bob-create');
  assert.equal((await own.listPage('bob')).rows.length,1);
});
test('rules reject malformed, oversized, mismatched and non-atomic writes, and hard deletion',async()=>{
  const ref=sdk.doc(alice,'users/alice/codes/p0300');
  for(const patch of [{title:42},{favorite:'yes'},{tags:[4]},{revision:999},{extra:true},{createdAt:sdk.serverTimestamp()}])await assertFails(sdk.updateDoc(ref,patch));
  await assertFails(sdk.deleteDoc(ref));
  await assertFails(sdk.updateDoc(sdk.doc(alice,'users/alice/codes/p0300/content/source'),{sourceCode:'bypass'}));
  await assert.rejects(store.save('alice','too-large',{...data(1),sourceCode:'x'.repeat(180001)},0,'large'));
  const batch=sdk.writeBatch(alice),stamp=sdk.serverTimestamp();
  const {sourceCode,...metadata}=data(1);
  batch.set(sdk.doc(alice,'users/alice/codes/bad'),{...metadata,revision:1,mutationId:'bad',createdAt:stamp,updatedAt:stamp});
  await assertFails(batch.commit());
});
test('signup preference is recorded once, can be disabled and is preserved on later login',async()=>{
  const user={uid:'alice',email:'alice@example.test',displayName:'Alice'};
  assert.equal(await store.readProfile('alice'),null);
  let profile=await store.profile(user,true);assert.equal(profile.emailUpdates,true);
  assert.equal((await store.readProfile('alice')).emailUpdates,true);
  await store.preference(user,false);
  profile=await store.profile(user,true);assert.equal(profile.emailUpdates,false);
  await assertFails(sdk.updateDoc(sdk.doc(alice,'users/alice'),{email:'someone@example.test'}));
});
