(function(root){
  'use strict';
  class DraftStore{
    constructor(){this.writer=crypto.randomUUID();}
    db(){
      if(!DraftStore.connection)DraftStore.connection=new Promise((resolve,reject)=>{
        const request=indexedDB.open('flowchart-recovery',1);
        request.onupgradeneeded=()=>request.result.createObjectStore('drafts',{keyPath:'key'});
        request.onsuccess=()=>resolve(request.result);
        request.onerror=()=>{DraftStore.connection=null;reject(Error('Local recovery storage is unavailable. Download your code before leaving.'));};
        request.onblocked=()=>reject(Error('Close other tabs to enable local recovery.'));
      });
      return DraftStore.connection;
    }
    async run(mode,action){
      const db=await this.db();
      return new Promise((resolve,reject)=>{
        const tx=db.transaction('drafts',mode),request=action(tx.objectStore('drafts'));
        tx.oncomplete=()=>resolve(request?.result);
        tx.onabort=tx.onerror=()=>reject(tx.error||Error('Local recovery could not be saved. Download your code before leaving.'));
      });
    }
    put(uid,id,data){return this.run('readwrite',s=>s.put({...data,key:JSON.stringify([uid,id,this.writer]),uid,id}));}
    remove(uid,id,mutationId){return this.run('readwrite',s=>{
      const key=JSON.stringify([uid,id,this.writer]);if(!mutationId)return s.delete(key);
      const r=s.get(key);r.onsuccess=()=>{if(r.result?.mutationId===mutationId)s.delete(key);};return r;
    });}
    async get(uid,id){return (await this.list(uid)).filter(r=>r.id===id).sort((a,b)=>b.modifiedAt-a.modifiedAt)[0];}
    async list(uid){return (await this.run('readonly',s=>s.getAll())).filter(r=>r.uid===uid);}
    async removeRecovered(record){
      // A different tab may still own this recovery record. Delete only the exact version recovered.
      return this.run('readwrite',s=>{const r=s.get(record.key);r.onsuccess=()=>{const current=r.result;if(current&&current.modifiedAt===record.modifiedAt&&current.mutationId===record.mutationId)s.delete(record.key);};return r;});
    }
    forRecovery(record){return {put:(...args)=>this.put(...args),remove:async(...args)=>{await this.remove(...args);await this.removeRecovered(record);}};}
  }
  root.CodeLibraryDrafts=DraftStore;
})(globalThis);
