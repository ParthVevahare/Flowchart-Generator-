const {test}=require('node:test'),assert=require('node:assert/strict');
let colors;try{colors=require('../code-colors.js');}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;}
test('highlights keywords, strings, numbers and comments in each supported language',()=>{
 assert.ok(colors,'code colorizer exists');
 for(const [lang,source] of [
  ['c','int main(){ // comment\n printf("hello"); return 42; }'],
  ['python','# comment\ndef hello():\n    return "hello" if 42 else None'],
  ['java','class Main { // comment\n String s="hello"; int n=42; }'],
 ]){
  const html=colors.highlight(source,lang);
  for(const kind of ['keyword','string','number','comment'])assert.match(html,new RegExp('class="token [^"]*\\b'+kind+'\\b'),lang+' '+kind);
 }
});
test('highlighting escapes source HTML without changing its text',()=>{
 assert.ok(colors);const source='print("<img src=x onerror=alert(1)> & \\"quoted\\"")';
 const html=colors.highlight(source,'python');assert.doesNotMatch(html,/<img|<script/);
 const text=html.replace(/<\/?span[^>]*>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');assert.equal(text,source);
});
test('unfinished code and multiline strings/comments remain editable text',()=>{
 assert.ok(colors);
 for(const [lang,source] of [['c','/* unfinished\n comment'],['python','text = """line one\nline two"""\n'],['java','String text = "unfinished']]){
  assert.equal(typeof colors.highlight(source,lang),'string');
 }
});
test('very large saved programs use escaped plain text rather than blocking tokenization',()=>{
 assert.ok(colors);const source='<'.repeat(100001);assert.equal(colors.highlight(source,'c'),'&lt;'.repeat(source.length));
});
test('language detection masks unfinished escaped strings and comments in linear time',()=>{
 assert.equal(typeof colors.mask,'function');const source='int n = 1;\n"'+'\\"'.repeat(50000),start=performance.now();
 const masked=colors.mask(source);assert.match(masked,/int n = 1;/);assert.doesNotMatch(masked,/["']/);
 assert.ok(performance.now()-start<500,'unfinished strings must not block typing');
 assert.equal(colors.mask('/* #include <x> */\nprint("class Main { System.out")'),' \nprint( )');
 const short=source.slice(0,50000),startHighlight=performance.now();colors.highlight(short,'python');
 assert.ok(performance.now()-startHighlight<500,'incomplete string coloring must not block typing');
 const division='value = 4 // int("'+'\\"'.repeat(10000),startDivision=performance.now();
 colors.highlight(division,'python');assert.ok(performance.now()-startDivision<500,'Python floor division is not a line comment');
});
