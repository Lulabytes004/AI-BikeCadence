const test=require('node:test'), assert=require('node:assert/strict');
const {CadenceDetector,PoseTracks}=require('../cadence.js');
function signal(t,rpm,name='Pie Izq.',phase=0,amp=.3,q=.99){return {name,v:1+amp*Math.sin(2*Math.PI*rpm*t/60000+phase),q};}
function run(det,rpm,duration=12000,options={}){let r;for(let t=0;t<=duration;t+=1000/30)r=det.update(t,[signal(t,rpm,'Pie Izq.',0,options.amp??.3)]);return r;}
test('static pose with high visibility never generates cadence or cycles',()=>{
 const d=new CadenceDetector();let r;for(let t=0;t<=12000;t+=33)r=d.update(t,[{name:'Pie',v:.8,q:1},{name:'Ángulo',v:90,q:1,type:'angle'}]);
 assert.equal(r.rpm,0);assert.equal(r.cycles,0);assert.equal(r.quality,0);
});
test('small landmark jitter is not pedaling',()=>{
 const d=new CadenceDetector();const r=run(d,85,15000,{amp:.012});assert.equal(r.rpm,0);assert.equal(r.cycles,0);
});
for(const rpm of [25,35,65,85,120,170])test(`estimates ${rpm} rpm from periodic motion`,()=>{
 const d=new CadenceDetector(),r=run(d,rpm,15000);assert.ok(Math.abs(r.rpm-rpm)<1,JSON.stringify(r));assert.ok(r.cycles>0);assert.ok(r.quality>.7);
});
test('flat drift is not periodic',()=>{
 const d=new CadenceDetector();let r;for(let t=0;t<=10000;t+=33)r=d.update(t,[{name:'Pie',v:t*.0001,q:1}]);assert.equal(r.rpm,null);assert.equal(r.cycles,0);
});
test('independent signal phases and visibility changes do not create double cycles',()=>{
 const d=new CadenceDetector();let r,previous=0;for(let t=0;t<=20000;t+=1000/30){r=d.update(t,[signal(t,85,'Pie',0,.3,t%1600<800?.99:.51),signal(t,85,'Rodilla',Math.PI,.3,t%1600<800?.51:.99)]);assert.ok(r.cycles-previous<=1);previous=r.cycles;}
 assert.ok(Math.abs(r.rpm-85)<1);assert.ok(r.cycles<=Math.ceil(85*20/60));
});
test('repeated source timestamps cannot count new cycles',()=>{
 const d=new CadenceDetector();const r=run(d,85);for(let i=0;i<500;i++)d.update(d.lastTime,[signal(i*33,170)]);assert.deepEqual(d.result,r);
});
test('stopped cyclist clears previous rpm within 1.2 seconds',()=>{
 const d=new CadenceDetector();run(d,85);const start=d.lastTime;let r;for(let t=start+33;t<start+1200;t+=33)r=d.update(t,[{name:'Pie Izq.',v:1,q:1}]);assert.equal(r.rpm,0);
});
test('missing pose has no stale measurement',()=>{const d=new CadenceDetector();run(d,85);const r=d.missing(d.lastTime+33);assert.equal(r.rpm,null);assert.equal(r.quality,0);});
test('frozen pixels clear cadence and cannot add cycles',()=>{const d=new CadenceDetector();run(d,85);const count=d.cycles;const r=d.noMotion(d.lastTime+33);assert.equal(r.rpm,0);assert.equal(r.cycles,count);assert.equal(r.quality,0);});
test('two cyclists have independent histories even when pose order changes',()=>{
 const trackers=new PoseTracks();function pose(x,t,rpm){const lm=Array.from({length:33},()=>({x,y:.2,visibility:1}));for(const i of [11,12])lm[i].y=.25;for(const i of [23,24])lm[i].y=.45;for(const i of [25,26])lm[i].y=.6;lm[27].y=.75+.08*Math.sin(2*Math.PI*rpm*t/60000);lm[28].y=.75-.08*Math.sin(2*Math.PI*rpm*t/60000);return lm;}
 let tracks;for(let i=0;i<450;i++){const t=i*1000/30,ps=[pose(.25,t,85),pose(.75,t,65)];tracks=trackers.update(i%2?ps.reverse():ps,t);}
 assert.equal(tracks.length,2);assert.ok(Math.abs(tracks[0].result.rpm-85)<1);assert.ok(Math.abs(tracks[1].result.rpm-65)<1);
});
test('large non-periodic noise cannot establish cadence',()=>{
 const d=new CadenceDetector();let seed=22,r;for(let t=0;t<=15000;t+=33){seed=(1664525*seed+1013904223)>>>0;r=d.update(t,[{name:'Pie',v:seed/4294967296,q:1}]);}assert.equal(r.rpm,null);assert.equal(r.cycles,0);
});
test('frozen frame gating happens before pose jitter can increment cycles',()=>{
 const tracks=new PoseTracks();function pose(t){const lm=Array.from({length:33},()=>({x:.5,y:.25,visibility:1}));for(const i of [23,24])lm[i].y=.45;for(const i of [25,26])lm[i].y=.6;lm[27].y=.75+.08*Math.sin(2*Math.PI*85*t/60000);lm[28].y=.75-.08*Math.sin(2*Math.PI*85*t/60000);return lm;}
 let found;for(let t=0;t<12000;t+=33)found=tracks.update([pose(t)],t);
 const count=found[0].result.cycles;
 for(let t=12000;t<20000;t+=33){found=tracks.update([pose(t)],t,1,true);assert.equal(found[0].result.rpm,0);assert.equal(found[0].result.cycles,count);}
});
