const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const modulePromise=import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(require('node:path').join(__dirname,'../zone-detectors.js'),'utf8').replaceAll("new URL('./models/efficientdet-trained.tflite',import.meta.url).href","'trained.tflite'").replaceAll("new URL('./models/yolo11n.onnx',import.meta.url).href","'yolo.onnx'")).toString('base64'));
test('Spanish labels become bicycle; person remains person',async()=>{const {labelName}=await modulePromise;assert.equal(labelName('bicicleta_spinning'),'bicycle');assert.equal(labelName('bicicleta'),'bicycle');assert.equal(labelName('person'),'person');});
test('YOLO letterbox decoding, class filtering and per-class NMS',async()=>{const {decodeYolo}=await modulePromise;const N=4,data=new Float32Array(84*N);for(let i=0;i<N;i++){data[i]=320;data[N+i]=320;data[2*N+i]=160;data[3*N+i]=160;}data[5*N]=.9;data[5*N+1]=.8;data[4*N+2]=.7;data[6*N+3]=.99;const r=decodeYolo(data,[1,84,N],1280,720);assert.equal(r.detections.length,2);assert.equal(r.detections[0].categories[0].categoryName,'bicycle');assert.deepEqual(r.detections[0].boundingBox,{originX:480,originY:200,width:320,height:320});assert.equal(r.detections[1].categories[0].categoryName,'person');assert.throws(()=>decodeYolo(data,[1,6,N],1280,720),/incompatible/);});

test('every UI option has a configured detector and advanced models use distinct weights',async()=>{
 const {MODELS}=await modulePromise;const html=fs.readFileSync(require('node:path').join(__dirname,'../measure.html'),'utf8');
 const selector=html.match(/id="zoneModel"[^>]*>([\s\S]*?)<\/select>/)[1];
 const keys=[...selector.matchAll(/value="([^"]+)"/g)].map(x=>x[1]);
 assert.deepEqual(keys.sort(),Object.keys(MODELS).sort());
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

test('optional layers start off and objects have readable names',()=>{const html=fs.readFileSync(require('node:path').join(__dirname,'../measure.html'),'utf8');for(const id of ['layerCrops','layerZones','layerPose','layerCadence'])assert.doesNotMatch(html.match(new RegExp('<input id="'+id+'"[^>]*>'))[0],/checked/);assert.match(html,/id="detectorObjects"/);assert.doesNotMatch(html,/id="detectorClasses"/);});

test('model information describes served ONNX sizes and device-specific references',async()=>{
 const {MODELS}=await modulePromise;
 assert.equal(MODELS.yolov8m.bytes,103789086);assert.equal(MODELS.yolov8m.format,'.onnx');
 for(const key of ['yolov8n','yolov8m','yolo','yolo_s','yolo26n','yolo26s','yolo26pose','yolo26spose']){assert.equal(MODELS[key].inputSize,640);assert.ok(MODELS[key].referenceMs>0);assert.match(MODELS[key].referenceDevice,/CPU/);}
 assert.equal(MODELS.original.inputSize,320);assert.match(MODELS.original.referenceDevice,/Pixel 4/);
 assert.equal(MODELS.yolo_trained.bytes,null);assert.equal(MODELS.trained.referenceMs,null);
});
