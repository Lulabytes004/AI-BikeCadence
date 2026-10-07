const test=require('node:test'),assert=require('node:assert/strict');
const {PoseTracks}=require('../cadence.js');
const rpms=[50,60,70,80,90,100,110,120];
function pose(i,t,still=false){
 const x=.13+(i%4)*.245,y=.13+Math.floor(i/4)*.46;
 const lm=Array.from({length:33},()=>({x,y,visibility:.99}));
 for(const k of [11,12])lm[k].y=y;
 for(const k of [23,24])lm[k].y=y+.11;
 for(const k of [25,26])lm[k].y=y+.2;
 const movement=still?0:.045*Math.sin(2*Math.PI*rpms[i]*t/60000);
 lm[27].y=y+.31+movement;lm[28].y=y+.31-movement;return lm;
}
test('eight different cadences keep their identities through shuffled pose output',()=>{
 const tracker=new PoseTracks();let tracks;
 for(let frame=0;frame<450;frame++){
  const t=frame*1000/30,indices=Array.from({length:8},(_,i)=>(i+frame)%8);
  if(frame%2)indices.reverse();
  tracks=tracker.update(indices.map(i=>pose(i,t)),t);
 }
 assert.equal(tracks.length,8);
 for(const track of tracks)assert.ok(Math.abs(track.result.rpm-rpms[track.id-1])<1,JSON.stringify(track.result));
});
test('one still cyclist cannot inherit cadence from the other seven',()=>{
 const tracker=new PoseTracks();let tracks;
 for(let frame=0;frame<450;frame++){const t=frame*1000/30;tracks=tracker.update(rpms.map((_,i)=>pose(i,t,i===3)),t);}
 assert.equal(tracks[3].result.rpm,0);assert.equal(tracks[3].result.cycles,0);
 for(const track of tracks.filter(x=>x.id!==4))assert.ok(Math.abs(track.result.rpm-rpms[track.id-1])<1);
});
test('briefly missing cyclist returns to the same ID without contaminating seven histories',()=>{
 const tracker=new PoseTracks();let tracks;
 for(let frame=0;frame<450;frame++){
  const t=frame*1000/30,indices=rpms.map((_,i)=>i).filter(i=>!(i===2 && frame>=240&&frame<255));
  tracks=tracker.update(indices.reverse().map(i=>pose(i,t)),t);assert.ok(tracks.length<=8);
 }
 for(const track of tracks)assert.ok(Math.abs(track.result.rpm-rpms[track.id-1])<1);
});
test('global matching avoids greedy swaps for nearby hips',()=>{
 const tracker=new PoseTracks();for(const t of [0,150,300])tracker.update([pose(0,t),pose(1,t)],t);
 // First new pose is nearer track 2; the second must also map to track 2.
 // Globally, first->track 1 and second->track 2 is the lower-cost pairing.
 const a=pose(0,333),b=pose(1,333);for(const p of a)p.x=.27;for(const p of b)p.x=.36;
 const tracks=tracker.update([a,b],333);
 assert.equal(tracks[0].lm,a);assert.equal(tracks[1].lm,b);
});
test('track count remains bounded and free IDs are reused after expiry',()=>{
 const tracker=new PoseTracks();let tracks;
 for(const t of [0,150,300])tracks=tracker.update(rpms.map((_,i)=>pose(i,t)),t);
 assert.equal(tracks.length,8);
 assert.equal(tracker.update(rpms.map((_,i)=>pose(i,2000)),2000).length,0);
 for(const t of [2150,2300])tracks=tracker.update(rpms.map((_,i)=>pose(i,t)),t);
 assert.deepEqual(tracks.map(t=>t.id),[1,2,3,4,5,6,7,8]);
});
test('duplicate head and shoulders with displaced hips cannot create or steal an identity',()=>{
 const tracker=new PoseTracks();let tracks;
 for(let frame=0;frame<180;frame++){
  const t=frame*1000/30,a=pose(0,t),b=pose(1,t),poses=[b,a];
  if(frame===90){
   const duplicate=a.map(p=>({...p}));duplicate[0].visibility=.8;
   for(const i of [23,24]){duplicate[i].x-=.07;duplicate[i].y+=.06;}
   poses.unshift(duplicate);
  }
  tracks=tracker.update(poses,t);
  if(t<300){assert.equal(tracks.length,0);continue;}
  assert.deepEqual(tracks.map(t=>t.id),[1,2]);
  assert.equal(tracks[0].lm,a);assert.equal(tracks[1].lm,b);
 }
 assert.ok(Math.abs(tracks[0].result.rpm-rpms[0])<1);
 assert.ok(Math.abs(tracks[1].result.rpm-rpms[1])<1);
});

test('isolated false pose never appears or reserves a cyclist number',()=>{
 const tracker=new PoseTracks();let tracks;
 for(const t of [0,100,200,300,400]){
  const poses=[pose(0,t),pose(1,t)];if(t===0)poses.push(pose(2,t));
  tracks=tracker.update(poses,t);
  assert.deepEqual(tracks.map(t=>t.id),t<300?[]:[1,2]);
 }
 assert.equal(tracks[0].x,.13);assert.equal(tracks[1].x,.375);
});

test('32 riders keep separate histories with shuffled observations',()=>{
 const tracker=new PoseTracks(32),positions=Array.from({length:32},(_,i)=>({x:.06+(i%8)*.12,y:.03+Math.floor(i/8)*.23}));
 function crowdedPose(i,t){
  const {x,y}=positions[i],lm=Array.from({length:33},()=>({x,y,visibility:.99}));
  for(const k of [11,12])lm[k].y=y+.02;
  for(const k of [23,24])lm[k].y=y+.06;
  for(const k of [25,26])lm[k].y=y+.11;
  const movement=.025*Math.sin(2*Math.PI*(50+i*2)*t/60000);
  lm[27].y=y+.17+movement;lm[28].y=y+.17-movement;return lm;
 }
 let tracks;
 for(let frame=0;frame<400;frame++){
  const t=frame*1000/30,indices=positions.map((_,i)=>(i+frame)%32);if(frame%2)indices.reverse();
  tracks=tracker.update(indices.map(i=>crowdedPose(i,t)),t);
 }
 assert.equal(tracks.length,32);assert.equal(new Set(tracks.map(t=>t.id)).size,32);
 for(const track of tracks){
  const i=positions.findIndex(p=>Math.abs(p.x-track.x)<1e-8&&Math.abs(p.y+.06-track.y)<1e-8);
  assert.notEqual(i,-1);assert.ok(Math.abs(track.result.rpm-(50+i*2))<1,JSON.stringify(track.result));
 }
});
