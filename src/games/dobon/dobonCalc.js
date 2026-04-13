// ==================== DOBON CALCULATION ====================
// 手札の数字の種類数に応じたドボン成否チェック
//
// ルール:
//   2種類以下: 四則演算（+−×÷）で場の数字と一致すればOK（部分集合可）
//   3種類以上: 手札の全合計（足し算のみ）が場の数字と一致すればOK
//
// カード点数: A=1, 2-10=数字, J=11, Q=12, K=13, Joker=0

import { dobonCardValue } from './engine.js';

// 数字の種類数（0除外で計算）
function countDistinctTypes(hand) {
  const vals = new Set(hand.map(dobonCardValue).filter(v => v !== 0));
  return vals.size;
}

// N個の数から四則演算で作れる全ての値を列挙（再帰）
// 計算過程で整数にならない値も通過させ、最終結果を収集する
function allResults(nums) {
  if (nums.length === 1) return [nums[0]];

  const results = [];
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      const a = nums[i];
      const b = nums[j];
      const rest = nums.filter((_, k) => k !== i && k !== j);

      // 四則演算のペアを生成（交換法則を利用して重複排除）
      const pairs = [a + b, a * b];                  // 交換可能
      pairs.push(a - b, b - a);                      // 順序あり
      if (Math.abs(b) > 1e-10) pairs.push(a / b);   // ÷ b
      if (Math.abs(a) > 1e-10) pairs.push(b / a);   // ÷ a

      for (const val of pairs) {
        const sub = allResults([val, ...rest]);
        for (const r of sub) results.push(r);
      }
    }
  }
  return results;
}

// 手札が場の値にドボンできるか
export function canDobon(hand, fieldValue) {
  if (!hand.length) return false;
  if (fieldValue <= 0) return false;

  const vals = hand.map(dobonCardValue);
  const distinctVals = [...new Set(vals.filter(v => v !== 0))]; // Joker除外のランク数値
  const types = distinctVals.length;

  // 3種類以上: 全枚数の単純合計のみ
  if (types >= 3) {
    return vals.reduce((s, v) => s + v, 0) === fieldValue;
  }

  // 2種類: 各ランク数値を1回ずつ使った四則演算 (A op B)
  if (types === 2) {
    const [a, b] = distinctVals;
    const results = [
      a + b, a * b,
      a - b, b - a,
    ];
    if (Math.abs(b) > 1e-10) results.push(a / b);
    if (Math.abs(a) > 1e-10) results.push(b / a);

    return results.some(r => Math.abs(r - fieldValue) < 1e-9);
  }

  // 1種類: その数値が場と一致（1枚出し等のケース含む）
  if (types === 1) {
    return distinctVals[0] === fieldValue;
  }

  return false;
}

// デバッグ用: ドボン成功の式を1つ返す（説明表示用）
export function dobonExplanation(hand, fieldValue) {
  if (!hand.length || fieldValue <= 0) return null;
  const vals = hand.map(dobonCardValue);
  const types = countDistinctTypes(hand);
  if (types >= 3) {
    const sum = vals.reduce((s, v) => s + v, 0);
    if (sum === fieldValue) return `${vals.join('+')}=${fieldValue}`;
    return null;
  }
  // 簡易: 合計一致ならその式を返す（詳細な式生成は省略）
  const n = vals.length;
  for (let mask = 1; mask < (1 << n); mask++) {
    const subset = [];
    for (let i = 0; i < n; i++) {
      if ((mask >> i) & 1) subset.push(vals[i]);
    }
    if (subset.reduce((s, v) => s + v, 0) === fieldValue) {
      return `${subset.join('+')}=${fieldValue}`;
    }
    if (subset.length === 2) {
      const [a, b] = subset;
      if (a * b === fieldValue) return `${a}×${b}=${fieldValue}`;
      if (a - b === fieldValue) return `${a}-${b}=${fieldValue}`;
      if (b - a === fieldValue) return `${b}-${a}=${fieldValue}`;
      if (b && a / b === fieldValue) return `${a}÷${b}=${fieldValue}`;
      if (a && b / a === fieldValue) return `${b}÷${a}=${fieldValue}`;
    }
  }
  return null;
}