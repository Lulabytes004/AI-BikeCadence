// Replay exported app landmarks through the production detector without a browser.
// node tests/replay-landmarks.cjs cadence-landmarks.json [--freeze-from=5000]
const fs=require('node:fs');
const {PoseTracks}=require('../cadence.js');
const [file,...options]=process.argv.slice(2);
if(!file){console.error('Usage: node tests/replay-landmarks.cjs FILE.json [--freeze-from=MILLISECONDS]');process.exit(1);}
const data=JSON.parse(fs.readFileSync(file,'utf8'));
const freezeOption=options.find(x=>x.startsWith('--freeze-from='));
const freezeFrom=freezeOption?Number(freezeOption.split('=')[1]):Infinity;
if(Number.isNaN(freezeFrom))throw new Error('Invalid freeze time');
const tracker=new PoseTracks(), rows=[],stats={};let frozenPoses=null;
for(const frame of data.frames){
 const freeze=frame.time_ms>=freezeFrom;
 if(freeze && frozenPoses===null)frozenPoses=frame.poses;
 const tracks=tracker.update(freeze?frozenPoses:frame.poses,frame.time_ms,(data.width||1)/(data.height||1),freeze||frame.frozen_pixels);
 for(const track of tracks){
  const r=track.result,reference=data.references?.[track.id-1];
  rows.push({time_ms:frame.time_ms,cyclist:track.id,...r});
  const s=stats[track.id]??={samples:0,valid:0,sumError:0,reference:reference??null,last:r};s.samples++;s.last=r;
  if(r.rpm!==null&&r.quality>0){s.valid++;if(reference!=null)s.sumError+=Math.abs(r.rpm-reference);}
 }
}
for(const [id,s] of Object.entries(stats)){console.log(JSON.stringify({cyclist:Number(id),samples:s.samples,valid_samples:s.valid,coverage:s.valid/s.samples,reference_rpm:s.reference,mae_rpm:s.valid&&s.reference!==null?s.sumError/s.valid:null,last:s.last}));}
if(!rows.length)console.log('No person detected in exported frames. Pose recognition must be checked before cadence can be evaluated.');
