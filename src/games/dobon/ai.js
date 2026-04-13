// ==================== DOBON AI ====================

import { cardStrength, getValidPlays, isForbiddenWin } from './engine.js';
import { canDobon } from './dobonCalc.js';

// 最適なプレイを選ぶ（出せる最弱のカードを選択）
// 戻り値: 手札インデックスの配列、または null（パス=引く）
export function aiChoosePlay(hand, fieldCards, jback, suitLock) {
  const validPlays = getValidPlays(hand, fieldCards, jback, suitLock);
  if (!validPlays.length) return null; // 出せない → 引く

  // 出せる中で最も弱い手（強いカードを温存）
  let best = null;
  let bestStr = Infinity;

  for (const combo of validPlays) {
    const cards = combo.map(i => hand[i]);
    const str = cardStrength(cards[0], jback);

    // 8切りは積極的に使う（場をリセットできる）
    if (cards.every(c => c.rank === '8')) return combo;

    // 禁止上がりになるなら避ける（他に選択肢がある場合）
    if (combo.length === hand.length && isForbiddenWin(cards)) {
      // 最後の1手かつ禁止カードなら、まずスキップして他を探す
      if (validPlays.length > 1) continue;
    }

    if (str < bestStr) {
      bestStr = str;
      best = combo;
    }
  }

  return best || validPlays[0];
}

// ドボン宣言すべきか（できるなら常にする）
export function aiShouldDobon(hand, fieldValue) {
  return canDobon(hand, fieldValue);
}

// ドボン返しすべきか（できるなら常にする）
export function aiShouldDobonReturn(hand, fieldValue) {
  return canDobon(hand, fieldValue);
}