/* Pure highlighting: source is always escaped and never executed. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./vendor/prism-code.js'));
  else root.CodeColors=factory(root.Prism);
})(typeof globalThis!=='undefined'?globalThis:this,function(Prism){
  const escape=text=>text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  function scan(source,language){
    const out=[];let i=0;
    while(i<source.length){
      const start=i,c=source[i],line=(language!=='python'&&source.startsWith('//',i))||(language==='python'&&c==='#'),block=language!=='python'&&source.startsWith('/*',i);
      if(line){out.push(' ');while(i<source.length&&source[i]!=='\n')i++;continue;}
      if(block){
        out.push(' ');i+=2;
        while(i<source.length&&!source.startsWith('*/',i)){if(source[i]==='\n')out.push('\n');i++;}
        if(i===source.length)return{masked:out.join(''),unfinishedAt:start,kind:'comment'};
        i+=2;continue;
      }
      if(c==='"'||c==="'"){
        const delimiter=source.startsWith(c.repeat(3),i)?c.repeat(3):c;out.push(' ');i+=delimiter.length;let closed=false;
        while(i<source.length){
          if(source[i]==='\\'){if(source[i+1]==='\n')out.push('\n');i+=Math.min(2,source.length-i);continue;}
          if(source.startsWith(delimiter,i)){i+=delimiter.length;closed=true;break;}
          if(source[i]==='\n')out.push('\n');i++;
        }
        if(!closed)return{masked:out.join(''),unfinishedAt:start,kind:'string'};
      }else out.push(source[i++]);
    }
    return{masked:out.join(''),unfinishedAt:null};
  }
  const mask=source=>scan(source).masked;
  function highlight(source,language){
    const name=language==='c'?'cpp':language,grammar=Prism?.languages[name];
    if(!grammar||source.length>100000)return escape(source);
    const lex=scan(source,language);
    const prefix=lex.unfinishedAt===null?source:source.slice(0,lex.unfinishedAt);
    const tail=lex.unfinishedAt===null?'':'<span class="token '+lex.kind+'">'+escape(source.slice(lex.unfinishedAt))+'</span>';
    try{return Prism.highlight(prefix,grammar,name)+tail;}catch(e){return escape(source);}
  }
  return{highlight,mask};
});
