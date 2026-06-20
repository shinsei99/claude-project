'use strict';

const SHOP_ITEMS = [
  { id:'start_hp',    name:'初期HP +10',      icon:'❤️',  desc:'地球の初期HPが増える',           maxLv:5, costs:[30,50,80,120,180]  },
  { id:'start_atk',   name:'攻撃力 +1',        icon:'⚔️',  desc:'弾のダメージが最初から増加',      maxLv:3, costs:[80,140,220]        },
  { id:'start_spd',   name:'攻撃速度 +10%',    icon:'⚡',  desc:'最初から連射が速い',              maxLv:3, costs:[60,100,160]        },
  { id:'xp_gain',     name:'XP取得 +15%',      icon:'✨',  desc:'レベルアップが早くなる',          maxLv:3, costs:[80,130,200]        },
  { id:'coin_gain',   name:'コイン取得 +25%',  icon:'🪙',  desc:'コインをより多く獲得',            maxLv:3, costs:[50,90,140]         },
  { id:'start_earth', name:'地球HP +15',        icon:'🌍',  desc:'地球の最大HPも上がる',            maxLv:5, costs:[40,70,110,160,240] },
];

const ACHIEVEMENT_DEFS = [
  { id:'kill_100',     name:'百人斬り',        desc:'100体撃破',              icon:'⚔️', reward:30  },
  { id:'kill_1000',    name:'千人斬り',        desc:'1000体撃破',             icon:'🗡️', reward:100 },
  { id:'boss_first',   name:'初ボス討伐',      desc:'ボスを初めて倒した',      icon:'👑', reward:50  },
  { id:'level_20',     name:'レベル神',        desc:'Lv.20に到達',            icon:'⬆️', reward:80  },
  { id:'survive_10m',  name:'10分生存',        desc:'10分間生き残った',        icon:'⏱️', reward:100 },
  { id:'stage_10',     name:'中間突破',        desc:'STAGE 10クリア',          icon:'🏅', reward:80  },
  { id:'all_clear',    name:'地球の救世主',    desc:'全20ステージクリア',      icon:'🌍', reward:500 },
  { id:'bestiary_10',  name:'図鑑コレクター',  desc:'10種の敵を撃破',          icon:'📚', reward:50  },
  { id:'bestiary_all', name:'全敵図鑑完成',    desc:'全種類の敵を撃破',        icon:'🏆', reward:300 },
  { id:'no_dmg_wave',  name:'守護天使',        desc:'HP満タンでWaveクリア',    icon:'🛡️', reward:40  },
  { id:'kill_boss_3',  name:'ボスハンター',    desc:'ボスを3種類全て討伐',     icon:'💀', reward:150 },
];

// enemy types to track in bestiary
const BESTIARY_TYPES = [
  'normal','fast','ranged','tank','ghost','healer','bomber','sprinter',
  'armored','regen','shielded','splitter','swarm',
  'poison','stealth','berserker','titan','leech','necro','phantom',
  'boss_chicken','boss_snake','boss'
];

const SaveManager = {
  _k: {
    hs:'piyo_hs', bs:'piyo_bs', bgm:'piyo_bgm', se:'piyo_se',
    coins:'piyo_coins_v2', shop:'piyo_shop_v2',
    bestiary:'piyo_bestiary_v2', achievements:'piyo_ach_v2'
  },

  getHigh()    { return { score:+localStorage.getItem(this._k.hs)||0, stage:+localStorage.getItem(this._k.bs)||0 }; },
  getBgm()     { const v=localStorage.getItem(this._k.bgm); return v===null?true:v==='true'; },
  getSe()      { const v=localStorage.getItem(this._k.se);  return v===null?true:v==='true'; },
  setBgm(v)    { localStorage.setItem(this._k.bgm, String(v)); },
  setSe(v)     { localStorage.setItem(this._k.se,  String(v)); },

  getCoins()   { return +localStorage.getItem(this._k.coins)||0; },
  addCoins(n)  { if(n>0) localStorage.setItem(this._k.coins, this.getCoins()+n); },
  spendCoins(n){ const c=this.getCoins(); if(c<n) return false; localStorage.setItem(this._k.coins,c-n); return true; },

  getShopLevels() { try{ return JSON.parse(localStorage.getItem(this._k.shop)||'{}'); }catch(e){ return {}; } },
  getShopLevel(id){ return this.getShopLevels()[id]||0; },
  setShopLevel(id,lv){ const d=this.getShopLevels(); d[id]=lv; localStorage.setItem(this._k.shop,JSON.stringify(d)); },

  getBestiary() { try{ return JSON.parse(localStorage.getItem(this._k.bestiary)||'{}'); }catch(e){ return {}; } },
  recordKill(type) {
    const b=this.getBestiary(); b[type]=(b[type]||0)+1;
    localStorage.setItem(this._k.bestiary,JSON.stringify(b));
  },

  getAchievements() { try{ return JSON.parse(localStorage.getItem(this._k.achievements)||'{}'); }catch(e){ return {}; } },
  unlockAchievement(id) {
    const a=this.getAchievements();
    if (a[id]) return false;
    a[id]=true;
    localStorage.setItem(this._k.achievements,JSON.stringify(a));
    const def=ACHIEVEMENT_DEFS.find(function(d){ return d.id===id; });
    if (def) this.addCoins(def.reward);
    return true;
  },
  isAchieved(id) { return !!this.getAchievements()[id]; },

  save(score,stage) {
    const h=this.getHigh();
    const isHS=score>h.score;
    if(isHS)          localStorage.setItem(this._k.hs,score);
    if(stage>h.stage) localStorage.setItem(this._k.bs,stage);
    return isHS;
  }
};
