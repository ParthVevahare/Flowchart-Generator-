/* Natural diagram proportions. Raster exports bound browser memory use. */
const DiagramExport=(()=>{
  function rasterSize(chart){
    const scale=Math.min(300/96,8192/chart.W,8192/chart.H,Math.sqrt(24000000/(chart.W*chart.H)));
    return{width:Math.max(1,Math.floor(chart.W*scale)),height:Math.max(1,Math.floor(chart.H*scale)),dpi:96*scale};
  }
  function pdfPage(chart){
    const mm=25.4/96,scale=Math.min(1,5000/(chart.W*mm),5000/(chart.H*mm));
    return{width:chart.W*mm*scale,height:chart.H*mm*scale,orientation:chart.W>chart.H?'landscape':'portrait'};
  }
  function svg(chart,raster=false){
    const size=raster?rasterSize(chart):{width:chart.W,height:chart.H};
    const dimensions=`width="${size.width}" height="${size.height}"`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${chart.W} ${chart.H}" ${dimensions} preserveAspectRatio="xMidYMid meet" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"><rect width="${chart.W}" height="${chart.H}" fill="${chart.background||'#ffffff'}"/>${chart.inner}</svg>`;
  }
  async function png(canvas,dpi=300){
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG export failed')),'image/png'));
    const bytes=new Uint8Array(await blob.arrayBuffer()),view=new DataView(bytes.buffer);
    const density=new Uint8Array(21),d=new DataView(density.buffer);
    d.setUint32(0,9);density.set([112,72,89,115],4); // pHYs
    const ppm=Math.round(dpi/0.0254);d.setUint32(8,ppm);d.setUint32(12,ppm);density[16]=1;
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
  return{rasterSize,pdfPage,svg,png};
})();
