const fs=require('node:fs'),path=require('node:path');
const guides=require('./guide-content.cjs');
const root=path.resolve(__dirname,'..'),base='https://parthvevahare.github.io/Flowchart-Generator-/';
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const json=value=>JSON.stringify(value,null,2).replace(/</g,'\\u003c');
const check=process.argv.includes('--check');let stale=false;
function write(file,content){const target=path.join(root,file);if(check){if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==content){console.error('Regenerate '+file);stale=true;}}else{fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content);}}
const arrow='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg>';
function head(title,description,url,graph){return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}"><meta name="robots" content="index, follow, max-image-preview:large">
<meta property="og:type" content="website"><meta property="og:site_name" content="Flowchart Generator"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${url}">
<meta property="og:image" content="${base}assets/logo-light.png"><meta property="og:image:width" content="1024"><meta property="og:image:height" content="1024"><meta property="og:image:alt" content="Flowchart Generator decision diamond logo">
<meta name="twitter:card" content="summary"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${base}assets/logo-light.png"><meta name="twitter:image:alt" content="Flowchart Generator decision diamond logo">
<link rel="icon" href="../assets/logo-light.svg" type="image/svg+xml"><link rel="stylesheet" href="guides.css"><link rel="sitemap" type="application/xml" href="../sitemap.xml">
<script type="application/ld+json">${json({'@context':'https://schema.org','@graph':graph})}</script>
</head><body><a class="skip-link" href="#content">Skip to content</a>
<header class="guide-header"><a class="guide-brand" href="../"><img src="../assets/logo-light.svg" width="32" height="32" alt="">Flowchart Generator</a><nav aria-label="Main navigation"><a href="./">Guides</a><a class="button small" href="../">Open generator ${arrow}</a></nav></header>`;}
const footer=`<footer class="guide-footer"><p>Flowchart Generator · by Parth V</p><nav aria-label="Site information"><a href="../">Generator</a><a href="./">All guides</a><a href="../privacy.html">Privacy</a><a href="../terms.html">Terms</a><a href="../sitemap.xml">Sitemap</a></nav></footer></body></html>\n`;
const breadcrumb=items=>({'@type':'BreadcrumbList',itemListElement:items.map(([name,item],i)=>({'@type':'ListItem',position:i+1,name,item}))});
function card(g){return `<a class="guide-card" href="${g.slug}.html"><span class="eyebrow">${esc(g.tag)}</span><h3>${esc(g.heading)}</h3><p>${esc(g.intro)}</p><span class="card-action">Read guide ${arrow}</span></a>`;}
for(const g of guides){
 const title=g.title+' | Flowchart Generator',url=base+'guides/'+g.slug+'.html';
 const graph=[{'@type':'TechArticle','@id':url+'#article',url,headline:g.title,description:g.description,inLanguage:'en',isPartOf:{'@id':base+'#website'},mainEntityOfPage:url},breadcrumb([['Generator',base],['Guides',base+'guides/'],[g.tag,url]])];
 const sections=g.sections.map((s,i)=>`<section id="section-${i}"><h2>${esc(s.heading)}</h2>${s.paragraphs.map(p=>`<p>${esc(p)}</p>`).join('')}</section>`).join('\n');
 const related=g.related.map(slug=>card(guides.find(x=>x.slug===slug))).join('');
 write('guides/'+g.slug+'.html',head(title,g.description,url,graph)+`
<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="../">Generator</a><span aria-hidden="true">/</span><a href="./">Guides</a><span aria-hidden="true">/</span><span aria-current="page">${esc(g.tag)}</span></nav>
<main id="content"><article>
<header class="article-hero"><p class="eyebrow">${esc(g.tag)} · A practical guide</p><h1>${esc(g.heading)}</h1><p class="lede">${esc(g.intro)}</p><a class="button" href="../?example=${g.slug}#generator">Try this example ${arrow}</a><p class="hero-note">Free in your browser. No sign-in needed to generate or export.</p></header>
<div class="article-layout"><aside class="contents"><nav aria-label="On this page"><strong>In this guide</strong>${g.sections.map((s,i)=>`<a href="#section-${i}">${esc(s.heading)}</a>`).join('')}<a href="#example">Runnable example</a><a href="#questions">Common questions</a></nav></aside>
<div class="article-body">${sections}
<section id="example"><div class="example-heading"><h2>Try it with real code</h2><span class="code-language">${esc(g.tag==='C++'?'C++':g.language==='c'?'C':g.language==='java'?'Java':'Python')}</span></div><pre data-language="${g.language}"><code>${esc(g.example)}</code></pre><a class="text-link" href="../?example=${g.slug}#generator">Open this example in the generator ${arrow}</a><p class="small-note">Examples are checked against the parser. The generator visualizes source structure; it does not execute your program.</p></section>
<section id="questions"><h2>Common questions</h2>${g.faqs.map(([q,a])=>`<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</section>
</div></div></article>
<section class="related"><p class="eyebrow">Keep exploring</p><h2>More ways to understand your code.</h2><div class="guide-grid">${related}</div></section>
<section class="guide-cta"><div><h2>Ready to map your program?</h2><p>Paste supported code, adjust the diagram, and export.</p></div><a class="button" href="../">Open generator ${arrow}</a></section></main>`+footer);
}
const indexTitle='Code to Flowchart Guides — Python, C, C++ & Java | Flowchart Generator';
const indexDescription='Learn to generate flowcharts from Python, C, C++ and Java. Explore runnable examples, loops, algorithms, pseudocode and SVG, PNG or PDF export guides.';
write('guides/index.html',head(indexTitle,indexDescription,base+'guides/',[
 {'@type':'CollectionPage',url:base+'guides/',name:'Code to flowchart guides',description:indexDescription,isPartOf:{'@id':base+'#website'},inLanguage:'en'},breadcrumb([['Generator',base],['Guides',base+'guides/']])
])+`<main id="content"><header class="article-hero hub-hero"><p class="eyebrow">Learn the paths through your program</p><h1>From source code<br>to a clearer explanation.</h1><p class="lede">Practical guides for turning programming logic into flowcharts. Start with your language, follow a real example, then make the diagram work for your notes, report or presentation.</p><a class="button" href="../">Open the free generator ${arrow}</a></header>
<section class="hub-section"><p class="eyebrow">Start with a language</p><h2>Your code. Its control flow.</h2><p>Choose C, C++, Python or Java to see a supported example and learn what the parser can represent. Each guide links straight to its example in the editor.</p><div class="guide-grid language-grid">${guides.slice(0,4).map(card).join('')}</div></section>
<section class="hub-section"><p class="eyebrow">Go one step further</p><h2>Read, explain and share the result.</h2><p>Understand branch and loop connectors, compare algorithms with pseudocode, and choose an export format. The guides explain the limits as well as the features, so a diagram is not mistaken for a runtime trace or a correctness proof.</p><div class="guide-grid">${guides.slice(4).map(card).join('')}</div></section>
<section class="guide-cta"><div><h2>No blank canvas to arrange.</h2><p>Paste supported source code. The generator lays out the nodes and connectors for you. You can change the theme, direction, labels and spacing before downloading SVG, PNG or PDF.</p></div><a class="button" href="../">Try the generator ${arrow}</a></section></main>`+footer);
const examples=Object.fromEntries(guides.map(g=>[g.slug,{language:g.language,source:g.example}]));
write('guide-examples.js','/* Generated by scripts/build-guides.cjs. */\nconst GuideExamples='+json(examples)+';\n');
const pages=['','privacy.html','terms.html','guides/',...guides.map(g=>'guides/'+g.slug+'.html')];
write('sitemap.xml','<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+pages.map(p=>'  <url><loc>'+base+p+'</loc></url>').join('\n')+'\n</urlset>\n');
if(stale)process.exitCode=1;else console.log(check?'Generated guides, examples and sitemap are current.':'Built '+guides.length+' guides, index, examples and '+pages.length+'-URL sitemap.');
