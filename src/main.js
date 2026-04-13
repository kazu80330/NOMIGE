import { showScreen, hideModal } from './ui/renderer.js';
import * as YanivGame from './games/yaniv/game.js';
import * as DobonGame from './games/dobon/game.js';

// ==================== ゲーム選択 ====================

let activeGame = YanivGame; // デフォルトはヤニブ
let selectedGameId = 'yaniv';

/**
 * ゲーム（ヤニブ または ドボン）を選択する
 * @param {string} gameId 
 */
function selectGame(gameId) {
  selectedGameId = gameId;
  activeGame = gameId === 'dobon' ? DobonGame : YanivGame;
  const label = gameId === 'yaniv' ? '🃏 ヤニブ (YANIV)' : '💥 ドボン (DOBON)';
  
  const labelEl = document.getElementById('selected-game-label');
  if (labelEl) labelEl.textContent = label;
  
  showScreen('mode-selection-screen');
}

// ==================== グローバル公開 ====================
// HTML の onclick 属性から呼ばれるため window に登録

window.selectGame     = selectGame;
window.showScreen     = showScreen;
window.hideModal      = hideModal;

// ゲーム共通（activeGame に移譲）
window.showSetup      = (mode) => activeGame.showSetup(mode);
window.selectOpt      = (el, key, val) => activeGame.selectOpt(el, key, val);
window.startGame      = () => activeGame.startGame();
window.confirmQuit    = () => activeGame.confirmQuit();
window.revealHand     = () => activeGame.revealHand();
window.showRules      = () => activeGame.showRules();

// ヤニブ専用
window.selectDeck      = () => YanivGame.selectDeck();
window.selectDiscard   = () => YanivGame.selectDiscard();
window.toggleSelect    = (idx) => {
  if (selectedGameId === 'dobon') {
    DobonGame.toggleDobonSelect(idx);
  } else {
    YanivGame.toggleSelect(idx);
  }
};
window.declareYaniv    = () => YanivGame.declareYaniv();
window.confirmExchange = () => YanivGame.confirmExchange();

// ドボン専用
window.dobonPlayCards  = () => DobonGame.dobonPlayCards();
window.dobonDrawCard   = () => DobonGame.dobonDrawCard();
window.dobonDeclare    = () => DobonGame.dobonDeclare();

// ==================== 初期化 ====================
showScreen('title-screen');
YanivGame.updateNameInputs();