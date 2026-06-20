'use strict';

// ── Canvas setup ─────────────────────────────────────────────────────────────
var canvas = document.getElementById('gameCanvas');
var ctx    = canvas.getContext('2d');
var W = 390, H = 844;
canvas.width  = W;
canvas.height = H;
setRenderCtx(ctx, W, H);

function resize() {
  var vh=window.innerHeight, vw=window.innerWidth;
  var ratio=W/H, cw=vh*ratio, ch=vh;
  if (cw>vw) { cw=vw; ch=vw/ratio; }
  canvas.style.width=cw+'px'; canvas.style.height=ch+'px';
}
window.addEventListener('resize', resize);
resize();

SoundManager.init();

// ── Constants ────────────────────────────────────────────────────────────────
var CHICK_X=W/2, CHICK_Y=H-148;
var CD_MAX={gunshi:600,nurse:900,barrier:750};
var TOTAL_STAGES=20;
var WAVES_PER_STAGE=5;

// ── Tower definitions ─────────────────────────────────────────────────────────
var TOWER_DEFS={
  normal:  {name:'ノーマルタワー', desc:'バランス型',  icon:'🏰',dmg:7,  range:172,cdMax:36,col:'#8B6C14',maxHp:90},
  rapid:   {name:'ラピッドタワー', desc:'高速連射',    icon:'🔰',dmg:3,  range:136,cdMax:12,col:'#145A8B',maxHp:60},
  sniper:  {name:'スナイパー',     desc:'長射程高ダメ', icon:'🎯',dmg:18, range:260,cdMax:90,col:'#333344',maxHp:70},
  support: {name:'サポート',       desc:'貫通弾',      icon:'💠',dmg:6,  range:200,cdMax:26,col:'#1A6B4A',maxHp:80},
};
function makeTowerSlots() {
  return [
    {x:80, y:400,type:null,level:1,cd:0,hp:0,maxHp:0,damageCd:0},
    {x:195,y:432,type:null,level:1,cd:0,hp:0,maxHp:0,damageCd:0},
    {x:310,y:400,type:null,level:1,cd:0,hp:0,maxHp:0,damageCd:0},
  ];
}
var TOWER_SLOTS=makeTowerSlots();

// ── 入力状態 ─────────────────────────────────────────────────────────────────
var isHolding=false, holdX=W/2, holdY=H/3;

// ── ゲーム状態 ───────────────────────────────────────────────────────────────
// states: title | howto | battle | bosswarn | stageclear | levelup | paused | gameover | ending
//         settings | bestiary | achievements
var gs={state:'title'};
var upg={}, cds={};
var enemies=[], bullets=[], particles=[], floats=[], enemyBullets=[];

var stage=1, wave=1;
var waveSpawned=0, waveTotal=0, waveTimer=0;
var bossWarnTimer=0, stageClearTimer=0;
var BOSS_WARN_FRAMES=90, STAGE_CLEAR_FRAMES=150;
var score=0, kills=0, isNewHS=false;
var continueFromStage=1;
var slowTimer=0;
var level=1, xp=0;
var regenTimer=0, playFrames=0, frame=0;
var shakeX=0, shakeY=0, shakeMag=0;
var chickHitFx=0;
var stageIntroTimer=0, STAGE_INTRO_FRAMES=80;
var levelChoices=[];

// 新システム
var runCoins=0;           // このランで稼いだコイン
var coinGainMult=1.0;     // ショップ由来コイン倍率
var poisonDebuff=0;       // 毒デバフ残りフレーム
var achieveQueue=[];      // 実績ポップアップキュー {def, timer}
var achievePopup=null;    // 現在表示中ポップアップ
var ACHIEVE_POPUP_TIME=180;
var bossKillFlags={boss_chicken:false,boss_snake:false,boss:false};
var waveStartHp=100;

function xpToNext(lv) { return 6+lv*3; }

// ── ショップボーナス取得 ──────────────────────────────────────────────────────
function getShopBonuses() {
  var lvls=SaveManager.getShopLevels();
  return {
    startHp:    (lvls.start_hp    ||0)*10,
    startAtk:   (lvls.start_atk   ||0)*1,
    startSpd:   Math.pow(1.10, lvls.start_spd   ||0),
    xpGain:     Math.pow(1.15, lvls.xp_gain     ||0),
    coinGain:   Math.pow(1.25, lvls.coin_gain   ||0),
    startEarth: (lvls.start_earth ||0)*15,
  };
}

// ── Wave config（20種対応） ───────────────────────────────────────────────────
function getBossType(stg) {
  if (stg <= 7)  return 'boss_chicken';
  if (stg <= 14) return 'boss_snake';
  return 'boss';
}

function waveTypes(stg, wv) {
  if (wv===WAVES_PER_STAGE) return [getBossType(stg)];
  if (stg===1)  return ['normal'];
  if (stg===2)  return wv<=2?['normal']:['normal','fast'];
  if (stg===3)  return wv<=2?['normal','fast']:['normal','fast','ranged'];
  if (stg===4)  return wv<=2?['normal','fast','ranged']:['fast','ranged'];
  if (stg===5)  return wv<=2?['fast','ranged']:['fast','ranged','tank'];
  if (stg===6)  return wv<=2?['fast','sprinter','ranged']:['fast','sprinter','tank'];
  if (stg===7)  return wv<=2?['sprinter','armored','ranged']:['sprinter','armored','tank'];
  if (stg===8)  return wv<=2?['armored','regen','ranged']:['armored','regen','tank'];
  if (stg===9)  return wv<=2?['regen','shielded','armored']:['regen','shielded','tank'];
  if (stg===10) return wv<=2?['shielded','regen','tank']:['fast','shielded','regen','tank'];
  if (stg===11) return wv<=2?['fast','ranged','stealth']:['ranged','stealth','tank'];
  if (stg===12) return wv<=2?['ranged','stealth','berserker']:['stealth','berserker','tank'];
  if (stg===13) return wv<=2?['stealth','healer','leech','fast']:['stealth','leech','healer','tank'];
  if (stg===14) return wv<=2?['ghost','healer','leech','fast']:['ghost','healer','leech','tank'];
  if (stg===15) return wv<=2?['ghost','healer','splitter','necro']:['ghost','splitter','necro','bomber'];
  if (stg===16) return wv<=2?['ghost','healer','shielded','phantom']:['ghost','healer','phantom','titan'];
  if (stg===17) return wv<=2?['ghost','healer','poison','phantom']:['ghost','healer','poison','titan'];
  if (stg===18) return wv<=2?['ghost','healer','poison','berserker']:['ghost','healer','berserker','titan'];
  // Stage 19-20: 地獄
  return wv<=2?['ghost','ghost','healer','poison','phantom']:['ghost','healer','healer','titan','necro'];
}

function waveCount(stg, wv) {
  if (wv===WAVES_PER_STAGE) return 1;
  // 時間スケールによる増量 + 後半大増量
  var base=4+stg+wv-1;
  if (stg>=15) base=Math.round(base*1.5);
  return Math.min(28, base);
}

// ── Init ──────────────────────────────────────────────────────────────────────
function initGame() {
  var bonuses=getShopBonuses();
  var startHp=100+bonuses.startHp+bonuses.startEarth;
  gs={state:'stageintro',earthHP:startHp,maxEarthHP:startHp,evoGauge:0,isEvolved:false,evoTimer:0,attackCooldown:0,barrierActive:false,barrierTimer:0};
  upg={gunshi:true,nurse:true,barrier:true};
  cds={gunshi:0,nurse:0,barrier:0};
  coinGainMult=bonuses.coinGain;
  PlayerUpgrades.reset({startAtk:bonuses.startAtk,startSpd:bonuses.startSpd,xpGain:bonuses.xpGain,coinGain:bonuses.coinGain});
  enemies=[]; bullets=[]; enemyBullets=[]; particles=[]; floats=[];
  TOWER_SLOTS.forEach(function(t){t.type=null;t.level=1;t.cd=0;t.hp=0;t.maxHp=0;t.damageCd=0;});
  stage=1; wave=1; waveSpawned=0; waveTotal=0; waveTimer=0;
  bossWarnTimer=0; stageClearTimer=0;
  score=0; kills=0; isNewHS=false; runCoins=0; poisonDebuff=0;
  level=1; xp=0; regenTimer=0; playFrames=0;
  isHolding=false; chickHitFx=0;
  stageIntroTimer=STAGE_INTRO_FRAMES;
  bossKillFlags={boss_chicken:false,boss_snake:false,boss:false};
  waveStartHp=gs.earthHP;
  achieveQueue=[]; achievePopup=null;
}

function initGameContinue(fromStage) {
  var bonuses=getShopBonuses();
  var startHp=100+bonuses.startHp+bonuses.startEarth;
  gs={state:'stageintro',earthHP:startHp,maxEarthHP:startHp,evoGauge:0,isEvolved:false,evoTimer:0,attackCooldown:0,barrierActive:false,barrierTimer:0};
  upg={gunshi:true,nurse:true,barrier:true};
  cds={gunshi:0,nurse:0,barrier:0};
  coinGainMult=bonuses.coinGain;
  PlayerUpgrades.reset({startAtk:bonuses.startAtk,startSpd:bonuses.startSpd,xpGain:bonuses.xpGain,coinGain:bonuses.coinGain});
  enemies=[]; bullets=[]; enemyBullets=[]; particles=[]; floats=[];
  TOWER_SLOTS.forEach(function(t){t.type=null;t.level=1;t.cd=0;t.hp=0;t.maxHp=0;t.damageCd=0;});
  stage=fromStage; wave=1; waveSpawned=0; waveTotal=0; waveTimer=0;
  bossWarnTimer=0; stageClearTimer=0;
  score=0; kills=0; isNewHS=false; runCoins=0; poisonDebuff=0;
  level=1; xp=0; regenTimer=0; playFrames=0;
  isHolding=false; chickHitFx=0;
  stageIntroTimer=STAGE_INTRO_FRAMES;
  bossKillFlags={boss_chicken:false,boss_snake:false,boss:false};
  waveStartHp=gs.earthHP;
  achieveQueue=[]; achievePopup=null;
}

function startWave() {
  waveSpawned=0; waveTotal=waveCount(stage,wave); waveTimer=0;
  waveStartHp=gs.earthHP;
  if (wave===WAVES_PER_STAGE) {
    bossWarnTimer=BOSS_WARN_FRAMES; SoundManager.bossWarn(); SoundManager.startBgm('boss');
  } else {
    bossWarnTimer=0; SoundManager.startBgm('battle');
    addFloat(W/2,H*0.4,'WAVE '+wave+'!','#FFD700',24);
  }
}

function spawnEnemy(typeOverride) {
  var types=waveTypes(stage,wave);
  var type=typeOverride||types[~~(Math.random()*types.length)];
  var isBoss=(type==='boss'||type==='boss_chicken'||type==='boss_snake');
  var x=55+Math.random()*(W-110), y=isBoss?190:-60;
  enemies.push(new Enemy(type,x,y,stage,wave));
}

function spawnMinion() {
  var minionTypes=waveTypes(stage,Math.max(1,wave-1)).filter(function(t){ return t!=='boss'&&t!=='boss_chicken'&&t!=='boss_snake'; });
  if (!minionTypes.length) minionTypes=['normal'];
  var type=minionTypes[~~(Math.random()*minionTypes.length)];
  enemies.push(new Enemy(type,55+Math.random()*(W-110),-60,stage,wave));
}

// ── ヘルパー ─────────────────────────────────────────────────────────────────
function spawnP(x,y,type,n) { for (var i=0;i<n;i++) particles.push(new Particle(x,y,type)); }
function addFloat(x,y,text,color,size) { floats.push(new FloatingText(x,y,text,color||'#FFD700',size||18)); }

// ── スキル ────────────────────────────────────────────────────────────────────
function activateSkill(id) {
  if (!upg[id]||cds[id]>0) return;
  cds[id]=CD_MAX[id];
  switch(id) {
    case 'gunshi':
      enemies.forEach(function(e){ if(!e.dead){var k=e.takeDamage(25);spawnP(e.x,e.y,'explosion',6);if(k)onKill(e);} });
      spawnP(W/2,H/2,'explosion',20); addFloat(W/2,H*0.38,'一斉突撃！','#FF4444',28); break;
    case 'nurse':
      gs.earthHP=Math.min(gs.maxEarthHP,gs.earthHP+50);
      spawnP(W/2,H*0.3,'hit',22); addFloat(W/2,H*0.38,'地球大回復！','#FF69B4',26); break;
    case 'barrier':
      gs.barrierActive=true; gs.barrierTimer=300;
      addFloat(W/2,H*0.38,'絶対防壁！','#00FFFF',26); break;
  }
}

// ── 発射 ──────────────────────────────────────────────────────────────────────
function fireBullet(tx, ty) {
  var pu=PlayerUpgrades;
  var crit=Math.random()<pu.critChance;
  var isRapid=pu.rapidTimer>0;
  var opts={damage:pu.atk,pierce:pu.pierce,crit:crit,evolved:gs.isEvolved,bulletSpd:pu.bulletSpd,rangeMult:pu.rangeMult,explode:pu.explodeShot};
  bullets.push(new Bullet(CHICK_X,CHICK_Y-20,tx,ty,opts));
  if (pu.doubleShot) {
    bullets.push(new Bullet(CHICK_X-14,CHICK_Y-20,tx,ty,opts));
    bullets.push(new Bullet(CHICK_X+14,CHICK_Y-20,tx,ty,opts));
  }
  SoundManager.shoot();
  spawnP(CHICK_X+(Math.random()-0.5)*30,CHICK_Y-50,'hit',1);
  addFloat(CHICK_X+(Math.random()-0.5)*40,CHICK_Y-56,'ピヨ！','#FF6B6B',13);
}

// ── 撃破 ──────────────────────────────────────────────────────────────────────
function onKill(e) {
  kills++;
  var pts=Math.round(e.pts*PlayerUpgrades.scoreMulti);
  score+=pts;
  // コイン
  var coinBase=Math.max(1,Math.ceil(e.pts/5));
  var earnedCoins=Math.ceil(coinBase*coinGainMult);
  runCoins+=earnedCoins;
  spawnP(e.x,e.y-10,'coin',3);
  addFloat(e.x+15,e.y-10,'🪙'+earnedCoins,'#FFD700',12);

  // 図鑑記録
  SaveManager.recordKill(e.type);

  gs.evoGauge=Math.min(100,gs.evoGauge+(
    e.type==='boss'||e.type==='boss_chicken'||e.type==='boss_snake'?50:
    e.type==='tank'||e.type==='titan'?18:
    e.type==='splitter'||e.type==='healer'?18:
    e.type==='necro'?15:10
  ));
  spawnP(e.x,e.y,'poof',8);
  addFloat(e.x,e.y-24,'+'+pts,'#FFD700',14);
  if (e.type==='boss'||e.type==='boss_chicken'||e.type==='boss_snake'||e.type==='tank'||e.type==='titan') SoundManager.killBig();
  else SoundManager.kill();

  // 分裂
  if (e.type==='splitter') {
    enemies.push(new Enemy('swarm',e.x-22,e.y,stage,wave));
    enemies.push(new Enemy('swarm',e.x+22,e.y,stage,wave));
    addFloat(e.x,e.y-20,'分裂！','#CC44FF',16);
    spawnP(e.x,e.y,'explosion',10);
  }

  // ボス撃破フラグ
  if (e.type==='boss_chicken'||e.type==='boss_snake'||e.type==='boss') {
    bossKillFlags[e.type]=true;
    spawnP(W/2,H*0.4,'stageclear',30);
  }

  gainXP(Math.round(e.xpGain*PlayerUpgrades.xpMult));
  checkAchievements();
}

// ── 実績チェック ─────────────────────────────────────────────────────────────
function checkAchievements() {
  var tryUnlock=function(id) {
    if (SaveManager.unlockAchievement(id)) {
      var def=ACHIEVEMENT_DEFS.find(function(d){return d.id===id;});
      if (def) { achieveQueue.push({def:def,timer:ACHIEVE_POPUP_TIME}); spawnP(W/2,H*0.5,'achieve',14); }
    }
  };
  if (kills>=100)  tryUnlock('kill_100');
  if (kills>=1000) tryUnlock('kill_1000');
  if (level>=20)   tryUnlock('level_20');
  if (playFrames>=600*60) tryUnlock('survive_10m');

  var bossAny=(bossKillFlags.boss_chicken||bossKillFlags.boss_snake||bossKillFlags.boss);
  if (bossAny) tryUnlock('boss_first');
  if (bossKillFlags.boss_chicken&&bossKillFlags.boss_snake&&bossKillFlags.boss) tryUnlock('kill_boss_3');

  var bestiary=SaveManager.getBestiary();
  var bTypes=BESTIARY_TYPES;
  var found=bTypes.filter(function(t){return bestiary[t]>0;}).length;
  if (found>=10) tryUnlock('bestiary_10');
  if (found>=bTypes.length) tryUnlock('bestiary_all');

  if (gs.earthHP>=gs.maxEarthHP&&waveSpawned>=waveTotal) tryUnlock('no_dmg_wave');
}

// ── レベルアップ ─────────────────────────────────────────────────────────────
function gainXP(amount) {
  xp+=amount;
  if (gs.state==='levelup') return;
  if (xp>=xpToNext(level)) {
    xp-=xpToNext(level); level++;
    levelChoices=pickUpgradesWithTowers(3);
    slowTimer=0; gs.state='levelup';
    SoundManager.levelUp(); spawnP(CHICK_X,CHICK_Y,'levelup',22);
  }
}

function applyLevelUp(idx) {
  var ch=levelChoices[idx];
  if (ch.id.indexOf('tower_')===0) {
    var ttype=ch.id.replace('tower_','');
    var placed=false;
    for (var si=0;si<TOWER_SLOTS.length;si++) {
      if (!TOWER_SLOTS[si].type) {
        TOWER_SLOTS[si].type=ttype; TOWER_SLOTS[si].maxHp=TOWER_DEFS[ttype].maxHp; TOWER_SLOTS[si].hp=TOWER_DEFS[ttype].maxHp; TOWER_SLOTS[si].damageCd=0;
        addFloat(TOWER_SLOTS[si].x,TOWER_SLOTS[si].y-40,TOWER_DEFS[ttype].name+'設置！','#FFD700',14);
        spawnP(TOWER_SLOTS[si].x,TOWER_SLOTS[si].y,'levelup',8); placed=true; break;
      }
    }
    if (!placed) {
      for (var si2=0;si2<TOWER_SLOTS.length;si2++) {
        if (TOWER_SLOTS[si2].type===ttype||si2===TOWER_SLOTS.length-1) {
          TOWER_SLOTS[si2].level=Math.min(5,TOWER_SLOTS[si2].level+1);
          addFloat(TOWER_SLOTS[si2].x,TOWER_SLOTS[si2].y-40,TOWER_DEFS[TOWER_SLOTS[si2].type].name+' Lv.'+TOWER_SLOTS[si2].level+'！','#FFD700',14);
          break;
        }
      }
    }
  } else {
    PlayerUpgrades.apply(ch.id);
    if (ch.id==='max_hp') gs.maxEarthHP=PlayerUpgrades.maxHp;
  }
  gs.state='battle';
  if (xp>=xpToNext(level)) gainXP(0);
}

// ── ステージクリア / エンディング ─────────────────────────────────────────────
function doStageClear() {
  gs.state='stageclear'; stageClearTimer=STAGE_CLEAR_FRAMES;
  SoundManager.stageClear();
  spawnP(W/2,H*0.4,'stageclear',30); spawnP(W/4,H*0.3,'stageclear',15); spawnP(W*0.75,H*0.3,'stageclear',15);
  // ステージ10クリア実績
  if (stage===10) {
    if (SaveManager.unlockAchievement('stage_10')) {
      var def10=ACHIEVEMENT_DEFS.find(function(d){return d.id==='stage_10';});
      if (def10) achieveQueue.push({def:def10,timer:ACHIEVE_POPUP_TIME});
    }
  }
}

function advanceStage() {
  if (stage>=TOTAL_STAGES) {
    SaveManager.addCoins(runCoins); runCoins=0;
    if (SaveManager.unlockAchievement('all_clear')) {
      var defAC=ACHIEVEMENT_DEFS.find(function(d){return d.id==='all_clear';});
      if (defAC) achieveQueue.push({def:defAC,timer:ACHIEVE_POPUP_TIME});
    }
    isNewHS=SaveManager.save(score,stage);
    gs.state='ending'; SoundManager.startBgm('title');
  } else {
    stage++; wave=1;
    gs.earthHP=Math.min(gs.maxEarthHP,gs.earthHP+20);
    gs.evoGauge=0; gs.isEvolved=false;
    var bonuses2=getShopBonuses();
    PlayerUpgrades.reset({startAtk:bonuses2.startAtk,startSpd:bonuses2.startSpd,xpGain:bonuses2.xpGain,coinGain:bonuses2.coinGain});
    level=1; xp=0; regenTimer=0; gs.maxEarthHP=100+bonuses2.startHp+bonuses2.startEarth;
    gs.earthHP=Math.min(gs.maxEarthHP,gs.earthHP);
    cds={gunshi:0,nurse:0,barrier:0};
    TOWER_SLOTS.forEach(function(t){t.type=null;t.level=1;t.cd=0;t.hp=0;t.maxHp=0;t.damageCd=0;});
    enemies=[]; bullets=[]; enemyBullets=[]; isHolding=false; poisonDebuff=0;
    stageIntroTimer=STAGE_INTRO_FRAMES; gs.state='stageintro';
  }
}

function endGame() {
  isHolding=false; continueFromStage=stage;
  SaveManager.addCoins(runCoins);
  isNewHS=SaveManager.save(score,stage-1);
  gs.state='gameover'; SoundManager.gameOver(); SoundManager.startBgm('title');
}

// ── Update ────────────────────────────────────────────────────────────────────
function update() {
  frame++;
  // 実績ポップアップ処理
  if (!achievePopup && achieveQueue.length>0) achievePopup=achieveQueue.shift();
  if (achievePopup) { achievePopup.timer--; if(achievePopup.timer<=0) achievePopup=null; }

  switch(gs.state) {
    case 'battle':  updateBattle(); break;
    case 'levelup':
      slowTimer++;
      if (slowTimer%3===0) updateBattle();
      break;
    case 'stageclear': updateStageClear(); break;
    case 'stageintro': updateStageIntro(); break;
    default: break;
  }
}

function updateBattle() {
  playFrames++;

  // 難易度スケール（5分以降急激に上昇）
  var diffBonus=Math.max(0,(playFrames-18000)/3600);  // 5分以降1分毎に加算
  if (bossWarnTimer>0) { bossWarnTimer--; updateParticlesFloats(); return; }

  if (gs.attackCooldown>0) gs.attackCooldown--;
  if (chickHitFx>0) chickHitFx--;
  if (poisonDebuff>0) poisonDebuff--;
  // rapid fire タイマー
  if (PlayerUpgrades.rapidTimer>0) PlayerUpgrades.rapidTimer--;

  for (var k in cds) { if(cds[k]>0) cds[k]--; }
  if (gs.barrierActive) { gs.barrierTimer--; if(gs.barrierTimer<=0) gs.barrierActive=false; }

  if (PlayerUpgrades.regen>0) {
    regenTimer++;
    if (regenTimer>=300) { regenTimer=0; gs.earthHP=Math.min(gs.maxEarthHP,gs.earthHP+PlayerUpgrades.regen); }
  }

  // 自動発射（毒デバフ中は攻撃速度低下）
  if (isHolding&&gs.attackCooldown<=0) {
    var isRapid=PlayerUpgrades.rapidTimer>0;
    var baseCd=Math.max(4,Math.round(16/PlayerUpgrades.atkSpd));
    if (isRapid) baseCd=Math.max(2,Math.round(baseCd*0.25));
    if (poisonDebuff>0) baseCd=Math.round(baseCd*1.4);
    gs.attackCooldown=baseCd;
    fireBullet(holdX,holdY);
  }

  // 進化
  if (!gs.isEvolved&&gs.evoGauge>=100) {
    gs.isEvolved=true;
    gs.evoTimer=[480,600,780,960,1200][Math.min(4,~~((level-1)/3))];
    addFloat(W/2,H*0.4,'にわトリに進化！','#FFD700',26);
    spawnP(CHICK_X,CHICK_Y,'explosion',16);
  }
  if (gs.isEvolved) {
    gs.evoTimer--;
    if (gs.evoTimer<=0) { gs.isEvolved=false; gs.evoGauge=0; addFloat(W/2,H*0.4,'ひよこに戻った...','#aaa',16); }
  }

  // 敵更新
  for (var ei=0;ei<enemies.length;ei++) {
    var e=enemies[ei];
    if (e.dead&&(!e.reviveTimer||e.reviveTimer<=0)) continue;
    var er=e.update(gs.barrierActive,frame,H);
    if (er) {
      if (er.type==='beam'||er.type==='reach') {
        gs.earthHP=Math.max(0,gs.earthHP-er.dmg);
        chickHitFx=22; shakeMag=er.type==='beam'?9:6;
        spawnP(e.x,er.type==='beam'?e.y+e.size*0.5:H-160,'hit_earth',5);
        if (er.type==='beam') { addFloat(W/2,H*0.45,'ドゴーン！','#9B59B6',22); spawnP(e.x,e.y+e.size*0.5,'boss_beam',6); }
        else addFloat(e.x,H-170,'-'+er.dmg,'#FF4444',13);
      } else if (er.type==='poison_reach') {
        gs.earthHP=Math.max(0,gs.earthHP-er.dmg);
        poisonDebuff=480; // 8秒
        chickHitFx=22; shakeMag=5;
        spawnP(e.x,H-160,'poison_fx',10);
        addFloat(W/2,H*0.4,'毒！攻撃速度ダウン！','#88FF44',20);
        addFloat(e.x,H-170,'-'+er.dmg,'#88FF44',13);
      } else if (er.type==='rangedbullet') {
        enemyBullets.push(new EnemyBullet(er.x,er.y,er.dmg)); spawnP(er.x,er.y,'boss_beam',3); SoundManager.hit();
      } else if (er.type==='triple_shot') {
        // 3way弾
        for (var ts=-1;ts<=1;ts++) {
          var tbvx=ts*2.5, tbvy=5.0;
          enemyBullets.push(new EnemyBullet(er.x,er.y,er.dmg,{vx:tbvx,vy:tbvy,size:9,color:'#FF8800'}));
        }
        spawnP(er.x,er.y,'explosion',5); SoundManager.bossWarn();
      } else if (er.type==='snake_spray') {
        // 5方向毒スプレー
        for (var ss=-2;ss<=2;ss++) {
          enemyBullets.push(new EnemyBullet(er.x,er.y,er.dmg,{vx:ss*1.8,vy:4.2,size:8,color:'#88FF44',slow:true}));
        }
        spawnP(er.x,er.y,'poison_fx',8);
      } else if (er.type==='boss_burrow') {
        addFloat(W/2,H*0.4,'ヘビが地中に潜った！','#44FF44',18);
        spawnP(e.x,e.y,'poof',12);
      } else if (er.type==='phase_change') {
        var phaseMsg=er.phase===3?'🔥 FINAL PHASE!! 🔥':'⚡ PHASE '+er.phase+'!! ⚡';
        addFloat(W/2,H*0.3,phaseMsg,'#FF4444',26);
        spawnP(W/2,H*0.35,'explosion',22); shakeMag=14; SoundManager.bossWarn();
        if (er.phase>=2) { spawnMinion(); spawnMinion(); }
      } else if (er.type==='boss_summon') {
        spawnMinion(); spawnMinion();
        addFloat(W/2,H*0.35,'増援召喚！','#FF3333',18);
      } else if (er.type==='heal') {
        var healCount=0;
        enemies.forEach(function(en){ if(!en.dead&&en.type!=='boss'&&en.type!=='boss_chicken'&&en.type!=='boss_snake'&&en.type!=='healer'){ en.hp=Math.min(en.maxHp,en.hp+er.amount); healCount++; } });
        if (healCount>0) { spawnP(e.x,e.y,'levelup',6); addFloat(W/2,H*0.32,'敵が回復した！','#FF88CC',18); }
      } else if (er.type==='bomb') {
        gs.earthHP=Math.max(0,gs.earthHP-er.dmg);
        chickHitFx=22; shakeMag=16;
        spawnP(e.x,H-150,'explosion',22); spawnP(e.x,H-150,'hit_earth',8);
        addFloat(e.x,H-168,'BOOM!! -'+er.dmg,'#FF5500',22); SoundManager.killBig();
      } else if (er.type==='barrier') {
        addFloat(e.x,H-170,'バリア！','#00FFFF',13);
      }
    }
  }
  enemies=enemies.filter(function(e){ return !e.dead||(e.reviveTimer&&e.reviveTimer>0); });

  // 敵弾
  for (var ebi=0;ebi<enemyBullets.length;ebi++) {
    var eb=enemyBullets[ebi];
    if (eb.dead) continue;
    var ebr=eb.update(H);
    if (ebr&&ebr.type==='hit_earth') {
      gs.earthHP=Math.max(0,gs.earthHP-ebr.dmg);
      chickHitFx=22; shakeMag=6;
      spawnP(eb.x,H-160,'hit_earth',4);
      addFloat(eb.x,H-172,'-'+ebr.dmg,eb.color==='#88FF44'?'#88FF44':'#FF6600',13);
      // 毒弾着弾で毒デバフ
      if (eb.color==='#88FF44') { poisonDebuff=300; addFloat(W/2,H*0.42,'毒攻撃！','#88FF44',16); spawnP(eb.x,H-160,'poison_fx',6); }
    }
  }
  enemyBullets=enemyBullets.filter(function(eb){return !eb.dead;});

  // プレイヤー弾
  for (var bi=0;bi<bullets.length;bi++) {
    var b=bullets[bi];
    if (b.dead) continue;
    var br=b.update(enemies);
    if (br) {
      if (br.type==='explode') {
        spawnP(br.x,br.y,'explosion',16);
        enemies.forEach(function(en){ if(!en.dead){var dx2=br.x-en.x,dy2=br.y-en.y; if(Math.sqrt(dx2*dx2+dy2*dy2)<95){var k2=en.takeDamage(5);if(k2)onKill(en);}} });
        gs.earthHP=Math.min(gs.maxEarthHP,gs.earthHP+3);
        addFloat(br.x,br.y-20,'+HP','#2ECC71',14);
      } else if (br.type==='hit') {
        if (br.killed) onKill(br.enemy);
        spawnP(b.x,b.y,br.crit?'crit':'hit',br.crit?6:2);
        if (br.crit) { addFloat(b.x,b.y-10,'CRIT!','#FF3333',15); spawnP(b.x,b.y,'crit',3); }
        SoundManager.hit();
      }
    }
  }
  bullets=bullets.filter(function(b){return !b.dead;});
  enemies=enemies.filter(function(e){return !e.dead||(e.reviveTimer&&e.reviveTimer>0);});

  updateTowers();
  updateParticlesFloats();

  gs.earthHP=Math.max(0,Math.min(gs.maxEarthHP,gs.earthHP));
  if (gs.earthHP<=0) { endGame(); return; }

  // Wave/Stage進行
  if (waveSpawned<waveTotal) {
    waveTimer++;
    // 時間スケールで敵出現間隔を短縮
    var baseInterval=wave===WAVES_PER_STAGE?1:Math.max(18,85-stage*5-Math.floor(diffBonus*3));
    if (waveTimer>=baseInterval) { waveTimer=0; spawnEnemy(); waveSpawned++; }
  } else if (enemies.length===0) {
    if (wave===WAVES_PER_STAGE) {
      doStageClear();
    } else {
      wave++; startWave();
    }
  }

  checkAchievements();
}

function updateStageClear() { stageClearTimer--; updateParticlesFloats(); if(stageClearTimer<=0) advanceStage(); }
function updateStageIntro() { stageIntroTimer--; updateParticlesFloats(); if(stageIntroTimer<=0){gs.state='battle';startWave();} }

function updateTowers() {
  TOWER_SLOTS.forEach(function(t) {
    if (!t.type) return;
    var def=TOWER_DEFS[t.type];
    if (t.cd>0) { t.cd--; return; }
    var nearest=null, nearestDist=def.range;
    for (var ei=0;ei<enemies.length;ei++) {
      var en=enemies[ei];
      if (en.dead) continue;
      var dx=en.x-t.x, dy=en.y-t.y, d=Math.sqrt(dx*dx+dy*dy);
      if (d<nearestDist) { nearest=en; nearestDist=d; }
    }
    if (nearest) {
      t.cd=def.cdMax;
      bullets.push(new Bullet(t.x,t.y,nearest.x,nearest.y,{
        damage:def.dmg*t.level,pierce:t.type==='support'?3:0,
        crit:false,evolved:false,bulletSpd:t.type==='sniper'?1.4:1.0,rangeMult:3.0
      }));
      spawnP(t.x,t.y-10,'hit',1);
    }
    if (t.damageCd>0) t.damageCd--;
    for (var di=0;di<enemies.length;di++) {
      var en2=enemies[di]; if(en2.dead) continue;
      var ex=en2.x-t.x, ey=en2.y-t.y;
      if (Math.sqrt(ex*ex+ey*ey)<38&&t.damageCd===0) {
        t.hp-=en2.dmg>0?en2.dmg:3; t.damageCd=45; spawnP(t.x,t.y,'hit',3);
        if (t.hp<=0) { addFloat(t.x,t.y-30,TOWER_DEFS[t.type].name+'破壊！','#FF4444',14); spawnP(t.x,t.y,'explosion',12); t.type=null;t.hp=0;t.maxHp=0;t.level=1;t.cd=0;t.damageCd=0; }
        break;
      }
    }
  });
}

function updateParticlesFloats() {
  particles.forEach(function(p){p.update();}); particles=particles.filter(function(p){return p.life>0;});
  floats.forEach(function(f){f.update();}); floats=floats.filter(function(f){return f.life>0;});
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function draw() {
  ctx.clearRect(0,0,W,H);
  var doShake=shakeMag>0.5;
  if (doShake) {
    shakeX=(Math.random()-0.5)*shakeMag*2; shakeY=(Math.random()-0.5)*shakeMag*2;
    shakeMag*=0.76; ctx.save(); ctx.translate(shakeX,shakeY);
  }
  switch(gs.state) {
    case 'title':        drawTitleScr();      break;
    case 'howto':        drawHowToScr();      break;
    case 'battle':       drawBattleScr();     break;
    case 'stageclear':   drawStageClearScr(); break;
    case 'stageintro':   drawStageIntroScr(); break;
    case 'levelup':      drawBattleScr(); drawLevelUp(levelChoices,level); break;
    case 'paused':       drawPauseScr();      break;
    case 'gameover':     drawGameOverScr();   break;
    case 'ending':       drawEndingScr();     break;
    case 'settings':     drawSettingsScr();   break;
    case 'bestiary':     drawBestiaryScr();   break;
    case 'achievements': drawAchievementsScr(); break;
  }
  if (doShake) ctx.restore();
  // 実績ポップアップ（常に最前面）
  if (achievePopup) drawAchievementPopup(achievePopup.def,achievePopup.timer,ACHIEVE_POPUP_TIME);
}

function drawTitleScr() {
  var h=SaveManager.getHigh();
  drawTitle(frame,h.score,h.stage,SoundManager.bgmOn,SoundManager.seOn,SaveManager.getCoins());
}
function drawHowToScr()      { drawHowTo(frame); }
function drawSettingsScr()   { drawSettings(frame,SoundManager.bgmOn,SoundManager.seOn); }
function drawBestiaryScr()   { drawBestiary(frame); }
function drawAchievementsScr(){ drawAchievements(frame); }
function drawPauseScr()      { drawBattleScr(true); drawPause(stage,wave,score); }
function drawGameOverScr()   { var h=SaveManager.getHigh(); drawGameOver(score,stage,wave,kills,isNewHS,h.score,h.stage,frame,runCoins); }
function drawEndingScr()     { drawEnding(score,kills,playFrames,isNewHS,SaveManager.getHigh().score,frame,runCoins); }
function drawStageClearScr() { drawBattleScr(true); drawStageClear(stage,TOTAL_STAGES,stageClearTimer,STAGE_CLEAR_FRAMES,frame); }
function drawStageIntroScr() { drawBattleScr(true); drawStageIntro(stage,stageIntroTimer,STAGE_INTRO_FRAMES); }

function drawBattleScr(frozenBg) {
  drawBg(frame,stage);
  drawGround(stage);
  drawEvoBar(gs.evoGauge,gs.isEvolved,gs.evoTimer);
  drawHudTop(gs.earthHP,gs.maxEarthHP,gs.barrierActive,stage,wave,WAVES_PER_STAGE,score,level,xp,xpToNext(level),kills,SaveManager.getHigh().score,frame,runCoins,poisonDebuff);
  TOWER_SLOTS.forEach(function(slot){drawTower(slot,!!frozenBg);});

  enemies.forEach(function(e){
    if (e.dead&&e.reviveTimer>0) return; // 復活待機中は非表示
    var isBoss=(e.type==='boss'||e.type==='boss_chicken'||e.type==='boss_snake');
    if (isBoss) drawBoss(e,frame); else drawCrow(e);
  });

  bullets.forEach(function(b){
    if (b.evolved){drawEgg(b.x,b.y);}
    else {
      ctx.save();
      ctx.shadowColor=b.crit?'#FF3333':'#FFE040'; ctx.shadowBlur=10;
      ctx.translate(b.x,b.y); ctx.rotate(b.rot+Math.PI/2);
      drawChick(0,0,11,false);
      ctx.shadowBlur=0; ctx.restore();
    }
  });

  particles.forEach(function(p){drawParticle(p);});
  enemyBullets.forEach(function(eb){drawEnemyBullet(eb);});

  floats.forEach(function(ft){
    ctx.globalAlpha=Math.min(1,ft.life/25);
    ctx.fillStyle=ft.color; ctx.font='bold '+ft.size+'px "Kosugi Maru",sans-serif'; ctx.textAlign='center';
    ctx.strokeStyle='rgba(0,0,0,0.7)'; ctx.lineWidth=4;
    ctx.strokeText(ft.text,ft.x,ft.y); ctx.fillText(ft.text,ft.x,ft.y);
    ctx.globalAlpha=1;
  });

  var bob=Math.sin(frame*0.1)*3;
  if (gs.isEvolved) {
    ctx.globalAlpha=0.18+Math.sin(frame*0.12)*0.08; ctx.fillStyle='#FFD700';
    ctx.beginPath(); ctx.arc(CHICK_X,CHICK_Y,65,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
  }
  // 毒デバフ中：緑オーバーレイ
  if (poisonDebuff>0) {
    var pa2=Math.min(1,poisonDebuff/60)*0.12+Math.abs(Math.sin(frame*0.08))*0.04;
    ctx.globalAlpha=pa2; ctx.fillStyle='#44FF44'; ctx.fillRect(0,0,W,H); ctx.globalAlpha=1;
  }
  drawChick(CHICK_X,CHICK_Y+bob,gs.isEvolved?56:44,gs.isEvolved);

  if (gs.barrierActive) {
    ctx.globalAlpha=0.22+Math.sin(frame*0.15)*0.08; ctx.strokeStyle='#00FFFF'; ctx.lineWidth=5;
    ctx.beginPath(); ctx.arc(W/2,H*0.48,W*0.7,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha=0.06; ctx.fillStyle='#00FFFF'; ctx.fill(); ctx.globalAlpha=1;
  }

  if (chickHitFx>0&&!frozenBg) {
    var cfa=chickHitFx/22;
    ctx.save(); ctx.globalAlpha=cfa*0.85; ctx.shadowColor='#FF2222'; ctx.shadowBlur=28;
    ctx.strokeStyle='#FF4444'; ctx.lineWidth=3+cfa*4;
    ctx.beginPath(); ctx.arc(CHICK_X,CHICK_Y,(gs.isEvolved?56:44)*0.75,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha=1; ctx.shadowBlur=0; ctx.restore();
    var dfa=cfa*0.52;
    var dfg=ctx.createRadialGradient(W/2,H*0.5,H*0.12,W/2,H*0.5,H*0.82);
    dfg.addColorStop(0,'rgba(255,30,30,0)'); dfg.addColorStop(1,'rgba(255,30,30,'+dfa.toFixed(3)+')');
    ctx.fillStyle=dfg; ctx.fillRect(0,0,W,H);
  }

  if (isHolding&&!frozenBg) {
    var pulseR=18+Math.sin(frame*0.3)*4;
    ctx.globalAlpha=0.42+Math.sin(frame*0.3)*0.14; ctx.shadowColor='#FFD700'; ctx.shadowBlur=16;
    ctx.strokeStyle='#FFD700'; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.arc(holdX,holdY,pulseR,0,Math.PI*2); ctx.stroke();
    ctx.shadowBlur=0; ctx.globalAlpha=1;
  }

  drawCompanionBtns(upg,cds,CD_MAX,frame);
  if (bossWarnTimer>0) drawBossWarn(bossWarnTimer,BOSS_WARN_FRAMES);
}

// ── Input ─────────────────────────────────────────────────────────────────────
function getCanvasXY(e) {
  var r=canvas.getBoundingClientRect();
  return {tx:(e.clientX-r.left)*(W/r.width), ty:(e.clientY-r.top)*(H/r.height)};
}

function handleBattlePointerDown(tx, ty) {
  if (tx>W-52&&ty<48) { gs.state='paused'; isHolding=false; return; }
  var BY=H-65, BR=30, BPOS=[50,W/2,W-50];
  for (var bi=0;bi<BPOS.length;bi++) {
    var dx=tx-BPOS[bi], dy=ty-BY;
    if (Math.sqrt(dx*dx+dy*dy)<BR+8) { activateSkill(['gunshi','nurse','barrier'][bi]); return; }
  }
  isHolding=true; holdX=tx; holdY=ty;
}

function handleMenuTap(tx, ty) {
  var pulse=Math.sin(frame*0.07)*5; // START button pulse offset
  switch(gs.state) {
    case 'title':
      // START: y=486+pulse to 542+pulse (approx y=480-550 safe zone)
      if (ty>=476&&ty<=556&&tx>=72&&tx<=318) {
        initGame(); SoundManager.startBgm('battle');
      }
      // 図鑑: y=558-604, x=50-190
      else if (ty>=556&&ty<=608&&tx>=50&&tx<=190) { gs.state='bestiary'; }
      // 実績: y=558-604, x=204-344
      else if (ty>=556&&ty<=608&&tx>=200&&tx<=344) { gs.state='achievements'; }
      // 設定/ショップ: y=614-664, x=50-344
      else if (ty>=612&&ty<=666&&tx>=50&&tx<=344) { gs.state='settings'; }
      break;

    case 'howto':
      if (ty>=748&&ty<=806) gs.state='title';
      break;

    case 'settings':
      // ショップ購入（y=110+i*112 to 110+i*112+90）
      if (ty>=108&&ty<108+SHOP_ITEMS.length*112&&tx>=18&&tx<=W-18) {
        var shopIdx=Math.floor((ty-108)/112);
        if (shopIdx>=0&&shopIdx<SHOP_ITEMS.length) {
          var item=SHOP_ITEMS[shopIdx];
          var lv=SaveManager.getShopLevel(item.id);
          if (lv<item.maxLv) {
            var cost=item.costs[lv];
            if (SaveManager.spendCoins(cost)) {
              SaveManager.setShopLevel(item.id,lv+1);
              SoundManager.levelUp();
              spawnP&&spawnP(W/2,H/2,'coin',5);
            }
          }
        }
      }
      // BGM: y=780-828, x=18 to W/2+4
      else if (ty>=778&&ty<=830&&tx>=18&&tx<=W/2+4) { SoundManager.toggleBgm(); SoundManager.startBgm('title'); }
      // SE: y=780-828, x=W/2+8 to W-18
      else if (ty>=778&&ty<=830&&tx>=W/2+8&&tx<=W-18) { SoundManager.toggleSe(); }
      // 戻る: y=838-890
      else if (ty>=838&&ty<=892) { gs.state='title'; }
      break;

    case 'bestiary':
      if (ty>=788&&ty<=840) gs.state='title';
      break;

    case 'achievements':
      if (ty>=778&&ty<=830) gs.state='title';
      break;

    case 'levelup':
      for (var i=0;i<levelChoices.length;i++) {
        if (ty>=258+i*184&&ty<258+i*184+168&&tx>=20&&tx<=W-20) { applyLevelUp(i); break; }
      }
      break;

    case 'paused':
      if      (ty>=358&&ty<=416) { gs.state='battle'; }
      else if (ty>=436&&ty<=494) { initGame(); SoundManager.startBgm('battle'); }
      else if (ty>=514&&ty<=572) { gs.state='title'; SoundManager.startBgm('title'); }
      break;

    case 'gameover':
      if      (ty>=564&&ty<=622&&tx>=44&&tx<=W-44) { initGameContinue(continueFromStage); SoundManager.startBgm('battle'); }
      else if (ty>=628&&ty<=678&&tx>=44&&tx<=W-44) { initGame(); SoundManager.startBgm('battle'); }
      else if (ty>=684&&ty<=732&&tx>=44&&tx<=W-44) { gs.state='title'; SoundManager.startBgm('title'); }
      break;

    case 'ending':
      if      (ty>=680&&ty<=738&&tx>=55&&tx<=W-55) { initGame(); SoundManager.startBgm('battle'); }
      else if (ty>=744&&ty<=794&&tx>=55&&tx<=W-55) { gs.state='title'; SoundManager.startBgm('title'); }
      break;
  }
}

canvas.addEventListener('pointerdown',function(e){
  e.preventDefault(); SoundManager.resume();
  var p=getCanvasXY(e);
  if (gs.state==='battle'&&bossWarnTimer<=0) { handleBattlePointerDown(p.tx,p.ty); }
  else if (gs.state==='battle'||gs.state==='stageclear') { /* ignore */ }
  else if (gs.state==='stageintro') { stageIntroTimer=0; updateStageIntro(); }
  else { handleMenuTap(p.tx,p.ty); }
},{passive:false});

canvas.addEventListener('pointermove',function(e){ if(!isHolding) return; var p=getCanvasXY(e); holdX=p.tx; holdY=p.ty; },{passive:true});
canvas.addEventListener('pointerup',    function(){isHolding=false;});
canvas.addEventListener('pointercancel',function(){isHolding=false;});
canvas.addEventListener('pointerleave', function(){isHolding=false;});

// ── Main loop ─────────────────────────────────────────────────────────────────
SoundManager.startBgm('title');
function loop(){update();draw();requestAnimationFrame(loop);}
loop();
