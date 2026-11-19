const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const app=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('function parseC('));
const context=vm.createContext({console,FlowGraph:require('../flowchart.js'),CodeColors:require('../code-colors.js')});
vm.runInContext(fs.readFileSync(path.join(root,'vendor/advanced.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(root,'syntax.js'),'utf8'),context);
vm.runInContext(app.slice(0,app.indexOf('/* ---------- app ---------- */'))+'\nglobalThis.api={parse,EX,buildProgram,pseudo,detect};',context);
const {parse,EX,buildProgram,pseudo,detect}=context.api;

for(const [i,lang] of ['c','c','c','python','python','java'].entries()) {
  test(`built-in example ${i+1} parses, draws, and produces pseudocode`,async()=>{
    const program=parse(EX[i],lang);
    assert.ok(program.fns.length);
    assert.ok(pseudo(program).length>20);
    const unified=await buildProgram(program);
    assert.equal((unified.inner.match(/data-function=/g)||[]).length,program.fns.length);
    assert.ok(!/NaN|Infinity/.test(unified.inner));
  });
}
const valid=[
  ['c','int main(){int x=0,y=3; x+=y*2; if(x>0){printf("%d",x);}return 0;}'],
  ['c','int square(int n){return n*n;} int main(){int a[3]={1,2,3};for(int i=0;i<3;i++){a[i]=square(a[i]);}return 0;}'],
  ['c','#include <iostream>\nusing namespace std;\nint main(){int n;cin>>n;cout<<n<<endl;return 0;}'],
  ['c','int main(){for(;;){break;}return 0;}'],
  ['c','int main(){int n=1;do{n++;}while(n<3);return 0;}'],
  ['c','int main(){int\nvalue = 1;\nreturn value;}'],
  ['c','int main(){double x=1.5e-3;unsigned long long n=12ULL;return 0;}'],
  ['python','x = 1\ny = x + 2\nprint(y)'],
  ['python','a,b = 1,2\na,b = b,a\nprint(a,b)'],
  ['python','import math\nx = math.sqrt(4)\nprint(x)'],
  ['python','def f(n: int = 2) -> int:\n    return n * n\nprint(f())'],
  ['python','xs = [1, 2, 3]\nfor x in xs:\n    if x > 1:\n        print(x)'],
  ['python','data = {"a": 1, "b": 2}\nprint(data["a"])'],
  ['java','import java.util.Scanner;\npublic class Main{public static void main(String[] args){Scanner sc=new Scanner(System.in);int n=sc.nextInt();System.out.println(n);}}'],
  ['java','public class Main{public static void main(String[] args){int[] values=new int[]{1,2,3};for(int n:values){System.out.println(n);}}}'],
];
for(const [lang,source] of valid)test(`accepts valid ${lang}: ${source.slice(0,55)}`,()=>assert.ok(parse(source,lang).fns.length));
test('draws a linked-list program with typedefs, designated initializers, and member access',async()=>{
  const program=parse(`typedef struct Node Node;
struct Node { int value; Node *next; };
Node *advance(Node *node) { return node->next; }
int main(void) {
  Node last = { .value = 2, .next = 0 };
  Node first = { .value = 1, .next = &last };
  for (Node *node = &first; node; node = advance(node)) printf("%d", node->value);
  return 0;
}`,'c');
  const chart=await buildProgram(program);
  assert.match(chart.inner,/data-call="main-&gt;advance"/);
  assert.match(chart.inner,/node-&gt;value/);
  assert.doesNotMatch(chart.inner,/typedef struct Node/);
  assert.match(pseudo(program),/DECLARE first : Node/);
});

test('draws aggregate objects and recognizes inline types and compound literals',()=>{
  const program=parse(`enum State { Idle, Busy = 2, };
union Number { int whole; double fraction; } defaultNumber = { .whole = 3 };
typedef unsigned long Size, *SizePtr;
int main(void) {
  typedef struct { unsigned ready : 1; int data[3]; } Work;
  Work w = (Work){ .ready = 1, .data[2] = 4 };
  struct { enum State state; union Number value; } current = { Busy, { .whole = w.data[2] } };
  Size size = sizeof(Work *);
  SizePtr ptr = &size;
  return current.value.whole + *ptr + (int[2]){1, 2}[0];
}`,'c');
  assert.match(pseudo(program),/DECLARE \*?ptr : SizePtr/);
  assert.match(pseudo(program),/DECLARE current/);
  assert.match(pseudo(program),/defaultNumber/);
});

test('typedef names are visible after their declarations inside their block',()=>{
  const valid='int main(void) { { typedef int Local; Local x = 0; } return 0; }';
  assert.match(pseudo(parse(valid,'c')),/DECLARE x : Local/);
  for(const source of [
    'int main(void) { { typedef int Local; } Local x = 0; return 0; }',
    'int main(void) { Local x = 0; typedef int Local; return x; }',
    'int main(void) { if (1) typedef int Local; Local x = 0; return x; }',
  ]) assert.throws(()=>parse(source,'c'),e=>e.l===1&&!!e.m);
});
test('pseudocode keeps typedef declarations after another program is parsed',()=>{
  const program=parse('typedef int Alias; int main(void) { Alias *value = 0; return 0; }','c');
  parse('int main(void) { return 0; }','c');
  assert.match(pseudo(program),/DECLARE \*value : Alias/);
});

test('malformed aggregate members and designators report their source lines',()=>{
  assert.throws(()=>parse('struct Item {\n  int value\n}; int main(void) { return 0; }','c'),e=>e.l===2&&/;/.test(e.m));
  assert.throws(()=>parse('struct Item { int value; };\nint main(void) { struct Item x = {.value 1}; return 0; }','c'),e=>e.l===2&&/Expected/.test(e.m));
});

test('detects C in an aggregate program with an alias as its return type',()=>{
  assert.equal(detect('typedef struct { char value; } Item; Item make(void) { Item x = { 0 }; return x; }'),'c');
  assert.equal(detect('struct Node;\nstruct Node *identity(struct Node *node) { return node; }'),'c');
});
test('draws calls through callback typedefs and function pointer members',()=>{
  const program=parse(`typedef int (*Compare)(int, int);
typedef int CompareFunction(int, int);
struct Operations { Compare compare; CompareFunction *alternate; void (*log)(const char *, ...); };
int compare(int a, int b) { return a - b; }
int apply(int (*callback)(int, int)) { return callback(1, 2); }
int main(void) {
  struct Operations ops = { .compare = compare };
  int (*callback)(int, int) = ops.compare;
  return apply(callback);
}`,'c');
  assert.match(pseudo(program),/RETURN callback\(1, 2\)/);
  assert.match(pseudo(program),/DECLARE .*callback/);
});
test('aggregate tags and typedef names can also be used as scoped variables',()=>{
  const program=parse(`typedef struct { int n; } Node;
struct point { int x; };
int inc(Node *Node) { Node->n++; return Node->n; }
int main(void) {
  struct point point = { 0 };
  point.x++;
  for (int Node = 0; Node < 2; Node++) Node += 1;
  Node node = { point.x };
  return inc(&node);
}`,'c');
  assert.match(pseudo(program),/INCREMENT Node->n/);
  assert.match(pseudo(program),/DECLARE node : Node/);
});
test('callback members named like built-ins or helpers avoid false chart links',async()=>{
  const chart=await buildProgram(parse(`int run(int n) { return n; }
struct Ops { int (*printf)(int); int (*run)(int); };
int main(void) { struct Ops ops = { .printf = run, .run = run }; ops.printf(3); int (*run)(int) = ops.run; return run(ops.run(1)); }`,'c'));
  assert.doesNotMatch(chart.inner,/Output:|data-call="main-&gt;run"/);
  assert.match(chart.inner,/ops\.printf/);
});
test('deeply nested named aggregate members validate within the parser limits',()=>{
  const members=Array.from({length:40}).reduce(text=>'struct { '+text+' } nested;', 'int value;');
  assert.equal(parse('struct Root { '+members+' }; int main(void) { return 0; }','c').fns[0].name,'main');
  const size=Array.from({length:18}).reduce(text=>'sizeof (struct { int data['+text+']; }){0}', '1');
  assert.equal(parse('int main(void) { return '+size+'; }','c').fns[0].name,'main');
});
const invalid=[
  ['c','hello world'],['python','hello world'],['python','this is not code'],
  ['python','just_some_random_word'],['python','12345'],['python','x ='],
  ['python','x = 1 2'],['python','x = (1 + )'],['python','1 = 2'],
  ['python','print(,1)'],['python','print("unterminated)'],['python','pass nonsense'],
  ['python','import definitely not valid'],['python','if True:\n    print(1)\n  print(2)'],
  ['python','return 1'],['python','break'],['python','for x in range(2):\n    pass\ncontinue'],
  ['python','def f(x x):\n    return x'],['python','def f(x,x):\n    return x'],
  ['python','def f(x,,):\n    return x'],['python','def f(x=1,y):\n    return y'],
  ['python','f(x=1,x=2)'],['python','f(x=1,2)'],['python','as = 3'],
  ['python','x = 0123'],['python','x = 1__2'],
  ['c','int main(){this is not code;}'],['c','int main(){hello;}'],
  ['c','gibberish(){return 0;}'],['c','int main(){int x = ;}'],
  ['c','int main(){int x = 1 2;}'],['c','int main(){int x=1+;}'],
  ['c','int main(){printf("hello) ;}'],['c','int main(){/* no end }'],
  ['c','int main(){if(){return 0;}}'],['c','int main(){if(x=1){return 0;}}'],
  ['c','int main(){return 0;break;}'],['c','int main(){return 0;continue;}'],
  ['c','int main(){3=4;}'],['c','int main(){int x=12abc;}'],
  ['c','int main(){foo(1,,2);}'],['c','random text; int main(){return 0;}'],
  ['c','int main(){double n=1.2UL;}'],['c','int main(){int n=1ffff;}'],
  ['c','int main(){void n;}'],['c','int main(){switch(1){case hello world:break;}}'],
  ['c','int main(){switch(1){default:break;default:break;}}'],
  ['c','int main(){return 0;} int main(){return 0;}'],
  ['c','#if SOMETHING\nint main(){return 0;}\n#endif'],
  ['java','public class Main{public static void main(String[] args){random words here;}}'],
];
for(const [lang,source] of invalid)test(`rejects invalid ${lang}: ${source.slice(0,55)}`,()=>assert.throws(()=>parse(source,lang),e=>!!e.m&&Number.isInteger(e.l)));
test('error points to the failing line',()=>assert.throws(()=>parse('int main(){\n int x = 1;\n x = ;\n}','c'),e=>e.l===3));
test('oversized programs get a bounded diagnostic',()=>assert.throws(()=>parse(' '.repeat(50001),'python'),e=>!!e.m));
test('HTML has no Question Bank or emoji',()=>{
  assert.doesNotMatch(html,/Question\s*Bank|PracticeBank|practice-room|practice-data/i);
  assert.doesNotMatch(html,/[\u{1F000}-\u{1FAFF}\u2600-\u27BF]/u);
});
test('all functions share one chart with explicit call links',async()=>{
  const p=parse('int twice(int n){return n*2;} int main(){int n=twice(4);printf("%d",n);return 0;}','c');
  const chart=await buildProgram(p);
  assert.equal(chart.functionCount,2);
  assert.match(chart.inner,/data-function="main"/);
  assert.match(chart.inner,/data-function="twice"/);
  assert.match(chart.inner,/data-call="main-&gt;twice"/);
  assert.equal(chart.callCount,1);
  assert.equal(p.fns[0].body[0].k,'p','renderer must not mutate the parser AST');
});
test('recursive functions render once and link back to themselves',async()=>{
  const chart=await buildProgram(parse('int factorial(int n){if(n<=1)return 1;return n*factorial(n-1);} int main(){int x=factorial(5);return 0;}','c'));
  assert.equal(chart.functionCount,2);
  assert.equal(chart.callCount,2);
  assert.match(chart.inner,/data-call="factorial-&gt;factorial"/);
});
test('function names inside strings do not create call links',async()=>{
  const chart=await buildProgram(parse('void helper(){} int main(){printf("helper()");return 0;}','c'));
  assert.equal(chart.callCount,0);
});
test('definitions alone are not mislabeled as an executed Python program',async()=>{
  const chart=await buildProgram(parse('def main():\n    print("hello")','python'));
  assert.match(chart.inner,/FUNCTION ROOT \(NO ENTRY POINT\)/);
  assert.doesNotMatch(chart.inner,/PROGRAM ENTRY/);
});
test('function count and deeply nested expressions have explicit limits',()=>{
  assert.throws(()=>parse(Array.from({length:21},(_,i)=>'void f'+i+'(){}').join(' '),'c'),e=>/20 functions/.test(e.m));
  assert.throws(()=>parse('x = '+'-'.repeat(200)+'1','python'),e=>/deeply nested/.test(e.m));
});
for(const [source,lang] of [
  ['x = 1','python'],['print("System.out class Main")','python'],
  ['#include <stdio.h>\nint main(){return 0;}','c'],
  ['int main(){printf("print(1)");return 0;}','c'],
  ['public class Main { public static void main(String[] args){} }','java'],
])test(`detects ${lang} without relying on string contents`,()=>assert.equal(detect(source),lang));

for (const [language, source] of require('./fixtures/advanced.cjs')) {
  test('advanced program produces all three outputs for ' + language, async () => {
    const program = parse(source, language);
    const chart = await buildProgram(program);
    assert.match(chart.inner, /data-function=/);
    assert.doesNotMatch(chart.inner, /NaN|Infinity/);
    assert.ok(pseudo(program).includes('RETURN'));
    for (const fn of program.fns) {
      assert.ok(vm.runInContext('algorithmFor', context)(fn, program, false).steps.length);
    }
  });
}

test('return in a try runs cleanup before exiting, and calls can reach their handler', () => {
  const source = `def consume(items):
    try:
        for item in items:
            if item:
                return read(item)
        raise ValueError()
    except ValueError:
        return 0
    finally:
        close()
    late()
`;
  const program=parse(source,'python');
  const graph=context.FlowGraph.build(program,{optimizeCommon:false}).functions.find(f=>f.name==='consume');
  const nodes=new Map(graph.nodes.map(n=>[n.id,n]));
  for(const ret of graph.nodes.filter(n=>n.k==='ret')) {
    const cleanup=nodes.get(graph.edges.find(e=>e.source===ret.id && e.kind==='finally-return').target);
    assert.match(cleanup.t,/close\(\)/);
    assert.ok(graph.edges.some(e=>e.source===cleanup.id && e.target===graph.exit));
  }
  const read=graph.nodes.find(n=>n.t.includes('read(item)'));
  assert.ok(graph.edges.some(e=>e.source===read.id && e.kind==='exception' &&
    nodes.get(e.target).t.includes('matches ValueError')));
  assert.ok(!graph.nodes.some(n=>n.t.includes('late()')));
  assert.match(pseudo(program),/CATCH ValueError[\s\S]+FINALLY[\s\S]+close/);
});

test('switch expression initializes the declaration exactly once on each arm', () => {
  const program=parse('class A { int f(int x){ int n = switch(x){case 1 -> 4;default -> 9;}; return n;} }','java');
  const graph=context.FlowGraph.build(program).functions[0];
  const arms=graph.nodes.filter(n=>n.t.startsWith('Declare int n = '));
  assert.equal(arms.length,2);
  const end=graph.nodes.find(n=>n.t==='Return n');
  for(const n of arms)assert.ok(graph.edges.some(e=>e.source===n.id && e.target===end.id));
});

test('advanced C++ loop continue reaches update and named lambda return stays local', () => {
  const program=parse('int main(){auto inc=[](int x){return x+1;}; for(int i=0;i<3;i++){if(i==1)continue;inc(i);}return 0;}','c');
  const [main,lambda]=context.FlowGraph.build(program).functions;
  assert.equal(lambda.name,'main::inc');
  const jump=main.nodes.find(n=>n.k==='cnt'),update=main.nodes.find(n=>n.t==='i++');
  assert.ok(main.edges.some(e=>e.source===jump.id && e.target===update.id));
  assert.ok(lambda.nodes.some(n=>n.k==='ret'&&n.t==='Return x+1'));
  assert.ok(!main.nodes.flatMap(n=>n.calls).includes('inc'));
});

test('unsupported statements and grammar recovery have source lines', () => {
  for(const [lang,source,l] of [
    ['python','class A:\n def f(self):\n  with open("a") as f:\n   return f.read()',3],
    ['java','interface A {}\nclass B { int f(){ return 2 + ; } }',2],
    ['c','template<class T> int f(T x){\n goto done;\n done: return 1;}',2]
  ])assert.throws(()=>parse(source,lang),e=>e.l===l&&!!e.m);
});

test('Java grammar keeps a returned switch inside its if and a block yield inside its arm',()=>{
  const source=`class Score {
    int score(int x) {
      if (x > 0) return switch(x) {
        case 1 -> { int n = x + 1; yield n; }
        default -> 3;
      };
      return 0;
    }
  }`;
  const program=parse(source,'java');
  const graph=context.FlowGraph.build(program).functions[0];
  const branch=graph.nodes.find(n=>n.t.includes('x > 0'));
  const successor=label=>graph.nodes.find(n=>n.id===graph.edges.find(e=>e.source===branch.id&&e.label===label).target);
  assert.equal(successor('Yes').switch,true);
  assert.equal(successor('No').t,'Return 0');
  assert.match(pseudo(program),/DECLARE int n = x \+ 1[\s\S]+RETURN n/);
});

test('handler matching and cleanup remain connected for a Java switch inside try',()=>{
  const program=parse('class A{int f(int x){try{return switch(x){default -> g();};}catch(RuntimeException e){throw e;}finally{close();}}}','java');
  const graph=context.FlowGraph.build(program).functions[0];
  const select=graph.nodes.find(n=>n.switch);
  assert.ok(graph.edges.some(e=>e.source===select.id&&e.kind==='exception'));
  assert.ok(graph.nodes.some(n=>n.t==='PROPAGATE EXCEPTION'));
});

test('C++ STL inline lambda has its own body and catch-all handles explicit throw',()=>{
  const program=parse('int main(){std::vector<int> xs{1};try{std::for_each(xs.begin(),xs.end(),[](int &x){x++;});throw 2;}catch(...){return 7;}}','c');
  const [main,lambda]=context.FlowGraph.build(program).functions;
  assert.match(lambda.name,/main::lambda/);
  const fail=main.nodes.find(n=>n.t==='Throw 2'),handler=main.nodes.find(n=>n.t==='Return 7');
  assert.ok(main.edges.some(e=>e.source===fail.id&&e.target===handler.id));
});

test('advanced switch keeps colon fallthrough and jumps out on break',()=>{
  for(const [lang,source] of [
    ['java','class X<T>{int f(int n){switch(n){case 1:n++;case 2:break;default:return 7;}return n;}}'],
    ['c','template<class T> int f(T n){switch(n){case 1:n++;case 2:break;default:return 7;}return n;}']
  ]){
    const program=parse(source,lang),graph=context.FlowGraph.build(program).functions[0];
    const inc=graph.nodes.find(n=>n.t.includes('n++')),jump=graph.nodes.find(n=>n.k==='brk');
    assert.ok(graph.edges.some(e=>e.source===inc.id&&e.target===jump.id));
    assert.match(pseudo(program),/next case/);
  }
});

test('receiver calls named like their method do not become recursive references',()=>{
  const program=parse('class A<T>{ int run(T run){ run.other(); return run(); } }','java');
  const graph=context.FlowGraph.build(program).functions[0];
  assert.equal(graph.nodes.find(n=>n.t.includes('other')).calls.length,0);
  assert.ok(graph.nodes.find(n=>n.k==='ret').calls.includes('A.run'));
});

test('async loop break bypasses else and generator expression remains lazy source',()=>{
  const program=parse('async def scan(xs):\n stream = (x for x in xs)\n async for x in xs:\n  if x: break\n else:\n  yield 0\n return','python');
  const graph=context.FlowGraph.build(program).functions.find(f=>f.name==='scan');
  const jump=graph.nodes.find(n=>n.k==='brk'),yielded=graph.nodes.find(n=>n.t==='Yield 0');
  assert.ok(graph.edges.some(e=>e.source===jump.id&&e.target!==yielded.id));
  assert.ok(graph.edges.some(e=>e.target===yielded.id&&e.label==='No'));
  assert.match(pseudo(program),/\(x for x in xs\)/);
});

test('JDBC fields and nested resources reach every generator',async()=>{
  const source=fs.readFileSync(path.join(__dirname,'fixtures/JdbcExample.java'),'utf8');
  const program=parse(source,'java'),chart=await buildProgram(program);
  assert.match(chart.inner,/rs.next/);
  assert.match(chart.algText,/executeUpdate/);
  assert.match(pseudo(program),/close rs/i);
  assert.match(pseudo(program),/jdbc:example:demo/);
});

test('JDBC acquisition failure closes only acquired resources and preserves the primary exception',()=>{
  const src=fs.readFileSync(path.join(__dirname,'fixtures/JdbcExample.java'),'utf8');
  const graph=context.FlowGraph.build(parse(src,'java')).functions.find(g=>g.name==='JdbcExample.main');
  const byId=new Map(graph.nodes.map(n=>[n.id,n]));
  const next=(n,exception=false)=>byId.get(graph.edges.find(e=>e.source===n.id && (e.kind==='exception')===exception).target);
  const acquisition=graph.nodes.find(n=>n.t.startsWith('Acquire ResultSet rs'));
  let close=next(acquisition,true);
  for(const resource of ['selectStmt','pstmt','conn']){
    assert.equal(close.t,'Close '+resource+' if non-null');
    const suppressed=next(close,true);
    assert.match(suppressed.t,/Suppress close failure/);
    assert.equal(next(suppressed).id,next(close).id);
    close=next(close);
  }
  assert.match(close.t,/Exception matches SQLException/);
  const condition=graph.nodes.find(n=>n.t.includes('rs.next()') && n.k==='dec');
  close=byId.get(graph.edges.find(e=>e.source===condition.id && e.label==='No').target);
  for(const resource of ['rs','selectStmt','pstmt','conn']){
    assert.equal(close.t,'Close '+resource+' if non-null');
    close=next(close);
  }
  assert.equal(close.id,graph.exit);
});

test('Java class and instance initialization keep independent source order',()=>{
  const p=parse('interface Limits{int MAX=4;} class A{ int x=first(), empty; static int y=2; { use(x); } static { use(y); } void f(){} }','java');
  const phases=p.fns.filter(f=>f.initialization);
  const values=phase=>Array.from(phases.find(f=>f.name===phase).body,s=>s.value);
  assert.deepEqual(values('A.<instance initialization>'),['int x=first()','use(x)']);
  assert.deepEqual(values('A.<class initialization>'),['static int y=2','use(y)']);
  assert.deepEqual(values('Limits.<class initialization>'),['int MAX=4']);
});

test('return from a resource body closes before exiting and close failure can enter catch',()=>{
  const g=context.FlowGraph.build(parse('class A {int f(Resource r){try(r){return 2;}catch(Exception e){return 3;}}}','java')).functions[0];
  const returned=g.nodes.find(n=>n.t==='Return 2');
  const target=(n,k)=>g.nodes.find(t=>t.id===g.edges.find(e=>e.source===n.id&&e.kind===k).target);
  const close=target(returned,'finally-return');
  assert.equal(close.t,'Close r if non-null');
  assert.equal(target(close,'flow').id,g.exit);
  assert.match(target(close,'exception').t,/matches Exception/);
});
