/* Versioned browser preferences. These never contain source or account data. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;else root.DiagramSettings=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const key='flowchart:diagram-settings:v1';
  const defaults=Object.freeze({trueLabel:'Yes',falseLabel:'No',optimizeCommon:true,decorateLabels:true,
    theme:'classic',widthScale:1,heightScale:1,direction:'DOWN',fontSize:12.5,compact:false});
  const palettes=Object.freeze({
    classic:{background:'#ffffff',panel:'#fafbff',border:'#e2e8f0',text:'#0f172a',muted:'#475569',edge:'#64748b',pill:'#ffffff',pillBorder:'#cbd5e1',
      start:['#edf6f0','#82a68e'],stop:['#f0f2f6','#9ca7b8'],p:['#eef3fa','#8ca6c9'],call:['#efedfb','#8d82ce'],io:['#eef7f5','#80aaa0'],dec:['#faf5e9','#c5ad76'],ret:['#f6f3ee','#b8a78c'],jump:['#f1f3f6','#9ba7b8']},
    ocean:{background:'#f4faff',panel:'#ffffff',border:'#bfd9ed',text:'#123247',muted:'#3c5e76',edge:'#446c89',pill:'#e5f4ff',pillBorder:'#8ab9d8',
      start:['#d8f4eb','#388678'],stop:['#e0eaf4','#6785a1'],p:['#e5f3ff','#528ab4'],call:['#e9e9ff','#8276b8'],io:['#ddf6fa','#448997'],dec:['#fff3d9','#b58a3c'],ret:['#e4edf9','#6384ab'],jump:['#edf2f8','#8396aa']},
    forest:{background:'#f5faf6',panel:'#ffffff',border:'#c5ddcb',text:'#193c2a',muted:'#42654d',edge:'#50785c',pill:'#e9f5ec',pillBorder:'#8eb99a',
      start:['#d9f1df','#4b8c5b'],stop:['#e5ece7','#819b88'],p:['#e9f4df','#85a36a'],call:['#f1edda','#aa9855'],io:['#dff2ed','#64a38c'],dec:['#fff3d6','#b09a50'],ret:['#ede9db','#a49a7a'],jump:['#e9efe7','#8f9f88']},
    monochrome:{background:'#ffffff',panel:'#ffffff',border:'#cbd5e1',text:'#111827',muted:'#475569',edge:'#475569',pill:'#ffffff',pillBorder:'#64748b',
      start:['#f1f5f9','#475569'],stop:['#f1f5f9','#475569'],p:['#ffffff','#475569'],call:['#ffffff','#475569'],io:['#ffffff','#475569'],dec:['#f1f5f9','#475569'],ret:['#ffffff','#475569'],jump:['#ffffff','#475569']},
    dark:{background:'#111827',panel:'#192435',border:'#40516b',text:'#f1f5f9',muted:'#bdcce0',edge:'#b0c3dd',pill:'#26354b',pillBorder:'#6f87a7',
      start:['#204c3e','#7cb99c'],stop:['#303e56','#8da8cd'],p:['#253d58','#7fa9d1'],call:['#3e325a','#b0a0d6'],io:['#214a4e','#7bb5b7'],dec:['#514328','#d1b771'],ret:['#4c3d32','#c2a285'],jump:['#334155','#9eafc6']}
  });
  function normalize(value){
    const v=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
    const number=(name,min,max)=>{const n=typeof v[name]==='number'||typeof v[name]==='string'&&v[name].trim()!==''?Number(v[name]):NaN;return Number.isFinite(n)?Math.min(max,Math.max(min,n)):defaults[name];};
    const label=name=>typeof v[name]==='string'?Array.from(v[name].replace(/[\u0000-\u001f\u007f]/g,' ').trim()).slice(0,40).join('')||defaults[name]:defaults[name];
    return {trueLabel:label('trueLabel'),falseLabel:label('falseLabel'),
      optimizeCommon:typeof v.optimizeCommon==='boolean'?v.optimizeCommon:defaults.optimizeCommon,
      decorateLabels:typeof v.decorateLabels==='boolean'?v.decorateLabels:defaults.decorateLabels,
      theme:Object.hasOwn(palettes,v.theme)?v.theme:defaults.theme,
      widthScale:number('widthScale',.7,2),heightScale:number('heightScale',.7,2),
      direction:['DOWN','UP','RIGHT','LEFT'].includes(v.direction)?v.direction:defaults.direction,
      fontSize:number('fontSize',10,24),compact:typeof v.compact==='boolean'?v.compact:defaults.compact};
  }
  function load(storage){try{return normalize(JSON.parse(storage.getItem(key)));}catch(e){return normalize(null);}}
  function save(storage,value){try{storage.setItem(key,JSON.stringify(normalize(value)));return true;}catch(e){return false;}}
  function displayLabel(edge,options){return edge.label==='Yes'?options.trueLabel:edge.label==='No'?options.falseLabel:edge.label;}
  return {defaults,palettes,normalize,load,save,displayLabel};
});
