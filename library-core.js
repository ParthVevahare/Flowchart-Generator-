(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CodeLibrary=api;})(globalThis,()=>{
  'use strict';
  const MAX_SOURCE=180000;
  const languages=['auto','c','python','java'];
  const fields=['title','language','sourceCode','description','tags','favorite','deleted'];
  const copy=d=>Object.fromEntries(fields.map(k=>[k,Array.isArray(d[k])?[...d[k]]:d[k]]));
  const fingerprint=d=>JSON.stringify(copy(d));
  function validate(input){
    const d=copy(input);
    if(typeof d.title!=='string'||!d.title.trim()||d.title.length>120)throw Error('Enter a title between 1 and 120 characters.');
    if(!languages.includes(d.language))throw Error('Choose a supported language.');
    if(typeof d.sourceCode!=='string'||d.sourceCode.length>MAX_SOURCE)throw Error('Programs can contain up to 180,000 characters. Download your code before shortening it.');
    if(typeof d.description!=='string'||d.description.length>2000)throw Error('Descriptions can contain up to 2,000 characters.');
    if(!Array.isArray(d.tags)||d.tags.length>10||d.tags.some(t=>typeof t!=='string'||!t.trim()||t.length>40))throw Error('Use up to 10 tags, each between 1 and 40 characters.');
    if(typeof d.favorite!=='boolean'||typeof d.deleted!=='boolean')throw Error('Invalid program settings.');
    return d;
  }
  const millis=t=>typeof t?.toMillis==='function'?t.toMillis():Number(t)||0;
  function selectPrograms(rows,{search='',language='',favorites=false,trash=false,sort='updated-desc'}={}){
    const q=search.trim().toLocaleLowerCase();
    return rows.filter(d=>!!d.deleted===trash&&(!language||d.language===language)&&(!favorites||d.favorite)&&(!q||[d.title,d.description,...(d.tags||[])].join(' ').toLocaleLowerCase().includes(q))).sort((a,b)=>{
      let n=sort==='name-asc'?a.title.localeCompare(b.title):sort==='name-desc'?b.title.localeCompare(a.title):sort==='updated-asc'?millis(a.updatedAt)-millis(b.updatedAt):sort==='created-desc'?millis(b.createdAt)-millis(a.createdAt):millis(b.updatedAt)-millis(a.updatedAt);
      return n||a.id.localeCompare(b.id);
    });
  }
  class SaveSession{
    constructor({uid,id,data,revision=0,store,drafts,onStatus=()=>{},onSaved=()=>{},delay=1500,mutationId=null,recovered=false}){
      Object.assign(this,{uid,id,revision,store,drafts,onStatus,onSaved,delay});
      this.data=copy(data);this.baseline=revision&&!recovered?fingerprint(data):null;
      this.closed=false;this.timer=null;this.saving=null;this.journal=Promise.resolve();
      this.operation=mutationId?{fingerprint:fingerprint(data),id:mutationId}:null;
    }
    get dirty(){return fingerprint(this.data)!==this.baseline;}
    status(s,e){if(!this.closed)this.onStatus(s,e);}
    persist(){
      const fp=fingerprint(this.data);
      if(!this.operation||this.operation.fingerprint!==fp)this.operation={fingerprint:fp,id:globalThis.crypto.randomUUID()};
      const record={data:copy(this.data),revision:this.revision,mutationId:this.operation.id,modifiedAt:Date.now()};
      this.journal=this.journal.catch(()=>{}).then(()=>this.drafts.put(this.uid,this.id,record));
      // Keep rejection observable to flush while avoiding an unhandled rejection on input.
      this.journal.catch(e=>this.status('local-error',e));return this.journal;
    }
    edit(data){
      if(this.closed)return;
      if(fingerprint(data)===fingerprint(this.data))return;
      this.data=copy(data);clearTimeout(this.timer);this.persist();
      this.status(this.dirty||this.saving?'pending':'saved');
      if(this.dirty)this.timer=setTimeout(()=>this.flush().catch(()=>{}),this.delay);
    }
    async flush(){
      if(this.closed)throw Error('This editing session is closed.');
      clearTimeout(this.timer);
      if(this.saving)return this.saving;
      this.saving=this.drain();
      try{return await this.saving;}finally{this.saving=null;}
    }
    async drain(){
      try{
        while(this.dirty&&!this.closed){
          const snapshot=validate(this.data),fp=fingerprint(snapshot);
          await this.persist();
          if(this.closed)return;
          // persist can overlap newer input; bind the transaction to its own snapshot.
          const mutation=this.operation.fingerprint===fp?this.operation.id:globalThis.crypto.randomUUID();
          this.status('saving');
          const result=await this.store.save(this.uid,this.id,snapshot,this.revision,mutation);
          // An account change may have opened a new session for the same program.
          // Its journal must not be touched by this closed session's late acknowledgement.
          if(this.closed)return;
          this.revision=result.revision;this.baseline=fp;
          if(this.dirty){await this.persist();}else{
            // Order removal after every queued journal write, including those made during the save.
            this.journal=this.journal.catch(()=>{}).then(()=>this.closed?undefined:this.drafts.remove(this.uid,this.id,mutation));await this.journal;
          }
          if(!this.closed)this.onSaved({...snapshot,...result,id:this.id});
        }
        if(!this.dirty)this.status('saved');
      }catch(e){this.status(e.code==='conflict'?'conflict':'error',e);throw e;}
    }
    close(){this.closed=true;clearTimeout(this.timer);}
  }
  return {MAX_SOURCE,languages,validate,selectPrograms,SaveSession};
});
