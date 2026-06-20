'use strict';

// ── Lane positions (used by game.js and render.js) ────────────────────────────
const LANE_X = [78, 195, 312]; // W=390: left 20%, center 50%, right 80%

// ── Boss configs for all 20 stages ───────────────────────────────────────────
// arch: 'bird' | 'beast' | 'reptile' | 'mech' | 'final'
// atkInt: attack interval [p1,p2,p3]  atkDmg: damage [p1,p2,p3]
// warn: lane-warning frames  multiAt: phase for 2-lane attacks  summonAt: phase for summons (0=never)
const BOSS_CONFIG = [
  null,
  // 1: Scavenger Crow
  {name:'スカベンジャー・カラス',   arch:'bird',    col:'#555566', eyeCol:'#FF2200', aura:'200,40,40',   p2:0.65, p3:0.30, atkInt:[120,80,50], atkDmg:[5,7,9],   warn:45, multiAt:3, summonAt:0},
  // 2: Stripe Weasel
  {name:'ストライプ・イタチ',       arch:'beast',   col:'#DDDDE8', eyeCol:'#FF8800', aura:'255,140,0',   p2:0.65, p3:0.28, atkInt:[100,65,40], atkDmg:[6,9,11],  warn:40, multiAt:3, summonAt:0},
  // 3: Snake Hatchling
  {name:'スネーク・ハッチリング',   arch:'reptile', col:'#88EECC', eyeCol:'#AAFFAA', aura:'60,220,120',  p2:0.65, p3:0.30, atkInt:[110,72,44], atkDmg:[5,8,10],  warn:42, multiAt:2, summonAt:3},
  // 4: Hawk Shadow
  {name:'ホーク・シャドウ',         arch:'bird',    col:'#222238', eyeCol:'#8888FF', aura:'80,80,220',   p2:0.65, p3:0.28, atkInt:[100,64,40], atkDmg:[7,10,13], warn:40, multiAt:2, summonAt:0},
  // 5: Wolf Pack Leader
  {name:'ウルフ・パックリーダー',   arch:'beast',   col:'#885544', eyeCol:'#FF3300', aura:'220,80,20',   p2:0.62, p3:0.28, atkInt:[95,60,36],  atkDmg:[7,11,14], warn:38, multiAt:2, summonAt:2},
  // 6: Giant Frog
  {name:'ジャイアント・フロッグ',   arch:'reptile', col:'#446633', eyeCol:'#AAFF44', aura:'80,200,60',   p2:0.65, p3:0.30, atkInt:[108,70,42], atkDmg:[7,10,13], warn:42, multiAt:2, summonAt:0},
  // 7: Scorpion Claw
  {name:'スコーピオン・クロー',     arch:'reptile', col:'#222210', eyeCol:'#FFCC00', aura:'160,130,0',   p2:0.62, p3:0.28, atkInt:[100,62,38], atkDmg:[8,12,15], warn:38, multiAt:2, summonAt:2},
  // 8: Buzzard Reaper
  {name:'バズード・リーパー',       arch:'mech',    col:'#442200', eyeCol:'#FF6600', aura:'200,80,0',    p2:0.65, p3:0.28, atkInt:[95,58,35],  atkDmg:[8,12,15], warn:36, multiAt:2, summonAt:2},
  // 9: Honey Bear Breaker
  {name:'ハニーベア・ブレイカー',   arch:'beast',   col:'#885533', eyeCol:'#FFBB00', aura:'200,140,0',   p2:0.62, p3:0.28, atkInt:[108,68,40], atkDmg:[9,13,17], warn:40, multiAt:2, summonAt:2},
  // 10: Night Crow Larvae
  {name:'ナイトクロウ幼体',         arch:'bird',    col:'#111122', eyeCol:'#8888FF', aura:'60,60,200',   p2:0.62, p3:0.28, atkInt:[92,56,34],  atkDmg:[9,13,17], warn:35, multiAt:2, summonAt:2},
  // 11: Night Crow Full
  {name:'ナイトクロウ完全体',       arch:'bird',    col:'#000011', eyeCol:'#CCCCFF', aura:'100,100,255', p2:0.60, p3:0.25, atkInt:[86,52,32],  atkDmg:[10,15,19],warn:32, multiAt:2, summonAt:2},
  // 12: Magma Boar
  {name:'マグマ・ボア',             arch:'beast',   col:'#AA2200', eyeCol:'#FF6600', aura:'255,60,0',    p2:0.60, p3:0.25, atkInt:[88,54,32],  atkDmg:[11,16,20],warn:32, multiAt:2, summonAt:2},
  // 13: King Cobra Arc
  {name:'キング・コブラ・アーク',   arch:'reptile', col:'#998800', eyeCol:'#88EEEE', aura:'140,200,100', p2:0.58, p3:0.25, atkInt:[84,50,30],  atkDmg:[11,16,21],warn:30, multiAt:2, summonAt:2},
  // 14: Tyrant Giraffe Beast
  {name:'タイラント・キリン',       arch:'mech',    col:'#CC9900', eyeCol:'#FFFF44', aura:'200,180,0',   p2:0.60, p3:0.25, atkInt:[88,54,32],  atkDmg:[12,17,22],warn:34, multiAt:3, summonAt:2},
  // 15: Mirage Mecha Hawk
  {name:'ミラージュ・メカホーク',   arch:'mech',    col:'#336688', eyeCol:'#00FFFF', aura:'0,180,255',   p2:0.58, p3:0.25, atkInt:[80,48,28],  atkDmg:[12,18,23],warn:30, multiAt:2, summonAt:2},
  // 16: Swarm Roach Queen
  {name:'スウォーム・ローチクイーン',arch:'mech',   col:'#334411', eyeCol:'#AAFF44', aura:'100,180,40',  p2:0.55, p3:0.22, atkInt:[78,46,27],  atkDmg:[13,19,24],warn:30, multiAt:3, summonAt:1},
  // 17: Sand Ripper
  {name:'サンド・リッパー',         arch:'reptile', col:'#AA8844', eyeCol:'#FF4400', aura:'200,120,30',  p2:0.55, p3:0.22, atkInt:[76,44,26],  atkDmg:[13,19,25],warn:28, multiAt:2, summonAt:2},
  // 18: Frost Ursa
  {name:'フロスト・ウルサ',         arch:'beast',   col:'#AACCEE', eyeCol:'#AAEEFF', aura:'100,180,220', p2:0.55, p3:0.22, atkInt:[78,46,28],  atkDmg:[14,20,26],warn:30, multiAt:3, summonAt:2},
  // 19: Eclipse Wyvern
  {name:'エクリプス・ワイバーン',   arch:'final',   col:'#330044', eyeCol:'#FF44FF', aura:'140,0,180',   p2:0.55, p3:0.20, atkInt:[72,42,24],  atkDmg:[14,21,27],warn:28, multiAt:3, summonAt:2},
  // 20: Apocalypse Predator
  {name:'アポカリプス・プレデター', arch:'final',   col:'#110011', eyeCol:'#FF00FF', aura:'180,0,180',   p2:0.55, p3:0.18, atkInt:[68,38,20],  atkDmg:[15,23,30],warn:24, multiAt:2, summonAt:1},
];

const ENEMY_DEF = {
  // ── 既存 ──────────────────────────────────────────────────────────────────
  normal:       { baseHp:2,   dmg:5,  size:28, pts:10,  spd:1.0,  xpGain:1 },
  fast:         { baseHp:1,   dmg:4,  size:20, pts:10,  spd:2.2,  xpGain:1 },
  ranged:       { baseHp:4,   dmg:9,  size:26, pts:15,  spd:0.7,  xpGain:2 },
  tank:         { baseHp:10,  dmg:14, size:44, pts:25,  spd:0.42, xpGain:3 },
  ghost:        { baseHp:3,   dmg:7,  size:26, pts:20,  spd:1.2,  xpGain:2 },
  healer:       { baseHp:5,   dmg:5,  size:28, pts:25,  spd:0.60, xpGain:3 },
  bomber:       { baseHp:5,   dmg:20, size:38, pts:30,  spd:0.52, xpGain:3 },
  sprinter:     { baseHp:2,   dmg:6,  size:22, pts:18,  spd:0.55, xpGain:2 },
  armored:      { baseHp:8,   dmg:8,  size:32, pts:28,  spd:0.80, xpGain:3 },
  regen:        { baseHp:10,  dmg:7,  size:30, pts:25,  spd:0.70, xpGain:3 },
  shielded:     { baseHp:6,   dmg:7,  size:28, pts:26,  spd:0.85, xpGain:3 },
  splitter:     { baseHp:12,  dmg:9,  size:36, pts:32,  spd:0.55, xpGain:4 },
  swarm:        { baseHp:1,   dmg:3,  size:14, pts:5,   spd:1.5,  xpGain:1 },
  // ── 新型 ──────────────────────────────────────────────────────────────────
  poison:       { baseHp:5,   dmg:7,  size:26, pts:22,  spd:0.72, xpGain:2 },
  stealth:      { baseHp:3,   dmg:6,  size:22, pts:24,  spd:1.15, xpGain:2 },
  berserker:    { baseHp:6,   dmg:9,  size:30, pts:28,  spd:0.85, xpGain:3 },
  titan:        { baseHp:28,  dmg:18, size:62, pts:60,  spd:0.22, xpGain:6 },
  leech:        { baseHp:7,   dmg:5,  size:28, pts:30,  spd:0.68, xpGain:3 },
  necro:        { baseHp:6,   dmg:7,  size:28, pts:35,  spd:0.78, xpGain:4 },
  phantom:      { baseHp:3,   dmg:6,  size:24, pts:28,  spd:1.05, xpGain:3 },
  // ── 旧ボス（後方互換）────────────────────────────────────────────────────
  boss_chicken: { baseHp:55,  dmg:0,  size:82, pts:200, spd:0.45, xpGain:8 },
  boss_snake:   { baseHp:75,  dmg:0,  size:86, pts:200, spd:0.32, xpGain:8 },
  boss:         { baseHp:70,  dmg:0,  size:90, pts:200, spd:0.38, xpGain:8 },
  // ── 新ボス 20体 ───────────────────────────────────────────────────────────
  boss_s1:  {baseHp:35,  dmg:0, size:72,  pts:120, spd:0.55, xpGain:6},
  boss_s2:  {baseHp:40,  dmg:0, size:70,  pts:140, spd:0.68, xpGain:6},
  boss_s3:  {baseHp:42,  dmg:0, size:74,  pts:150, spd:0.45, xpGain:7},
  boss_s4:  {baseHp:46,  dmg:0, size:78,  pts:160, spd:0.52, xpGain:7},
  boss_s5:  {baseHp:50,  dmg:0, size:80,  pts:170, spd:0.48, xpGain:7},
  boss_s6:  {baseHp:52,  dmg:0, size:82,  pts:180, spd:0.42, xpGain:7},
  boss_s7:  {baseHp:55,  dmg:0, size:80,  pts:190, spd:0.38, xpGain:8},
  boss_s8:  {baseHp:56,  dmg:0, size:82,  pts:195, spd:0.50, xpGain:8},
  boss_s9:  {baseHp:58,  dmg:0, size:88,  pts:200, spd:0.35, xpGain:8},
  boss_s10: {baseHp:60,  dmg:0, size:80,  pts:210, spd:0.55, xpGain:8},
  boss_s11: {baseHp:63,  dmg:0, size:86,  pts:220, spd:0.60, xpGain:9},
  boss_s12: {baseHp:66,  dmg:0, size:90,  pts:230, spd:0.40, xpGain:9},
  boss_s13: {baseHp:70,  dmg:0, size:88,  pts:240, spd:0.38, xpGain:9},
  boss_s14: {baseHp:73,  dmg:0, size:94,  pts:250, spd:0.30, xpGain:9},
  boss_s15: {baseHp:76,  dmg:0, size:88,  pts:260, spd:0.55, xpGain:10},
  boss_s16: {baseHp:78,  dmg:0, size:86,  pts:270, spd:0.42, xpGain:10},
  boss_s17: {baseHp:80,  dmg:0, size:92,  pts:280, spd:0.35, xpGain:10},
  boss_s18: {baseHp:84,  dmg:0, size:94,  pts:290, spd:0.32, xpGain:10},
  boss_s19: {baseHp:88,  dmg:0, size:96,  pts:300, spd:0.48, xpGain:10},
  boss_s20: {baseHp:100, dmg:0, size:100, pts:400, spd:0.40, xpGain:12},
};

class Enemy {
  constructor(type, x, y, stage, waveInStage) {
    this.type      = type;
    this.x         = x;
    this.y         = y;
    this.dead      = false;
    this.wobble    = Math.random() * Math.PI * 2;
    this.bossTimer = 0;
    this.hitFlash  = 0;

    const def = ENEMY_DEF[type];
    const isStageBoss = type.startsWith('boss_s');
    const isOldBoss   = (type === 'boss' || type === 'boss_chicken' || type === 'boss_snake');
    const isBoss      = isStageBoss || isOldBoss;

    if (isBoss) {
      const bossScale = 1 + (stage - 1) * 0.55;
      this.maxHp = Math.ceil(def.baseHp * bossScale);
    } else {
      const stageScale = 1 + (stage - 1) * 0.38;
      const waveScale  = 1 + (waveInStage - 1) * 0.12;
      this.maxHp = Math.max(1, Math.ceil(def.baseHp * stageScale * waveScale));
    }

    this.hp      = this.maxHp;
    this.dmg     = def.dmg;
    this.size    = def.size;
    this.pts     = def.pts;
    this.xpGain  = def.xpGain;
    this.spd     = def.spd * (1 + (stage - 1) * 0.06);

    // ── 新ボス初期化 ────────────────────────────────────────────────────────
    if (isStageBoss) {
      this._stageNum = parseInt(type.replace('boss_s', ''));
      this.vx = (Math.random() < 0.5 ? 1 : -1) * (1.4 + this.spd * 1.2);
      this.vy = 0;
      this.phase = 1; this.summonTimer = 0; this.bossTimer = 0;

    // ── 旧ボス初期化 ────────────────────────────────────────────────────────
    } else if (type === 'boss') {
      this.vx = 1.8; this.vy = 0;
      this.phase = 1; this.summonTimer = 0;

    } else if (type === 'boss_chicken') {
      this.vx = 2.0; this.vy = 0;
      this.phase = 1; this.summonTimer = 0;
      this.rushTimer = 0; this.isRushing = false; this.rushVy = 0;
      this.shotCooldown = 0;

    } else if (type === 'boss_snake') {
      this.vx = 1.5; this.vy = 0;
      this.phase = 1; this.burrowTimer = 0;
      this.isBurrowed = false; this.burrowCd = 0;
      this.sprayTimer = 0;

    // ── 通常敵初期化 ────────────────────────────────────────────────────────
    } else if (type === 'ranged') {
      this.stopY = 175 + Math.random() * 90;
      this.rangedTimer = 0;
      this.vx = (Math.random() - 0.5) * 1.2; this.vy = this.spd;
    } else if (type === 'healer') {
      this.stopY = 128 + Math.random() * 64;
      this.healTimer = 0;
      this.vx = (Math.random() - 0.5) * 0.8; this.vy = this.spd;
    } else if (type === 'ghost') {
      this.vx = (Math.random() - 0.5) * 2.2; this.vy = this.spd;
    } else if (type === 'bomber') {
      this.vx = (Math.random() - 0.5) * 0.4; this.vy = this.spd;
    } else if (type === 'sprinter') {
      this.vx = (Math.random() - 0.5) * 1.2; this.vy = this.spd;
      this.sprintTimer = ~~(Math.random() * 40); this.sprintPhase = 0;
    } else if (type === 'armored') {
      this.vx = (Math.random() - 0.5) * 1.0; this.vy = this.spd;
    } else if (type === 'regen') {
      this.vx = (Math.random() - 0.5) * 1.2; this.vy = this.spd;
      this.regenTimer = 0;
    } else if (type === 'shielded') {
      this.vx = (Math.random() - 0.5) * 1.2; this.vy = this.spd;
      this.maxShield = Math.max(2, Math.ceil(this.maxHp * 0.6));
      this.shield = this.maxShield;
    } else if (type === 'splitter') {
      this.vx = (Math.random() - 0.5) * 1.0; this.vy = this.spd;
    } else if (type === 'swarm') {
      this.vx = (Math.random() - 0.5) * 2.8; this.vy = this.spd;
    } else if (type === 'poison') {
      this.vx = (Math.random() - 0.5) * 1.0; this.vy = this.spd;
      this.bubbleTimer = 0;
    } else if (type === 'stealth') {
      this.vx = (Math.random() - 0.5) * 1.6; this.vy = this.spd;
      this.stealthTimer = ~~(Math.random() * 90);
      this.isHidden = false;
    } else if (type === 'berserker') {
      this.vx = (Math.random() - 0.5) * 1.4; this.vy = this.spd;
      this.enraged = false;
    } else if (type === 'titan') {
      this.vx = (Math.random() - 0.5) * 0.3; this.vy = this.spd;
    } else if (type === 'leech') {
      this.vx = (Math.random() - 0.5) * 1.0; this.vy = this.spd;
      this.leechTimer = 0;
    } else if (type === 'necro') {
      this.vx = (Math.random() - 0.5) * 1.2; this.vy = this.spd;
      this.necroRevived = false; this.reviveTimer = 0;
    } else if (type === 'phantom') {
      this.vx = (Math.random() - 0.5) * 1.5; this.vy = this.spd;
      this.phantomTimer = ~~(Math.random() * 60);
    } else {
      this.vx = (Math.random() - 0.5) * 1.5; this.vy = this.spd;
    }
  }

  // ── 新ボス共通ロジック ─────────────────────────────────────────────────────
  _updateStageBoss(barrierActive, frame) {
    const cfg = BOSS_CONFIG[this._stageNum];
    if (!cfg) return null;
    const hpRatio = this.hp / this.maxHp;
    const newPhase = hpRatio < cfg.p3 ? 3 : hpRatio < cfg.p2 ? 2 : 1;
    if (newPhase > this.phase) {
      this.phase = newPhase; this.bossTimer = 0;
      return {type: 'phase_change', phase: newPhase};
    }

    // 横移動
    const spdMult = this.phase === 3 ? 2.6 : this.phase === 2 ? 1.7 : 1.0;
    this.x += this.vx * spdMult;
    this.y = 215 + Math.sin(frame * 0.022) * 28;
    if (this.x < 60 || this.x > 330) this.vx *= -1;

    // 召喚
    if (cfg.summonAt > 0 && this.phase >= cfg.summonAt) {
      this.summonTimer++;
      if (this.summonTimer >= 220) {
        this.summonTimer = 0;
        return {type: 'boss_summon'};
      }
    }

    // 攻撃タイミング
    this.bossTimer++;
    const interval = cfg.atkInt[this.phase - 1];
    if (this.bossTimer >= interval) {
      this.bossTimer = 0;
      if (barrierActive) return {type: 'barrier'};
      const dmg   = cfg.atkDmg[this.phase - 1];
      const warnF = cfg.warn;

      // 3レーン全攻撃（後半ステージP3のみ）
      if (this.phase === 3 && this._stageNum >= 17) {
        return {type: 'multi_lane_warn', lanes: [0, 1, 2], warnFrames: warnF, dmg: dmg};
      }
      // 2レーン攻撃
      if (this.phase >= cfg.multiAt) {
        const l1 = ~~(Math.random() * 3);
        const l2 = (l1 + 1 + ~~(Math.random() * 2)) % 3;
        return {type: 'multi_lane_warn', lanes: [l1, l2], warnFrames: warnF, dmg: dmg};
      }
      // 1レーン攻撃
      const targetLane = ~~(Math.random() * 3);
      return {type: 'lane_warn', lane: targetLane, warnFrames: warnF, dmg: dmg};
    }
    return null;
  }

  update(barrierActive, frame, H) {
    this.wobble += 0.05;
    if (this.hitFlash > 0) this.hitFlash--;

    // ── necro 復活待機 ─────────────────────────────────────────────────────
    if (this.type === 'necro' && this.reviveTimer > 0) {
      this.reviveTimer--;
      if (this.reviveTimer <= 0) {
        this.hp   = Math.ceil(this.maxHp * 0.5);
        this.dead = false;
        this.necroRevived = true;
      }
      return null;
    }

    // ── 新ボス ─────────────────────────────────────────────────────────────
    if (this.type.startsWith('boss_s')) {
      return this._updateStageBoss(barrierActive, frame);
    }

    // ── UFOボス ───────────────────────────────────────────────────────────
    if (this.type === 'boss') {
      const hpRatio = this.hp / this.maxHp;
      const newPhase = hpRatio < 0.25 ? 3 : hpRatio < 0.60 ? 2 : 1;
      if (newPhase > this.phase) {
        this.phase = newPhase; this.bossTimer = 0;
        return { type: 'phase_change', phase: newPhase };
      }
      const targetSpd = this.phase === 3 ? 4.5 : this.phase === 2 ? 3.0 : 1.8;
      this.vx = Math.sign(this.vx || 1) * targetSpd;
      this.x += this.vx;
      if (this.x < 70 || this.x > 320) this.vx *= -1;
      this.y = 230 + Math.sin(frame * 0.018) * 30;
      if (this.phase >= 2) {
        this.summonTimer++;
        if (this.summonTimer >= 200) { this.summonTimer = 0; return { type: 'boss_summon' }; }
      }
      const beamInterval = this.phase === 3 ? 38 : this.phase === 2 ? 65 : 110;
      const beamDmg      = this.phase === 3 ? 11 : 7;
      this.bossTimer++;
      if (this.bossTimer >= beamInterval) {
        this.bossTimer = 0;
        return barrierActive ? { type: 'barrier' } : { type: 'beam', dmg: beamDmg };
      }
      return null;
    }

    // ── ニワトリ大魔王 ────────────────────────────────────────────────────
    if (this.type === 'boss_chicken') {
      const hpRatio = this.hp / this.maxHp;
      const newPhase = hpRatio < 0.30 ? 3 : hpRatio < 0.65 ? 2 : 1;
      if (newPhase > this.phase) {
        this.phase = newPhase; this.bossTimer = 0;
        return { type: 'phase_change', phase: newPhase };
      }
      const spd = this.phase === 3 ? 3.8 : this.phase === 2 ? 2.5 : 1.6;
      this.vx = Math.sign(this.vx || 1) * spd;
      this.x += this.vx;
      if (this.x < 60 || this.x > 330) this.vx *= -1;
      this.y = 220 + Math.sin(frame * 0.022) * 25;
      this.shotCooldown--;
      if (this.shotCooldown <= 0) {
        this.shotCooldown = this.phase === 3 ? 55 : this.phase === 2 ? 80 : 120;
        if (!barrierActive) return { type: 'triple_shot', x: this.x, y: this.y + this.size * 0.5, dmg: this.dmg };
        return { type: 'barrier' };
      }
      this.summonTimer++;
      const summonInterval = this.phase >= 2 ? 160 : 240;
      if (this.summonTimer >= summonInterval) {
        this.summonTimer = 0;
        return { type: 'boss_summon' };
      }
      this.bossTimer++;
      const rushInterval = this.phase === 3 ? 50 : this.phase === 2 ? 80 : 130;
      if (this.bossTimer >= rushInterval) {
        this.bossTimer = 0;
        if (!barrierActive) return { type: 'beam', dmg: this.phase >= 2 ? 9 : 6 };
        return { type: 'barrier' };
      }
      return null;
    }

    // ── 巨大ヘビ ──────────────────────────────────────────────────────────
    if (this.type === 'boss_snake') {
      const hpRatio = this.hp / this.maxHp;
      const newPhase = hpRatio < 0.30 ? 3 : hpRatio < 0.65 ? 2 : 1;
      if (newPhase > this.phase) {
        this.phase = newPhase; this.bossTimer = 0;
        return { type: 'phase_change', phase: newPhase };
      }
      if (this.burrowCd > 0) this.burrowCd--;
      if (this.isBurrowed) {
        this.burrowTimer--;
        if (this.burrowTimer <= 0) {
          this.isBurrowed = false;
          this.x = 80 + Math.random() * 230;
          this.y = 200 + Math.sin(frame * 0.02) * 28;
        }
        return null;
      }
      const snakeSpd = this.phase === 3 ? 3.2 : this.phase === 2 ? 2.2 : 1.4;
      this.vx = Math.sign(this.vx || 1) * snakeSpd;
      this.x += this.vx + Math.sin(frame * 0.08) * 1.2;
      if (this.x < 60 || this.x > 330) this.vx *= -1;
      this.y = 215 + Math.sin(frame * 0.025) * 32;
      this.sprayTimer++;
      const sprayInterval = this.phase === 3 ? 48 : this.phase === 2 ? 72 : 110;
      if (this.sprayTimer >= sprayInterval) {
        this.sprayTimer = 0;
        if (!barrierActive) return { type: 'snake_spray', x: this.x, y: this.y + this.size * 0.5, dmg: this.dmg };
        return { type: 'barrier' };
      }
      this.bossTimer++;
      const burrowInterval = this.phase === 3 ? 90 : this.phase === 2 ? 140 : 200;
      if (this.bossTimer >= burrowInterval && this.burrowCd <= 0) {
        this.bossTimer = 0; this.burrowCd = 180;
        this.isBurrowed = true; this.burrowTimer = 50;
        return { type: 'boss_burrow' };
      }
      if (this.phase >= 2) {
        this.summonTimer = (this.summonTimer || 0) + 1;
        const sweepInterval = this.phase === 3 ? 60 : 100;
        if (this.summonTimer >= sweepInterval) {
          this.summonTimer = 0;
          if (!barrierActive) return { type: 'beam', dmg: this.phase >= 3 ? 12 : 9 };
          return { type: 'barrier' };
        }
      }
      return null;
    }

    // ── 通常敵 ────────────────────────────────────────────────────────────
    if (this.type === 'ranged') {
      if (this.y < this.stopY) {
        this.x += this.vx + Math.sin(this.wobble) * 0.3;
        this.y += this.vy;
        if (this.x < this.size || this.x > 390 - this.size) this.vx *= -1;
      } else {
        this.x += Math.sin(this.wobble * 0.7) * 0.9;
        this.x = Math.max(this.size, Math.min(390 - this.size, this.x));
        this.rangedTimer++;
        if (this.rangedTimer >= 80) {
          this.rangedTimer = 0;
          return barrierActive ? { type: 'barrier' }
            : { type: 'rangedbullet', x: this.x, y: this.y + this.size * 0.5, dmg: this.dmg };
        }
      }
    } else if (this.type === 'healer') {
      if (this.y < this.stopY) {
        this.x += this.vx + Math.sin(this.wobble) * 0.4;
        this.y += this.vy;
        if (this.x < this.size || this.x > 390 - this.size) this.vx *= -1;
      } else {
        this.x += Math.sin(this.wobble * 0.5) * 1.0;
        this.x = Math.max(this.size, Math.min(390 - this.size, this.x));
        this.healTimer++;
        if (this.healTimer >= 95) {
          this.healTimer = 0; return { type: 'heal', amount: 3 };
        }
      }
    } else if (this.type === 'ghost') {
      this.x += this.vx + Math.sin(this.wobble * 1.5) * 0.9;
      this.y += this.vy;
      if (this.x < this.size || this.x > 390 - this.size) this.vx *= -1;
      if (this.y > H - 160) { this.dead = true; return barrierActive ? { type:'barrier' } : { type:'reach', dmg:this.dmg }; }
    } else if (this.type === 'bomber') {
      this.x += Math.sin(this.wobble * 0.3) * 0.3;
      this.y += this.vy;
      if (this.y > H - 150) { this.dead = true; return barrierActive ? { type:'barrier' } : { type:'bomb', dmg:this.dmg }; }
    } else if (this.type === 'sprinter') {
      this.sprintTimer++;
      if (this.sprintPhase === 0) {
        this.x += Math.sin(this.wobble) * 0.5; this.y += this.vy * 0.15;
        if (this.sprintTimer >= 50) { this.sprintTimer = 0; this.sprintPhase = 1; }
      } else {
        this.x += this.vx; this.y += this.vy * 5.0;
        if (this.sprintTimer >= 16) { this.sprintTimer = 0; this.sprintPhase = 0; }
      }
      if (this.x < this.size || this.x > 390 - this.size) this.vx *= -1;
      if (this.y > H - 160) { this.dead = true; return barrierActive ? { type:'barrier' } : { type:'reach', dmg:this.dmg }; }
    } else if (this.type === 'regen') {
      this.x += this.vx + Math.sin(this.wobble) * 0.4; this.y += this.vy;
      if (this.x < this.size || this.x > 390 - this.size) this.vx *= -1;
      this.regenTimer++;
      if (this.regenTimer >= 85) { this.regenTimer = 0; this.hp = Math.min(this.maxHp, this.hp + 2); }
      if (this.y > H - 160) { this.dead = true; return barrierActive ? { type:'barrier' } : { type:'reach', dmg:this.dmg }; }
    } else if (this.type === 'poison') {
      this.x += this.vx + Math.sin(this.wobble) * 0.6; this.y += this.vy;
      if (this.x < this.size || this.x > 390 - this.size) this.vx *= -1;
      this.bubbleTimer++;
      if (this.y > H - 160) { this.dead = true; return barrierActive ? { type:'barrier' } : { type:'poison_reach', dmg:this.dmg }; }
    } else if (this.type === 'stealth') {
      this.stealthTimer++;
      if (this.stealthTimer >= 120) { this.stealthTimer = 0; this.isHidden = !this.isHidden; }
      this.x += this.vx + Math.sin(this.wobble) * 0.5; this.y += this.vy;
      if (this.x < this.size || this.x > 390 - this.size) this.vx *= -1;
      if (this.y > H - 160) { this.dead = true; return barrierActive ? { type:'barrier' } : { type:'reach', dmg:this.dmg }; }
    } else if (this.type === 'berserker') {
      if (!this.enraged && this.hp < this.maxHp * 0.5) {
        this.enraged = true; this.vy *= 2.0; this.vx *= 1.5;
      }
      this.x += this.vx + Math.sin(this.wobble) * 0.5; this.y += this.vy;
      if (this.x < this.size || this.x > 390 - this.size) this.vx *= -1;
      if (this.y > H - 160) { this.dead = true; return barrierActive ? { type:'barrier' } : { type:'reach', dmg:this.dmg * (this.enraged ? 2 : 1) }; }
    } else if (this.type === 'titan') {
      this.x += this.vx + Math.sin(this.wobble * 0.3) * 0.2; this.y += this.vy;
      if (this.x < this.size || this.x > 390 - this.size) this.vx *= -1;
      if (this.y > H - 160) { this.dead = true; return barrierActive ? { type:'barrier' } : { type:'reach', dmg:this.dmg }; }
    } else if (this.type === 'leech') {
      this.x += this.vx + Math.sin(this.wobble) * 0.5; this.y += this.vy;
      if (this.x < this.size || this.x > 390 - this.size) this.vx *= -1;
      this.leechTimer++; if (this.leechTimer >= 120) { this.leechTimer = 0; this.hp = Math.min(this.maxHp, this.hp + 1); }
      if (this.y > H - 160) { this.dead = true; return barrierActive ? { type:'barrier' } : { type:'reach', dmg:this.dmg }; }
    } else if (this.type === 'necro') {
      this.x += this.vx + Math.sin(this.wobble) * 0.5; this.y += this.vy;
      if (this.x < this.size || this.x > 390 - this.size) this.vx *= -1;
      if (this.y > H - 160) { this.dead = true; return barrierActive ? { type:'barrier' } : { type:'reach', dmg:this.dmg }; }
    } else if (this.type === 'phantom') {
      this.phantomTimer++;
      if (this.phantomTimer >= 90) {
        this.phantomTimer = 0;
        this.x = 50 + Math.random() * 290;
        this.y = Math.max(this.y - 40, 60);
      }
      this.x += this.vx + Math.sin(this.wobble) * 0.8; this.y += this.vy;
      if (this.x < this.size || this.x > 390 - this.size) this.vx *= -1;
      if (this.y > H - 160) { this.dead = true; return barrierActive ? { type:'barrier' } : { type:'reach', dmg:this.dmg }; }
    } else {
      this.x += this.vx + Math.sin(this.wobble) * 0.4; this.y += this.vy;
      if (this.x < this.size || this.x > 390 - this.size) this.vx *= -1;
      if (this.y > H - 160) {
        this.dead = true;
        return barrierActive ? { type: 'barrier' } : { type: 'reach', dmg: this.dmg };
      }
    }
    return null;
  }

  takeDamage(dmg) {
    if (this.type === 'stealth' && this.isHidden && Math.random() < 0.5) {
      this.hitFlash = 4; return false;
    }
    if (this.type === 'armored') dmg = Math.max(1, Math.ceil(dmg * 0.5));
    if (this.type === 'titan')   dmg = Math.max(1, Math.ceil(dmg * 0.6));
    if (this.type === 'shielded' && this.shield > 0) {
      this.shield -= dmg;
      if (this.shield < 0) { dmg = -this.shield; this.shield = 0; }
      else { this.hitFlash = 6; return false; }
    }
    this.hp -= dmg;
    this.hitFlash = 6;
    if (this.hp <= 0) {
      this.hp = 0;
      if (this.type === 'necro' && !this.necroRevived) {
        this.dead = true;
        this.reviveTimer = 80;
        return false;
      }
      this.dead = true; return true;
    }
    return false;
  }
}

// ── Bullet ───────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, tx, ty, opts) {
    opts         = opts || {};
    this.x       = x; this.y = y;
    this.damage  = opts.damage   || 2;
    this.pierceLeft = opts.pierce || 0;
    this.crit    = opts.crit     || false;
    this.evolved = opts.evolved  || false;
    this.explode = opts.explode  || false;
    const speed  = (this.evolved ? 7 : 11) * (opts.bulletSpd || 1);
    const dx = tx - x, dy = ty - y;
    const d  = Math.sqrt(dx*dx + dy*dy) || 1;
    this.vx  = dx / d * speed; this.vy = dy / d * speed;
    this.size = this.evolved ? 18 : 12;
    this.life = Math.round(90 * (opts.rangeMult || 1));
    this.dead = false;
    this.rot  = Math.atan2(dy, dx);
    this.hitSet = new Set();
  }

  update(enemies) {
    this.x += this.vx; this.y += this.vy;
    this.life--;
    if (this.life <= 0 || this.x < -20 || this.x > 410 || this.y < -20 || this.y > 864) {
      this.dead = true; return null;
    }
    for (const e of enemies) {
      if (e.dead || this.hitSet.has(e)) continue;
      const dx = this.x - e.x, dy = this.y - e.y;
      if (Math.sqrt(dx*dx + dy*dy) < e.size * 0.75 + this.size * 0.5) {
        if (this.evolved || this.explode) { this.dead = true; return { type:'explode', x:this.x, y:this.y }; }
        const dmg    = this.crit ? this.damage * 2 : this.damage;
        const killed = e.takeDamage(dmg);
        this.hitSet.add(e);
        if (this.pierceLeft <= 0) this.dead = true;
        else this.pierceLeft--;
        return { type:'hit', enemy:e, killed, crit:this.crit };
      }
    }
    return null;
  }
}

// ── EnemyBullet ──────────────────────────────────────────────────────────────
class EnemyBullet {
  constructor(x, y, dmg, opts) {
    opts       = opts || {};
    this.x     = x; this.y = y;
    this.vx    = opts.vx || 0;
    this.vy    = opts.vy || (opts.slow ? 2.8 : 4.8);
    this.size  = opts.size || 7;
    this.dmg   = dmg;
    this.dead  = false;
    this.life  = opts.life || 220;
    this.color = opts.color || null;
  }
  update(H) {
    this.x += this.vx; this.y += this.vy;
    this.life--;
    if (this.y > H - 90 || this.life <= 0) {
      this.dead = true;
      return (this.y > H - 90) ? { type:'hit_earth', dmg:this.dmg } : null;
    }
    return null;
  }
}

// ── DropItem（強化ドロップアイテム）─────────────────────────────────────────
class DropItem {
  constructor(upgrade, nearLane) {
    const laneOffset = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
    this.lane    = Math.max(0, Math.min(2, nearLane + laneOffset));
    this.x       = LANE_X[this.lane];
    this.y       = 400 + Math.random() * 80;
    this.upgrade = upgrade;
    this.life    = 240;
    this.maxLife = 240;
    this.bob     = Math.random() * Math.PI * 2;
    this.dead    = false;
    this.collected = false;
  }
  update() {
    this.bob += 0.08;
    this.life--;
    if (this.life <= 0) this.dead = true;
  }
}

// ── Particle ─────────────────────────────────────────────────────────────────
class Particle {
  constructor(x, y, type) {
    this.x = x; this.y = y; this.type = type;
    switch (type) {
      case 'poof':
        this.vx=(Math.random()-0.5)*3; this.vy=-Math.random()*3-0.5;
        this.size=14+Math.random()*14; this.life=this.maxLife=45+Math.random()*20;
        this.color=['#ccc','#aaa','#eee'][~~(Math.random()*3)]; break;
      case 'hit':
        this.vx=(Math.random()-0.5)*6; this.vy=(Math.random()-0.5)*6;
        this.size=5+Math.random()*7; this.life=this.maxLife=18;
        this.color='#FFD700'; break;
      case 'crit':
        this.vx=(Math.random()-0.5)*10; this.vy=(Math.random()-0.5)*10;
        this.size=10+Math.random()*12; this.life=this.maxLife=26;
        this.color='#FF3333'; break;
      case 'hit_earth':
        this.vx=(Math.random()-0.5)*5; this.vy=-Math.random()*4-1;
        this.size=8+Math.random()*10; this.life=this.maxLife=30;
        this.color='#FF4444'; break;
      case 'explosion':
        this.vx=(Math.random()-0.5)*10; this.vy=(Math.random()-0.5)*10;
        this.size=12+Math.random()*20; this.life=this.maxLife=40;
        this.color=['#FF6B00','#FFD700','#FF4444','#FFF'][~~(Math.random()*4)]; break;
      case 'boss_beam':
        this.vx=(Math.random()-0.5)*5; this.vy=2+Math.random()*4;
        this.size=10; this.life=this.maxLife=30; this.color='#9B59B6'; break;
      case 'levelup':
        this.vx=(Math.random()-0.5)*8; this.vy=-Math.random()*6-2;
        this.size=8+Math.random()*14; this.life=this.maxLife=60;
        this.color=['#FFD700','#FF6B6B','#4ECDC4','#FF69B4','#FFFFFF'][~~(Math.random()*5)]; break;
      case 'stageclear':
        this.vx=(Math.random()-0.5)*9; this.vy=-Math.random()*7-3;
        this.size=9+Math.random()*18; this.life=this.maxLife=75;
        this.color=['#FFD700','#FF6B00','#FFF','#00FF88','#FF88FF'][~~(Math.random()*5)]; break;
      case 'coin':
        this.vx=(Math.random()-0.5)*4; this.vy=-Math.random()*3-2;
        this.size=7+Math.random()*5; this.life=this.maxLife=50;
        this.color='#FFD700'; break;
      case 'poison_fx':
        this.vx=(Math.random()-0.5)*3; this.vy=-Math.random()*2-0.5;
        this.size=6+Math.random()*8; this.life=this.maxLife=40;
        this.color=['#88FF44','#AAFF66','#66DD22'][~~(Math.random()*3)]; break;
      case 'achieve':
        this.vx=(Math.random()-0.5)*5; this.vy=-Math.random()*4-2;
        this.size=8+Math.random()*10; this.life=this.maxLife=65;
        this.color=['#FFD700','#FFB700','#FF8800'][~~(Math.random()*3)]; break;
      case 'drop_collect':
        this.vx=(Math.random()-0.5)*6; this.vy=-Math.random()*5-2;
        this.size=10+Math.random()*14; this.life=this.maxLife=55;
        this.color=['#00FFCC','#AAFFEE','#FFD700','#FFFFFF'][~~(Math.random()*4)]; break;
      default:
        this.vx=0; this.vy=-1; this.size=8; this.life=this.maxLife=30; this.color='#fff';
    }
  }
  update() {
    this.x += this.vx; this.y += this.vy;
    if (this.type !== 'poof' && this.type !== 'coin' && this.type !== 'poison_fx') this.vy += 0.15;
    this.life--;
  }
}

// ── FloatingText ─────────────────────────────────────────────────────────────
class FloatingText {
  constructor(x, y, text, color, size) {
    this.x=x; this.y=y; this.text=text;
    this.color=color||'#FFD700'; this.size=size||18;
    this.life=80; this.vy=-1.2;
  }
  update() { this.y += this.vy; this.life--; }
}
