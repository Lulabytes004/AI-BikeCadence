const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function harness(){
 const context={drawImage(){},clearRect(){},strokeRect(){},setLineDash(){},fillText(){},getImageData(){return {data:new Uint8ClampedArray(96*54*4)};}};
 const element=()=>({style:{setProperty(){}},classList:{add(){},remove(){}},append(){},replaceChildren(){},addEventListener(){},removeAttribute(){},getContext(){return context;},checked:false,value:'',options:['all','person','bicycle','motorcycle'].map(value=>({value})),textContent:''});
 const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
 for(const id of ['layerDetector','layerCrops','layerZones','showZones'])get(id).checked=true;
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
 return {get,debug:sandbox.cadenceDebug,video};
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
