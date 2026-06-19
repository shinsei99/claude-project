'use strict';

// ── Stage Intro ───────────────────────────────────────────────────────────────
function drawStageIntro(stage, timer, totalTime) {
  var progress = 1 - timer / totalTime;
  // Fade in 0→0.35, hold 0.35→0.7, fade out 0.7→1
  var alpha;
  if      (progress < 0.35) alpha = progress / 0.35;
  else if (progress > 0.70) alpha = 1 - (progress - 0.70) / 0.30;
  else                      alpha = 1;

  _ctx.fillStyle = 'rgba(0,0,0,' + (alpha * 0.78) + ')';
  _ctx.fillRect(0, 0, _W, _H);

  var sc = 0.82 + alpha * 0.18;
  _ctx.save();
  _ctx.translate(_W / 2, _H / 2);
  _ctx.scale(sc, sc);
  _ctx.globalAlpha = alpha;
  _ctx.textAlign = 'center';

  _ctx.shadowColor = '#FFD700'; _ctx.shadowBlur = 26;
  _ctx.fillStyle = '#FFD700'; _ctx.font = 'bold 26px "Kosugi Maru",sans-serif';
  _ctx.fillText('STAGE', 0, -36);

  _ctx.shadowColor = '#FFFFFF'; _ctx.shadowBlur = 22;
  _ctx.fillStyle = '#FFFFFF'; _ctx.font = 'bold 86px "Kosugi Maru",sans-serif';
  _ctx.fillText(stage, 0, 52);
  _ctx.shadowBlur = 0;

  _ctx.fillStyle = 'rgba(180,210,255,0.70)';
  _ctx.font = '15px "Kosugi Maru",sans-serif';
  _ctx.fillText('タップでスキップ', 0, 96);

  _ctx.globalAlpha = 1;
  _ctx.restore();
}

// ── Gradient button helper ────────────────────────────────────────────────────
function _btnGrd(x, y, w, h, colTop, colBot) {
  var g = _ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, colTop); g.addColorStop(1, colBot);
  return g;
}

// ── Battle HUD ───────────────────────────────────────────────────────────────
function drawHudTop(earthHP, maxEarthHP, barrierActive, stage, wave, wavesPerStage, score, level, xp, xpMax, kills, hs, frame) {
  // Frosted glass bar
  var barG = _ctx.createLinearGradient(0, 0, 0, 82);
  barG.addColorStop(0, 'rgba(8,12,32,0.82)');
  barG.addColorStop(1, 'rgba(4,8,20,0.92)');
  _ctx.fillStyle = barG; _ctx.fillRect(0, 0, _W, 82);
  // Bottom edge glow
  _ctx.strokeStyle = 'rgba(80,140,220,0.22)'; _ctx.lineWidth = 1.5;
  _ctx.beginPath(); _ctx.moveTo(0, 82); _ctx.lineTo(_W, 82); _ctx.stroke();

  // Earth icon + HP bar
  drawEarth(24, 26, 18);
  var ratio = earthHP / maxEarthHP;
  var hcol  = ratio > 0.55 ? '#2ECC71' : ratio > 0.3 ? '#F39C12' : '#E74C3C';
  // Bar bg
  rrect(48, 13, _W - 110, 24, 12, 'rgba(0,0,0,0.7)', 'rgba(80,100,140,0.4)', 1);
  // Bar fill gradient
  if (ratio > 0) {
    var hG = _ctx.createLinearGradient(49, 14, 49, 36);
    hG.addColorStop(0, hcol === '#2ECC71' ? '#50FF90' : hcol === '#F39C12' ? '#FFB830' : '#FF6060');
    hG.addColorStop(1, hcol);
    rrectGrd(49, 14, (_W - 112) * ratio, 22, 11, hG, null);
    // Shine
    _ctx.fillStyle = 'rgba(255,255,255,0.22)';
    _ctx.beginPath();
    _ctx.moveTo(52, 15); _ctx.lineTo(49 + (_W-112)*ratio - 3, 15);
    _ctx.lineTo(49 + (_W-112)*ratio - 3, 20); _ctx.lineTo(52, 20); _ctx.closePath(); _ctx.fill();
  }
  _ctx.fillStyle = '#fff'; _ctx.font = 'bold 11px "Kosugi Maru",sans-serif'; _ctx.textAlign = 'center';
  _ctx.fillText('HP ' + earthHP + '/' + maxEarthHP, 48 + (_W - 112) / 2, 29);

  if (barrierActive) {
    _ctx.globalAlpha = 0.55 + Math.sin(frame * 0.12) * 0.3;
    rrect(47, 12, _W - 110, 26, 13, null, '#00FFFF', 2.5);
    _ctx.globalAlpha = 1;
  }

  // Pause button (tap area: x>W-52, y<48 — unchanged)
  var pG = _btnGrd(_W-46, 8, 36, 30, 'rgba(50,55,80,0.95)', 'rgba(20,22,40,0.95)');
  rrectGrd(_W-46, 8, 36, 30, 6, pG, 'rgba(120,130,180,0.5)', 1.5);
  _ctx.fillStyle = '#ccc'; _ctx.font = 'bold 13px sans-serif'; _ctx.textAlign = 'center';
  _ctx.fillText('❚❚', _W - 28, 28);

  // Stage + Wave badge
  var swG = _btnGrd(8, 44, 80, 30, 'rgba(20,40,80,0.92)', 'rgba(8,18,45,0.92)');
  rrectGrd(8, 44, 80, 30, 6, swG, 'rgba(68,138,187,0.7)', 1.5);
  _ctx.fillStyle = '#7EC8E3'; _ctx.font = 'bold 9px "Kosugi Maru",sans-serif'; _ctx.textAlign = 'center';
  _ctx.fillText('STAGE ' + stage, 48, 55);
  _ctx.fillStyle = '#FFD700'; _ctx.font = 'bold 13px "Kosugi Maru",sans-serif';
  _ctx.fillText('WAVE ' + wave + '/' + wavesPerStage, 48, 70);

  // Score badge
  var scG = _btnGrd(96, 44, 116, 30, 'rgba(25,25,45,0.92)', 'rgba(10,10,28,0.92)');
  rrectGrd(96, 44, 116, 30, 6, scG, 'rgba(80,80,110,0.5)', 1.5);
  _ctx.fillStyle = '#888'; _ctx.font = '9px "Kosugi Maru",sans-serif'; _ctx.textAlign = 'center';
  _ctx.fillText('SCORE', 154, 55);
  _ctx.fillStyle = '#FFD700'; _ctx.font = 'bold 13px "Kosugi Maru",sans-serif';
  _ctx.fillText(score, 154, 70);

  // Level + XP badge
  var lvG = _btnGrd(220, 44, 80, 30, 'rgba(40,15,70,0.92)', 'rgba(18,6,36,0.92)');
  rrectGrd(220, 44, 80, 30, 6, lvG, 'rgba(155,89,182,0.6)', 1.5);
  _ctx.fillStyle = '#CC88FF'; _ctx.font = 'bold 10px "Kosugi Maru",sans-serif'; _ctx.textAlign = 'center';
  _ctx.fillText('Lv.' + level, 260, 56);
  rrect(225, 63, 68, 7, 3, 'rgba(0,0,0,0.55)', null);
  if (xp > 0) {
    var xpG = _ctx.createLinearGradient(225, 63, 225, 70);
    xpG.addColorStop(0, '#CC66FF'); xpG.addColorStop(1, '#7B00CC');
    rrectGrd(225, 63, 68 * Math.min(1, xp / xpMax), 7, 3, xpG, null);
  }

  // Kills + HS
  _ctx.fillStyle = '#666'; _ctx.font = '9px "Kosugi Maru",sans-serif'; _ctx.textAlign = 'right';
  _ctx.fillText('撃破:' + kills, _W - 52, 56);
  _ctx.fillStyle = '#FFD700';
  _ctx.fillText('HS:' + hs, _W - 52, 68);
}

function drawEvoBar(evoGauge, isEvolved, evoTimer) {
  if (evoGauge <= 0 && !isEvolved) return;
  var bx = 8, by = 83, bw = _W - 16, bh = 8;
  rrect(bx-1, by-1, bw+2, bh+2, bh/2+1, 'rgba(0,0,0,0.6)', 'rgba(60,60,80,0.4)', 1);
  if (evoGauge > 0) {
    var eg = _ctx.createLinearGradient(bx, by, bx, by+bh);
    eg.addColorStop(0, isEvolved ? '#FF9060' : '#FFE040');
    eg.addColorStop(1, isEvolved ? '#CC4400' : '#E8A000');
    rrectGrd(bx, by, bw * (evoGauge / 100), bh, bh/2, eg, null);
  }
  if (isEvolved) {
    _ctx.fillStyle = '#FF6B35'; _ctx.font = 'bold 9px "Kosugi Maru",sans-serif'; _ctx.textAlign = 'right';
    _ctx.fillText('にわトリ変身中！ ' + Math.ceil(evoTimer/60) + 's', _W - 10, by - 1);
  }
}

function drawCompanionBtns(upg, cds, CD_MAX, frame) {
  var BTNS = [
    { id:'gunshi',  label:'軍師',   x:50,    color:'#8B4513', hiColor:'#C06020', acc:'glasses' },
    { id:'nurse',   label:'ナース', x:_W/2,  color:'#C0397B', hiColor:'#E05090', acc:'nurse'   },
    { id:'barrier', label:'バリア', x:_W-50, color:'#1A5DAD', hiColor:'#2878CC', acc:'helmet'  },
  ];
  var BY = _H - 65, BR = 30;
  BTNS.forEach(function(btn) {
    var unlocked = upg[btn.id], cd = cds[btn.id], cdMax = CD_MAX[btn.id];
    // Shadow
    _ctx.beginPath(); _ctx.arc(btn.x, BY + 3, BR, 0, Math.PI*2);
    _ctx.fillStyle = 'rgba(0,0,0,0.4)'; _ctx.fill();
    // Button gradient
    var ready = unlocked && cd <= 0;
    var cG = _ctx.createRadialGradient(btn.x - BR*0.3, BY - BR*0.3, 2, btn.x, BY, BR);
    if (ready) {
      cG.addColorStop(0, btn.hiColor); cG.addColorStop(1, btn.color);
    } else {
      cG.addColorStop(0, '#2A2A2A'); cG.addColorStop(1, '#111');
    }
    _ctx.beginPath(); _ctx.arc(btn.x, BY, BR, 0, Math.PI*2);
    _ctx.fillStyle = cG; _ctx.fill();
    _ctx.strokeStyle = ready ? 'rgba(255,255,255,0.7)' : (unlocked ? '#555' : '#333');
    _ctx.lineWidth = ready ? 2.5 : 1.5; _ctx.stroke();
    // Shine arc
    if (ready) {
      _ctx.globalAlpha = 0.25;
      _ctx.fillStyle = '#fff';
      _ctx.beginPath(); _ctx.arc(btn.x, BY, BR, Math.PI*1.1, Math.PI*1.9); _ctx.lineTo(btn.x, BY); _ctx.closePath(); _ctx.fill();
      _ctx.globalAlpha = 1;
    }
    if (unlocked && cd > 0) {
      _ctx.globalAlpha = 0.55; _ctx.fillStyle = '#000';
      _ctx.beginPath(); _ctx.moveTo(btn.x, BY);
      _ctx.arc(btn.x, BY, BR, -Math.PI/2, -Math.PI/2 + Math.PI*2*(cd/cdMax));
      _ctx.closePath(); _ctx.fill(); _ctx.globalAlpha = 1;
      _ctx.fillStyle = '#fff'; _ctx.font = 'bold 12px sans-serif'; _ctx.textAlign = 'center';
      _ctx.fillText(Math.ceil(cd/60) + 's', btn.x, BY + 5);
    } else if (unlocked) {
      drawChick(btn.x, BY - 2, 22, false, btn.acc);
    } else {
      _ctx.fillStyle = '#555'; _ctx.font = '20px sans-serif';
      _ctx.textAlign = 'center'; _ctx.textBaseline = 'middle';
      _ctx.fillText('🔒', btn.x, BY); _ctx.textBaseline = 'alphabetic';
    }
    _ctx.fillStyle = unlocked ? '#ddd' : '#444';
    _ctx.font = '9px "Kosugi Maru",sans-serif'; _ctx.textAlign = 'center';
    _ctx.fillText(btn.label, btn.x, BY + BR + 13);
  });
}

// ── Boss Warning ──────────────────────────────────────────────────────────────
function drawBossWarn(timer, totalWarnTime) {
  var pulse = Math.abs(Math.sin(timer * 0.18));
  _ctx.fillStyle = 'rgba(160,0,0,' + (pulse * 0.38) + ')';
  _ctx.fillRect(0, 0, _W, _H);

  var sc = 1 + Math.sin(timer * 0.22) * 0.08;
  _ctx.save(); _ctx.translate(_W/2, _H/2 - 30); _ctx.scale(sc, sc); _ctx.textAlign = 'center';

  _ctx.shadowColor = '#FF0000'; _ctx.shadowBlur = 28;
  _ctx.strokeStyle = '#000'; _ctx.lineWidth = 10;
  _ctx.fillStyle   = '#FF1A1A';
  _ctx.font = 'bold 48px "Kosugi Maru",sans-serif';
  _ctx.strokeText('⚠️ WARNING!! ⚠️', 0, 0); _ctx.fillText('⚠️ WARNING!! ⚠️', 0, 0);

  _ctx.shadowColor = '#FF8800'; _ctx.shadowBlur = 16;
  _ctx.strokeStyle = '#000'; _ctx.lineWidth = 7;
  _ctx.fillStyle   = '#FFD700';
  _ctx.font = 'bold 31px "Kosugi Maru",sans-serif';
  _ctx.strokeText('BOSS INCOMING!!', 0, 50); _ctx.fillText('BOSS INCOMING!!', 0, 50);
  _ctx.shadowBlur = 0;

  _ctx.restore();
}

// ── Stage Clear ───────────────────────────────────────────────────────────────
function drawStageClear(stage, totalStages, timer, totalTime, frame) {
  var progress = 1 - (timer / totalTime);
  var fadeIn   = Math.min(1, progress * 5);
  _ctx.fillStyle = 'rgba(0,0,0,' + (0.55 * fadeIn) + ')'; _ctx.fillRect(0, 0, _W, _H);

  var sc = (1 + Math.sin(frame * 0.08) * 0.04) * fadeIn;
  _ctx.save(); _ctx.translate(_W/2, _H*0.38); _ctx.scale(sc, sc); _ctx.textAlign = 'center';

  _ctx.shadowColor = '#FFD700'; _ctx.shadowBlur = 28;
  _ctx.fillStyle = '#FFD700'; _ctx.font = 'bold 44px "Kosugi Maru",sans-serif';
  _ctx.fillText('STAGE ' + stage, 0, 0);
  _ctx.shadowColor = '#FFFFFF'; _ctx.shadowBlur = 18;
  _ctx.fillStyle = '#FFFFFF'; _ctx.font = 'bold 54px "Kosugi Maru",sans-serif';
  _ctx.fillText('CLEAR!!', 0, 64);
  _ctx.shadowBlur = 0;
  _ctx.restore();

  _ctx.globalAlpha = fadeIn;
  if (stage < totalStages) {
    _ctx.fillStyle = 'rgba(200,220,255,0.85)';
    _ctx.font = '16px "Kosugi Maru",sans-serif'; _ctx.textAlign = 'center';
    _ctx.fillText('STAGE ' + (stage+1) + ' へ進む...', _W/2, _H*0.38 + 126);
    _ctx.fillStyle = '#4EE890'; _ctx.font = '14px "Kosugi Maru",sans-serif';
    _ctx.fillText('地球HP +20 ボーナス！', _W/2, _H*0.38 + 150);
  } else {
    _ctx.fillStyle = '#FFD700'; _ctx.font = 'bold 20px "Kosugi Maru",sans-serif'; _ctx.textAlign = 'center';
    _ctx.fillText('ALL STAGES COMPLETE!!', _W/2, _H*0.38 + 126);
  }
  _ctx.globalAlpha = 1;
}

// ── Title ────────────────────────────────────────────────────────────────────
function drawTitle(frame, hs, bs, bgmOn, seOn) {
  drawBg(frame);
  _ctx.textAlign = 'center';

  // Title glow
  _ctx.shadowColor = '#FF6B00'; _ctx.shadowBlur = 22;
  _ctx.fillStyle = '#FFD700'; _ctx.font = 'bold 38px "Kosugi Maru",sans-serif';
  _ctx.fillText('ひよこ防衛軍', _W/2, 160);
  _ctx.shadowColor = '#FF9900'; _ctx.shadowBlur = 10;
  _ctx.fillStyle = '#FFA040'; _ctx.font = 'bold 17px "Kosugi Maru",sans-serif';
  _ctx.fillText('～地球救出大作戦～', _W/2, 192);
  _ctx.shadowBlur = 0;

  drawChick(_W/2, 308, 66, false);
  drawCrow({ x:88,  y:268, size:28, hp:3,  maxHp:3,  wobble:frame*0.05,   type:'normal', hitFlash:0 });
  drawCrow({ x:302, y:262, size:22, hp:3,  maxHp:3,  wobble:frame*0.05+1, type:'fast',   hitFlash:0 });
  drawCrow({ x:195, y:250, size:40, hp:24, maxHp:24, wobble:frame*0.05+2, type:'tank',   hitFlash:0 });
  drawEarth(_W/2, 422, 40);

  // Score panel
  var spG = _btnGrd(44, 466, _W-88, 44, 'rgba(12,18,45,0.88)', 'rgba(6,10,28,0.92)');
  rrectGrd(44, 466, _W-88, 44, 8, spG, 'rgba(80,100,150,0.45)', 1.5);
  _ctx.fillStyle = '#FFD700'; _ctx.font = 'bold 12px "Kosugi Maru",sans-serif'; _ctx.textAlign = 'center';
  _ctx.fillText('ベストスコア: ' + hs, _W/2, 484);
  _ctx.fillStyle = '#7EC8E3'; _ctx.font = '11px "Kosugi Maru",sans-serif';
  _ctx.fillText('最高クリアステージ: ' + (bs > 0 ? 'STAGE ' + bs : '---'), _W/2, 500);

  // START button — same tap area: y=522-582, x=72-318
  var pulse = Math.sin(frame * 0.07) * 4;
  var stG = _ctx.createLinearGradient(72, 522+pulse, 72, 578+pulse);
  stG.addColorStop(0, '#FF6040'); stG.addColorStop(0.5, '#E84B2B'); stG.addColorStop(1, '#B83010');
  _ctx.shadowColor = '#FF6040'; _ctx.shadowBlur = 14;
  rrectGrd(72, 522+pulse, 246, 56, 14, stG, '#FFD700', 2.5);
  // Button shine
  _ctx.shadowBlur = 0; _ctx.fillStyle = 'rgba(255,255,255,0.18)';
  _ctx.beginPath();
  _ctx.moveTo(86, 524+pulse); _ctx.lineTo(304, 524+pulse);
  _ctx.lineTo(304, 537+pulse); _ctx.lineTo(86, 537+pulse); _ctx.closePath(); _ctx.fill();
  _ctx.fillStyle = '#fff'; _ctx.font = 'bold 24px "Kosugi Maru",sans-serif'; _ctx.textAlign = 'center';
  _ctx.fillText('START', _W/2, 557+pulse);

  // HOW TO — same tap area: y=590-640, x=72-318
  var htG = _btnGrd(72, 590, 246, 46, 'rgba(28,28,90,0.9)', 'rgba(12,12,55,0.9)');
  rrectGrd(72, 590, 246, 46, 11, htG, 'rgba(80,100,200,0.6)', 2);
  _ctx.fillStyle = '#AAC0FF'; _ctx.font = 'bold 16px "Kosugi Maru",sans-serif';
  _ctx.fillText('あそびかた', _W/2, 619);

  // BGM toggle — same tap area: y=646-694, x=45-183
  var bgmG = _btnGrd(45, 650, 138, 40, bgmOn ? 'rgba(15,65,15,0.9)' : 'rgba(55,15,15,0.9)', bgmOn ? 'rgba(6,40,6,0.9)' : 'rgba(35,6,6,0.9)');
  rrectGrd(45, 650, 138, 40, 8, bgmG, bgmOn ? 'rgba(60,180,60,0.5)' : 'rgba(180,60,60,0.5)', 1.5);
  _ctx.fillStyle = bgmOn ? '#88FF88' : '#FF8888'; _ctx.font = 'bold 14px "Kosugi Maru",sans-serif';
  _ctx.fillText('BGM ' + (bgmOn ? 'ON' : 'OFF'), 114, 675);

  // SE toggle — same tap area: y=646-694, x=207-345
  var seG = _btnGrd(207, 650, 138, 40, seOn ? 'rgba(15,65,15,0.9)' : 'rgba(55,15,15,0.9)', seOn ? 'rgba(6,40,6,0.9)' : 'rgba(35,6,6,0.9)');
  rrectGrd(207, 650, 138, 40, 8, seG, seOn ? 'rgba(60,180,60,0.5)' : 'rgba(180,60,60,0.5)', 1.5);
  _ctx.fillStyle = seOn ? '#88FF88' : '#FF8888';
  _ctx.fillText('SE ' + (seOn ? 'ON' : 'OFF'), 276, 675);

  _ctx.fillStyle = '#444'; _ctx.font = '11px "Kosugi Maru",sans-serif';
  _ctx.fillText('全10ステージ × 5Wave構成', _W/2, 708);
  _ctx.fillStyle = '#2A2A2A'; _ctx.font = '10px sans-serif';
  _ctx.fillText('PIYO-DEFENSE  v3.0', _W/2, _H - 24);
}

// ── How To Play ───────────────────────────────────────────────────────────────
function drawHowTo(frame) {
  drawBg(frame);
  _ctx.fillStyle = 'rgba(0,0,10,0.84)'; _ctx.fillRect(0, 0, _W, _H);
  _ctx.shadowColor = '#FFD700'; _ctx.shadowBlur = 12;
  _ctx.fillStyle = '#FFD700'; _ctx.font = 'bold 26px "Kosugi Maru",sans-serif'; _ctx.textAlign = 'center';
  _ctx.fillText('あそびかた', _W/2, 78);
  _ctx.shadowBlur = 0;

  var rows = [
    ['👆','画面を押しっぱなしで連続発射！'],
    ['🌍','地球のHPが0になるとゲームオーバー'],
    ['💪','敵を倒してレベルアップ！'],
    ['⬆️','Lv.UP時に強化を1つ選ぼう'],
    ['🔵','青カラス：速い！でも弱い'],
    ['🔴','赤カラス：遅い…でも硬い'],
    ['👾','WAVE 5はボス戦！'],
    ['🏆','全10ステージをクリアせよ！'],
  ];
  rows.forEach(function(row, i) {
    var rG = _btnGrd(28, 102+i*80, 334, 66, 'rgba(12,12,44,0.92)', 'rgba(6,6,28,0.92)');
    rrectGrd(28, 102+i*80, 334, 66, 10, rG, 'rgba(50,60,100,0.5)', 1.5);
    _ctx.font = '26px sans-serif'; _ctx.textAlign = 'left';
    _ctx.fillStyle = '#fff'; _ctx.fillText(row[0], 56, 146+i*80);
    _ctx.fillStyle = '#dde'; _ctx.font = '13px "Kosugi Maru",sans-serif';
    _ctx.fillText(row[1], 96, 146+i*80);
  });

  // Back button — tap area: y=748-806 (unchanged)
  var bkG = _btnGrd(72, 750, 246, 52, 'rgba(28,42,100,0.95)', 'rgba(12,18,60,0.95)');
  rrectGrd(72, 750, 246, 52, 13, bkG, 'rgba(100,160,220,0.6)', 2.5);
  _ctx.fillStyle = '#AAC0FF'; _ctx.font = 'bold 18px "Kosugi Maru",sans-serif'; _ctx.textAlign = 'center';
  _ctx.fillText('タイトルに戻る', _W/2, 782);
}

// ── Level Up ─────────────────────────────────────────────────────────────────
function drawLevelUp(choices, level) {
  _ctx.fillStyle = 'rgba(0,0,0,0.86)'; _ctx.fillRect(0, 0, _W, _H);
  _ctx.textAlign = 'center';
  _ctx.shadowColor = '#FFD700'; _ctx.shadowBlur = 24;
  _ctx.fillStyle = '#FFD700'; _ctx.font = 'bold 36px "Kosugi Maru",sans-serif';
  _ctx.fillText('LEVEL UP!', _W/2, 188);
  _ctx.shadowBlur = 0;
  _ctx.fillStyle = '#CC88FF'; _ctx.font = 'bold 14px "Kosugi Maru",sans-serif';
  _ctx.fillText('Lv.' + level + ' に上がった！', _W/2, 218);
  _ctx.fillStyle = '#888'; _ctx.font = '13px "Kosugi Maru",sans-serif';
  _ctx.fillText('強化を1つ選んでください', _W/2, 242);

  // Cards — tap areas: y=268+i*180 to 268+i*180+162 (unchanged)
  choices.forEach(function(ch, i) {
    var cy = 268 + i * 180;
    var cG = _btnGrd(20, cy, _W-40, 162, 'rgba(12,22,65,0.97)', 'rgba(5,10,40,0.97)');
    rrectGrd(20, cy, _W-40, 162, 14, cG, 'rgba(80,100,200,0.6)', 2.5);
    // Shine on top
    _ctx.fillStyle = 'rgba(255,255,255,0.07)';
    _ctx.beginPath();
    _ctx.moveTo(34, cy+2); _ctx.lineTo(_W-34, cy+2);
    _ctx.lineTo(_W-34, cy+22); _ctx.lineTo(34, cy+22); _ctx.closePath(); _ctx.fill();

    _ctx.font = '36px sans-serif'; _ctx.textAlign = 'center';
    _ctx.fillText(ch.icon, _W/2, cy + 52);
    _ctx.fillStyle = '#FFD700'; _ctx.font = 'bold 19px "Kosugi Maru",sans-serif';
    _ctx.fillText(ch.name, _W/2, cy + 88);
    _ctx.fillStyle = '#aaa'; _ctx.font = '13px "Kosugi Maru",sans-serif';
    _ctx.fillText(ch.desc, _W/2, cy + 116);
    _ctx.fillStyle = 'rgba(255,255,255,0.25)'; _ctx.font = '11px sans-serif';
    _ctx.fillText('タップして選択', _W/2, cy + 142);
  });
}

// ── Pause ────────────────────────────────────────────────────────────────────
function drawPause(stage, wave, score) {
  _ctx.fillStyle = 'rgba(0,0,0,0.82)'; _ctx.fillRect(0, 0, _W, _H);
  _ctx.fillStyle = '#fff'; _ctx.font = 'bold 40px "Kosugi Maru",sans-serif'; _ctx.textAlign = 'center';
  _ctx.fillText('PAUSE', _W/2, 280);
  _ctx.fillStyle = '#666'; _ctx.font = '14px "Kosugi Maru",sans-serif';
  _ctx.fillText('STAGE ' + stage + '  WAVE ' + wave + '  SCORE ' + score, _W/2, 316);

  // Resume — tap area: y=358-416 (unchanged)
  var r1G = _btnGrd(72, 358, 246, 58, 'rgba(32,72,180,0.95)', 'rgba(14,36,110,0.95)');
  rrectGrd(72, 358, 246, 58, 14, r1G, 'rgba(100,180,220,0.6)', 2.5);
  _ctx.fillStyle = '#fff'; _ctx.font = 'bold 20px "Kosugi Maru",sans-serif'; _ctx.textAlign = 'center';
  _ctx.fillText('再開する', _W/2, 394);

  // Restart — tap area: y=436-494 (unchanged)
  var r2G = _btnGrd(72, 436, 246, 58, 'rgba(130,22,22,0.95)', 'rgba(80,8,8,0.95)');
  rrectGrd(72, 436, 246, 58, 14, r2G, 'rgba(220,80,80,0.6)', 2.5);
  _ctx.fillStyle = '#fff';
  _ctx.fillText('最初からやり直す', _W/2, 472);

  // Title — tap area: y=514-572 (unchanged)
  var r3G = _btnGrd(72, 514, 246, 58, 'rgba(20,22,65,0.95)', 'rgba(8,10,38,0.95)');
  rrectGrd(72, 514, 246, 58, 14, r3G, 'rgba(60,80,160,0.5)', 2);
  _ctx.fillStyle = '#AAC0FF';
  _ctx.fillText('タイトルへ', _W/2, 550);
}

// ── Game Over ─────────────────────────────────────────────────────────────────
function drawGameOver(score, stage, wave, kills, isNewHS, hs, bs, frame) {
  drawBg(frame);
  _ctx.fillStyle = 'rgba(0,0,0,0.78)'; _ctx.fillRect(0, 0, _W, _H);
  _ctx.textAlign = 'center';
  _ctx.shadowColor = '#FF2020'; _ctx.shadowBlur = 28;
  _ctx.fillStyle = '#FF4444'; _ctx.font = 'bold 48px "Kosugi Maru",sans-serif';
  _ctx.fillText('EARTH CRASH!', _W/2, 168);
  _ctx.shadowBlur = 0;

  drawEarth(_W/2, 254, 42);
  _ctx.strokeStyle = '#FF4444'; _ctx.lineWidth = 4;
  _ctx.beginPath(); _ctx.moveTo(_W/2-6, 213); _ctx.lineTo(_W/2+5, 244); _ctx.lineTo(_W/2-10, 296); _ctx.stroke();

  if (isNewHS) {
    _ctx.shadowColor = '#FFD700'; _ctx.shadowBlur = 18;
    _ctx.fillStyle = '#FFD700'; _ctx.font = 'bold 20px "Kosugi Maru",sans-serif';
    _ctx.fillText('🏆 NEW HIGH SCORE! 🏆', _W/2, 322);
    _ctx.shadowBlur = 0;
  }

  var rows = [
    ['スコア',       score],
    ['到達ステージ', 'STAGE ' + stage + ' - WAVE ' + wave],
    ['撃破数',       kills + ' 体'],
    ['ベストスコア', hs],
    ['最高クリアST', bs > 0 ? 'STAGE ' + bs : '---'],
  ];
  rows.forEach(function(row, i) {
    var ry = 340 + i * 54;
    var rG = _btnGrd(44, ry, _W-88, 44, 'rgba(12,14,36,0.92)', 'rgba(6,8,22,0.92)');
    rrectGrd(44, ry, _W-88, 44, 8, rG, 'rgba(50,60,100,0.4)', 1.5);
    _ctx.fillStyle = '#777'; _ctx.font = '12px "Kosugi Maru",sans-serif'; _ctx.textAlign = 'left';
    _ctx.fillText(row[0], 64, ry + 27);
    _ctx.fillStyle = '#fff'; _ctx.font = 'bold 15px "Kosugi Maru",sans-serif'; _ctx.textAlign = 'right';
    _ctx.fillText(row[1], _W - 58, ry + 27);
  });

  // Replay — tap area: y=626-684, x=44-W-44 (unchanged)
  var pg = _ctx.createLinearGradient(44, 626, 44, 682);
  pg.addColorStop(0, '#FF6040'); pg.addColorStop(0.5, '#E84B2B'); pg.addColorStop(1, '#B83010');
  _ctx.shadowColor = '#FF4020'; _ctx.shadowBlur = 12;
  rrectGrd(44, 626, _W-88, 56, 14, pg, '#FFD700', 2.5);
  _ctx.shadowBlur = 0;
  _ctx.fillStyle = '#fff'; _ctx.font = 'bold 20px "Kosugi Maru",sans-serif'; _ctx.textAlign = 'center';
  _ctx.fillText('もう一度プレイ', _W/2, 661);

  // Title — tap area: y=694-748, x=44-W-44 (unchanged)
  var tG = _btnGrd(44, 694, _W-88, 52, 'rgba(20,22,65,0.95)', 'rgba(8,10,38,0.95)');
  rrectGrd(44, 694, _W-88, 52, 13, tG, 'rgba(60,80,160,0.5)', 2);
  _ctx.fillStyle = '#AAC0FF'; _ctx.font = 'bold 18px "Kosugi Maru",sans-serif';
  _ctx.fillText('タイトルへ', _W/2, 726);
}

// ── Ending (ALL CLEAR) ────────────────────────────────────────────────────────
function drawEnding(score, kills, playFrames, isNewHS, hs, frame) {
  var g = _ctx.createLinearGradient(0, 0, 0, _H);
  g.addColorStop(0, '#001040'); g.addColorStop(1, '#001A08');
  _ctx.fillStyle = g; _ctx.fillRect(0, 0, _W, _H);

  for (var i = 0; i < 70; i++) {
    var sx=(i*141+47)%_W, sy=(i*233+31)%_H;
    _ctx.globalAlpha=(Math.sin(frame*0.04+i)*0.3+0.7)*0.9;
    _ctx.fillStyle='#fff';
    _ctx.beginPath(); _ctx.arc(sx,sy,1+(i%3)*0.4,0,Math.PI*2); _ctx.fill();
  }
  _ctx.globalAlpha = 1;

  // Fireworks
  [[110,220],[280,200],[195,330]].forEach(function(fw, k) {
    var t = frame*0.04 + k*2.1;
    ['#FF4444','#FFD700','#4ECDC4','#FF69B4','#fff','#88FF88'].forEach(function(c, j) {
      var a = t + j*(Math.PI*2/6);
      var r2 = 28 * Math.abs(Math.sin(t*0.6));
      _ctx.globalAlpha = Math.max(0, Math.abs(Math.sin(t)));
      _ctx.shadowColor = c; _ctx.shadowBlur = 6;
      _ctx.fillStyle = c;
      _ctx.beginPath(); _ctx.arc(fw[0]+Math.cos(a)*r2, fw[1]+Math.sin(a)*r2, 3, 0, Math.PI*2); _ctx.fill();
    });
  });
  _ctx.globalAlpha = 1; _ctx.shadowBlur = 0;

  drawEarth(_W/2, 185, 70);
  _ctx.fillStyle = '#FFD700'; _ctx.font = '32px sans-serif'; _ctx.textAlign = 'center';
  _ctx.fillText('🌟', _W/2, 108);

  _ctx.shadowColor = '#FFD700'; _ctx.shadowBlur = 22;
  _ctx.fillStyle = '#FFD700'; _ctx.font = 'bold 52px "Kosugi Maru",sans-serif';
  _ctx.textAlign = 'center'; _ctx.fillText('ALL CLEAR!!', _W/2, 296);
  _ctx.shadowBlur = 0;

  drawChick(_W/2,    378, 58, true);
  drawChick(_W/2-90, 400, 34, false, 'glasses');
  drawChick(_W/2+90, 400, 34, false, 'nurse');
  drawChick(_W/2,    418, 28, false, 'helmet');

  if (isNewHS) {
    _ctx.shadowColor = '#FFD700'; _ctx.shadowBlur = 12;
    _ctx.fillStyle = '#FFD700'; _ctx.font = 'bold 18px "Kosugi Maru",sans-serif';
    _ctx.fillText('🏆 NEW HIGH SCORE! 🏆', _W/2, 458);
    _ctx.shadowBlur = 0;
  }

  var mins = ~~(playFrames/60/60), secs = ~~(playFrames/60)%60;
  var timeStr = (mins<10?'0':'')+mins+':'+(secs<10?'0':'')+secs;
  var rows2 = [['最終スコア',score],['撃破数',kills+' 体'],['プレイ時間',timeStr]];
  rows2.forEach(function(row, i) {
    var ry = 472 + i*56;
    var rG = _btnGrd(55, ry, _W-110, 46, 'rgba(10,12,36,0.88)', 'rgba(4,6,20,0.88)');
    rrectGrd(55, ry, _W-110, 46, 8, rG, 'rgba(40,55,100,0.4)', 1.5);
    _ctx.fillStyle='#777'; _ctx.font='12px "Kosugi Maru",sans-serif'; _ctx.textAlign='left';
    _ctx.fillText(row[0], 76, ry+28);
    _ctx.fillStyle='#fff'; _ctx.font='bold 16px "Kosugi Maru",sans-serif'; _ctx.textAlign='right';
    _ctx.fillText(row[1], _W-70, ry+28);
  });

  _ctx.fillStyle = '#B8E8FF'; _ctx.font = 'bold 16px "Kosugi Maru",sans-serif'; _ctx.textAlign = 'center';
  _ctx.fillText('THANK YOU FOR PLAYING!', _W/2, 648);

  // Replay — tap area: y=664-722, x=55-W-55 (unchanged)
  var eG = _ctx.createLinearGradient(55, 664, 55, 720);
  eG.addColorStop(0, '#3060C0'); eG.addColorStop(1, '#1A3888');
  rrectGrd(55, 664, _W-110, 56, 14, eG, 'rgba(100,180,220,0.6)', 2.5);
  _ctx.fillStyle = '#fff'; _ctx.font = 'bold 20px "Kosugi Maru",sans-serif'; _ctx.textAlign = 'center';
  _ctx.fillText('もう一度プレイ', _W/2, 699);

  // Title — tap area: y=732-784, x=55-W-55 (unchanged)
  var e2G = _btnGrd(55, 732, _W-110, 50, 'rgba(20,22,65,0.95)', 'rgba(8,10,38,0.95)');
  rrectGrd(55, 732, _W-110, 50, 13, e2G, 'rgba(60,80,160,0.5)', 2);
  _ctx.fillStyle = '#AAC0FF'; _ctx.font = 'bold 18px "Kosugi Maru",sans-serif';
  _ctx.fillText('タイトルへ', _W/2, 764);
}
