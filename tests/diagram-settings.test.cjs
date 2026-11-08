const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
let settings;try{settings=require('../diagram-settings.js');}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;}
const FG=require('../flowchart.js');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const app=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('function parseC('));
const ctx=vm.createContext({console,FlowGraph:FG,DiagramSettings:settings});
vm.runInContext(fs.readFileSync(path.join(root,'syntax.js'),'utf8'),ctx);
vm.runInContext(app.slice(0,app.indexOf('/* ---------- app ---------- */'))+'\nglobalThis.api={parse,buildProgram};',ctx);
const parse=s=>ctx.api.parse(s,'c');
const source='int main(){int a=1;a++;if(a<4){a+=2;}else{a--;}return a;}';

test('settings normalize hostile, missing and out-of-range preferences',()=>{
 assert.ok(settings,'settings module exists');
 assert.deepEqual(settings.normalize(null),settings.defaults);
 const s=settings.normalize({direction:'diagonal',theme:'<script>',fontSize:999,widthScale:-1,heightScale:'2',compact:'false',trueLabel:'  '+ 'W'.repeat(200),falseLabel:'\u0000  No  ',extra:'ignored'});
 assert.equal(s.direction,'DOWN');assert.equal(s.theme,'classic');assert.equal(s.fontSize,24);
 assert.equal(s.widthScale,.7);assert.equal(s.heightScale,2);assert.equal(s.compact,false);
 assert.equal(s.trueLabel.length,40);assert.equal(s.falseLabel,'No');assert.equal(s.extra,undefined);
 assert.equal(settings.normalize({fontSize:Infinity,widthScale:NaN,trueLabel:''}).fontSize,12.5);
});
test('storage failures and malformed JSON preserve usable defaults',()=>{
 assert.ok(settings);
 for(const storage of [null,{getItem(){throw Error('blocked');}},{getItem(){return '{broken';}},{getItem(){return '[]';}}])assert.deepEqual(settings.load(storage),settings.defaults);
 const store={getItem(){return this.value;},setItem(k,v){this.value=v;}};
 assert.equal(settings.save(store,{direction:'RIGHT'}),true);assert.equal(settings.load(store).direction,'RIGHT');
 assert.equal(settings.save({setItem(){throw Error('quota');}},settings.defaults),false);
});
test('grouping can be disabled without changing AST or branch semantics',()=>{
 const program=parse(source),before=JSON.stringify(program);
 const grouped=FG.build(program).functions[0],split=FG.build(program,{optimizeCommon:false}).functions[0];
 assert.equal(split.nodes.length,grouped.nodes.length+1);
 assert.ok(split.nodes.every(n=>n.statements.length===1));assert.equal(JSON.stringify(program),before);
 assert.deepEqual(split.edges.filter(e=>e.label).map(e=>e.label).sort(),['No','Yes']);
});
test('all four layout directions preserve semantic edges and separate node interiors',async()=>{
 const graph=FG.build(parse('int main(){int a=0;while(a<3){if(a==1){a++;continue;}a++;}return a;}')).functions[0];
 for(const direction of ['DOWN','UP','RIGHT','LEFT']){
   const r=await FG.layout(graph,{direction,fontSize:24,widthScale:2,heightScale:2,trueLabel:'Absolutely yes',falseLabel:'Not this time'});
   const entry=r.nodes.find(n=>n.id===r.entry),exit=r.nodes.find(n=>n.id===r.exit);
   assert.ok(direction==='DOWN'?entry.y<exit.y:direction==='UP'?entry.y>exit.y:direction==='RIGHT'?entry.x<exit.x:entry.x>exit.x,direction);
   assert.deepEqual(r.edges.map(e=>[e.source,e.target,e.label]),graph.edges.map(e=>[e.source,e.target,e.label]));
   assert.ok(r.nodes.every(n=>n.fontSize===24&&n.lineHeight>=30));
   for(const a of r.nodes)for(const b of r.nodes)if(a.id<b.id)assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y);
   for(const e of r.edges)for(let i=1;i<e.points.length;i++){
     const [a,b]=[e.points[i-1],e.points[i]];assert.ok(a.x===b.x||a.y===b.y);
     for(const n of r.nodes)assert.ok(a.x===b.x?!(a.x>n.x+1&&a.x<n.x+n.width-1&&Math.max(a.y,b.y)>n.y+1&&Math.min(a.y,b.y)<n.y+n.height-1):!(a.y>n.y+1&&a.y<n.y+n.height-1&&Math.max(a.x,b.x)>n.x+1&&Math.min(a.x,b.x)<n.x+n.width-1),direction+' edge crosses '+n.t);
   }
 }
});
test('rendered settings apply labels, font and theme without changing algorithms',async()=>{
 assert.ok(settings);
 const program=parse(source),plain=await ctx.api.buildProgram(program);
 const chart=await ctx.api.buildProgram(program,{theme:'dark',fontSize:20,trueLabel:'<True & safe>',falseLabel:'False',decorateLabels:false,optimizeCommon:false});
 assert.ok(chart.inner.includes('&lt;True &amp; safe&gt;'));assert.ok(!chart.inner.includes('<True & safe>'));
 assert.match(chart.inner,/font-size="20"/);assert.equal(chart.background,settings.palettes.dark.background);
 assert.equal(chart.algText,plain.algText);assert.equal(chart.settings.fontSize,20);
 assert.ok(!chart.inner.includes('rx="8.5"'),'plain labels have no pill');
});
test('compact layout reduces whitespace without resizing text',async()=>{
 const graph=FG.build(parse(source)).functions[0];
 const normal=await FG.layout(graph),compact=await FG.layout(graph,{compact:true});
 assert.ok(compact.height<normal.height);assert.equal(compact.nodes[0].height,normal.nodes[0].height);
});
