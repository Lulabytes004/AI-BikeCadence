const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const modulePromise=import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(require('node:path').join(__dirname,'../zone-detectors.js'),'utf8').replaceAll("new URL('./models/efficientdet-trained.tflite',import.meta.url).href","'trained.tflite'").replaceAll("new URL('./models/yolo11n.onnx',import.meta.url).href","'yolo.onnx'")).toString('base64'));
test('Spanish labels become bicycle; person remains person',async()=>{const {labelName}=await modulePromise;assert.equal(labelName('bicicleta_spinning'),'bicycle');assert.equal(labelName('bicicleta'),'bicycle');assert.equal(labelName('person'),'person');});
test('YOLO letterbox decoding, class filtering and per-class NMS',async()=>{const {decodeYolo}=await modulePromise;const N=4,data=new Float32Array(84*N);for(let i=0;i<N;i++){data[i]=320;data[N+i]=320;data[2*N+i]=160;data[3*N+i]=160;}data[5*N]=.9;data[5*N+1]=.8;data[4*N+2]=.7;data[6*N+3]=.99;const r=decodeYolo(data,[1,84,N],1280,720);assert.equal(r.detections.length,2);assert.equal(r.detections[0].categories[0].categoryName,'bicycle');assert.deepEqual(r.detections[0].boundingBox,{originX:480,originY:200,width:320,height:320});assert.equal(r.detections[1].categories[0].categoryName,'person');assert.throws(()=>decodeYolo(data,[1,6,N],1280,720),/incompatible/);});

test('every UI option has a configured detector and advanced models use distinct weights',async()=>{
 const {MODELS}=await modulePromise;const html=fs.readFileSync(require('node:path').join(__dirname,'../measure.html'),'utf8');
 const selector=html.match(/id="zoneModel"[^>]*>([\s\S]*?)<\/select>/)[1];
 const keys=[...selector.matchAll(/value="([^"]+)"/g)].map(x=>x[1]);
 assert.deepEqual(keys.sort(),Object.keys(MODELS).sort());
 assert.equal(new Set(['yolo','yolo_s','yolo_m'].map(k=>MODELS[k].url)).size,3);
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
