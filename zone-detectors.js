// All inference is local. Public runtimes and original weights load on first use.
export const MODELS={
 original:{name:'EfficientDet original',type:'mediapipe',url:'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float32/1/efficientdet_lite0.tflite'},
 lite2:{name:'EfficientDet-Lite2 preentrenado',type:'mediapipe',url:'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite2/float32/1/efficientdet_lite2.tflite'},
 trained:{name:'EfficientDet entrenado · archivo local',type:'mediapipe',local:true},
 yolov8n:{name:'YOLOv8n preentrenado',type:'onnx',url:'https://huggingface.co/salim4n/yolov8n-detect-onnx/resolve/98100409491fa67f62a2e780a4efe485b86dfd0b/yolov8n-onnx-web/yolov8n.onnx'},
 yolo_trained:{name:'YOLO11 entrenado · archivo local',type:'onnx',local:true,classes:['bicicleta','bicicleta_spinning']},
 yolo_s:{name:'YOLO11s preentrenado',type:'onnx',url:'https://huggingface.co/giangndm/yolo11-onnx/resolve/8b180c762d5cf217886d16e64403508042207e4d/yolo11s_640.onnx'},
 yolo_m:{name:'YOLO11m preentrenado',type:'onnx',url:'https://huggingface.co/giangndm/yolo11-onnx/resolve/8b180c762d5cf217886d16e64403508042207e4d/yolo11m_640.onnx'},
 yolo:{name:'YOLO11n preentrenado',type:'onnx',url:'https://huggingface.co/webnn/yolo11n/resolve/9c5acfdd74aaff2d0f47c51b878506361039a51f/onnx/yolo11n.onnx'}
};
export function labelName(name){return ['bicicleta','bicicleta_spinning','bicycle'].includes(name)?'bicycle':name;}
export function decodeYolo(data,dims,width,height,size=640,threshold=.45,classes=null){
 const classCount=classes?classes.length:80;
 if(dims.length!==3||dims[0]!==1||dims[1]!==4+classCount||!Number.isInteger(dims[2])||dims[2]<1||data.length!==dims[1]*dims[2])throw Error('YOLO: salida incompatible; se esperaba [1,'+(4+classCount)+',N].');
 const N=dims[2],scale=Math.min(size/width,size/height),rw=Math.round(width*scale),rh=Math.round(height*scale),px=Math.floor((size-rw)/2),py=Math.floor((size-rh)/2),boxes=[];
 for(let i=0;i<N;i++){
  // Retain only predictions whose winning COCO category is person or bicycle.
  let cls=0,score=-Infinity;for(let c=0;c<classCount;c++){const s=data[(4+c)*N+i];if(s>score){score=s;cls=c;}}
  const label=classes?labelName(classes[cls]):(cls===0?'person':cls===1?'bicycle':'');
  if(!['person','bicycle'].includes(label)||!Number.isFinite(score)||score<threshold)continue;
  const cx=data[i],cy=data[N+i],bw=data[2*N+i],bh=data[3*N+i];
  const x1=Math.max(0,(cx-bw/2-px)/scale),y1=Math.max(0,(cy-bh/2-py)/scale),x2=Math.min(width,(cx+bw/2-px)/scale),y2=Math.min(height,(cy+bh/2-py)/scale);
  if(x2>x1&&y2>y1)boxes.push({label,score,x:x1,y:y1,w:x2-x1,h:y2-y1});
 }
 const out=[];
 for(const b of boxes.sort((a,b)=>b.score-a.score)){
  if(out.some(a=>{if(a.label!==b.label)return false;const inter=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));return inter/(a.w*a.h+b.w*b.h-inter)>.45;}))continue;
  out.push(b);if(out.length>=30)break;
 }
 return {detections:out.map(b=>({categories:[{categoryName:b.label,score:b.score}],boundingBox:{originX:b.x,originY:b.y,width:b.w,height:b.h}}))};
}
let ortPromise;
async function runtime(){
 if(!ortPromise)ortPromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/ort.min.js';script.onload=()=>resolve(globalThis.ort);script.onerror=()=>reject(Error('No se pudo cargar ONNX Runtime.'));document.head.append(script);}).catch(e=>{ortPromise=null;throw e;});
 return ortPromise;
}
export async function createZoneDetector(key,trainedBytes,threshold=.45){
 const config=MODELS[key];if(!config)throw Error('Modelo desconocido.');
 if(config.type==='mediapipe'){
  if(config.local&&!trainedBytes)throw Error('Extrae el ZIP del resultado y elige model.tflite en Cargar modelo entrenado.');
  const mod=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32');
  const vision=await mod.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm');
  const detector=await mod.ObjectDetector.createFromOptions(vision,{baseOptions:{...(config.local?{modelAssetBuffer:trainedBytes}:{modelAssetPath:config.url}),delegate:'CPU'},runningMode:'IMAGE',scoreThreshold:threshold,maxResults:30});
  return {detect(input){const result=detector.detect(input);result.detections=result.detections.flatMap(d=>{const c=d.categories?.[0];if(!c)return [];const label=labelName(c.categoryName);if(!['bicycle','person'].includes(label))return [];return [{...d,categories:[{...c,categoryName:label}]}];});return result;},close:()=>detector.close()};
 }
 if(config.local&&!trainedBytes)throw Error('Extrae el ZIP y carga export/model.onnx para usar YOLO11 entrenado.');
 const ort=await runtime();ort.env.wasm.numThreads=1;ort.env.wasm.wasmPaths='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/';
 const session=await ort.InferenceSession.create(config.local?trainedBytes:config.url,{executionProviders:['wasm']});
 const metadata=session.inputMetadata?.[0],shape=metadata?.shape;
 if(shape&&shape.join(',')!=='1,3,640,640'){await session.release();throw Error('YOLO: entrada incompatible con 640×640.');}
 const canvas=document.createElement('canvas');canvas.width=640;canvas.height=640;const ctx=canvas.getContext('2d',{willReadFrequently:true});
 return {async detect(input){const w=input.width,h=input.height,s=Math.min(640/w,640/h),rw=Math.round(w*s),rh=Math.round(h*s);ctx.fillStyle='rgb(114,114,114)';ctx.fillRect(0,0,640,640);ctx.drawImage(input,Math.floor((640-rw)/2),Math.floor((640-rh)/2),rw,rh);const pixels=ctx.getImageData(0,0,640,640).data,plane=640*640,data=new Float32Array(plane*3);for(let i=0;i<plane;i++)for(let c=0;c<3;c++)data[c*plane+i]=pixels[i*4+c]/255;const result=await session.run({[session.inputNames[0]]:new ort.Tensor('float32',data,[1,3,640,640])});const output=result[session.outputNames[0]];return decodeYolo(output.data,output.dims,w,h,640,threshold,config.classes);},close:()=>session.release()};
}
