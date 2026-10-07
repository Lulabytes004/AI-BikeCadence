import {MODELS,createZoneDetector} from './zone-detectors.js?v=v8pose1';
const $=id=>document.getElementById(id),video=$('video'),canvas=$('overlay'),ctx=canvas.getContext('2d');
const inputCanvas=document.createElement('canvas'),inputCtx=inputCanvas.getContext('2d',{willReadFrequently:true});
const pixelCanvas=document.createElement('canvas');pixelCanvas.width=96;pixelCanvas.height=54;
const pixelCtx=pixelCanvas.getContext('2d',{willReadFrequently:true});
let MAX_CYCLISTS=32;
const tracks=new globalThis.PoseTracks(MAX_CYCLISTS);
const bikeZones=new globalThis.BikeZones(MAX_CYCLISTS);
const zoneCanvas=document.createElement('canvas'),zoneCtx=zoneCanvas.getContext('2d');
let objectDetector=null,objectPromise=null,lastZoneScan=-Infinity,zoneScanCount=0,zoneFailure='',lastFound=[],lastPoseLandmarks=[],lastPoseZoneIds=[],lastPoseMs=0,detectorCalls=0,detectorMs=0;
const layer=id=>$(id).checked;
function detectorOptions(){
 const maximum=Number($('detectorMaxDet').value)||20;
 if(!Number.isInteger(maximum)||maximum<1||maximum>300)throw Error('max_det debe estar entre 1 y 300.');
 const value=$('detectorObjects').value||'person';
 return {maxDet:maximum,classIds:value==='all'?null:[{person:0,bicycle:1,motorcycle:3}[value]]};
}

let rawBoxes=[],detectorPoseFrame=-1,detectorPoseLandmarks=[];
let zoneGeneration=0,zoneBusy=false,selectedModel='original',trainedBytes=null,trainedYoloBytes=null;
async function initZones(){
 if(!layer('layerDetector'))return null;
 if(objectDetector)return objectDetector;if(objectPromise){await objectPromise;return objectDetector||initZones();}
 const generation=zoneGeneration,key=selectedModel;
 setModelLoading(true);$('modelStatus').textContent='Cargando '+MODELS[key].name+'…';
 const pending=(async()=>{
  const detector=await createZoneDetector(key,key==='yolo_trained'?trainedYoloBytes:trainedBytes,Number($('detectorConfidence').value)||.45,{...detectorOptions(),onProgress:info=>{if(generation===zoneGeneration)showModelProgress(key,info);}});
  if(generation!==zoneGeneration){await detector.close();return null;}
  objectDetector=detector;zoneFailure='';$('modelStatus').textContent='✓ LISTO: '+MODELS[key].name+' · pulsa 1. Detectar y fijar zonas para analizar el vídeo';return detector;
 })();objectPromise=pending;
 try{return await pending;}catch(e){if(generation===zoneGeneration){zoneFailure='No se pudo cargar '+MODELS[key].name+': '+(e.message||String(e));$('modelStatus').textContent=zoneFailure;}return null;}finally{if(objectPromise===pending)objectPromise=null;if(generation===zoneGeneration)setModelLoading(false);}
}
function resetZones(){zoneGeneration++;bikeZones.reset();rawBoxes=[];detectorPoseFrame=-1;detectorPoseLandmarks=[];lastZoneScan=-Infinity;zoneScanCount=0;detectorCalls=0;detectorMs=0;}
async function scanZones(t,landmarks=[]){
 if(!layer('layerDetector')||!objectDetector||zoneBusy||(layer('layerZones')&&(bikeZones.locked||zoneScanCount>=6))||t-lastZoneScan<650||frozen)return;
 const generation=zoneGeneration,detector=objectDetector;
 zoneBusy=true;lastZoneScan=t;const started=performance.now();
 const snapshot=document.createElement('canvas');snapshot.width=inputCanvas.width;snapshot.height=inputCanvas.height;snapshot.getContext('2d').drawImage(inputCanvas,0,0);
 const W=snapshot.width,H=snapshot.height,boxes=[];
 const tile=document.createElement('canvas'),context=tile.getContext('2d');
 try{
  for(const [x,y,w,h] of (layer('layerCrops')?[[0,0,1,1],[0,0,.6,.6],[.4,0,.6,.6],[0,.4,.6,.6],[.4,.4,.6,.6]]:[[0,0,1,1]])){
   tile.width=Math.round(W*w);tile.height=Math.round(H*h);
   context.drawImage(snapshot,x*W,y*H,w*W,h*H,0,0,tile.width,tile.height);
   detectorCalls++;const result=await detector.detect(tile);if(generation!==zoneGeneration)return;
   for(const d of result.detections??[]){const c=d.categories?.[0],b=d.boundingBox;if(!c||!b)continue;
    boxes.push({label:c.categoryName,score:c.score,x:x+b.originX/W,y:y+b.originY/H,w:b.width/W,h:b.height/H,keypoints:(d.keypoints??[]).map(p=>({x:x+p.x/W,y:y+p.y/H,score:p.score}))});
   }
  }
  rawBoxes=boxes;
  detectorPoseFrame=video.currentTime;
  const cocoSlots=[0,2,5,7,8,11,12,13,14,15,16,23,24,25,26,27,28];
  detectorPoseLandmarks=boxes.filter(b=>b.keypoints.length).map(b=>{
   const lm=Array.from({length:33},()=>({x:0,y:0,visibility:0}));
   b.keypoints.forEach((p,i)=>{if(cocoSlots[i]!==undefined)lm[cocoSlots[i]]={x:p.x,y:p.y,visibility:p.score??0};});return lm;
  });
  if(layer('layerZones'))bikeZones.update([...boxes,...globalThis.poseZoneBoxes(landmarks)],t);zoneScanCount++;
  if(layer('layerZones')&&zoneScanCount>=6)bikeZones.lock();
 }catch(e){if(generation===zoneGeneration){zoneFailure='Error al detectar zonas: '+(e.message||String(e));$('modelStatus').textContent='ERROR DE DETECCIÓN: '+zoneFailure;zoneScanCount=6;}}
 finally{if(generation===zoneGeneration)detectorMs+=performance.now()-started;zoneBusy=false;showZoneStatus();draw(lastFound);}
}
function showZoneStatus(){
 if(!layer('layerDetector')){$('zoneStatus').textContent='Detector desactivado.';return;}
 if(!layer('layerZones')){$('zoneStatus').textContent=zoneFailure||('Detecciones directas: '+rawBoxes.length+' cajas · '+rawBoxes.filter(b=>b.label==='bicycle').length+' bicicletas · '+rawBoxes.filter(b=>b.label==='person').length+' personas. Sin confirmación de zonas.');return;}
 const zs=bikeZones.zones,bikes=zs.filter(z=>z.kind==='bicycle').length;
 $('zoneStatus').textContent=zoneFailure||(zoneScanCount>=6?(zs.length?`${zs.length} zonas confirmadas (máximo ${MAX_CYCLISTS}) · ${detectorCalls} análisis · ${(detectorMs/1000).toFixed(1)} s. ${bikes?'Bicicletas: '+bikes+'. ':''}Pulsa 2. Analizar posturas desde el inicio para continuar; vuelve a detectar si cambia la escena.`:'No se confirmaron zonas. Prueba otra vista y vuelve a detectar.'):`Buscando zonas (${zoneScanCount}/6 muestras). Pulsa 1. Detectar y fijar zonas para confirmarlas.`);
}

const colors=['#127fc4','#e77a24','#16875d','#9c4bc7','#cc4268','#078f9c','#9a7626','#475bd0'];
let pose=null,source=null,blobURL=null,session=0,requestId=null,loadId=0;
let lastMediaTime=-1,lastModelTimestamp=0,lastInferenceWall=0,lastPixels=null,lastChangeTime=null,frozen=false;
let records=[],poseRecords=[],modelPromise=null,diagnostic='';
let selectedPoseModel='none',frameBusy=false,poseRuntimeConfig=null,poseLoading=false,detectorLoading=false,manualScan=false,poseFactoryOverride=null;
const poseScope=()=>$('poseScope').value||'full';
const setStatus=text=>$('status').textContent=text;
function error(e){setStatus('Error');diagnostic=e.message||String(e);$('diag').textContent=diagnostic;console.error(e);}
const poseName=()=>$('poseModel').selectedOptions?.[0]?.textContent||selectedPoseModel;
const poseConfig=()=>selectedPoseModel+':'+poseScope()+':'+MAX_CYCLISTS;
function syncAutomaticPhases(){
 $('layerDetector').checked=true;$('layerZones').checked=true;$('layerCrops').checked=$('detectorTiles').checked;
 $('layerPose').checked=selectedPoseModel!=='none';$('layerCadence').checked=selectedPoseModel!=='none';
 $('layerStatus').textContent=selectedPoseModel==='none'?'Detector inicial → zonas. Sin postura.':'Detector inicial → zonas → '+poseName()+' → cadencia.';
}
function renderReferences(){
 const previousValues=Array.from({length:MAX_CYCLISTS},(_,i)=>$('expected'+(i+1))?.value||'');
 const container=$('expectedReferences');container.replaceChildren();
 for(let i=1;i<=MAX_CYCLISTS;i++){
  const previous=previousValues[i-1],label=document.createElement('label'),input=document.createElement('input');
  label.textContent='Referencia '+i+' ';Object.assign(input,{id:'expected'+i,type:'number',min:'0',max:'180',step:'1',placeholder:'RPM',value:previous});input.style.width='75px';label.append(input);container.append(label);
 }
}
function showPoseProgress(info){
 const bar=$('poseProgress');bar.hidden=false;
 if(info.stage==='download'){
  if(info.total){bar.max=info.total;bar.value=info.loaded;}else bar.removeAttribute?.('value');
  $('poseStatus').textContent='DESCARGANDO '+poseName()+' · '+(info.loaded/1048576).toFixed(1)+' MiB'+(info.total?' / '+(info.total/1048576).toFixed(1)+' MiB':'')+'…';
 }else{bar.removeAttribute?.('value');$('poseStatus').textContent=(info.stage==='prepare'?'PREPARANDO ':'CARGANDO MOTOR · ')+poseName()+'…';}
}
async function initPose(){
 if(!layer('layerPose'))return null;
 if(pose)return pose;
 if(modelPromise)return modelPromise;
 poseLoading=true;setModelLoading(detectorLoading);showPoseProgress({stage:'runtime'});
 modelPromise=(async()=>{
  let createPoseModel=poseFactoryOverride;
  if(!createPoseModel){
   ({createPoseModel}=await import('./pose-models.js?v=v8pose1'));
  }
  pose=await createPoseModel(selectedPoseModel,{maxPoses:MAX_CYCLISTS,scope:poseScope(),onProgress:showPoseProgress});
  poseRuntimeConfig=poseConfig();
  $('poseStatus').textContent='✓ LISTO: '+poseName()+' · '+(source?'pulsa 2. Analizar posturas desde el inicio cuando las zonas estén fijadas.':'carga un vídeo o inicia la cámara.');
  return pose;
 })();
 try{return await modelPromise;}catch(e){$('poseStatus').textContent='ERROR DE POSTURA: '+(e.message||String(e));throw e;}
 finally{modelPromise=null;poseLoading=false;$('poseProgress').hidden=true;setModelLoading(detectorLoading);}
}

function clearData(preserveZones=false){
 tracks.reset();lastMediaTime=-1;lastInferenceWall=0;lastPixels=null;lastChangeTime=null;records=[];poseRecords=[];if(!preserveZones)resetZones();lastFound=[];lastPoseLandmarks=[];lastPoseZoneIds=[];lastPoseMs=0;$('poseResults').textContent='Sin postura analizada todavía.';showZoneStatus();
 $('freeze').checked=false;frozen=false;
 draw([]);render([]);diagnostic='Historial reiniciado.';$('diag').textContent=diagnostic;
}
function cancelLoop(){session++;if(requestId!==null){if(video.cancelVideoFrameCallback)video.cancelVideoFrameCallback(requestId);else cancelAnimationFrame(requestId);}requestId=null;}
function releaseSource(){
 cancelLoop();video.pause();video.srcObject?.getTracks().forEach(t=>t.stop());video.srcObject=null;video.removeAttribute('src');video.load();
 if(blobURL){URL.revokeObjectURL(blobURL);blobURL=null;}
 source=null;clearData();$('scanZones').disabled=true;$('camera').textContent='Iniciar cámara';$('play').disabled=true;$('step').disabled=true;$('videoControls').classList.add('hidden');
}
async function startCamera(){
 const token=++loadId;releaseSource();
 try{
  if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw new Error('La cámara necesita HTTPS o localhost y permiso de acceso.');
  setStatus('Solicitando cámara…');
  const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30}},audio:false});
  if(token!==loadId){stream.getTracks().forEach(t=>t.stop());return;}
  source='camera';video.srcObject=stream;await video.play();await Promise.all([initPose(),initZones()]);
  if(token!==loadId)return;
  $('scanZones').disabled=false;$('camera').textContent='Detener cámara';$('sourceLabel').textContent='Cámara en directo';setStatus('Buscando ciclistas…');schedule();
 }catch(e){if(token===loadId){releaseSource();error(e);}}
}
function once(target,event){return new Promise((resolve,reject)=>{
 const success=()=>{cleanup();resolve();},fail=()=>{cleanup();reject(new Error('No se pudo abrir el vídeo. Prueba un MP4 H.264.'));};
 function cleanup(){target.removeEventListener(event,success);target.removeEventListener('error',fail);}
 target.addEventListener(event,success,{once:true});target.addEventListener('error',fail,{once:true});
 });}
async function openFile(file){
 const token=++loadId;releaseSource();
 try{
  source='file';blobURL=URL.createObjectURL(file);const loaded=once(video,'loadeddata');video.src=blobURL;video.load();await loaded;
  if(token!==loadId)return;
  $('view').style.aspectRatio=`${video.videoWidth}/${video.videoHeight}`;
  $('videoControls').classList.remove('hidden');$('fileName').textContent=file.name;
  $('sourceLabel').textContent='Vídeo local · '+file.name;$('seek').max=video.duration;$('seek').value=0;
  await Promise.all([initPose(),initZones()]);if(token!==loadId)return;
  $('scanZones').disabled=false;$('play').disabled=false;$('step').disabled=false;setStatus('Vídeo listo · pulsa 1. Detectar y fijar zonas');updateTime();await processFrame(0);
 }catch(e){if(token===loadId)error(e);}
}
function updateTime(){if(source==='file'){$('seek').value=video.currentTime;$('time').textContent=`${video.currentTime.toFixed(2)} / ${video.duration.toFixed(2)} s`;}}
function schedule(){
 if(video.paused || !source || requestId!==null)return;
 const token=session;
 const callback=async(_now,metadata)=>{
  requestId=null;if(token!==session || video.paused || !source)return;
  const mediaTime=metadata?.mediaTime??video.currentTime;
  // Throttle live input only; local playback uses all presented frames.
  try{if(source==='file'||performance.now()-lastInferenceWall>=45)await processFrame(mediaTime);}catch(e){cancelLoop();video.pause();error(e);return;}
  schedule();
 };
 requestId=video.requestVideoFrameCallback?video.requestVideoFrameCallback(callback):requestAnimationFrame(callback);
}
function sourcePixels(){
 if(!frozen){inputCanvas.width=video.videoWidth;inputCanvas.height=video.videoHeight;inputCtx.drawImage(video,0,0);}
 pixelCtx.drawImage(inputCanvas,0,0,96,54);return pixelCtx.getImageData(0,0,96,54).data;
}
function stationaryPixels(pixels,t){
 let diff=Infinity;
 if(lastPixels){let sum=0;for(let i=0;i<pixels.length;i+=4)sum+=(Math.abs(pixels[i]-lastPixels[i])+Math.abs(pixels[i+1]-lastPixels[i+1])+Math.abs(pixels[i+2]-lastPixels[i+2]))/3;diff=sum/(pixels.length/4);}
 if(lastChangeTime===null || diff>.08)lastChangeTime=t;
 lastPixels=new Uint8ClampedArray(pixels);
 return t-lastChangeTime>=650;
}
function processFrame(mediaTime,preview=false){
 if(frameBusy || video.readyState<2 || video.seeking || mediaTime===lastMediaTime)return;
 if(mediaTime<lastMediaTime)clearData(true);
 const mediaDelta=lastMediaTime<0?1:Math.max(.01,(mediaTime-lastMediaTime)*1000);
 lastMediaTime=mediaTime;lastInferenceWall=performance.now();
 const t=mediaTime*1000,still=stationaryPixels(sourcePixels(),t);
 // MediaPipe needs strictly increasing inference timestamps even after a seek/replay.
 lastModelTimestamp+=mediaDelta;
 const generation=zoneGeneration,token=session,poseStarted=performance.now();
 const complete=result=>{
  if(generation!==zoneGeneration||token!==session)return;
  try{scanZones(t,[]);}catch(e){zoneFailure='Error al detectar zonas: '+(e.message||String(e));$('modelStatus').textContent='ERROR DE DETECCIÓN: '+zoneFailure;zoneScanCount=6;}
  showZoneStatus();
  lastPoseLandmarks=result.landmarks??[];lastPoseZoneIds=result.zoneIds??[];lastPoseMs=layer('layerPose')?performance.now()-poseStarted:0;
  $('poseResults').textContent=layer('layerPose')?(lastPoseLandmarks.length+' posturas en '+(poseScope()==='zones'?bikeZones.zones.length+' zonas':'la imagen completa')+' · '+lastPoseMs.toFixed(0)+' ms por fotograma'+(!lastPoseLandmarks.length?' · El modelo no ha devuelto puntos todavía.':'')):'Ninguno: no se analiza postura.';
  const found=!preview&&layer('layerCadence')&&layer('layerPose')?tracks.update(result.landmarks??[],t,video.videoWidth/video.videoHeight,still):(result.landmarks??[]).map((lm,i)=>({id:i+1,lm,x:lm[23]?.x??0,result:{rpm:null,state:'waiting',quality:0,cycles:0}}));
  lastFound=found;render(found);draw(found);updateTime();if(!preview)record(t,found,result.landmarks??[],still,result.zoneIds??[]);
  const waiting=layer('layerPose')&&poseScope()==='zones'&&!bikeZones.locked;
  setStatus(waiting?'Esperando zonas confirmadas…':!layer('layerCadence')?'Detección sin cálculo de RPM':still?'Imagen quieta':found.length?'Analizando ciclistas…':'No veo una persona');
 };
 const result=layer('layerPose')&&pose?(pose.infer?pose.infer(inputCanvas,lastModelTimestamp,bikeZones.locked?bikeZones.zones:[],poseScope()):pose.detectForVideo(inputCanvas,lastModelTimestamp)):{landmarks:[]};
 if(result?.then){frameBusy=true;return result.then(complete).finally(()=>{frameBusy=false;});}
 complete(result);
}

function render(found){
 const cards=$('cards');cards.replaceChildren();
 if(!found.length){const card=document.createElement('div');card.className='card';card.style.setProperty('--color',colors[0]);card.textContent='Sin persona detectada · RPM --';cards.append(card);return;}
 for(const track of found){
  const r=track.result,card=document.createElement('div');card.className='card';card.style.setProperty('--color',colors[(track.id-1)%colors.length]);
  const header=document.createElement('div');header.textContent='Ciclista '+track.id;
  const rpm=document.createElement('div');rpm.className='rpm';rpm.append(r.rpm===null?'-- ':Math.round(r.rpm)+' ');const unit=document.createElement('small');unit.textContent='RPM';rpm.append(unit);
  const detail=document.createElement('div');detail.className='detail';
  const states={still:'Sin movimiento',waiting:'Buscando ciclos estables',missing:'Persona no visible',measuring:'Pedaleo periódico'};
  detail.textContent=`${states[r.state]} · Método: ${r.method??'--'} · Confianza: ${Math.round(r.quality*100)}% · Ciclos confirmados: ${r.cycles}`;
  card.append(header,rpm,detail);cards.append(card);
 }
}
const skeletonConnections=[[0,2],[0,5],[2,7],[5,8],[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],[27,29],[29,31],[27,31],[28,30],[30,32],[28,32]];
const usablePoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&(p.visibility??0)>=.3;
function poseZoneIndex(index){
 if(lastPoseZoneIds[index]!=null)return lastPoseZoneIds[index];
 const lm=lastPoseLandmarks[index],hip=lm?.[23];if(!hip)return null;
 const candidates=bikeZones.zones.filter(z=>hip.x>=z.x&&hip.x<=z.x+z.w&&hip.y>=z.y&&hip.y<=z.y+z.h);
 return candidates.sort((a,b)=>Math.abs(a.x+a.w/2-hip.x)-Math.abs(b.x+b.w/2-hip.x))[0]?.id??null;
}
function zoneText(lines,x,y,color){
 const size=Math.max(12,Math.min(18,canvas.width/75)),height=size+4;ctx.font=size+'px system-ui';
 const width=Math.max(...lines.map(line=>ctx.measureText?.(line).width??line.length*size*.55));
 const left=Math.max(0,Math.min(canvas.width-width-8,x+4)),top=Math.max(0,Math.min(canvas.height-lines.length*height-6,y+4));
 ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillRect?.(left-2,top-2,width+8,lines.length*height+4);ctx.fillStyle=color;
 lines.forEach((line,i)=>ctx.fillText(line,left+2,top+size+i*height));
}
function draw(found){
 canvas.width=video.videoWidth||1280;canvas.height=video.videoHeight||720;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.setLineDash([]);
 if(!layer('layerZones')){
  for(const b of rawBoxes){ctx.strokeStyle='#00c853';ctx.lineWidth=3;ctx.strokeRect(b.x*canvas.width,b.y*canvas.height,b.w*canvas.width,b.h*canvas.height);if($('showZoneData').checked)zoneText([b.label+' '+(b.score*100).toFixed(1)+'%'],b.x*canvas.width,b.y*canvas.height,'#00c853');}
 }
 if(layer('layerZones')&&$('showZones').checked){
  for(const z of bikeZones.zones){
   const color=colors[(z.id-1)%colors.length];ctx.strokeStyle=color;ctx.lineWidth=3;
   ctx.strokeRect(z.x*canvas.width,z.y*canvas.height,z.w*canvas.width,z.h*canvas.height);
   const lines=['Z'+z.id];
   if($('showZoneData').checked){
    lines.push('Detector: '+(Number.isFinite(z.score)?(100*z.score).toFixed(1)+'%':'--'));
    lines.push('x '+Math.round(z.x*canvas.width)+' · y '+Math.round(z.y*canvas.height)+' · '+Math.round(z.w*canvas.width)+' × '+Math.round(z.h*canvas.height)+' px');
    const i=lastPoseLandmarks.findIndex((_,i)=>poseZoneIndex(i)===z.id),lm=lastPoseLandmarks[i];
    if(layer('layerPose'))lines.push(lm?'Puntos (media): '+(100*[11,12,23,24,25,26,27,28].reduce((sum,k)=>sum+(lm[k]?.visibility??0),0)/8).toFixed(1)+'%':'Postura: no detectada');
   }
   zoneText(lines,z.x*canvas.width,z.y*canvas.height,color);
  }
 }
 if(!$('showPose').checked)return;
 const visiblePoses=layer('layerPose')?lastPoseLandmarks:(Math.abs(video.currentTime-detectorPoseFrame)<.001?detectorPoseLandmarks:[]);
 // Draw raw pose output immediately, independently of cadence track confirmation.
 visiblePoses.forEach((lm,i)=>{
  const zoneId=poseZoneIndex(i),color=colors[((zoneId??i+1)-1)%colors.length];ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=3;
  for(const [a,b] of skeletonConnections){if(!usablePoint(lm[a])||!usablePoint(lm[b]))continue;ctx.beginPath();ctx.moveTo(lm[a].x*canvas.width,lm[a].y*canvas.height);ctx.lineTo(lm[b].x*canvas.width,lm[b].y*canvas.height);ctx.stroke();}
  for(const p of lm){if(!usablePoint(p))continue;ctx.beginPath();ctx.arc(p.x*canvas.width,p.y*canvas.height,4,0,Math.PI*2);ctx.fill();}
 });
 for(const track of found){if(!track.lm)continue;const head=track.lm[0];if(!usablePoint(head))continue;ctx.font='bold 18px system-ui';ctx.fillStyle=colors[(track.id-1)%colors.length];ctx.fillText('C'+track.id,head.x*canvas.width,Math.max(18,head.y*canvas.height-8));}
}

function record(t,found,lm,still,zoneIds=[]){
 for(const track of found){const r=track.result,reference=$('expected'+track.id)?.value;records.push({time_ms:t,cyclist:track.id,rpm:r.rpm,reference_rpm:reference===''||reference==null?null:Number(reference),quality:r.quality,method:r.method,state:r.state,cycles:r.cycles,frozen_pixels:still});}
 if(!found.length)records.push({time_ms:t,cyclist:null,rpm:null,quality:0,state:'missing',cycles:0,frozen_pixels:still});
 poseRecords.push({time_ms:t,poses:lm,zone_ids:zoneIds,tracks:found.map(track=>({id:track.id,result:track.result,signals:track.signals?.map(({points,...s})=>s)})),frozen_pixels:still});
 // Bound live recording memory; files retain at most the latest ten minutes.
 const cutoff=t-600000;while(records[0]?.time_ms<cutoff)records.shift();while(poseRecords[0]?.time_ms<cutoff)poseRecords.shift();
 const errors=records.filter(r=>r.rpm!==null&&r.reference_rpm!=null&&r.quality>0);
 const mae=errors.length?errors.reduce((s,r)=>s+Math.abs(r.rpm-r.reference_rpm),0)/errors.length:null;
 diagnostic=`Fotogramas analizados: ${poseRecords.length}\nTiempo de entrada: ${(t/1000).toFixed(2)} s\nPersonas: ${found.filter(x=>x.lm).length}\nImagen quieta: ${still?'sí':'no'}\nError medio: ${mae===null?'introduce referencia RPM':mae.toFixed(2)+' RPM'}\nÚltimos 10 minutos exportables. El vídeo se procesa en este dispositivo.`;
 $('diag').textContent=diagnostic;
}
function download(name,body,type){const url=URL.createObjectURL(new Blob([body],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function seekTo(time,resetHistory=true){
 video.pause();cancelLoop();$('play').textContent='2. Analizar posturas desde el inicio';
 while(frameBusy||zoneBusy)await new Promise(resolve=>setTimeout(resolve,20));
 if(resetHistory)clearData(true);
 if(Math.abs(video.currentTime-time)>.00001){const done=once(video,'seeked');video.currentTime=time;await done;}
 await processFrame(video.currentTime,true);updateTime();setStatus('Pausa');
}
$('camera').onclick=()=>{if(source==='camera'){++loadId;releaseSource();setStatus('Detenido');}else startCamera();};
$('file').onchange=()=>{const file=$('file').files[0];if(file)openFile(file);$('file').value='';};
$('play').onclick=async()=>{
 if(poseLoading||detectorLoading||manualScan)return;
 try{if(!video.paused){video.pause();cancelLoop();$('play').textContent='2. Analizar posturas desde el inicio';setStatus('Pausa · medición conservada');}
 else{if(!bikeZones.locked||!bikeZones.zones.length){setStatus('Primero pulsa Detectar y fijar zonas.');return;}await initPose();await seekTo(0);lastMediaTime=-1;video.playbackRate=Number($('speed').value);await video.play();$('play').textContent='Pausar';schedule();}}catch(e){error(e);}
};
$('step').onclick=async()=>{try{const fps=Math.max(1,Number($('fps').value)||30);await seekTo(Math.min(video.duration,video.currentTime+1/fps),false);}catch(e){error(e);}};
$('seek').onchange=async()=>{try{await seekTo(Number($('seek').value));}catch(e){error(e);}};
$('speed').onchange=()=>{video.playbackRate=Number($('speed').value);};
$('reset').onclick=()=>{clearData(true);setStatus('Medición reiniciada');if(video.paused&&pose&&source)Promise.resolve(processFrame(video.currentTime)).catch(error);};
$('freeze').onchange=()=>{if($('freeze').checked){inputCanvas.width=video.videoWidth;inputCanvas.height=video.videoHeight;inputCtx.drawImage(video,0,0);frozen=true;}else{frozen=false;clearData();}};
video.addEventListener('ended',()=>{cancelLoop();$('play').textContent='2. Analizar posturas desde el inicio';setStatus('Vídeo terminado · resultados conservados');});
video.addEventListener('error',()=>{if(source)error(new Error('No se pudo decodificar el vídeo. Usa MP4 H.264.'));});
$('export').onclick=()=>{const keys=['time_ms','cyclist','rpm','reference_rpm','quality','method','state','cycles','frozen_pixels'];const csv=keys.join(',')+'\n'+records.map(r=>keys.map(k=>JSON.stringify(r[k]??'')).join(',')).join('\n');download('cadence-diagnostic.csv',csv,'text/csv');};
$('landmarks').onclick=()=>download('cadence-landmarks.json',JSON.stringify({version:3,pose_model:selectedPoseModel,pose_scope:poseScope(),zone_model:selectedModel,zone_model_name:MODELS[selectedModel].name,zones:bikeZones.zones,zones_locked:bikeZones.locked,source:source==='file'?$('fileName').textContent:'camera',width:video.videoWidth,height:video.videoHeight,references:Array.from({length:MAX_CYCLISTS},(_,i)=>$('expected'+(i+1)).value).map(x=>x===''?null:Number(x)),frames:poseRecords}),'application/json');
// A local harness can inject a compatible pose model and run the same UI pipeline.
// It is opt-in and cannot be activated from arbitrary URL data.
if(new URLSearchParams(location.search).has('test'))window.cadenceDebug={
 setPoseOutput(landmarks,zoneIds=[]){lastPoseLandmarks=landmarks;lastPoseZoneIds=zoneIds;},drawOverlay(){draw(lastFound);},setPoseFactory(factory){poseFactoryOverride=factory;},setModel(model){pose=model;},setZoneModel(model){objectDetector=model;},openFile,processFrame,seekTo,
 get zoneDetector(){return objectDetector;},get records(){return records;},get poseRecords(){return poseRecords;},get tracks(){return tracks;},get zones(){return bikeZones;}
};

for(const id of ['showZones','showZoneData','showPose'])$(id).onchange=()=>draw(lastFound);
$('scanZones').onclick=async()=>{
 const token=loadId,position=video.currentTime;
 video.pause();cancelLoop();$('play').textContent='2. Analizar posturas desde el inicio';
 manualScan=true;clearData();zoneFailure='';$('scanZones').disabled=true;setModelLoading(detectorLoading);
 $('zoneModel').disabled=true;$('play').disabled=true;$('step').disabled=true;$('seek').disabled=true;
 const generation=zoneGeneration;
 try{
  while(frameBusy||zoneBusy)await new Promise(resolve=>setTimeout(resolve,20));
  await initZones();if(token!==loadId||generation!==zoneGeneration||!objectDetector)return;
  if(source==='file'){
   // Read six actual frames while paused: slow models cannot skip the clip.
   const step=Math.min(.7,Math.max(0,(video.duration-.05)/5));
   if(step<.16)throw Error('El vídeo debe durar al menos 0,85 segundos para confirmar zonas.');
   for(let i=0;i<6;i++){
    if(token!==loadId||generation!==zoneGeneration)return;
    setStatus(`Analizando zonas · muestra ${i+1}/6`);
    const t=i*step;
    if(Math.abs(video.currentTime-t)>.00001){const done=once(video,'seeked');video.currentTime=t;await done;}
    if(token!==loadId||generation!==zoneGeneration)return;
    sourcePixels();lastModelTimestamp+=Math.max(1,step*1000);
    const landmarks=[];
    // The explicit scan also supports short clips with samples below 650 ms.
    lastZoneScan=-Infinity;
    await scanZones(t*1000,landmarks);
    if(zoneFailure)break;
    await new Promise(resolve=>setTimeout(resolve,0));
   }
   if(token!==loadId||generation!==zoneGeneration)return;
   if(Math.abs(video.currentTime-position)>.00001){const done=once(video,'seeked');video.currentTime=position;await done;}
   // Analyze the restored frame too: a paused preview must show the selected posture.
   if(!zoneFailure&&layer('layerPose')){await initPose();sourcePixels();lastMediaTime=-1;await processFrame(position,true);lastMediaTime=-1;}
   else if(!zoneFailure&&MODELS[$('zoneModel').value]?.pose&&Math.abs(position-detectorPoseFrame)>=.001){
    // Initial Pose output belongs to the displayed frame, never the last scan sample.
    sourcePixels();const result=await objectDetector.detect(inputCanvas);
    const slots=[0,2,5,7,8,11,12,13,14,15,16,23,24,25,26,27,28];
    detectorPoseLandmarks=(result.detections??[]).filter(d=>d.keypoints?.length).map(d=>{
     const lm=Array.from({length:33},()=>({x:0,y:0,visibility:0}));
     d.keypoints.forEach((p,i)=>{if(slots[i]!==undefined)lm[slots[i]]={x:p.x/inputCanvas.width,y:p.y/inputCanvas.height,visibility:p.score??0};});return lm;
    });detectorPoseFrame=position;
   }
   updateTime();setStatus(zoneFailure?'Error al analizar zonas':'Zonas y vista previa analizadas · pulsa 2. Analizar posturas desde el inicio');
  }else if(source&&video.readyState>=2){sourcePixels();await scanZones(video.currentTime*1000);setStatus('Buscando zonas en la cámara…');}
 }catch(e){if(token===loadId){zoneFailure=e.message||String(e);showZoneStatus();}}
 finally{
  manualScan=false;setModelLoading(detectorLoading);$('zoneModel').disabled=false;$('seek').disabled=false;
  $('scanZones').disabled=!source;$('play').disabled=source!=='file';$('step').disabled=source!=='file';
  if(source==='camera'&&token===loadId){try{await video.play();schedule();}catch(e){error(e);}}
  showZoneStatus();draw(lastFound);
 }
};

async function changeSelectedModel(){
 $('zoneModel').disabled=true;setModelLoading(true);$('modelStatus').textContent='Cambiando de modelo…';
 try{
 video.pause();cancelLoop();$('play').textContent='2. Analizar posturas desde el inicio';
 $('layerDetector').checked=true;selectedModel=$('zoneModel').value;syncModelUI();resetZones();zoneFailure='';
 // Allow an in-flight inference to finish before closing its runtime.
 while(frameBusy||zoneBusy)await new Promise(resolve=>setTimeout(resolve,20));
 const old=objectDetector;objectDetector=null;objectPromise=null;if(old)await old.close();
 clearData();await initZones();showZoneStatus();
 if(source&&video.readyState>=2){sourcePixels();await scanZones(video.currentTime*1000);}
 }catch(e){zoneFailure=e.message||String(e);showZoneStatus();}
 finally{$('zoneModel').disabled=false;setModelLoading(false);if(!layer('layerDetector'))$('modelStatus').textContent='Detector desactivado: activa la capa Detector para cargar el modelo.';}
}
$('zoneModel').onchange=()=>{layerChange=layerChange.then(changeSelectedModel,changeSelectedModel);return layerChange;};

$('trainedModelFile').onchange=async()=>{
 const file=$('trainedModelFile').files[0];if(!file)return;
 try{const isYolo=/\.onnx$/i.test(file.name);if(!isYolo&&!/\.tflite$/i.test(file.name))throw Error('Elige model.onnx o model.tflite, no el ZIP ni los pesos .pt.');const bytes=new Uint8Array(await file.arrayBuffer());if(isYolo)trainedYoloBytes=bytes;else trainedBytes=bytes;$('trainedModelName').textContent=file.name+' · cargado en este dispositivo';$('zoneModel').value=isYolo?'yolo_trained':'trained';await $('zoneModel').onchange();}
 catch(e){$('modelStatus').textContent='No se pudo leer el modelo: '+e.message;}
 $('trainedModelFile').value='';
};

$('compareRun').onclick=async()=>{
 const file=$('compareImage').files[0];if(!file){$('compareStatus').textContent='Selecciona una imagen.';return;}
 const threshold=Number($('compareConfidence').value);
 if(!Number.isFinite(threshold)||threshold<=0||threshold>1){$('compareStatus').textContent='La confianza debe estar entre 0,01 y 1.';return;}
 const key=$('zoneModel').value,button=$('compareRun');button.disabled=true;
 let detector=null,bitmap=null;
 try{
  $('compareStatus').textContent='Cargando modelo y analizando…';
  bitmap=await createImageBitmap(file);
  const c=$('compareCanvas');c.width=bitmap.width;c.height=bitmap.height;
  const context=c.getContext('2d');context.drawImage(bitmap,0,0);
  const snapshot=document.createElement('canvas');snapshot.width=c.width;snapshot.height=c.height;snapshot.getContext('2d').drawImage(bitmap,0,0);
  detector=await createZoneDetector(key,key==='yolo_trained'?trainedYoloBytes:trainedBytes,threshold,detectorOptions());
  const started=performance.now(),result=await detector.detect(snapshot),elapsed=performance.now()-started;
  const labels=[];
  for(const d of result.detections??[]){
   const b=d.boundingBox,category=d.categories[0],label=category.categoryName+' '+(category.score*100).toFixed(1)+'%';labels.push(label);
   context.strokeStyle=category.categoryName==='bicycle'?'#00c853':'#ff9100';context.lineWidth=Math.max(2,c.width/400);
   context.strokeRect(b.originX,b.originY,b.width,b.height);context.font=Math.max(14,c.width/60)+'px sans-serif';context.fillStyle=context.strokeStyle;context.fillText(label,b.originX,Math.max(20,b.originY-4));
  }
  $('compareStatus').textContent=MODELS[key].name+' · '+elapsed.toFixed(0)+' ms · '+labels.length+' detecciones: '+(labels.join(', ')||'ninguna');
 }catch(e){$('compareStatus').textContent='Error: '+e.message;}
 finally{if(detector)await detector.close();if(bitmap)bitmap.close();button.disabled=false;}
};

let layerChange=Promise.resolve();
function changeLayers(){layerChange=layerChange.catch(()=>{}).then(applyLayers);return layerChange;}
async function applyLayers(){
 $('layerStatus').textContent='Aplicando capas…';
 syncAutomaticPhases();
 const limit=Number($('maxZones').value)||MAX_CYCLISTS;
 if(!Number.isInteger(limit)||limit<1||limit>64)throw Error('El máximo de zonas debe estar entre 1 y 64.');
 if(limit!==MAX_CYCLISTS){MAX_CYCLISTS=limit;tracks.maxTracks=limit;bikeZones.max=limit;renderReferences();}
 video.pause();cancelLoop();$('play').textContent='2. Analizar posturas desde el inicio';
 if(!layer('layerPose'))$('layerCadence').checked=false;
 $('layerCadence').disabled=!layer('layerPose');
 clearData();zoneFailure='';
 while(frameBusy||zoneBusy)await new Promise(resolve=>setTimeout(resolve,20));
 if(poseRuntimeConfig&&poseRuntimeConfig!==poseConfig()){const old=pose;pose=null;poseRuntimeConfig=null;await old.close();}
 const threshold=Number($('detectorConfidence').value);
 if(!Number.isFinite(threshold)||threshold<=0||threshold>1)throw Error('Confianza inválida: usa un valor entre 0,01 y 1.');
 if(objectDetector?.setThreshold){objectDetector.setThreshold(threshold);objectDetector.setOptions?.(detectorOptions());}else{const old=objectDetector;objectDetector=null;objectPromise=null;if(old)await old.close();}
 await Promise.all([initZones(),initPose()]);
 syncAutomaticPhases();
 if(source&&video.readyState>=2){await processFrame(video.currentTime);while(zoneBusy)await new Promise(resolve=>setTimeout(resolve,20));}
}
for(const id of ['layerDetector','layerCrops','layerZones','layerPose','layerCadence','detectorConfidence','detectorObjects','detectorMaxDet','poseScope','maxZones','detectorTiles'])$(id).onchange=()=>changeLayers().catch(error);
$('onlyBikes').onclick=()=>{for(const id of ['layerCrops','layerZones','layerPose','layerCadence'])$(id).checked=false;$('layerDetector').checked=true;$('detectorConfidence').value='.25';return changeLayers().catch(error);};
$('allLayers').onclick=()=>{for(const id of ['layerDetector','layerCrops','layerZones','layerPose','layerCadence'])$(id).checked=true;$('detectorConfidence').value='.45';return changeLayers().catch(error);};


$('poseModel').onchange=()=>{
 layerChange=layerChange.catch(()=>{}).then(async()=>{
  video.pause();cancelLoop();$('play').textContent='2. Analizar posturas desde el inicio';$('poseModel').disabled=true;
  try{
   while(frameBusy)await new Promise(resolve=>setTimeout(resolve,20));
   if(modelPromise)await modelPromise;
   const old=pose;pose=null;if(old?.close)await old.close();
   selectedPoseModel=$('poseModel').value;poseRuntimeConfig=null;syncAutomaticPhases();
   // Preserve confirmed zones when only the posture model changes.
   tracks.reset();records=[];poseRecords=[];lastFound=[];lastPoseLandmarks=[];lastPoseZoneIds=[];lastMediaTime=-1;
   render([]);draw([]);
   if(selectedPoseModel==='none'){$('poseStatus').textContent='Ninguno: solo se detectarán las zonas.';}else await initPose();
  }catch(e){$('poseStatus').textContent='Error de postura: '+(e.message||String(e));error(e);}
  finally{$('poseModel').disabled=false;}
 });return layerChange;
};

function syncModelUI(){
 const config=MODELS[selectedModel], select=$('detectorObjects');
 const localBytes=selectedModel==='yolo_trained'?trainedYoloBytes:trainedBytes;
 const bytes=config.local&&localBytes?localBytes.byteLength:config.bytes;
 const size=bytes?(bytes/1048576).toFixed(1).replace('.',',')+' MiB':'tamaño disponible al cargar el archivo';
 const timing=config.referenceMs?config.referenceMs.toLocaleString('es-ES')+' ms ≈ '+(1000/config.referenceMs).toFixed(1).replace('.',',')+' FPS · '+config.referenceDevice+' · '+config.inputSize+' × '+config.inputSize:'sin tiempo de referencia para este modelo entrenado';
 $('modelDetails').textContent=(selectedModel==='yolov8n'?'Archivo original .pt ≈ 6,2 MB · App ONNX: ':selectedModel==='yolov8m'?'Archivo original .pt ≈ 52 MB · App ONNX: ':'')+size+' · '+(config.format||'según archivo')+' · '+timing;

 const allowed=config.pose?['person']:config.local?['all','bicycle']:['all','person','bicycle','motorcycle'];
 for(const option of select.options)option.disabled=!allowed.includes(option.value);
 if(!allowed.includes(select.value))select.value=config.local?'bicycle':'person';
 $('localModelControls').hidden=!config.local;

 $('objectsHelp').textContent=config.pose?'Este modelo solo reconoce personas.':config.local?'Modelo entrenado: bicicleta y bicicleta de spinning. Todo conserva sus categorías propias.':'Todo muestra las 80 categorías COCO. Persona = 0, bicicleta = 1, moto = 3.';
}
syncModelUI();renderReferences();

function setModelLoading(busy){
 detectorLoading=busy;const blocked=busy||poseLoading||manualScan;
 $('modelProgress').hidden=!busy;
 for(const id of ['zoneModel','layerDetector','layerCrops','layerZones','layerPose','layerCadence','detectorObjects','detectorConfidence','detectorMaxDet','onlyBikes','allLayers','trainedModelFile','poseModel','poseScope','maxZones','detectorTiles'])$(id).disabled=blocked;
 if(!busy)$('layerCadence').disabled=!layer('layerPose');
 $('modelLoadPanel').style.borderColor=busy?'#fbbf24':'#64748b';
 for(const id of ['play','step','scanZones'])$(id).disabled=blocked||!source||(id!=='scanZones'&&source!=='file');
}
function showModelProgress(key,info){
 const name=MODELS[key].name,bar=$('modelProgress');
 if(info.stage==='cached'){$('modelStatus').textContent='MODELO GUARDADO · '+name+' · preparando…';}
 else if(info.stage==='download'){
  const mb=(info.loaded/1048576).toFixed(1).replace('.',',');
  if(info.total){bar.max=info.total;bar.value=info.loaded;}
  else bar.removeAttribute?.('value');
  $('modelStatus').textContent='DESCARGANDO '+name+' · '+mb+' MiB'+(info.total?' / '+(info.total/1048576).toFixed(1).replace('.',',')+' MiB':'')+' · espera…';
 }else{
  bar.removeAttribute?.('value');
  $('modelStatus').textContent=(info.stage==='prepare'?'PREPARANDO ':'CARGANDO MOTOR DE IA · ')+name+' · espera…';
 }
}
