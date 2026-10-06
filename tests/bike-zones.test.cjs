const test=require('node:test'),assert=require('node:assert/strict');
const {BikeZones,bikeZoneProposals,poseZoneBoxes}=require('../bike-zones.js');
const person=(x=.2,y=.15)=>({x,y,w:.12,h:.3,label:'person',score:.85});
const bike={x:.18,y:.35,w:.22,h:.25,label:'bicycle',score:.8};
test('bike and overlapping rider form one complete zone',()=>{
 const zs=bikeZoneProposals([person(),bike]);assert.equal(zs.length,1);assert.equal(zs[0].kind,'bicycle');assert.ok(zs[0].y<=.15);assert.ok(zs[0].y+zs[0].h>=.6);
});
test('person-only regions are explicitly estimates, not confirmed bicycles',()=>{
 assert.equal(bikeZoneProposals([person()])[0].kind,'occupied');
});
test('overlapping tile detections do not duplicate a station',()=>{
 const tracker=new BikeZones();for(const t of [0,700,1400])tracker.update([person(),{...person(),x:.205,score:.7}],t);
 assert.equal(tracker.zones.length,1);
});
test('transient extra object cannot become a zone; confirmed zones survive a missed sample',()=>{
 const tracker=new BikeZones();tracker.update([person(),person(.7)],0);tracker.update([person()],700);tracker.update([person()],1400);
 assert.equal(tracker.zones.length,1);tracker.update([],2100);assert.equal(tracker.zones.length,1);
 tracker.update([],3500);assert.equal(tracker.zones.length,0);
});
test('eight stations get row order and lock until explicit rescan',()=>{
 const boxes=Array.from({length:8},(_,i)=>person(.03+(i%4)*.24,.02+Math.floor(i/4)*.5)),tracker=new BikeZones();
 for(const t of [0,700,1400])tracker.update(boxes.slice().reverse(),t);
 assert.equal(tracker.zones.length,8);assert.ok(tracker.zones[0].x<tracker.zones[1].x);assert.ok(tracker.zones[3].y<tracker.zones[4].y);
 const before=JSON.stringify(tracker.lock());tracker.update([],9000);assert.equal(JSON.stringify(tracker.zones),before);
 tracker.reset();assert.equal(tracker.zones.length,0);assert.equal(tracker.locked,false);
});
test('zones are clipped to the frame and invalid inputs ignored',()=>{
 const zs=bikeZoneProposals([person(0,0),{...person(),x:NaN},{...person(),x:2}]);assert.equal(zs.length,1);
 for(const z of zs){assert.ok(z.x>=0&&z.y>=0&&z.x+z.w<=1&&z.y+z.h<=1);}
 assert.deepEqual(poseZoneBoxes([Array.from({length:33},()=>({x:0,y:0,visibility:0}))]),[]);
});
test('model outputs from six synthetic clips retain observed coverage without inventing missing bikes',()=>{
 const rows=require('./fixtures/zone-model-detections.json');
 const expected={'spinning_frontal_10s.mp4':2,'spinning_lateral_10s.mp4':2,'spinning_45_grados_10s.mp4':2,'spinning_8_frontal_10s.mp4':2,'spinning_8_lateral_10s.mp4':8,'spinning_8_45_grados_10s.mp4':8};
 for(const [source,count] of Object.entries(expected)){
  const tracker=new BikeZones();for(const r of rows.filter(r=>r.source===source))tracker.update(r.boxes,r.time);
  assert.equal(tracker.zones.length,count,source);
  // These schematic bicycles were not recognized as the bicycle class.
  assert.ok(tracker.zones.every(z=>z.kind==='occupied'),source);
 }
});

test('slow inference confirms repeated zones and two missed observations expire them',()=>{
 const tracker=new BikeZones();for(const t of [0,2300,4600])tracker.update([person()],t);
 assert.equal(tracker.zones.length,1);tracker.update([],6900);assert.equal(tracker.zones.length,1);
 tracker.update([],9200);assert.equal(tracker.zones.length,0);
});

test('six samples can confirm 16 people without requiring bicycles',()=>{
 const zones=new BikeZones(32),people=Array.from({length:16},(_,i)=>({label:'person',score:.9,x:.03+(i%4)*.24,y:.02+Math.floor(i/4)*.24,w:.10,h:.18}));
 for(const t of [0,700,1400,2100,2800,3500])zones.update(people,t);
 zones.lock();assert.equal(zones.zones.length,16);assert.equal(zones.locked,true);
 assert.ok(zones.zones.every(z=>z.kind==='occupied'));
});
