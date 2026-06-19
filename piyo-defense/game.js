'use strict';

// ── Canvas setup ─────────────────────────────────────────────────────────────
var canvas = document.getElementById('gameCanvas');
var ctx    = canvas.getContext('2d');
var W = 390, H = 844;
canvas.width  = W;
canvas.height = H;
setRenderCtx(ctx, W, H);

function resize() {
  var vh = window.innerHeight, vw = window.innerWidth;
  var ratio = W / H;
  var cw = vh * ratio, ch = vh;
  if (cw > vw) { cw = vw; ch = vw / ratio; }
  canvas.style.width  = cw + 'px';
  canvas.style.height = ch + 'px';
}
window.addEventListener('resize', resize);
resize();

SoundManager.init();

// ── Constants ────────────────────────────────────────────────────────────────
var CHICK_X = W / 2, CHICK_Y = H - 148;
var CD_MAX  = { gunshi: 600, nurse: 900, barrier: 750 };
var TOTAL_STAGES    = 20;
var WAVES_PER_STAGE = 5;   // wave 5 = boss

// ── Tower definitions ─────────────────────────────────────────────────────────
var TOWER_DEFS = {
  normal:  { name:'ノーマルタワー',  desc:'バランス型 自動砲台', icon:'🏰', dmg:6,  range:168, cdMax:38, col:'#8B6C14', maxHp:80 },
  rapid:   { name:'ラピッドタワー',  desc:'高速連射 軽ダメージ', icon:'🔰', dmg:3,  range:132, cdMax:14, col:'#145A8B', maxHp:50 },
  sniper:  { name:'スナイパータワー', desc:'長射程 高ダメージ',  icon:'🎯', dmg:16, range:245, cdMax:95, col:'#333344', maxHp:60 },
  support: { name:'サポートタワー',  desc:'貫通弾で範囲攻撃',   icon:'💠', dmg:5,  range:195, cdMax:28, col:'#1A6B4A', maxHp:70 },
};
function makeTowerSlots() {
  return [
    { x:80,  y:400, type:null, level:1, cd:0, hp:0, maxHp:0, damageCd:0 },
    { x:195, y:432, type:null, level:1, cd:0, hp:0, maxHp:0, damageCd:0 },
    { x:310, y:400, type:null, level:1, cd:0, hp:0, maxHp:0, damageCd:0 },
  ];
}
var TOWER_SLOTS = makeTowerSlots();

// ── Auto-fire state ───────────────────────────────────────────────────────────
var isHolding = false;
var holdX     = W / 2;
var holdY     = H / 3;

// ── Game state ────────────────────────────────────────────────────────────────
// states: title | howto | battle | bosswarn | stageclear | levelup | paused | gameover | ending
var gs = { state: 'title' };
var upg = {}, cds = {};
var enemies = [], bullets = [], particles = [], floats = [];

var stage = 1, wave = 1;        // current stage (1-10), wave within stage (1-5)
var waveSpawned = 0, waveTotal = 0, waveTimer = 0;
var bossWarnTimer  = 0;         // countdown: shows warning before boss spawns
var stageClearTimer = 0;        // countdown: shows stage clear before advancing
var BOSS_WARN_FRAMES  = 90;     // 1.5s
var STAGE_CLEAR_FRAMES = 150;   // 2.5s

var score = 0, kills = 0, isNewHS = false;
var continueFromStage = 1;
var slowTimer = 0;
var level = 1, xp = 0;
var regenTimer = 0, playFrames = 0, frame = 0;
var shakeX = 0, shakeY = 0, shakeMag = 0;
var enemyBullets = [];
var stageIntroTimer = 0;
var STAGE_INTRO_FRAMES = 80;
var levelChoices = [];

function xpToNext(lv) { return 5 + lv * 2; }

// ── Wave config ───────────────────────────────────────────────────────────────
function waveTypes(stg, wv) {
  if (wv === WAVES_PER_STAGE) return ['boss'];
  // Stage 1: normals only
  if (stg === 1) return ['normal'];
  // Stage 2: normals + late-wave fast
  if (stg === 2) return wv <= 2 ? ['normal'] : ['normal','fast'];
  // Stage 3: introduce ranged
  if (stg === 3) return wv <= 2 ? ['normal','fast'] : ['normal','fast','ranged'];
  // Stage 4: ranged focus
  if (stg === 4) return wv <= 2 ? ['normal','fast','ranged'] : ['fast','ranged'];
  // Stage 5: add tank
  if (stg === 5) return wv <= 2 ? ['fast','ranged'] : ['fast','ranged','tank'];
  // Stage 6: introduce sprinter
  if (stg === 6) return wv <= 2 ? ['fast','sprinter','ranged'] : ['fast','sprinter','tank'];
  // Stage 7: introduce armored
  if (stg === 7) return wv <= 2 ? ['sprinter','armored','ranged'] : ['sprinter','armored','tank'];
  // Stage 8: introduce regen
  if (stg === 8) return wv <= 2 ? ['armored','regen','ranged'] : ['armored','regen','tank'];
  // Stage 9: introduce shielded
  if (stg === 9) return wv <= 2 ? ['regen','shielded','armored'] : ['regen','shielded','tank'];
  // Stage 10: all classic + new mix
  if (stg === 10) return wv <= 2 ? ['shielded','regen','tank'] : ['fast','shielded','regen','tank'];
  // Stage 11: introduce ghost
  if (stg === 11) return wv <= 2 ? ['fast','ranged','ghost'] : ['ranged','ghost','tank'];
  // Stage 12: ghost + pressure
  if (stg === 12) return wv <= 2 ? ['ranged','ghost','tank'] : ['ghost','ranged','tank'];
  // Stage 13: introduce healer
  if (stg === 13) return wv <= 2 ? ['ghost','ranged','healer','fast'] : ['ghost','ranged','healer','tank'];
  // Stage 14: healer becomes core threat
  if (stg === 14) return wv <= 2 ? ['ghost','healer','tank','fast'] : ['ghost','ghost','healer','tank'];
  // Stage 15: introduce bomber + splitter
  if (stg === 15) return wv <= 2 ? ['ghost','healer','fast','splitter'] : ['ghost','healer','splitter','bomber'];
  // Stage 16: bomber regularly + shielded
  if (stg === 16) return wv <= 2 ? ['ghost','healer','shielded','splitter'] : ['ghost','healer','shielded','bomber'];
  // Stage 17–18: heavy pressure all threats
  if (stg <= 18) return wv <= 2 ? ['ghost','healer','bomber','fast'] : ['ghost','healer','bomber','tank'];
  // Stage 19–20: hell difficulty
  return wv <= 2 ? ['ghost','ghost','healer','bomber','fast'] : ['ghost','healer','healer','bomber','tank'];
}

function waveCount(stg, wv) {
  if (wv === WAVES_PER_STAGE) return 1;
  return Math.min(4 + stg + wv - 1, 22);
}

// ── Init ──────────────────────────────────────────────────────────────────────
function initGame() {
  gs = {
    state:          'stageintro',
    earthHP:        100,
    maxEarthHP:     100,
    evoGauge:       0,
    isEvolved:      false,
    evoTimer:       0,
    attackCooldown: 0,
    barrierActive:  false,
    barrierTimer:   0,
  };
  upg = { gunshi: true, nurse: true, barrier: true };  // all companions unlocked
  cds = { gunshi: 0, nurse: 0, barrier: 0 };
  PlayerUpgrades.reset();
  enemies = []; bullets = []; enemyBullets = []; particles = []; floats = [];
  TOWER_SLOTS.forEach(function(t) { t.type = null; t.level = 1; t.cd = 0; t.hp = 0; t.maxHp = 0; t.damageCd = 0; });
  stage = 1; wave = 1;
  waveSpawned = 0; waveTotal = 0; waveTimer = 0;
  bossWarnTimer = 0; stageClearTimer = 0;
  score = 0; kills = 0; isNewHS = false;
  level = 1; xp = 0; regenTimer = 0; playFrames = 0;
  isHolding = false;
  stageIntroTimer = STAGE_INTRO_FRAMES;
}

function initGameContinue(fromStage) {
  gs = {
    state:          'stageintro',
    earthHP:        100,
    maxEarthHP:     100,
    evoGauge:       0,
    isEvolved:      false,
    evoTimer:       0,
    attackCooldown: 0,
    barrierActive:  false,
    barrierTimer:   0,
  };
  upg = { gunshi: true, nurse: true, barrier: true };
  cds = { gunshi: 0, nurse: 0, barrier: 0 };
  PlayerUpgrades.reset();
  enemies = []; bullets = []; enemyBullets = []; particles = []; floats = [];
  TOWER_SLOTS.forEach(function(t) { t.type = null; t.level = 1; t.cd = 0; t.hp = 0; t.maxHp = 0; t.damageCd = 0; });
  stage = fromStage; wave = 1;
  waveSpawned = 0; waveTotal = 0; waveTimer = 0;
  bossWarnTimer = 0; stageClearTimer = 0;
  score = 0; kills = 0; isNewHS = false;
  level = 1; xp = 0; regenTimer = 0; playFrames = 0;
  isHolding = false;
  stageIntroTimer = STAGE_INTRO_FRAMES;
}

function startWave() {
  waveSpawned = 0;
  waveTotal   = waveCount(stage, wave);
  waveTimer   = 0;
  if (wave === WAVES_PER_STAGE) {
    bossWarnTimer = BOSS_WARN_FRAMES;
    SoundManager.bossWarn();
    SoundManager.startBgm('boss');
  } else {
    bossWarnTimer = 0;
    SoundManager.startBgm('battle');
    addFloat(W/2, H*0.4, 'WAVE ' + wave + '!', '#FFD700', 24);
  }
}

function spawnEnemy(typeOverride) {
  var types = waveTypes(stage, wave);
  var type  = typeOverride || types[~~(Math.random() * types.length)];
  var x     = 55 + Math.random() * (W - 110);
  var y     = (type === 'boss') ? 190 : -60;
  enemies.push(new Enemy(type, x, y, stage, wave));
}

function spawnMinion() {
  // Use wave-4 types so boss summons never spawn more bosses
  var minionTypes = waveTypes(stage, Math.max(1, wave - 1));
  var filtered = minionTypes.filter(function(t) { return t !== 'boss'; });
  if (!filtered.length) filtered = ['normal'];
  var type = filtered[~~(Math.random() * filtered.length)];
  var x = 55 + Math.random() * (W - 110);
  enemies.push(new Enemy(type, x, -60, stage, wave));
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function spawnP(x, y, type, n) {
  for (var i = 0; i < n; i++) particles.push(new Particle(x, y, type));
}
function addFloat(x, y, text, color, size) {
  floats.push(new FloatingText(x, y, text, color || '#FFD700', size || 18));
}

// ── Skills ────────────────────────────────────────────────────────────────────
function activateSkill(id) {
  if (!upg[id] || cds[id] > 0) return;
  cds[id] = CD_MAX[id];
  switch (id) {
    case 'gunshi':
      enemies.forEach(function(e) {
        if (!e.dead) { var k = e.takeDamage(20); spawnP(e.x, e.y, 'explosion', 6); if (k) onKill(e); }
      });
      spawnP(W/2, H/2, 'explosion', 18);
      addFloat(W/2, H*0.38, '一斉突撃！', '#FF4444', 28);
      break;
    case 'nurse':
      gs.earthHP = Math.min(gs.maxEarthHP, gs.earthHP + 45);
      spawnP(W/2, H*0.3, 'hit', 20);
      addFloat(W/2, H*0.38, '地球大回復！', '#FF69B4', 26);
      break;
    case 'barrier':
      gs.barrierActive = true; gs.barrierTimer = 300;
      addFloat(W/2, H*0.38, '絶対防壁！', '#00FFFF', 26);
      break;
  }
}

// ── Fire ──────────────────────────────────────────────────────────────────────
function fireBullet(tx, ty) {
  var pu   = PlayerUpgrades;
  var crit = Math.random() < pu.critChance;
  var opts = { damage:pu.atk, pierce:pu.pierce, crit:crit, evolved:gs.isEvolved, bulletSpd:pu.bulletSpd, rangeMult:pu.rangeMult };
  bullets.push(new Bullet(CHICK_X, CHICK_Y - 20, tx, ty, opts));
  if (pu.doubleShot) {
    bullets.push(new Bullet(CHICK_X - 14, CHICK_Y - 20, tx, ty, opts));
    bullets.push(new Bullet(CHICK_X + 14, CHICK_Y - 20, tx, ty, opts));
  }
  SoundManager.shoot();
  spawnP(CHICK_X + (Math.random()-0.5)*30, CHICK_Y - 50, 'hit', 1);
  addFloat(CHICK_X + (Math.random()-0.5)*40, CHICK_Y - 56, 'ピヨ！', '#FF6B6B', 13);
}

// ── Kill ──────────────────────────────────────────────────────────────────────
function onKill(e) {
  kills++;
  var pts = Math.round(e.pts * PlayerUpgrades.scoreMulti);
  score  += pts;
  gs.evoGauge = Math.min(100, gs.evoGauge + (
    e.type === 'boss'     ? 50 :
    e.type === 'tank'     ? 15 :
    e.type === 'splitter' ? 18 :
    e.type === 'healer'   ? 18 :
    e.type === 'bomber'   ? 15 :
    e.type === 'armored'  ? 12 :
    e.type === 'shielded' ? 12 :
    10
  ));
  spawnP(e.x, e.y, 'poof', 8);
  addFloat(e.x, e.y - 24, '+' + pts, '#FFD700', 14);
  if (e.type === 'boss' || e.type === 'tank' || e.type === 'splitter') SoundManager.killBig();
  else SoundManager.kill();
  // Splitter: spawns 2 swarm enemies on death
  if (e.type === 'splitter') {
    enemies.push(new Enemy('swarm', e.x - 22, e.y, stage, wave));
    enemies.push(new Enemy('swarm', e.x + 22, e.y, stage, wave));
    addFloat(e.x, e.y - 20, '分裂！', '#CC44FF', 16);
    spawnP(e.x, e.y, 'explosion', 10);
  }
  gainXP(e.xpGain);
}

// ── Level up ─────────────────────────────────────────────────────────────────
function gainXP(amount) {
  xp += amount;
  if (gs.state === 'levelup') return;  // bank XP, resolve after player picks
  if (xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level++;
    levelChoices = pickUpgradesWithTowers(3);
    slowTimer    = 0;
    gs.state     = 'levelup';
    SoundManager.levelUp();
    spawnP(CHICK_X, CHICK_Y, 'levelup', 22);
  }
}

function applyLevelUp(idx) {
  var ch = levelChoices[idx];
  if (ch.id.indexOf('tower_') === 0) {
    var ttype = ch.id.replace('tower_', '');
    // Find an empty slot first
    var placed = false;
    for (var si = 0; si < TOWER_SLOTS.length; si++) {
      if (!TOWER_SLOTS[si].type) {
        TOWER_SLOTS[si].type  = ttype;
        TOWER_SLOTS[si].maxHp = TOWER_DEFS[ttype].maxHp;
        TOWER_SLOTS[si].hp    = TOWER_DEFS[ttype].maxHp;
        TOWER_SLOTS[si].damageCd = 0;
        addFloat(TOWER_SLOTS[si].x, TOWER_SLOTS[si].y - 40, TOWER_DEFS[ttype].name + '設置！', '#FFD700', 14);
        spawnP(TOWER_SLOTS[si].x, TOWER_SLOTS[si].y, 'levelup', 8);
        placed = true; break;
      }
    }
    if (!placed) {
      // All slots occupied: upgrade an existing tower of the same type, or any
      for (var si2 = 0; si2 < TOWER_SLOTS.length; si2++) {
        if (TOWER_SLOTS[si2].type === ttype || si2 === TOWER_SLOTS.length - 1) {
          TOWER_SLOTS[si2].level = Math.min(5, TOWER_SLOTS[si2].level + 1);
          addFloat(TOWER_SLOTS[si2].x, TOWER_SLOTS[si2].y - 40,
            TOWER_DEFS[TOWER_SLOTS[si2].type].name + ' Lv.' + TOWER_SLOTS[si2].level + '！', '#FFD700', 14);
          break;
        }
      }
    }
  } else {
    PlayerUpgrades.apply(ch.id);
    if (ch.id === 'max_hp') gs.maxEarthHP = PlayerUpgrades.maxHp;
  }
  gs.state = 'battle';
  // Check if banked XP triggers another levelup
  if (xp >= xpToNext(level)) gainXP(0);
}

// ── Stage clear / Ending ──────────────────────────────────────────────────────
function doStageClear() {
  gs.state        = 'stageclear';
  stageClearTimer = STAGE_CLEAR_FRAMES;
  SoundManager.stageClear();
  spawnP(W/2, H*0.4, 'stageclear', 30);
  spawnP(W/4, H*0.3, 'stageclear', 15);
  spawnP(W*0.75, H*0.3, 'stageclear', 15);
}

function advanceStage() {
  if (stage >= TOTAL_STAGES) {
    isNewHS = SaveManager.save(score, stage);
    gs.state = 'ending';
    SoundManager.startBgm('title');
  } else {
    stage++;
    wave = 1;
    gs.earthHP  = Math.min(gs.maxEarthHP, gs.earthHP + 20);  // HP bonus
    gs.evoGauge = 0; gs.isEvolved = false;
    // Reset player level/upgrades each stage — keeps difficulty curve intact
    PlayerUpgrades.reset();
    level = 1; xp = 0; regenTimer = 0;
    gs.maxEarthHP = 100;
    cds = { gunshi: 0, nurse: 0, barrier: 0 };
    TOWER_SLOTS.forEach(function(t) { t.type = null; t.level = 1; t.cd = 0; t.hp = 0; t.maxHp = 0; t.damageCd = 0; });
    enemies = []; bullets = []; enemyBullets = [];
    isHolding = false;
    stageIntroTimer = STAGE_INTRO_FRAMES;
    gs.state = 'stageintro';
    // startWave() called by updateStageIntro when intro ends
  }
}

function endGame() {
  isHolding = false;
  continueFromStage = stage;
  isNewHS   = SaveManager.save(score, stage - 1);  // credit up to previous stage
  gs.state  = 'gameover';
  SoundManager.gameOver();
  SoundManager.startBgm('title');
}

// ── Update ────────────────────────────────────────────────────────────────────
function update() {
  frame++;
  switch (gs.state) {
    case 'battle':     updateBattle();     break;
    case 'levelup':    // game continues at 1/3 speed during levelup
      slowTimer++;
      if (slowTimer % 3 === 0) updateBattle();
      break;
    case 'stageclear': updateStageClear(); break;
    case 'stageintro': updateStageIntro(); break;
    default: break;
  }
}

function updateBattle() {
  playFrames++;

  // Boss warning countdown (don't spawn or process wave logic, but update existing entities)
  if (bossWarnTimer > 0) {
    bossWarnTimer--;
    updateParticlesFloats();
    return;
  }

  // Cooldowns
  if (gs.attackCooldown > 0) gs.attackCooldown--;
  var k;
  for (k in cds) { if (cds[k] > 0) cds[k]--; }

  // Barrier
  if (gs.barrierActive) { gs.barrierTimer--; if (gs.barrierTimer <= 0) gs.barrierActive = false; }

  // Auto-regen
  if (PlayerUpgrades.regen > 0) {
    regenTimer++;
    if (regenTimer >= 300) { regenTimer = 0; gs.earthHP = Math.min(gs.maxEarthHP, gs.earthHP + PlayerUpgrades.regen); }
  }

  // Auto-fire (hold to shoot)
  if (isHolding && gs.attackCooldown <= 0) {
    var baseCd     = Math.max(8, Math.round(16 / PlayerUpgrades.atkSpd));
    gs.attackCooldown = baseCd;
    fireBullet(holdX, holdY);
  }

  // Evolution
  if (!gs.isEvolved && gs.evoGauge >= 100) {
    gs.isEvolved = true;
    gs.evoTimer  = [480, 600, 780, 960, 1200][Math.min(4, ~~((level-1)/3))];
    addFloat(W/2, H*0.4, 'にわトリに進化！', '#FFD700', 26);
    spawnP(CHICK_X, CHICK_Y, 'explosion', 16);
  }
  if (gs.isEvolved) {
    gs.evoTimer--;
    if (gs.evoTimer <= 0) { gs.isEvolved = false; gs.evoGauge = 0; addFloat(W/2, H*0.4, 'ひよこに戻った...', '#aaa', 16); }
  }

  // Enemies
  for (var ei = 0; ei < enemies.length; ei++) {
    var e = enemies[ei];
    if (e.dead) continue;
    var er = e.update(gs.barrierActive, frame, H);
    if (er) {
      if (er.type === 'beam' || er.type === 'reach') {
        gs.earthHP = Math.max(0, gs.earthHP - er.dmg);
        shakeMag = er.type === 'beam' ? 8 : 5;
        spawnP(e.x, er.type === 'beam' ? e.y + e.size*0.5 : H-160, 'hit_earth', 5);
        if (er.type === 'beam') { addFloat(W/2, H*0.45, 'ドゴーン！', '#9B59B6', 22); spawnP(e.x,e.y+e.size*0.5,'boss_beam',6); }
        else addFloat(e.x, H-170, '-' + er.dmg, '#FF4444', 13);
      } else if (er.type === 'rangedbullet') {
        enemyBullets.push(new EnemyBullet(er.x, er.y, er.dmg));
        spawnP(er.x, er.y, 'boss_beam', 3);
        SoundManager.hit();
      } else if (er.type === 'phase_change') {
        var phaseMsg = er.phase === 3 ? '🔥 FINAL PHASE!! 🔥' : '⚡ PHASE ' + er.phase + '!! ⚡';
        addFloat(W/2, H*0.3, phaseMsg, '#FF4444', 26);
        spawnP(W/2, H*0.35, 'explosion', 22);
        shakeMag = 12; SoundManager.bossWarn();
        // Phase 2: spawn minions
        if (er.phase >= 2) { spawnMinion(); spawnMinion(); }
      } else if (er.type === 'boss_summon') {
        spawnMinion(); spawnMinion();
        addFloat(W/2, H*0.35, '増援召喚！', '#FF3333', 18);
      } else if (er.type === 'heal') {
        var healCount = 0;
        enemies.forEach(function(en) {
          if (!en.dead && en.type !== 'boss' && en.type !== 'healer') {
            en.hp = Math.min(en.maxHp, en.hp + er.amount);
            healCount++;
          }
        });
        if (healCount > 0) {
          spawnP(e.x, e.y, 'levelup', 6);
          addFloat(W/2, H*0.32, '敵が回復した！', '#FF88CC', 18);
        }
      } else if (er.type === 'bomb') {
        gs.earthHP = Math.max(0, gs.earthHP - er.dmg);
        shakeMag = 14;
        spawnP(e.x, H - 150, 'explosion', 20);
        spawnP(e.x, H - 150, 'hit_earth', 8);
        addFloat(e.x, H - 168, 'BOOM!! -' + er.dmg, '#FF5500', 22);
        SoundManager.killBig();
      } else if (er.type === 'barrier') {
        addFloat(e.x, H-170, 'バリア！', '#00FFFF', 13);
      }
    }
  }
  enemies = enemies.filter(function(e) { return !e.dead; });

  // Enemy bullets
  for (var ebi = 0; ebi < enemyBullets.length; ebi++) {
    var eb = enemyBullets[ebi];
    if (eb.dead) continue;
    var ebr = eb.update(H);
    if (ebr && ebr.type === 'hit_earth') {
      gs.earthHP = Math.max(0, gs.earthHP - ebr.dmg);
      shakeMag = 5;
      spawnP(eb.x, H - 160, 'hit_earth', 4);
      addFloat(eb.x, H - 172, '-' + ebr.dmg, '#FF6600', 13);
    }
  }
  enemyBullets = enemyBullets.filter(function(eb) { return !eb.dead; });

  // Bullets
  for (var bi = 0; bi < bullets.length; bi++) {
    var b = bullets[bi];
    if (b.dead) continue;
    var br = b.update(enemies);
    if (br) {
      if (br.type === 'explode') {
        spawnP(br.x, br.y, 'explosion', 14);
        enemies.forEach(function(en) {
          if (!en.dead) {
            var ddx = br.x - en.x, ddy = br.y - en.y;
            if (Math.sqrt(ddx*ddx + ddy*ddy) < 90) { var k2 = en.takeDamage(4); if (k2) onKill(en); }
          }
        });
        gs.earthHP = Math.min(gs.maxEarthHP, gs.earthHP + 3);
        addFloat(br.x, br.y - 20, '+HP', '#2ECC71', 14);
      } else if (br.type === 'hit') {
        if (br.killed) onKill(br.enemy);
        spawnP(b.x, b.y, br.crit ? 'crit' : 'hit', br.crit ? 5 : 2);
        if (br.crit) addFloat(b.x, b.y - 10, 'CRIT!', '#FF3333', 15);
        SoundManager.hit();
      }
    }
  }
  bullets  = bullets.filter(function(b) { return !b.dead; });
  enemies  = enemies.filter(function(e) { return !e.dead; });

  updateTowers();
  updateParticlesFloats();

  gs.earthHP = Math.max(0, Math.min(gs.maxEarthHP, gs.earthHP));
  if (gs.earthHP <= 0) { endGame(); return; }

  // Wave / stage progression
  if (waveSpawned < waveTotal) {
    waveTimer++;
    var interval = (wave === WAVES_PER_STAGE) ? 1 : Math.max(28, 80 - stage * 4);
    if (waveTimer >= interval) { waveTimer = 0; spawnEnemy(); waveSpawned++; }
  } else if (enemies.length === 0) {
    if (wave === WAVES_PER_STAGE) {
      // Boss defeated → stage clear
      doStageClear();
    } else {
      // Advance to next wave within stage
      wave++;
      startWave();
    }
  }
}

function updateStageClear() {
  stageClearTimer--;
  updateParticlesFloats();
  if (stageClearTimer <= 0) advanceStage();
}

function updateStageIntro() {
  stageIntroTimer--;
  updateParticlesFloats();
  if (stageIntroTimer <= 0) {
    gs.state = 'battle';
    startWave();
  }
}

function updateTowers() {
  TOWER_SLOTS.forEach(function(t) {
    if (!t.type) return;
    var def = TOWER_DEFS[t.type];
    if (t.cd > 0) { t.cd--; return; }
    var nearest = null, nearestDist = def.range;
    for (var ei = 0; ei < enemies.length; ei++) {
      var en = enemies[ei];
      if (en.dead) continue;
      var dx = en.x - t.x, dy = en.y - t.y;
      var d  = Math.sqrt(dx*dx + dy*dy);
      if (d < nearestDist) { nearest = en; nearestDist = d; }
    }
    if (nearest) {
      t.cd = def.cdMax;
      bullets.push(new Bullet(t.x, t.y, nearest.x, nearest.y, {
        damage:   def.dmg * t.level,
        pierce:   t.type === 'support' ? 3 : 0,
        crit:     false, evolved: false,
        bulletSpd: t.type === 'sniper' ? 1.4 : 1.0,
        rangeMult: 3.0
      }));
      spawnP(t.x, t.y - 10, 'hit', 1);
    }
    // Enemy contact damage to tower
    if (t.damageCd > 0) { t.damageCd--; }
    for (var di = 0; di < enemies.length; di++) {
      var en2 = enemies[di];
      if (en2.dead) continue;
      var ex = en2.x - t.x, ey = en2.y - t.y;
      if (Math.sqrt(ex*ex + ey*ey) < 35 && t.damageCd === 0) {
        t.hp -= en2.dmg > 0 ? en2.dmg : 3;
        t.damageCd = 45;
        spawnP(t.x, t.y, 'hit', 3);
        if (t.hp <= 0) {
          addFloat(t.x, t.y - 30, TOWER_DEFS[t.type].name + '破壊！', '#FF4444', 14);
          spawnP(t.x, t.y, 'explosion', 10);
          t.type = null; t.hp = 0; t.maxHp = 0; t.level = 1; t.cd = 0; t.damageCd = 0;
        }
        break;
      }
    }
  });
}

function updateParticlesFloats() {
  particles.forEach(function(p) { p.update(); });
  particles = particles.filter(function(p) { return p.life > 0; });
  floats.forEach(function(f) { f.update(); });
  floats    = floats.filter(function(f) { return f.life > 0; });
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function draw() {
  ctx.clearRect(0, 0, W, H);
  var doShake = shakeMag > 0.5;
  if (doShake) {
    shakeX = (Math.random() - 0.5) * shakeMag * 2;
    shakeY = (Math.random() - 0.5) * shakeMag * 2;
    shakeMag *= 0.78;
    ctx.save(); ctx.translate(shakeX, shakeY);
  }
  switch (gs.state) {
    case 'title':      drawTitleScr();      break;
    case 'howto':      drawHowToScr();      break;
    case 'battle':     drawBattleScr();     break;
    case 'stageclear': drawStageClearScr(); break;
    case 'stageintro': drawStageIntroScr(); break;
    case 'levelup':    drawBattleScr(); drawLevelUp(levelChoices, level); break;
    case 'paused':     drawPauseScr();      break;
    case 'gameover':   drawGameOverScr();   break;
    case 'ending':     drawEndingScr();     break;
  }
  if (doShake) ctx.restore();
}

function drawTitleScr() {
  var h = SaveManager.getHigh();
  drawTitle(frame, h.score, h.stage, SoundManager.bgmOn, SoundManager.seOn);
}
function drawHowToScr() { drawHowTo(frame); }
function drawPauseScr() { drawBattleScr(true); drawPause(stage, wave, score); }
function drawGameOverScr() {
  var h = SaveManager.getHigh();
  drawGameOver(score, stage, wave, kills, isNewHS, h.score, h.stage, frame);
}
function drawEndingScr() { drawEnding(score, kills, playFrames, isNewHS, SaveManager.getHigh().score, frame); }

function drawStageClearScr() {
  drawBattleScr(true);
  drawStageClear(stage, TOTAL_STAGES, stageClearTimer, STAGE_CLEAR_FRAMES, frame);
}

function drawStageIntroScr() {
  drawBattleScr(true);
  drawStageIntro(stage, stageIntroTimer, STAGE_INTRO_FRAMES);
}

function drawBattleScr(frozenBg) {
  drawBg(frame, stage);
  drawGround(stage);
  drawEvoBar(gs.evoGauge, gs.isEvolved, gs.evoTimer);
  drawHudTop(gs.earthHP, gs.maxEarthHP, gs.barrierActive, stage, wave, WAVES_PER_STAGE, score, level, xp, xpToNext(level), kills, SaveManager.getHigh().score, frame);

  // Towers (drawn behind enemies)
  TOWER_SLOTS.forEach(function(slot) { drawTower(slot, !!frozenBg); });

  enemies.forEach(function(e) { e.type === 'boss' ? drawBoss(e, frame) : drawCrow(e); });

  bullets.forEach(function(b) {
    if (b.evolved) { drawEgg(b.x, b.y); }
    else {
      ctx.save();
      ctx.shadowColor = b.crit ? '#FF3333' : '#FFE040';
      ctx.shadowBlur  = 10;
      ctx.translate(b.x, b.y); ctx.rotate(b.rot + Math.PI/2);
      drawChick(0, 0, 11, false);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  });

  particles.forEach(function(p) { drawParticle(p); });

  enemyBullets.forEach(function(eb) { drawEnemyBullet(eb); });

  floats.forEach(function(ft) {
    ctx.globalAlpha = Math.min(1, ft.life / 25);
    ctx.fillStyle   = ft.color;
    ctx.font        = 'bold ' + ft.size + 'px "Kosugi Maru",sans-serif';
    ctx.textAlign   = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 4;
    ctx.strokeText(ft.text, ft.x, ft.y); ctx.fillText(ft.text, ft.x, ft.y);
    ctx.globalAlpha = 1;
  });

  // Player chick
  var bob = Math.sin(frame * 0.1) * 3;
  if (gs.isEvolved) {
    ctx.globalAlpha = 0.18 + Math.sin(frame*0.12)*0.08;
    ctx.fillStyle   = '#FFD700';
    ctx.beginPath(); ctx.arc(CHICK_X, CHICK_Y, 65, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  drawChick(CHICK_X, CHICK_Y + bob, gs.isEvolved ? 56 : 44, gs.isEvolved);

  // Barrier dome
  if (gs.barrierActive) {
    ctx.globalAlpha = 0.22 + Math.sin(frame*0.15)*0.08;
    ctx.strokeStyle = '#00FFFF'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(W/2, H*0.48, W*0.7, 0, Math.PI*2); ctx.stroke();
    ctx.globalAlpha = 0.06; ctx.fillStyle = '#00FFFF'; ctx.fill(); ctx.globalAlpha = 1;
  }

  // Hold-to-fire indicator
  if (isHolding && !frozenBg) {
    var pulseR = 18 + Math.sin(frame * 0.3) * 4;
    ctx.globalAlpha = 0.42 + Math.sin(frame * 0.3) * 0.14;
    ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 16;
    ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(holdX, holdY, pulseR, 0, Math.PI*2); ctx.stroke();
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  }

  drawCompanionBtns(upg, cds, CD_MAX, frame);

  // Boss warning overlay
  if (bossWarnTimer > 0) drawBossWarn(bossWarnTimer, BOSS_WARN_FRAMES);
}

// ── Input ─────────────────────────────────────────────────────────────────────
function getCanvasXY(e) {
  var r  = canvas.getBoundingClientRect();
  var sx = W / r.width, sy = H / r.height;
  return { tx: (e.clientX - r.left) * sx, ty: (e.clientY - r.top) * sy };
}

function handleBattlePointerDown(tx, ty) {
  // Pause button
  if (tx > W - 52 && ty < 48) { gs.state = 'paused'; isHolding = false; return; }
  // Companion skill buttons
  var BY = H - 65, BR = 30;
  var BPOS = [50, W/2, W-50];
  for (var bi = 0; bi < BPOS.length; bi++) {
    var dx = tx - BPOS[bi], dy = ty - BY;
    if (Math.sqrt(dx*dx + dy*dy) < BR + 8) { activateSkill(['gunshi','nurse','barrier'][bi]); return; }
  }
  // Start auto-fire
  isHolding = true; holdX = tx; holdY = ty;
}

function handleMenuTap(tx, ty) {
  switch (gs.state) {
    case 'title':
      if (ty >= 522 && ty <= 582 && tx >= 72 && tx <= 318) {
        initGame(); SoundManager.startBgm('battle');
      } else if (ty >= 590 && ty <= 640 && tx >= 72 && tx <= 318) {
        gs.state = 'howto';
      } else if (ty >= 646 && ty <= 694 && tx >= 45 && tx <= 183) {
        SoundManager.toggleBgm(); SoundManager.startBgm('title');
      } else if (ty >= 646 && ty <= 694 && tx >= 207 && tx <= 345) {
        SoundManager.toggleSe();
      }
      break;
    case 'howto':
      if (ty >= 748 && ty <= 806) gs.state = 'title';
      break;
    case 'levelup':
      for (var i = 0; i < levelChoices.length; i++) {
        if (ty >= 268 + i*180 && ty < 268 + i*180 + 162 && tx >= 20 && tx <= W-20) { applyLevelUp(i); break; }
      }
      break;
    case 'paused':
      if      (ty >= 358 && ty <= 416) { gs.state = 'battle'; }
      else if (ty >= 436 && ty <= 494) { initGame(); SoundManager.startBgm('battle'); }
      else if (ty >= 514 && ty <= 572) { gs.state = 'title'; SoundManager.startBgm('title'); }
      break;
    case 'gameover':
      if      (ty >= 494 && ty <= 552 && tx >= 44 && tx <= W-44) { initGameContinue(continueFromStage); SoundManager.startBgm('battle'); }
      else if (ty >= 562 && ty <= 610 && tx >= 44 && tx <= W-44) { initGame(); SoundManager.startBgm('battle'); }
      else if (ty >= 620 && ty <= 668 && tx >= 44 && tx <= W-44) { gs.state = 'title'; SoundManager.startBgm('title'); }
      break;
    case 'ending':
      if      (ty >= 664 && ty <= 722 && tx >= 55 && tx <= W-55) { initGame(); SoundManager.startBgm('battle'); }
      else if (ty >= 732 && ty <= 784 && tx >= 55 && tx <= W-55) { gs.state = 'title'; SoundManager.startBgm('title'); }
      break;
  }
}

// Pointer events for both mobile and desktop
canvas.addEventListener('pointerdown', function(e) {
  e.preventDefault();
  SoundManager.resume();
  var p = getCanvasXY(e);
  if (gs.state === 'battle' && bossWarnTimer <= 0) {
    handleBattlePointerDown(p.tx, p.ty);
  } else if (gs.state === 'battle' || gs.state === 'stageclear') {
    // Do nothing during warning/clear anim
  } else if (gs.state === 'stageintro') {
    // Tap to skip intro
    stageIntroTimer = 0;
    updateStageIntro();
  } else {
    handleMenuTap(p.tx, p.ty);
  }
}, { passive: false });

canvas.addEventListener('pointermove', function(e) {
  if (!isHolding) return;
  var p = getCanvasXY(e);
  holdX = p.tx; holdY = p.ty;
}, { passive: true });

canvas.addEventListener('pointerup',     function() { isHolding = false; });
canvas.addEventListener('pointercancel', function() { isHolding = false; });
canvas.addEventListener('pointerleave',  function() { isHolding = false; });

// ── Main loop ─────────────────────────────────────────────────────────────────
SoundManager.startBgm('title');
function loop() { update(); draw(); requestAnimationFrame(loop); }
loop();
