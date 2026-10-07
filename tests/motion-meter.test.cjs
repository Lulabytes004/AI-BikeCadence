const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../motion/motion-meter.js'),'utf8');
const load=()=>import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const pose=x=>{const p=[];for(const [id,px] of [[23,x-.04],[24,x+.04],[11,x-.1],[12,x+.1]])p[id]={x:px,y:.5,visibility:1};return p;};
test('horizontal movement calibrates, smooths, applies dead zone and rejects hidden hips',async()=>{const {MotionMeter}=await load(),m=new MotionMeter();assert.equal(m.update(pose(.5),0).direction,'Centro');assert.equal(m.update(pose(.505),1000).direction,'Centro');assert.equal(m.update(pose(.6),2000).direction,'Derecha');assert.equal(m.update(pose(.4),3000).direction,'Izquierda');assert.equal(m.update([],3100),null);m.reset();assert.equal(m.update(pose(.7),4000).dx,0);});
