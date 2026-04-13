// ==================== CARD UTILITIES ====================

export function buildDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck = [];
  for (const s of suits) for (const r of ranks) deck.push({ suit: s, rank: r });
  deck.push({ suit: '★', rank: 'JK' }, { suit: '★', rank: 'JK' });
  return shuffle(deck);
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function cardValue(card) {
  if (card.rank === 'JK') return 0;
  if (['J', 'Q', 'K'].includes(card.rank)) return 10;
  if (card.rank === 'A') return 1;
  return parseInt(card.rank);
}

export function handTotal(hand) {
  return hand.reduce((s, c) => s + cardValue(c), 0);
}

export function cardColor(card) {
  if (card.rank === 'JK') return 'joker';
  return ['♥', '♦'].includes(card.suit) ? 'red' : 'black';
}

// 手札を昇順ソートし、新しい hand と selectedCards を返す（非破壊的）
export function sortHand(hand, selectedCards) {
  const suitOrder = { '★': 0, '♠': 1, '♥': 2, '♦': 3, '♣': 4 };

  function sortKey(c) {
    if (c.rank === 'JK') return 0;
    if (c.rank === 'A') return 1;
    if (c.rank === 'J') return 11;
    if (c.rank === 'Q') return 12;
    if (c.rank === 'K') return 13;
    return parseInt(c.rank);
  }

  const indexed = hand.map((c, i) => ({ c, i }));
  indexed.sort((a, b) => {
    const va = sortKey(a.c), vb = sortKey(b.c);
    if (va !== vb) return va - vb;
    return (suitOrder[a.c.suit] || 0) - (suitOrder[b.c.suit] || 0);
  });

  const oldToNew = {};
  indexed.forEach((item, newIdx) => { oldToNew[item.i] = newIdx; });

  return {
    hand: indexed.map(item => item.c),
    selectedCards: selectedCards.map(i => oldToNew[i]).filter(i => i !== undefined),
  };
}
