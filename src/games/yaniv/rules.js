import { cardValue } from '../../core/deck.js';

// 同数字まとめルールで合計点を計算
export function handTotalEffective(hand) {
  const groups = {};
  for (const c of hand) {
    const v = cardValue(c);
    if (!groups[v]) groups[v] = 0;
    groups[v]++;
  }
  let total = 0;
  for (const v of Object.keys(groups)) {
    total += Number(v);
  }
  return total;
}

// 捨て札の有効性: 1枚 or 同数字2枚以上（ジョーカー不可）
export function isValidDiscard(cards) {
  if (!cards.length) return false;
  if (cards.length === 1) return true;
  if (cards.some(c => c.rank === 'JK')) return false;
  return cards.every(c => c.rank === cards[0].rank);
}
