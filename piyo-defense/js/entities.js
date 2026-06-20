'use strict';

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
  poison:       { baseHp:5,   dmg:7,  size:26, pts:22,  spd:0.72, xpGain:2 }, // 到達時攻撃速度ダウン
  stealth:      { baseHp:3,   dmg:6,  size:22, pts:24,  spd:1.15, xpGain:2 }, // 定期的に完全透明
  berserker:    { baseHp:6,   dmg:9,  size:30, pts:28,  spd:0.85, xpGain:3 }, // HP低下で加速
  titan:        { baseHp:28,  dmg:18, size:62, pts:60,  spd:0.22, xpGain:6 }, // 超巨大タンク
  leech:        { baseHp:7,   dmg:5,  size:28, pts:30,  spd:0.68, xpGain:3 }, // ダメージ受けるたびに自己回復
  necro:        { baseHp:6,   dmg:7,  size:28, pts:35,  spd:0.78, xpGain:4 }, // 一度だけ復活
  phantom:      { baseHp:3,   dmg:6,  size:24, pts:28,  spd:1.05, xpGain:3 }, // 定期的にテレポート
  // ── ボス ──────────────────────────────────────────────────────────────────
  boss_chicken: { baseHp:55,  dmg:0,  size:82, pts:200, spd:0.45, xpGain:8 }, // ニワトリ大魔王
  boss_snake:   { baseHp:75,  dmg:0,  size:86, pts:200, spd:0.32, xpGain:8 }, // 巨大ヘビ
  boss:         { baseHp:70,  dmg:0,  size:90, pts:200, spd:0.38, xpGain:8 }, // UFO
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
    const isBoss = (type === 'boss' || type === 'boss_chicken' || type === 'boss_snake');

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

    // ── ボス初期化 ──────────────────────────────────────────────────────────
    if (type === 'boss') {
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

    // ── 新型初期化 ──────────────────────────────────────────────────────────
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
      // 水平ホバー
      const spd = this.phase === 3 ? 3.8 : this.phase === 2 ? 2.5 : 1.6;
      this.vx = Math.sign(this.vx || 1) * spd;
      this.x += this.vx;
      if (this.x < 60 || this.x > 330) this.vx *= -1;
      this.y = 220 + Math.sin(frame * 0.022) * 25;

      // 3way弾
      this.shotCooldown--;
      if (this.shotCooldown <= 0) {
        this.shotCooldown = this.phase === 3 ? 55 : this.phase === 2 ? 80 : 120;
        if (!barrierActive) return { type: 'triple_shot', x: this.x, y: this.y + this.size * 0.5, dmg: this.dmg };
        return { type: 'barrier' };
      }
      // 召喚
      this.summonTimer++;
      const summonInterval = this.phase >= 2 ? 160 : 240;
      if (this.summonTimer >= summonInterval) {
        this.summonTimer = 0;
        return { type: 'boss_summon' };
      }
      // 突進攻撃
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
      // 地中潜伏クールダウン
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
      // 蛇行移動
      const snakeSpd = this.phase === 3 ? 3.2 : this.phase === 2 ? 2.2 : 1.4;
      this.vx = Math.sign(this.vx || 1) * snakeSpd;
      this.x += this.vx + Math.sin(frame * 0.08) * 1.2;
      if (this.x < 60 || this.x > 330) this.vx *= -1;
      this.y = 215 + Math.sin(frame * 0.025) * 32;

      // 毒スプレー（複数弾）
      this.sprayTimer++;
      const sprayInterval = this.phase === 3 ? 48 : this.phase === 2 ? 72 : 110;
      if (this.sprayTimer >= sprayInterval) {
        this.sprayTimer = 0;
        if (!barrierActive) return { type: 'snake_spray', x: this.x, y: this.y + this.size * 0.5, dmg: this.dmg };
        return { type: 'barrier' };
      }
      // 潜伏
      this.bossTimer++;
      const burrowInterval = this.phase === 3 ? 90 : this.phase === 2 ? 140 : 200;
      if (this.bossTimer >= burrowInterval && this.burrowCd <= 0) {
        this.bossTimer = 0; this.burrowCd = 180;
        this.isBurrowed = true; this.burrowTimer = 50;
        return { type: 'boss_burrow' };
      }
      // 尻尾なぎ払い（高ダメ）
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

    // ── 新型移動 ──────────────────────────────────────────────────────────
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
      // 汎用（normal, fast, swarm, armored, shielded, splitter, etc）
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
    // ステルス：隠れ中は50%回避
    if (this.type === 'stealth' && this.isHidden && Math.random() < 0.5) {
      this.hitFlash = 4; return false;
    }
    // 装甲：ダメージ半減
    if (this.type === 'armored') dmg = Math.max(1, Math.ceil(dmg * 0.5));
    // タイタン：ダメージ40%減
    if (this.type === 'titan')   dmg = Math.max(1, Math.ceil(dmg * 0.6));
    // シールド
    if (this.type === 'shielded' && this.shield > 0) {
      this.shield -= dmg;
      if (this.shield < 0) { dmg = -this.shield; this.shield = 0; }
      else { this.hitFlash = 6; return false; }
    }
    this.hp -= dmg;
    this.hitFlash = 6;
    if (this.hp <= 0) {
      this.hp = 0;
      // necro：未復活なら復活待機
      if (this.type === 'necro' && !this.necroRevived) {
        this.dead = true;
        this.reviveTimer = 80;  // 死亡フラグは立てるが復活タイマー起動
        return false;           // kill扱いにしない
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
