// ==================== DOBON ENGINE ====================
// 大富豪ベースのカード強さ判定・プレイ検証

// 大富豪の強さ順（通常）: 3<4<5<6<7<8<9<10<J<Q<K<A<2<Joker
// Jバック時（逆転）:      Joker<2<A<K<Q<J<10<9<8<7<6<5<4<3
const NORMAL_ORDER = ['3','4','5','6','7','8','9','10','J','Q','K','A','2','JK'];

export function cardStrength(card, jback = false) {
  const idx = NORMAL_ORDER.indexOf(card.rank);
  if (idx === -1) return -1;
  return jback ? (13 - idx) : idx;
}

// ドボン計算用のカード点数（ヤニブとは異なる）
// A=1, 2-10=数字, J=11, Q=12, K=13, Joker=0
export function dobonCardValue(card) {
  if (card.rank === 'JK') return 0;
  if (card.rank === 'A')  return 1;
  if (card.rank === 'J')  return 11;
  if (card.rank === 'Q')  return 12;
  if (card.rank === 'K')  return 13;
  return parseInt(card.rank);
}

// 場のカードの「ドボン対象値」: 出したカードの1枚目の点数（枚数に関係なく1枚分）
export function fieldDobonValue(fieldCards) {
  if (!fieldCards.length) return 0;
  return dobonCardValue(fieldCards[0]);
}

// ===== プレイ検証 =====

// 有効なプレイセットか（1枚、または同ランク複数枚）
export function isValidPlaySet(cards) {
  if (!cards.length) return false;
  if (cards.length === 1) return true;
  const nonJoker = cards.filter(c => c.rank !== 'JK');
  if (!nonJoker.length) return true; // 全部ジョーカー
  return nonJoker.every(c => c.rank === nonJoker[0].rank);
}

// 場に出せるかチェック
// fieldCards: 現在の場のカード（空なら自由）
// playCards: 出そうとするカード
export function isValidPlay(playCards, fieldCards, jback, suitLock) {
  if (!playCards.length) return false;
  if (!isValidPlaySet(playCards)) return false;

  // 場が空 → 自由
  if (!fieldCards.length) return true;

  // 枚数が一致しなければNG
  if (playCards.length !== fieldCards.length) return false;

  // 強さ判定（同ランクで比較）
  const playStr  = cardStrength(playCards[0], jback);
  const fieldStr = cardStrength(fieldCards[0], jback);
  if (playStr <= fieldStr) return false;

  // スート縛り
  if (suitLock) {
    const nonJoker = playCards.filter(c => c.rank !== 'JK');
    if (nonJoker.some(c => c.suit !== suitLock)) return false;
  }

  return true;
}

// ♠3返しが可能か（場がジョーカー1枚のとき）
export function canSpade3Return(card, fieldCards) {
  return fieldCards.length === 1 &&
    fieldCards[0].rank === 'JK' &&
    card.rank === '3' && card.suit === '♠';
}

// 特殊効果の判定
// 'eight_cut' | 'jback' | null
export function getSpecialEffect(cards) {
  const nonJoker = cards.filter(c => c.rank !== 'JK');
  if (!nonJoker.length) return null;
  if (nonJoker.every(c => c.rank === '8')) return 'eight_cut';
  if (nonJoker.every(c => c.rank === 'J')) return 'jback';
  return null;
}

// 禁止上がり（8, 2, Jokerで上がれない）
export function isForbiddenWin(lastPlayedCards) {
  if (!lastPlayedCards.length) return false;
  return lastPlayedCards.every(c =>
    c.rank === '8' || c.rank === '2' || c.rank === 'JK'
  );
}

// スート縛りの更新: 出したカードが場と同じスートなら縛り発生
export function calcSuitLock(playCards, fieldCards) {
  if (!fieldCards.length) return null;
  const nonJokerPlay  = playCards.filter(c => c.rank !== 'JK');
  const nonJokerField = fieldCards.filter(c => c.rank !== 'JK');
  if (!nonJokerPlay.length || !nonJokerField.length) return null;
  if (nonJokerPlay[0].suit === nonJokerField[0].suit) {
    return nonJokerPlay[0].suit;
  }
  return null;
}

// 手札から有効なプレイ候補を全列挙（単枚 & ペア以上）
export function getValidPlays(hand, fieldCards, jback, suitLock) {
  const plays = [];

  // 全インデックスの組み合わせを列挙
  const n = hand.length;

  // 単枚
  for (let i = 0; i < n; i++) {
    const cards = [hand[i]];
    if (isValidPlay(cards, fieldCards, jback, suitLock)) {
      plays.push([i]);
    }
  }

  // 同ランク複数枚（ペア以上）
  const rankGroups = {};
  hand.forEach((c, i) => {
    const key = c.rank;
    if (!rankGroups[key]) rankGroups[key] = [];
    rankGroups[key].push(i);
  });

  for (const [, idxs] of Object.entries(rankGroups)) {
    if (idxs.length < 2) continue;
    // すべての部分集合（2枚以上）で、場と枚数が一致するもの
    for (let size = 2; size <= idxs.length; size++) {
      if (fieldCards.length && size !== fieldCards.length) continue;
      // idxsからsize枚の組み合わせ（ここではすべて同ランクなので1通りのみ必要）
      const combo = idxs.slice(0, size);
      const cards = combo.map(i => hand[i]);
      if (isValidPlay(cards, fieldCards, jback, suitLock)) {
        plays.push(combo);
      }
    }
  }

  return plays;
}