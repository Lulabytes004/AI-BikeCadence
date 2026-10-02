const $=id=>document.getElementById(id),video=$('video'),canvas=$('overlay'),ctx=canvas.getContext('2d');
const inputCanvas=document.createElement('canvas'),inputCtx=inputCanvas.getContext('2d',{willReadFrequently:true});
const pixelCanvas=document.createElement('canvas');pixelCanvas.width=96;pixelCanvas.height=54;
const pixelCtx=pixelCanvas.getContext('2d',{willReadFrequently:true});
const tracks=new globalThis.PoseTracks();
const MAX_CYCLISTS=8;
const colors=['#127fc4','#e77a24','#16875d','#9c4bc7','#cc4268','#078f9c','#9a7626','#475bd0'];
let pose=null,PoseLandmarker,DrawingUtils,source=null,blobURL=null,session=0,requestId=null,loadId=0;
let lastMediaTime=-1,lastModelTimestamp=0,lastInferenceWall=0,lastPixels=null,lastChangeTime=null,frozen=false;
let records=[],poseRecords=[],modelPromise=null,diagnostic='';
const setStatus=text=>$('status').textContent=text;
function error(e){setStatus('Error');diagnostic=e.message||String(e);$('diag').textContent=diagnostic;console.error(e);}
async function initPose(){
 if(pose)return pose;
 if(modelPromise)return modelPromise;
 modelPromise=(async()=>{
  setStatus('Cargando IA…');
  const mod=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32');
  PoseLandmarker=mod.PoseLandmarker;DrawingUtils=mod.DrawingUtils;
  const vision=await mod.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm');
  const options={baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',delegate:'GPU'},runningMode:'VIDEO',numPoses:MAX_CYCLISTS,minPoseDetectionConfidence:.5,minPosePresenceConfidence:.5,minTrackingConfidence:.5};
  try{pose=await PoseLandmarker.createFromOptions(vision,options);}catch{options.baseOptions.delegate='CPU';pose=await PoseLandmarker.createFromOptions(vision,options);}
  return pose;
 })();
 try{return await modelPromise;}finally{modelPromise=null;}
}
function clearData(){
 tracks.reset();lastMediaTime=-1;lastInferenceWall=0;lastPixels=null;lastChangeTime=null;records=[];poseRecords=[];
 $('freeze').checked=false;frozen=false;
 draw([]);render([]);diagnostic='Historial reiniciado.';$('diag').textContent=diagnostic;
}
function cancelLoop(){session++;if(requestId!==null){if(video.cancelVideoFrameCallback)video.cancelVideoFrameCallback(requestId);else cancelAnimationFrame(requestId);}requestId=null;}
function releaseSource(){
 cancelLoop();video.pause();video.srcObject?.getTracks().forEach(t=>t.stop());video.srcObject=null;video.removeAttribute('src');video.load();
 if(blobURL){URL.revokeObjectURL(blobURL);blobURL=null;}
 source=null;clearData();$('camera').textContent='Iniciar cámara';$('play').disabled=true;$('step').disabled=true;$('videoControls').classList.add('hidden');
}
async function startCamera(){
 const token=++loadId;releaseSource();
 try{
  if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw new Error('La cámara necesita HTTPS o localhost y permiso de acceso.');
  setStatus('Solicitando cámara…');
  const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30}},audio:false});
  if(token!==loadId){stream.getTracks().forEach(t=>t.stop());return;}
  source='camera';video.srcObject=stream;await video.play();await initPose();
  if(token!==loadId)return;
  $('camera').textContent='Detener cámara';$('sourceLabel').textContent='Cámara en directo';setStatus('Buscando ciclistas…');schedule();
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
  await initPose();if(token!==loadId)return;
  $('play').disabled=false;$('step').disabled=false;setStatus('Vídeo listo · pulsa Reproducir');updateTime();processFrame(0);
 }catch(e){if(token===loadId)error(e);}
}
function updateTime(){if(source==='file'){$('seek').value=video.currentTime;$('time').textContent=`${video.currentTime.toFixed(2)} / ${video.duration.toFixed(2)} s`;}}
function schedule(){
 if(!pose || video.paused || !source || requestId!==null)return;
 const token=session;
 const callback=(_now,metadata)=>{
  requestId=null;if(token!==session || video.paused || !source)return;
  const mediaTime=metadata?.mediaTime??video.currentTime;
  // Throttle live input only; local playback uses all presented frames.
  try{if(source==='file'||performance.now()-lastInferenceWall>=45)processFrame(mediaTime);}catch(e){cancelLoop();video.pause();error(e);return;}
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
function processFrame(mediaTime){
 if(!pose || video.readyState<2 || video.seeking || mediaTime===lastMediaTime)return;
 if(mediaTime<lastMediaTime)clearData();
 const mediaDelta=lastMediaTime<0?1:Math.max(.01,(mediaTime-lastMediaTime)*1000);
 lastMediaTime=mediaTime;lastInferenceWall=performance.now();
 const t=mediaTime*1000,still=stationaryPixels(sourcePixels(),t);
 // MediaPipe needs strictly increasing inference timestamps even after a seek/replay.
 lastModelTimestamp+=mediaDelta;
 const result=pose.detectForVideo(inputCanvas,lastModelTimestamp);
 const found=tracks.update(result.landmarks??[],t,video.videoWidth/video.videoHeight,still);
 render(found);draw(found);updateTime();record(t,found,result.landmarks??[],still);
 setStatus(still?'Imagen quieta':found.length?'Analizando ciclistas…':'No veo una persona');
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
function draw(found){
 canvas.width=video.videoWidth||1280;canvas.height=video.videoHeight||720;ctx.clearRect(0,0,canvas.width,canvas.height);
 if(!DrawingUtils)return;
 const drawing=new DrawingUtils(ctx);
 for(const track of found){if(!track.lm)continue;const color=colors[(track.id-1)%colors.length];
  drawing.drawConnectors(track.lm,PoseLandmarker.POSE_CONNECTIONS,{color,lineWidth:2});
  const selected=track.signals?.find(s=>s.name===track.result.method);
  for(const i of selected?.points??[]){const p=track.lm[i];ctx.beginPath();ctx.arc(p.x*canvas.width,p.y*canvas.height,7,0,2*Math.PI);ctx.fillStyle=color;ctx.fill();}
  ctx.font='bold 22px system-ui';ctx.fillStyle=color;ctx.fillText('C'+track.id,track.x*canvas.width,Math.max(24,track.lm[0].y*canvas.height-15));
 }
}
function record(t,found,lm,still){
 for(const track of found){const r=track.result,reference=$('expected'+track.id)?.value;records.push({time_ms:t,cyclist:track.id,rpm:r.rpm,reference_rpm:reference===''||reference==null?null:Number(reference),quality:r.quality,method:r.method,state:r.state,cycles:r.cycles,frozen_pixels:still});}
 if(!found.length)records.push({time_ms:t,cyclist:null,rpm:null,quality:0,state:'missing',cycles:0,frozen_pixels:still});
 poseRecords.push({time_ms:t,poses:lm,tracks:found.map(track=>({id:track.id,result:track.result,signals:track.signals?.map(({points,...s})=>s)})),frozen_pixels:still});
 // Bound live recording memory; files retain at most the latest ten minutes.
 const cutoff=t-600000;while(records[0]?.time_ms<cutoff)records.shift();while(poseRecords[0]?.time_ms<cutoff)poseRecords.shift();
 const errors=records.filter(r=>r.rpm!==null&&r.reference_rpm!=null&&r.quality>0);
 const mae=errors.length?errors.reduce((s,r)=>s+Math.abs(r.rpm-r.reference_rpm),0)/errors.length:null;
 diagnostic=`Fotogramas analizados: ${poseRecords.length}\nTiempo de entrada: ${(t/1000).toFixed(2)} s\nPersonas: ${found.filter(x=>x.lm).length}\nImagen quieta: ${still?'sí':'no'}\nError medio: ${mae===null?'introduce referencia RPM':mae.toFixed(2)+' RPM'}\nÚltimos 10 minutos exportables. El vídeo se procesa en este dispositivo.`;
 $('diag').textContent=diagnostic;
}
function download(name,body,type){const url=URL.createObjectURL(new Blob([body],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function seekTo(time,resetHistory=true){
 video.pause();cancelLoop();$('play').textContent='Reproducir';
 if(resetHistory)clearData();
 if(Math.abs(video.currentTime-time)>.00001){const done=once(video,'seeked');video.currentTime=time;await done;}
 processFrame(video.currentTime);updateTime();setStatus('Pausa');
}
$('camera').onclick=()=>{if(source==='camera'){++loadId;releaseSource();setStatus('Detenido');}else startCamera();};
$('file').onchange=()=>{const file=$('file').files[0];if(file)openFile(file);$('file').value='';};
$('play').onclick=async()=>{
 try{if(!video.paused){video.pause();cancelLoop();$('play').textContent='Reproducir';setStatus('Pausa · medición conservada');}
 else{if(video.ended)await seekTo(0);video.playbackRate=Number($('speed').value);await video.play();$('play').textContent='Pausar';schedule();}}catch(e){error(e);}
};
$('step').onclick=async()=>{try{const fps=Math.max(1,Number($('fps').value)||30);await seekTo(Math.min(video.duration,video.currentTime+1/fps),false);}catch(e){error(e);}};
$('seek').onchange=async()=>{try{await seekTo(Number($('seek').value));}catch(e){error(e);}};
$('speed').onchange=()=>{video.playbackRate=Number($('speed').value);};
$('reset').onclick=()=>{clearData();setStatus('Medición reiniciada');if(video.paused&&pose&&source)processFrame(video.currentTime);};
$('freeze').onchange=()=>{if($('freeze').checked){inputCanvas.width=video.videoWidth;inputCanvas.height=video.videoHeight;inputCtx.drawImage(video,0,0);frozen=true;}else{frozen=false;clearData();}};
video.addEventListener('ended',()=>{cancelLoop();$('play').textContent='Reproducir';setStatus('Vídeo terminado · resultados conservados');});
video.addEventListener('error',()=>{if(source)error(new Error('No se pudo decodificar el vídeo. Usa MP4 H.264.'));});
$('export').onclick=()=>{const keys=['time_ms','cyclist','rpm','reference_rpm','quality','method','state','cycles','frozen_pixels'];const csv=keys.join(',')+'\n'+records.map(r=>keys.map(k=>JSON.stringify(r[k]??'')).join(',')).join('\n');download('cadence-diagnostic.csv',csv,'text/csv');};
$('landmarks').onclick=()=>download('cadence-landmarks.json',JSON.stringify({version:1,source:source==='file'?$('fileName').textContent:'camera',width:video.videoWidth,height:video.videoHeight,references:Array.from({length:MAX_CYCLISTS},(_,i)=>$('expected'+(i+1)).value).map(x=>x===''?null:Number(x)),frames:poseRecords}),'application/json');
// A local harness can inject a compatible pose model and run the same UI pipeline.
// It is opt-in and cannot be activated from arbitrary URL data.
if(new URLSearchParams(location.search).has('test'))window.cadenceDebug={
 setModel(model){pose=model;},openFile,processFrame,seekTo,
 get records(){return records;},get poseRecords(){return poseRecords;},get tracks(){return tracks;}
};
