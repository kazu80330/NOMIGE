// ==================== CARD GESTURE UTILITIES ====================
// スワイプ・ドラッグ&ドロップで手札を捨てるためのユーティリティ

const SWIPE_MIN_Y   = 55;   // 上方向への最小移動量 (px)
const SWIPE_STEEPNESS = 1.2; // |dy|/|dx| の最小比率（斜め方向を排除）

/**
 * カード要素にドラッグ開始とタッチスワイプ上方向を追加する
 * @param {HTMLElement} el  - カード要素
 * @param {number}      idx - 手札インデックス
 * @param {{ onSwipeUp?: (idx:number)=>void }} callbacks
 */
export function addCardGestures(el, idx, { onSwipeUp } = {}) {
  // ドラッグ
  el.setAttribute('draggable', 'true');
  el.addEventListener('dragstart', e => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
    // ghost image が描画された後に半透明化
    requestAnimationFrame(() => el.classList.add('card-dragging'));
  });
  el.addEventListener('dragend', () => el.classList.remove('card-dragging'));

  // タッチ スワイプ上方向
  let sy = 0, sx = 0;
  el.addEventListener('touchstart', e => {
    sy = e.touches[0].clientY;
    sx = e.touches[0].clientX;
  }, { passive: true });
  el.addEventListener('touchend', e => {
    const dy = e.changedTouches[0].clientY - sy;
    const dx = e.changedTouches[0].clientX - sx;
    if (dy < -SWIPE_MIN_Y && Math.abs(dy) >= Math.abs(dx) * SWIPE_STEEPNESS) {
      onSwipeUp?.(idx);
    }
  }, { passive: true });
}

/**
 * 要素をカードのドロップゾーンにする
 * @param {HTMLElement} el
 * @param {(idx: number) => void} onDrop
 */
export function addDropZone(el, onDrop) {
  el.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    el.classList.add('drop-zone-active');
  });
  el.addEventListener('dragleave', e => {
    if (!el.contains(e.relatedTarget)) {
      el.classList.remove('drop-zone-active');
    }
  });
  el.addEventListener('drop', e => {
    e.preventDefault();
    el.classList.remove('drop-zone-active');
    const idx = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!isNaN(idx)) onDrop(idx);
  });
}
