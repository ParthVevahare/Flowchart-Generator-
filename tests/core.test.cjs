const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const app=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('function parseC('));
const context=vm.createContext({console,FlowGraph:require('../flowchart.js'),CodeColors:require('../code-colors.js')});
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
