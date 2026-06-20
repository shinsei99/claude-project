'use strict';

const UPGRADE_DEFS = [
  { id:'atk_up',        name:'攻撃力アップ',       desc:'弾のダメージ +2',               icon:'⚔️'  },
  { id:'spd_up',        name:'攻撃速度アップ',      desc:'連射速度が20%上がる',            icon:'⚡'  },
  { id:'bullet_spd',    name:'弾速アップ',          desc:'弾の速度が25%上がる',            icon:'💨'  },
  { id:'pierce',        name:'貫通弾',              desc:'弾が敵を貫通する（重複可）',      icon:'🎯'  },
  { id:'double_shot',   name:'3連射',               desc:'1タップで3発発射する',            icon:'🔫'  },
  { id:'crit_up',       name:'クリティカル率アップ', desc:'クリティカル率 +15%',            icon:'💥'  },
  { id:'score_up',      name:'スコア倍率アップ',    desc:'スコア倍率 ×1.5',               icon:'⭐'  },
  { id:'max_hp',        name:'最大HPアップ',        desc:'地球の最大HP +25',               icon:'❤️'  },
  { id:'regen',         name:'自動回復',            desc:'5秒ごとにHP +2 回復（重複可）',  icon:'💚'  },
  { id:'range_up',      name:'射程アップ',          desc:'弾の飛距離が30%伸びる',          icon:'🏹'  },
  { id:'explode_shot',  name:'爆発弾',              desc:'弾が着弾時に爆発範囲ダメージ',   icon:'💣'  },
  { id:'rapid_fire',    name:'乱射モード',          desc:'短時間超高速連射（5秒）',        icon:'🌀'  },
  { id:'tower_normal',  name:'ノーマルタワー 設置', desc:'バランス型の自動砲台を設置',      icon:'🏰'  },
  { id:'tower_rapid',   name:'ラピッドタワー 設置', desc:'高速連射の自動砲台を設置',        icon:'🔰'  },
  { id:'tower_sniper',  name:'スナイパータワー 設置',desc:'超長射程の自動砲台を設置',       icon:'🎯'  },
  { id:'tower_support', name:'サポートタワー 設置', desc:'貫通弾で複数敵を攻撃',           icon:'💠'  },
];

const PlayerUpgrades = {
  atk:         1,
  atkSpd:      1.0,
  bulletSpd:   1.0,
  pierce:      0,
  doubleShot:  false,
  critChance:  0,
  scoreMulti:  1.0,
  maxHp:       100,
  regen:       0,
  rangeMult:   1.0,
  explodeShot: false,
  xpMult:      1.0,
  coinMult:    1.0,
  rapidTimer:  0,

  reset(bonuses) {
    bonuses = bonuses || {};
    this.atk        = 1 + (bonuses.startAtk  || 0);
    this.atkSpd     = 1.0 * (bonuses.startSpd || 1.0);
    this.bulletSpd  = 1.0;
    this.pierce     = 0;
    this.doubleShot = false;
    this.critChance = 0;
    this.scoreMulti = 1.0;
    this.maxHp      = 100;
    this.regen      = 0;
    this.rangeMult  = 1.0;
    this.explodeShot= false;
    this.xpMult     = bonuses.xpGain   || 1.0;
    this.coinMult   = bonuses.coinGain  || 1.0;
    this.rapidTimer = 0;
  },

  apply(id) {
    switch (id) {
      case 'atk_up':     this.atk += 2; break;
      case 'spd_up':     this.atkSpd = Math.min(this.atkSpd * 1.20, 5.0); break;
      case 'bullet_spd': this.bulletSpd *= 1.25; break;
      case 'pierce':     this.pierce++; break;
      case 'double_shot':this.doubleShot = true; break;
      case 'crit_up':    this.critChance = Math.min(this.critChance + 0.15, 0.85); break;
      case 'score_up':   this.scoreMulti += 0.5; break;
      case 'max_hp':     this.maxHp += 25; break;
      case 'regen':      this.regen += 2; break;
      case 'range_up':   this.rangeMult *= 1.30; break;
      case 'explode_shot': this.explodeShot = true; break;
      case 'rapid_fire': this.rapidTimer = 300; break;
    }
  }
};

function pickUpgrades(n) {
  n = n || 3;
  const pool   = UPGRADE_DEFS.slice();
  const result = [];
  while (result.length < n && pool.length > 0) {
    const i = ~~(Math.random() * pool.length);
    result.push(pool.splice(i, 1)[0]);
  }
  return result;
}

function pickUpgradesWithTowers(n) {
  n = n || 3;
  const personal  = UPGRADE_DEFS.filter(function(d){ return d.id.indexOf('tower_') < 0; });
  const towerDefs = UPGRADE_DEFS.filter(function(d){ return d.id.indexOf('tower_') === 0; });
  const result = [];
  const pPool  = personal.slice();
  while (result.length < n - 1 && pPool.length > 0) {
    const i = ~~(Math.random() * pPool.length);
    result.push(pPool.splice(i, 1)[0]);
  }
  if (towerDefs.length > 0) {
    result.push(towerDefs[~~(Math.random() * towerDefs.length)]);
  } else if (pPool.length > 0) {
    result.push(pPool.splice(~~(Math.random()*pPool.length), 1)[0]);
  }
  return result;
}
