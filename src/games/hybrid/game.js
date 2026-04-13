// ==================== YANIV-DOBON HYBRID GAME ====================
// 基本進行: ヤニブ式（カードを出す → ドボン確認2秒 → 山札補充 → 次へ）
// 勝利条件: ヤニブ宣言 / 手札0枚で上がり / ドボン成功

import { buildDeck, shuffle, cardValue, sortHand } from '../../core/deck.js';
import { handTotalEffective } from '../yaniv/rules.js';
import {
  hybridCardValue, isValidHybridPlay, getFieldTargets,
  canHybridDobon, hybridDobonExplanation,
} from './engine.js';
import {
  renderCard, renderScorePanel, renderOpponents, renderPlayerHand,
  updatePhaseLabel, setStatus, setActionLog,
  showOppThinking, showScreen,
} from '../../ui/renderer.js';
import { showModal, hideModal, showToast } from '../../ui/modal.js';

// ==================== CONSTANTS ====================

const YANIV_THRESHOLD = 5;

// ==================== GAME STATE ====================

let G = {
  mode: 'ai',
  players: [],       // { name, hand, score, isAI, eliminated }
  deck: [],
  discardAll: [],    // 過去の捨て札（引き直し用）
  fieldCards: [],    // 現在の場のカード
  fieldPlayerIdx: -1,
  currentPlayer: 0,
  round: 1,
  phase: 'play',     // 'play' | 'dobon_window' | 'draw' | 'end'
  selectedCards: [],
  elimPts: 101,
  initCards: 5,
  localTurn: 0,
  handRevealed: false,
  dobonWindowTimer: null,
  _goOut: false,
  settings: { players: 3, local_players: 3, elim_pts: 101, init_cards: 5 },
};

// ==================== HELPERS ====================

function getHumanIdx() {
  return G.mode === 'ai' ? 0 : G.localTurn;
}

function makeBtn(text, cls, disabled, onClick) {
  const btn = document.createElement('button');
  btn.className = cls;
  btn.textContent = text;
  btn.disabled = disabled;
  if (!disabled && onClick) btn.onclick = onClick;
  return btn;
}

// ==================== RENDER ====================

function renderAll() {
  const humanIdx = getHumanIdx();
  renderScorePanel(G.players, G.currentPlayer, G.elimPts);
  renderOpponents(G.players, humanIdx);
  renderHybridCenter();
  const p = G.players[humanIdx];
  if (p) {
    renderPlayerHand(p.hand, G.selectedCards, G.mode, p.name, {
      onCardClick: (idx) => hybridToggleSelect(idx),
    });
  }
  updatePhaseLabel(G.phase === 'play' ? 'exchange' : G.phase);
  updateHybridActionBar();
}

function renderHybridCenter() {
  const deckEl = document.getElementById('deck-pile');
  const deckCountEl = document.getElementById('deck-count');
  const discardEl = document.getElementById('discard-area');

  if (deckCountEl) deckCountEl.textContent = `${G.deck.length}枚`;
  if (deckEl) {
    deckEl.innerHTML = '';
    deckEl.onclick = null;
    if (G.deck.length > 0) {
      const back = document.createElement('div');
      back.className = 'card card-back-inner';
      back.style.cssText = 'width:52px;height:74px;background:var(--felt);border:2px solid var(--gold);border-radius:6px;';
      deckEl.appendChild(back);
    } else {
      const empty = document.createElement('div');
      empty.style.cssText = 'color:var(--text-light);font-size:11px;text-align:center;padding:4px;';
      empty.textContent = '空';
      deckEl.appendChild(empty);
    }
  }

  if (discardEl) {
    discardEl.innerHTML = '';
    if (G.fieldCards.length > 0) {
      const targets = getFieldTargets(G.fieldCards);
      const badge = document.createElement('div');
      badge.className = 'field-value-badge';
      badge.textContent = `目標: ${targets.join(' or ')}`;
      discardEl.appendChild(badge);
      G.fieldCards.forEach(c => {
        const cd = renderCard(c);
        cd.style.cssText = 'position:relative;display:inline-block;';
        discardEl.appendChild(cd);
      });
    } else {
      const ph = document.createElement('div');
      ph.style.cssText = 'width:72px;height:104px;border:2px dashed rgba(255,255,255,0.15);border-radius:7px;display:flex;align-items:center;justify-content:center;';
      ph.innerHTML = '<span style="color:var(--text-light);font-size:11px;">場なし</span>';
      discardEl.appendChild(ph);
    }
  }
}

function updateHybridActionBar() {
  const actionBar = document.getElementById('action-bar');
  if (!actionBar) return;
  actionBar.innerHTML = '';
  const humanIdx = getHumanIdx();
  const hand = G.players[humanIdx]?.hand || [];
  const total = handTotalEffective(hand);

  if (G.phase === 'play') {
    const isMyTurn = G.currentPlayer === humanIdx;
    const validSel = G.selectedCards.length > 0 &&
      isValidHybridPlay(G.selectedCards.map(i => hand[i]));
    const canYaniv = isMyTurn && total <= YANIV_THRESHOLD && G.selectedCards.length === 0;
    const canPlay = isMyTurn && validSel;

    const yanivBtn = makeBtn(
      'YANIV宣言',
      `btn-action btn-yaniv${canYaniv ? ' yaniv-highlight' : ''}`,
      !canYaniv,
      hybridDeclareYaniv
    );
    const playBtn = makeBtn('カードを出す', 'btn-action btn-discard', !canPlay, hybridPlayCards);
    actionBar.appendChild(yanivBtn);
    actionBar.appendChild(playBtn);

  } else if (G.phase === 'dobon_window') {
    const targets = getFieldTargets(G.fieldCards);
    const canDobon = G.fieldCards.length > 0 &&
      humanIdx !== G.fieldPlayerIdx &&
      canHybridDobon(hand, targets);
    const targetStr = targets.length ? targets.join(' or ') : '?';

    const info = document.createElement('div');
    info.className = 'dobon-window-info';
    info.textContent = `🎯 目標: ${targetStr}`;
    actionBar.appendChild(info);

    const dobonBtn = makeBtn(
      'ドボン！',
      `btn-action btn-dobon${canDobon ? ' dobon-glow' : ''}`,
      !canDobon,
      hybridDobonDeclare
    );
    actionBar.appendChild(dobonBtn);

  } else if (G.phase === 'draw') {
    const isMyTurn = G.currentPlayer === humanIdx;
    const canDrawDiscard = isMyTurn && G.discardAll.length > 0;

    actionBar.appendChild(makeBtn('山札から引く', 'btn-action btn-discard', !isMyTurn, hybridDrawDeck));
    actionBar.appendChild(makeBtn('捨て札から引く', 'btn-action btn-secondary', !canDrawDiscard, hybridDrawDiscard));

  } else {
    actionBar.appendChild(makeBtn('YANIV宣言', 'btn-action btn-yaniv', true, null));
    actionBar.appendChild(makeBtn('カードを出す', 'btn-action btn-discard', true, null));
  }
}

// ==================== SETUP ====================

export function showSetup(mode) {
  G.mode = mode;
  document.getElementById('setup-mode-label').textContent = mode === 'ai' ? '🤖 AI対戦' : '👥 ローカル対人';
  document.getElementById('player-count-section').style.display = mode === 'ai' ? '' : 'none';
  document.getElementById('local-count-section').style.display = mode === 'local' ? '' : 'none';
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
  if (!container) return;
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
    G.players.push({ name, score: 0, hand: [], eliminated: false, isAI: G.mode === 'ai' && i > 0 });
  }
  G.round = 1;
  G.currentPlayer = 0;
  G.localTurn = 0;
  initRound();
  showScreen('game-screen');
}

// ==================== ROUND ====================

function initRound() {
  G.deck = buildDeck();
  G.discardAll = [];
  G.fieldCards = [];
  G.fieldPlayerIdx = -1;
  G.selectedCards = [];
  G.phase = 'play';
  G._goOut = false;
  if (G.dobonWindowTimer) { clearTimeout(G.dobonWindowTimer); G.dobonWindowTimer = null; }

  for (const p of G.players) {
    p.hand = G.deck.splice(0, G.initCards || 5);
    sortPlayerHand(p);
  }

  if (G.round > 1) {
    const alive = G.players.filter(p => !p.eliminated);
    if (alive.length > 1) {
      const maxScore = Math.max(...alive.map(p => p.score));
      G.currentPlayer = G.players.indexOf(alive.find(p => p.score === maxScore));
    }
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

function sortPlayerHand(p) {
  p.hand.sort((a, b) => {
    const va = a.rank === 'JK' ? 100 : hybridCardValue(a);
    const vb = b.rank === 'JK' ? 100 : hybridCardValue(b);
    return va - vb;
  });
}

// ==================== TURN MANAGEMENT ====================

function startTurn() {
  const humanIdx = getHumanIdx();
  const p = G.players[G.currentPlayer];
  if (!p || p.eliminated) { advanceTurn(); return; }

  G.phase = 'play';
  G.selectedCards = [];
  renderAll();

  if (G.currentPlayer !== humanIdx) {
    if (G.mode === 'ai') {
      setStatus(`${p.name} が考え中...`);
      showOppThinking(G.currentPlayer, true);
      setTimeout(() => aiTurn(G.currentPlayer), 800 + Math.random() * 600);
    } else {
      advanceTurn();
    }
  } else {
    const total = handTotalEffective(p.hand);
    setStatus(`手札合計: ${total}点 — カードを選んで出してください`);
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
  if (G.mode === 'local' && cover) {
    const p = G.players[G.localTurn];
    cover.style.display = 'flex';
    cover.textContent = `${p.name}のターンです — タップして手札を表示`;
    if (localInd) {
      localInd.className = 'local-indicator show';
      localInd.textContent = `${p.name}のターン`;
    }
    document.getElementById('player-hand').innerHTML = '';
    renderOpponents(G.players, G.localTurn);
  }
}

export function revealHand() {
  G.handRevealed = true;
  const cover = document.getElementById('hand-cover');
  if (cover) cover.style.display = 'none';
  updateHybridActionBar();
  const humanIdx = getHumanIdx();
  const p = G.players[humanIdx];
  const total = handTotalEffective(p?.hand || []);
  setStatus(`手札合計: ${total}点 — カードを選んで出してください`);
}

// ==================== CARD SELECTION ====================

export function hybridToggleSelect(idx) {
  const humanIdx = getHumanIdx();
  if (G.currentPlayer !== humanIdx || G.phase !== 'play') return;

  const hand = G.players[humanIdx].hand;
  const pos = G.selectedCards.indexOf(idx);
  if (pos >= 0) G.selectedCards.splice(pos, 1);
  else G.selectedCards.push(idx);

  const sorted = sortHand(hand, G.selectedCards);
  G.players[humanIdx].hand = sorted.hand;
  G.selectedCards = sorted.selectedCards;

  renderPlayerHand(G.players[humanIdx].hand, G.selectedCards, G.mode, G.players[humanIdx].name, {
    onCardClick: (i2) => hybridToggleSelect(i2),
  });
  updateHybridActionBar();

  const total = handTotalEffective(hand);
  if (G.selectedCards.length === 0) {
    setStatus(`手札合計: ${total}点 — カードを選んで出してください`);
  } else {
    const validSel = isValidHybridPlay(G.selectedCards.map(i => G.players[humanIdx].hand[i]));
    setStatus(validSel
      ? `${G.selectedCards.length}枚選択中 — 「カードを出す」で確定`
      : '無効な選択 — 1枚 / 同ランク複数 / 連番3枚以上を選んでください');
  }
}

// ==================== PLAY CARDS ====================

export function hybridPlayCards() {
  const humanIdx = getHumanIdx();
  if (G.currentPlayer !== humanIdx || G.phase !== 'play') return;

  const hand = G.players[humanIdx].hand;
  const toPlay = G.selectedCards.map(i => hand[i]);
  if (!isValidHybridPlay(toPlay)) {
    showToast('無効なカードの組み合わせです');
    return;
  }
  executePlay(humanIdx, G.selectedCards);
}

function executePlay(playerIdx, selectedIdxs) {
  const p = G.players[playerIdx];
  const sortedIdxs = [...selectedIdxs].sort((a, b) => b - a);
  const played = sortedIdxs.map(i => p.hand.splice(i, 1)[0]).reverse();

  // 直前の場は捨て札へ
  G.discardAll.push(...G.fieldCards);
  G.fieldCards = played;
  G.fieldPlayerIdx = playerIdx;
  G.selectedCards = [];

  const targets = getFieldTargets(played);
  setActionLog(`${p.name} が ${played.map(c => c.rank).join(',')} を出した（目標: ${targets.join(' or ')}）`);

  renderAll();

  if (p.hand.length === 0) {
    G._goOut = true;
  }
  openDobonWindow();
}

// ==================== DOBON WINDOW ====================

function openDobonWindow() {
  G.phase = 'dobon_window';
  renderAll();

  // AIのDOBON判定（フィールドプレイヤー以外）
  const fIdx = G.fieldPlayerIdx;
  G.players.forEach((p, i) => {
    if (i === fIdx || p.eliminated || !p.isAI) return;
    const targets = getFieldTargets(G.fieldCards);
    if (canHybridDobon(p.hand, targets)) {
      setTimeout(() => {
        if (G.phase === 'dobon_window') processDobon(i, fIdx);
      }, 400 + Math.random() * 800);
    }
  });

  G.dobonWindowTimer = setTimeout(() => {
    if (G.phase === 'dobon_window') closeDobonWindow();
  }, 2000);
}

function closeDobonWindow() {
  if (G.dobonWindowTimer) { clearTimeout(G.dobonWindowTimer); G.dobonWindowTimer = null; }

  // 手札0枚で上がり
  if (G._goOut) {
    G._goOut = false;
    G.phase = 'end';
    renderAll();
    setTimeout(() => processGoOut(G.fieldPlayerIdx), 300);
    return;
  }

  // ドローフェーズへ
  G.phase = 'draw';
  renderAll();

  const humanIdx = getHumanIdx();
  if (G.currentPlayer !== humanIdx) {
    setTimeout(() => aiDraw(G.currentPlayer), 400);
  } else {
    setStatus('カードを1枚引いてください（山札 or 捨て札）');
  }
}

// ==================== DOBON DECLARATION ====================

export function hybridDobonDeclare() {
  if (G.phase !== 'dobon_window') return;
  const humanIdx = getHumanIdx();
  if (humanIdx === G.fieldPlayerIdx) return;

  const hand = G.players[humanIdx].hand;
  const targets = getFieldTargets(G.fieldCards);
  if (!canHybridDobon(hand, targets)) {
    showToast('ドボンできません');
    return;
  }
  processDobon(humanIdx, G.fieldPlayerIdx);
}

function processDobon(declarerIdx, targetIdx) {
  if (G.phase !== 'dobon_window') return;
  if (G.dobonWindowTimer) { clearTimeout(G.dobonWindowTimer); G.dobonWindowTimer = null; }

  const declarer = G.players[declarerIdx];
  const target = G.players[targetIdx];
  const targets = getFieldTargets(G.fieldCards);
  const explanation = hybridDobonExplanation(declarer.hand, targets);

  G.phase = 'end';
  showToast(`${declarer.name} ドボン！！`, 2000);

  setTimeout(() => {
    const penalties = [];
    G.players.forEach((p, i) => {
      if (p.eliminated) return;
      const ht = handTotalEffective(p.hand);
      let addPts = i === declarerIdx ? 0 : (i === targetIdx ? ht * 2 : ht);
      const prev = p.score;
      let newScore = applyRescue(prev + addPts);
      p.score = newScore;
      if (newScore >= G.elimPts) p.eliminated = true;
      penalties.push({ p, i, addPts, ht, newScore });
    });

    const tableHTML = penalties.map(r => {
      const isDecl = r.i === declarerIdx;
      const isTgt = r.i === targetIdx;
      const rowCls = isDecl ? 'winner' : (isTgt ? 'penalty' : '');
      const sym = isDecl ? '🎯' : (isTgt ? '💥' : '');
      const pts = isDecl ? '0 (ドボン成功)' : (isTgt ? `+${r.addPts} (×2)` : `+${r.addPts}`);
      return `<tr class="${rowCls}"><td>${sym} ${r.p.name}</td><td style="font-size:12px;color:var(--text-light)">手札:${r.ht}点</td><td>${pts}</td><td>${r.newScore}点${r.p.eliminated ? '<br><small style="color:#f88">脱落</small>' : ''}</td></tr>`;
    }).join('');

    const expStr = explanation ? ` (${declarer.name}: ${explanation})` : '';
    showRoundEndModal('🎯 ドボン！', `${declarer.name} が ${target.name} にドボン！${expStr}`, tableHTML);
  }, 600);
}

// ==================== DRAW ====================

export function hybridDrawDeck() {
  const humanIdx = getHumanIdx();
  if (G.currentPlayer !== humanIdx || G.phase !== 'draw') return;
  drawFromDeck(humanIdx);
}

export function hybridDrawDiscard() {
  const humanIdx = getHumanIdx();
  if (G.currentPlayer !== humanIdx || G.phase !== 'draw') return;
  if (!G.discardAll.length) return;
  drawFromDiscard(humanIdx);
}

function drawFromDeck(playerIdx) {
  if (!G.deck.length) {
    if (!G.discardAll.length) { declareDraw(); return; }
    G.deck = shuffle([...G.discardAll]);
    G.discardAll = [];
    showToast('山札をシャッフルしました', 1200);
  }
  const p = G.players[playerIdx];
  p.hand.push(G.deck.shift());
  sortPlayerHand(p);
  G.selectedCards = [];
  renderAll();
  setActionLog(`${p.name} が山札からカードを引きました`);
  advanceTurn();
}

function drawFromDiscard(playerIdx) {
  if (!G.discardAll.length) { drawFromDeck(playerIdx); return; }
  const p = G.players[playerIdx];
  const card = G.discardAll.pop();
  p.hand.push(card);
  sortPlayerHand(p);
  G.selectedCards = [];
  renderAll();
  setActionLog(`${p.name} が捨て札からカードを引きました`);
  advanceTurn();
}

function aiDraw(idx) {
  if (!G.deck.length) {
    if (!G.discardAll.length) { declareDraw(); return; }
    G.deck = shuffle([...G.discardAll]);
    G.discardAll = [];
  }
  // 捨て札の一番上が低値なら取る
  if (G.discardAll.length > 0) {
    const top = G.discardAll[G.discardAll.length - 1];
    if (cardValue(top) <= 3) {
      drawFromDiscard(idx);
      return;
    }
  }
  drawFromDeck(idx);
}

// ==================== YANIV ====================

export function hybridDeclareYaniv() {
  const humanIdx = getHumanIdx();
  if (G.currentPlayer !== humanIdx || G.phase !== 'play') return;
  const total = handTotalEffective(G.players[humanIdx].hand);
  if (total > YANIV_THRESHOLD) {
    showToast(`手札合計${total}点 — ${YANIV_THRESHOLD}点以下でないとヤニブ宣言できません`);
    return;
  }
  startYanivGrace(humanIdx);
}

function startYanivGrace(idx) {
  G.phase = 'end';
  showToast(`${G.players[idx].name} がヤニブ宣言！`, 1800);
  renderAll();
  setTimeout(() => processYanivDeclaration(idx), 1200);
}

function processYanivDeclaration(declIdx) {
  const declarer = G.players[declIdx];
  const declTotal = handTotalEffective(declarer.hand);
  const alive = G.players.filter(p => !p.eliminated);

  const declFailed = alive.some((p, _, __) => {
    const i = G.players.indexOf(p);
    return i !== declIdx && handTotalEffective(p.hand) <= declTotal;
  });

  const changes = G.players.map((p, i) => {
    if (p.eliminated) return null;
    const ht = handTotalEffective(p.hand);
    let addPts = i === declIdx
      ? (declFailed ? ht + 30 : 0)
      : (declFailed ? 0 : ht);
    const newScore = applyRescue(p.score + addPts);
    p.score = newScore;
    if (newScore >= G.elimPts) p.eliminated = true;
    return { p, i, addPts, ht, newScore };
  }).filter(Boolean);

  const tableHTML = changes.map(r => {
    const isDecl = r.i === declIdx;
    const isPenalty = isDecl && declFailed;
    const rowCls = isDecl && !declFailed ? 'winner' : (isPenalty ? 'penalty' : '');
    const sym = isDecl && !declFailed ? '🏆' : (isPenalty ? '⚠️' : '');
    const pts = isPenalty ? `+${r.addPts} (失敗+30)` : (r.addPts === 0 ? '0 (成功)' : `+${r.addPts}`);
    return `<tr class="${rowCls}"><td>${sym} ${r.p.name}</td><td style="font-size:12px;color:var(--text-light)">手札:${r.ht}点</td><td>${pts}</td><td>${r.newScore}点${r.p.eliminated ? '<br><small style="color:#f88">脱落</small>' : ''}</td></tr>`;
  }).join('');

  showRoundEndModal(
    declFailed ? 'ヤニブ失敗…' : 'YANIV！',
    declFailed ? `${declarer.name}のヤニブが失敗しました` : `${declarer.name}がヤニブ宣言に成功！`,
    tableHTML
  );
}

// ==================== GO OUT ====================

function processGoOut(playerIdx) {
  const winner = G.players[playerIdx];
  showToast(`${winner.name} 上がり！`, 2000);

  setTimeout(() => {
    const changes = G.players.map((p, i) => {
      if (p.eliminated) return null;
      const ht = handTotalEffective(p.hand);
      const addPts = i === playerIdx ? 0 : ht;
      const newScore = applyRescue(p.score + addPts);
      p.score = newScore;
      if (newScore >= G.elimPts) p.eliminated = true;
      return { p, i, addPts, ht, newScore };
    }).filter(Boolean);

    const tableHTML = changes.map(r => {
      const isWin = r.i === playerIdx;
      return `<tr class="${isWin ? 'winner' : ''}"><td>${isWin ? '🏆' : ''} ${r.p.name}</td><td style="font-size:12px;color:var(--text-light)">手札:${r.ht}点</td><td>${r.addPts === 0 ? '0 (上がり)' : `+${r.addPts}`}</td><td>${r.newScore}点${r.p.eliminated ? '<br><small style="color:#f88">脱落</small>' : ''}</td></tr>`;
    }).join('');

    showRoundEndModal('🏆 上がり！', `${winner.name} が手札0枚で上がりました！`, tableHTML);
  }, 800);
}

// ==================== ROUND END ====================

function applyRescue(score) {
  if (score === 50) return 25;
  if (score === 100) return 50;
  return score;
}

function showRoundEndModal(title, subtitle, tableHTML) {
  const alive = G.players.filter(p => !p.eliminated);
  const gameOver = alive.length <= 1;
  showModal(title, subtitle, tableHTML,
    gameOver ? [
      { label: '最終結果を見る', cls: 'btn btn-primary', action: showFinalResults },
      { label: 'タイトルへ', cls: 'btn btn-secondary', action: () => { hideModal(); showScreen('title-screen'); } },
    ] : [
      { label: '次のラウンドへ', cls: 'btn btn-primary', action: nextRound },
      { label: 'ゲームを終了', cls: 'btn btn-secondary', action: () => { hideModal(); showFinalResults(); } },
    ]
  );
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
    `<tr class="${i === 0 ? 'winner' : ''}"><td>${i === 0 ? '🏆' : (i + 1) + '位'} ${p.name}</td><td>${p.score}点</td></tr>`
  ).join('');
  showModal('🏆 ゲーム終了', `${winner.name} の勝利！`, tableHTML, [
    { label: 'もう一度遊ぶ', cls: 'btn btn-primary', action: () => { hideModal(); startGame(); } },
    { label: 'タイトルへ', cls: 'btn btn-secondary', action: () => { hideModal(); showScreen('title-screen'); } },
  ]);
}

function declareDraw() {
  showToast('山札がなくなりました — このラウンドは無効です', 3000);
  setTimeout(() => {
    showRoundEndModal(
      '🔄 ゲーム流れ',
      '山札がなくなったため、このラウンドは無効です',
      `<tr><td colspan="2" style="text-align:center;padding:8px 0;font-size:13px;color:var(--text-light);">得点の変動はありません</td></tr>`
    );
  }, 1200);
}

// ==================== AI ====================

function aiTurn(idx) {
  showOppThinking(idx, false);
  const p = G.players[idx];
  const total = handTotalEffective(p.hand);

  // ヤニブ宣言判定
  if (total <= YANIV_THRESHOLD) {
    const alive = G.players.filter(pl => !pl.eliminated);
    const minOther = Math.min(...alive.filter(pl => pl !== p).map(pl => handTotalEffective(pl.hand)));
    if (total <= minOther) {
      setTimeout(() => startYanivGrace(idx), 400);
      return;
    }
  }

  const bestPlay = aiBestPlay(p.hand);
  setTimeout(() => executePlay(idx, bestPlay), 600);
}

// 手札合計を最大限減らすプレイを選ぶ
function aiBestPlay(hand) {
  if (!hand.length) return [0];

  let bestIdxs = [0];
  let bestRemoved = cardValue(hand[0]);

  // 単枚: 最も高い値
  hand.forEach((c, i) => {
    const v = cardValue(c);
    if (v > bestRemoved) { bestRemoved = v; bestIdxs = [i]; }
  });

  // 同ランクグループ
  const rankGroups = {};
  hand.forEach((c, i) => {
    if (!rankGroups[c.rank]) rankGroups[c.rank] = [];
    rankGroups[c.rank].push(i);
  });
  for (const idxs of Object.values(rankGroups)) {
    if (idxs.length < 2) continue;
    const removed = idxs.reduce((s, i) => s + cardValue(hand[i]), 0);
    if (removed > bestRemoved) { bestRemoved = removed; bestIdxs = idxs; }
  }

  // 連番（3枚以上）
  const RANK_SEQ = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const withRi = hand
    .map((c, i) => ({ c, i, ri: RANK_SEQ.indexOf(c.rank) }))
    .filter(x => x.ri >= 0)
    .sort((a, b) => a.ri - b.ri);

  for (let s = 0; s < withRi.length; s++) {
    const seq = [withRi[s]];
    for (let j = s + 1; j < withRi.length; j++) {
      if (withRi[j].ri === seq[seq.length - 1].ri + 1) seq.push(withRi[j]);
      else if (withRi[j].ri > seq[seq.length - 1].ri + 1) break;
    }
    if (seq.length >= 3) {
      const removed = seq.reduce((s, x) => s + cardValue(x.c), 0);
      if (removed > bestRemoved) { bestRemoved = removed; bestIdxs = seq.map(x => x.i); }
    }
  }

  return bestIdxs;
}

// ==================== QUIT / RULES ====================

export function confirmQuit() {
  if (confirm('ゲームを終了してタイトルに戻りますか？')) {
    if (G.dobonWindowTimer) { clearTimeout(G.dobonWindowTimer); G.dobonWindowTimer = null; }
    hideModal();
    showScreen('title-screen');
  }
}

export function showRules() {
  showModal(
    'ルール（ヤニブドボン）',
    '',
    `<tr><td colspan="2" style="text-align:left;font-size:13px;line-height:1.9;color:var(--cream);">
    <b>🎯 目的</b>: 手札を減らしてヤニブ宣言 / 手札0枚で上がり / ドボン成功で勝利<br><br>
    <b>🃏 カード点数</b>（DOBON計算用）: Joker=0、A=1、2〜10=数字通り、J=11、Q=12、K=13<br><br>
    <b>♻️ ターン進行</b>:<br>
    &nbsp;&nbsp;① カードを出す（セット or 連番）<br>
    &nbsp;&nbsp;② ドボン確認時間（2秒）<br>
    &nbsp;&nbsp;③ 山札か捨て札から1枚引く<br><br>
    <b>📤 出し方</b>: 1枚 / 同ランク2枚以上 / 連番3枚以上（A-2-3等）<br><br>
    <b>✨ ヤニブ宣言</b>: ターン開始時に手札合計が${YANIV_THRESHOLD}点以下なら宣言可能<br>
    &nbsp;&nbsp;• 成功: 宣言者0点、他は手札合計点を加算<br>
    &nbsp;&nbsp;• 失敗（他プレイヤーが同点以下）: 宣言者に手札合計+30点ペナルティ<br><br>
    <b>🎯 ドボン宣言</b>: 他プレイヤーの捨て札に対して手持ちカードで計算が一致すれば宣言可能<br>
    &nbsp;&nbsp;• 足し算: 手札の任意の部分集合の和が目標値と一致<br>
    &nbsp;&nbsp;• 引/掛/割: 異なるランク2枚による演算が目標値と一致<br>
    &nbsp;&nbsp;• 同ランク複数枚出しの場合: 合計値 と 1枚分の値 の両方が目標値<br>
    &nbsp;&nbsp;• 成功: 宣言者0点、対象者は手札合計×2点、他は手札合計点を加算<br><br>
    <b>🔄 救済</b>: ちょうど50点→25点、ちょうど100点→50点に減点
    </td></tr>`,
    [{ label: '閉じる', cls: 'btn btn-primary', action: hideModal }]
  );
}
