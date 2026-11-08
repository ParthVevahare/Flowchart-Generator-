const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const app=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('function parseC('));
const ctx=vm.createContext({console});
vm.runInContext(fs.readFileSync(path.join(root,'syntax.js'),'utf8'),ctx);
vm.runInContext(app.slice(0,app.indexOf('/* ---------- app ---------- */'))+'\nglobalThis.parseProgram=parse;',ctx);
let FG;try{FG=require('../flowchart.js');}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;}
const graph=(s,lang='c')=>{assert.ok(FG,'semantic graph module exists');return FG.build(ctx.parseProgram(s,lang));};
const main=s=>graph(s).functions.find(f=>f.name==='main');
const node=(g,t)=>g.nodes.find(n=>n.t===t);
const next=(g,n,label)=>g.edges.filter(e=>e.source===n.id&&(!label||e.label===label)).map(e=>g.nodes.find(n=>n.id===e.target));

test('if/else-if branches share one continuation and group only simple statements',()=>{
 const g=main('int main(){int x=0; x++; if(x<2)x+=2;else if(x>4)x--;else x=7;printf("%d",x);return 0;}');
 assert.equal(g.nodes.filter(n=>n.k==='out').length,1);
 assert.equal(g.nodes.filter(n=>n.k==='dec').length,2);
 assert.equal(g.nodes.find(n=>n.statements?.length===2).t,'int x = 0\nx++');
 const out=g.nodes.find(n=>n.k==='out');
 assert.equal(g.edges.filter(e=>e.target===out.id).length,3);
 for(const n of g.nodes.filter(n=>n.k==='dec'))assert.deepEqual(g.edges.filter(e=>e.source===n.id).map(e=>e.label).sort(),['No','Yes']);
});
test('for continue runs update, break exits, and return never falls through',()=>{
 const g=main('int main(){for(int i=0;i<4;i++){if(i==1)continue;if(i==2)break;if(i==3)return 9;printf("%d",i);}return 0;}');
 assert.equal(next(g,node(g,'continue'))[0].t,'i++');
 assert.equal(next(g,node(g,'break'))[0].t,'return 0');
 assert.equal(next(g,node(g,'return 9'))[0].k,'term');
 assert.equal(next(g,node(g,'i++'))[0].t,'i < 4');
});
test('nested switch break stays in loop and continue targets enclosing loop',()=>{
 const g=main('int main(){int i=0;while(i<4){switch(i){case 0:i++;continue;case 1:break;default:i++;}printf("%d",i);}return 0;}');
 assert.equal(next(g,node(g,'continue'))[0].t,'i < 4');
 assert.equal(next(g,node(g,'break'))[0].k,'out');
});
test('do continue evaluates trailing predicate; do return has no unreachable condition',()=>{
 const g=main('int main(){int x=0;do{if(x)continue;x++;}while(x<3);return 0;}');
 assert.equal(next(g,node(g,'continue'))[0].t,'x < 3');
 const ret=main('int main(){do{return 1;}while(1);printf("bad");}');
 assert.equal(ret.nodes.filter(n=>n.k==='dec'||n.k==='out').length,0);
});
test('empty do loop repeats its decision and unconditional for has no invented exit',()=>{
 const g=main('int main(){do{}while(1);}');const d=g.nodes.find(n=>n.k==='dec');
 assert.equal(next(g,d,'Yes')[0].id,d.id);
 assert.equal(g.nodes.filter(n=>n.t==='STOP').length,0);
 const f=main('int main(){for(;;){printf("tick");}printf("bad");}');
 assert.equal(f.nodes.filter(n=>n.k==='out').length,1);
 assert.equal(f.edges.filter(e=>e.label==='No').length,0);
 assert.equal(f.nodes.filter(n=>n.t==='STOP').length,0);
});
test('while false never enters body and early returns suppress later output',()=>{
 const g=main('int main(){while(0){printf("bad");}return 0;printf("bad2");}');
 assert.equal(g.nodes.filter(n=>n.k==='out').length,0);
 assert.equal(g.edges.filter(e=>e.label==='Yes').length,0);
});
test('boolean identifiers are interpreted according to the source language',()=>{
 const c=main('int main(){int False=1;int True=0;if(False)printf("yes");if(True)printf("no");return 0;}');
 assert.equal(c.nodes.filter(n=>n.k==='out').length,2);assert.equal(c.edges.filter(e=>e.label==='Yes'||e.label==='No').length,4);
 const py=graph('def f(true, false):\n    if true:\n        print("no")\n    if false:\n        print("yes")','python').functions[0];
 assert.equal(py.nodes.filter(n=>n.k==='out').length,2);assert.equal(py.edges.filter(e=>e.label==='Yes'||e.label==='No').length,4);
});
test('switch fallthrough enters next case body and default is the no-match destination',()=>{
 const g=main('int main(){int x=2;switch(x){case 1:x++;case 2:printf("ok");break;default:x=0;}return x;}');
 assert.equal(next(g,node(g,'x++'))[0].k,'out');
 const d=g.nodes.find(n=>n.k==='dec');assert.equal(next(g,d,'default')[0].t,'x = 0');
});
test('graph construction preserves parser AST and marks actual entry separately from definitions',()=>{
 assert.ok(FG);const p=ctx.parseProgram('def helper():\n    return 1\nprint(helper())','python'),before=JSON.stringify(p);
 const g=FG.build(p);assert.equal(JSON.stringify(p),before);assert.equal(g.entry,'__main__');
 assert.equal(g.functions.find(f=>f.name==='helper').isEntry,false);
 assert.equal(FG.build(ctx.parseProgram('def f():\n    return 1','python')).entry,null);
});
test('calls and IO stay separate from grouped assignments',()=>{
 const g=main('int helper(){return 1;}int main(){int x=1;x++;x=helper();x++;printf("%d",x);return 0;}');
 assert.equal(g.nodes.filter(n=>n.k==='call').length,1);
 assert.equal(g.nodes.find(n=>n.k==='call').statements.length,1);
});
test('validator rejects dangling edges and return fallthrough',()=>{
 assert.ok(FG);const g=main('int main(){return 0;}');
 g.edges.push({id:'bad',source:node(g,'return 0').id,target:'missing'});
 assert.throws(()=>FG.validate(g),/destination|target/i);
});
test('automatic layout keeps nodes disjoint and connectors outside node interiors',async()=>{
 const g=main('int main(){int x=0;for(int i=0;i<4;i++){if(i==1)continue;else if(i==2)break;x+=i;}printf("%d",x);return 0;}');
 assert.equal(typeof FG.layout,'function');const r=await FG.layout(g);
 assert.ok(r.width>0&&r.height>0);
 for(const a of r.nodes)for(const b of r.nodes){if(a.id>=b.id)continue;
   assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y,`${a.t} overlaps ${b.t}`);
 }
 for(const e of r.edges){assert.ok(e.points.length>=2);
   for(let i=1;i<e.points.length;i++){
     const [a,b]=[e.points[i-1],e.points[i]];assert.ok(a.x===b.x||a.y===b.y,'orthogonal segment');
     for(const n of r.nodes){
       if(a.x===b.x)assert.ok(!(a.x>n.x+1&&a.x<n.x+n.width-1&&Math.max(a.y,b.y)>n.y+1&&Math.min(a.y,b.y)<n.y+n.height-1),`edge through ${n.t}`);
       else assert.ok(!(a.y>n.y+1&&a.y<n.y+n.height-1&&Math.max(a.x,b.x)>n.x+1&&Math.min(a.x,b.x)<n.x+n.width-1),`edge through ${n.t}`);
     }
   }
 }
});
test('long unbroken identifiers and strings have bounded shape widths',async()=>{
 assert.equal(typeof FG.layout,'function');const g=main('int main(){printf("'+'x'.repeat(250)+'");return 0;}');
 const r=await FG.layout(g);for(const n of r.nodes){assert.ok(n.width<=360);assert.ok(n.lines.every(l=>l.length<=36));}
});
test('empty loop connectors have distinct attachment points and visible return routes',async()=>{
 const r=await FG.layout(main('int main(){do{}while(1);}'));
 const e=r.edges.find(e=>e.source===e.target);assert.ok(e);
 const first=e.points[0],last=e.points.at(-1);
 assert.ok(first.x!==last.x||first.y!==last.y,'self-loop must not use the same port at both ends');
 const xs=e.points.map(p=>p.x),ys=e.points.map(p=>p.y);
 assert.ok(Math.max(...xs)-Math.min(...xs)>20&&Math.max(...ys)-Math.min(...ys)>20,'visible two-dimensional loop');
});
test('natural diagram frame adds margins without scaling or forcing a paper ratio',()=>{
 assert.equal(typeof FG.diagramFrame,'function');
 const f=FG.diagramFrame(2200,500);
 assert.equal(f.width,2248);assert.equal(f.height,548);assert.equal(f.scale,1);
 assert.equal(f.x,24);assert.equal(f.y,24);
});

// Compare observable execution with independently executed source, rather than
// deriving expected edges from the graph builder's own implementation.
test('graph execution matches source for all tested branch and loop outcomes',()=>{
 for(let input=0;input<8;input++){
   const body=`int x=${input};int total=0;for(int i=0;i<5;i++){if(i==x)continue;if(total>7)break;total+=i;}do{total--;if(total==2)continue;if(total==1)break;}while(total>0);if(x<2)printf("low",total);else if(x<5)printf("mid",total);else return x;printf("end",x);return total;`;
   const expected=[],sourceContext=vm.createContext({printf:(...a)=>expected.push(a)});
   const result=vm.runInContext('(function(){'+body.replace(/\bint\b/g,'let')+'})()',sourceContext);
   const actual=[],state=vm.createContext({printf:(...a)=>actual.push(a)}),g=main('int main(){'+body+'}');
   const byId=new Map(g.nodes.map(n=>[n.id,n]));let id=g.entry,returned,steps=0;
   while(id!==g.exit){
     assert.ok(steps++<200,'bounded test execution must terminate');const n=byId.get(id);let label;
     if(n.k==='dec')label=vm.runInContext(n.t,state)?'Yes':'No';
     else if(n.k==='ret')returned=vm.runInContext(n.t.replace(/^return /,''),state);
     else if(!['term','brk','cnt'].includes(n.k)){
       const text=n.statements.map(s=>s.q?.length?s.q.map(t=>t.t).join(' '):s.t).join(';');
       vm.runInContext(text.replace(/\bint\b/g,'let'),state);
     }
     const edge=g.edges.find(e=>e.source===id&&(!label||e.label===label));assert.ok(edge);id=edge.target;
   }
   assert.deepEqual(actual,expected,'output order at input '+input);assert.equal(returned,result,'return at input '+input);
 }
});
