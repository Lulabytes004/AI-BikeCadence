// Horizontal body movement in image coordinates; no inference or bike tracking.
export class MotionMeter {
 reset(){this.reference=null;this.hip=null;this.time=null;}
 constructor(){this.reset();}
 update(lm,t,tolerance=5){
  const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&(p.visibility??0)>=.5;
  if(!valid(lm?.[23])||!valid(lm?.[24]))return null;
  const hip={x:(lm[23].x+lm[24].x)/2,y:(lm[23].y+lm[24].y)/2};
  if(this.time!==null&&(t<this.time||t-this.time>1000)){this.hip=null;}
  const dt=this.time===null?0:Math.max(0,t-this.time),alpha=this.hip?1-Math.exp(-dt/160):1;
  this.hip=this.hip?{x:this.hip.x+alpha*(hip.x-this.hip.x),y:this.hip.y+alpha*(hip.y-this.hip.y)}:hip;this.time=t;
  if(!this.reference){const shoulderWidth=valid(lm[11])&&valid(lm[12])?Math.abs(lm[11].x-lm[12].x):Math.abs(lm[23].x-lm[24].x);this.reference={...hip,width:Math.max(.02,shoulderWidth)};}
  const dx=(this.hip.x-this.reference.x)*100,threshold=this.reference.width*Math.max(1,Math.min(30,tolerance));
  return {hip:this.hip,reference:this.reference,dx,direction:Math.abs(dx)<=threshold?'Centro':dx<0?'Izquierda':'Derecha'};
 }
}
