// All inference is local. Public runtimes and original weights load on first use.
export const MODELS={
 yolo26n:{splitOutput:true,name:'YOLO26N preentrenado',type:'onnx',pose:false,url:'https://huggingface.co/onnx-community/yolo26n-ONNX/resolve/a8dc7e14743e1cea8ccd493bd99b4c2827de1acf/onnx/model.onnx'},
 yolo26s:{splitOutput:true,name:'YOLO26S preentrenado',type:'onnx',pose:false,url:'https://huggingface.co/onnx-community/yolo26s-ONNX/resolve/37669b009f416cb1df28751257d6ec5f8e4b4e20/onnx/model.onnx'},
 yolo26pose:{normalizedPose:true,name:'YOLO26N-POSE preentrenado',type:'onnx',pose:true,url:'https://huggingface.co/onnx-community/yolo26n-pose-ONNX/resolve/8a9197eeec75fdb4953322a455126ca6d9780b41/onnx/model.onnx'},
 original:{name:'EfficientDet-Lite0 INT8',type:'mediapipe',url:'https://storage.googleapis.com/download.tensorflow.org/models/tflite/task_library/object_detection/android/lite-model_efficientdet_lite0_detection_metadata_1.tflite'},
 lite2:{name:'EfficientDet-Lite2 preentrenado',type:'mediapipe',url:'https://storage.googleapis.com/download.tensorflow.org/models/tflite/task_library/object_detection/android/lite-model_efficientdet_lite2_detection_metadata_1.tflite'},
 lite1:{name:'EfficientDet-Lite1 INT8',type:'mediapipe',url:'https://storage.googleapis.com/download.tensorflow.org/models/tflite/task_library/object_detection/android/lite-model_efficientdet_lite1_detection_metadata_1.tflite'},
 lite3:{name:'EfficientDet-Lite3 INT8 · archivo local',type:'mediapipe',local:true,url:'https://tfhub.dev/tensorflow/lite-model/efficientdet/lite3/detection/metadata/1?lite-format=tflite'},
 yolov8m:{name:'YOLOv8m preentrenado',type:'onnx',url:'https://huggingface.co/Kalray/yolov8/resolve/9e0af089be9c2f172e4fd9b724805f8b6514854e/yolov8m.onnx'},
 yolo26spose:{normalizedPose:true,name:'YOLO26s-pose',type:'onnx',pose:true,url:'https://huggingface.co/onnx-community/yolo26s-pose-ONNX/resolve/6eb02d4fba1accea4086fa1306fad418dcd62854/onnx/model.onnx'},
 trained:{name:'EfficientDet entrenado · archivo local',type:'mediapipe',local:true},
 yolov8n:{name:'YOLOv8n preentrenado',type:'onnx',url:'https://huggingface.co/salim4n/yolov8n-detect-onnx/resolve/98100409491fa67f62a2e780a4efe485b86dfd0b/yolov8n-onnx-web/yolov8n.onnx'},
 yolo_trained:{name:'YOLO11 entrenado · archivo local',type:'onnx',local:true,classes:['bicicleta','bicicleta_spinning']},
 yolo_s:{name:'YOLO11s preentrenado',type:'onnx',url:'https://huggingface.co/giangndm/yolo11-onnx/resolve/8b180c762d5cf217886d16e64403508042207e4d/yolo11s_640.onnx'},
 yolo:{name:'YOLO11n preentrenado',type:'onnx',url:'https://huggingface.co/webnn/yolo11n/resolve/9c5acfdd74aaff2d0f47c51b878506361039a51f/onnx/yolo11n.onnx'}
};
const MODEL_INFO={"yolo26n": {"bytes": 9890454, "format": ".onnx", "referenceMs": 38.9, "inputSize": 640, "referenceDevice": "CPU de ordenador · ONNX"}, "yolo26s": {"bytes": 38239663, "format": ".onnx", "referenceMs": 87.2, "inputSize": 640, "referenceDevice": "CPU de ordenador · ONNX"}, "yolo26pose": {"bytes": 12081961, "format": ".onnx", "referenceMs": 40.3, "inputSize": 640, "referenceDevice": "CPU de ordenador · ONNX"}, "original": {"bytes": 4563519, "format": ".tflite INT8", "referenceMs": 37, "inputSize": 320, "referenceDevice": "Pixel 4 · CPU, 4 hilos"}, "lite2": {"bytes": 7557887, "format": ".tflite INT8", "referenceMs": 69, "inputSize": 448, "referenceDevice": "Pixel 4 · CPU, 4 hilos"}, "lite1": {"bytes": 6077535, "format": ".tflite INT8", "referenceMs": 49, "inputSize": 384, "referenceDevice": "Pixel 4 · CPU, 4 hilos"}, "lite3": {"bytes": 11953887, "format": ".tflite INT8", "referenceMs": 116, "inputSize": 512, "referenceDevice": "Pixel 4 · CPU, 4 hilos"}, "yolov8m": {"bytes": 103789086, "format": ".onnx", "referenceMs": 234.7, "inputSize": 640, "referenceDevice": "CPU de ordenador · ONNX"}, "yolo26spose": {"bytes": 41815454, "format": ".onnx", "referenceMs": 85.3, "inputSize": 640, "referenceDevice": "CPU de ordenador · ONNX"}, "trained": {"bytes": null, "format": ".tflite (según archivo)", "referenceMs": null, "inputSize": null, "referenceDevice": null}, "yolov8n": {"bytes": 12823637, "format": ".onnx", "referenceMs": 80.4, "inputSize": 640, "referenceDevice": "CPU de ordenador · ONNX"}, "yolo_trained": {"bytes": null, "format": ".onnx", "referenceMs": null, "inputSize": null, "referenceDevice": null}, "yolo_s": {"bytes": 38030388, "format": ".onnx", "referenceMs": 90, "inputSize": 640, "referenceDevice": "CPU de ordenador · ONNX"}, "yolo": {"bytes": 10720228, "format": ".onnx", "referenceMs": 56.1, "inputSize": 640, "referenceDevice": "CPU de ordenador · ONNX"}};
for(const [key,info] of Object.entries(MODEL_INFO))Object.assign(MODELS[key],info);
export function labelName(name){return ['bicicleta','bicicleta_spinning','bicycle'].includes(name)?'bicycle':name;}
export const COCO_NAMES='person,bicycle,car,motorcycle,airplane,bus,train,truck,boat,traffic light,fire hydrant,stop sign,parking meter,bench,bird,cat,dog,horse,sheep,cow,elephant,bear,zebra,giraffe,backpack,umbrella,handbag,tie,suitcase,frisbee,skis,snowboard,sports ball,kite,baseball bat,baseball glove,skateboard,surfboard,tennis racket,bottle,wine glass,cup,fork,knife,spoon,bowl,banana,apple,sandwich,orange,broccoli,carrot,hot dog,pizza,donut,cake,chair,couch,potted plant,bed,dining table,toilet,tv,laptop,mouse,remote,keyboard,cell phone,microwave,oven,toaster,sink,refrigerator,book,clock,vase,scissors,teddy bear,hair drier,toothbrush'.split(',');
export function decodeYolo(data,dims,width,height,size=640,threshold=.45,classes=null,options={}){
 const names=classes||COCO_NAMES,nc=names.length,pose=!!options.pose,k=pose?51:0;
 const processed=dims.length===3&&dims[0]===1&&dims[2]===6+k;
 if(dims.length!==3||dims[0]!==1||(!processed&&dims[1]!==4+nc+k)||data.length!==dims[1]*dims[2])throw Error('YOLO: salida incompatible '+JSON.stringify(dims));
 const N=processed?dims[1]:dims[2],scale=Math.min(size/width,size/height),px=Math.floor((size-Math.round(width*scale))/2),py=Math.floor((size-Math.round(height*scale))/2),boxes=[];
 const selected=options.classIds===undefined?[0,1]:options.classIds;
 const maxDet=Math.max(1,Math.min(300,options.maxDet??20));
 for(let i=0;i<N;i++){
  let cls=0,score=-Infinity,x1,y1,x2,y2;
  if(processed){const j=i*dims[2];[x1,y1,x2,y2,score,cls]=data.subarray(j,j+6);}
  else{for(let c=0;c<nc;c++){const v=data[(4+c)*N+i];if(v>score){score=v;cls=c;}}const cx=data[i],cy=data[N+i],w=data[2*N+i],h=data[3*N+i];x1=cx-w/2;y1=cy-h/2;x2=cx+w/2;y2=cy+h/2;}
  if(!Number.isInteger(cls)||cls<0||cls>=nc||!Number.isFinite(score)||score<threshold||((!classes||pose)&&selected!==null&&!selected.includes(cls)))continue;
  x1=Math.max(0,(x1-px)/scale);y1=Math.max(0,(y1-py)/scale);x2=Math.min(width,(x2-px)/scale);y2=Math.min(height,(y2-py)/scale);
  if(![x1,y1,x2,y2].every(Number.isFinite)||x2<=x1||y2<=y1)continue;
  const points=[];
  if(pose)for(let j=0;j<17;j++){const off=processed?i*dims[2]+6+j*3:(5+j*3)*N+i;const step=processed?1:N;points.push({x:(data[off]-px)/scale,y:(data[off+step]-py)/scale,score:data[off+2*step]});}
  boxes.push({label:labelName(names[cls]),classId:cls,score,x:x1,y:y1,w:x2-x1,h:y2-y1,points});
 }
 const out=[];
 for(const b of boxes.sort((a,b)=>b.score-a.score)){
  if(!processed&&out.some(a=>{if(a.label!==b.label)return false;const inter=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));return inter/(a.w*a.h+b.w*b.h-inter)>.45;}))continue;
  out.push(b);if(out.length>=maxDet)break;
 }
 return {detections:out.map(b=>({categories:[{categoryName:b.label,index:b.classId,score:b.score}],keypoints:b.points,boundingBox:{originX:b.x,originY:b.y,width:b.w,height:b.h}}))};
}
export function decodeSplitYolo(logits,boxes,width,height,threshold,options={}){
 if(logits.dims[0]!==1||logits.dims[2]!==80||boxes.dims[2]!==4||boxes.dims[1]!==logits.dims[1])throw Error('YOLO26: salida dividida incompatible.');
 const N=logits.dims[1],data=new Float32Array(N*6);
 for(let i=0;i<N;i++){
  let cls=0,score=-Infinity;for(let c=0;c<80;c++){const v=logits.data[i*80+c];if(v>score){score=v;cls=c;}}
  const j=i*4,cx=boxes.data[j]*640,cy=boxes.data[j+1]*640,w=boxes.data[j+2]*640,h=boxes.data[j+3]*640;
  data.set([cx-w/2,cy-h/2,cx+w/2,cy+h/2,score,cls],i*6);
 }
 return decodeYolo(data,[1,N,6],width,height,640,threshold,null,options);
}
export async function downloadModel(url,onProgress=()=>{}){
 onProgress({stage:'download',loaded:0,total:0});
 const response=await fetch(url);if(!response.ok)throw Error('Descarga del modelo: HTTP '+response.status);
 const total=Number(response.headers.get('content-length'))||0;
 if(!response.body?.getReader){const bytes=new Uint8Array(await response.arrayBuffer());onProgress({stage:'download',loaded:bytes.byteLength,total:bytes.byteLength});return bytes;}
 const reader=response.body.getReader(),chunks=[];let loaded=0;
 for(;;){const {done,value}=await reader.read();if(done)break;chunks.push(value);loaded+=value.byteLength;onProgress({stage:'download',loaded,total});}
 const bytes=new Uint8Array(loaded);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 return bytes;
}
let ortPromise;
async function runtime(){
 if(!ortPromise)ortPromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/ort.min.js';script.onload=()=>resolve(globalThis.ort);script.onerror=()=>reject(Error('No se pudo cargar ONNX Runtime.'));document.head.append(script);}).catch(e=>{ortPromise=null;throw e;});
 return ortPromise;
}
export async function createZoneDetector(key,trainedBytes,threshold=.45,options={}){
 const config=MODELS[key];if(!config)throw Error('Modelo desconocido.');
 const progress=options.onProgress||(()=>{});progress({stage:'runtime'});
 if(config.type==='mediapipe'){
  if(config.local&&!trainedBytes)throw Error(key==='lite3'?'Lite3 necesita su archivo .tflite. Pulsa «descarga oficial INT8» junto al selector y después «Cargar archivo del modelo». No necesitas un ZIP de entrenamiento.':'Extrae el ZIP del resultado y elige model.tflite en Cargar archivo del modelo.');
  const mod=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32');
  const vision=await mod.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm');
  const bytes=config.local?trainedBytes:await downloadModel(config.url,progress);progress({stage:'prepare'});
  await new Promise(resolve=>setTimeout(resolve,0));
  const detector=await mod.ObjectDetector.createFromOptions(vision,{baseOptions:{modelAssetBuffer:bytes,delegate:'CPU'},runningMode:'IMAGE',scoreThreshold:threshold,maxResults:options.maxDet??20,...((!config.local||key==='lite3')&&options.classIds&&{categoryAllowlist:options.classIds.map(id=>COCO_NAMES[id])})});
  return {detect(input){const result=detector.detect(input);result.detections=result.detections.flatMap(d=>{const c=d.categories?.[0];if(!c)return [];const label=labelName(c.categoryName);const id=COCO_NAMES.indexOf(label);if((!config.local||key==='lite3')&&options.classIds!==null&&!(options.classIds??[0,1]).includes(id))return [];return [{...d,categories:[{...c,categoryName:label}]}];});return result;},close:()=>detector.close()};
 }
 if(config.local&&!trainedBytes)throw Error('Extrae el ZIP y carga export/model.onnx para usar YOLO11 entrenado.');
 const ort=await runtime();ort.env.wasm.numThreads=1;ort.env.wasm.wasmPaths='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/';
 const bytes=config.local?trainedBytes:await downloadModel(config.url,progress);progress({stage:'prepare'});
 await new Promise(resolve=>setTimeout(resolve,0));
 const session=await ort.InferenceSession.create(bytes,{executionProviders:['wasm']});
 const metadata=session.inputMetadata?.[0],shape=metadata?.shape;
 if(shape&&(shape.length!==4||shape.slice(1).join(',')!=='3,640,640'||(typeof shape[0]==='number'&&shape[0]!==1))){await session.release();throw Error('YOLO: entrada incompatible con 640×640.');}
 const canvas=document.createElement('canvas');canvas.width=640;canvas.height=640;const ctx=canvas.getContext('2d',{willReadFrequently:true});
 return {async detect(input){const w=input.width,h=input.height,s=Math.min(640/w,640/h),rw=Math.round(w*s),rh=Math.round(h*s);ctx.fillStyle='rgb(114,114,114)';ctx.fillRect(0,0,640,640);ctx.drawImage(input,Math.floor((640-rw)/2),Math.floor((640-rh)/2),rw,rh);const pixels=ctx.getImageData(0,0,640,640).data,plane=640*640,data=new Float32Array(plane*3);for(let i=0;i<plane;i++)for(let c=0;c<3;c++)data[c*plane+i]=pixels[i*4+c]/255;const result=await session.run({[session.inputNames[0]]:new ort.Tensor('float32',data,[1,3,640,640])});if(config.splitOutput)return decodeSplitYolo(result.logits,result.pred_boxes,w,h,threshold,options);const output=result[session.outputNames[0]];if(config.normalizedPose){const copy=scaleNormalizedPose(output.data,output.dims);return decodeYolo(copy,output.dims,w,h,640,threshold,['person'],{...options,pose:true});}return decodeYolo(output.data,output.dims,w,h,640,threshold,config.pose?['person']:config.classes,{...options,pose:config.pose});},setOptions(value){options=value;},setThreshold(value){threshold=value;},close:()=>session.release()};
}

export function scaleNormalizedPose(data,dims,size=640){
 if(dims.length!==3||dims[0]!==1||dims[2]!==57)throw Error('YOLO26 pose: salida normalizada incompatible.');
 const copy=new Float32Array(data);
 for(let i=0;i<dims[1];i++){
  const j=i*57;for(let k=0;k<4;k++)copy[j+k]*=size;
  for(let k=6;k<57;k+=3){copy[j+k]*=size;copy[j+k+1]*=size;}
 }
 return copy;
}
