(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./library-core.js'):root.CodeLibrary);if(typeof module==='object'&&module.exports)module.exports=api;else root.CodeLibraryStore=api;})(globalThis,core=>{
  'use strict';
  function createStore(db,s){
    const ref=(uid,id)=>s.doc(db,'users',uid,'codes',id);
    const body=(uid,id)=>s.doc(db,'users',uid,'codes',id,'content','source');
    const conflict=()=>Object.assign(Error('This program changed on another device. Your draft is safe. Save a separate copy or reload the cloud version.'),{code:'conflict'});
    return {
      newId(uid){return s.doc(s.collection(db,'users',uid,'codes')).id;},
      async listPage(uid,cursor=null){
        const constraints=[s.orderBy(s.documentId()),s.limit(100)];if(cursor)constraints.push(s.startAfter(cursor));
        const snap=await s.getDocsFromServer(s.query(s.collection(db,'users',uid,'codes'),...constraints));
        return {rows:snap.docs.map(d=>({id:d.id,...d.data()})),cursor:snap.size===100?snap.docs.at(-1).id:null};
      },
      async open(uid,id){
        return s.runTransaction(db,async tx=>{
          const meta=await tx.get(ref(uid,id)),source=await tx.get(body(uid,id));
          if(!meta.exists()||!source.exists())throw Error('This program is unavailable. Refresh the library and try again.');
          if(meta.data().revision!==source.data().revision)throw Error('Program data is inconsistent. Please contact the site owner.');
          return {id,...meta.data(),sourceCode:source.data().sourceCode};
        });
      },
      async save(uid,id,input,expectedRevision,mutationId){
        const data=core.validate(input);
        return s.runTransaction(db,async tx=>{
          const target=ref(uid,id),snapshot=await tx.get(target),previous=snapshot.exists()?snapshot.data():null;
          if(previous?.mutationId===mutationId)return {revision:previous.revision,createdAt:previous.createdAt,updatedAt:previous.updatedAt};
          if((previous?.revision||0)!==expectedRevision)throw conflict();
          const revision=expectedRevision+1,stamp=s.serverTimestamp();
          const {sourceCode,...metadata}=data;
          tx.set(target,{...metadata,revision,mutationId,createdAt:previous?.createdAt||stamp,updatedAt:stamp});
          tx.set(body(uid,id),{sourceCode,revision,mutationId,updatedAt:stamp});
          return {revision,createdAt:previous?.createdAt||Date.now(),updatedAt:Date.now()};
        });
      },
      async readProfile(uid){
        const snap=await s.getDocFromServer(s.doc(db,'users',uid));
        return snap.exists()?snap.data():null;
      },
      async profile(user,emailUpdates){
        return s.runTransaction(db,async tx=>{
          const target=s.doc(db,'users',user.uid),snap=await tx.get(target);
          if(snap.exists())return snap.data();
          const profile={email:user.email||'',displayName:(user.displayName||'').slice(0,120),emailUpdates:!!emailUpdates,createdAt:s.serverTimestamp(),updatedAt:s.serverTimestamp(),consentUpdatedAt:s.serverTimestamp()};
          tx.set(target,profile);return profile;
        });
      },
      async preference(user,emailUpdates){
        await s.updateDoc(s.doc(db,'users',user.uid),{emailUpdates:!!emailUpdates,updatedAt:s.serverTimestamp(),consentUpdatedAt:s.serverTimestamp()});
      }
    };
  }
  return {createStore};
});
