import { cardColor, handTotal } from '../core/deck.js';
import { handTotalEffective } from '../games/yaniv/rules.js';
import { addCardGestures } from './gestures.js';

// ==================== CARD RENDERING ====================

export function renderCard(card, large = false, selected = false) {
  const div = document.createElement('div');
  div.className = `card ${cardColor(card)}${large ? ' large' : ''}${selected ? ' selected' : ''}`;
  if (card.rank === 'JK') {
    div.innerHTML = `<div class="card-corner-top"><span class="rank">JOKER</span></div><div class="center-suit">🃏</div><div class="card-corner-bottom"><span class="rank">JOKER</span></div>`;
  } else {
    div.innerHTML = `<div class="card-corner-top"><span class="rank">${card.rank}</span><span class="suit">${card.suit}</span></div><div class="center-suit">${card.suit}</div><div class="card-corner-bottom"><span class="rank">${card.rank}</span><span class="suit">${card.suit}</span></div>`;
  }
  return div;
}

export function renderCardBack() {
  const div = document.createElement('div');
  div.className = 'opponent-card-back';
  return div;
}

// ==================== PANEL RENDERING ====================

export function renderScorePanel(players, currentPlayer, elimPts) {
  const panel = document.getElementById('score-panel');
  panel.innerHTML = '';
  players.forEach((p, i) => {
    const chip = document.createElement('div');
    chip.className = `score-chip${i === currentPlayer ? ' current-turn' : ''}${p.eliminated ? ' eliminated' : ''}`;
    const displayVal = p.score ?? p.losses ?? 0;
    const isDanger = p.score !== undefined ? p.score >= elimPts - 20 : false;
    chip.innerHTML = `<span class="score-name">${p.name}</span><span class="score-pts${isDanger ? ' danger' : ''}">${displayVal}</span>`;
    panel.appendChild(chip);
  });
}

export function renderOpponents(players, humanIdx) {
  const row = document.getElementById('opponents-row');
  row.innerHTML = '';
  players.forEach((p, i) => {
    if (i === humanIdx || p.eliminated) return;
    const area = document.createElement('div');
    area.className = 'opponent-area';
    area.id = `opp-area-${i}`;

    const cardsDiv = document.createElement('div');
    cardsDiv.className = 'opponent-cards';
    p.hand.forEach(() => cardsDiv.appendChild(renderCardBack()));

    const nameDiv = document.createElement('div');
    nameDiv.className = 'opponent-name';
    nameDiv.textContent = p.isAI ? `🤖 ${p.name}` : p.name;

    const thinkDiv = document.createElement('div');
    thinkDiv.className = 'opp-thinking';
    thinkDiv.id = `opp-think-${i}`;
    thinkDiv.textContent = '考え中...';

    area.appendChild(cardsDiv);
    area.appendChild(nameDiv);
    area.appendChild(thinkDiv);
    row.appendChild(area);
  });
}

export function renderCenter(deck, discardPile, drawSource, callbacks = {}) {
  const da = document.getElementById('discard-area');
  da.innerHTML = '';
  document.getElementById('deck-count').textContent = `${deck.length}枚`;

  const deckEl = document.getElementById('deck-pile');
  deckEl.classList.toggle('source-selected', drawSource === 'deck');

  if (discardPile.length > 0) {
    const showCards = discardPile.slice(-3);
    showCards.forEach((c, i) => {
      const cd = renderCard(c);
      cd.className += ' discard-top-card';
      cd.style.cssText = `position:absolute;top:${i * 2}px;left:${i * 2}px;cursor:pointer;`;
      if (i === showCards.length - 1) {
        cd.classList.toggle('source-selected', drawSource === 'discard');
        if (callbacks.onSelectDiscard) cd.onclick = callbacks.onSelectDiscard;
      }
      da.appendChild(cd);
    });
  } else {
    const placeholder = document.createElement('div');
    placeholder.style.cssText = 'width:72px;height:104px;border:2px dashed rgba(255,255,255,0.15);border-radius:7px;';
    da.appendChild(placeholder);
  }
}

export function renderPlayerHand(hand, selectedCards, mode, playerName, callbacks = {}) {
  const handEl = document.getElementById('player-hand');
  handEl.innerHTML = '';
  if (!hand) return;

  hand.forEach((card, idx) => {
    const cd = renderCard(card, true, selectedCards.includes(idx));
    if (callbacks.onCardClick) cd.onclick = () => callbacks.onCardClick(idx);
    if (callbacks.onCardDiscard) {
      addCardGestures(cd, idx, { onSwipeUp: (i) => callbacks.onCardDiscard(i) });
    }
    handEl.appendChild(cd);
  });

  const eff = handTotalEffective(hand);
  const raw = handTotal(hand);
  const sumStr = raw === eff ? `合計: ${eff}点` : `合計: ${eff}点 (実: ${raw}点)`;
  document.getElementById('player-label').textContent =
    (mode === 'local' ? `${playerName}の手札` : 'あなたの手札') + `  /  ${sumStr}`;
}

// ==================== ACTION BAR ====================

export function updateActionBar(canYaniv, canExchange, total) {
  document.getElementById('btn-yaniv').disabled = !canYaniv;
  document.getElementById('btn-exchange').disabled = !canExchange;
  document.getElementById('btn-yaniv').classList.toggle('yaniv-highlight', canYaniv && total <= 5);
}

export function updatePhaseLabel(phase) {
  const label = phase === 'yaniv_response' ? '手札交換チャンス' : 'カードを交換';
  document.getElementById('phase-label').textContent = label;
}

// ==================== STATUS ====================

export function setStatus(msg) {
  document.getElementById('status-bar').textContent = msg;
}

export function setActionLog(msg) {
  document.getElementById('action-log').textContent = msg;
}

export function showOppThinking(idx, show) {
  const el = document.getElementById(`opp-think-${idx}`);
  if (el) el.classList.toggle('show', show);
}

// ==================== SCREEN ====================

export function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ==================== MODAL ====================

/**
 * モーダルを表示する
 * @param {string} title タイトル
 * @param {string} subtitle サブタイトル
 * @param {string} htmlBody テーブル等の本体HTML
 * @param {Array} buttons ボタン定義 [{label, cls, action}]
 */
export function showModal(title, subtitle, htmlBody, buttons = []) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-sub').textContent = subtitle || '';
  document.getElementById('result-table').innerHTML = htmlBody || '';
  
  const btnArea = document.getElementById('modal-btns');
  btnArea.innerHTML = '';
  
  buttons.forEach(b => {
    const btn = document.createElement('button');
    btn.className = b.cls || 'btn btn-secondary';
    btn.textContent = b.label;
    btn.onclick = b.action;
    btnArea.appendChild(btn);
  });
  
  document.getElementById('modal-overlay').classList.add('active');
}

export function hideModal() {
  document.getElementById('modal-overlay').classList.remove('active');
}
