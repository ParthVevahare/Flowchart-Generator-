/* Shared A4 export dimensions. SVG stays vector; PNG includes print density. */
const DiagramExport=(()=>{
  const width=2480,height=3508;
  function svg(chart,raster=false){
    const dimensions=raster?`width="${width}" height="${height}"`:'width="210mm" height="297mm"';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${chart.W} ${chart.H}" ${dimensions} preserveAspectRatio="xMidYMid meet" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"><rect width="${chart.W}" height="${chart.H}" fill="${chart.background||'#ffffff'}"/>${chart.inner}</svg>`;
  }
  async function png(canvas){
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG export failed')),'image/png'));
    const bytes=new Uint8Array(await blob.arrayBuffer()),view=new DataView(bytes.buffer);
    const density=new Uint8Array(21),d=new DataView(density.buffer);
    d.setUint32(0,9);density.set([112,72,89,115],4); // pHYs
    d.setUint32(8,11811);d.setUint32(12,11811);density[16]=1; // 300 DPI in pixels/metre
    let crc=0xffffffff;
    for(const b of density.slice(4,17)){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
    d.setUint32(17,(crc^0xffffffff)>>>0);
    const chunks=[bytes.slice(0,8)];
    for(let offset=8;offset<bytes.length;){
      const size=view.getUint32(offset)+12,type=String.fromCharCode(...bytes.slice(offset+4,offset+8));
      if(type!=='pHYs')chunks.push(bytes.slice(offset,offset+size));
      if(type==='IHDR')chunks.push(density);
      offset+=size;
    }
    return new Blob(chunks,{type:'image/png'});
  }
  return{width,height,svg,png};
})();
