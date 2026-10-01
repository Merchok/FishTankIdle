/* ================= species spec (hybrids blend body size from both parents) ================= */
function spriteSpec(f){
  const A=SP[f.sp],B=f.hyb&&SP[f.hyb];
  if(!B||B.kind!==A.kind) return A;
  return Object.assign({},A,{
    len:Math.round((A.len+B.len)/2),hei:Math.round((A.hei+B.hei)/2),
    tailMul:((A.tailMul||1)+(B.tailMul||1))/2,finMul:((A.finMul||1)+(B.finMul||1))/2
  });
}

/* ================= jellyfish sprites: one shape per real-life kind, 4 pulse frames each ================= */
const put=(g,x,y,hex,a)=>{
  x=Math.round(x);y=Math.round(y);
  if(y>=0&&y<g.length&&x>=0&&x<g[0].length) g[y][x]=rgba(hex,a==null?1:a);
};
function hsl2hex(h,s,l){
  h=((h%360)+360)%360;s/=100;l/=100;
  const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l);
  const f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));
  return rgbHex([f(0)*255,f(8)*255,f(4)*255]);
}
function jctx(f,stage,sick){
  const sp=spriteSpec(f),ph=phenotype(f);
  const sm=(0.88+0.12*ph.size)*1.25,stm=[0.45,0.75,1][stage];
  return {sp,ph,sick,
    tc:c=>sick?mixHex(c,'#7d8a70',0.5):c,
    base:COLORS[ph.color].c,acc:COLORS[ph.accent].c,
    BW:Math.max(5,Math.round(sp.len*sm*stm)),BH:Math.max(4,Math.round(sp.hei*sm*stm))};
}
/* bell pattern genes: same eight patterns on every shape */
function jPat(pat,x,y,cx,y0,bh,c,hs){
  const vv=(y-y0)/Math.max(bh,1);
  switch(pat){
    case 1: return ((x-Math.floor(cx))%3===0)&&vv>0.2;
    case 2: return (hs%8===0)&&vv>0.15&&vv<0.85;
    case 3: {const d=Math.hypot(x+0.5-cx,(y-(y0+bh))*0.9);return (Math.floor(d)%4===0)&&d>2;}
    case 4: {const d=Math.hypot(x+0.5-cx,(y-(y0+bh*0.62))*1.4);return (d>1.5&&d<3.6)&&((x+0.5-cx)!==0);}
    case 5: return vv<0.3;
    case 6: return hs%4===0;
    case 7: return ((x+y+Math.floor(c*3))%4<1)&&vv>0.15;
  }
  return false;
}
function jOutline(g,cells,oc){
  const W=g[0].length;
  for(const key of cells){
    const y=Math.floor(key/1000),x=key%1000;
    if(y>0&&!cells.has((y-1)*1000+x)&&!g[y-1][x]) g[y-1][x]=oc;
    if(x>0&&!cells.has(y*1000+x-1)&&!g[y][x-1]) g[y][x-1]=oc;
    if(x<W-1&&!cells.has(y*1000+x+1)&&!g[y][x+1]) g[y][x+1]=oc;
  }
}
function jFinish(frames,X){
  const f0=frames[0];
  return {cv:f0,frames,w:f0.width,h:f0.height,glow:X.ph.sheen===1,pearl:X.ph.sheen===2,glowRGB:hexRgb(lighten(X.base,0.3)),jelly:true,feet:f0.height-2};
}
const TWO_PI=Math.PI*2;

/* Moon jelly: flat saucer, four glowing rings, short fringe */
function jbSaucer(f,stage,sick){
  const X=jctx(f,stage,sick),{ph,tc,base,acc,BW,BH}=X;
  const tt=ph.tail,at=ph.fin;
  const FR=Math.max(2,Math.round(BH*[0.35,0.6,0.45,0.5,0.9][tt]));
  const ARM=Math.max(3,Math.round(BH*[0.55,0.7,0.9,1.1][at]));
  const W=Math.round(BW*1.25)+6,Hc=Math.round(BH*1.15)+Math.max(FR,ARM)+8;
  const frames=[];
  for(let i=0;i<4;i++){
    const p=i/4,c=0.5-0.5*Math.cos(p*TWO_PI);
    const bw=BW*(1.06-0.16*c),bh=BH*(0.9+0.2*c);
    const g=emptyGrid(W,Hc),cx=W/2,y0=2,cells=new Set(),rim=new Map();
    for(let x=0;x<W;x++){
      const u=(x+0.5-cx)/(bw/2);
      if(Math.abs(u)>1) continue;
      const h=bh*Math.pow(1-u*u,0.55);
      const yTop=y0+bh-h,yBot=y0+bh-u*u*bh*0.2;
      rim.set(x,yBot);
      for(let y=Math.floor(yTop);y<=Math.floor(yBot);y++){
        const vv=(y-y0)/Math.max(bh,1),hs=hash2(x,y);
        let col=vv<0.3?lighten(base,0.5):(vv>0.8?mixHex(base,acc,0.5):base);
        let a=vv<0.3?0.9:(vv>0.8?0.9:0.7);
        if(jPat(ph.pattern,x,y,cx,y0,bh,c,hs)){col=acc;a=0.9;}
        if(ph.sheen===2&&vv<0.35) col=mixHex(col,'#ffffff',0.6);
        put(g,x,y,tc(col),a);cells.add(y*1000+x);
      }
    }
    if(BW>=11){
      const ry=Math.round(y0+bh*0.5),rc=tc(mixHex(acc,'#ffffff',0.3));
      const ring=rx=>[[1,0],[2,0],[0,1],[3,1],[1,2],[2,2]].forEach(([dx,dy])=>put(g,rx+dx,ry+dy,rc,0.95));
      ring(Math.round(cx-bw*0.2-2));ring(Math.round(cx+bw*0.2-2));
    }
    const fcol=tc(acc);
    for(const [x,yb0] of rim){
      if(x%2) continue;
      const yb=Math.floor(yb0),len=FR*(0.7+0.3*((hash2(x,7)%100)/100));
      for(let j=1;j<=len;j++){
        const off=Math.sin(p*TWO_PI+j*0.7+x*0.5)*(tt===3?1.3:0.5);
        put(g,x+off,yb+j,fcol,j>len*0.7?0.35:0.6);
      }
    }
    const acol=tc(mixHex(acc,'#ffffff',0.35));
    for(let k=0;k<4;k++){
      const ax=cx+(k-1.5)*bw*0.11;
      for(let j=0;j<=ARM;j++){
        const off=Math.sin(p*TWO_PI+j*0.8+k*1.7)*(0.5+at*0.35)+((at>=2&&j%2)?0.6:-0.2);
        put(g,ax+off,y0+bh*0.92+j,acol,0.85);
        if(at>=2) put(g,ax+off+1,y0+bh*0.92+j,acol,0.55);
      }
    }
    jOutline(g,cells,rgba(tc(darken(base,0.5)),0.9));
    frames.push(gridToCanvas(g,W,Hc));
  }
  return jFinish(frames,X);
}

/* Sea nettle: tall scalloped bell with stripes, thick ruffled arms, very long streamers */
function jbNettle(f,stage,sick){
  const X=jctx(f,stage,sick),{ph,tc,base,acc,BW,BH}=X;
  const tt=ph.tail,at=ph.fin;
  const TL=Math.round(BH*[1.5,1.9,1.7,1.8,2.4][tt]);
  const AL=Math.max(3,Math.round(BH*[0.7,0.9,1.1,1.3][at]));
  const W=Math.round(BW*1.4)+8,Hc=Math.round(BH*1.15)+TL+6;
  const frames=[];
  for(let i=0;i<4;i++){
    const p=i/4,c=0.5-0.5*Math.cos(p*TWO_PI);
    const bw=BW*(1.04-0.14*c),bh=BH*(0.92+0.16*c);
    const g=emptyGrid(W,Hc),cx=W/2,y0=2,cells=new Set();
    const lobeW=Math.max(2,Math.round(bw/5));
    for(let x=0;x<W;x++){
      const u=(x+0.5-cx)/(bw/2);
      if(Math.abs(u)>1) continue;
      const lobe=Math.floor((x+0.5-cx+bw/2)/lobeW);
      const h=bh*Math.sqrt(1-u*u);
      const yTop=y0+bh-h,yBot=y0+bh-((lobe%2)?1.4:0);
      for(let y=Math.floor(yTop);y<=Math.floor(yBot);y++){
        const vv=(y-y0)/Math.max(bh,1),hs=hash2(x,y);
        let col=vv<0.25?lighten(base,0.45):((lobe%2)?base:mixHex(base,acc,0.5));
        let a=vv<0.25?0.92:0.8;
        if(jPat(ph.pattern,x,y,cx,y0,bh,c,hs)){col=lighten(acc,0.15);a=0.92;}
        if(ph.sheen===2&&vv<0.35) col=mixHex(col,'#ffffff',0.6);
        put(g,x,y,tc(col),a);cells.add(y*1000+x);
      }
    }
    const rimY=y0+bh;
    const acol=tc(mixHex(acc,'#ffffff',0.5));
    for(let k=0;k<4;k++){
      const ax=cx+(k-1.5)*bw*0.13;
      for(let j=0;j<=AL;j++){
        const off=Math.sin(p*TWO_PI+j*0.7+k*1.4)*1.1+((j%2)?0.7:-0.7)*(at>=1?1:0.5);
        const y=rimY-1+j;
        put(g,ax+off,y,acol,0.92);put(g,ax+off+1,y,acol,0.92);
        if(j%3===0){put(g,ax+off-1,y,acol,0.6);put(g,ax+off+2,y,acol,0.6);}
      }
    }
    const tcol=tc(darken(acc,0.1));
    for(let k=0;k<8;k++){
      const tx=cx-bw/2+(k+0.5)*bw/8;
      const len=Math.round(TL*(0.65+0.35*((hash2(k,5)%100)/100)));
      for(let j=1;j<=len;j++){
        let off=Math.sin(p*TWO_PI+j*0.45+k*1.1)*1.1*(0.3+0.7*j/len)+(k-3.5)*0.16*Math.min(j,10);
        if(tt===3&&j>len-5) off+=((k%2)?1:-1)*(j-(len-5))*0.7;
        const y=rimY+j;
        put(g,tx+off,y,tcol,j>len*0.8?0.35:0.65);
        if(tt===4) put(g,tx+off+1,y,tcol,0.5);
      }
    }
    jOutline(g,cells,rgba(tc(darken(base,0.5)),0.9));
    frames.push(gridToCanvas(g,W,Hc));
  }
  return jFinish(frames,X);
}

/* Upside-down jelly: flat disc lying on the sand, frilly arms reaching up like a flower */
function jbRosette(f,stage,sick){
  const X=jctx(f,stage,sick),{ph,tc,base,acc,BW,BH}=X;
  const tt=ph.tail,at=ph.fin;
  const nA=[4,5,6,7,8][tt];
  const AH=Math.max(4,Math.round(BH*[1.4,1.7,2.0,2.4][at]));
  const DH=Math.max(3,Math.round(BH*0.55));
  const W=BW+10,Hc=AH+DH+8;
  const frames=[];
  for(let i=0;i<4;i++){
    const p=i/4,c=0.5-0.5*Math.cos(p*TWO_PI);
    const bw=BW*(1+0.05*c);
    const g=emptyGrid(W,Hc),cx=W/2,cells=new Set();
    const dB=Hc-3,dT=dB-DH;
    for(let x=0;x<W;x++){
      const u=(x+0.5-cx)/(bw/2);
      if(Math.abs(u)>1) continue;
      const hh=DH*Math.pow(1-u*u,0.45);
      for(let y=Math.floor(dB-hh);y<=dB;y++){
        const hs=hash2(x,y),top=y<dB-hh+1.4;
        let col=top?lighten(base,0.35):base,a=0.88;
        if(jPat(ph.pattern,x,y,cx,dT,DH,c,hs)){col=acc;a=0.9;}
        if(ph.sheen===2&&top) col=mixHex(col,'#ffffff',0.6);
        put(g,x,y,tc(col),a);cells.add(y*1000+x);
      }
    }
    const stalk=tc(mixHex(acc,base,0.35)),knob=tc(lighten(acc,0.2));
    for(let k=0;k<nA;k++){
      const t=(k+0.5)/nA,ax=cx-bw*0.34+t*bw*0.68;
      const hk=Math.max(3,Math.round(AH*(0.65+0.35*((hash2(k,11)%100)/100))));
      for(let j=0;j<=hk;j++){
        const sway=Math.sin(p*TWO_PI+k*1.2)*0.9*(j/hk);
        const x=ax+sway,y=dT+DH*0.4-j;
        put(g,x,y,stalk,0.92);
        if(j<hk*0.4) put(g,x+1,y,stalk,0.8);
        if(at>=2&&j>hk*0.5&&j%2) put(g,x-1,y,knob,0.7);
      }
      const tx=ax+Math.sin(p*TWO_PI+k*1.2)*0.9,ty=dT+DH*0.4-hk;
      put(g,tx-1,ty,knob,0.95);put(g,tx,ty,knob,0.95);put(g,tx+1,ty,knob,0.95);put(g,tx,ty-1,knob,0.95);
      if(at>=1){put(g,tx-1,ty-1,knob,0.7);put(g,tx+1,ty-1,knob,0.7);}
      if(hash2(k,i)%5===0) put(g,tx,ty-2,'#ffffff',0.8);
    }
    jOutline(g,cells,rgba(tc(darken(base,0.45)),0.9));
    frames.push(gridToCanvas(g,W,Hc));
  }
  return jFinish(frames,X);
}

/* Comb jelly: clear oval, rainbow rows that ripple, two feathery tentacles */
function jbComb(f,stage,sick){
  const X=jctx(f,stage,sick),{ph,tc,base,acc,BW,BH}=X;
  const tt=ph.tail,at=ph.fin;
  const TL=Math.round(BH*[1.3,1.8,1.5,2,2.4][tt]);
  const lobeL=[0,3,4,5][at];
  const W=Math.round(BW*2.2)+8,Hc=BH+TL+lobeL+8;
  const nR=3+(ph.pattern%4);
  const frames=[];
  for(let i=0;i<4;i++){
    const p=i/4,c=0.5-0.5*Math.cos(p*TWO_PI);
    const bw=BW*(1+0.03*c),bh=BH;
    const g=emptyGrid(W,Hc),cx=W/2,y0=2,cells=new Set();
    const half=y=>(bw/2)*Math.pow(Math.sin(Math.PI*Math.min(1,(y-y0+0.5)/bh)),0.75)*(1.05-0.2*((y-y0)/bh));
    for(let y=y0;y<y0+bh;y++){
      const hw=half(y);
      for(let x=Math.floor(cx-hw);x<=Math.ceil(cx+hw);x++){
        const dx=Math.abs(x+0.5-cx);
        if(dx>hw) continue;
        const edge=dx>hw-1,vv=(y-y0)/bh;
        let col=vv<0.25?lighten(base,0.5):base,a=edge?0.7:0.38;
        if(ph.sheen===2&&vv<0.35) col=mixHex(col,'#ffffff',0.6);
        put(g,x,y,tc(col),a);cells.add(y*1000+x);
      }
    }
    for(let r=0;r<nR;r++){
      const ur=-0.72+1.44*r/Math.max(1,nR-1);
      for(let y=y0+2;y<y0+bh-2;y++){
        const x=cx+ur*half(y);
        const hue=(y*24+i*90+r*40)%360;
        const amp=0.5+0.5*Math.sin(y*0.8-i*Math.PI/2+r*0.6);
        put(g,x,y,tc(hsl2hex(hue,95,62)),0.3+0.65*amp);
      }
    }
    if(lobeL>0){
      for(let dy=0;dy<lobeL;dy++){
        const w=dy<lobeL-1?2:1;
        for(const s of [-1,1]) for(let k=0;k<w;k++) put(g,cx+s*bw*0.26+(s>0?k:-k-1),y0+bh+dy,tc(lighten(base,0.3)),0.65);
      }
    }
    const tcol=tc(mixHex(acc,'#ffffff',0.25));
    for(const s of [-1,1]){
      const sx=cx+s*bw*0.28,sy=y0+bh*0.8;
      for(let j=1;j<=TL;j++){
        const off=s*j*0.1+Math.sin(p*TWO_PI+j*0.5+(s>0?1:0))*1.0*(0.3+0.7*j/TL);
        const x=sx+off,y=sy+j;
        put(g,x,y,tcol,j>TL*0.8?0.35:0.75);
        if(j%3===0){put(g,x+1,y,tcol,0.5);put(g,x-1,y+1,tcol,0.4);}
      }
    }
    jOutline(g,cells,rgba(tc(lighten(base,0.2)),0.6));
    frames.push(gridToCanvas(g,W,Hc));
  }
  return jFinish(frames,X);
}

/* Immortal jelly: tiny thimble with a bright red middle and a fuzzy ring of tentacles */
function jbTiny(f,stage,sick){
  const X=jctx(f,stage,sick),{ph,tc,base,acc,BW,BH}=X;
  const tt=ph.tail,at=ph.fin;
  const TL=Math.max(2,Math.round(BH*[0.5,0.75,0.6,0.7,1.0][tt]));
  const AL=[0,2,3,4][at];
  const W=Math.round(BW*1.5)+6,Hc=BH+TL+AL+8;
  const frames=[];
  for(let i=0;i<4;i++){
    const p=i/4,c=0.5-0.5*Math.cos(p*TWO_PI);
    const bw=BW*(1.04-0.18*c),bh=BH*(0.92+0.16*c);
    const g=emptyGrid(W,Hc),cx=W/2,y0=2,cells=new Set(),rim=[];
    for(let x=0;x<W;x++){
      const u=(x+0.5-cx)/(bw/2);
      if(Math.abs(u)>1) continue;
      const h=bh*Math.pow(1-u*u,0.4),yTop=y0+bh-h,yBot=y0+bh;
      rim.push(x);
      for(let y=Math.floor(yTop);y<=Math.floor(yBot);y++){
        const vv=(y-y0)/Math.max(bh,1),hs=hash2(x,y);
        let col=vv<0.3?lighten(base,0.6):base,a=vv<0.3?0.8:0.5;
        if(jPat(ph.pattern,x,y,cx,y0,bh,c,hs)){col=acc;a=0.8;}
        if(ph.sheen===2&&vv<0.35) col=mixHex(col,'#ffffff',0.6);
        put(g,x,y,tc(col),a);cells.add(y*1000+x);
      }
    }
    const sw=bw>=9?1:0;
    for(let y=Math.round(y0+bh*0.35);y<=Math.round(y0+bh*0.9);y++){
      const lowrow=y>y0+bh*0.7;
      for(let x=Math.round(cx)-1-sw;x<=Math.round(cx)+sw;x++) put(g,x,y,tc(lowrow?darken(acc,0.2):acc),0.98);
    }
    const tcol=tc(lighten(acc,0.3));
    for(const x of rim){
      const len=Math.max(1,Math.round(TL*(0.6+0.4*((hash2(x,3)%100)/100))));
      for(let j=1;j<=len;j++) put(g,x+Math.sin(p*TWO_PI+j*0.8+x)*0.6,y0+bh+j,tcol,0.6);
    }
    for(let j=1;j<=AL;j++) put(g,cx+Math.sin(p*TWO_PI+j)*0.5,y0+bh+j,tc(acc),0.9);
    if(i===1) put(g,cx+bw*0.3,y0+1,'#ffffff',0.95);
    jOutline(g,cells,rgba(tc(darken(base,0.4)),0.85));
    frames.push(gridToCanvas(g,W,Hc));
  }
  return jFinish(frames,X);
}

/* Box jelly: cube-shaped bell with eyes on the sides and a bundle of tentacles at each corner */
function jbBox(f,stage,sick){
  const X=jctx(f,stage,sick),{ph,tc,base,acc,BW,BH}=X;
  const tt=ph.tail;
  const TL=Math.round(BH*[1.2,2.0,1.6,1.8,2.5][tt]);
  const W=BW+14,Hc=Math.round(BH*1.15)+TL+6;
  const frames=[];
  for(let i=0;i<4;i++){
    const p=i/4,c=0.5-0.5*Math.cos(p*TWO_PI);
    const bw=BW*(1.04-0.12*c),bh=BH*(0.94+0.1*c);
    const g=emptyGrid(W,Hc),cx=W/2,y0=2,cells=new Set();
    for(let y=y0;y<y0+bh;y++){
      const r=y-y0;
      const hw=bw/2-(r<2?(2-r)*0.9:0)-(r>bh-2?0.5:0);
      for(let x=Math.floor(cx-hw);x<Math.ceil(cx+hw);x++){
        const dx=Math.abs(x+0.5-cx);
        if(dx>hw) continue;
        const vv=r/Math.max(bh,1),hs=hash2(x,y);
        let col=vv<0.2?lighten(base,0.5):base,a=dx>hw-1.2?0.82:0.55;
        if(dx>hw-1.2) col=darken(base,0.15);
        if(jPat(ph.pattern,x,y,cx,y0,bh,c,hs)){col=acc;a=0.9;}
        if(ph.sheen===2&&vv<0.35) col=mixHex(col,'#ffffff',0.6);
        put(g,x,y,tc(col),a);cells.add(y*1000+x);
      }
    }
    const sy=Math.round(y0+bh*0.8);
    for(let x=Math.round(cx-bw/2+2);x<Math.round(cx+bw/2-2);x++) put(g,x,sy,tc(mixHex(acc,base,0.5)),0.85);
    const ey=Math.round(y0+bh*0.5);
    for(const ex of [cx-bw/2+1.5,cx+bw/2-1.5]){put(g,ex,ey,'#1b2a44',0.95);put(g,ex,ey-1,'#cfe9ff',0.8);}
    const tcol=tc(acc);
    const bundles=[[cx-bw/2+1,1],[cx+bw/2-2,1],[cx-bw*0.18,0.6],[cx+bw*0.18,0.6]];
    bundles.forEach(([bx,m],k)=>{
      const len=Math.round(TL*m*(0.85+0.15*((hash2(k,2)%100)/100)));
      const by=y0+bh;
      for(let j=0;j<=len;j++){
        const off=Math.sin(p*TWO_PI+j*0.5+k)*0.8*(j/Math.max(1,len));
        const a=j>len*0.8?0.4:0.8;
        put(g,bx+off,by+j,tcol,a);
        if(m===1&&j<len*0.8) put(g,bx+off+1,by+j,tcol,a*0.7);
      }
    });
    jOutline(g,cells,rgba(tc(darken(base,0.5)),0.9));
    frames.push(gridToCanvas(g,W,Hc));
  }
  return jFinish(frames,X);
}

const JB={saucer:jbSaucer,nettle:jbNettle,rosette:jbRosette,comb:jbComb,tiny:jbTiny,box:jbBox};
function buildJelly(f,stage,sick){
  const fn=JB[spriteSpec(f).jshape]||jbSaucer;
  return fn(f,stage,sick);
}
