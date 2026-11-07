/* Native dialog provides focus containment, Escape and accessible naming. */
(()=>{
  const dialog=document.getElementById('how-to-use'),open=document.getElementById('help-open');
  const next=document.getElementById('help-next'),back=document.getElementById('help-back');
  let step=0,startEditing=false;
  function render(){
    for(let i=0;i<3;i++)document.getElementById('help-step-'+i).hidden=i!==step;
    document.getElementById('help-progress').textContent='Step '+(step+1)+' of 3';
    back.disabled=step===0;next.textContent=step===2?'Start creating':'Next';
  }
  open.addEventListener('click',()=>{step=0;startEditing=false;render();dialog.showModal();document.documentElement.classList.add('help-open');next.focus();});
  back.addEventListener('click',()=>{if(step>0){step--;render();}});
  next.addEventListener('click',()=>{if(step<2){step++;render();}else{startEditing=true;dialog.close();}});
  document.getElementById('help-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
  dialog.addEventListener('close',()=>{document.documentElement.classList.remove('help-open');(startEditing?document.getElementById('ta'):open).focus();});
})();
