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
var CHICK_X = W/2;      // 毎フレーム chickCurrentX から更新
var CHICK_Y = H - 148;
var TOTAL_STAGES = 20;
var WAVES_PER_STAGE = 5;

// ── スキルCD（ステージ別動的計算）─────────────────────────────────────────────
function getCdMax(id) {
  if (id === 'nurse') {
    if (stage <= 5)  return Math.round(300 * PlayerUpgrades.nurseCdMult);
    if (stage <= 10) return Math.round(360 * PlayerUpgrades.nurseCdMult);
    if (stage <= 15) return Math.round(450 * PlayerUpgrades.nurseCdMult);
    return Math.round(540 * PlayerUpgrades.nurseCdMult);
  }
  if (id === 'gunshi') {
    if (stage <= 5)  return 300;
    if (stage <= 10) return 390;
    if (stage <= 15) return 480;
    return 540;
  }
  // barrier
  if (stage <= 5)  return 360;
  if (stage <= 10) return 420;
  if (stage <= 15) return 510;
  return 600;
}

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
var TOWER_SLOTS = makeTowerSlots();

// ── ゲーム状態 ───────────────────────────────────────────────────────────────
var gs = {state:'title'};
var upg = {}, cds = {};
var enemies=[], bullets=[], particles=[], floats=[], enemyBullets=[];
var dropItems = [];        // ドロップ強化アイテム
var laneWarnings = [];     // [{lanes:[0,1], timer:45, maxTimer:45, dmg:8}]

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

// レーン制プレイヤー
var chickLane = 1;           // 0=左 1=中央 2=右
var chickCurrentX = W / 2;   // 補間中の実際のX座標

// ドロップ強化
var lastDropId = null;

// 新システム
var runCoins = 0;
var coinGainMult = 1.0;
var poisonDebuff = 0;
var achieveQueue = [];
var achievePopup = null;
var ACHIEVE_POPUP_TIME = 180;
var bossKillFlags = {};     // {boss_s3: true, ...}
var waveStartHp = 100;

// スワイプ検出
var swipeStartX = 0, swipeStartY = 0, swipeStartTime = 0;
var isHolding = false, holdX = W/2, holdY = H/3;

function xpToNext(lv) { return 6 + lv * 3; }

// ── ショップボーナス ─────────────────────────────────────────────────────────
function getShopBonuses() {
  var lvls = SaveManager.getShopLevels();
  return {
    startHp:    (lvls.start_hp    ||0)*10,
    startAtk:   (lvls.start_atk   ||0)*1,
    startSpd:   Math.pow(1.10, lvls.start_spd   ||0),
    xpGain:     Math.pow(1.15, lvls.xp_gain     ||0),
    coinGain:   Math.pow(1.25, lvls.coin_gain   ||0),
    startEarth: (lvls.start_earth ||0)*15,
  };
}

// ── Wave config ───────────────────────────────────────────────────────────────
function getBossType(stg) {
  return 'boss_s' + stg;   // 20ステージ各固有ボス
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
  return wv<=2?['ghost','ghost','healer','poison','phantom']:['ghost','healer','healer','titan','necro'];
}

function waveCount(stg, wv) {
  if (wv===WAVES_PER_STAGE) return 1;
  var base=4+stg+wv-1;
  if (stg>=15) base=Math.round(base*1.5);
  return Math.min(28, base);
}

// ── Init ──────────────────────────────────────────────────────────────────────
function initGame() {
  var bonuses = getShopBonuses();
  var startHp = 100 + bonuses.startHp + bonuses.startEarth;
  gs = {state:'stageintro',earthHP:startHp,maxEarthHP:startHp,evoGauge:0,isEvolved:false,evoTimer:0,isAngel:false,angelTimer:0,attackCooldown:0,barrierActive:false,barrierTimer:0};
  upg = {gunshi:true,nurse:true,barrier:true};
  cds = {gunshi:0,nurse:0,barrier:0};
  coinGainMult = bonuses.coinGain;
  PlayerUpgrades.reset({startAtk:bonuses.startAtk,startSpd:bonuses.startSpd,xpGain:bonuses.xpGain,coinGain:bonuses.coinGain});
  enemies=[]; bullets=[]; enemyBullets=[]; particles=[]; floats=[];
  dropItems=[]; laneWarnings=[];
  TOWER_SLOTS.forEach(function(t){t.type=null;t.level=1;t.cd=0;t.hp=0;t.maxHp=0;t.damageCd=0;});
  stage=1; wave=1; waveSpawned=0; waveTotal=0; waveTimer=0;
  bossWarnTimer=0; stageClearTimer=0;
  score=0; kills=0; isNewHS=false; runCoins=0; poisonDebuff=0;
  level=1; xp=0; regenTimer=0; playFrames=0;
  isHolding=false; chickHitFx=0;
  stageIntroTimer=STAGE_INTRO_FRAMES;
  bossKillFlags={};
  waveStartHp=gs.earthHP;
  achieveQueue=[]; achievePopup=null;
  chickLane=1; chickCurrentX=W/2; CHICK_X=W/2;
  lastDropId=null;
}

function initGameContinue(fromStage) {
  var bonuses = getShopBonuses();
  var startHp = 100 + bonuses.startHp + bonuses.startEarth;
  gs = {state:'stageintro',earthHP:startHp,maxEarthHP:startHp,evoGauge:0,isEvolved:false,evoTimer:0,isAngel:false,angelTimer:0,attackCooldown:0,barrierActive:false,barrierTimer:0};
  upg = {gunshi:true,nurse:true,barrier:true};
  cds = {gunshi:0,nurse:0,barrier:0};
  coinGainMult = bonuses.coinGain;
  PlayerUpgrades.reset({startAtk:bonuses.startAtk,startSpd:bonuses.startSpd,xpGain:bonuses.xpGain,coinGain:bonuses.coinGain});
  enemies=[]; bullets=[]; enemyBullets=[]; particles=[]; floats=[];
  dropItems=[]; laneWarnings=[];
  TOWER_SLOTS.forEach(function(t){t.type=null;t.level=1;t.cd=0;t.hp=0;t.maxHp=0;t.damageCd=0;});
  stage=fromStage; wave=1; waveSpawned=0; waveTotal=0; waveTimer=0;
  bossWarnTimer=0; stageClearTimer=0;
  score=0; kills=0; isNewHS=false; runCoins=0; poisonDebuff=0;
  level=1; xp=0; regenTimer=0; playFrames=0;
  isHolding=false; chickHitFx=0;
  stageIntroTimer=STAGE_INTRO_FRAMES;
  bossKillFlags={};
  waveStartHp=gs.earthHP;
  achieveQueue=[]; achievePopup=null;
  chickLane=1; chickCurrentX=W/2; CHICK_X=W/2;
  lastDropId=null;
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
  var types = waveTypes(stage,wave);
  var type  = typeOverride || types[~~(Math.random()*types.length)];
  var isBoss = (type==='boss'||type==='boss_chicken'||type==='boss_snake'||type.startsWith('boss_s'));
  var x = 55 + Math.random()*(W-110), y = isBoss ? 190 : -60;
  enemies.push(new Enemy(type,x,y,stage,wave));
}

function spawnMinion() {
  var minionTypes = waveTypes(stage,Math.max(1,wave-1)).filter(function(t){
    return t!=='boss'&&t!=='boss_chicken'&&t!=='boss_snake'&&!t.startsWith('boss_s');
  });
  if (!minionTypes.length) minionTypes=['normal'];
  var type = minionTypes[~~(Math.random()*minionTypes.length)];
  enemies.push(new Enemy(type,55+Math.random()*(W-110),-60,stage,wave));
}

// ── ヘルパー ─────────────────────────────────────────────────────────────────
function spawnP(x,y,type,n) { for (var i=0;i<n;i++) particles.push(new Particle(x,y,type)); }
function addFloat(x,y,text,color,size) { floats.push(new FloatingText(x,y,text,color||'#FFD700',size||18)); }

// ── レーン移動 ────────────────────────────────────────────────────────────────
function changeLane(dir) {
  var newLane = Math.max(0, Math.min(2, chickLane + dir));
  if (newLane !== chickLane) {
    chickLane = newLane;
    SoundManager.shoot(); // 小さなフィードバック音
  }
}

// ── スキル ────────────────────────────────────────────────────────────────────
function activateSkill(id) {
  if (!upg[id] || cds[id]>0) return;
  cds[id] = getCdMax(id);
  switch(id) {
    case 'gunshi':
      var gunDmg = 25 + PlayerUpgrades.gunshiBonus;
      enemies.forEach(function(e){ if(!e.dead){var k=e.takeDamage(gunDmg);spawnP(e.x,e.y,'explosion',6);if(k)onKill(e);} });
      spawnP(W/2,H/2,'explosion',20); addFloat(W/2,H*0.38,'一斉突撃！','#FF4444',28); break;
    case 'nurse':
      gs.earthHP=Math.min(gs.maxEarthHP,gs.earthHP+50);
      spawnP(W/2,H*0.3,'hit',22); addFloat(W/2,H*0.38,'地球大回復！','#FF69B4',26); break;
    case 'barrier':
      gs.barrierActive=true;
      gs.barrierTimer=300+PlayerUpgrades.barrierExt;
      addFloat(W/2,H*0.38,'絶対防壁！','#00FFFF',26); break;
  }
}

// ── 発射 ──────────────────────────────────────────────────────────────────────
function fireBullet(tx, ty) {
  var pu = PlayerUpgrades;
  var crit = Math.random()<pu.critChance;
  var angelMult = gs.isAngel ? 3 : 1;
  var opts = {damage:pu.atk*angelMult,pierce:pu.pierce,crit:crit,evolved:gs.isEvolved&&!gs.isAngel,angel:gs.isAngel,bulletSpd:pu.bulletSpd,rangeMult:pu.rangeMult,explode:pu.explodeShot};
  bullets.push(new Bullet(CHICK_X,CHICK_Y-20,tx,ty,opts));
  if (pu.doubleShot) {
    bullets.push(new Bullet(CHICK_X-14,CHICK_Y-20,tx,ty,opts));
    bullets.push(new Bullet(CHICK_X+14,CHICK_Y-20,tx,ty,opts));
  }
  if (pu.spreadShot) {
    bullets.push(new Bullet(CHICK_X,CHICK_Y-20,tx-90,ty,opts));
    bullets.push(new Bullet(CHICK_X,CHICK_Y-20,tx+90,ty,opts));
  }
  SoundManager.shoot();
  var piyoColor = gs.isAngel ? '#AADDFF' : '#FF6B6B';
  spawnP(CHICK_X+(Math.random()-0.5)*30,CHICK_Y-50,'hit',1);
  addFloat(CHICK_X+(Math.random()-0.5)*40,CHICK_Y-56,'ピヨ！',piyoColor,13);
}

// ── 撃破 ──────────────────────────────────────────────────────────────────────
function onKill(e) {
  kills++;
  var pts = Math.round(e.pts*PlayerUpgrades.scoreMulti);
  score += pts;
  var coinBase = Math.max(1,Math.ceil(e.pts/5));
  var earnedCoins = Math.ceil(coinBase*coinGainMult);
  runCoins += earnedCoins;
  spawnP(e.x,e.y-10,'coin',3);
  addFloat(e.x+15,e.y-10,'🪙'+earnedCoins,'#FFD700',12);

  // 図鑑記録（新ボスは旧タイプに統合）
  if (e.type.startsWith('boss_s')) {
    var sn = parseInt(e.type.replace('boss_s',''));
    SaveManager.recordKill(sn<=7?'boss_chicken':sn<=14?'boss_snake':'boss');
  } else {
    SaveManager.recordKill(e.type);
  }

  gs.evoGauge=Math.min(100,gs.evoGauge+(
    e.type.startsWith('boss_s')||e.type==='boss'||e.type==='boss_chicken'||e.type==='boss_snake'?50:
    e.type==='tank'||e.type==='titan'?18:
    e.type==='splitter'||e.type==='healer'?18:
    e.type==='necro'?15:10
  ));
  spawnP(e.x,e.y,'poof',8);
  addFloat(e.x,e.y-24,'+'+pts,'#FFD700',14);
  if (e.type.startsWith('boss_s')||e.type==='boss'||e.type==='boss_chicken'||e.type==='boss_snake'||e.type==='tank'||e.type==='titan') SoundManager.killBig();
  else SoundManager.kill();

  // 分裂
  if (e.type==='splitter') {
    enemies.push(new Enemy('swarm',e.x-22,e.y,stage,wave));
    enemies.push(new Enemy('swarm',e.x+22,e.y,stage,wave));
    addFloat(e.x,e.y-20,'分裂！','#CC44FF',16);
    spawnP(e.x,e.y,'explosion',10);
  }

  // ボス撃破フラグ
  if (e.type.startsWith('boss_s')) {
    bossKillFlags[e.type] = true;
    spawnP(W/2,H*0.4,'stageclear',30);
  } else if (e.type==='boss_chicken'||e.type==='boss_snake'||e.type==='boss') {
    bossKillFlags[e.type] = true;
    spawnP(W/2,H*0.4,'stageclear',30);
  }

  gainXP(Math.round(e.xpGain*PlayerUpgrades.xpMult));
  checkAchievements();
}

// ── 実績チェック ─────────────────────────────────────────────────────────────
function checkAchievements() {
  var tryUnlock = function(id) {
    if (SaveManager.unlockAchievement(id)) {
      var def = ACHIEVEMENT_DEFS.find(function(d){return d.id===id;});
      if (def) { achieveQueue.push({def:def,timer:ACHIEVE_POPUP_TIME}); spawnP(W/2,H*0.5,'achieve',14); }
    }
  };
  if (kills>=100)  tryUnlock('kill_100');
  if (kills>=1000) tryUnlock('kill_1000');
  if (level>=20)   tryUnlock('level_20');
  if (playFrames>=600*60) tryUnlock('survive_10m');

  var bossKillCount = Object.keys(bossKillFlags).filter(function(k){return bossKillFlags[k];}).length;
  if (bossKillCount>=1) tryUnlock('boss_first');
  if (bossKillCount>=3) tryUnlock('kill_boss_3');

  var bestiary = SaveManager.getBestiary();
  var bTypes   = BESTIARY_TYPES;
  var found    = bTypes.filter(function(t){return bestiary[t]>0;}).length;
  if (found>=10) tryUnlock('bestiary_10');
  if (found>=bTypes.length) tryUnlock('bestiary_all');

  if (gs.earthHP>=gs.maxEarthHP&&waveSpawned>=waveTotal) tryUnlock('no_dmg_wave');
}

// ── ドロップ強化適用 ──────────────────────────────────────────────────────────
function applyDropUpgrade(upg) {
  if (upg.id === 'hp_heal') {
    gs.earthHP = Math.min(gs.maxEarthHP, gs.earthHP + 30);
    addFloat(CHICK_X, CHICK_Y-40, '+30 HP！', '#FF69B4', 20);
  } else if (upg.id === 'cd_reset') {
    cds.gunshi=0; cds.nurse=0; cds.barrier=0;
    addFloat(CHICK_X, CHICK_Y-40, 'CD全リセット！', '#00FFFF', 18);
  } else if (upg.id === 'angel_evo') {
    gs.isAngel = true; gs.angelTimer = 900;
    addFloat(CHICK_X, CHICK_Y-50, '😇 エンジェル進化！', '#AADDFF', 24);
    spawnP(CHICK_X, CHICK_Y, 'levelup', 22);
  } else {
    PlayerUpgrades.apply(upg.id);
    if (upg.id === 'max_hp') gs.maxEarthHP = PlayerUpgrades.maxHp;
    var c = (upg.id==='spread_shot'||upg.id==='leech_shot'||upg.id==='angel_atk') ? '#AADDFF' : '#FFD700';
    addFloat(CHICK_X, CHICK_Y-40, upg.name+'！', c, 16);
  }
}

// ── レベルアップ（ドロップ式）────────────────────────────────────────────────
function gainXP(amount) {
  xp += amount;
  while (xp >= xpToNext(level)) {
    xp -= xpToNext(level); level++;
    SoundManager.levelUp();
    spawnP(CHICK_X, CHICK_Y, 'levelup', 22);
    addFloat(W/2, H*0.38, 'LEVEL UP! Lv.'+level, '#FFD700', 24);
    // 強化アイテムをフィールドにドロップ
    var dropUpg = pickDropUpgrade(stage, lastDropId);
    dropItems.push(new DropItem(dropUpg, chickLane));
    addFloat(LANE_X[Math.max(0,Math.min(2,chickLane))], H*0.5, dropUpg.icon+' ゲットして！', '#AAFFEE', 14);
  }
}

// ── ステージクリア ────────────────────────────────────────────────────────────
function doStageClear() {
  gs.state='stageclear'; stageClearTimer=STAGE_CLEAR_FRAMES;
  SoundManager.stageClear();
  spawnP(W/2,H*0.4,'stageclear',30); spawnP(W/4,H*0.3,'stageclear',15); spawnP(W*0.75,H*0.3,'stageclear',15);
  if (stage===10) {
    if (SaveManager.unlockAchievement('stage_10')) {
      var def10 = ACHIEVEMENT_DEFS.find(function(d){return d.id==='stage_10';});
      if (def10) achieveQueue.push({def:def10,timer:ACHIEVE_POPUP_TIME});
    }
  }
}

function advanceStage() {
  if (stage>=TOTAL_STAGES) {
    SaveManager.addCoins(runCoins); runCoins=0;
    if (SaveManager.unlockAchievement('all_clear')) {
      var defAC = ACHIEVEMENT_DEFS.find(function(d){return d.id==='all_clear';});
      if (defAC) achieveQueue.push({def:defAC,timer:ACHIEVE_POPUP_TIME});
    }
    isNewHS=SaveManager.save(score,stage);
    gs.state='ending'; SoundManager.startBgm('title');
  } else {
    stage++; wave=1;
    gs.earthHP=Math.min(gs.maxEarthHP,gs.earthHP+20);
    gs.evoGauge=0; gs.isEvolved=false; gs.isAngel=false; gs.angelTimer=0;
    var bonuses2 = getShopBonuses();
    PlayerUpgrades.reset({startAtk:bonuses2.startAtk,startSpd:bonuses2.startSpd,xpGain:bonuses2.xpGain,coinGain:bonuses2.coinGain});
    level=1; xp=0; regenTimer=0; gs.maxEarthHP=100+bonuses2.startHp+bonuses2.startEarth;
    gs.earthHP=Math.min(gs.maxEarthHP,gs.earthHP);
    cds={gunshi:0,nurse:0,barrier:0};
    TOWER_SLOTS.forEach(function(t){t.type=null;t.level=1;t.cd=0;t.hp=0;t.maxHp=0;t.damageCd=0;});
    enemies=[]; bullets=[]; enemyBullets=[]; dropItems=[]; laneWarnings=[]; isHolding=false; poisonDebuff=0;
    stageIntroTimer=STAGE_INTRO_FRAMES; gs.state='stageintro';
    lastDropId=null;
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
  if (!achievePopup && achieveQueue.length>0) achievePopup=achieveQueue.shift();
  if (achievePopup) { achievePopup.timer--; if(achievePopup.timer<=0) achievePopup=null; }

  switch(gs.state) {
    case 'battle':    updateBattle(); break;
    case 'stageclear': updateStageClear(); break;
    case 'stageintro': updateStageIntro(); break;
    default: break;
  }
}

function updateBattle() {
  playFrames++;

  var diffBonus = Math.max(0,(playFrames-18000)/3600);
  if (bossWarnTimer>0) { bossWarnTimer--; updateParticlesFloats(); return; }

  // ── レーン補間 ─────────────────────────────────────────────────────────────
  var targetX = LANE_X[chickLane];
  if (Math.abs(chickCurrentX - targetX) < 6) {
    chickCurrentX = targetX;
  } else {
    chickCurrentX += (targetX - chickCurrentX) * 0.22;
  }
  CHICK_X = Math.round(chickCurrentX);

  if (gs.attackCooldown>0) gs.attackCooldown--;
  if (chickHitFx>0) chickHitFx--;
  if (poisonDebuff>0) poisonDebuff--;
  if (PlayerUpgrades.rapidTimer>0) PlayerUpgrades.rapidTimer--;

  for (var k in cds) { if(cds[k]>0) cds[k]--; }
  if (gs.barrierActive) { gs.barrierTimer--; if(gs.barrierTimer<=0) gs.barrierActive=false; }

  if (PlayerUpgrades.regen>0) {
    regenTimer++;
    if (regenTimer>=300) { regenTimer=0; gs.earthHP=Math.min(gs.maxEarthHP,gs.earthHP+PlayerUpgrades.regen); }
  }

  // 自動発射 or 保持発射
  if (isHolding && gs.attackCooldown<=0) {
    var isRapid = PlayerUpgrades.rapidTimer>0;
    var baseCd  = Math.max(4,Math.round(16/PlayerUpgrades.atkSpd));
    if (isRapid) baseCd = Math.max(2,Math.round(baseCd*0.25));
    if (poisonDebuff>0) baseCd = Math.round(baseCd*1.4);
    gs.attackCooldown = baseCd;
    fireBullet(holdX, holdY);
  }

  // ── ドロップアイテム処理 ───────────────────────────────────────────────────
  for (var di=dropItems.length-1; di>=0; di--) {
    var item = dropItems[di];
    item.update();
    if (item.dead) { dropItems.splice(di,1); continue; }
    // 同レーンに入ったら自動取得
    if (Math.abs(chickCurrentX - item.x) < 55) {
      applyDropUpgrade(item.upgrade);
      lastDropId = item.upgrade.id;
      spawnP(item.x, item.y, 'drop_collect', 14);
      SoundManager.levelUp();
      dropItems.splice(di,1);
    }
  }

  // ── レーン警告タイマー処理 ────────────────────────────────────────────────
  for (var wi=laneWarnings.length-1; wi>=0; wi--) {
    var warn = laneWarnings[wi];
    warn.timer--;
    if (warn.timer <= 0) {
      // 攻撃発生 - プレイヤーが該当レーンにいるか判定
      var playerInLane = false;
      for (var li=0; li<warn.lanes.length; li++) {
        if (Math.abs(chickCurrentX - LANE_X[warn.lanes[li]]) < 55) {
          playerInLane = true; break;
        }
      }
      if (playerInLane && !gs.barrierActive) {
        gs.earthHP = Math.max(0, gs.earthHP - warn.dmg);
        chickHitFx = 22; shakeMag = 10;
        spawnP(chickCurrentX, CHICK_Y, 'hit_earth', 5);
        addFloat(chickCurrentX, CHICK_Y-30, '-'+warn.dmg, '#FF4444', 18);
        SoundManager.hit();
      } else if (!playerInLane) {
        // 回避成功
        addFloat(chickCurrentX, CHICK_Y-30, '回避！', '#00FF88', 18);
        spawnP(chickCurrentX, CHICK_Y, 'hit', 5);
      }
      laneWarnings.splice(wi, 1);
    }
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
  // エンジェル進化タイマー
  if (gs.isAngel) {
    gs.angelTimer--;
    if (gs.angelTimer<=0) { gs.isAngel=false; addFloat(W/2,H*0.4,'エンジェル終了...','#AADDFF',16); }
  }

  // 敵更新
  for (var ei=0; ei<enemies.length; ei++) {
    var e = enemies[ei];
    if (e.dead&&(!e.reviveTimer||e.reviveTimer<=0)) continue;
    var er = e.update(gs.barrierActive,frame,H);
    if (er) {
      if (er.type==='lane_warn') {
        // 単レーン警告
        laneWarnings.push({lanes:[er.lane], timer:er.warnFrames||45, maxTimer:er.warnFrames||45, dmg:er.dmg});
        addFloat(LANE_X[er.lane], H*0.35, '⚠', '#FF4400', 22);
      } else if (er.type==='multi_lane_warn') {
        // 複数レーン警告
        laneWarnings.push({lanes:er.lanes, timer:er.warnFrames||40, maxTimer:er.warnFrames||40, dmg:er.dmg});
        er.lanes.forEach(function(ln){ addFloat(LANE_X[ln], H*0.35, '⚠', '#FF0000', 22); });
      } else if (er.type==='beam'||er.type==='reach') {
        gs.earthHP=Math.max(0,gs.earthHP-er.dmg);
        chickHitFx=22; shakeMag=er.type==='beam'?9:6;
        spawnP(e.x,er.type==='beam'?e.y+e.size*0.5:H-160,'hit_earth',5);
        if (er.type==='beam') { addFloat(W/2,H*0.45,'ドゴーン！','#9B59B6',22); spawnP(e.x,e.y+e.size*0.5,'boss_beam',6); }
        else addFloat(e.x,H-170,'-'+er.dmg,'#FF4444',13);
      } else if (er.type==='poison_reach') {
        gs.earthHP=Math.max(0,gs.earthHP-er.dmg);
        poisonDebuff=480;
        chickHitFx=22; shakeMag=5;
        spawnP(e.x,H-160,'poison_fx',10);
        addFloat(W/2,H*0.4,'毒！攻撃速度ダウン！','#88FF44',20);
        addFloat(e.x,H-170,'-'+er.dmg,'#88FF44',13);
      } else if (er.type==='rangedbullet') {
        enemyBullets.push(new EnemyBullet(er.x,er.y,er.dmg)); spawnP(er.x,er.y,'boss_beam',3); SoundManager.hit();
      } else if (er.type==='triple_shot') {
        for (var ts=-1;ts<=1;ts++) {
          enemyBullets.push(new EnemyBullet(er.x,er.y,er.dmg,{vx:ts*2.5,vy:5.0,size:9,color:'#FF8800'}));
        }
        spawnP(er.x,er.y,'explosion',5); SoundManager.bossWarn();
      } else if (er.type==='snake_spray') {
        for (var ss=-2;ss<=2;ss++) {
          enemyBullets.push(new EnemyBullet(er.x,er.y,er.dmg,{vx:ss*1.8,vy:4.2,size:8,color:'#88FF44',slow:true}));
        }
        spawnP(er.x,er.y,'poison_fx',8);
      } else if (er.type==='boss_burrow') {
        addFloat(W/2,H*0.4,'ヘビが地中に潜った！','#44FF44',18);
        spawnP(e.x,e.y,'poof',12);
      } else if (er.type==='phase_change') {
        var phaseMsg = er.phase===3?'🔥 FINAL PHASE!! 🔥':'⚡ PHASE '+er.phase+'!! ⚡';
        addFloat(W/2,H*0.3,phaseMsg,'#FF4444',26);
        spawnP(W/2,H*0.35,'explosion',22); shakeMag=14; SoundManager.bossWarn();
        if (er.phase>=2) { spawnMinion(); spawnMinion(); }
      } else if (er.type==='boss_summon') {
        spawnMinion(); spawnMinion();
        addFloat(W/2,H*0.35,'増援召喚！','#FF3333',18);
      } else if (er.type==='heal') {
        var healCount=0;
        enemies.forEach(function(en){ if(!en.dead&&en.type!=='boss'&&en.type!=='boss_chicken'&&en.type!=='boss_snake'&&!en.type.startsWith('boss_s')&&en.type!=='healer'){ en.hp=Math.min(en.maxHp,en.hp+er.amount); healCount++; } });
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
  for (var ebi=0; ebi<enemyBullets.length; ebi++) {
    var eb = enemyBullets[ebi];
    if (eb.dead) continue;
    var ebr = eb.update(H);
    if (ebr&&ebr.type==='hit_earth') {
      gs.earthHP=Math.max(0,gs.earthHP-ebr.dmg);
      chickHitFx=22; shakeMag=6;
      spawnP(eb.x,H-160,'hit_earth',4);
      addFloat(eb.x,H-172,'-'+ebr.dmg,eb.color==='#88FF44'?'#88FF44':'#FF6600',13);
      if (eb.color==='#88FF44') { poisonDebuff=300; addFloat(W/2,H*0.42,'毒攻撃！','#88FF44',16); spawnP(eb.x,H-160,'poison_fx',6); }
    }
  }
  enemyBullets=enemyBullets.filter(function(eb){return !eb.dead;});

  // プレイヤー弾
  for (var bi=0; bi<bullets.length; bi++) {
    var b = bullets[bi];
    if (b.dead) continue;
    var br = b.update(enemies);
    if (br) {
      if (br.type==='explode') {
        spawnP(br.x,br.y,'explosion',16);
        enemies.forEach(function(en){ if(!en.dead){var dx2=br.x-en.x,dy2=br.y-en.y; if(Math.sqrt(dx2*dx2+dy2*dy2)<95){var k2=en.takeDamage(5);if(k2)onKill(en);}} });
        gs.earthHP=Math.min(gs.maxEarthHP,gs.earthHP+3);
        addFloat(br.x,br.y-20,'+HP','#2ECC71',14);
      } else if (br.type==='hit') {
        if (br.killed) onKill(br.enemy);
        if (PlayerUpgrades.leechShot) gs.earthHP = Math.min(gs.maxEarthHP, gs.earthHP + 1);
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
    var baseInterval = wave===WAVES_PER_STAGE?1:Math.max(18,85-stage*5-Math.floor(diffBonus*3));
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
    var def = TOWER_DEFS[t.type];
    if (t.cd>0) { t.cd--; return; }
    var nearest=null, nearestDist=def.range;
    for (var ei=0; ei<enemies.length; ei++) {
      var en = enemies[ei];
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
    for (var di=0; di<enemies.length; di++) {
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
  var doShake = shakeMag>0.5;
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
    case 'paused':       drawPauseScr();      break;
    case 'gameover':     drawGameOverScr();   break;
    case 'ending':       drawEndingScr();     break;
    case 'settings':     drawSettingsScr();   break;
    case 'bestiary':     drawBestiaryScr();   break;
    case 'achievements': drawAchievementsScr(); break;
  }
  if (doShake) ctx.restore();
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
  // レーンインジケーター（警告より先に描画）
  drawLaneIndicators(chickLane, laneWarnings, frame);
  drawEvoBar(gs.evoGauge,gs.isEvolved,gs.evoTimer,gs.isAngel,gs.angelTimer);
  var cdCurr = {gunshi:getCdMax('gunshi'),nurse:getCdMax('nurse'),barrier:getCdMax('barrier')};
  drawHudTop(gs.earthHP,gs.maxEarthHP,gs.barrierActive,stage,wave,WAVES_PER_STAGE,score,level,xp,xpToNext(level),kills,SaveManager.getHigh().score,frame,runCoins,poisonDebuff);
  TOWER_SLOTS.forEach(function(slot){drawTower(slot,!!frozenBg);});

  enemies.forEach(function(e){
    if (e.dead&&e.reviveTimer>0) return;
    var isStageBoss = e.type.startsWith('boss_s');
    var isOldBoss   = (e.type==='boss'||e.type==='boss_chicken'||e.type==='boss_snake');
    if (isStageBoss||isOldBoss) drawBoss(e,frame); else drawCrow(e);
  });

  bullets.forEach(function(b){
    if (b.evolved){drawEgg(b.x,b.y);}
    else if (b.angel){drawAngelBullet(b.x,b.y);}
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

  // ドロップアイテム
  dropItems.forEach(function(item){ drawDropItem(item, frame); });

  floats.forEach(function(ft){
    ctx.globalAlpha=Math.min(1,ft.life/25);
    ctx.fillStyle=ft.color; ctx.font='bold '+ft.size+'px "Kosugi Maru",sans-serif'; ctx.textAlign='center';
    ctx.strokeStyle='rgba(0,0,0,0.7)'; ctx.lineWidth=4;
    ctx.strokeText(ft.text,ft.x,ft.y); ctx.fillText(ft.text,ft.x,ft.y);
    ctx.globalAlpha=1;
  });

  var bob = Math.sin(frame*0.1)*3;
  if (gs.isAngel) {
    ctx.globalAlpha=0.20+Math.sin(frame*0.1)*0.10; ctx.fillStyle='#AACCFF';
    ctx.shadowColor='#4488FF'; ctx.shadowBlur=28;
    ctx.beginPath(); ctx.arc(CHICK_X,CHICK_Y,72,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0; ctx.globalAlpha=1;
  } else if (gs.isEvolved) {
    ctx.globalAlpha=0.18+Math.sin(frame*0.12)*0.08; ctx.fillStyle='#FFD700';
    ctx.beginPath(); ctx.arc(CHICK_X,CHICK_Y,65,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
  }
  if (poisonDebuff>0) {
    var pa2=Math.min(1,poisonDebuff/60)*0.12+Math.abs(Math.sin(frame*0.08))*0.04;
    ctx.globalAlpha=pa2; ctx.fillStyle='#44FF44'; ctx.fillRect(0,0,W,H); ctx.globalAlpha=1;
  }
  var chickSz = gs.isAngel ? 62 : gs.isEvolved ? 56 : 44;
  drawChick(CHICK_X,CHICK_Y+bob,chickSz,gs.isEvolved&&!gs.isAngel,null,gs.isAngel);

  if (gs.barrierActive) {
    ctx.globalAlpha=0.22+Math.sin(frame*0.15)*0.08; ctx.strokeStyle='#00FFFF'; ctx.lineWidth=5;
    ctx.beginPath(); ctx.arc(W/2,H*0.48,W*0.7,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha=0.06; ctx.fillStyle='#00FFFF'; ctx.fill(); ctx.globalAlpha=1;
  }

  if (chickHitFx>0&&!frozenBg) {
    var cfa=chickHitFx/22;
    ctx.save(); ctx.globalAlpha=cfa*0.85; ctx.shadowColor='#FF2222'; ctx.shadowBlur=28;
    ctx.strokeStyle='#FF4444'; ctx.lineWidth=3+cfa*4;
    ctx.beginPath(); ctx.arc(CHICK_X,CHICK_Y,(gs.isAngel?62:gs.isEvolved?56:44)*0.75,0,Math.PI*2); ctx.stroke();
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

  drawCompanionBtns(upg,cds,cdCurr,frame);
  drawLaneBtns(chickLane, frame);
  if (bossWarnTimer>0) drawBossWarn(bossWarnTimer,BOSS_WARN_FRAMES);
}

// ── Input ─────────────────────────────────────────────────────────────────────
function getCanvasXY(e) {
  var r = canvas.getBoundingClientRect();
  return {tx:(e.clientX-r.left)*(W/r.width), ty:(e.clientY-r.top)*(H/r.height)};
}

function handleBattlePointerDown(tx, ty) {
  // ポーズ
  if (tx>W-52&&ty<48) { gs.state='paused'; isHolding=false; return; }
  // レーン移動ボタン（左端・右端）
  if (tx<48&&ty>H-245&&ty<H-148) { changeLane(-1); return; }
  if (tx>W-48&&ty>H-245&&ty<H-148) { changeLane(1); return; }
  // スキルボタン
  var BY=H-65, BR=30, BPOS=[50,W/2,W-50];
  for (var bi=0; bi<BPOS.length; bi++) {
    var dx=tx-BPOS[bi], dy=ty-BY;
    if (Math.sqrt(dx*dx+dy*dy)<BR+8) { activateSkill(['gunshi','nurse','barrier'][bi]); return; }
  }
  // 照準（発射）
  isHolding=true; holdX=tx; holdY=ty;
}

function handleMenuTap(tx, ty) {
  var pulse = Math.sin(frame*0.07)*5;
  switch(gs.state) {
    case 'title':
      if (ty>=476&&ty<=556&&tx>=72&&tx<=318) { initGame(); SoundManager.startBgm('battle'); }
      else if (ty>=556&&ty<=608&&tx>=50&&tx<=190) { gs.state='bestiary'; }
      else if (ty>=556&&ty<=608&&tx>=200&&tx<=344) { gs.state='achievements'; }
      else if (ty>=612&&ty<=666&&tx>=50&&tx<=344) { gs.state='settings'; }
      break;

    case 'howto':
      if (ty>=748&&ty<=806) gs.state='title';
      break;

    case 'settings':
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
      else if (ty>=778&&ty<=830&&tx>=18&&tx<=W/2+4) { SoundManager.toggleBgm(); SoundManager.startBgm('title'); }
      else if (ty>=778&&ty<=830&&tx>=W/2+8&&tx<=W-18) { SoundManager.toggleSe(); }
      else if (ty>=838&&ty<=892) { gs.state='title'; }
      break;

    case 'bestiary':
      if (ty>=788&&ty<=840) gs.state='title';
      break;

    case 'achievements':
      if (ty>=778&&ty<=830) gs.state='title';
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
  var p = getCanvasXY(e);
  swipeStartX=p.tx; swipeStartY=p.ty; swipeStartTime=Date.now();
  if (gs.state==='battle'&&bossWarnTimer<=0) { handleBattlePointerDown(p.tx,p.ty); }
  else if (gs.state==='battle'||gs.state==='stageclear') { /* ignore */ }
  else if (gs.state==='stageintro') { stageIntroTimer=0; updateStageIntro(); }
  else { handleMenuTap(p.tx,p.ty); }
},{passive:false});

canvas.addEventListener('pointermove',function(e){
  if (!isHolding) return;
  var p=getCanvasXY(e); holdX=p.tx; holdY=p.ty;
},{passive:true});

canvas.addEventListener('pointerup',function(e){
  // スワイプ判定（バトル中のレーン移動）
  if (gs.state==='battle') {
    var p=getCanvasXY(e);
    var dx=p.tx-swipeStartX, dy=p.ty-swipeStartY;
    var dt=Date.now()-swipeStartTime;
    if (Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.5&&dt<400) {
      if (dx>0) changeLane(1); else changeLane(-1);
    }
  }
  isHolding=false;
});
canvas.addEventListener('pointercancel',function(){ isHolding=false; });
canvas.addEventListener('pointerleave', function(){ isHolding=false; });

// ── Main loop ─────────────────────────────────────────────────────────────────
SoundManager.startBgm('title');
function loop(){ update(); draw(); requestAnimationFrame(loop); }
loop();
