const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function harness(){
 const draws={text:[],dashes:[],segments:0,points:0};
 const context={drawImage(){},clearRect(){},strokeRect(){},fillRect(){},setLineDash(value){draws.dashes.push(value);},fillText(value){draws.text.push(value);},beginPath(){},moveTo(){},lineTo(){},stroke(){draws.segments++;},arc(){draws.points++;},fill(){},getImageData(){return {data:new Uint8ClampedArray(96*54*4)};}};
 const element=()=>({style:{setProperty(){}},classList:{add(){},remove(){}},append(){},replaceChildren(){},addEventListener(){},removeAttribute(){},getContext(){return context;},checked:false,value:'',options:['all','person','bicycle','motorcycle'].map(value=>({value})),textContent:''});
 const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
 for(const id of ['layerDetector','layerCrops','layerZones','showZones','detectorTiles'])get(id).checked=true;
 for(const [id,value] of Object.entries({detectorObjects:'person',detectorConfidence:'.25',detectorMaxDet:'50',maxZones:'32',poseModel:'none',poseScope:'zones',speed:'1'}))get(id).value=value;
 const video=get('video'),listeners=new Map();let time=0;
 const emit=event=>{for(const fn of [...(listeners.get(event)||[])])fn();};
 Object.assign(video,{videoWidth:1000,videoHeight:600,readyState:2,seeking:false,duration:10,paused:true,
  pause(){this.paused=true;},async play(){this.paused=false;},load(){queueMicrotask(()=>emit('loadeddata'));},requestVideoFrameCallback(){return 1;},cancelVideoFrameCallback(){},
  addEventListener(event,fn){if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event).add(fn);},removeEventListener(event,fn){listeners.get(event)?.delete(fn);}});
 Object.defineProperty(video,'currentTime',{get:()=>time,set:value=>{time=value;queueMicrotask(()=>emit('seeked'));}});
 const sandbox={console,performance:{now:()=>0},location:{search:'?test'},URLSearchParams,Uint8ClampedArray,setTimeout,Blob:class{},URL:{createObjectURL:()=>'',revokeObjectURL(){}},document:{getElementById:get,createElement:()=>({...element(),click(){}})}};
 sandbox.window=sandbox;sandbox.MODELS={original:{name:'Original'}};sandbox.createZoneDetector=()=>{throw Error('Reuse injected detector');};vm.createContext(sandbox);
 for(const name of ['cadence.js','bike-zones.js','measure.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',name),'utf8').replace(/^import .*zone-detectors.*;\n/,''),sandbox);
 return {get,debug:sandbox.cadenceDebug,video,draws};
}
test('selecting posture eagerly loads it with progress and None closes it while retaining zones',async()=>{
 const {get,debug}=harness();let finish,closed=0,loads=0;
 debug.zones.zones=[{id:1,x:.1,y:.1,w:.2,h:.5,kind:'occupied'}];debug.zones.locked=true;
 debug.setPoseFactory(async(key,options)=>{
  loads++;assert.equal(key,'mediapipe_full');assert.equal(options.scope,'zones');assert.equal(options.maxPoses,32);
  options.onProgress({stage:'download',loaded:2*1048576,total:4*1048576});
  await new Promise(resolve=>{finish=resolve;});return {infer:async()=>({landmarks:[]}),close(){closed++;}};
 });
 get('poseModel').value='mediapipe_full';const changing=get('poseModel').onchange();
 for(let i=0;i<3;i++)await new Promise(resolve=>setImmediate(resolve));
 assert.equal(loads,1);assert.equal(get('layerPose').checked,true);assert.equal(get('layerCadence').checked,true);
 assert.match(get('poseStatus').textContent,/DESCARGANDO/);assert.equal(get('poseProgress').hidden,false);assert.equal(get('poseModel').disabled,true);
 finish();await changing;assert.match(get('poseStatus').textContent,/LISTO/);assert.equal(get('poseProgress').hidden,true);assert.equal(debug.zones.zones.length,1);
 get('poseModel').value='none';await get('poseModel').onchange();assert.equal(closed,1);assert.equal(get('layerPose').checked,false);assert.equal(get('layerCadence').checked,false);assert.equal(debug.zones.locked,true);
});
test('Play automatically scans missing zones, then plays; Repeat leaves a file paused at its prior position',async()=>{
 const {get,debug,video}=harness(),samples=[];
 debug.setZoneModel({close(){},async detect(){samples.push(video.currentTime);return {detections:[{categories:[{categoryName:'person',score:.9}],boundingBox:{originX:200,originY:100,width:150,height:350}}]};}});
 await debug.openFile({name:'people.mp4'});for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));
 samples.length=0;await get('play').onclick();
 assert.equal(samples.length,30);assert.equal(debug.zones.locked,true);assert.equal(video.paused,false);
 await get('play').onclick();assert.equal(video.paused,true);video.currentTime=4;
 samples.length=0;await get('scanZones').onclick();assert.equal(samples.length,30);assert.equal(video.currentTime,4);assert.equal(video.paused,true);
 samples.length=0;await get('play').onclick();assert.equal(samples.length,0);assert.equal(video.paused,false);
});

test('zone confidence and raw skeleton can be toggled independently and borders are solid',()=>{
 const {get,debug,draws}=harness();get('showZoneData').checked=true;get('showPose').checked=true;get('layerPose').checked=true;
 debug.zones.zones=[{id:1,x:.1,y:.1,w:.2,h:.5,score:.9,kind:'occupied'}];debug.zones.locked=true;
 const lm=Array.from({length:33},()=>({x:.2,y:.3,visibility:.8}));debug.setPoseOutput([lm],[1]);
 debug.drawOverlay();assert.ok(draws.text.includes('Detector: 90.0%'));assert.ok(draws.text.includes('Puntos (media): 80.0%'));
 assert.ok(draws.text.some(t=>t.includes('200 × 300 px')));assert.ok(draws.segments>0);assert.equal(draws.points,33);
 assert.ok(draws.dashes.every(d=>d.length===0),'all zone borders must be solid');
 draws.text.length=0;get('showZoneData').checked=false;get('showZoneData').onchange();
 assert.ok(draws.text.includes('Z1'));assert.ok(!draws.text.some(t=>/Detector:|Puntos|px/.test(t)));
 draws.segments=0;draws.points=0;get('showPose').checked=false;get('showPose').onchange();
 assert.equal(draws.segments,0);assert.equal(draws.points,0);
});
test('default full-image scan needs six inferences instead of thirty',async()=>{
 const {get,debug}=harness();get('detectorTiles').checked=false;get('layerCrops').checked=false;let calls=0;
 debug.setZoneModel({close(){},async detect(){calls++;return {detections:[{categories:[{categoryName:'person',score:.9}],boundingBox:{originX:200,originY:100,width:150,height:350}}]};}});
 await debug.openFile({name:'people.mp4'});for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));calls=0;
 await get('play').onclick();assert.equal(calls,6);assert.equal(debug.zones.locked,true);
});
