/* Cloud library is an additive layer; parser and renderer remain in index.html. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id),core=CodeLibrary,drafts=new CodeLibraryDrafts();
  const names={auto:'Auto-detect',c:'C / C++',python:'Python',java:'Java'};
  let client=null,user=null,session=null,rows=[],page=0,epoch=0,busy=false,loading=false,ready=false,guestWrites=Promise.resolve(),guestPending=0;
  let guestRecovery=null,guest={title:'Untitled program',language:$('lang').value,sourceCode:$('ta').value,description:'',tags:[],favorite:false,deleted:false};
  function message(text,error=false){$('library-message').textContent=text;$('library-message').dataset.error=String(error);}
  function showPanel(open){$('library-panel').hidden=!open;$('library-toggle').setAttribute('aria-expanded',String(open));if(open)$('library-close').focus();}
  function status(state,error){
    const text={pending:'Unsaved changes',saving:'Saving to cloud…',saved:'Saved to cloud',conflict:'Conflict: '+(error?.message||'Save your draft as a new program.'),'local-error':'Local recovery failed: '+error?.message,error:'Not saved: '+(error?.message||'Try Save now when connected.')};
    $('cloud-status').textContent=text[state]||state;$('cloud-status').dataset.error=String(['error','conflict','local-error'].includes(state));
  }
  function editorData(){return {title:$('program-title').value,language:$('lang').value,sourceCode:$('ta').value,description:$('program-description').value,tags:$('program-tags').value.split(',').map(t=>t.trim()).filter(Boolean),favorite:$('program-favorite').checked,deleted:false};}
  function setEditor(d){
    $('ta').value=d.sourceCode;$('lang').value=d.language;$('program-title').value=d.title;
    $('program-description').value=d.description;$('program-tags').value=(d.tags||[]).join(', ');$('program-favorite').checked=d.favorite;
    clearReset();clearError();gut();invalidate('Program opened. Generate to update.');
  }
  function rememberGuest(){
    guest={...guest,sourceCode:$('ta').value,language:$('lang').value};const value={data:{...guest},modifiedAt:Date.now()};
    guestPending++;guestWrites=guestWrites.catch(()=>{}).then(async()=>{await drafts.put('guest','draft',value);if(guestRecovery){await drafts.removeRecovered(guestRecovery);guestRecovery=null;}}).catch(e=>message(e.message,true)).finally(()=>guestPending--);
  }
  function changed(){if(session)session.edit(editorData());else rememberGuest();}
  function lock(value){
    busy=value;$('ta').readOnly=value;
    for(const id of ['lang','exs','rs','program-title','program-description','program-tags','program-favorite'])$(id).disabled=value;
    for(const el of document.querySelectorAll('[data-busy-control]'))el.disabled=value||el.dataset.unavailable==='true';
    $('signup-updates').disabled=value;
    $('library-panel').setAttribute('aria-busy',String(value));
  }
  async function action(fn){
    if(busy)return;const token=epoch;lock(true);
    try{await fn(token);}catch(e){if(token===epoch){message(e.message||'The request failed. Please try again.',true);if(session)status(e.code==='conflict'?'conflict':'error',e);}}
    finally{if(token===epoch)lock(false);}
  }
  async function flush(){if(session)await session.flush();else await guestWrites;}
  function updateRow(d){const i=rows.findIndex(r=>r.id===d.id);const {sourceCode,...metadata}=d;if(i<0)rows.push(metadata);else rows[i]=metadata;render();}
  function attach(d,recovery=null){
    session?.close();const token=epoch,journal=new CodeLibraryDrafts();
    session=new core.SaveSession({uid:user.uid,id:d.id,data:recovery?.data||d,revision:recovery?.revision??d.revision,mutationId:recovery?.mutationId,recovered:!!recovery,store:client.store,drafts:recovery?journal.forRecovery(recovery):journal,
      onStatus:(s,e)=>{if(token===epoch)status(s,e);},onSaved:record=>{if(token===epoch){updateRow(record);renderRecovery(token).catch(e=>message(e.message,true));}}});
    setEditor(session.data);$('cloud-editor').hidden=false;
    status(recovery?'Recovered local draft. Save now to sync.':'saved');showPanel(false);$('program-title').focus();
  }
  async function openProgram(id,token){
    if(!ready)return;await flush();if(token!==epoch)return;
    const recovery=await drafts.get(user.uid,id);if(token!==epoch)return;
    const d=recovery?{id,...recovery.data,revision:recovery.revision}:await client.store.open(user.uid,id);
    if(token!==epoch)return;if(d.deleted)throw Error('Restore this program from Trash before opening it.');attach(d,recovery);
  }
  async function createProgram(data,token,asCopy=false){
    if(!ready)throw Error('Sign in before saving to your library.');
    const old=session;
    if(!asCopy)await flush();else if(old){clearTimeout(old.timer);if(old.saving)await old.saving.catch(()=>{});await old.persist();}
    if(token!==epoch)return;
    const id=client.store.newId(user.uid),d=core.validate({...data,deleted:false});
    const created=new core.SaveSession({uid:user.uid,id,data:d,revision:0,store:client.store,drafts:new CodeLibraryDrafts()});
    try{await created.flush();}catch(e){created.close();await renderRecovery(token);throw e;}
    if(token!==epoch){created.close();return;}
    const row={...d,id,revision:created.revision,createdAt:Date.now(),updatedAt:Date.now()};created.close();
    let cleanupFailed=false;
    if(asCopy&&old){await old.journal.catch(()=>{});try{await old.drafts.remove(old.uid,old.id,old.operation?.id);}catch{cleanupFailed=true;}}
    if(token!==epoch)return;
    updateRow(row);attach(row);message(cleanupFailed?'Program saved. The older local recovery draft could not be removed.':'Program saved.');
  }
  function button(text,label,fn,cls='',symbol=''){
    const b=document.createElement('button');b.textContent=text;b.setAttribute('aria-label',label);b.title=label;b.className=cls;b.dataset.busyControl='';b.disabled=busy;b.onclick=()=>action(fn);
    if(symbol){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),use=document.createElementNS('http://www.w3.org/2000/svg','use');svg.setAttribute('class','icon');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');use.setAttribute('href','#icon-'+symbol);svg.append(use);b.replaceChildren(svg);b.classList.add('icon-only');}
    return b;
  }
  function render(){
    $('library-list').replaceChildren();
    if(!ready){$('library-count').textContent='Your personal code library';$('library-pagination').hidden=true;$('library-empty').hidden=true;return;}
    const filterCount=Number(!!$('library-language').value)+Number($('library-favorites').checked)+Number($('library-trash').checked)+Number($('library-sort').value!=='updated-desc');
    $('library-filter-label').textContent='Filters & sort'+(filterCount?' · '+filterCount+' active':'');
    const visible=core.selectPrograms(rows,{search:$('library-search').value,language:$('library-language').value,favorites:$('library-favorites').checked,trash:$('library-trash').checked,sort:$('library-sort').value});
    const count=rows.filter(r=>!r.deleted).length,trash=rows.length-count;
    $('library-count').textContent=count+' programs'+(trash?' · '+trash+' in Trash':'')+(loading?' · loading…':'');
    page=Math.min(page,Math.max(0,Math.ceil(visible.length/25)-1));
    $('library-empty').hidden=visible.length>0||loading||!ready;
    $('library-empty').textContent=rows.length?'No programs match these filters.':'Your library is empty. Create a program or save the code in your editor.';
    for(const d of visible.slice(page*25,page*25+25)){
      const row=document.createElement('div');row.className='library-row';
      const title=button(d.title,(d.deleted?'View ':'Open ')+d.title,token=>openProgram(d.id,token),'library-open');title.dataset.unavailable=String(d.deleted);title.disabled=busy||d.deleted;row.append(title);
      const favorite=button('','Toggle favorite for '+d.title,token=>mutate(d,{favorite:!d.favorite},token),'favorite-button','star');favorite.setAttribute('aria-pressed',String(d.favorite));row.append(favorite);
      const info=document.createElement('small');const stamp=typeof d.updatedAt?.toMillis==='function'?d.updatedAt.toMillis():Number(d.updatedAt);
      info.textContent=(names[d.language]||d.language)+' · '+(stamp?new Date(stamp).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'Just saved')+(d.tags?.length?' · '+d.tags.join(', '):'');row.append(info);
      const actions=document.createElement('div');actions.className='library-row-actions';
      if(d.deleted)actions.append(button('','Restore '+d.title,token=>mutate(d,{deleted:false},token),'','reset'));
      else{
        actions.append(button('','Duplicate '+d.title,async token=>{await flush();if(token!==epoch)return;const source=await client.store.open(user.uid,d.id);if(token===epoch)await createProgram({...source,title:source.title.slice(0,113)+' (copy)'},token);},'','copy'));
        actions.append(button('','Move '+d.title+' to Trash',async token=>{if(confirm('Move “'+d.title+'” to Trash? You can restore it later.'))await mutate(d,{deleted:true},token);},'','trash'));
      }
      row.append(actions);$('library-list').append(row);
    }
    $('library-pagination').hidden=!visible.length;$('library-prev').disabled=page===0;$('library-next').disabled=(page+1)*25>=visible.length;
    $('library-page').textContent=(page*25+1)+'–'+Math.min((page+1)*25,visible.length)+' of '+visible.length;
  }
  async function mutate(d,patch,token){
    await flush();if(token!==epoch)return;
    const current=await client.store.open(user.uid,d.id);if(token!==epoch)return;
    const value={...current,...patch},result=await client.store.save(user.uid,d.id,value,current.revision,crypto.randomUUID());
    if(token!==epoch)return;updateRow({...value,...result});
    if(session?.id===d.id){
      if(patch.deleted){session.close();session=null;$('cloud-editor').hidden=true;setEditor(guest);}
      else{const wasOpen=!$('library-panel').hidden;attach({...value,...result});if(wasOpen)showPanel(true);}
    }
  }
  async function renderRecovery(token){
    if(!user)return;const entries=await drafts.list(user.uid);if(token!==epoch)return;
    $('library-recovery').replaceChildren();
    const pending=entries.filter(d=>d.id!==session?.id);if(!pending.length)return;
    const p=document.createElement('p');p.textContent='Unsynced drafts on this device';$('library-recovery').append(p);
    for(const d of pending)$('library-recovery').append(button('Recover '+d.data.title,'Recover '+d.data.title,async token=>{await flush();if(token===epoch)attach({id:d.id,...d.data,revision:d.revision},d);}));
  }
  async function refresh(token){
    if(!ready)return;loading=true;render();let cursor=null;const fetched=[];
    try{
      do{
        const chunk=await client.store.listPage(user.uid,cursor);if(token!==epoch)return;
        fetched.push(...chunk.rows);rows=[...fetched];cursor=chunk.cursor;render();
      }while(cursor);
      message('');
    }finally{if(token===epoch){loading=false;render();await renderRecovery(token);}}
  }
  async function authChanged(next){
    const clearPrivate=!!user||!!session,token=++epoch;session?.close();session=null;user=next;ready=false;rows=[];loading=false;lock(false);
    $('cloud-editor').hidden=true;$('library-recovery').replaceChildren();$('library-list').replaceChildren();if(clearPrivate)setEditor(guest);
    $('cloud-login').hidden=!!user;$('cloud-account').hidden=!user;$('cloud-signup').hidden=true;$('library-controls').hidden=true;render();
    if(!user){message('');return;}
    $('account-email').textContent=user.email||'Signed in';showPanel(true);message('Loading your account…');lock(true);
    try{
      const profile=await client.store.readProfile(user.uid);if(token!==epoch)return;
      if(!profile){$('signup-updates').checked=true;$('cloud-signup').hidden=false;message('');return;}
      ready=true;$('library-controls').hidden=false;await refresh(token);
    }catch(e){if(token===epoch)message('Could not load your account. '+e.message+' Sign out and try again.',true);}
    finally{if(token===epoch)lock(false);}
  }
  function download(){
    const d=session?editorData():guest,ext={python:'py',java:'java',c:'cpp',auto:'txt'}[d.language];
    const a=document.createElement('a'),url=URL.createObjectURL(new Blob([d.sourceCode],{type:'text/plain;charset=utf-8'}));a.href=url;a.download=(d.title.replace(/[^\p{L}\p{N} _-]/gu,'_').trim()||'program')+'.'+ext;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  $('library-toggle').onclick=()=>showPanel($('library-panel').hidden);
  $('library-close').onclick=()=>{showPanel(false);$('library-toggle').focus();};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('library-panel').hidden){showPanel(false);$('library-toggle').focus();}});
  $('cloud-signin').onclick=()=>action(async()=>{await guestWrites;await client.signIn();});
  $('cloud-signout').onclick=()=>action(async token=>{await flush();if(token===epoch)await client.signOut();});
  $('cloud-create').onclick=()=>action(async token=>{
    if(!user)return;
    await client.store.profile(user,$('signup-updates').checked);if(token!==epoch)return;
    $('cloud-signup').hidden=true;ready=true;$('library-controls').hidden=false;await refresh(token);
  });
  $('program-new').onclick=()=>action(token=>createProgram({title:'Untitled program',language:$('lang').value,sourceCode:'',description:'',tags:[],favorite:false,deleted:false},token));
  $('program-import').onclick=()=>action(token=>createProgram(session?{...editorData(),title:editorData().title.slice(0,113)+' (copy)'}:guest,token));
  $('program-copy').onclick=()=>action(token=>createProgram({...editorData(),title:$('program-title').value.slice(0,113)+' (copy)'},token,true));
  $('program-save').onclick=()=>action(flush);$('program-download').onclick=download;
  $('program-clipboard').onclick=()=>{navigator.clipboard.writeText($('ta').value).then(()=>status('Code copied'),e=>status('error',e));};
  $('program-reload').onclick=()=>action(async token=>{
    if(!session||!confirm('Discard your local edits and reload the cloud version? Use Save as new first if you want to keep both versions.'))return;
    const current=session,id=current.id;clearTimeout(current.timer);if(current.saving)await current.saving.catch(()=>{});if(token!==epoch)return;
    const d=await client.store.open(current.uid,id);if(token!==epoch)return;
    await current.journal.catch(()=>{});if(token!==epoch)return;
    await current.drafts.remove(current.uid,id,current.operation?.id);if(token===epoch)attach(d);
  });
  $('library-refresh').onclick=()=>action(async token=>{await flush();await refresh(token);});
  for(const id of ['library-search','library-language','library-sort','library-favorites','library-trash'])$(id).addEventListener('input',()=>{page=0;render();});
  $('library-prev').onclick=()=>{page--;render();};$('library-next').onclick=()=>{page++;render();};
  for(const id of ['program-title','program-description','program-tags','program-favorite','ta'])$(id).addEventListener('input',changed);
  $('lang').addEventListener('change',changed);$('exs').addEventListener('change',changed);$('rs').addEventListener('click',changed);
  $('ta').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z')queueMicrotask(changed);});
  window.addEventListener('beforeunload',e=>{if(session?.dirty||session?.saving||guestPending){e.preventDefault();e.returnValue='';}});
  window.addEventListener('online',()=>{if(session?.dirty)session.flush().catch(()=>{});});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&session?.dirty)session.persist().catch(()=>{});});
  async function start(){
    try{const saved=await drafts.get('guest','draft');if(saved&&!guestPending){guestRecovery=saved;guest=saved.data;setEditor(guest);}}catch(e){message(e.message,true);}
    const config=window.FLOWCHART_FIREBASE_CONFIG;
    if(!config||!['apiKey','authDomain','projectId','appId'].every(k=>typeof config[k]==='string'&&config[k].trim())){message('Cloud setup is still in progress. The flowchart generator works now; Google Sign-In will be available after Firebase setup.');return;}
    try{const module=await import('./firebase-client.mjs');client=module.connect(config);$('cloud-signin').disabled=false;client.watch(authChanged);}
    catch(e){message('Google Sign-In could not load. Check your connection, then refresh. '+e.message,true);}
  }
  start();
})();
