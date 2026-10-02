const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const {PoseTracks}=require('../cadence.js');
function load(view){return JSON.parse(zlib.gunzipSync(Buffer.from(fs.readFileSync(path.join(__dirname,'fixtures','two-cyclists-'+view+'.json.gz.b64'),'utf8'),'base64')));}
function pose(data,p){const lm=Array.from({length:33},()=>({x:0,y:0,visibility:0}));data.indices.forEach((i,n)=>{lm[i]={x:p[n][0],y:p[n][1],visibility:p[n][2]};});return lm;}
for(const view of ['frontal','lateral','45'])test(`actual MediaPipe points from two-cyclist ${view} clip recover 65 and 85 rpm`,()=>{
 const data=load(view),tracker=new PoseTracks(),stats={};
 for(const f of data.frames)for(const tr of tracker.update(f.p.map(p=>pose(data,p)),f.t,data.width/data.height)){
  const expected=tr.x<.5?65:85,s=stats[expected]??={seen:0,measured:0,sumError:0,last:null};s.seen++;
  if(tr.result.rpm>0){s.measured++;s.sumError+=Math.abs(tr.result.rpm-expected);s.last=tr.result.rpm;}
 }
 for(const expected of [65,85]){
  const s=stats[expected];assert.ok(s,'Missing rider '+expected);
  assert.ok(s.measured/s.seen>=(view==='lateral'?.15:.6),JSON.stringify(s));
  assert.ok(s.sumError/s.measured<3,JSON.stringify(s));
  assert.ok(Math.abs(s.last-expected)<3,JSON.stringify(s));
 }
});
test('freezing actual clip pose data cannot add cycles or retain rpm',()=>{
 const data=load('frontal'),tracker=new PoseTracks();let frozen=null,counts;
 for(const f of data.frames){
  if(f.t>=5000 && !frozen)frozen=f.p;
  const found=tracker.update((frozen??f.p).map(p=>pose(data,p)),f.t,data.width/data.height,!!frozen);
  if(frozen){if(!counts)counts=found.map(t=>t.result.cycles);found.forEach((t,i)=>{assert.equal(t.result.rpm,0);assert.equal(t.result.cycles,counts[i]);});}
 }
});
