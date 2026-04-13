import { buildDeck, sortHand, cardValue } from '../../core/deck.js';
import { handTotalEffective, isValidDiscard } from './rules.js';
import { aiBestDiscard } from './ai.js';
import {
  renderScorePanel, renderOpponents, renderCenter, renderPlayerHand,
  updateActionBar, updatePhaseLabel, setStatus, setActionLog,
  showOppThinking, showScreen,
} from '../../ui/renderer.js';
import { showModal, hideModal, showToast } from '../../ui/modal.js';

// ==================== CONSTANTS ====================

const PLAYER_TABLE_COLORS = [
  ['#1f4030', '#102218'],
  ['#1e2a40', '#0d1528'],
  ['#3a1f30', '#200f18'],
  ['#302810', '#181300'],
  ['#162030', '#080e18'],
];

// ==================== GAME STATE ====================

export const G = {
  mode: 'ai',
  players: [],
  deck: [],
  discardPile: [],
  currentPlayer: 0,
  round: 1,
  phase: 'exchange',
  selectedCards: [],
  drawSource: null,
  elimPts: 101,
  settings: { players: 3, local_players: 3, elim_pts: 101, init_cards: 5 },
  humanIdx: 0,
  localTurn: 0,
  handRevealed: false,
  yanivDeclarer: null,
  yanivResponseQueue: [],
  responseExchangePending: undefined,
  lastActionLog: '',
};

// ==================== HELPERS ====================

function getHumanIdx() {
  return G.mode === 'ai' ? 0 : G.localTurn;
}

function updateTableColor(playerIdx) {
  if (G.mode !== 'local') return;
  const colors = PLAYER_TABLE_COLORS[playerIdx % PLAYER_TABLE_COLORS.length];
  document.getElementById('game-screen').style.setProperty('--table-color', colors[0]);
  document.getElementById('game-screen').style.setProperty('--table-dark', colors[1]);
}

// ==================== RENDER ====================

function renderAll() {
  const humanIdx = getHumanIdx();
  const player = G.players[humanIdx];
  if (player) {
    const sorted = sortHand(player.hand, G.selectedCards);
    player.hand = sorted.hand;
    G.selectedCards = sorted.selectedCards;
  }

  renderScorePanel(G.players, G.currentPlayer, G.elimPts);
  renderOpponents(G.players, humanIdx);
  renderCenter(G.deck, G.discardPile, G.drawSource, {
    onSelectDeck: () => selectDeck(),
    onSelectDiscard: () => selectDiscard(),
  });

  const p = G.players[humanIdx];
  if (p) {
    renderPlayerHand(p.hand, G.selectedCards, G.mode, p.name, {
      onCardClick: (idx) => toggleSelect(idx),
    });
  }

  updatePhaseLabel(G.phase);
  _updateActionBar();
}

function _updateActionBar() {
  const humanIdx = getHumanIdx();
  const isMyTurn = G.currentPlayer === humanIdx;
  const hand = G.players[humanIdx]?.hand || [];
  const total = handTotalEffective(hand);

  const validSel = G.selectedCards.length > 0 && isValidDiscard(G.selectedCards.map(i => hand[i]));
  const canExchange = isMyTurn && G.drawSource !== null && validSel;
  const canYaniv = isMyTurn && G.phase === 'exchange' && G.drawSource === null && G.selectedCards.length === 0;

  updateActionBar(canYaniv, canExchange, total);
}

function updateStatusMsg() {
  const humanIdx = getHumanIdx();
  const hand = G.players[humanIdx]?.hand || [];
  const total = handTotalEffective(hand);
  const validSel = G.selectedCards.length > 0 && isValidDiscard(G.selectedCards.map(i => hand[i]));
  const srcLabel = G.drawSource === 'deck' ? '山札' : G.drawSource === 'discard' ? '捨て札' : null;

  if (!G.drawSource && !G.selectedCards.length) {
    setStatus(`手札合計: ${total}点 — 山札か捨て札を選び、捨てるカードも選んでください`);
  } else if (G.drawSource && !G.selectedCards.length) {
    setStatus(`${srcLabel}から引くを選択 — 捨てるカードを選んでください`);
  } else if (!G.drawSource && G.selectedCards.length) {
    setStatus(`${G.selectedCards.length}枚選択中 — 山札か捨て札を選んでください`);
  } else if (G.drawSource && G.selectedCards.length && !validSel) {
    setStatus('無効な組み合わせです — 1枚 か 同数字複数枚を選んでください');
  } else {
    setStatus(`${srcLabel}から引いて ${G.selectedCards.length}枚捨てる — 「交換する」で確定`);
  }
}

// ==================== SETUP ====================

export function showSetup(mode) {
  G.mode = mode;
  document.getElementById('setup-mode-label').textContent = mode === 'ai' ? '🤖 AI対戦' : '👥 ローカル対人';
  document.getElementById('player-count-section').style.display = mode === 'ai' ? '' : 'none';
  document.getElementById('local-count-section').style.display = mode === 'local' ? '' : 'none';
  
  // ヤニブは枚数選択が可能なため表示する
  const initCardsSec = document.getElementById('setup-init-cards-section');
  if (initCardsSec) initCardsSec.style.display = '';

  updateNameInputs();
  showScreen('setup-screen');
}

export function selectOpt(el, key, val) {
  const group = el.closest('.option-group');
  group.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  G.settings[key] = parseInt(val) || val;
  if (key === 'players' || key === 'local_players') updateNameInputs();
}

export function updateNameInputs() {
  const count = G.mode === 'ai' ? (G.settings.players || 3) : (G.settings.local_players || 3);
  const container = document.getElementById('name-inputs');
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const inp = document.createElement('input');
    inp.type = 'text';
    if (G.mode === 'ai') {
      inp.placeholder = i === 0 ? 'あなたの名前' : `AI ${i}`;
      inp.value = i === 0 ? (G.settings[`name_${i}`] || '') : '';
    } else {
      inp.placeholder = `プレイヤー ${i + 1}`;
      inp.value = G.settings[`name_${i}`] || '';
    }
    inp.oninput = () => { G.settings[`name_${i}`] = inp.value; };
    container.appendChild(inp);
  }
}

export function startGame() {
  const count = G.mode === 'ai' ? (G.settings.players || 3) : (G.settings.local_players || 3);
  G.elimPts = parseInt(G.settings.elim_pts) || 101;
  G.initCards = parseInt(G.settings.init_cards) || 5;
  G.players = [];
  for (let i = 0; i < count; i++) {
    const inp = document.getElementById('name-inputs').querySelectorAll('input')[i];
    let name = inp ? inp.value.trim() : '';
    if (!name) name = G.mode === 'ai' ? (i === 0 ? 'あなた' : `AI ${i}`) : `プレイヤー ${i + 1}`;
    const isAI = G.mode === 'ai' && i > 0;
    G.players.push({ name, score: 0, hand: [], eliminated: false, isAI, losses: 0 });
  }
  G.round = 1;
  G.currentPlayer = 0;
  G.localTurn = 0;
  initRound();
  showScreen('game-screen');
  if (G.mode !== 'local') {
    document.getElementById('game-screen').style.setProperty('--table-color', '#1f4030');
    document.getElementById('game-screen').style.setProperty('--table-dark', '#102218');
  }
}

// ==================== ROUND ====================

function initRound() {
  G.deck = buildDeck();
  G.discardPile = [];
  G.selectedCards = [];
  G.drawSource = null;
  G.phase = 'exchange';
  G.responseExchangePending = undefined;

  const alive = G.players.filter(p => !p.eliminated);
  for (const p of G.players) {
    p.hand = G.deck.splice(0, G.initCards || 5);
  }
  G.discardPile.push(G.deck.shift());

  if (G.round > 1) {
    const maxScore = Math.max(...alive.map(p => p.score));
    const starters = alive.filter(p => p.score === maxScore);
    G.currentPlayer = G.players.indexOf(starters[0]);
  }

  document.getElementById('round-info').textContent = `ラウンド ${G.round}`;
  G.handRevealed = false;
  renderAll();

  if (G.mode === 'local') {
    G.localTurn = G.currentPlayer;
    showHandCover();
  } else {
    startTurn();
  }
}

// ==================== TURN MANAGEMENT ====================

function startTurn() {
  const humanIdx = getHumanIdx();
  const p = G.players[G.currentPlayer];
  if (!p || p.eliminated) { advanceTurn(); return; }

  G.phase = 'exchange';
  G.drawSource = null;
  G.selectedCards = [];
  renderAll();

  if (G.currentPlayer !== humanIdx) {
    if (G.mode === 'ai') {
      setStatus(`${p.name} が考え中...`);
      showOppThinking(G.currentPlayer, true);
      setTimeout(() => aiTurn(G.currentPlayer), 1000 + Math.random() * 800);
    } else {
      advanceTurn();
    }
  } else {
    updateStatusMsg();
  }
}

function advanceTurn() {
  let next = (G.currentPlayer + 1) % G.players.length;
  let loops = 0;
  while (G.players[next].eliminated && loops < G.players.length) {
    next = (next + 1) % G.players.length;
    loops++;
  }
  G.currentPlayer = next;

  if (G.mode === 'local') {
    showHandCover();
    G.localTurn = next;
  }

  renderScorePanel(G.players, G.currentPlayer, G.elimPts);
  setTimeout(() => startTurn(), G.mode === 'local' ? 100 : 300);
}

// ==================== LOCAL MODE ====================

function showHandCover() {
  const cover = document.getElementById('hand-cover');
  const localInd = document.getElementById('local-indicator');
  G.handRevealed = false;
  if (G.mode === 'local') {
    const p = G.players[G.localTurn];
    cover.style.display = 'flex';
    cover.textContent = `${p.name}のターンです — タップして手札を表示`;
    localInd.className = 'local-indicator show';
    localInd.textContent = `${p.name}のターン`;
    document.getElementById('player-hand').innerHTML = '';
    renderOpponents(G.players, G.localTurn);
    updateTableColor(G.localTurn);
  }
}

export function revealHand() {
  G.handRevealed = true;
  document.getElementById('hand-cover').style.display = 'none';
  _updateActionBar();
  updateStatusMsg();
}

// ==================== PLAYER ACTIONS ====================

export function selectDeck() {
  const humanIdx = getHumanIdx();
  if (G.currentPlayer !== humanIdx) return;
  G.drawSource = G.drawSource === 'deck' ? null : 'deck';
  renderAll();
  updateStatusMsg();
}

export function selectDiscard() {
  const humanIdx = getHumanIdx();
  if (G.currentPlayer !== humanIdx) return;
  if (!G.discardPile.length) return;
  G.drawSource = G.drawSource === 'discard' ? null : 'discard';
  renderAll();
  updateStatusMsg();
}

export function toggleSelect(idx) {
  const humanIdx = getHumanIdx();
  if (G.currentPlayer !== humanIdx) return;
  const i = G.selectedCards.indexOf(idx);
  if (i >= 0) G.selectedCards.splice(i, 1);
  else G.selectedCards.push(idx);

  const p = G.players[humanIdx];
  const sorted = sortHand(p.hand, G.selectedCards);
  p.hand = sorted.hand;
  G.selectedCards = sorted.selectedCards;

  renderPlayerHand(p.hand, G.selectedCards, G.mode, p.name, {
    onCardClick: (i2) => toggleSelect(i2),
  });
  _updateActionBar();
  updateStatusMsg();
}

export function confirmExchange() {
  const humanIdx = getHumanIdx();
  if (G.currentPlayer !== humanIdx) return;
  const hand = G.players[humanIdx].hand;
  if (G.drawSource === null || !G.selectedCards.length) return;
  if (!isValidDiscard(G.selectedCards.map(i => hand[i]))) {
    showToast('無効な捨て方です');
    return;
  }

  const topDiscard = G.discardPile[G.discardPile.length - 1];
  if (G.drawSource === 'discard' && topDiscard) {
    const discarding = G.selectedCards.map(i => hand[i]);
    if (discarding.length === 1) {
      const d = discarding[0];
      if (d.rank === topDiscard.rank && d.suit === topDiscard.suit) {
        showToast('引いたカードはそのまま捨てられません');
        return;
      }
    }
  }

  // 手札から捨てる
  const toDiscard = [...G.selectedCards].sort((a, b) => b - a).map(i => {
    const c = hand[i];
    hand.splice(i, 1);
    return c;
  });
  toDiscard.reverse().forEach(c => G.discardPile.push(c));

  // 引く
  if (G.drawSource === 'deck') {
    if (!G.deck.length) { declareDraw(); return; }
    hand.push(G.deck.shift());
  } else {
    const idx2 = G.discardPile.indexOf(topDiscard);
    if (idx2 >= 0) G.discardPile.splice(idx2, 1);
    hand.push(topDiscard);
  }

  const srcLabel = G.drawSource === 'deck' ? '山札' : '捨て札';
  G.lastActionLog = `${G.players[humanIdx].name} が${srcLabel}からカードを引きました`;
  G.selectedCards = [];
  G.drawSource = null;
  renderAll();
  setActionLog(G.lastActionLog);

  if (G.phase === 'yaniv_response' || G.responseExchangePending !== undefined) {
    G.responseExchangePending = undefined;
    setTimeout(() => processNextResponse(), 300);
  } else {
    advanceTurn();
  }
}

export function declareYaniv() {
  const humanIdx = getHumanIdx();
  if (G.currentPlayer !== humanIdx) return;
  startYanivGrace(humanIdx);
}

export function confirmQuit() {
  if (confirm('ゲームを終了してタイトルに戻りますか？')) {
    hideModal();
    showScreen('title-screen');
  }
}

// ==================== YANIV FLOW ====================

function startYanivGrace(declIdx) {
  G.yanivDeclarer = declIdx;
  showToast(`${G.players[declIdx].name} がヤニブ宣言！`, 1800);
  setTimeout(() => startYanivResponse(), 500);
}

function startYanivResponse() {
  const others = [];
  let i = (G.yanivDeclarer + 1) % G.players.length;
  let count = 0;
  while (count < G.players.length - 1) {
    if (!G.players[i].eliminated && i !== G.yanivDeclarer) others.push(i);
    i = (i + 1) % G.players.length;
    count++;
  }
  G.yanivResponseQueue = others;
  G.phase = 'yaniv_response';
  processNextResponse();
}

function processNextResponse() {
  if (G.yanivResponseQueue.length === 0) {
    processYanivDeclaration(G.yanivDeclarer);
    return;
  }
  const idx = G.yanivResponseQueue.shift();
  G.currentPlayer = idx;
  G.drawSource = null;
  G.selectedCards = [];

  if (G.players[idx].isAI) {
    renderAll();
    setTimeout(() => processNextResponse(), 500);
  } else {
    G.localTurn = idx;
    renderAll();
    if (G.mode === 'local') showHandCover();
    setStatus(`${G.players[idx].name}: 手札を交換しますか？`);
    _updateActionBar();
    showResponseModal(idx);
  }
}

function showResponseModal(idx) {
  const p = G.players[idx];
  const total = handTotalEffective(p.hand);
  showModal(
    'ヤニブ宣言！',
    `${G.players[G.yanivDeclarer].name} がヤニブを宣言しました\n${p.name}の手札合計: ${total}点`,
    `<tr><td colspan="2" style="text-align:center;padding:16px 0;">
      <div style="font-size:14px;color:var(--text-light);margin-bottom:8px;">手札を交換してから勝負しますか？</div>
    </td></tr>`,
    [
      { label: '手札を交換する', cls: 'btn btn-primary', action: () => { hideModal(); startResponseExchange(idx); } },
      { label: 'そのまま勝負', cls: 'btn btn-secondary', action: () => { hideModal(); processNextResponse(); } },
    ]
  );
}

function startResponseExchange(idx) {
  G.phase = 'yaniv_response';
  G.currentPlayer = idx;
  G.localTurn = idx;
  G.drawSource = null;
  G.selectedCards = [];
  if (G.mode === 'local') {
    document.getElementById('hand-cover').style.display = 'none';
    G.handRevealed = true;
  }
  renderAll();
  setStatus(`${G.players[idx].name}: 交換するカードを選んでください`);
  _updateActionBar();
  G.responseExchangePending = idx;
}

// ==================== YANIV RESULT ====================

function processYanivDeclaration(declIdx) {
  const declarer = G.players[declIdx];
  const declTotal = handTotalEffective(declarer.hand);

  showToast(`${declarer.name}  YANIV！`, 2000);

  setTimeout(() => {
    const alive = G.players.filter(p => !p.eliminated);
    const totals = G.players.map(p => p.eliminated ? Infinity : handTotalEffective(p.hand));
    totals[declIdx] = declTotal;

    const declFailed = alive.some((p) => {
      const i = G.players.indexOf(p);
      return i !== declIdx && totals[i] <= declTotal;
    });

    const points = [];
    G.players.forEach((p, i) => {
      if (p.eliminated) return;
      let addPts;
      if (i === declIdx) {
        addPts = declFailed ? declTotal + 30 : 0;
      } else {
        addPts = declFailed ? 0 : totals[i];
      }
      points.push({ player: p, idx: i, addPts, total: totals[i] });
    });

    const changes = points.map(r => {
      const prev = r.player.score;
      const newScore = prev + r.addPts;
      let finalScore = newScore;
      if (newScore === 50) finalScore = 25;
      else if (newScore === 100) finalScore = 50;
      r.player.score = finalScore;
      const eliminated = finalScore >= G.elimPts;
      if (eliminated) r.player.eliminated = true;

      const isLoser = (r.idx === declIdx && declFailed) ||
        (r.idx !== declIdx && !declFailed && r.addPts > 0);
      if (isLoser) r.player.losses = (r.player.losses || 0) + 1;

      return { ...r, prev, newScore, finalScore, eliminated };
    });

    const tableHTML = changes.map(r => {
      const isDecl = r.idx === declIdx;
      const isPenalty = isDecl && declFailed;
      const rowClass = isDecl && !declFailed ? 'winner' : (isPenalty ? 'penalty' : '');
      const symbol = isDecl && !declFailed ? '🏆' : (isPenalty ? '⚠️' : '');
      const pts = isPenalty
        ? `+${r.addPts} (失敗+30)`
        : (r.addPts === 0 ? '0 (成功)' : `+${r.addPts}`);
      return `<tr class="${rowClass}"><td>${symbol} ${r.player.name}</td><td style="font-size:12px;color:var(--text-light)">手札:${r.total}点</td><td>${pts}</td><td>${r.finalScore}点${r.eliminated ? '<br><small style="color:#f88">脱落</small>' : ''}</td><td style="font-size:12px;color:var(--text-light)">${r.player.losses}敗</td></tr>`;
    }).join('');

    const alive2 = G.players.filter(p => !p.eliminated);
    const gameOver = alive2.length <= 1;

    showModal(
      declFailed ? 'ヤニブ失敗…' : 'YANIV！',
      declFailed ? `${declarer.name}のヤニブが失敗しました` : `${declarer.name}がヤニブ宣言に成功！`,
      tableHTML,
      gameOver ? [
        { label: '最終結果を見る', cls: 'btn btn-primary', action: showFinalResults },
        { label: 'タイトルへ', cls: 'btn btn-secondary', action: () => { hideModal(); showScreen('title-screen'); } },
      ] : [
        { label: '次のラウンドへ', cls: 'btn btn-primary', action: nextRound },
        { label: 'ゲームを終了', cls: 'btn btn-secondary', action: () => { hideModal(); showFinalResults(); } },
      ]
    );
  }, 800);
}

function nextRound() {
  hideModal();
  G.round++;
  G.selectedCards = [];
  initRound();
}

function showFinalResults() {
  hideModal();
  const sorted = [...G.players].sort((a, b) => a.score - b.score);
  const winner = sorted[0];
  const tableHTML = sorted.map((p, i) =>
    `<tr class="${i === 0 ? 'winner' : ''}"><td>${i === 0 ? '🏆' : i + 1 + '位'} ${p.name}</td><td>${p.score}点</td><td style="font-size:13px;color:var(--text-light)">${p.losses || 0}敗</td></tr>`
  ).join('');
  showModal(
    '🏆 ゲーム終了',
    `${winner.name} の勝利！`,
    tableHTML,
    [
      { label: 'もう一度遊ぶ', cls: 'btn btn-primary', action: () => { hideModal(); startGame(); } },
      { label: 'タイトルへ', cls: 'btn btn-secondary', action: () => { hideModal(); showScreen('title-screen'); } },
    ]
  );
}

// ==================== DRAW ====================

function declareDraw() {
  showToast('山札がなくなりました — このゲームは流れます', 3000);
  setTimeout(() => {
    const alive2 = G.players.filter(p => !p.eliminated);
    const gameOver = alive2.length <= 1;
    showModal(
      '🔄 ゲーム流れ',
      '山札がなくなったため、このラウンドは無効です',
      `<tr><td colspan="2" style="text-align:center;padding:8px 0;font-size:13px;color:var(--text-light);">得点の変動はありません</td></tr>`,
      gameOver ? [
        { label: '最終結果を見る', cls: 'btn btn-primary', action: showFinalResults },
        { label: 'タイトルへ', cls: 'btn btn-secondary', action: () => { hideModal(); showScreen('title-screen'); } },
      ] : [
        { label: '次のラウンドへ', cls: 'btn btn-primary', action: nextRound },
        { label: 'ゲームを終了', cls: 'btn btn-secondary', action: () => { hideModal(); showFinalResults(); } },
      ]
    );
  }, 1200);
}

// ==================== AI LOGIC ====================

function aiTurn(idx) {
  showOppThinking(idx, false);
  const p = G.players[idx];
  const total = handTotalEffective(p.hand);

  if (total <= 5) {
    const alive = G.players.filter(pl => !pl.eliminated);
    const minOther = Math.min(...alive.filter(pl => pl !== p).map(pl => handTotalEffective(pl.hand)));
    if (total < minOther || total === 0) {
      setTimeout(() => startYanivGrace(idx), 400);
      return;
    }
  }

  const bestIdxs = aiBestDiscard(p.hand);
  const discardCards = bestIdxs.map(i => p.hand[i]);

  const topDiscard = G.discardPile[G.discardPile.length - 1];
  let drawFromDiscardPile = false;
  if (topDiscard && cardValue(topDiscard) < 4) {
    const wouldDiscardSame = discardCards.length === 1 &&
      discardCards[0].rank === topDiscard.rank &&
      discardCards[0].suit === topDiscard.suit;
    if (!wouldDiscardSame) drawFromDiscardPile = true;
  }

  bestIdxs.sort((a, b) => b - a).forEach(i => {
    G.discardPile.push(p.hand.splice(i, 1)[0]);
  });

  if (drawFromDiscardPile) {
    const i2 = G.discardPile.indexOf(topDiscard);
    if (i2 >= 0) G.discardPile.splice(i2, 1);
    p.hand.push(topDiscard);
  } else {
    if (!G.deck.length) { declareDraw(); return; }
    p.hand.push(G.deck.shift());
  }

  const srcLabel = drawFromDiscardPile ? '捨て札' : '山札';
  G.lastActionLog = `${p.name} が${srcLabel}からカードを引きました`;
  renderAll();
  setTimeout(() => {
    setStatus(G.lastActionLog);
    setActionLog(G.lastActionLog);
    advanceTurn();
  }, 400);
}

// ==================== RULES MODAL ====================

export function showRules() {
  showModal(
    'ルール',
    '',
    `<tr><td colspan="2" style="text-align:left;font-size:13px;line-height:1.8;color:var(--cream);">
    <b>🎯 目的</b>: 手札の合計を低くして「ヤニブ」宣言し、ゲームを終わらせる<br><br>
    <b>🃏 カード点数</b>: ジョーカー=0、A=1、2〜10=数字通り、J/Q/K=10<br><br>
    <b>🃏 初期手札</b>: 3枚または5枚（設定による）<br><br>
    <b>♻️ ターン</b>: ①山札か捨て札から1枚引く → ②手札を1枚以上捨てる<br><br>
    <b>📤 捨て方</b>:<br>
    &nbsp;• 1枚<br>
    &nbsp;• 同数字2枚以上（ジョーカー不可）<br><br>
    <b>✨ ヤニブ宣言</b>: 手番最初（引く前）に手札合計が低ければ宣言可能！<br><br>
    <b>✅ ヤニブ成功</b>: 宣言者0点、他は手札合計点を加算<br>
    <b>⚠️ ヤニブ失敗</b>: 宣言者は手札合計+30点のペナルティ<br><br>
    <b>🔄 救済</b>: ちょうど50点→25点、ちょうど100点→50点に減点
    </td></tr>`,
    [{ label: '閉じる', cls: 'btn btn-primary', action: hideModal }]
  );
}
