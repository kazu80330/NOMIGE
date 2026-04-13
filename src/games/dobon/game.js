// ==================== DOBON GAME ====================

import { buildDeck, shuffle } from '../../core/deck.js';
import {
  dobonCardValue, fieldDobonValue,
  isValidPlay, isValidPlaySet, isForbiddenWin,
  getSpecialEffect, calcSuitLock, canSpade3Return, getValidPlays,
} from './engine.js';
import { canDobon, dobonExplanation } from './dobonCalc.js';
import { aiChoosePlay, aiShouldDobon, aiShouldDobonReturn } from './ai.js';
import {
  renderScorePanel, renderOpponents, renderCard, renderCardBack,
  setStatus, setActionLog, showOppThinking, showScreen,
} from '../../ui/renderer.js';
import { addCardGestures } from '../../ui/gestures.js';
import { showModal, hideModal, showToast } from '../../ui/modal.js';

// ==================== STATE ====================

export const G = {
  mode: 'ai',
  players: [],
  deck: [],
  discardAll: [],     // 全て捨てられたカード（山札再利用）
  fieldCards: [],     // 現在の場のカード
  fieldPlayerIdx: -1, // 最後に場を更新したプレイヤー
  currentPlayer: 0,
  round: 1,
  phase: 'play',      // 'play' | 'dobon_window' | 'dobon_return'
  jback: false,
  suitLock: null,
  doubleFactor: 1,    // ドボン倍率（山札リセットごとに×2）
  passCount: 0,       // 連続パス数
  selectedCards: [],  // プレイヤーが選択中のカードインデックス
  localTurn: 0,
  handRevealed: false,
  settings: { players: 3, local_players: 3, init_cards: 5, max_losses: 5 },
  dobonWindowTimer: null,
  dobonReturnTarget: null, // ドボン返しを待っているプレイヤーIdx
  dobonDeclarer: null,     // ドボン宣言したプレイヤーIdx
  pendingAction: null,     // ドボンウィンドウ後に実行する後処理 { type: 'eight_cut'|'goout', playerIdx, cards? }
};

// ==================== HELPERS ====================

// ==================== HELPERS ====================

function getHumanIdx() {
  return G.mode === 'ai' ? 0 : G.localTurn;
}

/**
 * ドボンの強さ順（昇順）でソートする
 * 3 < 4 < ... < 10 < J < Q < K < A < 2 < JK
 */
function sortHandByStrength(hand) {
  const strength = {
    '3': 0, '4': 1, '5': 2, '6': 3, '7': 4, '8': 5, '9': 6, '10': 7,
    'J': 8, 'Q': 9, 'K': 10, 'A': 11, '2': 12, 'JK': 13
  };
  const suitOrder = { '★': 0, '♠': 1, '♥': 2, '♦': 3, '♣': 4 };

  hand.sort((a, b) => {
    const va = strength[a.rank] ?? parseInt(a.rank);
    const vb = strength[b.rank] ?? parseInt(b.rank);
    if (va !== vb) return va - vb;
    return (suitOrder[a.suit] || 0) - (suitOrder[b.suit] || 0);
  });
}

function drawCards(player, count) {
  for (let i = 0; i < count; i++) {
    if (!G.deck.length) {
      if (!G.discardAll.length) break;
      G.deck = shuffle(G.discardAll.splice(0));
      G.doubleFactor *= 2;
      showToast('山札リセット！ドボン倍率×2', 2000);
    }
    if (G.deck.length) player.hand.push(G.deck.shift());
  }
  sortHandByStrength(player.hand);
}

// ==================== SETUP ====================

export function showSetup(mode) {
  G.mode = mode;
  document.getElementById('setup-mode-label').textContent = mode === 'ai' ? '🤖 AI対戦' : '👥 ローカル対人';
  document.getElementById('player-count-section').style.display = mode === 'ai' ? '' : 'none';
  document.getElementById('local-count-section').style.display = mode === 'local' ? '' : 'none';
  
  // ドボンは5枚固定のため設定を隠す
  const initCardsSec = document.getElementById('setup-init-cards-section');
  if (initCardsSec) initCardsSec.style.display = 'none';
  
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
  G.settings.max_losses = G.settings.max_losses || 5;
  G.settings.init_cards = 5; // ドボンは5枚固定

  G.players = [];
  for (let i = 0; i < count; i++) {
    const inp = document.getElementById('name-inputs').querySelectorAll('input')[i];
    let name = inp ? inp.value.trim() : '';
    if (!name) name = G.mode === 'ai' ? (i === 0 ? 'あなた' : `AI ${i}`) : `プレイヤー ${i + 1}`;
    const isAI = G.mode === 'ai' && i > 0;
    G.players.push({ name, losses: 0, hand: [], isAI, eliminated: false });
  }
  G.round = 1;
  G.currentPlayer = 0;
  G.localTurn = 0;
  G.doubleFactor = 1;
  window.activeDiscardCard = (idx) => swipeDobonCard(idx);
  G.deck = buildDeck();
  G.discardAll = [];

  initRound();
  showScreen('game-screen');
  document.getElementById('game-screen').style.setProperty('--table-color', '#1a2a3a');
  document.getElementById('game-screen').style.setProperty('--table-dark', '#0a1018');
}

// ==================== ROUND INIT ====================

function initRound() {
  G.fieldCards = [];
  G.fieldPlayerIdx = -1;
  G.jback = false;
  G.suitLock = null;
  G.selectedCards = [];
  G.passCount = 0;
  G.phase = 'play';
  G.handRevealed = false;

  // 全員に5枚補充 & ソート
  for (const p of G.players) {
    if (p.eliminated) continue;
    drawCards(p, G.settings.init_cards || 5);
  }

  document.getElementById('round-info').textContent = `ラウンド ${G.round}`;
  renderAll();

  if (G.mode === 'local') {
    G.localTurn = G.currentPlayer;
    showHandCover();
  } else {
    startTurn();
  }
}

// ==================== RENDER ====================

function renderAll() {
  const humanIdx = getHumanIdx();
  renderScorePanel(G.players, G.currentPlayer, 9999); // 9999 = eliminationなし
  renderOpponents(G.players, humanIdx);
  renderDobonCenter();
  renderDobonPlayerHand();
  updateDobonActionBar();
  updatePhaseDisplay();
}

function renderDobonCenter() {
  // 山札
  document.getElementById('deck-count').textContent = `${G.deck.length}枚`;
  const deckEl = document.getElementById('deck-pile');
  deckEl.onclick = null; // ドボンでは山札クリックは「引く」ではなくボタン経由

  // 場ラベル
  const deckLabelEl = document.querySelectorAll('.deck-label')[1];
  if (deckLabelEl) deckLabelEl.textContent = '場';

  // 場のカード表示
  const da = document.getElementById('discard-area');
  da.innerHTML = '';
  da.style.position = 'relative';

  if (G.fieldCards.length) {
    // 場のカードを横並びで表示
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:4px;position:relative;';
    G.fieldCards.forEach(c => {
      const cd = renderCard(c);
      wrap.appendChild(cd);
    });
    da.appendChild(wrap);

    // ドボン対象値バッジ
    const val = fieldDobonValue(G.fieldCards);
    if (val > 0) {
      const badge = document.createElement('div');
      badge.className = 'field-value-badge';
      badge.textContent = val;
      da.appendChild(badge);
    }
  } else {
    const ph = document.createElement('div');
    ph.style.cssText = 'width:72px;height:104px;border:2px dashed rgba(255,255,255,0.15);border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:11px;color:rgba(255,255,255,0.3);';
    ph.textContent = '場なし';
    da.appendChild(ph);
  }

  // Jバック表示
  const jbackEl = document.getElementById('jback-indicator');
  if (jbackEl) jbackEl.style.display = G.jback ? 'inline-block' : 'none';
}

function renderDobonPlayerHand() {
  const humanIdx = getHumanIdx();
  const handEl = document.getElementById('player-hand');
  handEl.innerHTML = '';
  const p = G.players[humanIdx];
  if (!p) return;

  p.hand.forEach((card, idx) => {
    const cd = renderCard(card, true, G.selectedCards.includes(idx));
    cd.onclick = () => toggleDobonSelect(idx);
    addCardGestures(cd, idx, { onSwipeUp: (i) => swipeDobonCard(i) });
    handEl.appendChild(cd);
  });

  document.getElementById('player-label').textContent =
    (G.mode === 'local' ? `${p.name}の手札` : 'あなたの手札') +
    `  /  ${p.hand.length}枚`;
}

function updateDobonActionBar() {
  const humanIdx = getHumanIdx();
  const isMyTurn = G.currentPlayer === humanIdx;
  const hand = G.players[humanIdx]?.hand || [];

  // 選択カードが有効なプレイセットか
  const selCards = G.selectedCards.map(i => hand[i]);
  const validSel = selCards.length > 0 && isValidPlaySet(selCards);
  const canPlay = isMyTurn && G.phase === 'play' &&
    validSel && isValidPlay(selCards, G.fieldCards, G.jback, G.suitLock);

  const canDraw = isMyTurn && G.phase === 'play' && G.selectedCards.length === 0;

  // ♠3返し確認
  const canS3 = isMyTurn && G.phase === 'play' && selCards.length === 1 &&
    canSpade3Return(selCards[0], G.fieldCards);

  // ドボンボタン（常に表示、有効/無効）
  const fv = fieldDobonValue(G.fieldCards);

  // glow条件：
  //   - 自分が出した札ではない（humanIdx !== G.fieldPlayerIdx）
  //   - 計算上ドボン可能
  //   - play/dobon_window フェーズ、または dobon_return で自分が返し対象
  const canDobonCalc = fv > 0 && humanIdx !== G.fieldPlayerIdx && canDobon(hand, fv);
  const inDobonPhase = G.phase === 'play' || G.phase === 'dobon_window';
  const inReturnPhase = G.phase === 'dobon_return' && G.dobonReturnTarget === humanIdx;
  const myDobon = canDobonCalc && (inDobonPhase || inReturnPhase);

  // ドボンボタンの有効化：play / dobon_window フェーズで自分が出し手でない場合
  const dobonEnabled = G.fieldCards.length > 0 &&
    humanIdx !== G.fieldPlayerIdx &&
    (G.phase === 'play' || G.phase === 'dobon_window');

  document.getElementById('action-bar').innerHTML = `
    <button class="btn-action btn-play" id="btn-play" onclick="window.dobonPlayCards()"
      ${canPlay || canS3 ? '' : 'disabled'}>
      ${canS3 ? '♠3返し' : '出す'}
    </button>
    <button class="btn-action btn-draw" id="btn-draw" onclick="window.dobonDrawCard()"
      ${canDraw ? '' : 'disabled'}>パス</button>
    <button class="btn-action btn-yaniv" id="btn-dobon-declare" onclick="window.dobonDeclare()"
      style="background:${myDobon ? '#c0392b' : 'rgba(200,80,80,0.2)'};
             color:${myDobon ? '#fff' : '#e88'};
             border:1px solid ${myDobon ? '#e74c3c' : 'rgba(200,80,80,0.3)'};"
      ${dobonEnabled ? '' : 'disabled'}>
      ドボン！
    </button>
  `;

  // ドボン！ボタンにハイライトアニメーション
  const dobonBtn = document.getElementById('btn-dobon-declare');
  if (dobonBtn && myDobon) dobonBtn.classList.add('dobon-available');
}

function updatePhaseDisplay() {
  const phaseMap = {
    play: 'カードを出す',
    dobon_window: 'ドボンチャンス！',
    dobon_return: 'ドボン返しチャンス！',
  };
  document.getElementById('phase-label').textContent = phaseMap[G.phase] || '';
  document.getElementById('phase-dot').classList.toggle('active', G.phase === 'play');

  // Jバックインジケーターが存在しない場合は作成
  let jbackEl = document.getElementById('jback-indicator');
  if (!jbackEl) {
    jbackEl = document.createElement('span');
    jbackEl.id = 'jback-indicator';
    jbackEl.className = 'jback-indicator';
    jbackEl.textContent = 'Jバック中';
    const roundInfo = document.getElementById('round-info');
    roundInfo.parentNode.insertBefore(jbackEl, roundInfo);
  }
  jbackEl.style.display = G.jback ? 'inline-block' : 'none';
}

// ==================== LOCAL MODE ====================

function showHandCover() {
  const cover = document.getElementById('hand-cover');
  G.handRevealed = false;
  if (G.mode === 'local') {
    const p = G.players[G.localTurn];
    cover.style.display = 'flex';
    cover.textContent = `${p.name}のターンです — タップして手札を表示`;
    const localInd = document.getElementById('local-indicator');
    localInd.className = 'local-indicator show';
    localInd.textContent = `${p.name}のターン`;
    document.getElementById('player-hand').innerHTML = '';
    renderOpponents(G.players, G.localTurn);
  }
}

export function revealHand() {
  G.handRevealed = true;
  document.getElementById('hand-cover').style.display = 'none';
  updateDobonActionBar();
}

// スワイプ・ドラッグで1枚（または選択中セット）を出す
function swipeDobonCard(idx) {
  const humanIdx = getHumanIdx();
  if (G.currentPlayer !== humanIdx || G.phase !== 'play') return;
  if (!G.selectedCards.includes(idx)) G.selectedCards = [idx];
  dobonPlayCards();
}

// ==================== PLAYER ACTIONS ====================

export function toggleDobonSelect(idx) {
  const humanIdx = getHumanIdx();
  if (G.currentPlayer !== humanIdx || G.phase !== 'play') return;
  const i = G.selectedCards.indexOf(idx);
  if (i >= 0) G.selectedCards.splice(i, 1);
  else G.selectedCards.push(idx);
  renderDobonPlayerHand();
  updateDobonActionBar();
}

export function dobonPlayCards() {
  const humanIdx = getHumanIdx();
  if (G.currentPlayer !== humanIdx || G.phase !== 'play') return;
  const hand = G.players[humanIdx].hand;
  const selCards = G.selectedCards.map(i => hand[i]);

  if (!selCards.length) return;

  // ♠3返し
  if (selCards.length === 1 && canSpade3Return(selCards[0], G.fieldCards)) {
    processPlay(humanIdx, [...G.selectedCards]);
    return;
  }

  if (!isValidPlay(selCards, G.fieldCards, G.jback, G.suitLock)) {
    showToast('その出し方はできません');
    return;
  }

  processPlay(humanIdx, [...G.selectedCards]);
}

export function dobonDrawCard() {
  const humanIdx = getHumanIdx();
  if (G.currentPlayer !== humanIdx || G.phase !== 'play') return;
  if (G.selectedCards.length > 0) return;

  G.passCount++;
  setActionLog(`${G.players[humanIdx].name} がパスしました`);
  G.selectedCards = [];
  renderAll();
  advanceTurn();
}

export function dobonDeclare() {
  const humanIdx = getHumanIdx();
  // play フェーズおよびドボンウィンドウ中に宣言可能
  if (G.phase !== 'play' && G.phase !== 'dobon_window') return;
  if (!G.fieldCards.length || humanIdx === G.fieldPlayerIdx) return;

  const hand = G.players[humanIdx].hand;
  const fv = fieldDobonValue(G.fieldCards);

  if (!canDobon(hand, fv)) {
    showToast('ドボンできません');
    return;
  }

  processDobon(humanIdx, G.fieldPlayerIdx);
}

export function confirmQuit() {
  if (confirm('ゲームを終了してタイトルに戻りますか？')) {
    clearDobonWindow();
    hideModal();
    showScreen('title-screen');
  }
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
      setTimeout(() => aiTurn(G.currentPlayer), 900 + Math.random() * 600);
    } else {
      // ローカルモードでAI相手なし → 次プレイヤーへ
      advanceTurn();
    }
  } else {
    updateDobonStatusMsg();
  }
}

function advanceTurn() {
  // 全員パスの場合は場を流す
  const alive = G.players.filter(p => !p.eliminated);
  if (G.passCount >= alive.length - 1) {
    G.fieldCards = [];
    G.fieldPlayerIdx = -1;
    G.jback = false;
    G.suitLock = null;
    G.passCount = 0;
    showToast('場を流しました', 1200);
  }

  let next = (G.currentPlayer + 1) % G.players.length;
  let loops = 0;
  while ((G.players[next].eliminated || G.players[next].hand.length === 0) && loops < G.players.length) {
    next = (next + 1) % G.players.length;
    loops++;
  }
  G.currentPlayer = next;

  if (G.mode === 'local') {
    G.localTurn = next;
    showHandCover();
  }

  renderScorePanel(G.players, G.currentPlayer, 9999);
  setTimeout(() => startTurn(), G.mode === 'local' ? 100 : 300);
}

// ==================== PLAY PROCESSING ====================

function processPlay(playerIdx, cardIndices) {
  const p = G.players[playerIdx];
  const playedCards = cardIndices.sort((a, b) => b - a).map(i => {
    const c = p.hand[i];
    p.hand.splice(i, 1);
    return c;
  }).reverse();

  G.discardAll.push(...playedCards);

  // ♠3返し
  if (playedCards.length === 1 && canSpade3Return(playedCards[0], G.fieldCards)) {
    G.fieldCards = [];
    G.fieldPlayerIdx = -1;
    G.jback = false;
    G.suitLock = null;
    G.passCount = 0;
    showToast('♠3返し！場がリセット', 1500);
    G.selectedCards = [];
    renderAll();
    setActionLog(`${p.name} が♠3返しを宣言！`);
    setTimeout(() => startTurn(), 600);
    return;
  }

  // スート縛り更新
  G.suitLock = calcSuitLock(playedCards, G.fieldCards);

  // 場更新
  G.fieldCards = playedCards;
  G.fieldPlayerIdx = playerIdx;
  G.passCount = 0;
  G.selectedCards = [];

  // 特殊効果
  const effect = getSpecialEffect(playedCards);

  setActionLog(`${p.name} が ${playedCards.map(c => c.rank === 'JK' ? 'JK' : c.rank + c.suit).join(',')} を出しました`);
  renderAll();

  if (effect === 'jback') {
    G.jback = !G.jback;
    showToast(G.jback ? 'Jバック！強さ逆転' : 'Jバック解除', 1200);
    renderAll();
  }

  if (effect === 'eight_cut') {
    // 8切り：場の8をそのまま残してドボンウィンドウを開く
    // → closeDobonWindow で場クリア＆同プレイヤー継続
    G.pendingAction = { type: 'eight_cut', playerIdx };
    setTimeout(() => openDobonWindow(playerIdx), 300);
    return;
  }

  // 手札が空になった：即終了せずドボンウィンドウを挟む
  if (p.hand.length === 0) {
    G.pendingAction = { type: 'goout', playerIdx, cards: playedCards };
    setTimeout(() => openDobonWindow(playerIdx), 300);
    return;
  }

  // 通常：ドボンウィンドウ開始
  setTimeout(() => openDobonWindow(playerIdx), 300);
}

function checkGoOut(playerIdx, lastCards) {
  const p = G.players[playerIdx];
  if (isForbiddenWin(lastCards)) {
    // 禁止上がり
    showToast(`${p.name} 禁止上がり！負け`, 2000);
    setTimeout(() => processRoundEnd(null, playerIdx, 'forbidden'), 500);
  } else {
    showToast(`${p.name} あがり！`, 2000);
    setTimeout(() => processRoundEnd(playerIdx, null, 'goout'), 500);
  }
}

// ==================== DOBON WINDOW ====================

function openDobonWindow(playedByIdx) {
  clearDobonWindow();
  G.phase = 'dobon_window';
  updatePhaseDisplay();

  const humanIdx = getHumanIdx();
  const fv = fieldDobonValue(G.fieldCards);
  if (fv <= 0) { closeDobonWindow(playedByIdx); return; }

  // AI のドボン判定（即時）
  if (G.mode === 'ai') {
    for (let i = 0; i < G.players.length; i++) {
      if (i === playedByIdx || i === humanIdx || G.players[i].eliminated) continue;
      if (aiShouldDobon(G.players[i].hand, fv)) {
        // AI ドボン成立
        setTimeout(() => {
          showToast(`${G.players[i].name} ドボン！`, 1800);
          processDobon(i, playedByIdx);
        }, 400);
        return;
      }
    }
  }

  // 人間プレイヤーへの表示
  const humanHand = G.players[humanIdx]?.hand || [];
  if (playedByIdx !== humanIdx && canDobon(humanHand, fv)) {
    // ドボン可能を強調
    setStatus(`ドボンチャンス！ドボン！ボタンで宣言（${fv}点）`);
    // 2秒後に自動終了
    G.dobonWindowTimer = setTimeout(() => closeDobonWindow(playedByIdx), 2000);
  } else {
    // チャンスなし → すぐ閉じる
    closeDobonWindow(playedByIdx);
  }
}

function closeDobonWindow(_playedByIdx) {
  clearDobonWindow();
  G.phase = 'play';

  const action = G.pendingAction;
  G.pendingAction = null;

  if (action?.type === 'eight_cut') {
    // 8切り後処理：場をクリアして同プレイヤーが継続
    G.fieldCards = [];
    G.fieldPlayerIdx = -1;
    G.jback = false;
    G.suitLock = null;
    G.passCount = 0;
    showToast('8切り！', 1200);
    renderAll();
    setTimeout(() => startTurn(), 500);
  } else if (action?.type === 'goout') {
    // あがり後処理
    renderAll();
    setTimeout(() => checkGoOut(action.playerIdx, action.cards), 300);
  } else {
    // 通常：次プレイヤーへ
    renderAll();
    advanceTurn();
  }
}

function clearDobonWindow() {
  if (G.dobonWindowTimer) {
    clearTimeout(G.dobonWindowTimer);
    G.dobonWindowTimer = null;
  }
}

// ==================== DOBON PROCESSING ====================

function processDobon(declarerIdx, targetIdx) {
  clearDobonWindow();
  G.pendingAction = null;  // ドボン発生でペンディング後処理をキャンセル
  G.phase = 'dobon_return';
  G.dobonDeclarer = declarerIdx;
  G.dobonReturnTarget = targetIdx;

  const declarer = G.players[declarerIdx];
  const target = G.players[targetIdx];
  const fv = fieldDobonValue(G.fieldCards);

  setActionLog(`${declarer.name} が ${target.name} にドボン宣言！（${fv}点）`);
  renderAll();

  // ドボン返し確認
  if (target.isAI) {
    if (aiShouldDobonReturn(target.hand, fv)) {
      setTimeout(() => {
        showToast(`${target.name} ドボン返し！`, 2000);
        processRoundEnd(targetIdx, declarerIdx, 'dobon_return');
      }, 600);
    } else {
      setTimeout(() => processRoundEnd(declarerIdx, targetIdx, 'dobon'), 600);
    }
  } else {
    // 人間のドボン返しチャンス
    if (canDobon(target.hand, fv)) {
      showDobonReturnModal(target, declarer, fv);
    } else {
      setTimeout(() => processRoundEnd(declarerIdx, targetIdx, 'dobon'), 600);
    }
  }
}

function showDobonReturnModal(target, declarer, fv) {
  showModal(
    'ドボン返しチャンス！',
    `${declarer.name}にドボンされました\n手札でドボン返しできます！（場の値:${fv}）`,
    `<tr><td colspan="2" style="text-align:center;padding:12px;font-size:14px;color:var(--cream);">
      ${target.name}の手札合計: ${target.hand.reduce((s, c) => s + (c.rank==='JK'?0:c.rank==='A'?1:c.rank==='J'?11:c.rank==='Q'?12:c.rank==='K'?13:parseInt(c.rank)), 0)}点
    </td></tr>`,
    [
      {
        label: 'ドボン返し！', cls: 'btn btn-primary',
        action: () => {
          hideModal();
          showToast(`${target.name} ドボン返し！`, 2000);
          processRoundEnd(G.dobonReturnTarget, G.dobonDeclarer, 'dobon_return');
        },
      },
      {
        label: '諦める', cls: 'btn btn-secondary',
        action: () => {
          hideModal();
          processRoundEnd(G.dobonDeclarer, G.dobonReturnTarget, 'dobon');
        },
      },
    ]
  );
}

// ==================== ROUND END ====================

function processRoundEnd(winnerIdx, loserIdx, reason) {
  G.phase = 'play';
  const maxLosses = G.settings.max_losses || 5;

  // 敗者に +1 loss
  if (loserIdx !== null && loserIdx !== undefined) {
    G.players[loserIdx].losses++;
    if (G.players[loserIdx].losses >= maxLosses) {
      G.players[loserIdx].eliminated = true;
    }
  }

  const alive = G.players.filter(p => !p.eliminated);
  const gameOver = alive.length <= 1;

  // 結果テーブル
  const tableHTML = G.players.map((p, i) => {
    const isWinner = i === winnerIdx;
    const isLoser = i === loserIdx;
    const rowClass = isWinner ? 'winner' : isLoser ? 'penalty' : '';
    const symbol = isWinner ? '🏆' : isLoser ? (reason === 'dobon' ? '💥' : reason === 'forbidden' ? '⛔' : '😿') : '';
    const label = isWinner ? '勝利' : isLoser ? (reason === 'dobon' ? 'ドボン' : reason === 'dobon_return' ? 'ドボン返し' : reason === 'forbidden' ? '禁止上がり' : '負け') : '';
    return `<tr class="${rowClass}"><td>${symbol} ${p.name}</td><td>${label}</td><td>${p.losses}/${maxLosses}敗${p.eliminated ? ' <small style="color:#f88">脱落</small>' : ''}</td></tr>`;
  }).join('');

  const reasonMsg = {
    dobon: 'ドボン成立！',
    dobon_return: 'ドボン返し成立！',
    goout: 'あがり！',
    forbidden: '禁止上がり…',
  }[reason] || '';

  showModal(
    reasonMsg,
    winnerIdx !== null ? `${G.players[winnerIdx]?.name} の勝利！` : `${G.players[loserIdx]?.name} の負け`,
    tableHTML,
    gameOver ? [
      { label: '最終結果を見る', cls: 'btn btn-primary', action: showFinalResults },
      { label: 'タイトルへ', cls: 'btn btn-secondary', action: () => { hideModal(); showScreen('title-screen'); } },
    ] : [
      { label: '次のラウンドへ', cls: 'btn btn-primary', action: () => nextRound(loserIdx) },
      { label: 'ゲームを終了', cls: 'btn btn-secondary', action: () => { hideModal(); showFinalResults(); } },
    ]
  );
}

function nextRound(loserIdx) {
  hideModal();
  G.round++;

  // 全員の手札をクリア→再補充
  for (const p of G.players) {
    G.discardAll.push(...p.hand);
    p.hand = [];
  }

  // 敗者からスタート
  if (loserIdx !== null && loserIdx !== undefined && !G.players[loserIdx].eliminated) {
    G.currentPlayer = loserIdx;
  } else {
    G.currentPlayer = G.players.findIndex(p => !p.eliminated);
  }

  initRound();
}

function showFinalResults() {
  hideModal();
  const sorted = [...G.players].sort((a, b) => a.losses - b.losses);
  const winner = sorted[0];
  const tableHTML = sorted.map((p, i) =>
    `<tr class="${i === 0 ? 'winner' : ''}"><td>${i === 0 ? '🏆' : i + 1 + '位'} ${p.name}</td><td>${p.losses}敗</td></tr>`
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

// ==================== AI TURN ====================

function aiTurn(idx) {
  showOppThinking(idx, false);
  const p = G.players[idx];
  const combo = aiChoosePlay(p.hand, G.fieldCards, G.jback, G.suitLock);

  if (combo === null) {
    // パス（カードを引かない）
    G.passCount++;
    setActionLog(`${p.name} がパスしました`);
    renderAll();
    setTimeout(() => advanceTurn(), 400);
  } else {
    processPlay(idx, combo);
  }
}

// ==================== STATUS ====================

function updateDobonStatusMsg() {
  const humanIdx = getHumanIdx();
  const hand = G.players[humanIdx]?.hand || [];
  const fv = fieldDobonValue(G.fieldCards);
  const myDobon = fv > 0 && G.currentPlayer !== G.fieldPlayerIdx && canDobon(hand, fv);

  if (G.fieldCards.length) {
    const lockMsg = G.suitLock ? `  [${G.suitLock}縛り]` : '';
    setStatus(`場: ${G.fieldCards.map(c => c.rank === 'JK' ? 'JK' : c.rank + c.suit).join(' ')} (${fv}点)${lockMsg}${G.jback ? '  [Jバック中]' : ''}${myDobon ? '  ★ドボン可！' : ''}`);
  } else {
    setStatus('場が空です。自由にカードを出せます。');
  }
}

export function showRules() {
  showModal(
    'ドボン ルール',
    '',
    `<tr><td style="text-align:left;font-size:13px;line-height:1.9;color:var(--cream);">
    <b>🎯 目的</b>: 手札を0枚にして上がる。またはドボンで相手を潰す。<br><br>
    <b>🃏 強さ</b>: 3&lt;4&lt;…&lt;10&lt;J&lt;Q&lt;K&lt;A&lt;2&lt;Joker （常に昇順ソート）<br><br>
    <b>初期手札</b>: 5枚固定（設定によらず）<br><br>
    <b>♻️ 出し方</b>: 場より強い同枚数のカードを出す。出せなければパス（カードを引かない）。<br>全員パスしたら場を流して最後の出し手から再開。<br><br>
    <b>🌀 特殊役</b>:<br>
    &nbsp;• 8: 8切り（場をリセット、同じプレイヤーが続行）<br>
    &nbsp;• J: Jバック（強さ逆転）<br>
    &nbsp;• ♠3: スペ3返し（場のJoker単体に対してのみ）<br><br>
    <b>💥 ドボン</b>: 誰かがカードを出した瞬間に割り込み宣言！<br>
    &nbsp;• 手札の数字が2種類以下: 四則演算で場の数字に一致→成功<br>
    &nbsp;• 手札の数字が3種類以上: 手札の合計が場の数字に一致→成功<br>
    &nbsp;• 点数値: A=1, 2-10=数字, J=11, Q=12, K=13, Joker=0<br><br>
    <b>🔄 ドボン返し</b>: ドボンされた側が残り手札で逆ドボン可能<br><br>
    <b>⛔ 禁止上がり</b>: 最後の1枚が 8/2/Joker の場合は負け
    </td></tr>`,
    [{ label: '閉じる', cls: 'btn btn-primary', action: hideModal }]
  );
}