const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const modulePromise=import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(require('node:path').join(__dirname,'../zone-detectors.js'),'utf8').replaceAll("new URL('./models/efficientdet-trained.tflite',import.meta.url).href","'trained.tflite'").replaceAll("new URL('./models/yolo11n.onnx',import.meta.url).href","'yolo.onnx'")).toString('base64'));
test('Spanish labels become bicycle; person remains person',async()=>{const {labelName}=await modulePromise;assert.equal(labelName('bicicleta_spinning'),'bicycle');assert.equal(labelName('bicicleta'),'bicycle');assert.equal(labelName('person'),'person');});
test('YOLO letterbox decoding, class filtering and per-class NMS',async()=>{const {decodeYolo}=await modulePromise;const N=4,data=new Float32Array(84*N);for(let i=0;i<N;i++){data[i]=320;data[N+i]=320;data[2*N+i]=160;data[3*N+i]=160;}data[5*N]=.9;data[5*N+1]=.8;data[4*N+2]=.7;data[6*N+3]=.99;const r=decodeYolo(data,[1,84,N],1280,720);assert.equal(r.detections.length,2);assert.equal(r.detections[0].categories[0].categoryName,'bicycle');assert.deepEqual(r.detections[0].boundingBox,{originX:480,originY:200,width:320,height:320});assert.equal(r.detections[1].categories[0].categoryName,'person');assert.throws(()=>decodeYolo(data,[1,6,N],1280,720),/incompatible/);});

test('every UI option has a configured detector and advanced models use distinct weights',async()=>{
 const {MODELS}=await modulePromise;const html=fs.readFileSync(require('node:path').join(__dirname,'../measure.html'),'utf8');
 const selector=html.match(/id="zoneModel"[^>]*>([\s\S]*?)<\/select>/)[1];
 const keys=[...selector.matchAll(/value="([^"]+)"/g)].map(x=>x[1]);
 const poseSelector=html.match(/id="poseModel"[^>]*>([\s\S]*?)<\/select>/)[1];
 const poseKeys=[...poseSelector.matchAll(/value="([^"]+)"/g)].map(x=>x[1]).filter(k=>k.startsWith('yolo'));
 assert.deepEqual([...new Set([...keys,...poseKeys])].sort(),Object.keys(MODELS).sort());
 assert.equal(new Set(['yolo','yolo_s','yolov8m'].map(k=>MODELS[k].url)).size,3);
 assert.match(MODELS.lite2.url,/efficientdet_lite2/);assert.equal(MODELS.trained.local,true);
});

test('custom two-class YOLO maps class zero to bicycle and merges overlapping bike classes',async()=>{
 const {decodeYolo,MODELS,createZoneDetector}=await modulePromise;
 const N=3,data=new Float32Array(6*N);
 for(let i=0;i<N;i++){data[i]=i===2?500:320;data[N+i]=320;data[2*N+i]=100;data[3*N+i]=100;}
 data[4*N]=.9;data[5*N+1]=.8;data[5*N+2]=.7;
 const result=decodeYolo(data,[1,6,N],640,640,640,.45,MODELS.yolo_trained.classes);
 assert.equal(result.detections.length,2);
 assert.ok(result.detections.every(d=>d.categories[0].categoryName==='bicycle'));
 assert.throws(()=>decodeYolo(data,[1,6,N],640,640),/incompatible/);
 await assert.rejects(createZoneDetector('yolo_trained',null),/model.onnx/);
});

test('YOLOv8n uses its own pinned ONNX weights',async()=>{const {MODELS}=await modulePromise;assert.equal(MODELS.yolov8n.type,'onnx');assert.notEqual(MODELS.yolov8n.url,MODELS.yolo.url);assert.match(MODELS.yolov8n.url,/98100409491fa67f62a2e780a4efe485b86dfd0b/);});

test('COCO filter supports motorcycles, all classes and configurable max_det',async()=>{
 const {decodeYolo,COCO_NAMES}=await modulePromise;assert.equal(COCO_NAMES.length,80);assert.equal(COCO_NAMES[3],'motorcycle');
 const N=3,data=new Float32Array(84*N);
 for(let i=0;i<N;i++){data[i]=100+i*180;data[N+i]=200;data[2*N+i]=50;data[3*N+i]=50;data[(4+[0,3,16][i])*N+i]=.9-i*.1;}
 const filtered=decodeYolo(data,[1,84,N],640,640,640,.25,null,{classIds:[3],maxDet:20});assert.equal(filtered.detections.length,1);assert.equal(filtered.detections[0].categories[0].categoryName,'motorcycle');
 assert.equal(decodeYolo(data,[1,84,N],640,640,640,.25,null,{classIds:null,maxDet:2}).detections.length,2);
});
test('YOLO26 processed output uses xyxy and does not suppress overlapping end-to-end boxes',async()=>{
 const {decodeYolo}=await modulePromise;const data=new Float32Array([100,100,200,200,.9,1,100,100,200,200,.8,1,300,100,400,200,.7,3]);
 const result=decodeYolo(data,[1,3,6],640,640,640,.25,null,{classIds:[1,3],maxDet:20});assert.equal(result.detections.length,3);assert.equal(result.detections[0].boundingBox.width,100);
});
test('YOLO26 pose decodes person boxes and 17 points without treating points as categories',async()=>{
 const {decodeYolo}=await modulePromise;const data=new Float32Array(57);data.set([100,100,200,300,.9,0]);for(let j=0;j<17;j++)data.set([150,200,.8],6+j*3);
 const result=decodeYolo(data,[1,1,57],640,640,640,.25,['person'],{pose:true,classIds:null,maxDet:20});assert.equal(result.detections[0].categories[0].categoryName,'person');assert.equal(result.detections[0].keypoints.length,17);assert.equal(result.detections[0].keypoints[0].x,150);
});
test('actual YOLO26 split layout converts normalized xywh to source boxes',async()=>{
 const {decodeSplitYolo}=await modulePromise;const logits={dims:[1,2,80],data:new Float32Array(160)},boxes={dims:[1,2,4],data:new Float32Array([.5,.5,.25,.25,.25,.5,.1,.1])};logits.data[1]=.9;logits.data[80+3]=.8;
 const result=decodeSplitYolo(logits,boxes,1280,720,.25,{classIds:[1,3],maxDet:20});assert.equal(result.detections.length,2);assert.deepEqual(result.detections[0].boundingBox,{originX:480,originY:200,width:320,height:320});
});

test('phases are automatic, posture defaults to None and people are the default target',()=>{
 const html=fs.readFileSync(require('node:path').join(__dirname,'../measure.html'),'utf8');
 assert.match(html,/<option value="none" selected>/);assert.match(html,/<option value="person" selected>/);
 assert.match(html,/<div hidden aria-hidden="true"><button id="onlyBikes"/);
 assert.doesNotMatch(html,/Capas adicionales|Z1–Z8|hasta ocho/);assert.match(html,/id="maxZones"[^>]*max="64"[^>]*value="32"/);
});

test('model information describes served ONNX sizes and device-specific references',async()=>{
 const {MODELS}=await modulePromise;
 assert.equal(MODELS.yolov8m.bytes,103789086);assert.equal(MODELS.yolov8m.format,'.onnx');
 for(const key of ['yolov8n','yolov8m','yolo','yolo_s','yolo26n','yolo26s','yolo26pose','yolo26spose']){assert.equal(MODELS[key].inputSize,640);assert.ok(MODELS[key].referenceMs>0);assert.match(MODELS[key].referenceDevice,/CPU/);}
 assert.equal(MODELS.original.inputSize,320);assert.match(MODELS.original.referenceDevice,/Pixel 4/);
 assert.equal(MODELS.yolo_trained.bytes,null);assert.equal(MODELS.trained.referenceMs,null);
});

test('streamed model download reports progress and rejects failed requests',async()=>{
 const {downloadModel}=await modulePromise,original=global.fetch;
 try{
  let i=0;global.fetch=async()=>({ok:true,headers:{get:()=> '3'},body:{getReader:()=>({read:async()=>i++===0?{done:false,value:new Uint8Array([1,2])}:i===2?{done:false,value:new Uint8Array([3])}:{done:true}})}});
  const progress=[],bytes=await downloadModel('mock',info=>progress.push(info));
  assert.deepEqual([...bytes],[1,2,3]);assert.equal(progress.at(-1).loaded,3);assert.equal(progress.at(-1).total,3);
  global.fetch=async()=>({ok:false,status:404});await assert.rejects(downloadModel('mock'),/HTTP 404/);
 }finally{global.fetch=original;}
});

test('Lite3 and Lite4 use official automatic downloads rather than local files',async()=>{const {MODELS}=await modulePromise;for(const key of ['lite3','lite4']){assert.notEqual(MODELS[key].local,true);assert.equal(MODELS[key].cache,true);assert.match(MODELS[key].url,new RegExp('/'+key+'/detection/metadata/'));}});

test('cached TFLite downloads reuse valid bytes and reject HTML without caching it',async()=>{
 const {downloadCachedTflite}=await modulePromise;
 const originalFetch=global.fetch,originalCaches=global.caches,stored=new Map();let downloads=0;
 const bytes=new Uint8Array([32,0,0,0,84,70,76,51,1,2]);
 global.caches={open:async()=>({match:async key=>stored.get(key)?.clone(),put:async(key,response)=>stored.set(key,response),delete:async key=>stored.delete(key)})};
 global.fetch=async()=>{downloads++;return new Response(bytes);};
 try{
  const progress=[];assert.deepEqual(await downloadCachedTflite('https://model.test/lite3'),bytes);
  assert.deepEqual(await downloadCachedTflite('https://model.test/lite3',p=>progress.push(p)),bytes);
  assert.equal(downloads,1);assert.equal(progress[0].stage,'cached');
  stored.set('https://model.test/lite4',new Response('broken'));await downloadCachedTflite('https://model.test/lite4');assert.equal(downloads,2);
  global.fetch=async()=>new Response('<html>not a model</html>');
  await assert.rejects(downloadCachedTflite('https://model.test/html'),/TFLite válido/);assert.equal(stored.has('https://model.test/html'),false);
 }finally{global.fetch=originalFetch;if(originalCaches===undefined)delete global.caches;else global.caches=originalCaches;}
});
