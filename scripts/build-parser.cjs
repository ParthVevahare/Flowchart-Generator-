const fs = require('node:fs');
const path = require('node:path');
const {buildParserFile} = require('@lezer/generator');
const {build} = require('esbuild');

// Extend the pinned upstream grammar at build time. Pages serves the generated
// parser, so visitors never download the generator or compile a grammar.
const grammarFile = path.resolve(path.dirname(require.resolve('@lezer/java')), '../src/java.grammar');
let grammar = fs.readFileSync(grammarFile, 'utf8').replace(/\r\n/g,'\n');
const productions = [
  ['kw<"return"> expression? ";"','kw<"return"> (expression | SwitchExpression)? ";"'],
  ['(AssignOp | "=") expression','(AssignOp | "=") (expression | SwitchExpression)'],
  ['variableInitializer {\n  expression |','variableInitializer {\n  SwitchExpression | expression |'],
  ['  ThrowStatement |','  YieldStatement | ThrowStatement |'],
  ['SwitchStatement {','YieldStatement { ckw<"yield"> expression ";" }\nSwitchExpression { kw<"switch"> ParenthesizedExpression SwitchBlock }\nSwitchStatement {'],
  ['@external propSource javaHighlighting from "./highlight"','']
];
for (const [original, replacement] of productions) {
  if (!grammar.includes(original)) throw new Error('Upstream Java grammar changed near '+original);
  grammar = grammar.replace(original,replacement);
}
const {parser} = buildParserFile(grammar);
build({
  entryPoints:['advanced-parser.js'],bundle:true,minify:true,format:'iife',
  globalName:'AdvancedParser',outfile:'vendor/advanced.js',
  plugins:[{name:'java-switch-expressions',setup(build) {
    build.onResolve({filter:/^@lezer\/java$/},()=>({path:'java',namespace:'grammar'}));
    build.onLoad({filter:/.*/,namespace:'grammar'},()=>({contents:parser,resolveDir:__dirname}));
  }}]
}).catch(error=>{console.error(error);process.exitCode=1;});
