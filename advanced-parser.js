import {parser as python} from '@lezer/python';
import {parser as java} from '@lezer/java';
import {parser as cpp} from '@lezer/cpp';

const grammars = {python, java, cpp};
const blocks = new Set(['Block', 'Body', 'CompoundStatement', 'ConstructorBody']);
const functions = new Set(['FunctionDefinition', 'MethodDeclaration', 'ConstructorDeclaration']);
const punctuation = new Set(['{','}',':',';']);
const children = n => {
  const out = [];
  for (let c = n.firstChild; c; c = c.nextSibling)
    if (!c.name.includes('Comment')) out.push(c);
  return out;
};

export function parse(source, lang) {
  const grammar = lang === 'c' ? 'cpp' : lang;
  const tree = grammars[grammar].parse(source);
  const program = {advanced:true, lang, fns:[], glob:[], globq:[], vars:new Set()};
  const raw = n => source.slice(n.from, n.to).trim();
  const line = n => source.slice(0, n.from).split('\n').length;
  const fail = (n, m) => { throw {m, l:line(n)}; };
  const find = (n, name) => children(n).find(c => c.name === name);
  const block = n => children(n).find(c => blocks.has(c.name));
  const content = n => children(n).filter(c => !punctuation.has(c.name));
  const trim = s => s.replace(/;$/, '').trim();
  const inner = n => raw(n).replace(/^\(([\s\S]*)\)$/, '$1');
  const body = (n, ctx) => blocks.has(n.name) ? statements(content(n),ctx) : statement(n,ctx);
  const action = (n, verb, value, k='p') => ({k,verb,value,t:verb+' '+value,l:line(n)});
  const names = new Set();
  let anonymousLambda=0;
  function recordCalls(s,n,ctx) {
    const targets = [];
    function scan(c) {
      if (c.name === 'LambdaExpression') {
        if(grammar!=='cpp') fail(c,'Nested lambda bodies are not supported here.');
        const b=block(c);
        const name=(ctx.fn||'global')+'::lambda'+(++anonymousLambda);
        define(name,name+' '+source.slice(c.from,b.from).trim(),b,ctx);
        return;
      }
      if (['CallExpression','MethodInvocation'].includes(c.name)) {
        const first = children(c)[0];
        if (first && ['Identifier','VariableName','MethodName'].includes(first.name))
          targets.push(raw(first));
      }
      children(c).forEach(scan);
    }
    scan(n);
    // A plain Java method invocation resolves in the current class. Other
    // receiver types and callable values need information beyond this tree.
    s.directCalls=grammar==='java'?targets.filter(t=>ctx.scope+t===ctx.fn).map(()=>ctx.fn):[];
    return s;
  }

  // The Java grammar recognizes arrow rules but recovers between "return"
  // and "switch". Accept only this exact missing-expression recovery.
  function switchPrefix(n) {
    if(grammar!=='java'||n?.nextSibling?.name!=='SwitchStatement'||n.nextSibling.nextSibling?.name!==';') return null;
    if(n.name==='ReturnStatement' && raw(n)==='return') return {verb:'Return',k:'ret',prefix:''};
    const assign=n.getChild('AssignmentExpression')||n.getChild('VariableDeclarator');
    if(!assign||!['LocalVariableDeclaration','ExpressionStatement'].includes(n.name)) return null;
    const [id,op]=children(assign);
    if(!op) return null;
    if(!['Identifier','Definition'].includes(id.name)||raw(op)!=='='||!raw(n).endsWith('=')) return null;
    return {verb:n.name==='LocalVariableDeclaration'?'Declare':'Assign',k:'p',prefix:raw(n)+' '};
  }
  let depth=0, count=0;
  tree.iterate({enter(ref) {
    if (++depth>150 || ++count>15000) fail(ref,'Program is too deeply nested or too large to diagram.');
    if (ref.type.isError && !(ref.from===ref.to &&
      [ref.node.parent,ref.node.parent?.parent].some(p=>p && p.to===ref.from && switchPrefix(p))))
      fail(ref,'Invalid or unsupported '+grammar+' syntax near '+JSON.stringify(source.slice(ref.from,ref.from+24).split('\n')[0])+'.');
  },leave(){depth--;}});
  function statements(nodes,ctx) {
    const items=[];
    for(let i=0;i<nodes.length;i++) {
      const prefix=switchPrefix(nodes[i]);
      if(prefix) items.push(switchRules(nodes[++i],ctx,prefix));
      else items.push(...statement(nodes[i],ctx));
    }
    return items;
  }
  function switchRules(n,ctx,returns) {
    const cases=content(find(n,'SwitchBlock')).map(rule=>{
      if(rule.name!=='SwitchRule') fail(rule,'Only arrow switch rules are supported here.');
      const [label,value]=children(rule);
      const lab=raw(label);
      if(returns && !['ExpressionStatement','ThrowStatement'].includes(value.name))
        fail(value,'Use an expression or throw in a returned switch rule.');
      const b=returns && value.name==='ExpressionStatement'
        ? [recordCalls(action(value,returns.verb,returns.prefix+trim(raw(value)),returns.k),value,ctx)]
        : body(value,{...ctx,canBreak:true});
      return {lab,d:lab==='default',b,arrow:true};
    });
    return {k:'sw',c:inner(find(n,'ParenthesizedExpression')),cs:cases,l:line(n)};
  }
  function statement(n,ctx) {
    const a=children(n), l=line(n), name=n.name;
    if(blocks.has(name)) return body(n,ctx);
    if(punctuation.has(name)||name==='PassStatement') return [];
    if(name==='StatementGroup') return statements(content(n),ctx);
    if(name==='IfStatement') {
      if(grammar!=='python') {
        const [kw,cond,yes,otherwise,no]=a;
        if(kw.name!=='if'||!yes||otherwise&&otherwise.name!=='else') fail(n,'Unsupported conditional header.');
        return [{k:'if',c:inner(cond),y:body(yes,ctx),e:no?body(no,ctx):null,l}];
      }
      let root,last;
      for(let i=0;i<a.length;) {
        const kw=a[i++];
        if(kw.name==='else') {last.e=body(a[i++],ctx);break;}
        const c=raw(a[i++]), clause={k:'if',c,y:body(a[i++],ctx),l:line(kw)};
        if(last) last.e=[clause]; else root=clause;
        last=clause;
      }
      return [root];
    }
    if(['ForRangeLoop','ForStatement','EnhancedForStatement','WhileStatement','DoStatement'].includes(name)) {
      const elseIndex=a.findIndex(c=>c.name==='else');
      const otherwise=elseIndex<0?[]:body(a[elseIndex+1],ctx);
      if(elseIndex>=0) a.splice(elseIndex);
      const loop={...ctx,loop:true,canBreak:true};
      if(name==='WhileStatement'||name==='DoStatement') {
        const isDo=name==='DoStatement';
        const cond=isDo?a.find(c=>/ConditionClause|ParenthesizedExpression/.test(c.name)):a[1];
        if(!cond) fail(n,'Unsupported loop condition.');
        return [{k:isDo?'do':'while',c:inner(cond),b:body(isDo?a[1]:a[2],loop),otherwise,l}];
      }
      const spec=find(n,'ForSpec');
      const b=body(a.at(-1),loop);
      let target,iter;
      if(grammar==='python') {
        const kw=find(n,'for'), delim=find(n,'in');
        target=source.slice(kw.to,delim.from).trim();
        iter=source.slice(delim.to,a.at(-1).from).trim();
      } else if(name==='ForRangeLoop'||name==='EnhancedForStatement') {
        const header=spec?children(spec):a;
        const open=header.findIndex(c=>c.name==='('), close=header.findIndex(c=>c.name===')');
        const expr=header[close-1];
        iter=raw(expr);
        target=source.slice(header[open].to,expr.from).trim().replace(/:$/,'').trim();
      } else {
        const header=spec?children(spec):a;
        const open=header.find(c=>c.name==='('),close=header.find(c=>c.name===')');
        // Use grammar child boundaries. C++ omits anonymous semicolon tokens.
        const exprs=header.filter(c=>c.from>=open.to && c.to<=close.from && c.name!==';');
        const slots=['','','']; let pos=open.to,slot=0;
        for(const expr of exprs) {
          slot+=(source.slice(pos,expr.from).match(/;/g)||[]).length;
          if(slot>2) fail(expr,'Unsupported for-loop header.');
          slots[slot]=trim(raw(expr)); if(raw(expr).endsWith(';')) slot++;
          pos=expr.to;
        }
        return [{k:'for',i:slots[0],c:slots[1]||'true',s:slots[2],b,l}];
      }
      b.unshift(action(n,'Bind',target+' to next item'));
      return [{k:'for',rf:[target,iter],c:(a[0].name==='async'?'Await next item in ':'Items left in ')+iter+'?',async:a[0].name==='async',b,otherwise,l}];
    }
    if(name==='SwitchStatement'&&grammar==='java') return [switchRules(n,ctx,false)];
    if(name==='TryStatement') {
      if(a.some(c=>/Resource/.test(c.name))) fail(n,'Try-with-resources cleanup is not supported.');
      let cleanup=[],otherwise=[];
      const handlers=[];
      if(grammar==='python') {
        for(let i=2;i<a.length;) {
          const kw=a[i++];
          if(kw.name==='finally'){cleanup=body(a[i++],ctx);continue;}
          if(kw.name==='else'){otherwise=body(a[i++],ctx);continue;}
          if(kw.name!=='except') fail(kw,'Unsupported exception clause.');
          const start=kw.to;
          while(i<a.length && a[i].name!=='Body') i++;
          const handler=a[i++],type=source.slice(start,handler.from).trim();
          handlers.push({lab:type||'any exception',all:!type,b:body(handler,ctx)});
        }
      } else for(const clause of a.slice(2)) {
        if(clause.name==='FinallyClause'){cleanup=body(block(clause),ctx);continue;}
        if(clause.name!=='CatchClause') fail(clause,'Unsupported exception clause.');
        const type=inner(children(clause)[1]);
        handlers.push({lab:type,all:type==='...',b:body(block(clause),ctx)});
      }
      return [{k:'try',b:body(a[1],ctx),handlers,cleanup,otherwise,l}];
    }
    if(['BreakStatement','ContinueStatement'].includes(name)) {
      const cont=name==='ContinueStatement';
      if(!(cont?ctx.loop:ctx.canBreak)||a.filter(c=>c.name!==';').length!==1)
        fail(n,'Jump requires a supported enclosing target.');
      return [action(n,cont?'Continue':'Break','',cont?'cnt':'brk')];
    }
    if(['ReturnStatement','ThrowStatement','RaiseStatement','YieldStatement'].includes(name)) {
      if(!ctx.fn && ['ReturnStatement','YieldStatement'].includes(name)) fail(n,'Transfer requires an enclosing function.');
      const k=name==='ReturnStatement'?'ret':name==='YieldStatement'?'p':'throw';
      const value=trim(source.slice(a[0].to,n.to));
      return [recordCalls(action(n,k==='ret'?'Return':k==='throw'?'Throw':'Yield',value,k),n,ctx)];
    }
    if(['ExpressionStatement','AssignStatement','UpdateStatement','Declaration','LocalVariableDeclaration','ImportStatement'].includes(name)) {
      const value=trim(raw(n));
      const lambda=a.flatMap(c=>children(c)).find(c=>c.name==='LambdaExpression');
      if(lambda) {
        const declarator=a.find(c=>c.name==='InitDeclarator');
        if(!declarator||a.filter(c=>c.name==='InitDeclarator').length!==1) fail(n,'Use one named lambda per declaration.');
        const id=children(declarator)[0], b=block(lambda);
        const lambdaName=ctx.fn+'::'+raw(id);
        define(lambdaName,source.slice(lambda.from,b.from).trim(),b,ctx);
        return [action(n,'Declare',source.slice(n.from,b.from).trim()+' {…}')];
      }
      const verb=/Declaration/.test(name)?'Declare':name==='AssignStatement'?'Assign':name==='ImportStatement'?'Import':'Evaluate';
      return [recordCalls(action(n,verb,value),n,ctx)];
    }
    fail(n,'Diagramming '+name+' is not supported yet.');
  }

  function define(name,signature,b,ctx) {
    if(names.has(name)) fail(b,'Overloaded or duplicate function '+name+' requires distinct diagram names.');
    if(names.size>=20) fail(b,'Use at most 20 functions per diagram.');
    names.add(name);
    const f={name,params:'',disp:signature,l:line(b),body:[]};
    program.fns.push(f);
    f.body=body(b,{...ctx,fn:name,loop:false,canBreak:false});
  }
  function declarations(n,ctx,script) {
    const a=children(n);
    if(n.name==='DecoratedStatement') {
      if(script) for(const d of a.slice(0,-1)) script.push(action(d,'Evaluate decorator',raw(d).slice(1)));
      declarations(a.at(-1),ctx,script);
      if(script) for(const d of a.slice(0,-1).reverse()) script.push(action(d,'Apply decorator',raw(d).slice(1)));
    } else if(['ClassDefinition','ClassDeclaration','StructSpecifier','ClassSpecifier','InterfaceDeclaration','NamespaceDefinition'].includes(n.name)) {
      const id=a.find(c=>['VariableName','TypeIdentifier','Definition','Identifier'].includes(c.name));
      if(!id) fail(n,'Anonymous types are not supported.');
      const scope=ctx.scope+raw(id)+'.';
      const b=a.find(c=>blocks.has(c.name)||['FieldDeclarationList','ClassBody','InterfaceBody'].includes(c.name));
      if(script) script.push(action(n,'Begin class',scope.slice(0,-1)));
      if(b) for(const member of content(b)) declarations(member,{scope},script);
      if(script) script.push(action(n,'Define class',scope.slice(0,-1)));
    } else if(n.name==='TemplateDeclaration') declarations(a.at(-1),ctx,script);
    else if(functions.has(n.name)) {
      const b=block(n); if(!b) return; // Interface/prototype: no executable body.
      let id=a.find(c=>['VariableName','Definition'].includes(c.name));
      if(!id) {
        let decl=a.find(c=>c.name.endsWith('Declarator'));
        while(decl && decl.name!=='FunctionDeclarator') decl=children(decl).find(c=>c.name.endsWith('Declarator'));
        id=decl&&children(decl)[0];
      }
      if(!id) fail(n,'Unsupported function declarator.');
      const simple=raw(id),name=ctx.scope+simple;
      const signature=source.slice(n.from,b.from).trim();
      define(name,signature,b,ctx);
      if(script) script.push(action(n,'Define function',name+' '+signature));
      if(grammar==='java'&&simple==='main'&&/\bstatic\b/.test(raw(n).split('{')[0])) program.fns.at(-1).entry=true;
    } else if(n.name==='PreprocDirective') {
      if(!/^#\s*include\b/.test(raw(n))) fail(n,'Only include directives are supported.');
    } else if(['PackageDeclaration','ImportDeclaration','UsingDeclaration','AccessSpecifier'].includes(n.name)||punctuation.has(n.name)) return;
    else if(n.name==='FieldDeclaration' && !/=|\{/.test(raw(n))) return;
    else if(script) script.push(...statement(n,ctx));
    else fail(n,'Diagramming '+n.name+' at declaration scope is not supported yet.');
  }
  const script=[];
  for(const n of content(tree.topNode)) declarations(n,{scope:''},grammar==='python'?script:null);
  if(script.length) program.fns.unshift({name:'__main__',disp:'Main program',params:'',body:script,script:true});
  if(!program.fns.length) fail(tree.topNode,'No executable function or script was found.');
  return program;
}

// A shared structured outline keeps branch bodies and transfer instructions
// identical across the two text views.
function terminates(s) {
  const stops=body=>body.some(terminates);
  if(['ret','brk','cnt','throw'].includes(s.k))return true;
  if(s.k==='if')return s.e && stops(s.y) && stops(s.e);
  if(s.k==='try')return stops(s.cleanup) ||
    ((stops(s.b)||stops(s.otherwise)) && s.handlers.every(h=>stops(h.b)));
  return false;
}
export function outline(body) {
  const rows=[];
  const row=(text,children=[])=>({text,children});
  for(const s of body) {
    if(s.k==='if') {
      rows.push(row('If '+s.c,outline(s.y)));
      if(s.e) rows.push(row('Else',outline(s.e)));
    } else if(['while','for','do'].includes(s.k)) {
      if(s.i) rows.push(row('Initialize '+s.i));
      const heading=s.rf?(s.async?'Async for each ':'For each ')+s.rf[0]+' in '+s.rf[1]:s.k==='do'?'Repeat':'While '+s.c;
      const items=outline(s.rf?s.b.slice(1):s.b);
      rows.push(row(heading+(s.s?' (update '+s.s+' after each iteration)':''),items));
      if(s.otherwise?.length) rows.push(row('On normal loop completion',outline(s.otherwise)));
      if(s.k==='do') rows.push(row('Repeat while '+s.c));
    } else if(s.k==='sw') rows.push(row('Switch '+s.c,s.cs.map(c=>row(c.lab,outline(c.b)))));
    else if(s.k==='try') {
      rows.push(row('Try',outline(s.b)));
      for(const h of s.handlers) rows.push(row('Catch '+h.lab,outline(h.b)));
      if(s.otherwise.length) rows.push(row('Else',outline(s.otherwise)));
      if(s.cleanup.length) rows.push(row('Finally',outline(s.cleanup)));
    } else rows.push(row((s.verb+' '+s.value).trim()));
    if(terminates(s)) break;
  }
  return rows;
}

export function pseudocode(program) {
  const lines=[];
  function write(rows,depth) {
    for(const r of rows) {
      lines.push('    '.repeat(depth)+r.text.replace(/^\S+/,s=>s.toUpperCase()));
      write(r.children,depth+1);
    }
  }
  for(const f of program.fns) {
    lines.push(f.script?'PROGRAM':'FUNCTION '+(f.disp||f.name));
    write(outline(f.body),1);
    lines.push(f.script?'END PROGRAM':'END FUNCTION','');
  }
  return lines.join('\n').trimEnd();
}
