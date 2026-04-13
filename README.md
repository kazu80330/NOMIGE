# NOMIGE — プレミアム・カードゲーム・コレクション

![NOMIGE Logo](./public/images/logo.png)

🎮 **[Live Demo](https://kazu80330.github.io/NOMIGE/)** — ブラウザですぐに遊べます！

**NOMIGE (ノミゲ)** は、カジノのような没入感のある「プレミアムなUI」と、戦略性の高いトランプゲーム「ヤニブ (YANIV)」および「ドボン (DOBON)」を楽しめるWebアプリケーションです。

## ✨ 特徴

- **Premium UI/UX**: ガラスモーフィズム、ゴールドアクセント、フェルト質感のテーブルを採用した、没入感溢れるデザイン。
- **2つのゲームモード**:
  - **ヤニブ (Yaniv)**: 手札の合計を極限まで減らし、タイミングを見極めて「ヤニブ！」と宣言するスリル溢れるゲーム。
  - **ドボン (Dobon)**: 大富豪のルールをベースに、「割り込み計算（ドボン）」による逆転劇が楽しめるエキサイティングなゲーム。
- **AI対戦 & ローカル対人**: 賢いAIとの対戦はもちろん、PC一台で友人と交互にプレイするローカル対戦にも対応。

## 🃏 収録ゲーム

### 1. ヤニブ (Yaniv)
手札の合計値を誰よりも低くすることを目指します。合計が設定値（通常5点または7点）以下になれば「ヤニブ」を宣言。宣言時に他プレイヤーより合計が低ければ勝利、高ければペナルティとなります。

### 2. ドボン (Dobon)
大富豪のルールをベースに、「割り込み計算（ドボン）」による逆転劇が楽しめるエキサイティングなゲーム。
- **初期手札**: 5枚（固定）
- **ソート**: 強さ順（3 < 4 < ... < A < 2 < Joker）に自動整列されます。
- **特殊効果**: 「Jバック（革命）」や「8切り」などを搭載。

## 🛠 技術スタック

- **Core**: Vanilla JavaScript (ESModules)
- **Styling**: Premium Vanilla CSS (Google Fonts: Playfair Display / DM Sans)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Architecture**: 拡張性を重視したゲームエンジン分離設計

## 🚀 セットアップ

### 必要条件
- Node.js (v18以上推奨)
- npm

### インストール & 起動
```bash
git clone https://github.com/yourusername/nomige.git
cd nomige
npm install
npm run dev
```

## 🌐 デプロイ (GitHub Pages)

本プロジェクトは Vite を使用しているため、以下の手順で簡単に GitHub Pages へデプロイできます。

1. `package.json` に `"homepage": "https://yourusername.github.io/nomige"` を追記。
2. `vite.config.js`（未作成の場合は作成）で `base: '/nomige/'` を設定。
3. `npm run build` を実行。
4. `dist` フォルダの内容を `gh-pages` ブランチにプッシュ。

詳細は [Vite のデプロイガイド](https://ja.vitejs.dev/guide/static-deploy.html) を参照してください。

## 📝 開発方針
本プロジェクトは、以下の基準で開発されております：
- **Open Source Readiness**: クリーンなコード、丁寧なコメント（JSDoc）、READMEの充実。
- **Design Excellence**: 1pxの狂いもない美しいUIの実装と、カジノフェルトの質感再現。
- **Security & Privacy**: 機密情報の混入防止、適切な `.gitignore` の設定。

## ⚖️ ライセンス
このプロジェクトは [MIT License](LICENSE) の元で公開されています。
