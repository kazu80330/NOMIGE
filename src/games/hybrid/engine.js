// ==================== HYBRID ENGINE ====================
// ヤニブドボン ハイブリッドモード用カード判定・DOBON計算
//
// DOBON計算ルール（ヤニブドボン独自）:
//   足し算: 手札の任意の部分集合の和が目標値と一致
//   引/掛/割: 異なるランク2枚を1枚ずつ使った演算が目標値と一致
//
// カード点数: A=1, 2-10=数字, J=11, Q=12, K=13, Joker=0

// 連番判定用ランク順序
const RANK_SEQ = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// DOBON計算用カード点数
export function hybridCardValue(card) {
  if (card.rank === 'JK') return 0;
  if (card.rank === 'A')  return 1;
  if (card.rank === 'J')  return 11;
  if (card.rank === 'Q')  return 12;
  if (card.rank === 'K')  return 13;
  return parseInt(card.rank);
}

// 有効なプレイセットか（1枚 / 同ランク複数 / 連番3枚以上）
export function isValidHybridPlay(cards) {
  if (!cards || !cards.length) return false;
  if (cards.length === 1) return true;

  const nonJoker = cards.filter(c => c.rank !== 'JK');
  if (!nonJoker.length) return true; // 全Joker

  // 同ランク
  if (nonJoker.every(c => c.rank === nonJoker[0].rank)) return true;

  // 連番（3枚以上）
  if (cards.length >= 3) {
    const idxs = nonJoker.map(c => RANK_SEQ.indexOf(c.rank)).filter(i => i >= 0);
    if (idxs.length === nonJoker.length) {
      idxs.sort((a, b) => a - b);
      let isSeq = true;
      for (let i = 1; i < idxs.length; i++) {
        if (idxs[i] !== idxs[i - 1] + 1) { isSeq = false; break; }
      }
      if (isSeq) return true;
    }
  }

  return false;
}

// 場のDOBONターゲット値を列挙
// 同ランク複数枚のとき: 合計値 AND 1枚分の値 の両方が対象
export function getFieldTargets(fieldCards) {
  if (!fieldCards || !fieldCards.length) return [];
  const total = fieldCards.reduce((s, c) => s + hybridCardValue(c), 0);
  const targets = new Set();
  if (total > 0) targets.add(total);

  if (fieldCards.length > 1) {
    const nj = fieldCards.filter(c => c.rank !== 'JK');
    if (nj.length > 0 && nj.every(c => c.rank === nj[0].rank)) {
      const single = hybridCardValue(nj[0]);
      if (single > 0) targets.add(single);
    }
  }

  return [...targets];
}

// 足し算ルール: 手札全枚数の合計が目標値と一致するか
// 「枚数無制限」= 手札を全部使った合計が一致すればOK
function canSumAll(vals, target) {
  if (!vals.length) return false;
  return vals.reduce((s, v) => s + v, 0) === target;
}

// ハイブリッドDOBON判定
export function canHybridDobon(hand, targets) {
  if (!hand || !hand.length || !targets || !targets.length) return false;

  const vals = hand.map(hybridCardValue).filter(v => v > 0);
  if (!vals.length) return false;

  for (const target of targets) {
    if (target <= 0) continue;

    // 足し算: 手札全枚数の合計
    if (canSumAll(vals, target)) return true;

    // 異なるランク2枚の演算（-, *, /）
    const nonJoker = hand.filter(c => c.rank !== 'JK');
    for (let i = 0; i < nonJoker.length; i++) {
      for (let j = i + 1; j < nonJoker.length; j++) {
        if (nonJoker[i].rank === nonJoker[j].rank) continue;
        const a = hybridCardValue(nonJoker[i]);
        const b = hybridCardValue(nonJoker[j]);
        if (a === 0 || b === 0) continue;
        if (a - b === target || b - a === target) return true;
        if (a * b === target) return true;
        if (b !== 0 && Number.isInteger(a / b) && a / b === target) return true;
        if (a !== 0 && Number.isInteger(b / a) && b / a === target) return true;
      }
    }
  }
  return false;
}

// DOBON成功式を1つ返す（説明表示用）
export function hybridDobonExplanation(hand, targets) {
  if (!hand || !hand.length || !targets || !targets.length) return null;

  const vals = hand.map(hybridCardValue).filter(v => v > 0);

  for (const target of targets) {
    if (target <= 0) continue;

    // 足し算: 全枚数合計
    if (vals.reduce((s, v) => s + v, 0) === target) {
      return `${vals.join('+')}=${target}`;
    }

    // 異なるランク2枚演算
    const nonJoker = hand.filter(c => c.rank !== 'JK');
    for (let i = 0; i < nonJoker.length; i++) {
      for (let j = i + 1; j < nonJoker.length; j++) {
        if (nonJoker[i].rank === nonJoker[j].rank) continue;
        const a = hybridCardValue(nonJoker[i]);
        const b = hybridCardValue(nonJoker[j]);
        if (a === 0 || b === 0) continue;
        if (a - b === target) return `${a}-${b}=${target}`;
        if (b - a === target) return `${b}-${a}=${target}`;
        if (a * b === target) return `${a}×${b}=${target}`;
        if (b !== 0 && Number.isInteger(a / b) && a / b === target) return `${a}÷${b}=${target}`;
        if (a !== 0 && Number.isInteger(b / a) && b / a === target) return `${b}÷${a}=${target}`;
      }
    }
  }
  return null;
}
