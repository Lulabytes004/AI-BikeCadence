const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('automatic scans lock zones, export them, and can be restarted from the UI',()=>{
 const context2d={drawImage(){},clearRect(){},strokeRect(){},setLineDash(){},fillText(){},getImageData(){return {data:new Uint8ClampedArray(96*54*4)};}};
 const element=()=>({style:{setProperty(){}},classList:{add(){},remove(){}},append(){},replaceChildren(){},addEventListener(){},getContext(){return context2d;},checked:true,value:'',textContent:''});
 const els=new Map(),get=id=>{if(!els.has(id))els.set(id,element());return els.get(id);};
 Object.assign(get('video'),{readyState:2,seeking:false,videoWidth:1000,videoHeight:600,currentTime:0});
 let blobBody;
 const sandbox={console,performance:{now:()=>0},location:{search:'?test'},URLSearchParams,Uint8ClampedArray,setTimeout:fn=>fn(),Blob:class {constructor(parts){blobBody=parts[0];}},URL:{createObjectURL:()=>'',revokeObjectURL(){}},document:{getElementById:get,createElement:()=>({...element(),click(){}})}};
 sandbox.window=sandbox;vm.createContext(sandbox);
 for(const name of ['cadence.js','bike-zones.js','measure.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',name),'utf8'),sandbox);
 sandbox.cadenceDebug.setModel({detectForVideo:()=>({landmarks:[]})});let calls=0;
 sandbox.cadenceDebug.setZoneModel({detect:()=>({detections:calls++%5===0?[{categories:[{categoryName:'bicycle',score:.9}],boundingBox:{originX:200,originY:300,width:200,height:180}}]:[]})});
 for(const t of [0,.7,1.4,2.1,2.8,3.5,4.2])sandbox.cadenceDebug.processFrame(t);
 assert.equal(calls,30);assert.equal(sandbox.cadenceDebug.zones.zones.length,1);assert.equal(sandbox.cadenceDebug.zones.locked,true);
 get('landmarks').onclick();const data=JSON.parse(blobBody);assert.equal(data.version,2);assert.equal(data.zones.length,1);assert.equal(data.zones[0].kind,'bicycle');assert.equal(data.zones_locked,true);
 get('reset').onclick();assert.equal(sandbox.cadenceDebug.zones.zones.length,0);assert.equal(sandbox.cadenceDebug.zones.locked,false);
});
