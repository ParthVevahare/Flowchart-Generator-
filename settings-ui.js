/* Staged preferences: Cancel/Escape discard the draft, Apply commits once. */
(()=>{
  'use strict';
  const dialog=document.getElementById('diagram-settings'),form=document.getElementById('diagram-settings-form');
  const opener=document.getElementById('diagram-settings-open'),error=document.getElementById('settings-error');
  const fields=Object.keys(DiagramSettings.defaults);
  const control=name=>document.getElementById('setting-'+name);
  function populate(value){
    fields.forEach(name=>{const input=control(name);if(input.type==='checkbox')input.checked=value[name];else input.value=value[name];input.removeAttribute('aria-invalid');});
    error.hidden=true;error.textContent='';
  }
  opener.addEventListener('click',()=>{
    closeExport();populate(diagramPreferences);dialog.showModal();opener.setAttribute('aria-expanded','true');
  });
  dialog.addEventListener('close',()=>{opener.setAttribute('aria-expanded','false');opener.focus();});
  document.getElementById('settings-close').addEventListener('click',()=>dialog.close());
  document.getElementById('settings-cancel').addEventListener('click',()=>dialog.close());
  document.getElementById('settings-reset').addEventListener('click',()=>populate(DiagramSettings.defaults));
  form.addEventListener('input',event=>{event.target.removeAttribute('aria-invalid');error.hidden=true;});
  form.addEventListener('submit',event=>{
    event.preventDefault();
    const values={};let invalid=null;
    fields.forEach(name=>{
      const input=control(name);values[name]=input.type==='checkbox'?input.checked:input.value;
      if(input.type==='number'){
        const n=Number(input.value);
        if(input.value.trim()===''||!Number.isFinite(n)||n<Number(input.min)||n>Number(input.max)){
          input.setAttribute('aria-invalid','true');if(!invalid)invalid=input;
        }
      }
    });
    if(invalid){error.textContent='Enter '+invalid.labels[0].querySelector('span').textContent.toLowerCase()+' between '+invalid.min+' and '+invalid.max+'.';error.hidden=false;invalid.focus();return;}
    const regenerate=charts.length>0||document.getElementById('go').getAttribute('aria-busy')==='true';
    diagramPreferences=DiagramSettings.normalize(values);
    let saved=false;try{saved=DiagramSettings.save(localStorage,diagramPreferences);}catch(e){}
    dialog.close();
    if(regenerate)gen();
    toast(saved?'Diagram settings applied.': 'Settings applied for this visit; preferences could not be saved in this browser.');
  });
})();
