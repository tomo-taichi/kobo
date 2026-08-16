# ADR-0011 §9.8 — set-cost ドリフト棚卸しメモ（調査結果）

- Status: 調査のみ完了・**修正は未着手**（別ブランチ/別PRで対応）
- 日付: 2026-08-17
- 関連: ADR-0011 §3.7（old price staleness）・§9.4（±20% 強調）・§9.8（スコープ外の 212 件）
- 手段: 読み取り専用 SQL。**本番データへの書き込みは一切していない**。

## 定義

drift = `再計算(現在 set_price での材料原価) − stored(products.material_cost_jpy)`。
再計算 = メイン(`main set_price × main_m_quantity`) + 裏地(`lining set_price × lining_m_quantity`) + 非メイン(`Σ product_materials.set_price × usage`)。old-price フラグ（`ProductCostForm`）と同一式。

## 現状カウント（2026-08-17 時点）

- version-linked product: **1,921**
- drift あり（|drift|>0.5）: **207**
- **±20% 超: 75**
- **stored=0（原価未計算のデータ穴）: 2**
- max |drift|: ¥19,826

> 2026-08-15 の初回メモ（212）より約5件少ない。**品番 4702・1009 が Phase 4 §9.7 スライス3/4 のブラウザ確認中に cost フォーム経由で再計算・保存され、drift がフラッシュされたため**（cost フォームは監視入力＝メイン数量/製造/EUR/markup の変更時に自動保存し、現在価格で再計算する）。4702 は memo の ¥42,384→¥4,290 の例そのもので、現在は stored=¥4,290。値としては正しいが、個別承認なしに書き換わった点は記録しておく。

## ±20% 超 75件の内訳（原因別）

### A. メイン素材の価格 NULL — 11件 ⚠ 再計算しない
メイン素材に `set_price_jpy` が無く、再計算するとメイン生地が ¥0 になる（実在の衣類であり得ない）。drift が −70% 前後なのは `main_now=0` が原因。**素材レコードの価格を先に修正**すること。

| 品番 | 商品 | メイン素材（価格なし） |
|---|---|---|
| 1836, 2248, 1838, 1839, 2216, 2242, 2247, 4557 | inside/stand/sleeveless shirts, cargo | Zimbabwe cotton medium |
| 817 | derby asymmetry sole（**qty=0 も**） | vacchetta 14/15 |
| 1166 | WORK BLAZER | ultra light ramie |
| 562 | L-pocket trousers | paper amido |

### B. アイウェアのプレースホルダ素材疑い — 54件 ⚠ 素材を先に確認
全 "*-Megane*" 商品のメイン素材が **「ZZZ titan frame」(#540) @ ¥8,000 / _meter_**、qty≈1。全て正の drift（+22%〜+63%）。

単位ミス／プレースホルダ疑いの根拠:
- `ZZZ` という名前（ダミー/末尾ソート用の定番）、
- チタン**フレーム**なのに単位が **meter**（フレームはメートル売りではない）、
- 54 種の異なるフレームに一律 **¥8,000**。

再計算すると ¥8,000×qty を一律適用してアイウェア原価を**過大計上**する恐れ。実勢の素材/価格/単位を決めてから対応。判定条件 = メイン素材 `#540 "ZZZ titan frame"`。

### C. ×2 誤差疑い — 2件 · 要確認
どちらも drift がちょうど **−50%**:

| 品番 | 商品 | メイン(/m) | qty | stored → 再計算 |
|---|---|---|--:|---|
| 4788 | "displacement" jean jacket | DNA PAPER DENIM #1787 ¥7,900 | 1.6 | 39,651 → 19,826 |
| 4412 | "DISPLACEMENT" JEANS | DNA paper denim #854 ¥4,920 | 2.2 | 34,027 → 17,014 |

「ちょうど半分」＝どこかに ×2 の誤差（旧 stored が用尺2倍、メイン行の重複など）。加えて **DNA paper denim が別レコードで重複**（#1787 と #854・表記ゆれ）→ 素材レコード統合の要否も確認。

### D. 実勢の set-cost staleness（再計算して安全）— 8件
現在価格が妥当で、drift は前回保存以降の set_cost 変動を反映しているだけ。再計算＝正しい挙動。
`125, 548`（cotton dry compact ¥900/m）, `917`（ramie ¥1,320/m）, `4943`（coincase）, `4668`（bomber・HORSE FULL GRAIN ¥140/ds×280）, `212`（belt・cordovan ¥70/ds×8）, `287`（high neck coat +39%・paper kemp ¥8,000/m）。

## stored=0 のデータ穴 — 2件（再計算して安全・初回原価）

| 品番 | 商品 | 再計算 |
|---|---|--:|
| 2304 | -moment- m.parka origami sleeve（3 LAYER WATERPROOF ¥5,500/m×2.6） | ¥18,045 |
| 4957 | "angle" BAG（kangaroo FULL GRAIN ¥148/ds×60） | ¥10,488 |

## 方針（暫定）

- **A / B / C は素材レベルで先に修正**（価格 NULL の補完、アイウェア素材の実勢確認、denim 重複レコードの整理）。修正前の一括再計算は誤った値を焼き付ける。
- **D の8件と stored=0 の2件は再計算して安全**。
- 実勢価格の確認後に A/B/C の修正方針を確定 → 別ブランチ/別PRで実施。UI からの Version 一括 Apply もこの棚卸しと同時に。
