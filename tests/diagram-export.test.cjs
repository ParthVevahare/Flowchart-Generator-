const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ctx=vm.createContext({Blob,Uint8Array,DataView});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../diagram-export.js'),'utf8')+'\nglobalThis.api=DiagramExport;',ctx);
const api=ctx.api;
test('SVG has natural vector dimensions for wide and tall diagrams',()=>{
 for(const [W,H]of [[2400,400],[350,4200]]){
  const svg=api.svg({W,H,inner:'<g/>',background:'#ffffff'});
  assert.ok(svg.includes('width="'+W+'" height="'+H+'"'));
  assert.ok(svg.includes('viewBox="0 0 '+W+' '+H+'"'));assert.ok(!svg.includes('mm'));
 }
});
test('raster dimensions retain the aspect ratio within canvas memory bounds',()=>{
 assert.equal(typeof api.rasterSize,'function');
 for(const [W,H]of [[2400,400],[350,4200],[50000,70000]]){
  const d=api.rasterSize({W,H});assert.ok(d.width<=8192&&d.height<=8192);assert.ok(d.width*d.height<=24000000);
  assert.ok(Math.abs(d.width/d.height-W/H)<.005);assert.ok(d.dpi>0);
 }
});
test('PDF page follows diagram proportions rather than A4',()=>{
 assert.equal(typeof api.pdfPage,'function');
 for(const [W,H]of [[2400,400],[350,4200],[50000,70000]]){
  const page=api.pdfPage({W,H});assert.ok(Math.abs(page.width/page.height-W/H)<1e-6);
  assert.ok(page.width<=5000&&page.height<=5000);assert.equal(page.orientation,W>H?'landscape':'portrait');
 }
});
