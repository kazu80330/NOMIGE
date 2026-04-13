import { cardValue } from '../../core/deck.js';

// 最適な捨て札インデックスを返す
export function aiBestDiscard(hand) {
  // 同数字グループを探す
  const rankGroups = {};
  hand.forEach((c, i) => {
    if (c.rank === 'JK') return;
    if (!rankGroups[c.rank]) rankGroups[c.rank] = [];
    rankGroups[c.rank].push(i);
  });

  // 最も点数の高いグループ（2枚以上）を優先
  let bestGroup = null;
  let bestPts = 0;
  for (const [, idxs] of Object.entries(rankGroups)) {
    if (idxs.length >= 2) {
      const pts = idxs.reduce((s, i) => s + cardValue(hand[i]), 0);
      if (pts > bestPts) { bestPts = pts; bestGroup = idxs; }
    }
  }
  if (bestGroup) return bestGroup;

  // 単枚: 最も高い点数のカードを捨てる（ジョーカーは保持）
  const sorted = hand.map((c, i) => ({ c, i, v: cardValue(c) })).sort((a, b) => b.v - a.v);
  return [sorted[0].i];
}
