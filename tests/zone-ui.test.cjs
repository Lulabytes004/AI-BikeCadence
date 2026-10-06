const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('automatic scans lock zones, export them, and can be restarted from the UI',async()=>{
 const context2d={drawImage(){},clearRect(){},strokeRect(){},setLineDash(){},fillText(){},getImageData(){return {data:new Uint8ClampedArray(96*54*4)};}};
 const element=()=>({style:{setProperty(){}},classList:{add(){},remove(){}},append(){},replaceChildren(){},addEventListener(){},getContext(){return context2d;},checked:true,value:'',textContent:''});
 const els=new Map(),get=id=>{if(!els.has(id))els.set(id,element());return els.get(id);};
 Object.assign(get('video'),{readyState:2,seeking:false,videoWidth:1000,videoHeight:600,currentTime:0});
 let blobBody;
 const sandbox={console,performance:{now:()=>0},location:{search:'?test'},URLSearchParams,Uint8ClampedArray,setTimeout:fn=>fn(),Blob:class {constructor(parts){blobBody=parts[0];}},URL:{createObjectURL:()=>'',revokeObjectURL(){}},document:{getElementById:get,createElement:()=>({...element(),click(){}})}};
 sandbox.MODELS={original:{name:'Original'},trained:{name:'Entrenado'},yolo:{name:'YOLO'}};sandbox.createZoneDetector=async()=>({detect:()=>({detections:[]}),close(){}});
 sandbox.window=sandbox;vm.createContext(sandbox);
 for(const name of ['cadence.js','bike-zones.js','measure.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',name),'utf8').replace(/^import .*zone-detectors.*;\n/,''),sandbox);
 sandbox.cadenceDebug.setModel({detectForVideo:()=>({landmarks:[]})});let calls=0;
 sandbox.cadenceDebug.setZoneModel({detect:()=>({detections:calls++%5===0?[{categories:[{categoryName:'bicycle',score:.9}],boundingBox:{originX:200,originY:300,width:200,height:180}}]:[]})});
 for(const t of [0,.7,1.4,2.1,2.8,3.5,4.2]){sandbox.cadenceDebug.processFrame(t);await new Promise(resolve=>setImmediate(resolve));}
 assert.equal(calls,30);assert.equal(sandbox.cadenceDebug.zones.zones.length,1);assert.equal(sandbox.cadenceDebug.zones.locked,true);
 get('landmarks').onclick();const data=JSON.parse(blobBody);assert.equal(data.version,3);assert.equal(data.zone_model,'original');assert.equal(data.zones.length,1);assert.equal(data.zones[0].kind,'bicycle');assert.equal(data.zones_locked,true);
 get('reset').onclick();assert.equal(sandbox.cadenceDebug.zones.zones.length,0);assert.equal(sandbox.cadenceDebug.zones.locked,false);
 get('layerCrops').checked=false;get('layerZones').checked=false;get('layerPose').checked=false;get('layerCadence').checked=false;
 sandbox.cadenceDebug.setModel({detectForVideo:()=>{throw Error('Disabled posture layer must not execute');}});
 const before=calls;
 for(const t of [5,5.7,6.4,7.1,7.8,8.5,9.2,9.9]){sandbox.cadenceDebug.processFrame(t);await new Promise(resolve=>setImmediate(resolve));}
 assert.equal(calls-before,8,'direct mode runs once per sample and continues beyond six observations');
 assert.equal(sandbox.cadenceDebug.zones.zones.length,0);
 assert.equal(sandbox.cadenceDebug.tracks.tracks?.length??0,0);
 get('layerDetector').checked=false;sandbox.cadenceDebug.processFrame(10.6);await new Promise(resolve=>setImmediate(resolve));assert.equal(calls-before,8);

});

test('paused file scan waits for six slow samples, restores position and keeps cadence history empty',async()=>{
 const context2d={drawImage(){},clearRect(){},strokeRect(){},setLineDash(){},fillText(){},getImageData(){return {data:new Uint8ClampedArray(96*54*4)};}};
 const element=()=>({style:{setProperty(){}},classList:{add(){},remove(){}},append(){},replaceChildren(){},addEventListener(){},getContext(){return context2d;},checked:true,value:'',textContent:''});
 const els=new Map(),get=id=>{if(!els.has(id))els.set(id,element());return els.get(id);};
 const listeners=new Map(),emit=event=>{for(const f of [...(listeners.get(event)||[])])f();};
 const video=get('video');let currentTime=0;
 Object.assign(video,{readyState:2,seeking:false,videoWidth:1000,videoHeight:600,duration:10,paused:true,
  pause(){this.paused=true;},load(){queueMicrotask(()=>emit('loadeddata'));},removeAttribute(){},
  addEventListener(event,f){if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event).add(f);},
  removeEventListener(event,f){listeners.get(event)?.delete(f);}});
 Object.defineProperty(video,'currentTime',{get:()=>currentTime,set:t=>{currentTime=t;queueMicrotask(()=>emit('seeked'));}});
 const sandbox={console,performance:{now:()=>0},location:{search:'?test'},URLSearchParams,Uint8ClampedArray,setTimeout,Blob:class{},URL:{createObjectURL:()=>'',revokeObjectURL(){}},document:{getElementById:get,createElement:()=>({...element(),click(){}})}};
 sandbox.MODELS={original:{name:'Original'}};sandbox.createZoneDetector=async()=>{throw Error('The injected detector should be reused');};sandbox.window=sandbox;vm.createContext(sandbox);
 for(const name of ['cadence.js','bike-zones.js','measure.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',name),'utf8').replace(/^import .*zone-detectors.*;\n/,''),sandbox);
 sandbox.cadenceDebug.setModel({detectForVideo:()=>({landmarks:[]})});
 const times=[];let busy=false;
 sandbox.cadenceDebug.setZoneModel({async detect(){assert.equal(busy,false,'inferences must not overlap');busy=true;times.push(video.currentTime);await new Promise(r=>setImmediate(r));busy=false;return {detections:[{categories:[{categoryName:'bicycle',score:.9}],boundingBox:{originX:200,originY:300,width:200,height:180}}]};}});
 await sandbox.cadenceDebug.openFile({name:'example.mp4'});
 // Let the initial preview's five crops finish before starting the explicit scan.
 for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));
 times.length=0;video.currentTime=4;
 await get('scanZones').onclick();
 assert.equal(times.length,30);assert.deepEqual(times.filter((_,i)=>i%5===0).map(t=>Number(t.toFixed(1))),[0,.7,1.4,2.1,2.8,3.5]);
 assert.equal(video.currentTime,4);assert.equal(video.paused,true);
 assert.equal(sandbox.cadenceDebug.poseRecords.length,0);assert.equal(sandbox.cadenceDebug.records.length,0);
 assert.equal(sandbox.cadenceDebug.zones.locked,true);assert.equal(get('scanZones').disabled,false);
});
