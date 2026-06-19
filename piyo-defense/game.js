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
var TOTAL_STAGES   = 10;
var WAVES_PER_STAGE = 5;   // wave 5 = boss

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
var level = 1, xp = 0;
var regenTimer = 0, playFrames = 0, frame = 0;
var shakeX = 0, shakeY = 0, shakeMag = 0;
var levelChoices = [];

function xpToNext(lv) { return 5 + lv * 2; }

// ── Wave config ───────────────────────────────────────────────────────────────
function waveTypes(stg, wv) {
  if (wv === WAVES_PER_STAGE) return ['boss'];
  if (stg <= 2) {
    return wv <= 2 ? ['normal','normal','normal'] : ['normal','normal','fast'];
  }
  if (stg <= 5) {
    return wv <= 2 ? ['normal','normal','fast'] : ['normal','fast','tank'];
  }
  // Stage 6-10: harder
  return wv <= 2 ? ['normal','fast','fast'] : ['fast','fast','tank'];
}

function waveCount(stg, wv) {
  if (wv === WAVES_PER_STAGE) return 1;
  return Math.min(4 + stg + wv - 1, 22);
}

// ── Init ──────────────────────────────────────────────────────────────────────
function initGame() {
  gs = {
    state:          'battle',
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
  enemies = []; bullets = []; particles = []; floats = [];
  stage = 1; wave = 1;
  waveSpawned = 0; waveTotal = 0; waveTimer = 0;
  bossWarnTimer = 0; stageClearTimer = 0;
  score = 0; kills = 0; isNewHS = false;
  level = 1; xp = 0; regenTimer = 0; playFrames = 0;
  isHolding = false;
  startWave();
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

function spawnEnemy() {
  var types = waveTypes(stage, wave);
  var type  = types[~~(Math.random() * types.length)];
  var x     = 55 + Math.random() * (W - 110);
  var y     = (type === 'boss') ? 190 : -60;
  enemies.push(new Enemy(type, x, y, stage, wave));
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
  gs.evoGauge = Math.min(100, gs.evoGauge + (e.type === 'boss' ? 50 : e.type === 'tank' ? 15 : 10));
  spawnP(e.x, e.y, 'poof', 8);
  addFloat(e.x, e.y - 24, '+' + pts, '#FFD700', 14);
  if (e.type === 'boss' || e.type === 'tank') SoundManager.killBig();
  else SoundManager.kill();
  gainXP(e.xpGain);
}

// ── Level up ─────────────────────────────────────────────────────────────────
function gainXP(amount) {
  xp += amount;
  if (xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level++;
    levelChoices = pickUpgrades(3);
    gs.state     = 'levelup';
    SoundManager.levelUp();
    spawnP(CHICK_X, CHICK_Y, 'levelup', 22);
  }
}

function applyLevelUp(idx) {
  var ch = levelChoices[idx];
  PlayerUpgrades.apply(ch.id);
  if (ch.id === 'max_hp') gs.maxEarthHP = PlayerUpgrades.maxHp;
  gs.state = 'battle';
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
    cds = { gunshi: 0, nurse: 0, barrier: 0 };
    enemies = []; bullets = [];
    isHolding = false;
    gs.state = 'battle';
    startWave();
  }
}

function endGame() {
  isHolding = false;
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
    case 'stageclear': updateStageClear(); break;
    default: break;  // other states: particles/floats only via frame counter
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
      } else if (er.type === 'barrier') {
        addFloat(e.x, H-170, 'バリア！', '#00FFFF', 13);
      }
    }
  }
  enemies = enemies.filter(function(e) { return !e.dead; });

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

function drawBattleScr(frozenBg) {
  drawBg(frame, stage);
  drawGround(stage);
  drawEvoBar(gs.evoGauge, gs.isEvolved, gs.evoTimer);
  drawHudTop(gs.earthHP, gs.maxEarthHP, gs.barrierActive, stage, wave, WAVES_PER_STAGE, score, level, xp, xpToNext(level), kills, SaveManager.getHigh().score, frame);

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
      if      (ty >= 626 && ty <= 684 && tx >= 44 && tx <= W-44) { initGame(); SoundManager.startBgm('battle'); }
      else if (ty >= 694 && ty <= 748 && tx >= 44 && tx <= W-44) { gs.state = 'title'; SoundManager.startBgm('title'); }
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
