/* =========================================================
   총잡이 햄스터 — 엔진
   무한 맵(청크) / 무한 웨이브 / 다이아몬드 / 로비 / 장비
   ========================================================= */
"use strict";
(function(){
const HG=window.HG;
const TAU=Math.PI*2;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const rnd=(a=1,b=0)=>b+Math.random()*(a-b);
const rndi=(a,b)=>Math.floor(rnd(b+1,a));
const pick=a=>a[(Math.random()*a.length)|0];
const dist2=(ax,ay,bx,by)=>{const dx=ax-bx,dy=ay-by;return dx*dx+dy*dy;};
const ang=(ax,ay,bx,by)=>Math.atan2(by-ay,bx-ax);
const aLerp=(a,b,t)=>{const d=((b-a+Math.PI)%TAU+TAU)%TAU-Math.PI;return a+d*t;};
function seeded(n){let a=(n*2654435761)>>>0;return function(){a=(a+0x6D2B79F5)>>>0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const fmt=n=>n>=1e6?(n/1e6).toFixed(1)+'M':n>=1e4?(n/1e3).toFixed(1)+'K':String(Math.round(n));
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ================= 캔버스 ================= */
const cv=document.getElementById('cv'), ctx=cv.getContext('2d');
let VW=1,VH=1,DPR=1,SCALE=1;
function resize(){
  DPR=Math.min(window.devicePixelRatio||1,2);
  VW=cv.clientWidth||window.innerWidth; VH=cv.clientHeight||window.innerHeight;
  cv.width=Math.round(VW*DPR); cv.height=Math.round(VH*DPR);
  SCALE=clamp(VW/1050,0.6,1.3);
}
window.addEventListener('resize',resize);

/* ================= 사운드 ================= */
const SND={
  ctx:null,master:null,on:true,noiseBuf:null,
  init(){ if(this.ctx)return;
    try{ const AC=window.AudioContext||window.webkitAudioContext; if(!AC)return;
      this.ctx=new AC(); this.master=this.ctx.createGain(); this.master.gain.value=.45;
      this.master.connect(this.ctx.destination);
      this.noiseBuf=this.ctx.createBuffer(1,this.ctx.sampleRate*0.6,this.ctx.sampleRate);
      const d=this.noiseBuf.getChannelData(0);
      for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    }catch(e){}
  },
  resume(){ if(this.ctx&&this.ctx.state==='suspended')this.ctx.resume(); },
  env(node,vol,atk,dec){ const g=this.ctx.createGain(),t=this.ctx.currentTime;
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol,t+atk);
    g.gain.exponentialRampToValueAtTime(0.0001,t+atk+dec);
    node.connect(g); g.connect(this.master); return {stop:t+atk+dec}; },
  noise(vol,dec,freq,q,type){ if(!this.ctx||!this.on)return;
    const s=this.ctx.createBufferSource(); s.buffer=this.noiseBuf;
    const f=this.ctx.createBiquadFilter(); f.type=type||'bandpass'; f.frequency.value=freq; f.Q.value=q||1;
    s.connect(f); const e=this.env(f,vol,0.002,dec); s.start(); s.stop(e.stop+0.02); },
  tone(f0,f1,vol,dec,type){ if(!this.ctx||!this.on)return;
    const o=this.ctx.createOscillator(); o.type=type||'square'; const t=this.ctx.currentTime;
    o.frequency.setValueAtTime(f0,t); if(f1)o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dec);
    const e=this.env(o,vol,0.004,dec); o.start(); o.stop(e.stop+0.02); },
  shot(k){ if(!this.ctx||!this.on)return;
    if(k==='shotgun'){this.noise(.46,.26,900,.7);this.tone(160,45,.28,.22,'sawtooth');}
    else if(k==='rifle'){this.noise(.38,.17,1800,1.4);this.tone(300,70,.23,.14,'square');}
    else if(k==='gatling'){this.noise(.2,.06,1500,1.6);this.tone(420,160,.1,.05,'square');}
    else {this.noise(.34,.13,1300,1.1);this.tone(260,80,.2,.1,'square');} },
  hit(){this.noise(.2,.07,2600,2.4);},
  crit(){this.noise(.28,.09,3400,3);this.tone(1200,500,.11,.09,'triangle');},
  kill(){this.tone(500,160,.14,.16,'triangle');this.noise(.18,.14,700,.9);},
  coin(){this.tone(1180,0,.1,.07,'triangle');},
  gem(){this.tone(1500,0,.14,.1,'triangle');setTimeout(()=>this.tone(2100,0,.12,.14,'triangle'),70);},
  hurt(){this.noise(.38,.2,420,.6);this.tone(180,60,.23,.2,'sawtooth');},
  reload(){this.noise(.2,.05,2200,3);setTimeout(()=>this.noise(.24,.07,1100,2),130);},
  dodge(){this.noise(.16,.17,600,.8,'lowpass');},
  buy(){this.tone(700,0,.13,.07,'triangle');setTimeout(()=>this.tone(1050,0,.13,.1,'triangle'),70);},
  boss(){this.tone(110,55,.38,.9,'sawtooth');this.noise(.28,.7,220,.6);},
  wave(){this.tone(440,0,.16,.14,'triangle');setTimeout(()=>this.tone(660,0,.16,.2,'triangle'),130);},
  dead(){this.tone(300,60,.33,1.1,'sawtooth');},
  boom(){this.noise(.5,.45,260,.6);this.tone(140,40,.36,.4,'sawtooth');},
  zap(){this.tone(1800,400,.14,.1,'square');this.noise(.16,.1,3000,3);},
  open(){this.tone(520,0,.16,.1,'triangle');setTimeout(()=>this.tone(780,0,.16,.12,'triangle'),90);
    setTimeout(()=>this.tone(1180,0,.18,.22,'triangle'),190);}
};

/* ================= 저장 ================= */
const SKEY='hg2_save';
let SAVE;
function defSave(){
  return {v:2, dia:0, own:{w0:1,a0_0:1}, eq:{weapon:'w0',hat:null,body:null,glove:null,boot:null,cloak:null},
    job:'j0', jobs:{j0:1}, perm:{}, best:0, kills:0, runs:0, diaAll:0, seen:{w0:1,a0_0:1}};
}
function loadSave(){
  try{ const r=JSON.parse(localStorage.getItem(SKEY)); if(r&&r.v===2){SAVE=Object.assign(defSave(),r);SAVE.eq=Object.assign(defSave().eq,r.eq||{});return;} }catch(e){}
  SAVE=defSave();
}
function store(){ try{ localStorage.setItem(SKEY,JSON.stringify(SAVE)); }catch(e){} }
function ownCount(id){ return SAVE.own[id]||0; }
function giveItem(id){ SAVE.own[id]=(SAVE.own[id]||0)+1; SAVE.seen[id]=1; }

/* ================= 파생 능력치 ================= */
let PS={};               // 플레이어 종합 능력치
let WST={};              // 장착 무기 최종 능력치
let JOB=null, WEP=null;
function permLv(k){ return SAVE.perm[k]||0; }
function computeStats(){
  JOB=HG.byId[SAVE.job]||HG.JOBS[0];
  WEP=HG.byId[SAVE.eq.weapon]||HG.WEAPONS[0];
  const s={maxHp:100, dr:0, spd:268, dmg:1, crit:.05, cdmg:2.2, rel:1, rof:1, mag:1,
           dodgeCd:1.15, coin:1, dia:1, regen:0, pickup:1, shield:0, luck:0,
           pierce:0, boom:0, chain:0, burn:0, slow:0, vamp:0, ric:0, knock:1, companions:0};
  // 영구 강화
  for(const u of HG.PERM){
    const lv=permLv(u.k); if(!lv)continue;
    const v=u.v*lv;
    if(u.k==='hp')s.maxHp+=v;
    else if(u.k==='dmg')s.dmg+=v;
    else if(u.k==='spd')s.spd*=1+v;
    else if(u.k==='dr')s.dr+=v;
    else if(u.k==='crit')s.crit+=v;
    else if(u.k==='rel')s.rel+=v;
    else if(u.k==='rof')s.rof+=v;
    else if(u.k==='mag')s.mag+=v;
    else if(u.k==='dodge')s.dodgeCd*=1-Math.min(.75,v);
    else if(u.k==='coin')s.coin+=v;
    else if(u.k==='dia')s.dia+=v;
    else if(u.k==='regen')s.regen+=v;
    else if(u.k==='pickup')s.pickup+=v;
    else if(u.k==='shield')s.shield+=v;
    else if(u.k==='luck')s.luck+=lv;
  }
  // 방어구
  for(const S of HG.SLOTS){
    const it=HG.byId[SAVE.eq[S.id]]; if(!it)continue;
    for(const k in it.st){
      const v=it.st[k];
      if(k==='hp')s.maxHp+=v;
      else if(k==='dr')s.dr+=v;
      else if(k==='spd')s.spd*=1+v;
      else if(k==='rel')s.rel+=v;
      else if(k==='rof')s.rof+=v;
      else if(k==='crit')s.crit+=v;
      else if(k==='cdmg')s.cdmg+=v;
      else if(k==='dmg')s.dmg+=v;
      else if(k==='coin')s.coin+=v;
      else if(k==='dia')s.dia+=v;
      else if(k==='dodge')s.dodgeCd*=1-Math.min(.6,v);
      else if(k==='regen')s.regen+=v;
      else if(k==='pickup')s.pickup+=v;
      else if(k==='shield')s.shield+=v;
    }
  }
  // 직업
  s.maxHp=Math.round(s.maxHp*JOB.hp);
  s.spd*=JOB.spd; s.dmg*=JOB.dmg; s.crit+=JOB.crit;
  const P=JOB.p, pv=JOB.pv;
  const addP=(k,v)=>{s[k]=(s[k]||0)+v;};
  if(P==='guard')s.dr+=pv;
  else if(P==='gold')s.coin+=pv;
  else if(P==='diamond')s.dia+=pv;
  else if(P==='magnet')s.pickup+=pv;
  else if(P==='crit')s.crit+=pv;
  else if(P==='cdmg')s.cdmg+=pv;
  else if(P==='reload')s.rel+=pv;
  else if(P==='rof')s.rof+=pv;
  else if(P==='pierce')s.pierce+=pv;
  else if(P==='boom')s.boom+=pv;
  else if(P==='chain')s.chain+=pv;
  else if(P==='burn')s.burn+=pv;
  else if(P==='slow')s.slow+=pv;
  else if(P==='dodge'){s.dodgeCd*=1-Math.min(.7,pv);}
  else if(P==='shield')s.shield+=pv;
  else if(P==='regen')s.regen+=pv;
  else if(P==='summon')s.companions+=Math.round(pv);
  else if(P==='legend'){s.dr+=.06;s.regen+=.8;s.pickup+=.5;s.crit+=.06;s.shield+=25;s.companions+=1;}
  s.dr=Math.min(.70,s.dr);
  // 무기 최종
  const w=WEP.st;
  WST={
    dmg:w.dmg*s.dmg, rof:Math.max(.02,w.rof/s.rof), mag:Math.max(1,Math.round(w.mag*s.mag)),
    rel:Math.max(.18,w.rel/s.rel), spread:w.spread, speed:w.speed,
    pierce:w.pierce+s.pierce, pellets:w.pellets+(JOB.p==='pellet'?Math.round(pv):0),
    kick:w.kick, rngMul:w.rngMul,
    crit:clamp(s.crit+(w.crit||0),0,.95), cdmg:s.cdmg,
    boom:(w.boom||0)+s.boom, chain:(w.chain||0)+s.chain, burn:(w.burn||0)+s.burn,
    slow:Math.min(.75,(w.slow||0)+s.slow), vamp:(w.vamp||0)+s.vamp, ric:(w.ric||0)+s.ric,
    knock:(w.knock||1)*s.knock, life:w.life||0,
    arch:WEP.arch, dual:WEP.dual, spin:WEP.spin, snd:WEP.snd, rar:WEP.rar, name:WEP.name
  };
  PS=s;
  return s;
}

/* ================= 무한 맵 (청크) ================= */
const CH=1000;
const chunks=new Map();
const deadBarrels=new Set();
let noiseTile=null;
function buildNoiseTile(){
  noiseTile=document.createElement('canvas'); noiseTile.width=noiseTile.height=512;
  const g=noiseTile.getContext('2d');
  const R=seeded(13579);
  for(let i=0;i<22000;i++){
    const x=R()*512,y=R()*512;
    g.fillStyle=R()<.5?'rgba(0,0,0,0.07)':'rgba(255,255,255,0.07)';
    g.fillRect(x,y,1+(R()<.1?1:0),1);
  }
  for(let i=0;i<70;i++){
    const x=R()*512,y=R()*512,r=20+R()*70;
    const gr=g.createRadialGradient(x,y,0,x,y,r);
    gr.addColorStop(0,R()<.5?'rgba(0,0,0,0.06)':'rgba(255,255,255,0.06)');
    gr.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=gr; g.beginPath(); g.arc(x,y,r,0,TAU); g.fill();
  }
  for(let i=0;i<26;i++){
    let x=R()*512,y=R()*512,a=R()*TAU;
    g.strokeStyle='rgba(90,60,25,0.16)'; g.lineWidth=1+R()*1.6; g.beginPath(); g.moveTo(x,y);
    for(let s=0;s<8;s++){a+=(R()-.5)*1.2;x+=Math.cos(a)*18;y+=Math.sin(a)*18;g.lineTo(x,y);}
    g.stroke();
  }
}
function chunkKey(cx,cy){ return cx+','+cy; }
function getChunk(cx,cy){
  const k=chunkKey(cx,cy);
  let c=chunks.get(k);
  if(c)return c;
  const R=seeded(((cx*73856093)^(cy*19349663))>>>0);
  const props=[], deco=[];
  const put=(type,r,n)=>{
    for(let i=0;i<n;i++){
      const x=cx*CH+R()*CH, y=cy*CH+R()*CH;
      if(props.some(p=>dist2(x,y,p.x,p.y)<(p.r+r+60)**2))continue;
      props.push({type,x,y,r,s:0.8+R()*0.5,rot:R()*TAU,hp:type==='barrel'?34:0,
        key:k+'#'+props.length});
    }
  };
  put('cactus',20,4); put('rock',26,3); put('barrel',19,2); put('skull',16,2); put('wagon',40,1);
  put('tree',22,2); put('crystal',18,2);
  for(let i=0;i<150;i++) deco.push({x:cx*CH+R()*CH, y:cy*CH+R()*CH, t:(R()*4)|0, r:R()*TAU, s:.6+R()*.9});
  c={props,deco,cx,cy};
  // 이미 파괴한 통은 복구하지 않는다
  for(const p of props) if(p.type==='barrel'&&deadBarrels.has(p.key))p.type='gone';
  chunks.set(k,c);
  return c;
}
let activeChunks=[];
function ensureChunks(){
  const vw=VW/SCALE, vh=VH/SCALE;
  const c0x=Math.floor((cam.x-vw/2-CH*.6)/CH), c1x=Math.floor((cam.x+vw/2+CH*.6)/CH);
  const c0y=Math.floor((cam.y-vh/2-CH*.6)/CH), c1y=Math.floor((cam.y+vh/2+CH*.6)/CH);
  activeChunks.length=0;
  for(let cx=c0x;cx<=c1x;cx++)for(let cy=c0y;cy<=c1y;cy++) activeChunks.push(getChunk(cx,cy));
  if(chunks.size>90){
    const pcx=Math.floor(P.x/CH), pcy=Math.floor(P.y/CH);
    for(const [k,c] of chunks){
      if(Math.abs(c.cx-pcx)>4||Math.abs(c.cy-pcy)>4) chunks.delete(k);
    }
  }
}
function nearProps(){ let a=[]; for(const c of activeChunks)a=a.concat(c.props); return a; }
function biome(){ return HG.BIOMES[Math.floor((wave-1)/4)%HG.BIOMES.length]; }

/* ================= 상태 ================= */
let state='lobby';
let P,enemies,bullets,ebullets,parts,pickups,texts,decals,tumbles,comps;
const cam={x:0,y:0,sx:0,sy:0,shake:0};
let wave,coins,gems,kills,combo,comboT,timeScale,hitStop,spawnQ,waveActive,runTime,bossAlive;
let runBest={kills:0,gems:0};
const RUP={hp:0,dmg:0,spd:0,rel:0,mag:0,crit:0,dodge:0,luck:0,pierce:0};   // 런 한정 강화
let bannerT=0, lobbyTab='out', armorTab='hat', pendingBox=null;

function runStats(){
  const s=Object.assign({},PS);
  s.maxHp+=RUP.hp*24; s.dmg+=RUP.dmg*0.14; s.spd*=1+RUP.spd*0.075;
  s.rel+=RUP.rel*0.15; s.mag+=RUP.mag*0.28; s.crit+=RUP.crit*0.055;
  s.dodgeCd*=1-Math.min(.6,RUP.dodge*0.12); s.coin+=RUP.luck*0.12; s.dia+=RUP.luck*0.06;
  s.pierce+=RUP.pierce;
  return s;
}
let RS={};
function refreshRS(){
  RS=runStats();
  const w=WEP.st;
  WST.dmg=w.dmg*RS.dmg;
  WST.rof=Math.max(.02,w.rof/RS.rof);
  WST.mag=Math.max(1,Math.round(w.mag*RS.mag));
  WST.rel=Math.max(.18,w.rel/RS.rel);
  WST.crit=clamp(RS.crit+(w.crit||0),0,.95);
  WST.cdmg=RS.cdmg;
  WST.pierce=w.pierce+RS.pierce;
  WST.boom=(w.boom||0)+RS.boom;
  WST.chain=(w.chain||0)+RS.chain;
  WST.burn=(w.burn||0)+RS.burn;
  WST.slow=Math.min(.75,(w.slow||0)+RS.slow);
}

function newRun(){
  computeStats();
  for(const k in RUP)RUP[k]=0;
  refreshRS();
  P={x:0,y:0,vx:0,vy:0,r:17,hp:RS.maxHp,maxHp:RS.maxHp,sh:0,shMax:0,
     aim:-Math.PI/2,face:-Math.PI/2,ammo:WST.mag,reloading:0,relTotal:0,cool:0,
     dodgeCd:0,dodgeT:0,dodgeAng:0,inv:0,walk:0,kick:0,spin:0,hurtFlash:0,dualSide:1,still:0};
  enemies=[];bullets=[];ebullets=[];parts=[];pickups=[];texts=[];decals=[];tumbles=[];comps=[];
  for(let i=0;i<5;i++)tumbles.push({x:rnd(1600,-800),y:rnd(1600,-800),r:rnd(26,14),a:rnd(TAU),sp:rnd(130,70),rot:0});
  cam.x=0;cam.y=0;cam.shake=0;
  wave=0;coins=0;gems=0;kills=0;combo=0;comboT=0;timeScale=1;hitStop=0;
  spawnQ=[];waveActive=false;runTime=0;bossAlive=false;
  runBest={kills:0,gems:0};
  chunks.clear(); deadBarrels.clear();
  for(let i=0;i<RS.companions;i++)spawnComp(i);
  SAVE.runs++;
  nextWave();
  hudAmmo(true); hudHp(); hudGem();
}
function spawnComp(i){
  comps.push({x:P.x+rnd(60,-60),y:P.y+rnd(60,-60),vx:0,vy:0,r:11,aim:0,cool:rnd(.5),walk:rnd(TAU),idx:i});
}

/* ================= 웨이브 (무한) ================= */
function nextWave(){
  wave++;
  waveActive=true; spawnQ=[];
  const isBoss=wave%5===0;
  const budget=5+wave*2.5+Math.pow(wave,1.42)*0.6;
  if(isBoss){
    spawnQ.push({t:'boss',d:1.2,m:wave>=25?5:0});
    const n=Math.min(14,2+Math.floor(wave/5)*2);
    for(let i=0;i<n;i++)spawnQ.push({t:pick(['rat','snake','coyote']),d:2.4+i*.45,m:-1});
  }else{
    const pool=[['rat',1]];
    if(wave>=2)pool.push(['snake',1.1]);
    if(wave>=3)pool.push(['mole',2.2]);
    if(wave>=4)pool.push(['vulture',2]);
    if(wave>=6)pool.push(['scorp',3.2]);
    if(wave>=8)pool.push(['coyote',2.4]);
    if(wave>=11)pool.push(['bomber',3]);
    if(wave>=14)pool.push(['turretB',3.4]);
    if(wave>=18)pool.push(['ghost',3.2]);
    let b=budget,t=0;
    while(b>0&&spawnQ.length<70){
      const e=pick(pool); b-=e[1];
      spawnQ.push({t:e[0],d:t,m:-1});
      t+=clamp(1.5-wave*0.035,0.28,1.5)*rnd(1.3,.6);
    }
  }
  const B=biome();
  banner('WAVE '+wave,isBoss?'⚠ 보스 — 고양이 두목':(B.n+' · '+pick([
    '무법자들이 모래를 넘어온다','먼지 속에서 발소리가 들린다','탄창을 채워라, 총잡이',
    '해가 기울기 전에 끝내라','끝없는 사막, 끝없는 적'])));
  SND.wave();
  // 웨이브 시작 보호막
  if(RS.shield>0){ P.sh=RS.shield; P.shMax=RS.shield; }
  const el=document.getElementById('waveNum'); if(el)el.textContent=wave;
}
function pickMod(){
  if(wave<7)return 0;
  const r=Math.random();
  const chance=clamp(0.06+wave*0.012,0,0.55);
  if(r>chance)return 0;
  const avail=[1,2,4];
  if(wave>=12)avail.push(5);
  if(wave>=10)avail.push(3);
  return pick(avail);
}
function spawnEnemy(type,modForce){
  const T=HG.ETYPE[type];
  const mi=(modForce>=0)?modForce:pickMod();
  const M=HG.EMOD[mi]||HG.EMOD[0];
  const vw=VW/SCALE, vh=VH/SCALE;
  const rad=Math.hypot(vw,vh)/2+rnd(240,120);
  const a=rnd(TAU);
  const x=P.x+Math.cos(a)*rad, y=P.y+Math.sin(a)*rad;
  const lvl=1+(wave-1)*0.19;
  const bossMul=type==='boss'?(1+(Math.floor(wave/5)-1)*0.8):1;
  const e={
    type,mod:mi,x,y,vx:0,vy:0,r:T.r*(mi===5?1.25:1),
    hp:T.hp*(type==='boss'?bossMul:lvl)*M.hp,
    maxHp:1, spd:T.spd*(type==='boss'?1:clamp(1+(wave-1)*0.011,1,1.6))*M.spd,
    dmg:T.dmg*clamp(lvl*0.72,1,3.4)*M.dmg,
    coin:Math.round(T.coin*M.coin*clamp(1+(wave-1)*0.04,1,4)),
    diaCh:T.dia*M.dia, armor:(T.armor||0)*(mi===5?2:1),
    a:ang(x,y,P.x,P.y), walk:rnd(TAU), hurt:0, flash:0, kb:{x:0,y:0},
    st:'walk', t:0, t2:0, cd:rnd(1.4,.5), phase:0, tele:0, dead:false, scale:0,
    burnT:0, burnDps:0, slowT:0, slowV:0, home:{x,y}
  };
  e.maxHp=e.hp;
  if(type==='boss'){ bossAlive=true; SND.boss(); cam.shake=Math.max(cam.shake,14);
    banner('고양이 두목','사막 최악의 현상금 표적'); }
  enemies.push(e);
  for(let i=0;i<12;i++)puff(e.x,e.y,'#d9b377');
  return e;
}

/* ================= 파티클 ================= */
function puff(x,y,col,sp=1){ parts.push({k:'puff',x,y,vx:rnd(60,-60)*sp,vy:rnd(60,-60)*sp,r:rnd(13,5)*sp,life:rnd(.7,.35),t:0,col}); }
function spark(x,y,a,col,n=6,sp=1){ for(let i=0;i<n;i++){const aa=a+rnd(.9,-.9);
  parts.push({k:'spark',x,y,vx:Math.cos(aa)*rnd(560,160)*sp,vy:Math.sin(aa)*rnd(560,160)*sp,life:rnd(.3,.12),t:0,col:col||'#ffd98a',len:rnd(14,6)});} }
function fur(x,y,col,n=10){ for(let i=0;i<n;i++){const a=rnd(TAU);
  parts.push({k:'fur',x,y,vx:Math.cos(a)*rnd(260,60),vy:Math.sin(a)*rnd(260,60),life:rnd(.9,.45),t:0,col,r:rnd(5,2),rot:rnd(TAU),vr:rnd(9,-9)});} }
function shell(x,y,a){ parts.push({k:'shell',x,y,vx:Math.cos(a+1.7)*rnd(210,110),vy:Math.sin(a+1.7)*rnd(210,110)-60,life:1.1,t:0,rot:rnd(TAU),vr:rnd(16,-16),gz:rnd(120,70),z:6}); }
function ring(x,y,col,r0,r1,life){ parts.push({k:'ring',x,y,r0,r1,life,t:0,col}); }
function bolt(x1,y1,x2,y2,col){ parts.push({k:'bolt',x:x1,y:y1,x2,y2,life:.16,t:0,col:col||'#aee8ff',seed:Math.random()*1000}); }
function floatText(x,y,txt,col,size=17,crit=false){ texts.push({x,y,txt,col,size,t:0,life:crit?.95:.7,vy:-46,crit}); }
function decal(x,y){ decals.push({x,y,r:rnd(7,3),a:rnd(.28,.12)}); if(decals.length>200)decals.shift(); }

/* ================= 발사 ================= */
let shooting=false;
function fire(){
  if(P.reloading>0||P.cool>0)return;
  if(P.ammo<=0){ startReload(); return; }
  let rof=WST.rof;
  if(WST.spin)rof=WST.rof*lerp(2.2,0.85,P.spin);
  P.cool=rof; P.ammo--;
  const n=WST.pellets;
  for(let i=0;i<n;i++){
    const sp=WST.spread*(WST.spin?lerp(1.5,.8,P.spin):1);
    const a=P.aim+(n>1?(i/(n-1)-.5)*WST.spread*2:0)+rnd(sp,-sp);
    const off=WST.dual?(P.dualSide*9):0;
    const bx=P.x+Math.cos(P.aim)*22+Math.cos(P.aim+Math.PI/2)*off;
    const by=P.y+Math.sin(P.aim)*22+Math.sin(P.aim+Math.PI/2)*off;
    const crit=Math.random()<WST.crit;
    bullets.push({x:bx,y:by,px:bx,py:by,
      vx:Math.cos(a)*WST.speed*rnd(1.06,.94), vy:Math.sin(a)*WST.speed*rnd(1.06,.94),
      dmg:WST.dmg*(crit?WST.cdmg:1), crit, pierce:WST.pierce, ric:WST.ric,
      hit:new Set(), life:(WST.life||0)||clamp(1.1*WST.rngMul,.3,3), t:0, r:4,
      col:crit?'#fff1b0':'#ffe2a0', mine:true});
  }
  if(WST.dual)P.dualSide*=-1;
  const mx=P.x+Math.cos(P.aim)*24, my=P.y+Math.sin(P.aim)*24;
  spark(mx,my,P.aim,'#ffe08a',n>1?14:7,n>1?1.5:1);
  ring(mx,my,'#ffd16a',4,n>1?34:20,.16);
  if(WST.arch!=='flamer'&&WST.arch!=='tesla')shell(P.x,P.y,P.aim);
  P.kick=WST.kick; cam.shake=Math.min(24,cam.shake+WST.kick*0.5);
  SND.shot(WST.snd);
  if(P.ammo<=0)startReload();
  hudAmmo();
}
function startReload(){
  if(P.reloading>0)return;
  if(P.ammo>=WST.mag)return;
  P.relTotal=WST.rel; P.reloading=P.relTotal;
  SND.reload();
  const el=document.getElementById('reloadBar'); if(el)el.style.display='block';
}

/* ================= 피해 ================= */
function dmgMulFor(e){
  let m=1;
  const P_=JOB.p, pv=JOB.pv;
  const d=Math.sqrt(dist2(P.x,P.y,e.x,e.y));
  if(P_==='snipe')m*=1+pv*clamp((d-200)/600,0,1);
  if(P_==='close')m*=1+pv*clamp(1-(d-40)/260,0,1);
  if(P_==='turret')m*=1+pv*clamp(P.still/1.2,0,1);
  if(P_==='berserk')m*=1+pv*clamp(1-P.hp/P.maxHp,0,1);
  return m;
}
function damageEnemy(e,dmg,crit,ax,ay,src){
  if(e.dead)return;
  const d=Math.max(1,dmg*dmgMulFor(e)-e.armor);
  e.hp-=d; e.flash=.14; e.hurt=.2;
  const a=ang(ax,ay,e.x,e.y);
  const kb=(crit?260:150)*(WST.knock||1)/(e.type==='boss'?6:1);
  e.kb.x+=Math.cos(a)*kb; e.kb.y+=Math.sin(a)*kb;
  floatText(e.x,e.y-e.r-6,Math.round(d),crit?'#ffe066':'#fff',crit?24:17,crit);
  spark(e.x,e.y,a,crit?'#ffe066':'#ffb9a0',crit?10:5);
  fur(e.x,e.y,HG.ETYPE[e.type].col,crit?7:3);
  if(WST.burn>0){ e.burnT=Math.max(e.burnT,2.4); e.burnDps=Math.max(e.burnDps,WST.burn); }
  if(WST.slow>0){ e.slowT=1.4; e.slowV=WST.slow; }
  if(WST.vamp>0&&src!=='comp'){ P.hp=Math.min(P.maxHp,P.hp+d*WST.vamp); hudHp(); }
  if(crit){ SND.crit(); hitStop=Math.max(hitStop,.045); cam.shake=Math.min(26,cam.shake+5); }
  else SND.hit();
  if(e.hp<=0)killEnemy(e);
}
function areaDamage(x,y,r,dmg,src){
  ring(x,y,'#ffb04a',10,r,.4);
  for(let i=0;i<18;i++)puff(x,y,'#e8a860',1.5);
  spark(x,y,rnd(TAU),'#ffd08a',16,1.6);
  cam.shake=Math.min(28,cam.shake+9);
  SND.boom();
  for(const e of enemies){
    if(e.dead)continue;
    const d=Math.sqrt(dist2(e.x,e.y,x,y));
    if(d<r)damageEnemy(e,dmg*(1-d/r*0.6),false,x,y,src);
  }
}
function chainFrom(e,count,dmg){
  let cur=e, hit=new Set([e]);
  for(let i=0;i<count;i++){
    let best=null,bd=320*320;
    for(const o of enemies){ if(o.dead||hit.has(o))continue;
      const d=dist2(cur.x,cur.y,o.x,o.y); if(d<bd){bd=d;best=o;} }
    if(!best)break;
    bolt(cur.x,cur.y,best.x,best.y,'#aee8ff');
    damageEnemy(best,dmg*0.7,false,cur.x,cur.y);
    SND.zap();
    hit.add(best); cur=best;
  }
}
function killEnemy(e){
  if(e.dead)return; e.dead=true;
  const T=HG.ETYPE[e.type], M=HG.EMOD[e.mod]||HG.EMOD[0];
  kills++; SAVE.kills++; combo++; comboT=2.4; runBest.kills=kills;
  fur(e.x,e.y,T.col,e.type==='boss'?70:16);
  for(let i=0;i<(e.type==='boss'?26:7);i++)puff(e.x,e.y,'#e0bd86',e.type==='boss'?2:1);
  ring(e.x,e.y,M.aura||'#ffd9a0',e.r,e.r*(e.type==='boss'?7:3),e.type==='boss'?.6:.3);
  SND.kill();
  if(JOB.p==='vampK'){ P.hp=Math.min(P.maxHp,P.hp+P.maxHp*JOB.pv); hudHp(); }
  // 코인
  const n=Math.max(1,Math.round(e.coin*RS.coin));
  const chunks_=Math.min(n,12);
  for(let i=0;i<chunks_;i++){
    const a=rnd(TAU),s=rnd(230,60);
    pickups.push({k:'coin',x:e.x,y:e.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,v:Math.ceil(n/chunks_),t:0,r:9});
  }
  // 다이아몬드
  let dn=0;
  const ch=e.diaCh*RS.dia;
  if(e.type==='boss')dn=Math.max(1,Math.round((4+Math.floor(wave/5)*2)*RS.dia));
  else { if(Math.random()<ch)dn=1; if(Math.random()<ch*0.25)dn++; }
  for(let i=0;i<dn;i++){
    const a=rnd(TAU),s=rnd(190,40);
    pickups.push({k:'gem',x:e.x,y:e.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,v:1,t:0,r:11});
  }
  if(Math.random()<(e.type==='boss'?1:0.05))
    pickups.push({k:'heart',x:e.x+rnd(20,-20),y:e.y+rnd(20,-20),vx:0,vy:0,v:0,t:0,r:12});
  if(e.type==='mole'&&Math.random()<.35)
    pickups.push({k:'ammo',x:e.x,y:e.y,vx:0,vy:0,v:0,t:0,r:11});
  if(e.type==='bomber')areaDamage(e.x,e.y,120,e.dmg*1.4,'enemy');
  if(e.type==='boss'){ bossAlive=false; timeScale=0.25; cam.shake=30;
    banner('두목 처치!','현상금을 챙겼다'); }
}
function hurtPlayer(d){
  if(P.inv>0||P.dodgeT>0)return;
  d=d*(1-RS.dr);
  if(P.sh>0){ const a=Math.min(P.sh,d); P.sh-=a; d-=a;
    ring(P.x,P.y,'#9fe8ff',16,40,.3); SND.noise(.2,.12,1800,2); }
  if(d>0){ P.hp-=d; P.inv=.6; P.hurtFlash=.3; combo=0;
    cam.shake=Math.min(30,cam.shake+11); SND.hurt();
    const f=document.getElementById('dmgFlash');
    if(f){ f.style.opacity=Math.min(.9,0.3+d/60); setTimeout(()=>f.style.opacity=0,120); }
    fur(P.x,P.y,'#f0d9b5',8);
    if(JOB.p==='thorn'){ ring(P.x,P.y,'#ffb0b0',10,130,.3);
      for(const e of enemies){ if(dist2(e.x,e.y,P.x,P.y)<130*130)damageEnemy(e,JOB.pv,false,P.x,P.y); } }
  }else{ P.inv=.35; }
  if(P.hp<=0){ P.hp=0; gameOver(); }
  hudHp();
}

/* ================= 충돌 ================= */
function solidProp(p){ return p.type!=='skull'&&p.type!=='gone'&&p.type!=='crystal'; }
function pushOutProps(o,soft){
  for(const c of activeChunks)for(const p of c.props){
    if(!solidProp(p))continue;
    const rr=p.r*p.s*0.72+o.r;
    const d2=dist2(o.x,o.y,p.x,p.y);
    if(d2<rr*rr){
      const d=Math.sqrt(d2)||.001;
      o.x=p.x+(o.x-p.x)/d*rr; o.y=p.y+(o.y-p.y)/d*rr;
      if(!soft){o.vx*=.4;o.vy*=.4;}
    }
  }
}
function explodeBarrel(p){
  p.type='gone'; deadBarrels.add(p.key);
  areaDamage(p.x,p.y,150,110,'barrel');
  const dp=Math.sqrt(dist2(P.x,P.y,p.x,p.y));
  if(dp<130)hurtPlayer(16*(1-dp/130));
}

/* ================= 업데이트 ================= */
const keys={};
const mouse={x:0,y:0,wx:0,wy:0,inside:false};
const tl={active:false,id:null,ox:0,oy:0,x:0,y:0};
const tr={active:false,id:null,ox:0,oy:0,x:1,y:0};
let touchMode=('ontouchstart' in window)||navigator.maxTouchPoints>0;

function update(dt){
  runTime+=dt;
  ensureChunks();

  /* 입력 */
  let mx=0,my=0;
  if(keys['w']||keys['arrowup'])my-=1;
  if(keys['s']||keys['arrowdown'])my+=1;
  if(keys['a']||keys['arrowleft'])mx-=1;
  if(keys['d']||keys['arrowright'])mx+=1;
  if(tl.active){mx+=tl.x;my+=tl.y;}
  const ml=Math.hypot(mx,my); if(ml>1){mx/=ml;my/=ml;}
  P.still=(ml<.1)?P.still+dt:0;

  if(tr.active)P.aim=Math.atan2(tr.y,tr.x);
  else if(mouse.inside){
    mouse.wx=(mouse.x-VW/2-cam.sx)/SCALE+cam.x;
    mouse.wy=(mouse.y-VH/2-cam.sy)/SCALE+cam.y;
    P.aim=ang(P.x,P.y,mouse.wx,mouse.wy);
  }
  P.face=aLerp(P.face,P.aim,1-Math.pow(.0005,dt));

  /* 이동 */
  if(P.dodgeT>0){
    P.dodgeT-=dt;
    const sp=640*(1-Math.pow(1-P.dodgeT/0.3,2)*0.25);
    P.x+=Math.cos(P.dodgeAng)*sp*dt; P.y+=Math.sin(P.dodgeAng)*sp*dt;
    if(Math.random()<dt*60)puff(P.x,P.y,'#e3c492');
  }else{
    const sp=RS.spd*(WST.spin&&shooting?0.62:1);
    P.vx=lerp(P.vx,mx*sp,1-Math.pow(.0001,dt));
    P.vy=lerp(P.vy,my*sp,1-Math.pow(.0001,dt));
    P.x+=P.vx*dt; P.y+=P.vy*dt;
    if(ml>.1){ P.walk+=dt*12; if(Math.random()<dt*9)puff(P.x+rnd(8,-8),P.y+10,'#d8b584',.5); }
    else P.walk=lerp(P.walk,0,dt*8);
  }
  P.dodgeCd=Math.max(0,P.dodgeCd-dt);
  P.inv=Math.max(0,P.inv-dt);
  P.hurtFlash=Math.max(0,P.hurtFlash-dt);
  P.kick=Math.max(0,P.kick-dt*42);
  pushOutProps(P);
  if(RS.regen>0&&P.hp<P.maxHp){ P.hp=Math.min(P.maxHp,P.hp+RS.regen*dt); hudHp(); }

  /* 사격 */
  P.cool=Math.max(0,P.cool-dt);
  if(P.reloading>0){
    P.reloading-=dt;
    const rb=document.getElementById('reloadFill');
    if(P.reloading<=0){ P.ammo=WST.mag; P.reloading=0;
      const el=document.getElementById('reloadBar'); if(el)el.style.display='none'; hudAmmo(true); }
    else if(rb)rb.style.width=(100*(1-P.reloading/P.relTotal))+'%';
  }
  if(WST.spin)P.spin=clamp(P.spin+(shooting?dt*1.1:-dt*1.8),0,1);
  const canFireWhileDodge=(JOB.p==='dodge');
  if(shooting&&(P.dodgeT<=0||canFireWhileDodge))fire();

  /* 스폰 */
  if(waveActive){
    for(const q of spawnQ)q.d-=dt;
    while(spawnQ.length&&spawnQ[0].d<=0){ const q=spawnQ.shift(); spawnEnemy(q.t,q.m); }
    if(!spawnQ.length&&!enemies.length){
      waveActive=false;
      setTimeout(()=>{ if(state==='play')openRunShop(); },800);
    }
  }
  const ln=document.getElementById('leftNum');
  if(ln)ln.textContent='남은 적 '+(enemies.length+spawnQ.length);

  /* 적 */
  for(let i=enemies.length-1;i>=0;i--){
    const e=enemies[i];
    e.t+=dt; e.flash=Math.max(0,e.flash-dt); e.hurt=Math.max(0,e.hurt-dt);
    e.scale=Math.min(1,e.scale+dt*4);
    if(e.burnT>0){ e.burnT-=dt;
      e.hp-=e.burnDps*dt;
      if(Math.random()<dt*16)parts.push({k:'spark',x:e.x+rnd(10,-10),y:e.y+rnd(10,-10),vx:0,vy:-60,life:.3,t:0,col:'#ff9b4a',len:7});
      if(e.hp<=0){ killEnemy(e); enemies.splice(i,1); continue; } }
    if(e.slowT>0)e.slowT-=dt;
    const slow=e.slowT>0?(1-e.slowV):1;
    const T=HG.ETYPE[e.type];
    const d=Math.sqrt(dist2(e.x,e.y,P.x,P.y));
    const toP=ang(e.x,e.y,P.x,P.y);
    e.x+=e.kb.x*dt; e.y+=e.kb.y*dt;
    e.kb.x*=Math.pow(.0015,dt); e.kb.y*=Math.pow(.0015,dt);

    // 너무 멀어지면 재배치 (무한 맵)
    if(d>3000&&e.type!=='boss'){
      const a=rnd(TAU), rad=Math.hypot(VW/SCALE,VH/SCALE)/2+200;
      e.x=P.x+Math.cos(a)*rad; e.y=P.y+Math.sin(a)*rad;
    }

    if(T.kind==='melee'){
      let a=toP; if(T.zig)a+=Math.sin(e.t*7)*0.55;
      e.a=aLerp(e.a,a,1-Math.pow(.002,dt));
      e.x+=Math.cos(e.a)*e.spd*slow*dt; e.y+=Math.sin(e.a)*e.spd*slow*dt;
      e.walk+=dt*11;
      if(d<e.r+P.r){ hurtPlayer(e.dmg); e.kb.x=-Math.cos(toP)*300; e.kb.y=-Math.sin(toP)*300; }
    }
    else if(T.kind==='charge'){
      e.cd-=dt;
      if(e.st==='walk'){
        e.a=aLerp(e.a,toP,1-Math.pow(.004,dt));
        e.x+=Math.cos(e.a)*e.spd*slow*dt; e.y+=Math.sin(e.a)*e.spd*slow*dt; e.walk+=dt*8;
        if(d<360&&e.cd<=0){ e.st='tele'; e.tele=.5; }
      }else if(e.st==='tele'){
        e.tele-=dt; e.a=aLerp(e.a,toP,1-Math.pow(.02,dt));
        if(e.tele<=0){ e.st='dash'; e.t2=.42; SND.noise(.22,.2,500,.8); }
      }else{
        e.t2-=dt;
        e.x+=Math.cos(e.a)*760*slow*dt; e.y+=Math.sin(e.a)*760*slow*dt;
        if(Math.random()<dt*50)puff(e.x,e.y,'#cfae7e');
        if(d<e.r+P.r){ hurtPlayer(e.dmg); e.t2=0; }
        if(e.t2<=0){ e.st='walk'; e.cd=rnd(2.6,1.4); }
      }
    }
    else if(T.kind==='dive'){
      e.cd-=dt;
      if(e.st==='walk'){
        const orb=toP+Math.PI/2*Math.sin(e.t*.8);
        e.a=aLerp(e.a,d>260?toP:orb,1-Math.pow(.01,dt));
        e.x+=Math.cos(e.a)*e.spd*slow*dt; e.y+=Math.sin(e.a)*e.spd*slow*dt; e.walk+=dt*16;
        if(e.cd<=0&&d<450){ e.st='tele'; e.tele=.45; }
      }else if(e.st==='tele'){
        e.tele-=dt; e.a=aLerp(e.a,toP,1-Math.pow(.01,dt));
        if(e.tele<=0){e.st='dash';e.t2=.5;}
      }else{
        e.t2-=dt;
        e.x+=Math.cos(e.a)*620*slow*dt; e.y+=Math.sin(e.a)*620*slow*dt;
        if(d<e.r+P.r){ hurtPlayer(e.dmg); e.t2=0; }
        if(e.t2<=0){e.st='walk';e.cd=rnd(2.4,1.2);}
      }
    }
    else if(T.kind==='gunner'){
      if(!T.still){
        const want=250, move=(d<want-50)?-1:(d>want+50?1:0);
        e.a=aLerp(e.a,toP,1-Math.pow(.004,dt));
        e.x+=Math.cos(e.a)*e.spd*move*slow*dt; e.y+=Math.sin(e.a)*e.spd*move*slow*dt;
        e.x+=Math.cos(e.a+Math.PI/2)*e.spd*.5*Math.sin(e.t*1.3)*dt;
        e.y+=Math.sin(e.a+Math.PI/2)*e.spd*.5*Math.sin(e.t*1.3)*dt;
        e.walk+=dt*9;
      }else e.a=aLerp(e.a,toP,1-Math.pow(.01,dt));
      e.cd-=dt;
      if(e.cd<=0&&d<620&&e.st!=='aim'){ e.cd=rnd(2.4,1.2); e.tele=.4; e.st='aim'; }
      if(e.st==='aim'){
        e.tele-=dt;
        if(e.tele<=0){
          e.st='walk';
          const shots=T.still?3:1;
          for(let k=0;k<shots;k++){
            const a=toP+rnd(.12,-.12)+(shots>1?(k-1)*.14:0);
            ebullets.push({x:e.x+Math.cos(a)*18,y:e.y+Math.sin(a)*18,vx:Math.cos(a)*440,vy:Math.sin(a)*440,r:6,dmg:e.dmg,life:2.4,t:0});
          }
          spark(e.x+Math.cos(toP)*18,e.y+Math.sin(toP)*18,toP,'#ffcf7a',5);
          SND.noise(.18,.1,900,1.2);
        }
      }
      if(!T.still&&d<e.r+P.r){ hurtPlayer(e.dmg*.6); e.kb.x=-Math.cos(toP)*240; e.kb.y=-Math.sin(toP)*240; }
    }
    else if(T.kind==='bomber'){
      e.a=aLerp(e.a,toP,1-Math.pow(.004,dt));
      e.x+=Math.cos(e.a)*e.spd*slow*dt; e.y+=Math.sin(e.a)*e.spd*slow*dt;
      e.walk+=dt*14;
      if(d<e.r+P.r+16){ areaDamage(e.x,e.y,130,e.dmg,'enemy');
        if(d<130)hurtPlayer(e.dmg); killEnemy(e); enemies.splice(i,1); continue; }
    }
    else if(T.kind==='boss'){
      e.cd-=dt;
      if(e.st==='walk'){
        const want=240, move=(d<want-60)?-.6:(d>want+40?1:0);
        e.a=aLerp(e.a,toP,1-Math.pow(.01,dt));
        e.x+=Math.cos(e.a)*e.spd*move*slow*dt; e.y+=Math.sin(e.a)*e.spd*move*slow*dt;
        e.x+=Math.cos(e.a+Math.PI/2)*e.spd*.6*Math.sin(e.t*.9)*dt;
        e.y+=Math.sin(e.a+Math.PI/2)*e.spd*.6*Math.sin(e.t*.9)*dt;
        e.walk+=dt*7;
        if(e.cd<=0){ e.phase=(e.phase+1)%4; e.st='tele'; e.tele=.6; }
      }else if(e.st==='tele'){
        e.tele-=dt; e.a=aLerp(e.a,toP,1-Math.pow(.01,dt));
        if(Math.random()<dt*22)spark(e.x,e.y,rnd(TAU),'#ff9c4a',2);
        if(e.tele<=0){
          if(e.phase===0){
            const n=14+Math.min(10,Math.floor(wave/10));
            for(let k=0;k<n;k++){ const a=toP+k/n*TAU;
              ebullets.push({x:e.x+Math.cos(a)*40,y:e.y+Math.sin(a)*40,vx:Math.cos(a)*360,vy:Math.sin(a)*360,r:7,dmg:16,life:3,t:0,boss:true}); }
            cam.shake=16; SND.shot('shotgun'); e.st='walk'; e.cd=rnd(2.6,1.6);
          }else if(e.phase===1){ e.st='dash'; e.t2=.7; SND.boss(); }
          else if(e.phase===2){
            for(let k=0;k<3;k++){
              const a=rnd(TAU);
              const n2=spawnEnemy(pick(['rat','coyote']),0);
              n2.x=clamp(e.x+Math.cos(a)*95,-1e9,1e9); n2.y=e.y+Math.sin(a)*95;
            }
            ring(e.x,e.y,'#ff9c4a',20,160,.5); e.st='walk'; e.cd=rnd(3,2);
          }else{
            // 나선탄
            for(let k=0;k<10;k++){
              const a=toP+k*0.62;
              ebullets.push({x:e.x+Math.cos(a)*40,y:e.y+Math.sin(a)*40,vx:Math.cos(a)*300,vy:Math.sin(a)*300,r:8,dmg:18,life:3.2,t:0,boss:true});
            }
            SND.shot('rifle'); e.st='walk'; e.cd=rnd(2.4,1.5);
          }
        }
      }else{
        e.t2-=dt;
        e.x+=Math.cos(e.a)*700*dt; e.y+=Math.sin(e.a)*700*dt;
        if(Math.random()<dt*70)puff(e.x,e.y,'#d8b07a',1.6);
        if(d<e.r+P.r){ hurtPlayer(e.dmg); e.t2=Math.min(e.t2,.05); }
        if(e.t2<=0){ e.st='walk'; e.cd=rnd(2.2,1.2); cam.shake=12; }
      }
    }

    if(!HG.ETYPE[e.type].phase)pushOutProps(e,true);
    for(let j=i-1;j>=0;j--){
      const o=enemies[j]; if(o.type==='boss'&&e.type!=='boss')continue;
      const rr=e.r+o.r, dd=dist2(e.x,e.y,o.x,o.y);
      if(dd<rr*rr&&dd>0.01){
        const dl=Math.sqrt(dd),nx=(e.x-o.x)/dl,ny=(e.y-o.y)/dl,push=(rr-dl)*.5;
        e.x+=nx*push;e.y+=ny*push;o.x-=nx*push;o.y-=ny*push;
      }
    }
    if(e.dead)enemies.splice(i,1);
  }

  /* 동료 */
  for(const c of comps){
    const tx=P.x-Math.cos(P.aim)*48+Math.cos(c.idx*2.1)*42;
    const ty=P.y-Math.sin(P.aim)*48+Math.sin(c.idx*2.1)*42;
    const d=Math.sqrt(dist2(c.x,c.y,tx,ty));
    if(d>14){ const a=ang(c.x,c.y,tx,ty);
      c.x+=Math.cos(a)*Math.min(430,d*4)*dt; c.y+=Math.sin(a)*Math.min(430,d*4)*dt; c.walk+=dt*12; }
    let best=null,bd=520*520;
    for(const e of enemies){ if(e.dead)continue; const dd=dist2(c.x,c.y,e.x,e.y); if(dd<bd){bd=dd;best=e;} }
    c.cool-=dt;
    if(best){
      c.aim=aLerp(c.aim,ang(c.x,c.y,best.x,best.y),1-Math.pow(.002,dt));
      if(c.cool<=0){
        c.cool=.42;
        const a=c.aim+rnd(.07,-.07);
        bullets.push({x:c.x+Math.cos(a)*14,y:c.y+Math.sin(a)*14,px:c.x,py:c.y,
          vx:Math.cos(a)*950,vy:Math.sin(a)*950,dmg:WST.dmg*0.38,crit:false,
          pierce:0,ric:0,hit:new Set(),life:.9,t:0,r:3,col:'#cfe9ff',mine:true,comp:true});
        spark(c.x+Math.cos(a)*14,c.y+Math.sin(a)*14,a,'#cfe9ff',4);
        SND.noise(.1,.06,1500,1.6);
      }
    }
  }

  /* 내 탄 */
  const props=nearProps();
  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];
    b.px=b.x;b.py=b.y;
    b.x+=b.vx*dt;b.y+=b.vy*dt;b.t+=dt;
    if(b.t>b.life){ spark(b.x,b.y,Math.atan2(-b.vy,-b.vx),'#e8cfa0',4); bullets.splice(i,1); continue; }
    let blocked=false;
    for(const p of props){
      if(!solidProp(p))continue;
      const rr=p.r*p.s*0.7;
      if(dist2(b.x,b.y,p.x,p.y)<rr*rr){
        spark(b.x,b.y,Math.atan2(-b.vy,-b.vx),p.type==='rock'?'#d8d2c4':'#e8bb7a',7);
        decal(b.x,b.y);
        if(p.type==='barrel'){ p.hp-=b.dmg; if(p.hp<=0)explodeBarrel(p); }
        blocked=true;break;
      }
    }
    if(blocked){
      if(b.ric>0){ b.ric--; b.vx*=-1; b.vy*=-1; b.hit.clear(); }
      else { bullets.splice(i,1); continue; }
    }
    for(const e of enemies){
      if(e.dead||b.hit.has(e))continue;
      const rr=e.r+b.r;
      if(dist2(b.x,b.y,e.x,e.y)<rr*rr){
        b.hit.add(e);
        damageEnemy(e,b.dmg,b.crit,b.px,b.py,b.comp?'comp':'p');
        if(WST.boom>0&&!b.comp)areaDamage(b.x,b.y,110,WST.boom,'p');
        if(WST.chain>0&&!b.comp)chainFrom(e,WST.chain,b.dmg);
        if(b.pierce>0){ b.pierce--; b.dmg*=.82; }
        else if(b.ric>0){
          b.ric--; b.hit.clear(); b.hit.add(e);
          let best=null,bd=420*420;
          for(const o of enemies){ if(o.dead||o===e)continue; const dd=dist2(b.x,b.y,o.x,o.y); if(dd<bd){bd=dd;best=o;} }
          const na=best?ang(b.x,b.y,best.x,best.y):rnd(TAU);
          const sp=Math.hypot(b.vx,b.vy);
          b.vx=Math.cos(na)*sp; b.vy=Math.sin(na)*sp;
        }
        else { bullets.splice(i,1); break; }
      }
    }
  }

  /* 적 탄 */
  for(let i=ebullets.length-1;i>=0;i--){
    const b=ebullets[i];
    b.x+=b.vx*dt;b.y+=b.vy*dt;b.t+=dt;
    if(b.t>b.life){ebullets.splice(i,1);continue;}
    let hp2=false;
    for(const p of props){ if(!solidProp(p))continue;
      const rr=p.r*p.s*0.7; if(dist2(b.x,b.y,p.x,p.y)<rr*rr){hp2=true;break;} }
    if(hp2){ spark(b.x,b.y,0,'#ffb27a',5); ebullets.splice(i,1); continue; }
    const rr=P.r+b.r;
    if(dist2(b.x,b.y,P.x,P.y)<rr*rr){
      if(P.dodgeT>0){ floatText(P.x,P.y-26,'회피!','#9fe8ff',16); }
      else hurtPlayer(b.dmg);
      ebullets.splice(i,1);
    }
  }

  /* 픽업 */
  const pr=170*RS.pickup;
  for(let i=pickups.length-1;i>=0;i--){
    const u=pickups[i];
    u.t+=dt; u.x+=u.vx*dt; u.y+=u.vy*dt;
    u.vx*=Math.pow(.002,dt); u.vy*=Math.pow(.002,dt);
    const d=Math.sqrt(dist2(u.x,u.y,P.x,P.y));
    if(u.t>7){ const a=ang(u.x,u.y,P.x,P.y),pull=lerp(460,1100,clamp((u.t-7)/3,0,1));
      u.vx=Math.cos(a)*pull; u.vy=Math.sin(a)*pull; }
    else if(d<pr&&u.t>.25){ const a=ang(u.x,u.y,P.x,P.y),pull=lerp(800,190,d/pr);
      u.vx+=Math.cos(a)*pull*dt*3; u.vy+=Math.sin(a)*pull*dt*3; }
    if(d<P.r+u.r){
      if(u.k==='coin'){ coins+=u.v; SND.coin(); floatText(P.x,P.y-30,'+'+u.v,'#ffd45e',15); }
      else if(u.k==='gem'){ gems+=u.v; SAVE.dia+=u.v; SAVE.diaAll+=u.v; runBest.gems=gems;
        SND.gem(); floatText(P.x,P.y-34,'💎 +'+u.v,'#9fe8ff',19,true); store(); hudGem(); }
      else if(u.k==='heart'){ P.hp=Math.min(P.maxHp,P.hp+Math.round(P.maxHp*.22)); SND.coin();
        floatText(P.x,P.y-30,'체력 회복','#ff8d7a',16); hudHp(); }
      else { P.ammo=WST.mag; P.reloading=0;
        const el=document.getElementById('reloadBar'); if(el)el.style.display='none';
        SND.reload(); floatText(P.x,P.y-30,'재장전!','#9fe8ff',16); hudAmmo(true); }
      pickups.splice(i,1);
      hudHp();
    }
  }

  /* 파티클 */
  for(let i=parts.length-1;i>=0;i--){
    const p=parts[i]; p.t+=dt;
    if(p.t>=p.life){parts.splice(i,1);continue;}
    if(p.k==='puff'){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.pow(.02,dt);p.vy*=Math.pow(.02,dt);}
    else if(p.k==='spark'){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.pow(.004,dt);p.vy*=Math.pow(.004,dt);}
    else if(p.k==='fur'){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.pow(.01,dt);p.vy*=Math.pow(.01,dt);p.rot+=p.vr*dt;}
    else if(p.k==='shell'){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.pow(.2,dt);p.gz-=560*dt;p.z+=p.gz*dt;
      if(p.z<0){p.z=0;p.gz*=-.35;p.vx*=.5;p.vy*=.5;}p.rot+=p.vr*dt;}
  }
  for(let i=texts.length-1;i>=0;i--){const t=texts[i];t.t+=dt;t.y+=t.vy*dt;t.vy*=Math.pow(.2,dt);if(t.t>=t.life)texts.splice(i,1);}

  /* 회전초 */
  for(const t of tumbles){
    t.x+=Math.cos(t.a)*t.sp*dt;t.y+=Math.sin(t.a)*t.sp*dt;t.rot+=dt*t.sp/t.r;
    if(dist2(t.x,t.y,P.x,P.y)>2200*2200){ const a=rnd(TAU);
      t.x=P.x+Math.cos(a)*1500; t.y=P.y+Math.sin(a)*1500; t.a=rnd(TAU); }
    if(Math.random()<dt*0.3)t.a+=rnd(.6,-.6);
  }

  if(comboT>0){comboT-=dt;if(comboT<=0)combo=0;}
  timeScale=lerp(timeScale,1,dt*2.2);
  cam.shake*=Math.pow(.0025,dt);

  const look=90;
  cam.x=lerp(cam.x,P.x+Math.cos(P.aim)*look,1-Math.pow(.0008,dt));
  cam.y=lerp(cam.y,P.y+Math.sin(P.aim)*look,1-Math.pow(.0008,dt));
  cam.sx=rnd(cam.shake,-cam.shake); cam.sy=rnd(cam.shake,-cam.shake);

  hudCombo();
}

/* ================= 렌더 ================= */
function draw(){
  const g=ctx;
  g.setTransform(DPR,0,0,DPR,0,0);
  g.clearRect(0,0,VW,VH);
  const B=biome();
  g.save();
  g.translate(VW/2+cam.sx,VH/2+cam.sy); g.scale(SCALE,SCALE); g.translate(-cam.x,-cam.y);

  const vw=VW/SCALE,vh=VH/SCALE;
  const vx0=cam.x-vw/2,vy0=cam.y-vh/2;
  const vis=(x,y,m=80)=>x>vx0-m&&x<vx0+vw+m&&y>vy0-m&&y<vy0+vh+m;

  /* 지형 */
  const gr=g.createLinearGradient(vx0,vy0,vx0+vw,vy0+vh);
  gr.addColorStop(0,B.g1); gr.addColorStop(1,B.g2);
  g.fillStyle=gr; g.fillRect(vx0-10,vy0-10,vw+20,vh+20);
  if(noiseTile){
    if(!draw._pat)draw._pat=g.createPattern(noiseTile,'repeat');
    g.save(); g.fillStyle=draw._pat; g.fillRect(vx0-10,vy0-10,vw+20,vh+20); g.restore();
  }
  /* 청크 장식 */
  g.save();
  for(const c of activeChunks)for(const d of c.deco){
    if(!vis(d.x,d.y,20))continue;
    if(d.t===0){ g.strokeStyle='rgba(150,120,55,0.35)'; g.lineWidth=1.2;
      for(let b=0;b<3;b++){g.beginPath();g.moveTo(d.x,d.y);g.lineTo(d.x+(b-1)*5*d.s,d.y-9*d.s);g.stroke();} }
    else if(d.t===1){ g.fillStyle='rgba(0,0,0,0.13)'; g.beginPath(); g.ellipse(d.x,d.y,4*d.s,2.6*d.s,d.r,0,TAU); g.fill(); }
    else if(d.t===2){ g.fillStyle='rgba(255,255,255,0.10)'; g.fillRect(d.x,d.y,3*d.s,2*d.s); }
    else { g.strokeStyle='rgba(90,60,25,0.18)'; g.lineWidth=1.4;
      g.beginPath(); g.moveTo(d.x,d.y); g.lineTo(d.x+16*d.s*Math.cos(d.r),d.y+16*d.s*Math.sin(d.r)); g.stroke(); }
  }
  g.restore();
  /* 탄흔 */
  for(const d of decals){ if(!vis(d.x,d.y,10))continue;
    g.fillStyle='rgba(60,36,16,'+d.a+')'; g.beginPath(); g.arc(d.x,d.y,d.r,0,TAU); g.fill(); }

  /* 그림자 */
  g.save(); g.globalAlpha=.3; g.fillStyle='#4a2f14';
  for(const e of enemies){ if(!vis(e.x,e.y))continue; g.beginPath(); g.ellipse(e.x,e.y+e.r*.55,e.r*.95,e.r*.42,0,0,TAU); g.fill(); }
  for(const c of comps){ g.beginPath(); g.ellipse(c.x,c.y+7,10,5,0,0,TAU); g.fill(); }
  g.beginPath(); g.ellipse(P.x,P.y+10,16,7,0,0,TAU); g.fill();
  g.restore();

  /* 픽업 */
  for(const u of pickups){
    if(!vis(u.x,u.y))continue;
    const bob=Math.sin(u.t*6)*2.5;
    g.save(); g.translate(u.x,u.y+bob);
    if(u.k==='coin'){
      const sq=Math.abs(Math.cos(u.t*4));
      g.save(); g.scale(clamp(sq,.25,1),1);
      g.fillStyle='#ffd45e'; g.beginPath(); g.arc(0,0,8,0,TAU); g.fill();
      g.strokeStyle='#b07d1c'; g.lineWidth=2; g.stroke();
      g.fillStyle='#fff1b8'; g.beginPath(); g.arc(-2,-2,3,0,TAU); g.fill(); g.restore();
    }else if(u.k==='gem'){
      g.rotate(Math.sin(u.t*3)*.3);
      const gg=g.createLinearGradient(-9,-11,9,11);
      gg.addColorStop(0,'#eaffff'); gg.addColorStop(.5,'#7fd4ff'); gg.addColorStop(1,'#3b8fd4');
      g.fillStyle=gg;
      g.beginPath(); g.moveTo(0,-11); g.lineTo(8,-2); g.lineTo(0,11); g.lineTo(-8,-2); g.closePath(); g.fill();
      g.strokeStyle='#ffffffcc'; g.lineWidth=1.4; g.stroke();
      g.globalAlpha=.5; g.fillStyle='#fff';
      g.beginPath(); g.moveTo(0,-11); g.lineTo(3,-2); g.lineTo(0,2); g.lineTo(-3,-2); g.closePath(); g.fill();
    }else if(u.k==='heart'){
      g.fillStyle='#ff6f7d'; g.font='22px serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('❤',0,0);
    }else{
      g.fillStyle='#6b4a2a'; g.fillRect(-10,-8,20,16);
      g.strokeStyle='#d8b37a'; g.lineWidth=2; g.strokeRect(-10,-8,20,16);
      g.fillStyle='#ffd45e'; g.fillRect(-5,-4,3,9); g.fillRect(-1,-4,3,9); g.fillRect(3,-4,3,9);
    }
    g.restore();
  }

  for(const e of enemies) if(vis(e.x,e.y,100)) drawEnemy(g,e);
  for(const c of activeChunks)for(const p of c.props) if(p.type!=='gone'&&vis(p.x,p.y,90))drawProp(g,p,B);

  for(const t of tumbles){ if(!vis(t.x,t.y,80))continue;
    g.save(); g.translate(t.x,t.y); g.rotate(t.rot);
    g.strokeStyle='#8a6a34'; g.lineWidth=2;
    for(let i=0;i<9;i++){const a=i/9*TAU;g.beginPath();g.moveTo(0,0);
      g.lineTo(Math.cos(a)*t.r,Math.sin(a)*t.r*.8);
      g.lineTo(Math.cos(a+.5)*t.r*.7,Math.sin(a+.5)*t.r*.6);g.stroke();}
    g.restore(); }

  for(const c of comps)drawComp(g,c);
  drawPlayer(g);

  /* 탄 */
  for(const b of bullets){
    g.save();
    g.strokeStyle=b.col; g.lineWidth=b.crit?3.6:(b.comp?1.8:2.4); g.lineCap='round'; g.globalAlpha=.95;
    g.beginPath(); g.moveTo(b.px,b.py); g.lineTo(b.x,b.y); g.stroke();
    g.globalAlpha=.3; g.lineWidth=b.crit?9:6; g.stroke();
    g.restore();
  }
  for(const b of ebullets){
    g.save(); g.translate(b.x,b.y);
    const rg=g.createRadialGradient(0,0,0,0,0,b.r*2.6);
    rg.addColorStop(0,b.boss?'#ffd0a0':'#ffb0b0'); rg.addColorStop(1,'#ff4a2a00');
    g.fillStyle=rg; g.beginPath(); g.arc(0,0,b.r*2.6,0,TAU); g.fill();
    g.fillStyle=b.boss?'#fff3d0':'#fff'; g.beginPath(); g.arc(0,0,b.r*.7,0,TAU); g.fill();
    g.restore();
  }

  /* 파티클 */
  for(const p of parts){
    const k=1-p.t/p.life;
    g.save();
    if(p.k==='puff'){g.globalAlpha=.4*k;g.fillStyle=p.col;g.beginPath();g.arc(p.x,p.y,p.r*(1.6-k*.6),0,TAU);g.fill();}
    else if(p.k==='spark'){g.globalAlpha=k;g.strokeStyle=p.col;g.lineWidth=2.4;g.lineCap='round';
      const l=(p.len||8)*k,a=Math.atan2(p.vy,p.vx);
      g.beginPath();g.moveTo(p.x,p.y);g.lineTo(p.x-Math.cos(a)*l,p.y-Math.sin(a)*l);g.stroke();}
    else if(p.k==='fur'){g.globalAlpha=k;g.translate(p.x,p.y);g.rotate(p.rot);g.fillStyle=p.col;
      g.beginPath();g.ellipse(0,0,p.r,p.r*.55,0,0,TAU);g.fill();}
    else if(p.k==='shell'){g.globalAlpha=Math.min(1,k*3);g.translate(p.x,p.y-p.z);g.rotate(p.rot);
      g.fillStyle='#e0b44a';g.fillRect(-3.5,-1.6,7,3.2);g.fillStyle='#fff0b8';g.fillRect(2,-1.6,1.6,3.2);}
    else if(p.k==='ring'){g.globalAlpha=k*.8;g.strokeStyle=p.col;g.lineWidth=3*k+1;
      g.beginPath();g.arc(p.x,p.y,lerp(p.r0,p.r1,1-k),0,TAU);g.stroke();}
    else if(p.k==='bolt'){
      g.globalAlpha=k; g.strokeStyle=p.col; g.lineWidth=2.6; g.lineCap='round';
      const R=seeded(p.seed|0); g.beginPath(); g.moveTo(p.x,p.y);
      const steps=6;
      for(let s=1;s<steps;s++){
        const t=s/steps;
        g.lineTo(lerp(p.x,p.x2,t)+(R()-.5)*26, lerp(p.y,p.y2,t)+(R()-.5)*26);
      }
      g.lineTo(p.x2,p.y2); g.stroke();
      g.globalAlpha=k*.35; g.lineWidth=8; g.stroke();
    }
    g.restore();
  }

  /* 데미지 숫자 */
  for(const t of texts){
    const k=1-t.t/t.life;
    g.save(); g.globalAlpha=clamp(k*1.6,0,1);
    g.font=(t.size*(t.crit?lerp(1.35,1,1-k):1))+'px Jua, sans-serif';
    g.textAlign='center'; g.lineWidth=4; g.strokeStyle='#3a1f08';
    g.strokeText(t.txt,t.x,t.y); g.fillStyle=t.col; g.fillText(t.txt,t.x,t.y);
    g.restore();
  }
  g.restore();

  /* 바이오움 틴트 + 비네트 */
  g.fillStyle=B.tint; g.fillRect(0,0,VW,VH);
  const vg=g.createRadialGradient(VW/2,VH/2,Math.min(VW,VH)*.33,VW/2,VH/2,Math.max(VW,VH)*.78);
  vg.addColorStop(0,'#00000000'); vg.addColorStop(1,'rgba(20,8,2,0.6)');
  g.fillStyle=vg; g.fillRect(0,0,VW,VH);

  /* 보스 체력바 */
  const boss=enemies.find(e=>e.type==='boss');
  if(boss){
    const w=Math.min(VW-60,480),x=(VW-w)/2,y=VH-(touchMode?152:74);
    g.save();
    g.fillStyle='#1b100acc'; g.strokeStyle='#8a5a2e'; g.lineWidth=2;
    rr(g,x-4,y-4,w+8,26,8); g.fill(); g.stroke();
    g.fillStyle='#2a1208'; rr(g,x,y,w,18,6); g.fill();
    const hg=g.createLinearGradient(x,0,x+w,0);
    hg.addColorStop(0,'#ffb36b'); hg.addColorStop(1,'#e03b1e');
    g.fillStyle=hg; rr(g,x,y,w*clamp(boss.hp/boss.maxHp,0,1),18,6); g.fill();
    g.fillStyle='#ffe9c9'; g.font='13px Jua, sans-serif'; g.textAlign='center';
    g.fillText('🐱 고양이 두목   '+fmt(Math.max(0,boss.hp))+' / '+fmt(boss.maxHp),VW/2,y+14);
    g.restore();
  }
  /* 미니 나침반: 가장 가까운 적 방향 */
  if(enemies.length){
    let best=null,bd=1e18;
    for(const e of enemies){const d=dist2(e.x,e.y,P.x,P.y);if(d<bd){bd=d;best=e;}}
    if(best&&bd>Math.pow(Math.min(vw,vh)/2,2)){
      const a=ang(P.x,P.y,best.x,best.y);
      const rad=Math.min(VW,VH)*0.36;
      const x=VW/2+Math.cos(a)*rad, y=VH/2+Math.sin(a)*rad;
      g.save(); g.translate(x,y); g.rotate(a);
      g.globalAlpha=.75; g.fillStyle='#ff8a5c';
      g.beginPath(); g.moveTo(12,0); g.lineTo(-7,6); g.lineTo(-7,-6); g.closePath(); g.fill();
      g.restore();
    }
  }
}
function rr(g,x,y,w,h,r){ g.beginPath(); g.moveTo(x+r,y);
  g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); }
function shade(hex,amt){ const n=parseInt(hex.slice(1),16);
  const r=clamp((n>>16)+amt,0,255),gg=clamp(((n>>8)&255)+amt,0,255),b=clamp((n&255)+amt,0,255);
  return '#'+((1<<24)+(r<<16)+(gg<<8)+b).toString(16).slice(1); }

/* ---------- 플레이어 ---------- */
function drawPlayer(g){
  const bob=Math.sin(P.walk)*1.8;
  g.save();
  g.translate(P.x,P.y+bob);
  if(P.dodgeT>0)g.rotate(P.dodgeAng+(1-P.dodgeT/.3)*TAU);
  else g.rotate(P.face+Math.PI/2);

  const flash=P.hurtFlash>0;
  const bodyIt=HG.byId[SAVE.eq.body], hatIt=HG.byId[SAVE.eq.hat], cloakIt=HG.byId[SAVE.eq.cloak];
  const bodyTint=bodyIt?HG.RARITY[bodyIt.rar].col:null;
  let fur1=flash?'#ffffff':'#f2d9ae', fur2=flash?'#ffeeee':'#e0c08a';
  if(P.inv>0&&P.dodgeT<=0)g.globalAlpha=0.55+0.45*Math.sin(runTime*40);

  // 꼬리
  g.strokeStyle=fur2; g.lineWidth=5; g.lineCap='round';
  g.beginPath(); g.moveTo(0,15);
  g.quadraticCurveTo(Math.sin(P.walk*.6)*9,25,Math.sin(P.walk*.6)*13,30); g.stroke();
  // 발
  const fw=Math.sin(P.walk)*4;
  const bootIt=HG.byId[SAVE.eq.boot];
  g.fillStyle=bootIt?HG.RARITY[bootIt.rar].col:'#e8b98a';
  g.beginPath(); g.ellipse(-10,10+fw,5,4,0,0,TAU); g.fill();
  g.beginPath(); g.ellipse(10,10-fw,5,4,0,0,TAU); g.fill();
  // 몸
  const bg=g.createRadialGradient(-5,-8,2,0,0,22);
  bg.addColorStop(0,flash?'#fff':'#fbe9c8'); bg.addColorStop(1,fur1);
  g.fillStyle=bg; g.beginPath(); g.ellipse(0,0,16,18,0,0,TAU); g.fill();
  g.strokeStyle=flash?'#fff':'#c9a173'; g.lineWidth=1.6; g.stroke();
  // 갑옷
  if(bodyIt){
    g.save(); g.globalAlpha=.85; g.fillStyle=bodyTint;
    const bi=bodyIt.idx%10;
    if(bi>=7){ g.beginPath(); g.ellipse(0,2,14,15,0,0,TAU); g.fill();
      g.strokeStyle='#00000055'; g.lineWidth=1.4; g.stroke(); }
    else { g.beginPath(); g.ellipse(0,4,11,12,0,0,TAU); g.fill(); }
    if(bi>=4){ g.fillStyle='#ffffff33';
      for(let i=-1;i<=1;i++){g.fillRect(i*7-1.5,-6,3,16);} }
    g.restore();
  }else{
    g.fillStyle=flash?'#ffecec':'#d8b282';
    g.beginPath(); g.ellipse(0,4,10,11,0,0,TAU); g.fill();
  }
  // 망토
  if(cloakIt){
    const ci=cloakIt.idx%10;
    g.save(); g.globalAlpha=.9; g.fillStyle=HG.RARITY[cloakIt.rar].col;
    const sway=Math.sin(runTime*7)*5;
    g.beginPath(); g.moveTo(-13,-4);
    g.quadraticCurveTo(sway, 26+(ci>=8?12:0), 13,-4); g.closePath(); g.fill();
    if(ci>=8){ g.globalAlpha=.5; g.fillStyle='#ffffff';
      for(let i=0;i<4;i++){g.beginPath();g.arc(-8+i*5.3,14+Math.sin(runTime*6+i)*3,1.6,0,TAU);g.fill();} }
    g.restore();
  }
  // 스카프
  g.fillStyle='#d9452f';
  g.beginPath(); g.ellipse(0,-5,13,5,0,0,TAU); g.fill();
  // 귀
  g.fillStyle=fur2;
  g.beginPath(); g.ellipse(-11,-13,6,7,-.4,0,TAU); g.fill();
  g.beginPath(); g.ellipse(11,-13,6,7,.4,0,TAU); g.fill();
  g.fillStyle='#f0a9a0';
  g.beginPath(); g.ellipse(-11,-13,3,3.6,-.4,0,TAU); g.fill();
  g.beginPath(); g.ellipse(11,-13,3,3.6,.4,0,TAU); g.fill();
  // 머리
  const hg2=g.createRadialGradient(-3,-20,1,0,-16,14);
  hg2.addColorStop(0,flash?'#fff':'#fdf0d6'); hg2.addColorStop(1,fur1);
  g.fillStyle=hg2; g.beginPath(); g.ellipse(0,-15,13,12,0,0,TAU); g.fill();
  g.fillStyle=flash?'#fff':'#f8e2bb';
  g.beginPath(); g.ellipse(-10,-12,5.5,5,0,0,TAU); g.fill();
  g.beginPath(); g.ellipse(10,-12,5.5,5,0,0,TAU); g.fill();
  g.fillStyle='#2b1a10';
  g.beginPath(); g.ellipse(-4.6,-19,2.5,3,0,0,TAU); g.fill();
  g.beginPath(); g.ellipse(4.6,-19,2.5,3,0,0,TAU); g.fill();
  g.fillStyle='#fff';
  g.beginPath(); g.arc(-5.4,-20.2,.95,0,TAU); g.fill();
  g.beginPath(); g.arc(3.8,-20.2,.95,0,TAU); g.fill();
  g.fillStyle='#e07a6a';
  g.beginPath(); g.ellipse(0,-23.5,2,1.5,0,0,TAU); g.fill();
  // 장갑
  const gloveIt=HG.byId[SAVE.eq.glove];
  // 모자
  drawHat(g,hatIt);
  // 총
  const kick=P.kick*0.5;
  g.save(); g.translate(0,-26-kick);
  drawGun(g,WST.arch,WEP?HG.RARITY[WEP.rar].col:'#45342a');
  g.restore();
  // 손
  g.fillStyle=gloveIt?HG.RARITY[gloveIt.rar].col:'#e8b98a';
  g.beginPath(); g.ellipse(-5,-22,3.6,3.2,0,0,TAU); g.fill();
  g.beginPath(); g.ellipse(5,-22,3.6,3.2,0,0,TAU); g.fill();
  g.restore();

  // 보호막
  if(P.sh>0){
    g.save(); g.globalAlpha=.35+0.2*Math.sin(runTime*6);
    g.strokeStyle='#9fe8ff'; g.lineWidth=2.6;
    g.beginPath(); g.arc(P.x,P.y,26,0,TAU); g.stroke();
    g.globalAlpha=.12; g.fillStyle='#9fe8ff'; g.fill(); g.restore();
  }
  if(P.dodgeT>0){
    g.save(); g.globalAlpha=.25; g.fillStyle='#9fe8ff';
    g.beginPath(); g.arc(P.x,P.y,20+(1-P.dodgeT/.3)*10,0,TAU); g.fill(); g.restore();
  }
  if(!touchMode){
    g.save(); g.globalAlpha=.2; g.strokeStyle='#fff3d0'; g.lineWidth=1.6; g.setLineDash([7,9]);
    g.beginPath(); g.moveTo(P.x+Math.cos(P.aim)*26,P.y+Math.sin(P.aim)*26);
    g.lineTo(P.x+Math.cos(P.aim)*330,P.y+Math.sin(P.aim)*330); g.stroke(); g.restore();
  }
}
function drawHat(g,it){
  if(!it){
    g.fillStyle='#6b4423'; g.beginPath(); g.ellipse(0,-17,17,8,0,0,TAU); g.fill();
    g.fillStyle='#7d5129'; g.beginPath(); g.ellipse(0,-22,9.5,7.5,0,0,TAU); g.fill();
    g.fillStyle='#4a2d14'; g.beginPath(); g.ellipse(0,-18.5,10,3,0,0,TAU); g.fill();
    return;
  }
  const i=it.idx%10, col=HG.RARITY[it.rar].col;
  const dark=shade(col,-40);
  if(i===0){ g.fillStyle='#e0c475'; g.beginPath(); g.ellipse(0,-17,18,8,0,0,TAU); g.fill();
    g.fillStyle='#cdae5c'; g.beginPath(); g.ellipse(0,-21,9,6,0,0,TAU); g.fill(); }
  else if(i===1||i===2){ g.fillStyle=dark; g.beginPath(); g.ellipse(0,-17,17,8,0,0,TAU); g.fill();
    g.fillStyle=col; g.beginPath(); g.ellipse(0,-22,9.5,7.5,0,0,TAU); g.fill();
    if(i===2){ g.fillStyle='#ffd45e'; g.beginPath();
      for(let k=0;k<5;k++){const a=-Math.PI/2+k/5*TAU;g.lineTo(Math.cos(a)*4,-18.5+Math.sin(a)*4);}
      g.closePath(); g.fill(); } }
  else if(i===3){ g.fillStyle=dark; g.beginPath(); g.ellipse(0,-17,24,11,0,0,TAU); g.fill();
    g.fillStyle=col; g.beginPath(); g.ellipse(0,-22,11,8,0,0,TAU); g.fill();
    g.fillStyle='#b8352a'; g.beginPath(); g.ellipse(0,-18,12,3,0,0,TAU); g.fill(); }
  else if(i===4){ g.fillStyle=col; g.beginPath(); g.ellipse(0,-19,12,9,0,0,TAU); g.fill();
    g.fillStyle=dark; g.beginPath(); g.moveTo(8,-18); g.quadraticCurveTo(18,-8,12,2); g.lineTo(5,-14); g.closePath(); g.fill(); }
  else if(i===5){ g.fillStyle=dark; g.beginPath(); g.ellipse(0,-18,15,7,0,0,TAU); g.fill();
    g.fillStyle=col; g.fillRect(-8,-33,16,15); g.fillStyle=dark; g.fillRect(-8,-22,16,3); }
  else if(i===6){ g.fillStyle=col; g.beginPath(); g.arc(0,-19,12,Math.PI,0); g.fill();
    g.fillStyle=dark; g.fillRect(-12,-19,24,3); }
  else if(i===7){ g.fillStyle=col; g.beginPath(); g.ellipse(0,-18,12,10,0,0,TAU); g.fill();
    g.fillStyle='#1a0d06'; g.beginPath(); g.ellipse(-5,-19,3,2.4,0,0,TAU); g.fill();
    g.beginPath(); g.ellipse(5,-19,3,2.4,0,0,TAU); g.fill(); }
  else if(i===8){ g.fillStyle='#ffd45e'; g.beginPath();
    g.moveTo(-11,-17); g.lineTo(-11,-26); g.lineTo(-5.5,-21); g.lineTo(0,-29);
    g.lineTo(5.5,-21); g.lineTo(11,-26); g.lineTo(11,-17); g.closePath(); g.fill();
    g.fillStyle=col; g.beginPath(); g.arc(0,-25,2.4,0,TAU); g.fill(); }
  else { g.fillStyle=col; g.beginPath(); g.ellipse(0,-19,13,11,0,0,TAU); g.fill();
    g.fillStyle=dark;
    g.beginPath(); g.moveTo(-13,-24); g.lineTo(-19,-34); g.lineTo(-6,-27); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(13,-24); g.lineTo(19,-34); g.lineTo(6,-27); g.closePath(); g.fill();
    g.fillStyle='#ff8a5c'; g.beginPath(); g.ellipse(0,-19,5,3,0,0,TAU); g.fill(); }
}
function drawGun(g,arch,col){
  const metal='#3c3c42', wood='#8a6a3a';
  if(arch==='shotgun'){ g.fillStyle='#45342a'; g.fillRect(-4,-15,8,17); g.fillStyle=wood; g.fillRect(-3,0,6,7);
    g.fillStyle=metal; g.fillRect(-4,-17,8,3); }
  else if(arch==='rifle'){ g.fillStyle='#45342a'; g.fillRect(-2.6,-21,5.2,23); g.fillStyle=wood; g.fillRect(-3.4,-1,6.8,8);
    g.fillStyle=metal; g.fillRect(-1.2,-23,2.4,3); }
  else if(arch==='gatling'){ g.fillStyle=metal; g.fillRect(-7,-16,14,18);
    g.fillStyle='#6a6a74'; for(let i=-2;i<=2;i++)g.fillRect(i*2.6-1,-20,2,7);
    g.fillStyle=col; g.fillRect(-7,-4,14,3); }
  else if(arch==='dual'){ g.fillStyle='#45342a'; g.fillRect(-11,-12,5,13); g.fillRect(6,-12,5,13);
    g.fillStyle=wood; g.fillRect(-11,0,5,5); g.fillRect(6,0,5,5); }
  else if(arch==='smg'){ g.fillStyle=metal; g.fillRect(-3,-14,6,15); g.fillRect(-5,-2,10,8);
    g.fillStyle=col; g.fillRect(-2,-16,4,3); }
  else if(arch==='launcher'){ g.fillStyle='#4a5d3a'; g.fillRect(-6,-18,12,20);
    g.fillStyle=metal; g.beginPath(); g.arc(0,-19,6,0,TAU); g.fill();
    g.fillStyle=col; g.beginPath(); g.arc(0,-19,3,0,TAU); g.fill(); }
  else if(arch==='crossbow'){ g.fillStyle=wood; g.fillRect(-2,-16,4,18);
    g.strokeStyle='#5a4030'; g.lineWidth=3;
    g.beginPath(); g.moveTo(-13,-17); g.quadraticCurveTo(0,-11,13,-17); g.stroke();
    g.strokeStyle=col; g.lineWidth=1.4;
    g.beginPath(); g.moveTo(-13,-17); g.lineTo(0,-13); g.lineTo(13,-17); g.stroke(); }
  else if(arch==='railgun'){ g.fillStyle=metal; g.fillRect(-5,-24,10,26);
    g.fillStyle=col; g.fillRect(-7,-20,14,4); g.fillRect(-7,-12,14,4);
    g.fillStyle='#aee8ff'; g.fillRect(-1.5,-26,3,8); }
  else if(arch==='flamer'){ g.fillStyle='#5a4030'; g.fillRect(-4,-16,8,18);
    g.fillStyle='#d9452f'; g.beginPath(); g.arc(-7,2,5,0,TAU); g.fill();
    g.fillStyle='#ff9b4a'; g.beginPath(); g.arc(0,-18,3.4,0,TAU); g.fill(); }
  else if(arch==='tesla'){ g.fillStyle=metal; g.fillRect(-4,-14,8,16);
    g.strokeStyle='#aee8ff'; g.lineWidth=1.6;
    for(let i=0;i<3;i++){ g.beginPath(); g.arc(0,-18,4+i*2.4,0,Math.PI); g.stroke(); }
    g.fillStyle='#aee8ff'; g.beginPath(); g.arc(0,-18,2.4,0,TAU); g.fill(); }
  else if(arch==='sniper'){ g.fillStyle='#2e2a26'; g.fillRect(-2.4,-28,4.8,30);
    g.fillStyle=wood; g.fillRect(-3.6,-2,7.2,10);
    g.fillStyle=metal; g.fillRect(-5,-20,10,4);
    g.fillStyle=col; g.fillRect(-1.4,-30,2.8,4); }
  else { g.fillStyle='#45342a'; g.fillRect(-2.4,-13,4.8,14); g.fillStyle=wood; g.fillRect(-3.2,0,6.4,6);
    g.fillStyle='#6a6a74'; g.beginPath(); g.arc(0,-2,3.4,0,TAU); g.fill();
    g.fillStyle=col; g.fillRect(-1,-15,2,3); }
}
function drawComp(g,c){
  g.save(); g.translate(c.x,c.y); g.rotate(c.aim+Math.PI/2);
  g.fillStyle='#e6d2ae'; g.beginPath(); g.ellipse(0,0,10,11,0,0,TAU); g.fill();
  g.fillStyle='#d4bb92'; g.beginPath(); g.ellipse(-7,-8,4,4.6,-.4,0,TAU); g.fill();
  g.beginPath(); g.ellipse(7,-8,4,4.6,.4,0,TAU); g.fill();
  g.fillStyle='#f3e4c6'; g.beginPath(); g.ellipse(0,-9,8,7.5,0,0,TAU); g.fill();
  g.fillStyle='#2b1a10'; g.beginPath(); g.arc(-3,-11,1.6,0,TAU); g.fill(); g.beginPath(); g.arc(3,-11,1.6,0,TAU); g.fill();
  g.fillStyle='#5b7fa8'; g.beginPath(); g.ellipse(0,-13,9,4,0,0,TAU); g.fill();
  g.fillStyle='#3a2a20'; g.fillRect(-1.6,-22,3.2,9);
  g.restore();
}
function drawEnemy(g,e){
  const T=HG.ETYPE[e.type], M=HG.EMOD[e.mod]||HG.EMOD[0];
  g.save(); g.translate(e.x,e.y); g.scale(e.scale,e.scale); g.rotate(e.a+Math.PI/2);
  if(M.aura){ g.save(); g.globalAlpha=.28+0.12*Math.sin(runTime*6+e.t);
    g.fillStyle=M.aura; g.beginPath(); g.arc(0,0,e.r+9,0,TAU); g.fill(); g.restore(); }
  if(e.burnT>0){ g.save(); g.globalAlpha=.3; g.fillStyle='#ff7a3a';
    g.beginPath(); g.arc(0,0,e.r+5,0,TAU); g.fill(); g.restore(); }
  if(e.slowT>0){ g.save(); g.globalAlpha=.28; g.fillStyle='#7fd4ff';
    g.beginPath(); g.arc(0,0,e.r+5,0,TAU); g.fill(); g.restore(); }
  const f=e.flash>0;
  const base=M.col&&e.mod!==0?M.col:T.col;
  const col=f?'#fff':base, dark=f?'#fff':shade(base,-28);

  if(e.type==='rat'||e.type==='ghost'){
    if(e.type==='ghost')g.globalAlpha=.75;
    const bob=Math.sin(e.walk)*2;
    g.strokeStyle=dark; g.lineWidth=3; g.lineCap='round';
    g.beginPath(); g.moveTo(0,14); g.quadraticCurveTo(Math.sin(e.walk)*8,24,Math.sin(e.walk)*12,30); g.stroke();
    g.fillStyle=col; g.beginPath(); g.ellipse(0,bob*.3,13,15,0,0,TAU); g.fill();
    g.fillStyle=dark; g.beginPath(); g.ellipse(-9,-11,5,6,-.4,0,TAU); g.fill();
    g.beginPath(); g.ellipse(9,-11,5,6,.4,0,TAU); g.fill();
    g.fillStyle=col; g.beginPath(); g.ellipse(0,-13,11,10,0,0,TAU); g.fill();
    if(e.type==='rat'){
      g.fillStyle='#8d2f24'; g.beginPath(); g.ellipse(0,-17,11,5,0,0,TAU); g.fill();
      g.fillStyle='#d33'; g.beginPath(); g.ellipse(-3.8,-17,2,2.2,0,0,TAU); g.fill();
      g.beginPath(); g.ellipse(3.8,-17,2,2.2,0,0,TAU); g.fill();
    }else{
      g.fillStyle='#dff0ff'; g.beginPath(); g.ellipse(-4,-16,2.4,3,0,0,TAU); g.fill();
      g.beginPath(); g.ellipse(4,-16,2.4,3,0,0,TAU); g.fill();
    }
    g.fillStyle='#e07a6a'; g.beginPath(); g.ellipse(0,-21,1.8,1.4,0,0,TAU); g.fill();
  }
  else if(e.type==='snake'){
    g.fillStyle=col;
    for(let i=6;i>=0;i--){ const a=e.walk-i*.5,r=12-i*1.4;
      g.beginPath(); g.ellipse(Math.sin(a)*5,6+i*5,Math.max(2,r*.8),Math.max(2,r*.7),0,0,TAU); g.fill(); }
    g.fillStyle=f?'#fff':shade(base,16);
    g.beginPath(); g.ellipse(0,-4,10,9,0,0,TAU); g.fill();
    g.fillStyle='#2b1a10'; g.beginPath(); g.arc(-3.4,-7,1.8,0,TAU); g.fill();
    g.beginPath(); g.arc(3.4,-7,1.8,0,TAU); g.fill();
    g.strokeStyle='#d33'; g.lineWidth=1.6;
    g.beginPath(); g.moveTo(0,-12); g.lineTo(-2.6,-18); g.moveTo(0,-12); g.lineTo(2.6,-18); g.stroke();
  }
  else if(e.type==='coyote'){
    const tel=e.st==='tele';
    if(tel){g.save();g.globalAlpha=.3+Math.sin(runTime*30)*.2;g.fillStyle='#ffd45e';
      g.beginPath();g.arc(0,0,e.r+12,0,TAU);g.fill();g.restore();}
    g.strokeStyle=dark; g.lineWidth=4;
    g.beginPath(); g.moveTo(0,15); g.quadraticCurveTo(Math.sin(e.walk)*10,25,Math.sin(e.walk)*16,24); g.stroke();
    const leg=Math.sin(e.walk*1.6)*5;
    g.strokeStyle=dark; g.lineWidth=3.4;
    g.beginPath(); g.moveTo(-7,8); g.lineTo(-9,17+leg); g.stroke();
    g.beginPath(); g.moveTo(7,8); g.lineTo(9,17-leg); g.stroke();
    g.fillStyle=col; g.beginPath(); g.ellipse(0,2,12,16,0,0,TAU); g.fill();
    g.fillStyle=col; g.beginPath(); g.ellipse(0,-14,10,9,0,0,TAU); g.fill();
    g.fillStyle=dark;
    g.beginPath(); g.moveTo(-9,-20); g.lineTo(-4,-27); g.lineTo(-2,-18); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(9,-20); g.lineTo(4,-27); g.lineTo(2,-18); g.closePath(); g.fill();
    g.fillStyle=shade(base,20); g.beginPath(); g.moveTo(0,-14); g.lineTo(-4,-24); g.lineTo(4,-24); g.closePath(); g.fill();
    g.fillStyle='#ffd45e'; g.beginPath(); g.arc(-3.4,-16,1.8,0,TAU); g.fill();
    g.beginPath(); g.arc(3.4,-16,1.8,0,TAU); g.fill();
  }
  else if(e.type==='scorp'){
    const tel=e.st==='tele';
    if(tel){g.save();g.globalAlpha=.35+Math.sin(runTime*34)*.25;g.fillStyle='#ff5a3a';
      g.beginPath();g.arc(0,0,e.r+12,0,TAU);g.fill();g.restore();}
    for(let i=0;i<3;i++){ const a=e.walk+i;
      g.lineWidth=3; g.strokeStyle=dark;
      g.beginPath(); g.moveTo(-11,-4+i*7); g.lineTo(-20,-8+i*7+Math.sin(a)*3); g.stroke();
      g.beginPath(); g.moveTo(11,-4+i*7); g.lineTo(20,-8+i*7-Math.sin(a)*3); g.stroke(); }
    g.strokeStyle=dark; g.lineWidth=6;
    g.beginPath(); g.moveTo(0,14); g.quadraticCurveTo(10,26,2+Math.sin(e.walk*.7)*5,30); g.stroke();
    g.fillStyle='#ffd45e'; g.beginPath(); g.arc(2+Math.sin(e.walk*.7)*5,32,4,0,TAU); g.fill();
    g.fillStyle=col; g.beginPath(); g.ellipse(0,2,16,17,0,0,TAU); g.fill();
    g.fillStyle=shade(base,f?60:-10); g.beginPath(); g.ellipse(0,0,10,12,0,0,TAU); g.fill();
    g.fillStyle=dark;
    g.beginPath(); g.ellipse(-15,-14+Math.sin(e.walk)*2,7,5,-.5,0,TAU); g.fill();
    g.beginPath(); g.ellipse(15,-14-Math.sin(e.walk)*2,7,5,.5,0,TAU); g.fill();
    g.fillStyle='#2b1a10'; g.beginPath(); g.arc(-4,-8,2,0,TAU); g.fill();
    g.beginPath(); g.arc(4,-8,2,0,TAU); g.fill();
  }
  else if(e.type==='vulture'){
    const flap=Math.sin(e.walk)*0.7, tel=e.st==='tele';
    if(tel){g.save();g.globalAlpha=.3+Math.sin(runTime*30)*.2;g.fillStyle='#ffd45e';
      g.beginPath();g.arc(0,0,e.r+14,0,TAU);g.fill();g.restore();}
    g.fillStyle=dark;
    g.save(); g.rotate(flap); g.beginPath(); g.ellipse(-20,0,20,7,0,0,TAU); g.fill(); g.restore();
    g.save(); g.rotate(-flap); g.beginPath(); g.ellipse(20,0,20,7,0,0,TAU); g.fill(); g.restore();
    g.fillStyle=col; g.beginPath(); g.ellipse(0,2,11,15,0,0,TAU); g.fill();
    g.fillStyle=f?'#fff':'#d6cfc0'; g.beginPath(); g.ellipse(0,-12,8,7,0,0,TAU); g.fill();
    g.fillStyle='#e8a33c'; g.beginPath(); g.moveTo(0,-16); g.lineTo(-3,-24); g.lineTo(3,-24); g.closePath(); g.fill();
    g.fillStyle='#2b1a10'; g.beginPath(); g.arc(-3,-14,1.7,0,TAU); g.fill();
    g.beginPath(); g.arc(3,-14,1.7,0,TAU); g.fill();
  }
  else if(e.type==='mole'){
    const aiming=e.st==='aim';
    g.fillStyle=col; g.beginPath(); g.ellipse(0,0,14,16,0,0,TAU); g.fill();
    g.fillStyle=shade(base,f?60:-16); g.beginPath(); g.ellipse(0,3,9,11,0,0,TAU); g.fill();
    g.fillStyle=col; g.beginPath(); g.ellipse(0,-13,11,10,0,0,TAU); g.fill();
    g.fillStyle='#2b2b33'; g.fillRect(-11,-17,22,6);
    g.fillStyle=aiming?'#ff6a4a':'#8fd6ff';
    g.beginPath(); g.arc(-5,-14,3,0,TAU); g.fill(); g.beginPath(); g.arc(5,-14,3,0,TAU); g.fill();
    g.fillStyle='#f0a9a0'; g.beginPath(); g.ellipse(0,-21,3,2.2,0,0,TAU); g.fill();
    g.save(); g.translate(0,-22); g.fillStyle='#3a2a20'; g.fillRect(-2,-12,4,13);
    if(aiming){g.fillStyle='#ffcf7a';g.beginPath();g.arc(0,-13,3+Math.sin(runTime*40)*1.4,0,TAU);g.fill();}
    g.restore();
  }
  else if(e.type==='bomber'){
    const puf=1+Math.sin(e.walk)*0.08;
    g.save(); g.scale(puf,2-puf);
    g.fillStyle=col; g.beginPath(); g.ellipse(0,0,18,16,0,0,TAU); g.fill();
    g.fillStyle=shade(base,-24);
    for(let i=0;i<5;i++){const a=i/5*TAU+e.t;
      g.beginPath();g.arc(Math.cos(a)*9,Math.sin(a)*7,3.2,0,TAU);g.fill();}
    g.restore();
    g.fillStyle='#ffe066'; g.beginPath(); g.ellipse(-6,-8,4,4.6,0,0,TAU); g.fill();
    g.beginPath(); g.ellipse(6,-8,4,4.6,0,0,TAU); g.fill();
    g.fillStyle='#1a0d06'; g.beginPath(); g.arc(-6,-8,2,0,TAU); g.fill();
    g.beginPath(); g.arc(6,-8,2,0,TAU); g.fill();
    g.fillStyle='#d9452f'; g.beginPath(); g.arc(0,-19,4.4,0,TAU); g.fill();
    g.strokeStyle='#ffb04a'; g.lineWidth=2;
    g.beginPath(); g.moveTo(0,-23); g.lineTo(Math.sin(runTime*20)*3,-29); g.stroke();
  }
  else if(e.type==='turretB'){
    g.fillStyle='#3f7a46';
    rr(g,-10,-46,20,52,10); g.fill();
    g.fillStyle='#356b3c'; rr(g,-5,-44,6,48,3); g.fill();
    g.fillStyle='#3f7a46';
    rr(g,-26,-34,16,10,6); g.fill(); rr(g,10,-28,16,10,6); g.fill();
    g.strokeStyle='#dfe8c8'; g.lineWidth=1;
    for(let i=0;i<14;i++){const y=-44+i*3.4;
      g.beginPath();g.moveTo(-8,y);g.lineTo(-12,y-2);g.stroke();
      g.beginPath();g.moveTo(8,y);g.lineTo(12,y-2);g.stroke();}
    const aiming=e.st==='aim';
    g.fillStyle=aiming?'#ff6a4a':'#2b1a10';
    g.beginPath(); g.arc(-4,-40,2.6,0,TAU); g.fill();
    g.beginPath(); g.arc(4,-40,2.6,0,TAU); g.fill();
    g.fillStyle='#5a4030'; g.fillRect(-3,-56,6,12);
    if(aiming){g.fillStyle='#ffcf7a';g.beginPath();g.arc(0,-57,3.4,0,TAU);g.fill();}
  }
  else if(e.type==='boss'){
    const tel=e.st==='tele';
    if(tel){g.save();g.globalAlpha=.3+Math.sin(runTime*26)*.22;g.fillStyle='#ff6a2a';
      g.beginPath();g.arc(0,0,e.r+22,0,TAU);g.fill();g.restore();}
    g.strokeStyle=dark; g.lineWidth=11; g.lineCap='round';
    g.beginPath(); g.moveTo(0,36); g.quadraticCurveTo(Math.sin(e.walk)*34,56,Math.sin(e.walk)*46,42); g.stroke();
    g.fillStyle='#5a1f2a';
    g.beginPath(); g.moveTo(-30,-8); g.quadraticCurveTo(0,52+Math.sin(e.walk)*6,30,-8); g.closePath(); g.fill();
    const bgg=g.createRadialGradient(-10,-14,4,0,0,52);
    bgg.addColorStop(0,f?'#fff':shade(base,22)); bgg.addColorStop(1,col);
    g.fillStyle=bgg; g.beginPath(); g.ellipse(0,0,36,40,0,0,TAU); g.fill();
    g.strokeStyle=dark; g.lineWidth=2.5; g.stroke();
    g.fillStyle=f?'#fff':'#f3e3c4'; g.beginPath(); g.ellipse(0,8,20,22,0,0,TAU); g.fill();
    g.fillStyle=col; g.beginPath(); g.ellipse(0,-34,28,25,0,0,TAU); g.fill();
    g.fillStyle=col;
    g.beginPath(); g.moveTo(-24,-46); g.lineTo(-13,-60); g.lineTo(-7,-44); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(24,-46); g.lineTo(13,-60); g.lineTo(7,-44); g.closePath(); g.fill();
    g.fillStyle='#f0a9a0';
    g.beginPath(); g.moveTo(-20,-47); g.lineTo(-14,-55); g.lineTo(-11,-46); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(20,-47); g.lineTo(14,-55); g.lineTo(11,-46); g.closePath(); g.fill();
    g.fillStyle='#ffe066'; g.beginPath(); g.ellipse(-10,-38,7,8,0,0,TAU); g.fill();
    g.beginPath(); g.ellipse(10,-38,7,8,0,0,TAU); g.fill();
    g.fillStyle='#1a0d06';
    g.beginPath(); g.ellipse(-10,-38,2.4,7,0,0,TAU); g.fill();
    g.beginPath(); g.ellipse(10,-38,2.4,7,0,0,TAU); g.fill();
    g.fillStyle='#e07a6a'; g.beginPath(); g.moveTo(0,-30); g.lineTo(-4,-26); g.lineTo(4,-26); g.closePath(); g.fill();
    g.strokeStyle='#fff8e8'; g.lineWidth=1.4;
    for(let i=-1;i<=1;i++){ g.beginPath(); g.moveTo(-6,-27+i*3); g.lineTo(-26,-31+i*5); g.stroke();
      g.beginPath(); g.moveTo(6,-27+i*3); g.lineTo(26,-31+i*5); g.stroke(); }
    g.fillStyle='#6b4423'; g.beginPath(); g.ellipse(0,-44,40,15,0,0,TAU); g.fill();
    g.fillStyle='#7d5129'; g.beginPath(); g.ellipse(0,-54,20,14,0,0,TAU); g.fill();
    g.fillStyle='#b8352a'; g.beginPath(); g.ellipse(0,-47,21,5,0,0,TAU); g.fill();
    g.save(); g.translate(-30,-12); g.rotate(-.3); g.fillStyle='#3a2a20'; g.fillRect(-3,-16,6,18); g.restore();
    g.save(); g.translate(30,-12); g.rotate(.3); g.fillStyle='#3a2a20'; g.fillRect(-3,-16,6,18); g.restore();
  }
  g.restore();

  // 이름표(변종) + 체력바
  if(e.type!=='boss'){
    if(e.mod!==0){
      ctx.save(); ctx.font='11px Jua, sans-serif'; ctx.textAlign='center';
      ctx.fillStyle=M.aura||'#fff'; ctx.strokeStyle='#2b1a10'; ctx.lineWidth=3;
      ctx.strokeText(M.n+T.name,e.x,e.y-e.r-20); ctx.fillText(M.n+T.name,e.x,e.y-e.r-20);
      ctx.restore();
    }
    if(e.hp<e.maxHp){
      const w=e.r*2.1,x=e.x-w/2,y=e.y-e.r-12;
      g.fillStyle='#1b100aaa'; g.fillRect(x-1,y-1,w+2,6);
      const fr=clamp(e.hp/e.maxHp,0,1);
      g.fillStyle=fr>.5?'#8fd96a':fr>.25?'#ffd45e':'#e4572e';
      g.fillRect(x,y,w*fr,4);
    }
  }
}
function drawProp(g,p,B){
  g.save(); g.translate(p.x,p.y); g.scale(p.s,p.s);
  // 바닥 그림자
  g.save(); g.globalAlpha=.22; g.fillStyle='#000';
  g.beginPath(); g.ellipse(0,p.r*.4,p.r*1.1,p.r*.45,0,0,TAU); g.fill(); g.restore();
  if(p.type==='cactus'){
    g.fillStyle='#3f7a46'; rr(g,-9,-52,18,56,9); g.fill();
    g.fillStyle='#356b3c'; rr(g,-4,-50,5,52,3); g.fill();
    g.fillStyle='#3f7a46'; rr(g,-26,-38,15,10,6); g.fill(); rr(g,-26,-38,9,24,5); g.fill();
    rr(g,13,-30,14,10,6); g.fill(); rr(g,19,-30,9,20,5); g.fill();
    g.strokeStyle='#dfe8c8'; g.lineWidth=1;
    for(let i=0;i<16;i++){const y=-50+i*3.4;
      g.beginPath();g.moveTo(-7,y);g.lineTo(-11,y-2);g.stroke();
      g.beginPath();g.moveTo(7,y);g.lineTo(11,y-2);g.stroke();}
    g.fillStyle='#ff6f9c'; g.beginPath(); g.arc(0,-54,4,0,TAU); g.fill();
  }
  else if(p.type==='rock'){
    g.save(); g.rotate(p.rot);
    g.fillStyle='#9a9387'; g.beginPath();
    g.moveTo(-26,8);g.lineTo(-18,-16);g.lineTo(2,-24);g.lineTo(22,-12);g.lineTo(26,8);g.closePath();g.fill();
    g.fillStyle='#b4ada0'; g.beginPath();
    g.moveTo(-18,-16);g.lineTo(2,-24);g.lineTo(6,-8);g.lineTo(-10,-4);g.closePath();g.fill();
    g.strokeStyle='#6f685d'; g.lineWidth=2; g.beginPath();
    g.moveTo(-26,8);g.lineTo(-18,-16);g.lineTo(2,-24);g.lineTo(22,-12);g.lineTo(26,8);g.closePath();g.stroke();
    g.restore();
  }
  else if(p.type==='barrel'){
    g.fillStyle='#6b4423'; rr(g,-17,-34,34,40,7); g.fill();
    g.fillStyle='#86552b'; rr(g,-13,-32,26,36,5); g.fill();
    g.fillStyle='#4a2d14'; g.fillRect(-17,-26,34,5); g.fillRect(-17,-8,34,5);
    g.fillStyle='#caa05e'; g.beginPath(); g.ellipse(0,-34,17,6,0,0,TAU); g.fill();
    g.fillStyle='#d9452f'; g.font='11px Jua, sans-serif'; g.textAlign='center'; g.fillText('TNT',0,-15);
    if(p.hp<34){ g.strokeStyle='#2b1a10'; g.lineWidth=1.6;
      g.beginPath(); g.moveTo(-8,-28); g.lineTo(-2,-18); g.lineTo(-9,-10); g.stroke(); }
  }
  else if(p.type==='skull'){
    g.save(); g.rotate(p.rot);
    g.fillStyle='#e8e2d2'; g.beginPath(); g.ellipse(0,0,13,11,0,0,TAU); g.fill();
    g.fillStyle='#d6cfbd'; g.beginPath(); g.ellipse(0,7,7,6,0,0,TAU); g.fill();
    g.fillStyle='#8d8676'; g.beginPath(); g.arc(-5,-2,3.4,0,TAU); g.fill();
    g.beginPath(); g.arc(5,-2,3.4,0,TAU); g.fill();
    g.strokeStyle='#e8e2d2'; g.lineWidth=5; g.lineCap='round';
    g.beginPath(); g.moveTo(-11,-5); g.quadraticCurveTo(-24,-12,-20,-20); g.stroke();
    g.beginPath(); g.moveTo(11,-5); g.quadraticCurveTo(24,-12,20,-20); g.stroke();
    g.restore();
  }
  else if(p.type==='wagon'){
    g.fillStyle='#5a3a24'; rr(g,-38,-20,76,30,5); g.fill();
    g.fillStyle='#e8dcc0'; g.beginPath(); g.ellipse(0,-22,34,24,0,Math.PI,0); g.fill();
    g.strokeStyle='#c6b795'; g.lineWidth=2;
    for(let i=-2;i<=2;i++){g.beginPath();g.ellipse(i*11,-22,2,24,0,Math.PI,0);g.stroke();}
    g.fillStyle='#3a2418';
    for(const wx of [-26,26]){ g.beginPath(); g.arc(wx,12,12,0,TAU); g.fill();
      g.strokeStyle='#8a6a3a'; g.lineWidth=2;
      for(let i=0;i<6;i++){const a=i/6*Math.PI;g.beginPath();
        g.moveTo(wx+Math.cos(a)*11,12+Math.sin(a)*11);g.lineTo(wx-Math.cos(a)*11,12-Math.sin(a)*11);g.stroke();} }
  }
  else if(p.type==='tree'){
    g.fillStyle='#4a3524'; g.beginPath(); g.moveTo(-5,6); g.lineTo(-3,-30); g.lineTo(3,-30); g.lineTo(5,6); g.closePath(); g.fill();
    g.strokeStyle='#4a3524'; g.lineWidth=4; g.lineCap='round';
    g.beginPath(); g.moveTo(-1,-22); g.lineTo(-18,-34); g.moveTo(1,-26); g.lineTo(16,-40);
    g.moveTo(0,-30); g.lineTo(-8,-44); g.stroke();
    g.lineWidth=2.4;
    g.beginPath(); g.moveTo(-18,-34); g.lineTo(-26,-30); g.moveTo(16,-40); g.lineTo(24,-44); g.stroke();
  }
  else if(p.type==='crystal'){
    g.save(); g.rotate(p.rot*0.2);
    const cg=g.createLinearGradient(-12,-34,12,6);
    cg.addColorStop(0,'#eaffff'); cg.addColorStop(.6,'#8fd6ff'); cg.addColorStop(1,'#4a6fd4');
    g.fillStyle=cg;
    g.beginPath(); g.moveTo(0,-36); g.lineTo(11,-10); g.lineTo(5,6); g.lineTo(-7,6); g.lineTo(-12,-12); g.closePath(); g.fill();
    g.strokeStyle='#ffffff99'; g.lineWidth=1.4; g.stroke();
    g.globalAlpha=.35; g.fillStyle='#fff';
    g.beginPath(); g.moveTo(0,-36); g.lineTo(4,-12); g.lineTo(-2,0); g.closePath(); g.fill();
    g.restore();
  }
  g.restore();
}

/* ================= HUD ================= */
function el(id){ return document.getElementById(id); }
function hudHp(){
  const f=el('hpFill'); if(!f)return;
  f.style.width=(clamp(P.hp/P.maxHp,0,1)*100)+'%';
  const t=el('hpTxt'); if(t)t.textContent=Math.ceil(P.hp)+' / '+Math.round(P.maxHp)+(P.sh>0?('  🛡'+Math.ceil(P.sh)):'');
  const c=el('coinNum'); if(c)c.textContent=fmt(coins);
}
function hudGem(){ const g=el('gemNum'); if(g)g.textContent=fmt(gems); }
let lastGunName='';
function hudAmmo(force){
  const gn=el('gname'); if(!gn)return;
  if(force||lastGunName!==WST.name){
    lastGunName=WST.name;
    gn.textContent=WST.name;
    gn.style.color=HG.RARITY[WST.rar].col;
    const d=el('ammoDots'); d.innerHTML='';
    for(let i=0;i<Math.min(WST.mag,34);i++){const s=document.createElement('div');s.className='dot';d.appendChild(s);}
  }
  const dots=el('ammoDots').children, shown=Math.min(WST.mag,34);
  const on=Math.round(P.ammo/WST.mag*shown);
  for(let i=0;i<dots.length;i++)dots[i].className='dot'+(i<on?' on':'');
  const an=el('ammoNum'); if(an)an.textContent=P.ammo+' / '+WST.mag+(WST.mag>34?' (요약)':'');
}
function hudCombo(){
  const c=el('combo');
  if(c){ if(combo>=3){c.style.opacity='1';c.querySelector('.cn').textContent=combo+'연속';} else c.style.opacity='0'; }
  const du=el('dodgeUI');
  if(du){ if(P.dodgeCd<=0){du.classList.add('ready');el('dodgeTxt').textContent='회피';}
    else {du.classList.remove('ready');el('dodgeTxt').textContent=P.dodgeCd.toFixed(1)+'초';} }
  const bn=el('biomeName'); if(bn)bn.textContent=biome().n;
}
function banner(a,b){
  const e2=el('waveBanner'); if(!e2)return;
  e2.querySelector('.wb1').textContent=a;
  e2.querySelector('.wb2').textContent=b;
  e2.style.opacity='1'; e2.style.transform='translate(-50%,-50%) scale(1)';
  bannerT=2.1;
}

/* ================= 로비 ================= */
const ov=()=>el('ov'), ovc=()=>el('ovCard');
function showOv(on){ const o=ov(); if(o)o.classList[on?'add':'remove']('on'); }

function rarChip(r){ const R=HG.RARITY[r]; return '<span class="chip" style="color:'+R.col+';border-color:'+R.col+'66">'+R.n+'</span>'; }
function itemCard(it,extra,cls){
  const R=HG.RARITY[it.rar];
  let body='';
  if(it.kind==='weapon'){
    const s=it.st;
    body='<div class="ist">피해 '+s.dmg+' · 연사 '+(1/s.rof).toFixed(1)+'/초 · 장탄 '+s.mag+
      (s.pierce?' · 관통 '+s.pierce:'')+(s.pellets>1?' · '+s.pellets+'발':'')+'</div>'+
      (it.affs.length?'<div class="iaf">'+it.affs.map(a=>'<b>'+a.n+'</b> '+a.t).join('<br>')+'</div>':'');
  }else if(it.kind==='armor'){
    body='<div class="iaf">'+Object.keys(it.st).map(k=>'<b>'+HG.ASTAT[k].n+'</b> '+HG.ASTAT[k].fmt(it.st[k])).join('<br>')+'</div>';
  }
  return '<div class="item '+(cls||'')+'" style="border-color:'+R.col+'77;box-shadow:0 0 14px '+R.glow+'" data-id="'+it.id+'">'+
    '<div class="ih"><span class="inm" style="color:'+R.col+'">'+esc(it.name)+'</span>'+rarChip(it.rar)+'</div>'+
    (it.kind==='weapon'?'<div class="itag">'+it.tag+' · 전투력 '+it.power+'</div>':'<div class="itag">전투력 '+it.power+'</div>')+
    body+(extra||'')+'</div>';
}
function statLine(){
  computeStats();
  const s=PS;
  return '<div class="sgrid">'+
   [['체력',Math.round(s.maxHp)],['공격력','×'+s.dmg.toFixed(2)],['이동',Math.round(s.spd)],
    ['치명타',(s.crit*100).toFixed(1)+'%'],['치명피해','×'+s.cdmg.toFixed(2)],['피해감소',(s.dr*100).toFixed(1)+'%'],
    ['재장전','×'+s.rel.toFixed(2)],['연사','×'+s.rof.toFixed(2)],['장탄','×'+s.mag.toFixed(2)],
    ['코인','×'+s.coin.toFixed(2)],['다이아','×'+s.dia.toFixed(2)],['보호막',Math.round(s.shield)]]
   .map(x=>'<div class="sc"><div class="sv">'+x[1]+'</div><div class="sl">'+x[0]+'</div></div>').join('')+
   '</div>';
}
function openLobby(tab){
  state='lobby'; lobbyTab=tab||lobbyTab;
  computeStats();
  const c=ovc();
  const tabs=[['out','출격','🤠'],['job','직업','🎖️'],['weapon','무기','🔫'],['armor','방어구','🛡️'],['perm','강화','💎'],['box','상자','📦']];
  let h='<div class="lobHead"><div class="ltitle">총잡이 햄스터</div>'+
    '<div class="lcur">💎 <b id="diaCur">'+fmt(SAVE.dia)+'</b></div></div>'+
    '<div class="tabs">'+tabs.map(t=>'<button class="tb'+(lobbyTab===t[0]?' on':'')+'" data-tab="'+t[0]+'">'+t[2]+' '+t[1]+'</button>').join('')+'</div>';

  if(lobbyTab==='out'){
    const eqList=HG.SLOTS.map(S=>{
      const it=HG.byId[SAVE.eq[S.id]];
      return '<div class="eqrow" data-goto="armor" data-slot="'+S.id+'"><span class="eqe">'+S.e+'</span>'+
        '<span class="eqn">'+S.n+'</span><span class="eqv" style="color:'+(it?HG.RARITY[it.rar].col:'#7d6a52')+'">'+
        (it?esc(it.name):'(비어 있음)')+'</span></div>';
    }).join('');
    h+='<div class="outWrap">'+
      '<div class="jobBig"><div class="je">'+JOB.e+'</div><div><div class="jn">'+esc(JOB.name)+'</div>'+
      '<div class="jd">'+esc(JOB.desc)+'</div>'+
      '<div class="jp">패시브 · <b>'+HG.PASSIVE[JOB.p].n+'</b> — '+HG.PASSIVE[JOB.p].d(JOB.pv)+'</div></div></div>'+
      '<div class="eqrow eqw" data-goto="weapon"><span class="eqe">🔫</span><span class="eqn">무기</span>'+
      '<span class="eqv" style="color:'+HG.RARITY[WEP.rar].col+'">'+esc(WEP.name)+'</span></div>'+
      eqList+
      statLine()+
      '<button class="btn big" id="goStart">▶ 출격</button>'+
      '<div class="hint">최고 기록 <b>웨이브 '+SAVE.best+'</b> · 누적 처치 '+fmt(SAVE.kills)+' · 누적 다이아 '+fmt(SAVE.diaAll)+
      '<br>보유 아이템 '+Object.keys(SAVE.own).length+' / 650</div>'+
      '<div class="hint small">PC: WASD 이동 · 마우스 조준/사격 · Shift 회피 · R 재장전<br>모바일: 왼쪽 드래그 이동 · 오른쪽 드래그 조준+사격</div>'+
    '</div>';
  }
  else if(lobbyTab==='job'){
    h+='<div class="sub">직업 50종 — 패시브와 시작 무기 계열이 다릅니다. 다이아몬드로 해금.</div><div class="grid jobs">';
    for(const j of HG.JOBS){
      const un=SAVE.jobs[j.id], cur=SAVE.job===j.id;
      const R=HG.RARITY[j.rar];
      h+='<div class="item job'+(cur?' cur':'')+(un?'':' lock')+'" data-job="'+j.id+'" style="border-color:'+R.col+'66">'+
        '<div class="ih"><span class="inm" style="color:'+R.col+'">'+j.e+' '+esc(j.name)+'</span>'+(cur?'<span class="chip on">장착</span>':'')+'</div>'+
        '<div class="itag">시작 무기 '+(HG.WARCH.find(w=>w.id===j.arch)||{n:'?'}).n+'</div>'+
        '<div class="iaf"><b>'+HG.PASSIVE[j.p].n+'</b> '+HG.PASSIVE[j.p].d(j.pv)+'<br>'+
        '체력 ×'+j.hp.toFixed(2)+' · 이동 ×'+j.spd.toFixed(2)+' · 피해 ×'+j.dmg.toFixed(2)+(j.crit?' · 치명 +'+(j.crit*100).toFixed(0)+'%p':'')+'</div>'+
        '<div class="idesc">'+esc(j.desc)+'</div>'+
        (un?'<div class="ip ok">보유</div>':'<div class="ip">💎 '+j.cost+'</div>')+'</div>';
    }
    h+='</div>';
  }
  else if(lobbyTab==='weapon'){
    const own=HG.WEAPONS.filter(w=>ownCount(w.id)>0).sort((a,b)=>b.rar-a.rar||b.power-a.power);
    h+='<div class="sub">보유 무기 '+own.length+' / 100 — 하나를 장착하세요.</div><div class="grid">';
    for(const w of own) h+=itemCard(w,'<div class="ip '+(SAVE.eq.weapon===w.id?'ok':'')+'">'+(SAVE.eq.weapon===w.id?'장착 중':'장착하기')+'</div>','pick');
    h+='</div>';
    if(!own.length)h+='<div class="hint">상자를 열어 무기를 획득하세요.</div>';
  }
  else if(lobbyTab==='armor'){
    h+='<div class="subtabs">'+HG.SLOTS.map(S=>'<button class="stb'+(armorTab===S.id?' on':'')+'" data-slot="'+S.id+'">'+S.e+' '+S.n+'</button>').join('')+'</div>';
    const own=HG.ARMORS.filter(a=>a.slot===armorTab&&ownCount(a.id)>0).sort((a,b)=>b.rar-a.rar||b.power-a.power);
    const cnt=HG.ARMORS.filter(a=>a.slot===armorTab).length;
    h+='<div class="sub">보유 '+own.length+' / '+cnt+'</div><div class="grid">';
    if(SAVE.eq[armorTab])h+='<div class="item unequip" data-unequip="'+armorTab+'"><div class="ih"><span class="inm">✖ 장착 해제</span></div></div>';
    for(const a of own) h+=itemCard(a,'<div class="ip '+(SAVE.eq[a.slot]===a.id?'ok':'')+'">'+(SAVE.eq[a.slot]===a.id?'장착 중':'장착하기')+'</div>','pick');
    h+='</div>';
    if(!own.length)h+='<div class="hint">상자를 열어 방어구를 획득하세요.</div>';
  }
  else if(lobbyTab==='perm'){
    h+='<div class="sub">다이아몬드로 영구 강화 — 모든 출격에 적용됩니다.</div><div class="grid small">';
    for(const u of HG.PERM){
      const lv=permLv(u.k), mx=u.max, cost=HG.permCost(u,lv), full=lv>=mx;
      h+='<div class="item perm'+(full?' no':(SAVE.dia>=cost?' can':' no'))+'" data-perm="'+u.k+'">'+
        '<div class="lv">'+(full?'MAX':'Lv.'+lv+'/'+mx)+'</div>'+
        '<div class="ii">'+u.e+'</div><div class="it">'+u.n+'</div><div class="id">'+u.d+'</div>'+
        '<div class="ip">'+(full?'—':'💎 '+cost)+'</div></div>';
    }
    h+='</div>'+statLine();
  }
  else if(lobbyTab==='box'){
    h+='<div class="sub">상자를 열어 무기·방어구를 획득합니다. 등급 확률은 아래 표시.</div><div class="grid">';
    for(const b of HG.BOXES){
      h+='<div class="item box'+(SAVE.dia>=b.cost?' can':' no')+'" data-box="'+b.id+'">'+
        '<div class="ii big">'+b.e+'</div><div class="it">'+b.n+'</div>'+
        '<div class="id">'+b.cnt+'개 획득</div>'+
        '<div class="iaf">'+b.w.map((x,i)=>'<span style="color:'+HG.RARITY[i].col+'">'+HG.RARITY[i].n+' '+x+'%</span>').join(' · ')+'</div>'+
        '<div class="ip">💎 '+b.cost+'</div></div>';
    }
    h+='</div>';
    const seen=Object.keys(SAVE.seen).length;
    h+='<div class="hint">도감 '+seen+' / 650 수집<br>무기 '+HG.WEAPONS.filter(w=>SAVE.seen[w.id]).length+'/100 · '+
      HG.SLOTS.map(S=>S.n+' '+HG.ARMORS.filter(a=>a.slot===S.id&&SAVE.seen[a.id]).length+'/100').join(' · ')+'</div>';
  }

  c.innerHTML=h;
  c.className='card lobby';
  showOv(true);
  bindLobby();
}
function bindLobby(){
  const c=ovc();
  c.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{SND.init();SND.resume();openLobby(b.dataset.tab);});
  c.querySelectorAll('[data-goto]').forEach(b=>b.onclick=()=>{
    if(b.dataset.slot)armorTab=b.dataset.slot;
    openLobby(b.dataset.goto);});
  c.querySelectorAll('[data-slot]').forEach(b=>{ if(b.classList.contains('stb'))
    b.onclick=()=>{armorTab=b.dataset.slot;openLobby('armor');}; });
  c.querySelectorAll('[data-job]').forEach(b=>b.onclick=()=>{
    const j=HG.byId[b.dataset.job];
    if(!SAVE.jobs[j.id]){
      if(SAVE.dia<j.cost){ SND.noise(.2,.08,300,1); flash(b); return; }
      SAVE.dia-=j.cost; SAVE.jobs[j.id]=1; SND.buy();
    }
    SAVE.job=j.id;
    // 직업에 맞는 보유 무기 자동 추천
    const want=HG.WEAPONS.filter(w=>w.arch===j.arch&&ownCount(w.id)>0).sort((a,b2)=>b2.power-a.power)[0];
    if(want)SAVE.eq.weapon=want.id;
    store(); SND.buy(); openLobby('job');
  });
  c.querySelectorAll('.pick').forEach(b=>b.onclick=()=>{
    const it=HG.byId[b.dataset.id]; if(!it)return;
    if(it.kind==='weapon')SAVE.eq.weapon=it.id; else SAVE.eq[it.slot]=it.id;
    store(); SND.buy(); openLobby(lobbyTab);
  });
  c.querySelectorAll('[data-unequip]').forEach(b=>b.onclick=()=>{
    SAVE.eq[b.dataset.unequip]=null; store(); SND.buy(); openLobby('armor');
  });
  c.querySelectorAll('[data-perm]').forEach(b=>b.onclick=()=>{
    const u=HG.PERM.find(x=>x.k===b.dataset.perm);
    const lv=permLv(u.k); if(lv>=u.max)return;
    const cost=HG.permCost(u,lv);
    if(SAVE.dia<cost){ SND.noise(.2,.08,300,1); flash(b); return; }
    SAVE.dia-=cost; SAVE.perm[u.k]=lv+1; store(); SND.buy(); openLobby('perm');
  });
  c.querySelectorAll('[data-box]').forEach(b=>b.onclick=()=>{
    const box=HG.BOXES.find(x=>x.id===b.dataset.box);
    if(SAVE.dia<box.cost){ SND.noise(.2,.08,300,1); flash(b); return; }
    SAVE.dia-=box.cost;
    const got=[];
    for(let i=0;i<box.cnt;i++){
      const r=HG.rollRarity(box.w,permLv('luck'));
      const it=HG.rollItem(r);
      const isNew=!SAVE.seen[it.id];
      giveItem(it.id); got.push({it,isNew});
    }
    store(); SND.open(); showBoxResult(got);
  });
  const st=el('goStart');
  if(st)st.onclick=()=>{ SND.init(); SND.resume(); showOv(false); state='play'; newRun(); };
}
function flash(b){ b.style.transition='none'; b.style.borderColor='#ff5555';
  setTimeout(()=>{b.style.transition='';b.style.borderColor='';},220); }
function showBoxResult(got){
  const c=ovc();
  let h='<h2>📦 개봉 결과</h2><div class="grid">';
  for(const g of got) h+=itemCard(g.it,g.isNew?'<div class="ip new">NEW!</div>':'<div class="ip">보유 '+ownCount(g.it.id)+'</div>');
  h+='</div><button class="btn" id="bcOk">확인</button>';
  c.innerHTML=h;
  el('bcOk').onclick=()=>openLobby('box');
}

/* ================= 런 중 상점 (코인) ================= */
const RSHOP=[
  {k:'hp',   ic:'❤️',n:'튼튼한 몸',  d:'최대 체력 +24 (즉시 회복)', base:55, step:1.42},
  {k:'dmg',  ic:'💪',n:'화력 강화',  d:'피해량 +14%',              base:70, step:1.48},
  {k:'spd',  ic:'🥾',n:'날랜 발',    d:'이동 속도 +7.5%',          base:55, step:1.44},
  {k:'rel',  ic:'🔄',n:'빠른 손',    d:'재장전 +15%',              base:60, step:1.42},
  {k:'mag',  ic:'📦',n:'큰 탄창',    d:'장탄수 +28%',              base:60, step:1.44},
  {k:'crit', ic:'🎯',n:'명사수',     d:'치명타 +5.5%p',            base:80, step:1.50},
  {k:'dodge',ic:'🌀',n:'구르기 숙련',d:'회피 쿨 -12%',             base:65, step:1.46},
  {k:'pierce',ic:'➡️',n:'관통탄',    d:'관통 +1',                  base:170,step:1.90, max:3},
  {k:'luck', ic:'🍀',n:'행운',      d:'코인 +12%, 다이아 +6%',     base:70, step:1.45}
];
const rsPrice=it=>Math.round(it.base*Math.pow(it.step,RUP[it.k]));
function openRunShop(){
  state='shop';
  const c=ovc();
  let h='<h2>🏪 사막 잡화점</h2><div class="sub">웨이브 '+wave+' 돌파!<br>'+
    '🪙 <b id="shopCoins">'+fmt(coins)+'</b>  ·  💎 '+fmt(gems)+' 획득</div><div class="grid small">';
  for(const it of RSHOP){
    const lv=RUP[it.k],mx=it.max||99,p=rsPrice(it),full=lv>=mx;
    h+='<div class="item '+(full?'no':(coins>=p?'can':'no'))+'" data-rs="'+it.k+'">'+
      '<div class="lv">'+(full?'MAX':'Lv.'+lv)+'</div><div class="ii">'+it.ic+'</div>'+
      '<div class="it">'+it.n+'</div><div class="id">'+it.d+'</div>'+
      '<div class="ip">'+(full?'—':'🪙 '+p)+'</div></div>';
  }
  h+='</div><button class="btn" id="goNext">다음 웨이브 ▶</button>'+
     '<button class="btn sec" id="goQuit">🏠 로비로 (기록 저장)</button>'+
     '<div class="hint">다이아몬드는 사망하거나 로비로 돌아가도 유지됩니다.</div>';
  c.innerHTML=h; c.className='card';
  showOv(true);
  c.querySelectorAll('[data-rs]').forEach(b=>b.onclick=()=>{
    const it=RSHOP.find(x=>x.k===b.dataset.rs);
    if(RUP[it.k]>=(it.max||99))return;
    const p=rsPrice(it);
    if(coins<p){SND.noise(.2,.08,300,1);flash(b);return;}
    coins-=p; RUP[it.k]++;
    const oldMax=P.maxHp; refreshRS();
    if(it.k==='hp'){ P.maxHp=RS.maxHp; P.hp=Math.min(P.maxHp,P.hp+(P.maxHp-oldMax)+10); }
    if(it.k==='mag')P.ammo=WST.mag;
    SND.buy(); openRunShop();
  });
  el('goNext').onclick=()=>{
    refreshRS();
    P.maxHp=RS.maxHp;
    P.hp=Math.min(P.maxHp,P.hp+P.maxHp*0.15);
    P.ammo=WST.mag; P.reloading=0;
    const rb=el('reloadBar'); if(rb)rb.style.display='none';
    showOv(false); state='play'; hudHp(); hudAmmo(true);
    nextWave();
  };
  el('goQuit').onclick=()=>{ endRun(false); };
}

/* ================= 종료 ================= */
function endRun(dead){
  if(wave>SAVE.best)SAVE.best=wave;
  store();
  if(!dead){ openLobby('out'); return; }
}
function gameOver(){
  if(state!=='play')return;
  state='dead'; SND.dead(); timeScale=.25;
  if(wave>SAVE.best)SAVE.best=wave;
  store();
  setTimeout(()=>{
    const c=ovc();
    c.className='card';
    c.innerHTML='<h2>☠️ 쓰러졌다</h2><div class="sub">모래가 모자를 덮었다...</div>'+
      '<div class="sgrid">'+
      [['도달 웨이브',wave],['처치',kills],['획득 코인',fmt(coins)],['획득 💎',gems],
       ['생존',Math.floor(runTime)+'초'],['최고 기록','W'+SAVE.best]]
      .map(x=>'<div class="sc"><div class="sv">'+x[1]+'</div><div class="sl">'+x[0]+'</div></div>').join('')+'</div>'+
      (wave>=SAVE.best?'<div class="sub"><span class="tag">신기록!</span></div>':'')+
      '<div class="hint">획득한 다이아몬드 <b>'+gems+'</b>개는 보관됩니다. (보유 💎 '+fmt(SAVE.dia)+')</div>'+
      '<button class="btn" id="again">🔁 다시 출격</button>'+
      '<button class="btn sec" id="toLobby">🏠 로비</button>';
    showOv(true);
    el('again').onclick=()=>{ showOv(false); state='play'; newRun(); };
    el('toLobby').onclick=()=>openLobby('out');
  },900);
}

/* ================= 입력 ================= */
function doDodge(){
  if(!P||P.dodgeCd>0||P.dodgeT>0)return;
  let mx=0,my=0;
  if(keys['w']||keys['arrowup'])my-=1;
  if(keys['s']||keys['arrowdown'])my+=1;
  if(keys['a']||keys['arrowleft'])mx-=1;
  if(keys['d']||keys['arrowright'])mx+=1;
  if(tl.active){mx+=tl.x;my+=tl.y;}
  P.dodgeAng=(mx||my)?Math.atan2(my,mx):P.aim;
  P.dodgeT=.3; P.dodgeCd=RS.dodgeCd; P.inv=.36;
  for(let i=0;i<10;i++)puff(P.x,P.y,'#e3c492');
  SND.dodge();
}
window.addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();
  keys[k]=true;
  if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();
  if(state!=='play')return;
  if(k==='r')startReload();
  if(k==='shift'||k===' ')doDodge();
});
window.addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;});
cv.addEventListener('mousemove',e=>{
  const r=cv.getBoundingClientRect();
  mouse.x=e.clientX-r.left; mouse.y=e.clientY-r.top; mouse.inside=true;
});
cv.addEventListener('mouseleave',()=>mouse.inside=false);
cv.addEventListener('mousedown',e=>{ if(e.button===0){shooting=true;SND.init();SND.resume();} if(e.button===2)doDodge(); });
window.addEventListener('mouseup',e=>{ if(e.button===0)shooting=false; });
cv.addEventListener('contextmenu',e=>e.preventDefault());

const stkL=el('stkL'), stkR=el('stkR');
function setStick(e2,st,kx,ky){
  if(!e2)return;
  e2.style.left=(st.ox-66)+'px'; e2.style.top=(st.oy-66)+'px';
  const kn=e2.querySelector('.kn'); if(kn)kn.style.transform='translate('+(kx*40)+'px,'+(ky*40)+'px)';
}
window.addEventListener('touchstart',e=>{
  SND.init();SND.resume();
  if(state!=='play')return;
  for(const t of e.changedTouches){
    if(t.target&&t.target.closest&&t.target.closest('.tbtn'))continue;
    if(t.clientX<window.innerWidth*0.45&&!tl.active){
      tl.active=true;tl.id=t.identifier;tl.ox=t.clientX;tl.oy=t.clientY;tl.x=0;tl.y=0;
      if(stkL){stkL.classList.add('on');setStick(stkL,tl,0,0);}
    }else if(t.clientX>=window.innerWidth*0.45&&!tr.active){
      tr.active=true;tr.id=t.identifier;tr.ox=t.clientX;tr.oy=t.clientY;tr.x=1;tr.y=0;
      if(stkR){stkR.classList.add('on');setStick(stkR,tr,0,0);}
      shooting=true;
    }
  }
},{passive:false});
window.addEventListener('touchmove',e=>{
  for(const t of e.changedTouches){
    if(tl.active&&t.identifier===tl.id){
      const dx=t.clientX-tl.ox,dy=t.clientY-tl.oy,l=Math.hypot(dx,dy)||1,m=Math.min(l,52)/52;
      tl.x=dx/l*m;tl.y=dy/l*m; setStick(stkL,tl,tl.x,tl.y);
    }
    if(tr.active&&t.identifier===tr.id){
      const dx=t.clientX-tr.ox,dy=t.clientY-tr.oy,l=Math.hypot(dx,dy)||1;
      if(l>8){tr.x=dx/l;tr.y=dy/l;}
      const m=Math.min(l,52)/52; setStick(stkR,tr,tr.x*m,tr.y*m);
    }
  }
  if(state==='play')e.preventDefault();
},{passive:false});
function touchEnd(e){
  for(const t of e.changedTouches){
    if(tl.active&&t.identifier===tl.id){tl.active=false;tl.x=0;tl.y=0;if(stkL)stkL.classList.remove('on');}
    if(tr.active&&t.identifier===tr.id){tr.active=false;shooting=false;if(stkR)stkR.classList.remove('on');}
  }
}
window.addEventListener('touchend',touchEnd);
window.addEventListener('touchcancel',touchEnd);
function bindBtn(id,fn){
  const e2=el(id); if(!e2)return;
  e2.addEventListener('touchstart',ev=>{ev.preventDefault();ev.stopPropagation();fn();},{passive:false});
  e2.addEventListener('click',ev=>{ev.preventDefault();fn();});
}
bindBtn('bDodge',()=>{if(state==='play')doDodge();});
bindBtn('bReload',()=>{if(state==='play')startReload();});

/* ================= 루프 ================= */
let last=performance.now();
function frame(now){
  const raw=Math.min((now-last)/1000,0.05); last=now;
  if(bannerT>0){ bannerT-=raw;
    if(bannerT<=0){ const e2=el('waveBanner');
      if(e2){e2.style.opacity='0';e2.style.transform='translate(-50%,-50%) scale(.85)';} } }
  if(state==='play'){
    let dt=raw*timeScale;
    if(hitStop>0){hitStop-=raw;dt=0;}
    update(dt);
  }else if(state==='dead'){
    timeScale=lerp(timeScale,.25,raw*2);
    update(raw*timeScale*0.3);
  }
  if(P)draw();
  requestAnimationFrame(frame);
}

/* ================= 시작 ================= */
function boot(){
  resize(); buildNoiseTile(); loadSave();
  if(touchMode){ const t=el('touch'); if(t)t.classList.add('on'); }
  computeStats();
  // 배경이 보이도록 플레이어/월드 준비 (로비 뒤에 사막이 보인다)
  newRun(); state='lobby';
  openLobby('out');
  requestAnimationFrame(frame);
}
window.HGAME={boot,get state(){return state;},SAVE:()=>SAVE,
  _dbg:{computeStats,openLobby,newRun,nextWave,spawnEnemy,doDodge,startReload,
    get P(){return P;},get enemies(){return enemies;},get wave(){return wave;},
    get bullets(){return bullets;},get pickups(){return pickups;},get parts(){return parts;},
    get gems(){return gems;},get coins(){return coins;},get kills(){return kills;},
    get RS(){return RS;},get WST(){return WST;},get chunks(){return chunks;},
    setState(s){state=s;},setShoot(v){shooting=v;},keys,mouse,
    openRunShop,RUP,rsPrice,RSHOP,get texts(){return texts;},get ebullets(){return ebullets;},
    get comps(){return comps;},get decals(){return decals;},get tumbles(){return tumbles;},
    get activeChunks(){return activeChunks;}}};
boot();
})();
