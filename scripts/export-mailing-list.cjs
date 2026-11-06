// Run in a trusted admin environment; never include this script or credentials in a browser bundle.
const fs=require('node:fs');
const csv=value=>'"'+String(value??'').replace(/^[=+@\-\t\r]/,"'$&").replace(/"/g,'""')+'"';
async function main(){
  const [projectId,output]=process.argv.slice(2);
  if(!projectId||!output)throw Error('Usage: node scripts/export-mailing-list.cjs PROJECT_ID OUTPUT.csv');
  const {initializeApp,applicationDefault}=require('firebase-admin/app');
  const {getFirestore}=require('firebase-admin/firestore');
  const db=getFirestore(initializeApp({projectId,credential:applicationDefault()}));
  const lines=['email,displayName,consentUpdatedAt'];let cursor=null;
  do{
    let query=db.collection('users').where('emailUpdates','==',true).orderBy('__name__').limit(500);
    if(cursor)query=query.startAfter(cursor);
    const snap=await query.get();
    for(const doc of snap.docs){const p=doc.data();lines.push([p.email,p.displayName,p.consentUpdatedAt?.toDate().toISOString()||''].map(csv).join(','));}
    cursor=snap.size===500?snap.docs.at(-1):null;
  }while(cursor);
  fs.writeFileSync(output,lines.join('\r\n')+'\r\n',{encoding:'utf8',flag:'wx',mode:0o600});
  console.log(`Exported ${lines.length-1} subscribed profiles. No emails sent.`);
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={csv};
