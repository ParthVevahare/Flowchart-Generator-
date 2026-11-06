const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validate,selectPrograms,SaveSession}=require('../library-core.js');
const data=(title='Example')=>({title,language:'c',sourceCode:'int main(){return 0;}',description:'',tags:[],favorite:false,deleted:false});
function fixture(save){
  const records=new Map();
  const drafts={put:async(uid,id,d)=>records.set(uid+':'+id,structuredClone(d)),remove:async(uid,id)=>records.delete(uid+':'+id)};
  const calls=[],statuses=[];
  const store={save:async(...args)=>{calls.push(args);return save?save(...args):{revision:args[3]+1};}};
  const session=new SaveSession({uid:'alice',id:'one',data:data(),revision:1,store,drafts,delay:60000,onStatus:s=>statuses.push(s)});
  return {session,calls,records,statuses,drafts,store};
}
test('source capacity is independent of generator size, with clear field validation',()=>{
  assert.equal(validate({...data(),sourceCode:'a'.repeat(180000)}).sourceCode.length,180000);
  assert.throws(()=>validate({...data(),sourceCode:'a'.repeat(180001)}),/180,000/);
  assert.throws(()=>validate({...data(),title:' '}),/title/i);
  assert.throws(()=>validate({...data(),tags:['x'.repeat(41)]}),/tag/i);
});
test('all 301 metadata records are searchable and sortable without code bodies',()=>{
  const rows=Array.from({length:301},(_,i)=>({...data('Program '+String(i+1).padStart(3,'0')),id:String(i),sourceCode:undefined,updatedAt:i,createdAt:i,favorite:i===299}));
  assert.equal(selectPrograms(rows,{}).length,301);
  assert.equal(selectPrograms(rows,{search:'PROGRAM 300'})[0].id,'299');
  assert.equal(selectPrograms(rows,{favorites:true})[0].id,'299');
  assert.equal(selectPrograms(rows,{sort:'name-desc'})[0].title,'Program 301');
});
test('unchanged edits do not write; failed saves retain private recovery drafts',async()=>{
  const f=fixture(async()=>{throw Error('offline');});
  f.session.edit(data());await f.session.flush();assert.equal(f.calls.length,0);
  f.statuses.length=0;
  f.session.edit(data('Changed'));await assert.rejects(f.session.flush(),/offline/);
  assert.equal(f.records.get('alice:one').data.title,'Changed');assert.equal(f.session.dirty,true);
  assert.ok(!f.statuses.includes('saved'));f.session.close();
});
test('typing during a save serializes revisions and only clears the newest draft after acknowledgement',async()=>{
  let release;let n=0;
  const f=fixture(async(...args)=>{if(++n===1)await new Promise(r=>release=r);return {revision:args[3]+1};});
  f.session.edit(data('First'));const saving=f.session.flush();
  while(!release)await new Promise(r=>setImmediate(r));
  f.session.edit(data('Second'));release();await saving;
  assert.deepEqual(f.calls.map(c=>[c[2].title,c[3]]),[['First',1],['Second',2]]);
  assert.equal(f.session.revision,3);assert.equal(f.session.dirty,false);assert.equal(f.records.size,0);f.session.close();
});
test('conflicts preserve edits and operation identifiers survive retries',async()=>{
  const e=Object.assign(Error('Newer cloud version'),{code:'conflict'});const f=fixture(async()=>{throw e;});
  f.session.edit(data('Local'));await assert.rejects(f.session.flush(),/Newer/);
  await assert.rejects(f.session.flush(),/Newer/);
  assert.equal(f.calls[0][4],f.calls[1][4]);assert.equal(f.records.get('alice:one').mutationId,f.calls[0][4]);
  assert.equal(f.statuses.at(-1),'conflict');f.session.close();
});
test('closing on account change retains the old account draft and prevents new writes',async()=>{
  const f=fixture();f.session.edit(data('Private'));await f.session.persist();f.session.close();
  assert.equal(f.records.get('alice:one').data.title,'Private');
  await assert.rejects(f.session.flush(),/closed/i);assert.equal(f.calls.length,0);
});
test('local persistence failure is surfaced and does not claim cloud success',async()=>{
  const f=fixture();f.session.drafts.put=async()=>{throw Error('disk full');};
  f.session.edit(data('Unsaved'));await assert.rejects(f.session.flush(),/disk full/);
  assert.equal(f.calls.length,0);assert.equal(f.session.dirty,true);f.session.close();
});
test('a closed session acknowledgement cannot delete a newer session recovery draft',async()=>{
  let release;
  const f=fixture(async()=>{await new Promise(r=>release=r);return {revision:2};});
  f.session.edit(data('Old in flight'));const pending=f.session.flush();
  while(!release)await new Promise(r=>setImmediate(r));f.session.close();
  const newer=new SaveSession({uid:'alice',id:'one',data:data(),revision:1,store:f.store,drafts:f.drafts,delay:60000});
  newer.edit(data('New unsaved edit'));await newer.persist();release();await pending;
  newer.close();assert.equal(f.records.get('alice:one')?.data.title,'New unsaved edit');
});
