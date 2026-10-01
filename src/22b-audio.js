/* ================= sound (synthesized, no files) ================= */
const SND={ctx:null,master:null,noiseBuf:null,lastEat:0,lastBub:0,lastTink:0};
function audioResume(){
  try{
    if(!SND.ctx){
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC) return;
      SND.ctx=new AC();
      SND.master=SND.ctx.createGain();
      SND.master.gain.value=0.55;
      SND.master.connect(SND.ctx.destination);
    }
    if(SND.ctx.state==='suspended') SND.ctx.resume().catch(()=>{});
  }catch(e){}
}
const soundOn=()=>!!(SND.ctx&&S&&S.sound&&SND.ctx.state!=='closed');
function tone(freq,dur,o){
  if(!soundOn()) return;
  o=o||{};
  try{
    const c=SND.ctx,t=c.currentTime+(o.delay||0),vol=o.vol||0.12;
    const osc=c.createOscillator(),g=c.createGain();
    osc.type=o.type||'sine';
    if(o.j) freq*=1+(Math.random()*2-1)*o.j;
    osc.frequency.setValueAtTime(freq,t);
    if(o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30,freq*o.slide),t+dur);
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(vol,t+(o.attack||0.006));
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    osc.connect(g);g.connect(SND.master);
    osc.start(t);osc.stop(t+dur+0.03);
  }catch(e){}
}
function noise(dur,o){
  if(!soundOn()) return;
  o=o||{};
  try{
    const c=SND.ctx,t=c.currentTime+(o.delay||0);
    if(!SND.noiseBuf){
      const n=c.sampleRate*1.5,b=c.createBuffer(1,n,c.sampleRate),d=b.getChannelData(0);
      for(let i=0;i<n;i++) d[i]=Math.random()*2-1;
      SND.noiseBuf=b;
    }
    const src=c.createBufferSource();src.buffer=SND.noiseBuf;
    const f=c.createBiquadFilter();f.type=o.type||'lowpass';
    f.frequency.setValueAtTime(o.freq||1000,t);
    if(o.sweep) f.frequency.exponentialRampToValueAtTime(Math.max(60,(o.freq||1000)*o.sweep),t+dur);
    f.Q.value=o.q||0.8;
    const g=c.createGain();
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(o.vol||0.12,t+Math.min(0.05,dur/3));
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    src.connect(f);f.connect(g);g.connect(SND.master);
    src.start(t,Math.random()*0.5);src.stop(t+dur+0.03);
  }catch(e){}
}
const sfx={
  tap:()=>tone(620,0.05,{type:'square',vol:0.04,j:0.04}),
  tab:()=>{tone(520,0.05,{type:'triangle',vol:0.08});tone(780,0.06,{type:'triangle',vol:0.06,delay:0.045});},
  open:()=>tone(440,0.09,{type:'triangle',vol:0.07,slide:1.4}),
  feed:()=>{for(let i=0;i<5;i++) tone(700+Math.random()*500,0.07,{slide:1.7,vol:0.07,delay:i*0.07+Math.random()*0.03});},
  eat:()=>{const n=performance.now();if(n-SND.lastEat<120) return;SND.lastEat=n;tone(420+Math.random()*260,0.07,{slide:1.8,vol:0.06});},
  bubble:()=>{const n=performance.now();if(n-SND.lastBub<900) return;SND.lastBub=n;tone(380+Math.random()*420,0.1,{slide:1.7,vol:0.035});},
  water:()=>{noise(0.7,{freq:1800,sweep:0.25,vol:0.14,q:0.6});tone(300,0.3,{slide:2,vol:0.04,delay:0.35});},
  rinse:()=>noise(0.45,{freq:1400,sweep:0.4,vol:0.1}),
  scrub:()=>{for(let i=0;i<4;i++) noise(0.09,{type:'highpass',freq:2500,vol:0.09,delay:i*0.11});},
  heal:()=>[523,659,784,1047].forEach((f,i)=>tone(f,0.14,{type:'triangle',vol:0.09,delay:i*0.07})),
  sick:()=>{tone(330,0.18,{type:'triangle',vol:0.09});tone(247,0.28,{type:'triangle',vol:0.09,delay:0.16});},
  coin:()=>{tone(988,0.07,{type:'square',vol:0.06,j:0.02});tone(1319,0.18,{type:'square',vol:0.06,delay:0.07,j:0.02});},
  ping:i=>{
    const deg=[0,2,4,7,9,12,14,16,19,21][Math.min(9,Math.max(0,i|0))],f=740*Math.pow(2,deg/12);
    tone(f,0.17,{type:'triangle',vol:0.075,j:0.002});tone(f*2,0.1,{type:'sine',vol:0.025,delay:0.01});
  },
  levelup:()=>[440,554,659,880,1109].forEach((f,i)=>{tone(f,0.12,{type:'triangle',vol:0.08,delay:i*0.055});tone(f*2,0.08,{vol:0.02,delay:i*0.055});}),
  discover:()=>{[523,659,784,1047,1319].forEach((f,i)=>tone(f,0.16,{type:'triangle',vol:0.085,delay:i*0.075}));tone(2093,0.35,{type:'sine',vol:0.04,delay:0.4});tone(2637,0.3,{type:'sine',vol:0.03,delay:0.46});},
  sparkle:()=>{tone(1568+Math.random()*300,0.12,{vol:0.05});tone(2093+Math.random()*400,0.16,{vol:0.04,delay:0.07});},
  tink:()=>{const n=performance.now();if(n-SND.lastTink<90) return;SND.lastTink=n;tone(520+Math.random()*280,0.11,{slide:1.6,vol:0.055});},
  buy:()=>{tone(784,0.07,{type:'square',vol:0.055});tone(1047,0.07,{type:'square',vol:0.055,delay:0.07});tone(1568,0.2,{type:'square',vol:0.055,delay:0.14});},
  error:()=>tone(200,0.16,{type:'square',vol:0.06,slide:0.65}),
  breed:()=>[392,494,587,784].forEach((f,i)=>tone(f,0.16,{type:'sine',vol:0.1,delay:i*0.09})),
  hatch:()=>[523,659,784,659,1047].forEach((f,i)=>tone(f,0.13,{type:'triangle',vol:0.1,delay:i*0.09})),
  chime:()=>{tone(659,0.18,{type:'sine',vol:0.09});tone(880,0.3,{type:'sine',vol:0.09,delay:0.12});},
  fish:()=>tone(540,0.08,{type:'sine',vol:0.08,slide:1.6})
};
