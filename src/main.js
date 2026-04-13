import { showScreen, hideModal } from './ui/renderer.js';
import { addDropZone } from './ui/gestures.js';
import * as YanivGame from './games/yaniv/game.js';
import * as DobonGame from './games/dobon/game.js';
import * as HybridGame from './games/hybrid/game.js';

// ==================== ゲーム選択 ====================

let activeGame = YanivGame;
let selectedGameId = 'yaniv';

function selectGame(gameId) {
  selectedGameId = gameId;
  if (gameId === 'dobon') activeGame = DobonGame;
  else if (gameId === 'hybrid') activeGame = HybridGame;
  else activeGame = YanivGame;

  const labels = {
    yaniv:  '🃏 ヤニブ (YANIV)',
    dobon:  '💥 ドボン (DOBON)',
    hybrid: '🃏💥 ヤニブドボン (Hybrid)',
  };
  const labelEl = document.getElementById('selected-game-label');
  if (labelEl) labelEl.textContent = labels[gameId] || labels.yaniv;

  showScreen('mode-selection-screen');
}

// ==================== グローバル公開 ====================
// HTML の onclick 属性から呼ばれるため window に登録

window.selectGame  = selectGame;
window.showScreen  = showScreen;
window.hideModal   = hideModal;

// ゲーム共通（activeGame に移譲）
window.showSetup   = (mode) => activeGame.showSetup(mode);
window.selectOpt   = (el, key, val) => activeGame.selectOpt(el, key, val);
window.startGame   = () => activeGame.startGame();
window.confirmQuit = () => activeGame.confirmQuit();
window.revealHand  = () => activeGame.revealHand();
window.showRules   = () => activeGame.showRules();

// カード選択（ゲームごとに振り分け）
window.toggleSelect = (idx) => {
  if (selectedGameId === 'dobon') DobonGame.toggleDobonSelect(idx);
  else if (selectedGameId === 'hybrid') HybridGame.hybridToggleSelect(idx);
  else YanivGame.toggleSelect(idx);
};

// ヤニブ専用
window.selectDeck      = () => YanivGame.selectDeck();
window.selectDiscard   = () => YanivGame.selectDiscard();
window.declareYaniv    = () => YanivGame.declareYaniv();
window.confirmExchange = () => YanivGame.confirmExchange();

// ドボン専用
window.dobonPlayCards  = () => DobonGame.dobonPlayCards();
window.dobonDrawCard   = () => DobonGame.dobonDrawCard();
window.dobonDeclare    = () => DobonGame.dobonDeclare();

// ハイブリッド専用（action bar 内で直接呼ばれるが念のため公開）
window.hybridPlayCards    = () => HybridGame.hybridPlayCards();
window.hybridDeclareYaniv = () => HybridGame.hybridDeclareYaniv();
window.hybridDobonDeclare = () => HybridGame.hybridDobonDeclare();
window.hybridDrawDeck     = () => HybridGame.hybridDrawDeck();
window.hybridDrawDiscard  = () => HybridGame.hybridDrawDiscard();

// ==================== 初期化 ====================
showScreen('title-screen');
YanivGame.updateNameInputs();

// ドロップゾーン: .center-table に1回だけ設定
// 各ゲームが window.activeDiscardCard をセットして使う
window.activeDiscardCard = null;
const _centerTable = document.querySelector('.center-table');
if (_centerTable) {
  addDropZone(_centerTable, (idx) => window.activeDiscardCard?.(idx));
}
