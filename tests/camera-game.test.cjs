const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('camera game forwards pedal cycles only during an active platform and preserves reset confirmation',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../camera-game.html'),'utf8'),code=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 const nodes=new Map(),element=()=>({textContent:'',value:'10',innerHTML:'',classList:{add(){},remove(){}},appendChild(){},scrollHeight:0,scrollTop:0});
 const get=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);};let confirm=false;
 const sandbox={document:{getElementById:get,createElement:element},performance:{now:()=>1000},Date,Math,Number,setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},navigator:{}};sandbox.window={confirm:()=>confirm,AudioContext:class {constructor(){this.state="running";}}};
 vm.createContext(sandbox);vm.runInContext(code,sandbox);
 sandbox.window.platformCameraPedal();assert.match(get('currentRevs').textContent,/^0 /);
 get('start').onclick();sandbox.window.platformCameraPedal();assert.match(get('currentRevs').textContent,/^1 /);
 get('reset').onclick();assert.match(get('currentRevs').textContent,/^1 /);
 confirm=true;get('reset').onclick();assert.match(get('currentRevs').textContent,/^0 /);
 assert.match(fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),/href="\.\/camera-game.html"/);
});
