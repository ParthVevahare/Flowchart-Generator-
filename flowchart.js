/* Statement AST -> control-flow graph. Coordinates never determine execution. */
(function(root,factory){
  const settings=typeof module==='object'&&module.exports?require('./diagram-settings.js'):root.DiagramSettings;
  const api=factory(settings);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.FlowGraph=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Settings){
  'use strict';
  const calls=tokens=>[...new Set((tokens||[]).filter((t,i,a)=>/^[A-Za-z_]\w*$/.test(t.t)&&a[i+1]?.t==='('&&a[i-1]?.t!=='new').map(t=>t.t))];
  // Only fold literal predicates. Evaluating arbitrary source would be unsafe
  // and could erase side effects or paths dependent on runtime state.
  function truth(text,language){
    const t=text.trim();
    if(t==='1'||t===(language==='python'?'True':'true'))return true;
    if(t==='0'||t===(language==='python'?'False':'false'))return false;
    return null;
  }
  function group(body){
    const out=[];
    for(const s of body){
      const prev=out[out.length-1];
      const simple=s.k==='p'&&!calls(s.q).length;
      if(simple&&prev?.k==='p'&&prev.grouped&&prev.statements.length<3&&(prev.t.length+s.t.length)<100){
        prev.t+='\n'+s.t;prev.statements.push(s);
      }else out.push({...s,grouped:simple,statements:[s]});
    }
    return out;
  }
  function buildFunction(f,program,isEntry,names,options){
    let serial=0;const nodes=[],edges=[];
    const add=(k,t,s={})=>{
      const n={id:'n'+serial++,k,t,line:s.l||f.l||1,calls:calls(s.q||s.ct),statements:s.statements||[s]};
      if(k==='p'&&n.calls.some(n=>names.has(n)))n.k='call';
      nodes.push(n);return n.id;
    };
    const edge=(source,target,label='',kind='flow')=>{
      if(!target)throw new Error('Missing control-flow destination');
      edges.push({id:'e'+edges.length,source,target,label,kind});
    };
    const exit=add('term',isEntry?'STOP':'RETURN');
    function decision(s){const id=add('dec',s.c,s),n=nodes[nodes.length-1];n.predicate=truth(s.c,program.lang);return id;}
    function branch(id,s,yes,no,kind='flow'){
      const v=truth(s.c,program.lang);
      if(v!==false)edge(id,yes,'Yes',kind);
      if(v!==true)edge(id,no,'No');
    }
    function sequence(body,after,ctx){
      const list=options.optimizeCommon?group(body):body;let next=after;
      for(let i=list.length-1;i>=0;i--){const s=list[i];
        if(s.k==='if'){
          const id=decision(s),yes=sequence(s.y,next,ctx),no=s.e?sequence(s.e,next,ctx):next;
          branch(id,s,yes,no);next=id;
        }else if(['for','while','do'].includes(s.k)){
          const id=decision(s);
          let update=id;
          if(s.k==='for'&&s.s){update=add('p',s.s,{l:s.l,q:s.stt});edge(update,id,'','back');}
          const body=sequence(s.b,update,{...ctx,breakTo:next,continueTo:update});
          // A do-loop enters its body before reaching its predicate.
          branch(id,s,body,next,'loop');
          if(s.k==='do')next=body;
          else{
            next=id;
            const init=s.i||(s.rf?'Iterate over '+s.rf[1]:null);
            if(init){const start=add('p',init,{l:s.l,q:s.it||s.rft?.[1]});edge(start,id);next=start;}
          }
        }else if(s.k==='sw'){
          const id=add('dec','switch ('+s.c+')',s);nodes[nodes.length-1].switch=true;
          const targets=[];let fallthrough=next;
          for(let j=s.cs.length-1;j>=0;j--){
            fallthrough=sequence(s.cs[j].b,fallthrough,{...ctx,breakTo:next});
            targets[j]=fallthrough;
          }
          s.cs.forEach((c,j)=>edge(id,targets[j],c.lab));
          if(!s.cs.some(c=>c.d))edge(id,next,'no match');
          next=id;
        }else{
          const k=s.k==='ret'?'ret':s.k;
          const id=add(k,s.t||(k==='brk'?'break':k==='cnt'?'continue':''),s);
          if(k==='ret')edge(id,exit,'','return');
          else if(k==='brk')edge(id,ctx.breakTo,'','break');
          else if(k==='cnt')edge(id,ctx.continueTo,'','continue');
          else edge(id,next);
          next=id;
        }
      }
      return next;
    }
    const globals=isEntry?(program.glob||[]).map((t,i)=>({k:'p',t:'(global) '+t,q:program.globq[i]})):[];
    const first=sequence(globals.concat(f.body),exit,{});
    const entry=add('term',isEntry?'START':'ENTER '+f.name+'()');edge(entry,first);
    const reachable=new Set(),todo=[entry],outgoing=new Map();
    edges.forEach(e=>{if(!outgoing.has(e.source))outgoing.set(e.source,[]);outgoing.get(e.source).push(e.target);});
    while(todo.length){const id=todo.pop();if(reachable.has(id))continue;reachable.add(id);todo.push(...(outgoing.get(id)||[]));}
    const graph={name:f.name,heading:f.disp||f.name+'('+f.params+')',isEntry,entry,exit:reachable.has(exit)?exit:null,
      nodes:nodes.filter(n=>reachable.has(n.id)).reverse(),edges:edges.filter(e=>reachable.has(e.source))};
    validate(graph);return graph;
  }
  function validate(graph){
    const ids=new Set(graph.nodes.map(n=>n.id));
    if(ids.size!==graph.nodes.length||!ids.has(graph.entry))throw new Error('Invalid graph node identity or entry');
    const out=new Map(graph.nodes.map(n=>[n.id,[]]));
    for(const e of graph.edges){
      if(!ids.has(e.source)||!ids.has(e.target))throw new Error('Invalid edge source or destination target');
      out.get(e.source).push(e);
    }
    for(const n of graph.nodes){
      const es=out.get(n.id);
      if(n.id===graph.exit){if(es.length)throw new Error('Terminal exit must not have a successor');continue;}
      if(n.k==='dec'){
        if(!n.switch){
          const labels=es.map(e=>e.label).sort().join(',');
          const expected=n.predicate===true?'Yes':n.predicate===false?'No':'No,Yes';
          if(labels!==expected)throw new Error('Decision outcomes do not match predicate');
        }else if(!es.length)throw new Error('Switch has no destinations');
      }else if(es.length!==1)throw new Error('Statement must have exactly one successor');
      if(n.k==='ret'&&es[0]?.target!==graph.exit)throw new Error('Return must target the function exit');
    }
    const seen=new Set(),todo=[graph.entry];
    while(todo.length){const id=todo.pop();if(seen.has(id))continue;seen.add(id);todo.push(...out.get(id).map(e=>e.target));}
    if(seen.size!==ids.size)throw new Error('Graph contains unreachable nodes');
    return graph;
  }
  function build(program,preferences){
    const options=Settings.normalize(preferences);
    const fns=program.fns,names=new Set(fns.map(f=>f.name));
    const entry=fns.find(f=>f.script)||(program.lang!=='python'&&fns.find(f=>f.name==='main'))||null;
    const ordered=entry?[entry,...fns.filter(f=>f!==entry)]:fns;
    return{entry:entry?.name||null,functions:ordered.map(f=>buildFunction(f,program,f===entry,names,options))};
  }
  function wrap(text,limit){
    const lines=[];
    for(const row of text.split('\n')){
      let rest=Array.from(row);
      while(rest.length>limit){
        let cut=rest.lastIndexOf(' ',limit);if(cut<limit/3)cut=limit;
        lines.push(rest.slice(0,cut).join(''));rest=rest.slice(cut);if(rest[0]===' ')rest.shift();
      }
      lines.push(rest.join(''));
    }
    return lines;
  }
  function geometry(n,options){
    const decision=n.k==='dec',io=n.k==='in'||n.k==='out',fontSize=options.fontSize;
    const lineHeight=17*fontSize/12.5,scale=fontSize/12.5;
    const lines=wrap(n.t,Math.max(12,Math.floor((decision?22:36)*options.widthScale)));
    // Fallback fonts can use a full em for CJK/emoji. Counting every glyph as
    // a narrow Latin monospace character lets translated strings escape nodes.
    const textWidth=Math.max(...lines.map(l=>Array.from(l).reduce((w,c)=>w+(c.codePointAt(0)>127?1.05:.65),0)))*fontSize;
    return{...n,lines,fontSize,lineHeight,
      width:decision?Math.max(172*options.widthScale,textWidth*2+36*scale):Math.max(130*options.widthScale,textWidth+(io?64:40)*scale),
      height:decision?Math.max(90*options.heightScale,lines.length*lineHeight*2+34*scale):Math.max(44*options.heightScale,lines.length*lineHeight+28*scale)};
  }
  let engine;
  async function layout(graph,preferences){
    validate(graph);
    const options=Settings.normalize(preferences);
    const ports={DOWN:{forward:'s',incoming:'n',branch:'e',back:'w'},UP:{forward:'n',incoming:'s',branch:'e',back:'w'},RIGHT:{forward:'e',incoming:'w',branch:'s',back:'n'},LEFT:{forward:'w',incoming:'e',branch:'s',back:'n'}}[options.direction];
    if(!engine){
      const ELKClass=typeof module==='object'&&module.exports?require('./vendor/elk.bundled.js'):globalThis.ELK;
      if(!ELKClass)throw new Error('The automatic layout engine could not load. Reload and try again.');
      engine=new ELKClass();
    }
    const nodes=graph.nodes.map(n=>geometry(n,options)),byId=new Map(nodes.map(n=>[n.id,n]));
    const outgoing=new Map(nodes.map(n=>[n.id,graph.edges.filter(e=>e.source===n.id)]));
    const active=new Set(),seen=new Set(),feedback=new Set();
    function visit(id){
      seen.add(id);active.add(id);
      for(const e of outgoing.get(id)){if(active.has(e.target))feedback.add(e.id);else if(!seen.has(e.target))visit(e.target);}
      active.delete(id);
    }
    visit(graph.entry);
    const children=nodes.map(n=>({id:n.id,width:n.width,height:n.height,
      layoutOptions:{'org.eclipse.elk.portConstraints':'FIXED_POS'},
      ports:[['n',n.width/2,0,'NORTH'],['s',n.width/2,n.height,'SOUTH'],['e',n.width,n.height/2,'EAST'],['w',0,n.height/2,'WEST']].map(([side,x,y,cardinal])=>({id:n.id+'_'+side,x,y,width:0,height:0,layoutOptions:{'org.eclipse.elk.port.side':cardinal}}))}));
    const edges=graph.edges.map(e=>{
      const back=feedback.has(e.id),n=byId.get(e.source);
      const from=back?ports.back:n.k==='dec'&&e.label==='No'?ports.branch:ports.forward;
      const label=Settings.displayLabel(e,options),labelSize=Math.max(10.5,options.fontSize*.84);
      // Reverse only the layout representation of DFS feedback edges. This
      // gives ELK an acyclic forward graph, keeping the entry above the body.
      // Reverse the routed points again below; semantic edges never change.
      return{id:e.id,sources:[back?e.target+'_'+(e.source===e.target?ports.incoming:ports.back):e.source+'_'+from],targets:[back?e.source+'_'+ports.back:e.target+'_'+ports.incoming],
        ...(label?{labels:[{id:e.id+'_label',text:label,width:Math.max(32,Array.from(label).length*labelSize+16),height:labelSize+12}]}:{})};
    });
    const result=await engine.layout({id:'root',layoutOptions:{
      'elk.algorithm':'layered','elk.direction':options.direction,'elk.edgeRouting':'ORTHOGONAL',
      'elk.padding':'[top=20,left=24,bottom=20,right=24]',
      'elk.spacing.nodeNode':String(options.compact?22:36),'elk.layered.spacing.nodeNodeBetweenLayers':String(options.compact?28:48),
      'elk.spacing.edgeNode':'18','elk.spacing.edgeEdge':'12',
      'elk.layered.considerModelOrder.strategy':'NODES_AND_EDGES',
      'elk.layered.nodePlacement.bk.fixedAlignment':'BALANCED',
      'elk.randomSeed':'7'
    },children,edges});
    const placed=result.children.map(n=>({...byId.get(n.id),x:n.x,y:n.y}));
    const routed=result.edges.map((e,i)=>{
      const s=e.sections?.[0];if(!s)throw new Error('Layout engine did not route an execution path');
      const points=[s.startPoint,...(s.bendPoints||[]),s.endPoint];
      if(feedback.has(e.id))points.reverse();
      return{...graph.edges[i],displayLabel:Settings.displayLabel(graph.edges[i],options),feedback:feedback.has(e.id),points,labelPosition:e.labels?.[0]};
    });
    return{...graph,width:result.width,height:result.height,nodes:placed,edges:routed};
  }
  function diagramFrame(width,height){
    const margin=24;
    return{width:Math.ceil(width)+2*margin,height:Math.ceil(height)+2*margin,scale:1,x:margin,y:margin};
  }
  return{build,validate,calls,layout,diagramFrame,settings:Settings};
});


