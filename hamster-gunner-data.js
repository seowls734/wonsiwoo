/* =========================================================
   총잡이 햄스터 — 데이터 계층
   직업 50 / 무기 100 / 방어구 500 (모자·갑옷·장갑·신발·망토 각 100)
   모든 생성은 인덱스 기반 결정론적 — 같은 아이템은 항상 같은 성능
   ========================================================= */
"use strict";
window.HG = window.HG || {};
(function(HG){

/* ---------------- 등급 ---------------- */
HG.RARITY=[
  {n:'일반', col:'#b9b1a5', glow:'#00000000', mul:1.00, aff:0},
  {n:'고급', col:'#7fd97f', glow:'#7fd97f44', mul:1.16, aff:1},
  {n:'희귀', col:'#6cb6ff', glow:'#6cb6ff55', mul:1.36, aff:2},
  {n:'영웅', col:'#c58cff', glow:'#c58cff55', mul:1.62, aff:3},
  {n:'전설', col:'#ffb64a', glow:'#ffb64a66', mul:1.98, aff:4},
  {n:'신화', col:'#ff6b8a', glow:'#ff6b8a77', mul:2.52, aff:5}
];

/* ---------------- 무기 원형 12종 ---------------- */
/* dmg 피해, rof 발사간격(초), mag 장탄, rel 재장전(초), spread 탄퍼짐(rad),
   speed 탄속, pierce 관통, pellets 동시발사, kick 반동, rngMul 사거리배수 */
HG.WARCH=[
  {id:'revolver',n:'리볼버',      tag:'한 방',  dmg:30, rof:.26, mag:6,  rel:.95, spread:.028, speed:980,  pierce:0,pellets:1,kick:6.5,snd:'rev',    rngMul:1.0},
  {id:'shotgun', n:'샷건',        tag:'산탄',  dmg:15, rof:.72, mag:2,  rel:1.15,spread:.175, speed:850,  pierce:0,pellets:7,kick:15, snd:'shotgun',rngMul:.58},
  {id:'rifle',   n:'윈체스터',    tag:'관통',  dmg:58, rof:.50, mag:5,  rel:1.30,spread:.012, speed:1600, pierce:2,pellets:1,kick:11, snd:'rifle',  rngMul:1.45},
  {id:'dual',    n:'쌍권총',      tag:'연사',  dmg:19, rof:.11, mag:22, rel:1.05,spread:.075, speed:1020, pierce:0,pellets:1,kick:4,  snd:'rev',    rngMul:1.0, dual:true},
  {id:'gatling', n:'개틀링',      tag:'회전',  dmg:13, rof:.055,mag:70, rel:1.90,spread:.105, speed:1100, pierce:0,pellets:1,kick:2.6,snd:'gatling',rngMul:1.0, spin:true},
  {id:'smg',     n:'기관단총',    tag:'경량',  dmg:11, rof:.07, mag:40, rel:1.15,spread:.090, speed:1060, pierce:0,pellets:1,kick:2.2,snd:'rev',    rngMul:.9},
  {id:'launcher',n:'유탄발사기',  tag:'폭발',  dmg:70, rof:.95, mag:3,  rel:1.60,spread:.030, speed:620,  pierce:0,pellets:1,kick:16, snd:'shotgun',rngMul:1.1, boom:95},
  {id:'crossbow',n:'석궁',        tag:'관통',  dmg:72, rof:.80, mag:4,  rel:1.25,spread:.010, speed:1300, pierce:3,pellets:1,kick:8,  snd:'rifle',  rngMul:1.3},
  {id:'railgun', n:'레일건',      tag:'초관통',dmg:150,rof:1.25,mag:2,  rel:1.70,spread:.004, speed:2600, pierce:6,pellets:1,kick:20, snd:'rifle',  rngMul:1.9},
  {id:'flamer',  n:'화염방사기',  tag:'화염',  dmg:7,  rof:.035,mag:120,rel:2.10,spread:.190, speed:520,  pierce:1,pellets:1,kick:1.2,snd:'gatling',rngMul:.4,  burn:5, life:.34},
  {id:'tesla',   n:'테슬라 코일', tag:'연쇄',  dmg:22, rof:.30, mag:14, rel:1.35,spread:.050, speed:900,  pierce:0,pellets:1,kick:5,  snd:'rev',    rngMul:.95, chain:3},
  {id:'sniper',  n:'대물 저격총', tag:'저격',  dmg:210,rof:1.50,mag:3,  rel:2.00,spread:.002, speed:3000, pierce:2,pellets:1,kick:24, snd:'rifle',  rngMul:2.3}
];

/* ---------------- 무기 접두어 (9등급 풀 × 6개, 서로 겹치지 않음) ---------------- */
const WPRE=[
  ['녹슨','낡은','싸구려','긁힌','먼지 묻은','헐거운'],
  ['손질된','길들인','단단한','검게 칠한','보안관의','역마차의'],
  ['사막의','선인장','방울뱀','모래바람','협곡의','마른 우물'],
  ['은빛','서슬진','쌍둥이','노을빛','소금평원','대장장이'],
  ['황금','현상금','무법자','결투의','불꽃','폭풍'],
  ['흑요석','사신의','피 묻은','전쟁','강철심장','해골'],
  ['룬 새긴','용뼈','번개','유성','태양','신기루'],
  ['전설의','왕의','금지된','불멸','심연','천둥'],
  ['신화의','창세','종말','별의','태초','무한']
];
const WRAR=[0,0,1,2,2,3,3,4,5];

/* ---------------- 부가 옵션 (접미 능력) ---------------- */
HG.AFFIX=[
  {id:'dmg',  n:'흉포한',  d:p=>'피해 +'+Math.round(p*100)+'%',        v:.14, ap:(s,p)=>s.dmg*=1+p},
  {id:'rof',  n:'신속한',  d:p=>'연사 +'+Math.round(p*100)+'%',        v:.12, ap:(s,p)=>s.rof/=1+p},
  {id:'acc',  n:'정밀한',  d:p=>'탄퍼짐 -'+Math.round(p*100)+'%',      v:.32, ap:(s,p)=>s.spread*=1-p},
  {id:'mag',  n:'대용량',  d:p=>'장탄수 +'+Math.round(p*100)+'%',      v:.35, ap:(s,p)=>s.mag=Math.ceil(s.mag*(1+p))},
  {id:'rel',  n:'빠른손',  d:p=>'재장전 +'+Math.round(p*100)+'%',      v:.20, ap:(s,p)=>s.rel/=1+p},
  {id:'crit', n:'치명적인',d:p=>'치명타 +'+Math.round(p*100)+'%p',      v:.07, ap:(s,p)=>s.crit=(s.crit||0)+p},
  {id:'pierce',n:'관통의', d:p=>'관통 +'+Math.round(p),                v:1,   ap:(s,p)=>s.pierce+=Math.round(p)},
  {id:'boom', n:'폭발의',  d:p=>'명중 시 범위 피해 '+Math.round(p),     v:55,  ap:(s,p)=>s.boom=(s.boom||0)+p},
  {id:'chain',n:'연쇄의',  d:p=>'번개가 '+Math.round(p)+'명에게 전이',   v:2,   ap:(s,p)=>s.chain=(s.chain||0)+Math.round(p)},
  {id:'vamp', n:'흡혈의',  d:p=>'피해의 '+(p*100).toFixed(1)+'% 회복',  v:.02, ap:(s,p)=>s.vamp=(s.vamp||0)+p},
  {id:'burn', n:'불타는',  d:p=>'화상 '+Math.round(p)+'/초',            v:7,   ap:(s,p)=>s.burn=(s.burn||0)+p},
  {id:'ric',  n:'튕기는',  d:p=>'탄이 '+Math.round(p)+'번 튕김',        v:1,   ap:(s,p)=>s.ric=(s.ric||0)+Math.round(p)},
  {id:'knock',n:'충격의',  d:p=>'넉백 +'+Math.round(p*100)+'%',         v:.7,  ap:(s,p)=>s.knock=(s.knock||1)+p},
  {id:'spd',  n:'고속탄',  d:p=>'탄속 +'+Math.round(p*100)+'%',        v:.28, ap:(s,p)=>s.speed*=1+p},
  {id:'pellet',n:'다발',   d:p=>'발사 수 +'+Math.round(p),             v:1,   ap:(s,p)=>s.pellets+=Math.round(p)},
  {id:'slow', n:'얼어붙은',d:p=>'적 둔화 '+Math.round(p*100)+'%',      v:.3,  ap:(s,p)=>s.slow=(s.slow||0)+p}
];

/* 결정론적 난수 */
function seeded(n){ let a=(n*2654435761)>>>0;
  return function(){ a=(a+0x6D2B79F5)>>>0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return((t^t>>>14)>>>0)/4294967296; }; }

/* ---------------- 무기 100개 생성 ---------------- */
HG.WEAPONS=(function(){
  const out=[];
  for(let i=0;i<100;i++){
    const ai=i%HG.WARCH.length;          // 원형
    const pi=Math.floor(i/HG.WARCH.length); // 접두어 풀 (0~8)
    const A=HG.WARCH[ai], rar=WRAR[pi], R=HG.RARITY[rar];
    const pre=WPRE[pi][ai%WPRE[pi].length];
    const rng=seeded(70000+i);
    const s={
      dmg:A.dmg, rof:A.rof, mag:A.mag, rel:A.rel, spread:A.spread, speed:A.speed,
      pierce:A.pierce, pellets:A.pellets, kick:A.kick, rngMul:A.rngMul,
      boom:A.boom||0, chain:A.chain||0, burn:A.burn||0, crit:0, vamp:0, ric:0, knock:1, slow:0, life:A.life||0
    };
    // 등급 보정: 피해·장탄은 오르고 재장전은 짧아진다
    const m=R.mul*(0.94+rng()*0.14);
    s.dmg=Math.round(s.dmg*m*10)/10;
    s.mag=Math.max(1,Math.round(s.mag*(1+(R.mul-1)*0.45)));
    s.rel=Math.round(s.rel*(1-(R.mul-1)*0.14)*100)/100;
    s.spread=Math.round(s.spread*(1-(R.mul-1)*0.12)*1e4)/1e4;
    // 부가 옵션
    const affs=[], used={};
    for(let k=0;k<R.aff;k++){
      let f,guard=0;
      do{ f=HG.AFFIX[(rng()*HG.AFFIX.length)|0]; }while(used[f.id]&&guard++<30);
      if(used[f.id])continue;
      used[f.id]=1;
      const pw=f.v*(0.8+rng()*0.5)*(1+rar*0.10);
      f.ap(s,pw);
      affs.push({n:f.n, t:f.d(pw)});
    }
    s.dmg=Math.round(s.dmg*10)/10;
    s.rof=Math.round(s.rof*1000)/1000;
    s.rel=Math.round(s.rel*100)/100;
    s.speed=Math.round(s.speed);
    out.push({
      id:'w'+i, idx:i, kind:'weapon', arch:A.id, archIdx:ai, rar,
      name:pre+' '+A.n, tag:A.tag, st:s, affs,
      dual:!!A.dual, spin:!!A.spin, snd:A.snd,
      // 전투력 지표 (정렬/표시용)
      power:Math.round(s.dmg/Math.max(.03,s.rof)*s.pellets*(1+s.pierce*.2)+s.boom*.4)
    });
  }
  return out;
})();

/* ---------------- 방어구 ---------------- */
HG.SLOTS=[
  {id:'hat',  n:'모자',  e:'🎩'},
  {id:'body', n:'갑옷',  e:'🧥'},
  {id:'glove',n:'장갑',  e:'🧤'},
  {id:'boot', n:'신발',  e:'🥾'},
  {id:'cloak',n:'망토',  e:'🧣'}
];
const ABASE={
  hat:  ['밀짚모자','카우보이 모자','보안관 모자','솜브레로','두건','실크해트','철모','가면','왕관','용투구'],
  body: ['가죽조끼','판초','셔츠','사슬갑옷','판금갑옷','모래외투','비늘갑옷','흉갑','로브','용갑옷'],
  glove:['사격장갑','가죽장갑','건틀릿','붕대','토시','강철장갑','비단장갑','작업장갑','손목보호대','용비늘장갑'],
  boot: ['부츠','박차부츠','샌들','모래신','강철군화','가죽신','질주화','등산화','깃털신','용가죽부츠'],
  cloak:['먼지막이','판초망토','가죽망토','깃털망토','모래망토','비단망토','그림자망토','별빛망토','유성망토','용날개']
};
const APRE=['낡은','튼튼한','가죽','무쇠','은빛','황금','흑요석','룬 새긴','별빛','태초'];
const ARAR=[0,0,1,1,2,2,3,4,4,5];

/* 방어구 능력치 풀 — 부위별로 잘 나오는 옵션이 다르다 */
HG.ASTAT={
  hp:    {n:'최대 체력',   u:'',   v:9,    fmt:v=>'+'+Math.round(v)},
  dr:    {n:'피해 감소',   u:'%',  v:.022, fmt:v=>'+'+(v*100).toFixed(1)+'%'},
  spd:   {n:'이동 속도',   u:'%',  v:.035, fmt:v=>'+'+(v*100).toFixed(1)+'%'},
  rel:   {n:'재장전 속도', u:'%',  v:.055, fmt:v=>'+'+(v*100).toFixed(1)+'%'},
  rof:   {n:'연사 속도',   u:'%',  v:.04,  fmt:v=>'+'+(v*100).toFixed(1)+'%'},
  crit:  {n:'치명타 확률', u:'%p', v:.025, fmt:v=>'+'+(v*100).toFixed(1)+'%p'},
  cdmg:  {n:'치명타 피해', u:'%',  v:.09,  fmt:v=>'+'+(v*100).toFixed(0)+'%'},
  dmg:   {n:'공격력',     u:'%',  v:.035, fmt:v=>'+'+(v*100).toFixed(1)+'%'},
  coin:  {n:'코인 획득',   u:'%',  v:.09,  fmt:v=>'+'+(v*100).toFixed(0)+'%'},
  dia:   {n:'다이아 획득', u:'%',  v:.08,  fmt:v=>'+'+(v*100).toFixed(0)+'%'},
  dodge: {n:'회피 쿨감소', u:'%',  v:.05,  fmt:v=>'+'+(v*100).toFixed(1)+'%'},
  regen: {n:'초당 회복',   u:'',   v:.32,  fmt:v=>'+'+v.toFixed(2)+'/초'},
  pickup:{n:'획득 범위',   u:'%',  v:.11,  fmt:v=>'+'+(v*100).toFixed(0)+'%'},
  shield:{n:'웨이브 보호막',u:'',  v:5,    fmt:v=>'+'+Math.round(v)}
};
const SLOTPOOL={
  hat:  ['crit','cdmg','coin','dia','dmg','hp'],
  body: ['hp','dr','shield','regen','dmg','dr'],
  glove:['rof','rel','crit','dmg','cdmg','rof'],
  boot: ['spd','dodge','spd','pickup','dr','hp'],
  cloak:['dia','dr','regen','pickup','shield','spd']
};

HG.ARMORS=(function(){
  const out=[];
  HG.SLOTS.forEach((S,si)=>{
    for(let i=0;i<100;i++){
      const bi=i%10, pi=Math.floor(i/10);  // 10 기본형 × 10 재질 = 100
      const rar=ARAR[pi], R=HG.RARITY[rar];
      const rng=seeded(200000+si*1000+i);
      const name=APRE[pi]+' '+ABASE[S.id][bi];
      const pool=SLOTPOOL[S.id];
      const nStat=1+rar;                    // 등급당 옵션 수 1~6
      const st={}; const used={};
      for(let k=0;k<nStat;k++){
        let key,guard=0;
        do{ key=pool[(rng()*pool.length)|0]; }while(used[key]&&guard++<20);
        if(used[key]){ key=pool.find(p=>!used[p]) || Object.keys(HG.ASTAT)[(rng()*14)|0]; }
        if(used[key])continue;
        used[key]=1;
        const D=HG.ASTAT[key];
        let v=D.v*R.mul*(0.82+rng()*0.55)*(1+bi*0.07);
        if(key==='hp')v=Math.round(v);
        else if(key==='shield')v=Math.round(v);
        else v=Math.round(v*1e4)/1e4;
        st[key]=v;
      }
      out.push({
        id:'a'+si+'_'+i, idx:i, kind:'armor', slot:S.id, slotIdx:si, rar,
        name, base:ABASE[S.id][bi], st,
        power:Math.round(Object.keys(st).reduce((a,k)=>a+st[k]/HG.ASTAT[k].v,0)*10)
      });
    }
  });
  return out;
})();

/* ---------------- 직업 50종 ---------------- */
/* [이름, 이모지, 시작무기원형, 체력배수, 이동배수, 피해배수, 치명타+, 패시브, 패시브수치, 다이아비용, 설명] */
const J=[
 ['신입 보안관','⭐','revolver',1.00,1.00,1.00,.00,'none',0,     0,'기본기에 충실한 출발점.'],
 ['역마차 호위','🛡️','shotgun', 1.22,0.94,1.00,.00,'guard',.08,  0,'마차를 지키던 몸. 단단하다.'],
 ['현상금 사냥꾼','🎯','rifle',  0.96,1.04,1.06,.05,'gold',.35,  12,'목표를 보면 값이 먼저 보인다.'],
 ['사막 유랑자','🌵','revolver',1.00,1.14,1.00,.00,'magnet',.6, 12,'모래를 밟는 데 익숙하다.'],
 ['도박사','🎲','dual',         0.90,1.06,1.00,.14,'crit',.10,  18,'운에 모든 걸 맡긴다.'],
 ['선인장 농부','🪴','shotgun',  1.30,0.90,0.96,.00,'thorn',22,  18,'찔리면 아픈 건 서로 마찬가지.'],
 ['광부','⛏️','launcher',       1.14,0.94,1.02,.00,'diamond',.5,24,'다이아 냄새를 맡는다.'],
 ['대장장이','🔨','revolver',    1.10,0.96,1.10,.00,'reload',.25,24,'총은 쓰는 사람보다 만든 사람이 안다.'],
 ['무법자','💀','dual',         0.94,1.08,1.12,.04,'none',0,    24,'법보다 총이 빠르다.'],
 ['결투사','🤠','revolver',      0.98,1.02,1.08,.10,'close',.25,30,'정면 승부만 한다.'],
 ['저격수','🔭','sniper',        0.88,0.96,1.00,.08,'snipe',.45,36,'멀수록 더 아프다.'],
 ['폭파공','🧨','launcher',      1.04,0.98,1.00,.00,'boom',60,  36,'문제는 대부분 폭발로 해결된다.'],
 ['기관총 사수','🌪️','gatling', 1.16,0.86,1.00,.00,'turret',.30,36,'버티고 서서 갈아버린다.'],
 ['쌍권총 무법자','✌️','dual',  0.92,1.10,1.04,.06,'rof',.14,  42,'양손이 비어 있을 틈이 없다.'],
 ['산탄 보안관','💥','shotgun',  1.18,0.96,1.04,.00,'pellet',2, 42,'한 발에 모두 담는다.'],
 ['석궁 사냥꾼','🏹','crossbow', 1.00,1.02,1.04,.04,'pierce',1, 42,'한 발로 줄줄이 꿴다.'],
 ['방화범','🔥','flamer',        1.02,1.00,1.00,.00,'burn',12,  48,'재만 남기고 떠난다.'],
 ['번개 기술자','⚡','tesla',    0.96,1.02,1.02,.00,'chain',2,  48,'전기는 사람을 가리지 않는다.'],
 ['레일건 과학자','🔬','railgun',0.90,0.98,1.06,.00,'pierce',2, 54,'관통은 과학이다.'],
 ['땅굴 공병','🕳️','smg',       1.12,1.06,0.98,.00,'dodge',.30,54,'도망도 전술이다.'],
 ['방울뱀 조련사','🐍','smg',    0.98,1.12,1.00,.04,'slow',.22, 54,'느려진 적은 이미 죽은 적.'],
 ['독수리 조련사','🦅','rifle',  0.96,1.10,1.02,.04,'summon',1, 60,'하늘에서 함께 싸운다.'],
 ['전갈 술사','🦂','crossbow',   1.04,0.98,1.04,.00,'burn',9,   60,'독은 조용히 일한다.'],
 ['모래 주술사','🌀','tesla',    1.00,1.02,1.04,.00,'slow',.3,  60,'모래가 발목을 잡는다.'],
 ['신기루 환술사','🫧','smg',    0.92,1.16,1.02,.06,'dodge',.4, 66,'보이는 것을 믿지 마라.'],
 ['소금 순례자','🧂','rifle',    1.14,0.98,1.00,.00,'regen',.9, 66,'마른 땅에서도 버틴다.'],
 ['협곡 추적자','🏜️','sniper',  0.94,1.06,1.04,.06,'snipe',.6, 66,'바위 틈에서 기다린다.'],
 ['늑대 조련사','🐺','shotgun',  1.06,1.08,1.02,.00,'summon',2, 72,'무리로 사냥한다.'],
 ['선인장 수호자','🛡️','shotgun',1.36,0.88,0.98,.00,'thorn',40, 72,'가시로 뒤덮인 벽.'],
 ['철갑 보안관','🚔','gatling',  1.30,0.88,1.02,.00,'guard',.14,72,'총알이 잘 안 통한다.'],
 ['약장수','💊','revolver',      1.08,1.02,1.00,.00,'vampK',.14,78,'내 약은 나한테만 잘 듣는다.'],
 ['장의사','⚰️','crossbow',     1.02,1.00,1.08,.00,'vampK',.10,78,'일감은 내가 만든다.'],
 ['사막의 목사','✝️','revolver', 1.16,0.98,1.00,.00,'shield',28,78,'기도는 방패가 된다.'],
 ['바텐더','🍻','shotgun',       1.10,1.00,1.00,.00,'gold',.6, 84,'정보와 동전이 모이는 곳.'],
 ['보물 사냥꾼','🗺️','smg',     0.98,1.08,1.00,.04,'magnet',1.2,84,'바닥에 떨어진 건 다 내 것.'],
 ['다이아 광부','💎','launcher', 1.06,0.96,1.00,.00,'diamond',1.1,90,'다이아가 눈에만 보인다.'],
 ['기차 강도','🚂','dual',       0.96,1.14,1.06,.05,'gold',.9, 90,'달리면서 쏜다.'],
 ['은행 경비','🏦','shotgun',    1.28,0.92,1.00,.00,'shield',45,90,'금고보다 단단하다.'],
 ['치안대장','🎖️','rifle',      1.14,1.00,1.08,.04,'summon',2, 96,'부하들이 함께 온다.'],
 ['사막 닌자','🥷','smg',        0.90,1.22,1.04,.08,'dodge',.5, 96,'그림자보다 빠르다.'],
 ['그림자 암살자','🗡️','sniper',0.86,1.12,1.00,.18,'cdmg',.8,  102,'한 발로 끝낸다.'],
 ['피의 복수자','🩸','dual',     0.92,1.04,1.10,.06,'berserk',.6,102,'피를 흘릴수록 강해진다.'],
 ['광전사','😤','gatling',       1.08,1.04,1.14,.00,'berserk',.9,108,'고통은 연료다.'],
 ['불사신','🧟','revolver',      1.50,0.92,0.96,.00,'regen',1.8,108,'좀처럼 죽지 않는다.'],
 ['수호천사','😇','rifle',       1.24,1.00,1.02,.00,'shield',70,114,'빛이 감싸 준다.'],
 ['운명 조작자','🃏','dual',     0.94,1.04,1.02,.22,'crit',.18, 120,'확률을 내 편으로.'],
 ['시간 조율사','⏳','tesla',    0.96,1.08,1.04,.06,'slow',.45, 126,'시간이 느려진다.'],
 ['유성 기사','☄️','launcher',   1.12,1.02,1.12,.04,'boom',110, 132,'하늘에서 떨어지는 심판.'],
 ['심연 사격수','🌌','railgun',  0.92,1.04,1.16,.10,'pierce',3, 144,'끝까지 뚫는다.'],
 ['전설의 총잡이','🏆','revolver',1.14,1.12,1.20,.12,'legend',1,180,'모든 패시브를 조금씩 가진 자.']
];
HG.PASSIVE={
  none:   {n:'—',            d:()=>'특별한 패시브 없음'},
  guard:  {n:'철갑',          d:v=>'받는 피해 '+Math.round(v*100)+'% 감소'},
  gold:   {n:'금화 사랑',      d:v=>'코인 획득 +'+Math.round(v*100)+'%'},
  diamond:{n:'보석 감각',      d:v=>'다이아 드랍 +'+Math.round(v*100)+'%'},
  magnet: {n:'자력',          d:v=>'획득 범위 +'+Math.round(v*100)+'%'},
  crit:   {n:'행운의 손',      d:v=>'치명타 확률 +'+Math.round(v*100)+'%p'},
  cdmg:   {n:'급소 간파',      d:v=>'치명타 피해 +'+Math.round(v*100)+'%'},
  thorn:  {n:'가시',          d:v=>'피격 시 주변에 '+Math.round(v)+' 피해'},
  reload: {n:'숙련된 손',      d:v=>'재장전 속도 +'+Math.round(v*100)+'%'},
  rof:    {n:'속사',          d:v=>'연사 속도 +'+Math.round(v*100)+'%'},
  pellet: {n:'다발 사격',      d:v=>'발사 수 +'+Math.round(v)},
  pierce: {n:'관통 사격',      d:v=>'관통 +'+Math.round(v)},
  boom:   {n:'폭발탄',        d:v=>'명중 시 범위 피해 '+Math.round(v)},
  chain:  {n:'전이',          d:v=>'번개가 '+Math.round(v)+'명에게 추가 전이'},
  burn:   {n:'화상',          d:v=>'화상 피해 '+Math.round(v)+'/초'},
  slow:   {n:'둔화',          d:v=>'맞은 적 '+Math.round(v*100)+'% 둔화'},
  snipe:  {n:'원거리 특화',    d:v=>'먼 적에게 최대 +'+Math.round(v*100)+'% 피해'},
  close:  {n:'근접 특화',      d:v=>'가까운 적에게 최대 +'+Math.round(v*100)+'% 피해'},
  turret: {n:'거치 사격',      d:v=>'멈춰 있으면 피해 +'+Math.round(v*100)+'%'},
  dodge:  {n:'구르기 숙련',    d:v=>'회피 쿨 -'+Math.round(v*100)+'%, 구르며 사격'},
  shield: {n:'보호막',        d:v=>'웨이브마다 보호막 '+Math.round(v)},
  regen:  {n:'재생',          d:v=>'초당 '+v.toFixed(1)+' 회복'},
  vampK:  {n:'흡수',          d:v=>'처치 시 최대 체력의 '+Math.round(v*100)+'% 회복'},
  berserk:{n:'광폭화',        d:v=>'체력이 낮을수록 피해 최대 +'+Math.round(v*100)+'%'},
  summon: {n:'동료',          d:v=>'함께 싸우는 동료 '+Math.round(v)+'마리'},
  legend: {n:'전설',          d:()=>'철갑·재생·자력·치명타·보호막을 모두 소량 획득'}
};
HG.JOBS=J.map((j,i)=>({
  id:'j'+i, idx:i, kind:'job', name:j[0], e:j[1], arch:j[2],
  hp:j[3], spd:j[4], dmg:j[5], crit:j[6], p:j[7], pv:j[8], cost:j[9], desc:j[10],
  rar:Math.min(5,Math.floor(i/9))
}));

/* ---------------- 영구 강화 (다이아몬드) ---------------- */
HG.PERM=[
  {k:'hp',   e:'❤️', n:'강인한 몸',   d:'최대 체력 +14',        base:6,  step:1.30, max:40, v:14},
  {k:'dmg',  e:'💪', n:'화력 연구',   d:'모든 피해 +4%',        base:8,  step:1.34, max:40, v:.04},
  {k:'spd',  e:'🥾', n:'사막 주행',   d:'이동 속도 +2.5%',      base:6,  step:1.30, max:30, v:.025},
  {k:'dr',   e:'🛡️', n:'방탄 조끼',   d:'받는 피해 -1.2%',      base:10, step:1.36, max:25, v:.012},
  {k:'crit', e:'🎯', n:'사격 훈련',   d:'치명타 확률 +1.5%p',   base:9,  step:1.33, max:30, v:.015},
  {k:'rel',  e:'🔄', n:'장전 숙련',   d:'재장전 속도 +4%',      base:7,  step:1.30, max:30, v:.04},
  {k:'rof',  e:'⚡', n:'방아쇠 훈련', d:'연사 속도 +2.5%',      base:9,  step:1.34, max:30, v:.025},
  {k:'mag',  e:'📦', n:'탄약 가방',   d:'장탄수 +6%',           base:7,  step:1.30, max:25, v:.06},
  {k:'dodge',e:'🌀', n:'구르기 연습', d:'회피 쿨 -3%',          base:7,  step:1.31, max:20, v:.03},
  {k:'coin', e:'🪙', n:'흥정 기술',   d:'코인 획득 +6%',        base:5,  step:1.26, max:30, v:.06},
  {k:'dia',  e:'💎', n:'감별 기술',   d:'다이아 드랍 +5%',      base:12, step:1.38, max:25, v:.05},
  {k:'regen',e:'🌿', n:'야전 치료',   d:'초당 회복 +0.25',      base:11, step:1.36, max:20, v:.25},
  {k:'pickup',e:'🧲',n:'자석 개량',   d:'획득 범위 +8%',        base:5,  step:1.25, max:20, v:.08},
  {k:'shield',e:'✨',n:'수호 부적',   d:'웨이브 보호막 +6',     base:10, step:1.34, max:25, v:6},
  {k:'luck', e:'🍀', n:'행운',       d:'좋은 등급 드랍 확률 증가',base:14,step:1.42, max:15, v:1}
];
HG.permCost=(u,lv)=>Math.round(u.base*Math.pow(u.step,lv));

/* ---------------- 보급 상자 ---------------- */
HG.BOXES=[
  {id:'b1', n:'낡은 보급 상자', e:'📦', cost:30,  cnt:1, w:[62,24,10,3.2,0.7,0.1]},
  {id:'b2', n:'보안관 보급함', e:'🧰', cost:90,  cnt:3, w:[34,30,22,10,3.3,0.7]},
  {id:'b3', n:'전설의 금고',   e:'🗄️', cost:260, cnt:5, w:[6,18,30,26,16,4]}
];

/* 등급 가중치에서 하나 뽑기 (행운 보정) */
HG.rollRarity=function(weights,luck){
  const w=weights.slice();
  for(let i=0;i<w.length;i++) w[i]*=Math.pow(1+(luck||0)*0.06, i); // 행운이 높으면 상위 등급 가중↑
  let tot=0; for(const x of w)tot+=x;
  let r=Math.random()*tot;
  for(let i=0;i<w.length;i++){ r-=w[i]; if(r<=0)return i; }
  return 0;
};

/* 특정 등급의 무기/방어구 중 하나 */
HG.rollItem=function(rar){
  const wantArmor=Math.random()<0.72;   // 방어구가 5배 많으니 더 자주
  const pool=(wantArmor?HG.ARMORS:HG.WEAPONS).filter(x=>x.rar===rar);
  if(!pool.length){
    const all=wantArmor?HG.ARMORS:HG.WEAPONS;
    return all[(Math.random()*all.length)|0];
  }
  return pool[(Math.random()*pool.length)|0];
};

HG.byId=(function(){
  const m={};
  for(const w of HG.WEAPONS)m[w.id]=w;
  for(const a of HG.ARMORS)m[a.id]=a;
  for(const j of HG.JOBS)m[j.id]=j;
  return m;
})();

/* ---------------- 적 정의 ---------------- */
HG.ETYPE={
  rat:    {name:'들쥐 갱단',    hp:44,  spd:112, r:17, dmg:11, coin:4,  dia:.010, col:'#8d7a6b', kind:'melee'},
  snake:  {name:'사막 뱀',      hp:30,  spd:178, r:14, dmg:9,  coin:5,  dia:.010, col:'#b4a23c', kind:'melee', zig:true},
  scorp:  {name:'전갈',         hp:120, spd:78,  r:22, dmg:20, coin:11, dia:.022, col:'#6e4b7a', kind:'charge', armor:4},
  vulture:{name:'독수리',       hp:62,  spd:150, r:19, dmg:14, coin:8,  dia:.018, col:'#5d5b63', kind:'dive', fly:true},
  mole:   {name:'두더지 총잡이',hp:70,  spd:92,  r:18, dmg:13, coin:12, dia:.022, col:'#7a5a44', kind:'gunner'},
  coyote: {name:'코요테',       hp:86,  spd:205, r:19, dmg:16, coin:10, dia:.020, col:'#9c7348', kind:'charge'},
  bomber: {name:'폭탄 두꺼비',  hp:95,  spd:120, r:20, dmg:30, coin:14, dia:.026, col:'#5f7a4a', kind:'bomber'},
  turretB:{name:'사보텐 포탑',  hp:180, spd:0,   r:24, dmg:15, coin:18, dia:.035, col:'#3f7a46', kind:'gunner', still:true, armor:6},
  ghost:  {name:'모래 유령',    hp:70,  spd:138, r:19, dmg:17, coin:16, dia:.030, col:'#9fb6c4', kind:'melee', phase:true},
  boss:   {name:'고양이 두목',  hp:1000,spd:92,  r:46, dmg:26, coin:160,dia:1,    col:'#c9893f', kind:'boss', armor:7}
};
/* 접두 변종 — 높은 웨이브에서 등장 */
HG.EMOD=[
  {id:'none', n:'',        hp:1,   spd:1,   dmg:1,   coin:1,  dia:1,  col:null},
  {id:'fire', n:'불타는 ', hp:1.3, spd:1.05,dmg:1.25,coin:1.5,dia:2,  col:'#ff7a3a', aura:'#ff6a2a'},
  {id:'ice',  n:'얼어붙은 ',hp:1.5,spd:0.82,dmg:1.15,coin:1.5,dia:2,  col:'#7fd4ff', aura:'#6cc8ff'},
  {id:'gold', n:'황금 ',   hp:1.9, spd:1.0, dmg:1.1, coin:6,  dia:9,  col:'#ffd45e', aura:'#ffc83a'},
  {id:'storm',n:'폭풍 ',   hp:1.4, spd:1.35,dmg:1.2, coin:2,  dia:3,  col:'#c58cff', aura:'#b273ff'},
  {id:'elite',n:'정예 ',   hp:2.6, spd:1.08,dmg:1.4, coin:3.5,dia:5,  col:'#ff6b8a', aura:'#ff5577'}
];

/* ---------------- 바이오움 (무한 맵) ---------------- */
HG.BIOMES=[
  {n:'황야 사막',  g1:'#d8ab6b', g2:'#c08f50', tint:'rgba(255,170,90,0.07)',  deco:'cactus'},
  {n:'적암 협곡',  g1:'#c47a52', g2:'#a35a3c', tint:'rgba(255,110,70,0.10)',  deco:'rock'},
  {n:'소금 평원',  g1:'#e4e0d2', g2:'#c8c4b4', tint:'rgba(200,220,255,0.08)', deco:'salt'},
  {n:'메마른 늪',  g1:'#8e9464', g2:'#6c7247', tint:'rgba(120,255,140,0.07)', deco:'grass'},
  {n:'용암 지대',  g1:'#6b3a2c', g2:'#43211a', tint:'rgba(255,90,40,0.14)',   deco:'lava'},
  {n:'별빛 사막',  g1:'#3b3a62', g2:'#242444', tint:'rgba(120,130,255,0.14)', deco:'star'}
];

})(window.HG);
