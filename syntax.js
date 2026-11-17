/* Conservative syntax validation for the structured subset drawn by the generator.
 * This is a parser, not an interpreter or a replacement for a compiler/type checker.
 * Unknown syntax must produce a diagnostic rather than an invented process node.
 */
const Syntax = (() => {
  const fail = (message, token) => { throw {m: message, l: token?.l || 1}; };
  const id = value => /^[A-Za-z_]\w*$/.test(value || '');
  const modifiers = new Set('const static final public private protected abstract volatile transient synchronized native register extern signed unsigned mutable inline constexpr virtual'.split(' '));
  const basic = new Set('void int float double char long short bool boolean byte String string auto size_t wchar_t char16_t char32_t'.split(' '));
  const common = new Set('Scanner BufferedReader InputStreamReader DataInputStream Console File Object Character Short Byte Number StringBuilder StringBuffer Integer Double Float Long Boolean List ArrayList Map HashMap Set HashSet Optional BigInteger BigDecimal vector array pair queue stack deque set map unordered_map unordered_set ostream istream FILE uint8_t uint16_t uint32_t uint64_t int8_t int16_t int32_t int64_t ptrdiff_t time_t'.split(' '));
  const pythonKeywords = new Set('False None True as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or and pass raise return try while with yield'.split(' '));
  const cKeywords = new Set('alignas alignof asm auto bool break case catch char class const constexpr continue default delete do double else enum explicit export extern false float for friend goto if inline int long mutable namespace new noexcept nullptr operator private protected public register reinterpret_cast return short signed sizeof static static_cast struct switch template this thread_local throw true try typedef typeid typename union unsigned using virtual void volatile wchar_t while'.split(' '));
  const javaKeywords = new Set('abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null'.split(' '));
  const assignments = new Set('= += -= *= /= %= &= |= ^= <<= >>= //= **='.split(' '));
  const binary = {'or':2,'||':2,'and':3,'&&':3,'|':4,'^':5,'&':6,'==':7,'!=':7,'is':7,'in':7,'not in':7,'is not':7,'<':8,'>':8,'<=':8,'>=':8,'<<':9,'>>':9,'+':10,'-':10,'*':11,'/':11,'%':11,'//':11,'@':11,'**':13};
  let types = new Set(), language = 'c';
  let positions = new WeakMap(), bindings = new Map();
  const validName = value => id(value) && !(language==='python'?pythonKeywords:language==='java'?javaKeywords:cKeywords).has(value);
  const split = (a, separator) => {
    const out = [[]]; let depth = 0;
    for (const t of a) {
      if ('([{'.includes(t.t) && t.t.length === 1) depth++;
      if (')]}'.includes(t.t) && t.t.length === 1) depth--;
      if (!depth && t.t === separator) out.push([]); else out[out.length - 1].push(t);
    }
    return out;
  };
  function begin(lang, tokens) {
    language = lang;
    types = new Set([...basic, ...common]);
    positions = new WeakMap();
    bindings = new Map();
    let depth = 0;
    if (tokens.length > 12000) fail('This program is too large. Use fewer than 12,000 tokens.', tokens[12000]);
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      positions.set(t, i);
      if (['class','struct','enum','union'].includes(t.t) && id(tokens[i+1]?.t)) types.add(tokens[i+1].t);
      if (['(', '[', '{'].includes(t.t) && ++depth > 64) fail('Nesting is too deep. Simplify this program.', t);
      if ([')', ']', '}'].includes(t.t)) depth--;
    }
  }
  function lex(src) {
    const out = []; let i = 0, line = 1;
    const push = t => out.push({t, l: line});
    while (i < src.length) {
      const c = src[i];
      if (/\s/.test(c)) { if (c === '\n') line++; i++; continue; }
      if (src.startsWith('//', i)) { while (i < src.length && src[i] !== '\n') i++; continue; }
      if (src.startsWith('/*', i)) {
        const start = line, end = src.indexOf('*/', i+2);
        if (end < 0) fail('Unterminated block comment.', {l:start});
        line += (src.slice(i,end+2).match(/\n/g) || []).length; i = end+2; continue;
      }
      if (c === '#' && /^\s*$/.test(src.slice(src.lastIndexOf('\n',i-1)+1,i))) {
        const end = src.indexOf('\n',i), directive = src.slice(i,end < 0 ? src.length : end);
        if (!/^#\s*(include\s*[<"][^>"\n]+[>"]|define\s+[A-Za-z_]\w*(?:\s+[^\n]*)?|pragma\s+once)\s*$/.test(directive)) fail('Unsupported preprocessor directive. Expand macros and conditional compilation before generating.', {l:line});
        if (/^#\s*define\s+[A-Za-z_]\w*\(/.test(directive)) fail('Function-like macros are not supported. Use a function instead.', {l:line});
        i = end < 0 ? src.length : end; continue;
      }
      if (c === '"' || c === "'") {
        const start = i++, startLine = line;
        while (i < src.length && src[i] !== c) {
          if (src[i] === '\n' || src[i] === '\r') fail('Unterminated string or character literal.', {l:startLine});
          if (src[i] === '\\') { i++; if (i >= src.length || /[\r\n]/.test(src[i])) fail('Unterminated escape sequence.', {l:startLine}); }
          i++;
        }
        if (i >= src.length) fail('Unterminated string or character literal.', {l:startLine});
        const value = src.slice(start,++i);
        if (c === "'" && !/^'(?:[^'\\]|\\(?:[abfnrtv0\\'"?]|x[\da-fA-F]+|[0-7]{1,3}|u[\da-fA-F]{4}))'$/.test(value)) fail('A character literal must contain one character or escape sequence.', {l:startLine});
        push(value); continue;
      }
      const rest = src.slice(i);
      const number = /^(?:0[xX][\da-fA-F]+(?:[uUlL]*)|0[bB][01]+(?:[uUlL]*)|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?[fFlLuU]*)/.exec(rest);
      if (number) {
        if (/[\w.]/.test(src[i+number[0].length] || '')) fail('Malformed numeric literal.', {l:line});
        const value=number[0],suffix='(?:[uU](?:ll|LL|[lL])?|(?:ll|LL|[lL])[uU]?)?';
        const integer=new RegExp('^(?:0[xX][\\da-fA-F]+|0[bB][01]+|\\d+)'+suffix+'$');
        const floating=/^(?:\d+\.\d*|\.\d+|\d+[eE][+-]?\d+|\d+\.\d*[eE][+-]?\d+|\.\d+[eE][+-]?\d+)[fFlL]?$/;
        if(!integer.test(value)&&!floating.test(value))fail('Malformed numeric literal or suffix.',{l:line});
        push(number[0]); i += number[0].length; continue;
      }
      const word = /^[A-Za-z_]\w*/.exec(rest);
      if (word) { push(word[0]); i += word[0].length; continue; }
      const operator = /^(?:\.\.\.|<<=|>>=|<<|>>|\+\+|--|->|::|[=!<>+*\/%&|^\-]=|&&|\|\||[{}()[\];,.?:~!+*\/%&|^<>=\-])/.exec(rest);
      if (!operator) fail(`Unexpected character '${c}'. Paste source code without Markdown fences.`, {l:line});
      push(operator[0]); i += operator[0].length;
    }
    return out;
  }
  const aggregates = new Set(['struct','union','enum']);
  function aggregatePrefix(a) {
    let k = 0;
    if (a[k]?.t === 'typedef') k++;
    while (modifiers.has(a[k]?.t)) k++;
    if (!aggregates.has(a[k]?.t)) return false;
    k++;
    if (validName(a[k]?.t)) k++;
    return k === a.length;
  }
  function closing(a, start, open, close) {
    let depth = 0;
    for (let i=start; i<a.length; i++) {
      if (a[i].t === open) depth++;
      if (a[i].t === close && --depth === 0) return i;
    }
    fail(`Expected '${close}'.`,a[start]);
  }
  function aggregateBody(kind, a, endToken) {
    if (!a.length) fail(`Expected a member in the ${kind} definition.`,endToken);
    if (kind === 'enum') {
      const entries = split(a,',');
      if (!entries.at(-1).length) entries.pop();
      for (const entry of entries) {
        if (!validName(entry[0]?.t)) fail('Expected an enumerator name.',entry[0] || endToken);
        if (entry.length === 1) continue;
        if (entry[1]?.t !== '=') fail("Expected '=' after the enumerator name.",entry[1]);
        expression(entry.slice(2),{noAssignment:true,token:entry[1]});
      }
      return;
    }
    const members = split(a,';');
    if (members.at(-1).length) fail("Expected ';' after the member declaration.",a.at(-1));
    members.pop();
    for (const member of members) {
      const tag=member[0]?.t;
      if (['struct','union'].includes(tag) && member[1]?.t === '{' && member.at(-1)?.t === '}' && typeEnd(member) === member.length) continue;
      if (!declaration(member,false,{member:true})) fail('Expected a typed member declaration.',member[0] || endToken);
    }
  }
  function bind(token, scope, isType) {
    if (!bindings.has(token.t)) bindings.set(token.t,[]);
    bindings.get(token.t).push({position:positions.get(token),scope,isType});
  }
  function bindingAt(token) {
    const position=positions.get(token);
    return bindings.get(token?.t)?.findLast(({position:start,scope})=>start<position && position<scope.end);
  }
  function isValue(token) {
    return bindingAt(token)?.isType===false;
  }
  function valueDeclaration(a, scope) {
    if (language==='c' && a.length) {
      return declaration(a,false,{
        onType:end=>{a[0].declarationTypeEnd=end;},
        onName:token=>bind(token,scope,false)
      });
    }
    return false;
  }
  function typeOnly(a, scope) {
    if (language !== 'c' || !a.length) return false;
    if (a[0].t === 'typedef') {
      const addAlias = token => bind(token,scope,true);
      if (!declaration(a.slice(1),false,{addAlias})) fail('Expected a type after typedef.',a[1] || a[0]);
      return true;
    }
    if (!aggregates.has(a[0].t)) return false;
    return typeEnd(a) === a.length;
  }
  function typeEnd(a, start = 0) {
    let k = start;
    while (modifiers.has(a[k]?.t)) k++;
    if (aggregates.has(a[k]?.t)) {
      const kind = a[k++].t;
      const tagged = validName(a[k]?.t);
      if (tagged) k++;
      if (language === 'c' && a[k]?.t === '{') {
        const end = closing(a,k,'{','}');
        aggregateBody(kind,a.slice(k+1,end),a[end]);
        k = end+1;
      } else if (!tagged) return -1;
    }
    else {
      let name = a[k]?.t;
      if (name === 'std' && a[k+1]?.t === '::') { k += 2; name = a[k]?.t; }
      else if (name === 'java') {
        while (a[k+1]?.t === '.' && id(a[k+2]?.t)) k += 2;
        name = a[k]?.t;
      }
      const binding = bindingAt(a[k]);
      if (!(binding?.isType ?? types.has(name))) {
        // 'unsigned n' and 'signed n' use the implicit int type in C.
        return k > start && a.slice(start,k).some(t=>['unsigned','signed'].includes(t.t)) ? k : -1;
      }
      k++;
      if (['short','long'].includes(name)) {
        if (a[k]?.t === 'long' && name === 'long') k++;
        if (a[k]?.t === 'int' || (name === 'long' && a[k]?.t === 'double')) k++;
      }
      if (a[k]?.t === '<') {
        let d = 0;
        do { const t = a[k++]; if (!t) fail("Missing '>' in type arguments.",a[start]); if (t.t === '<') d++; if (t.t === '>') d--; if (t.t === '>>') d-=2; } while (d>0);
      }
    }
    if (language==='c') while (pointerQualifiers.has(a[k]?.t)) k++;
    while (a[k]?.t === '[' && a[k+1]?.t === ']') k+=2;
    return k;
  }
  const pointerQualifiers = new Set(['const','volatile','restrict','_Atomic']);
  function pointerEnd(a, start) {
    let k = start;
    while (a[k]?.t === '*') {
      k++;
      while (pointerQualifiers.has(a[k]?.t)) k++;
    }
    return k;
  }
  function typeNameEnd(a, start) {
    const end=typeEnd(a,start);
    return language==='c'&&end>0?arrayEnd(a,pointerEnd(a,end)):end;
  }
  function expression(a, options = {}) {
    if (!a.length) fail('Expected an expression.', options.token);
    let p = 0, recursion = 0;
    const py = language === 'python', at = t => a[p]?.t === t;
    const take = t => { if (!at(t)) fail(`Expected '${t}'${a[p] ? ` before '${a[p].t}'` : ' at the end of the expression'}.`, a[p] || a[a.length-1]); p++; };
    const node = (target=false, effect=false) => ({target,effect});
    function args(end, dictionary=false) {
      if (at(end)) { p++; return; }
      const keywords=new Set();let sawKeyword=false;
      for (;;) {
        let expanded=false;
        if (py && (at('*') || at('**'))) {expanded=true;p++;}
        if (py && id(a[p]?.t) && a[p+1]?.t === '=') {
          if(!validName(a[p].t))fail('Invalid keyword argument name.',a[p]);
          if(keywords.has(a[p].t))fail('Repeated keyword argument.',a[p]);
          keywords.add(a[p].t);sawKeyword=true;p+=2;
        } else if(py&&sawKeyword&&!expanded)fail('A positional argument cannot follow a keyword argument.',a[p]);
        read(1);
        if (dictionary && at(':')) { p++; read(1); }
        if (at(end)) { p++; return; }
        take(',');
        if (at(end)) { if (!py && end === ')') fail('A function argument is missing after the comma.',a[p]); p++; return; }
      }
    }
    function initializer() {
      take('{');
      while (!at('}')) {
        if (at('.') || at('[')) {
          do {
            if (at('.')) {
              p++;
              if (!validName(a[p]?.t)) fail('Expected a member name after the designator.',a[p] || a[p-1]);
              p++;
            } else {
              p++;
              read(1);
              take(']');
            }
          } while (at('.') || at('['));
          take('=');
        }
        if (at('{')) initializer(); else read(1);
        if (at('}')) break;
        take(',');
      }
      take('}');
    }
    function atom() {
      const t = a[p];
      if (!t) fail('Expected an operand after the operator.',a[a.length-1]);
      const unary = py ? ['+','-','~','not'] : ['+','-','~','!','*','&','++','--'];
      let n;
      if (unary.includes(t.t)) {
        p++; n = read(t.t === 'not' ? 7 : 12);
        if (['++','--','&'].includes(t.t) && !n.target) fail(`'${t.t}' needs a variable or array element.`,t);
        n = node(t.t === '*',n.effect || ['++','--'].includes(t.t));
      } else if (!py && t.t === 'new') {
        p++;const typeStart=p;const end = typeEnd(a,p); if (end < 0) fail('Expected a supported type after new.',a[p]); p=end;
        if (at('(')) { p++; args(')'); }
        else if (at('[')) { while (at('[')) { p++; if (!at(']')) read(1); take(']'); } if (at('{')) {p++;args('}');} }
        else if(at('{')&&a.slice(typeStart,end).some(t=>t.t==='[')){p++;args('}');}
        else fail("Expected constructor arguments or array dimensions after new.",a[p]||t);
        n=node(false,true);
      } else if (!py && t.t === 'sizeof') {
        p++;
        if (at('(')) {
          const type=typeNameEnd(a,p+1);
          if(type>0 && a[type]?.t===')') {
            p=type+1;
            if(language==='c' && at('{')) initializer();
          } else atom();
        }
        else atom();
        n=node();
      } else if (t.t === '(') {
        p++;
        if (!py) {
          let k=typeNameEnd(a,p);
          while (k>0 && ['*','&'].includes(a[k]?.t)) k++;
          if (k>p && a[k]?.t===')') {
            p=k+1;
            if (language==='c' && at('{')) {initializer();n=node(true);}
            else {n=read(12);n.target=false;}
          }
        }
        if (!n) {
          if(at(')')) {if(!py)fail('Empty parentheses are not an expression.',t);p++;n=node();}
          else {n=read(1);let tuple=false;while(at(',')){tuple=true;p++;if(at(')'))break;read(1);}take(')');if(tuple)n=node();}
        }
      } else if (t.t === '[' || t.t === '{') {
        if (!py && !options.initializer) fail('An initializer is only supported in a declaration.',t);
        if (language==='c' && t.t==='{') initializer();
        else {p++;args(t.t === '[' ? ']' : '}',py && t.t === '{');}
        n=node();
      } else if (/^(?:[rRbBuUfF]{0,2})?["']/.test(t.t)) {
        p++; while (/^(?:[rRbBuUfF]{0,2})?["']/.test(a[p]?.t || '')) p++;
        n=node();n.literal=true;
      } else if (/^(?:\d|\.\d)/.test(t.t)) {
        if (py && !/^(?:0[xX][\da-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|(?:\d[\d_]*(?:\.[\d_]*)?|\.[\d_]+)(?:[eE][+-]?[\d_]+)?[jJ]?)$/.test(t.t)) fail('Malformed numeric literal.',t);
        if(py && (/__|_$/.test(t.t)||/^0[\d_]*[1-9][\d_]*$/.test(t.t)))fail('Malformed numeric literal.',t);
        p++;n=node();n.literal=true;
      } else if (id(t.t) && !(py?pythonKeywords:language==='java'?javaKeywords:cKeywords).has(t.t) && (py || !basic.has(t.t)) || ['True','False','None','true','false','null','nullptr','this','super'].includes(t.t)) {
        if(py&&pythonKeywords.has(t.t)&&!['True','False','None'].includes(t.t))fail('A keyword cannot be used as a name.',t);
        p++; n=node(!['True','False','None','true','false','null','nullptr'].includes(t.t));
      } else if (['int','float','bool','str','char','double','long','short','String'].includes(t.t) && a[p+1]?.t==='(') {
        p++;n=node();
      } else fail(`Expected an expression; found '${t.t}'.`,t);
      while (p<a.length) {
        if (at('(')) {if(n.literal)fail('A literal value cannot be called as a function.',a[p]);p++;args(')');n=node(false,true);}
        else if (at('[')) {
          p++;if(!py&&at(']'))fail('An array index is missing.',a[p]);
          if(!at(']')&&!at(':'))read(1);
          if(py&&at(':')) {p++;if(!at(']')&&!at(':'))read(1);if(at(':')){p++;if(!at(']'))read(1);}}
          take(']');n=node(true,n.effect);
        } else if (['.','->','::'].includes(a[p]?.t)) {
          if(py && a[p].t!=='.')fail('Use a dot for attribute access in Python.',a[p]);
          p++;if(!validName(a[p]?.t))fail('Expected a member name.',a[p]||a[p-1]);p++;n=node(true,n.effect);
        } else if(!py && (at('++')||at('--'))) {
          if(!n.target)fail('Increment/decrement needs a variable or array element.',a[p]);p++;n=node(false,true);
        } else break;
      }
      return n;
    }
    function read(min) {
      if(++recursion>80)fail('This expression is too deeply nested. Simplify it into multiple assignments.',a[p]);
      let left=atom();
      for (;;) {
        let op=a[p]?.t,consume=1;
        if(py&&op==='not'&&a[p+1]?.t==='in'){op='not in';consume=2;}
        if(py&&op==='is'&&a[p+1]?.t==='not'){op='is not';consume=2;}
        if(!py&&op==='?'&&min<=1){p++;read(1);take(':');read(1);left=node();continue;}
        if(py&&op==='if'&&min<=1){p++;read(2);take('else');read(1);left=node();continue;}
        const assignment=!py&&assignments.has(op),prec=assignment?1:binary[op];
        if(prec===undefined||prec<min)break;
        if(py&&['&&','||'].includes(op))fail('Use and/or in Python conditions.',a[p]);
        if(!py&&['and','or','in','is','not in','is not','//','**','@'].includes(op))fail(`'${op}' is not supported in this language.`,a[p]);
        if(assignment&&!left.target)fail('The left side of an assignment must be a variable, member, or array element.',a[p]);
        if(assignment&&options.noAssignment)fail('Use a comparison (==), not assignment (=), in a condition.',a[p]);
        p+=consume;const right=read(prec+(assignment||op==='**'?0:1));left=node(false,left.effect||right.effect||assignment);
      }
      recursion--;return left;
    }
    const result=read(1);
    while(options.tuple && at(',')){p++;if(p<a.length)read(1);}
    if(p!==a.length)fail(`Unexpected '${a[p].t}'. Check for a missing operator or statement separator.`,a[p]);
    return result;
  }
  function target(a) {
    if(!a.length)fail('An assignment target is missing.',a[0]);
    if(a[0]?.t==='('&&a[a.length-1]?.t===')')return target(a.slice(1,-1));
    const parts=split(a,',');
    if(parts.length>1){parts.forEach(x=>target(x));return;}
    if(a[0]?.t==='*')a=a.slice(1);
    const result=expression(a);
    if(!result.target)fail('Invalid assignment target. Use a variable, member, or array element.',a[0]);
  }
  function arrayEnd(part, start) {
    let p=start;
    while (part[p]?.t==='[') {
      const end=closing(part,p,'[',']');
      if (end>p+1) expression(part.slice(p+1,end));
      p=end+1;
    }
    return p;
  }
  function declaration(a, parameter=false, {member=false,addAlias,onType,onName,unnamed=false}={}) {
    const end=typeEnd(a);
    if(end<0)return false;
    if(onType)onType(end);
    if(end===a.length) {
      if(parameter && (unnamed || (a.length===1 && a[0].t==='void')))return true;
      fail('A declaration needs a variable name.',a[a.length-1]);
    }
    const parts=split(a.slice(end),',');
    for(const part of parts) {
      let p=language==='c'?pointerEnd(part,0):0;
      while(['*','&','&&','const'].includes(part[p]?.t))p++;
      const grouped=language==='c' && part[p]?.t==='(' && part[p+1]?.t==='*';
      if (grouped) p=pointerEnd(part,p+1);
      const name=validName(part[p]?.t)?part[p++]:null;
      if (!name && !(member && part[p]?.t===':') && !(unnamed && (!part[p] || ['[',')'].includes(part[p].t)))) {
        fail('Expected a variable or parameter name after the type.',part[p]||a.at(-1));
      }
      if(!addAlias&&a.slice(0,end).find(t=>!modifiers.has(t.t))?.t==='void'&&!part.slice(0,p).some(t=>t.t==='*'))fail('A variable cannot have type void.',a[0]);
      p=arrayEnd(part,p);
      if (grouped) {
        if (part[p]?.t!==')') fail("Expected ')' after the pointer declarator.",part[p]||part.at(-1));
        p++;
        p=arrayEnd(part,p);
      }
      if ((grouped||addAlias) && part[p]?.t==='(') {
        const close=closing(part,p,'(',')');
        parameters(part.slice(p+1,close),false,true);
        p=close+1;
      }
      if(name&&onName)onName(name);
      if(p===part.length){if(addAlias)addAlias(name);continue;}
      if(member && part[p].t===':'){expression(part.slice(p+1),{noAssignment:true,token:part[p]});continue;}
      if(member||addAlias)fail(`Unexpected '${part[p].t}' in declaration.`,part[p]);
      if(part[p].t==='=')expression(part.slice(p+1),{initializer:true,token:part[p]});
      else if(part[p].t==='(' && part[part.length-1]?.t===')') {
        if(language==='java')fail('Use = new Type(...) to initialize an object in Java.',part[p]);
        split(part.slice(p+1,-1),',').filter(x=>x.length).forEach(x=>expression(x));
      } else if(part[p].t==='{'&&part[part.length-1]?.t==='}')expression(part.slice(p),{initializer:true});
      else fail(`Unexpected '${part[p].t}' in declaration.`,part[p]);
    }
    return true;
  }
  function statement(a, allowEmpty=false) {
    if(!a.length){if(allowEmpty)return;fail('Empty statement.',a[0]);}
    if(language!=='python') {
      if(declaration(a))return;
      const stream=a.map(x=>x.t).join('');
      if(/^(std::)?(cin>>|cout<<|cerr<<)/.test(stream)) {
        expression(a);
        const input=/^(std::)?cin>>/.test(stream),sep=input?'>>':'<<';
        const start=a.findIndex(x=>x.t===sep);
        split(a.slice(start+1),sep).forEach(x=>input?target(x):expression(x));
        return;
      }
      for(const part of split(a,',')) {
        const result=expression(part);
        if(!result.effect)fail('This statement has no action. Use a declaration, assignment, increment, or function call.',part[0]);
      }
      return;
    }
    let d=0,eq=-1;
    for(let i=0;i<a.length;i++) {
      if(['(','[','{'].includes(a[i].t))d++;
      if([')',']','}'].includes(a[i].t))d--;
      if(!d&&assignments.has(a[i].t)){eq=i;break;}
    }
    if(eq>=0){target(a.slice(0,eq));if(a[eq].t==='='&&split(a.slice(eq+1),'=').length>1)statement(a.slice(eq+1));else expression(a.slice(eq+1),{tuple:true,token:a[eq]});}
    else {const result=expression(a);if(!result.effect)fail('This line has no action. Use an assignment or a function call.',a[0]);}
  }
  function parameters(a, python=false, unnamed=false, scope) {
    if(!a.length)return;
    const names=new Set();let sawDefault=false,sawStar=false;
    const parts=split(a,',');
    for(const [index,part] of parts.entries()) {
      if(!part.length) {if(python&&index===parts.length-1&&parts[index-1]?.length)continue;fail('Missing function parameter.',a[a.length-1]);}
      if(python) {
        let k=0;if(['*','**'].includes(part[k]?.t)){sawStar=true;k++;}
        if(!validName(part[k]?.t))fail('Expected a parameter name.',part[k]||part[0]);
        const name=part[k++].t;if(names.has(name))fail(`Duplicate parameter '${name}'.`,part[0]);names.add(name);
        if(part[k]?.t===':'){const eq=part.findIndex(x=>x.t==='=');expression(part.slice(k+1,eq<0?part.length:eq));k=eq<0?part.length:eq;}
        if(part[k]?.t==='='){sawDefault=true;expression(part.slice(k+1));k=part.length;}
        else if(sawDefault&&!sawStar)fail('A required parameter cannot follow one with a default value.',part[0]);
        if(k!==part.length)fail('Invalid function parameter.',part[k]);
      } else {
        if(language==='c' && part.length===1 && part[0].t==='...' && index>0 && index===parts.length-1)continue;
        const onName=token=>{
          if(names.has(token.t))fail(`Duplicate parameter '${token.t}'.`,token);
          names.add(token.t);
          if(scope && language==='c')bind(token,scope,false);
        };
        declaration(part,true,{unnamed,onName})||fail('Expected a typed function parameter.',part[0]);
      }
    }
  }
  function signature(h, p=h.findIndex(t=>t.t==='('), scope) {
    const end=h.map(t=>t.t).lastIndexOf(')');
    if(p<1||end<0||!validName(h[p-1].t))fail('Expected a valid function declaration.',h[0]);
    const rt=h.slice(0,p-1);let k=typeEnd(rt);
    if(language==='c'&&k>=0)k=pointerEnd(rt,k);
    while(k>=0&&['*','&'].includes(rt[k]?.t))k++;
    if(k!==rt.length || k<1)fail('A function needs a supported return type before its name.',h[0]);
    if(end!==h.length-1)fail('Unsupported function suffix. Simplify the function declaration.',h[end+1]);
    parameters(h.slice(p+1,end),false,!scope&&language==='c',scope);
  }
  function program(result) {
    if(result.fns.length>20)fail('A single chart supports up to 20 functions. Generate a smaller section of this program.',result.fns[20]);
    let count=0;
    const seen=new Set();
    function body(nodes,loop=0,sw=0,inFunction=true,depth=0) {
      if(depth>50)fail('Control flow nesting is too deep. Split this code into smaller functions.',nodes[0]);
      for(const n of nodes) {
        if(++count>500)fail('This program has too many flowchart steps. Generate a smaller section (up to 500 steps).',n);
        if(n.k==='brk'&&!loop&&!sw)fail('break is only valid inside a loop or switch.',n);
        if(n.k==='cnt'&&!loop)fail('continue is only valid inside a loop.',n);
        if(n.k==='ret'){if(!inFunction)fail('return is only valid inside a function.',n);if(n.q.length)expression(n.q,{tuple:language==='python'});}
        if(n.pk==='prompt')expression(n.q);
        else if(n.q&&['p','in','out'].includes(n.k)&&n.pk!=='glob')statement(n.q);
        if(n.ct && n.ct.length)expression(n.ct,{noAssignment:true});
        else if(['if','while','do','sw'].includes(n.k))fail('A condition or switch expression is missing.',n);
        if(n.k==='if'){body(n.y,loop,sw,inFunction,depth+1);if(n.e)body(n.e,loop,sw,inFunction,depth+1);}
        if(['while','for','do'].includes(n.k)){
          if(n.it?.length)statement(n.it);
          if(n.stt?.length)statement(n.stt);
          if(n.rft){if(language==='python')target(n.rft[0]);else if(!declaration(n.rft[0]))fail('A range loop needs a typed iteration variable.',n);expression(n.rft[1]);}
          body(n.b,loop+1,sw,inFunction,depth+1);
        }
        if(n.k==='sw')body(n.cs.flatMap(c=>c.b),loop,sw+1,inFunction,depth+1);
      }
    }
    (result.globq||[]).forEach(a=>declaration(a)||fail('Expected a global variable declaration.',a[0]));
    for(const f of result.fns){
      if(!validName(f.name))fail('Invalid function name.',f);
      // Overloading needs call resolution that this structured subset does not yet model.
      if(seen.has(f.name))fail(`Multiple definitions of '${f.name}' are not supported. Use distinct function names.`,f);seen.add(f.name);
      body(f.body,0,0,!f.script);
    }
    return result;
  }
  return {begin,lex,expression,statement,declaration,parameters,signature,program,fail,typeEnd,typeOnly,valueDeclaration,isValue,aggregatePrefix,validName};
})();
if(typeof module !== 'undefined')module.exports=Syntax;
