# ADR-0011: Model データベースとバージョニング (Model Database & Versioning)

- Status: Draft(要レビュー)
- 日付: 2026-08-10
- 関連: ADR-0009(量産管理システム。ProductionBatch = Model × Main Material × Color)、CONTEXT.md(Model / Model Version / Retail Price / Cost Finalised / Staleness flag / Material)

## 1. 背景・目的

`models` テーブルとルート(`/models`)はスキーマ上は存在するが **空・未使用**で、`products.model_id` も未使用。現状 Product は構成情報(素材・用尺・サイズ・組成・製造コスト・タグ・category・sex)を**すべて自分で直持ち**しており、`model_name` は自由テキストにすぎない。

一方 ADR-0009 は **ProductionBatch を「Model × Main Material × Color」**と定義しており、Model は量産の実行単位の要である。よって Model を「バージョン管理された構成マスター」へ育てることには、次の狙いがある。

- 同名モデル(例: Mountain Parka)の**世代を版で管理**し、Product がどの版を使っているか追跡する。
- 構成を Model 側で**一元管理**し、修正を一箇所で行う。
- 量産・受注が絡む**過去データと価格を保護**しつつ、必要な変更は明示的に行う。

## 2. 用語・エンティティ

CONTEXT.md を正とする。要約:

| エンティティ | 説明 |
|---|---|
| `Model` | アイテムの型。**identity = (name, category)**。sex は identity に含めない(Product 側)。1 Model → 複数 Product。 |
| `Model Version` | 同一 Model の構成の版。**(Model, Season) で一意**(1 シーズン 1 版)。状態: Active → Frozen → Deprecated。前版から copy-forward。前版差分の memo を持つ。 |
| `Product` | 実際の商品。Model + Version を参照し、自身の **production season**・メイン素材/用尺・カラー・価格・sex を持つ。 |
| `ProductionBatch` | Model × Main Material × Color(ADR-0009)。Product 経由で 1 Version に属する。 |

## 3. 決定

### 3.1 Model と Model Version

- Model の identity は **(name, category)**。同名でも category が違えば別 Model。sex は Model では扱わず Product 側に置く(同名 category で sex が混在する実データがあるため。grilling で確認)。
- Model Version は **(Model, Season) で一意**。1 シーズンに複数版は作れない。新シーズンの版は直前の版から **copy-forward** で作る。
- Product は **construction が変わらない限り旧 Version を再利用**する(`Product.season ≥ Version.season`)。構成を変えた新シーズンのみ新 Version を作る。→ 無意味な版の増殖を避け、「版はユーザーが意図的に上げる」を実現。
- 各 Version は**前版からの変更点を記す memo(changelog)**を持つ。

### 3.2 フィールドの所有(どこに何を持つか)

- **Model(identity/属性)**: name, category。tags と manufacturing cost の**既定テンプレート**。
- **Model Version(共有・ライブ)**: メイン以外の Material と用尺(Lining 含む)、Orderable Sizes、Accessories Composition。
- **Product(固有)**: Season(production/order)、Model+Version 参照、**メイン素材と用尺**、カラー、価格、sex、is_sample / is_invalid、`product_number`。category は Model から継承(再入力しない)。
- **例外(Model → Product へ作成時コピー、以後 Product 独立)**: **Tags**(Product ごとに追加・削除可)と **Manufacturing cost**(実データは Product が持ち、実際のメイン素材に応じて編集)。コピー後の Model 側編集は既存 Product に波及しない。

### 3.3 ハイブリッド: 共有レシピ + 確定金額

- **レシピ(構成)は Version 共有・ライブ**: Active 版を編集すると、その版を参照する**量産前 Product に即時反映**。「一箇所で直す」価値を担保。
- **金額(原価・卸/上代)は Product 側に確定値として保持**: Model 編集で過去 Product の価格が自動的に変わることはない。
- 根拠: Model の価値(構成の一元管理)と、過去/受注済み商品の価格保護を両立させる。

### 3.4 バージョンのライフサイクルと Cost Finalised

- 状態遷移: **Active**(編集可・量産前 Product にライブ) → **Frozen**(ある Product の **ProductionBatch 生成=量産開始**で凍結) → **Deprecated**(手動。新規選択不可だが履歴保持)。
- 凍結後に構成を変えるときは**新 Version**(copy-forward)。今後の Product にのみ適用し、量産中 Product は凍結版のまま。
- **量産中への反映は自動では行わない**。必要時のみ手動で新版を該当 Batch に適用し、影響する `material_orders` を「要再確認」フラグにする(最終発注数は手入力のため。ADR-0009)。
- 従来の「cost lock」を **Cost Finalised フラグ**に置き換える。量産開始で自動的に cost-finalised となり、以降その Product の原価は Material set cost 更新に影響されない(スナップショット固定 → 3.5)。ハードな編集ロックではなく、ステータス表示＋自動再計算の抑制。

### 3.5 素材コスト更新の伝播

- Material の raw cost(`unit_price_jpy`)/ set cost(`set_price_jpy`)は**同一レコードを上書き更新**(値上がり時も複製しない)。set cost が原価計算に使われる。
- set cost を更新すると、**Model と量産前 Product の原価・Ideal WS は再計算(ライブ)**。**cost-finalised(量産中)Product はスナップショットを維持**(発注済み=その価格で仕入れたため)。
- **採用 Retail 価格は据え置き**(自動変更しない)。
- (grilling Q10 の選択肢 (Q) を採用。)

### 3.6 Retail Price(ロックしない・ガイド付き)

- Product(**カラー単位**)の採用小売価格は**ロックしない**。各価格の横に**販売数**(その価格で Order に追加された数量)を表示。
- **既存 Order で使われている価格を変更**しようとすると確認ポップアップ(該当 Order を一覧)＋「以下の Order の価格も更新しますか？」Yes / No:
  - **Yes** → 該当 `order_items` の価格を更新。該当 Order の **OC が発行済みなら OC 生成セクションに「Alert(out-of-date)」**を表示。
  - **No** → 既存 Order は据え置き、**新しい価格を追加**(以降の新規 Order に使用)＝実質の価格版管理。
- 既存 Order は発注時に `order_items` に価格を確定済み(過去は原則不変。Yes のときのみ明示更新)。

### 3.7 Staleness flags(陳腐化フラグ)

- **old version**: Product が参照する Model Version が最新でない。
- **old price**: Product の確定原価が、その後更新された Material set cost(メイン素材・モデル素材のいずれか)を反映していない。
- いずれも**自動更新せず**、ユーザーが「今すぐ更新 or 次回から」を判断するための可視化。

## 4. バックアップ → 移行 runbook

**原則: データを絶対に失わない。破壊的操作の前に必ずバックアップ。**

1. **バックアップ(多重・プラン依存)**
   - (a) **In-DB スナップショット**: 影響テーブルをタイムスタンプ付きバックアップテーブルへ複製(`create table <table>_bak_YYYYMMDD as select * from <table>`)。対象: `products`, `product_colors`, `product_materials`, `product_tags`, `orders`, `order_items`, `production_batches`, `material_orders`。同一 DB 内なので即時復元でき、ロールバックの一次手段。
   - (b) **オフサイトの論理ダンプ(必須)**: `supabase db dump`(または `pg_dump`)で**スキーマ＋データの完全ダンプ**を取得し、gitignore 済み `data/` 等 DB 外へ保存。必要なら主要テーブルの CSV/JSON も併用。
   - (c) **プロジェクトレベル・バックアップ(Pro 以上のみ)**: Pro/Team/Enterprise は日次自動バックアップ、加えて **PITR**(有料アドオン)が使える。移行対象プロジェクトが Pro 以上なら、移行直前に日次バックアップの存在確認＋(可能なら)PITR を有効化。**Free プランは自動バックアップ・PITR・ダッシュボード復元がいずれも使えない**(Supabase 公式も Free は `db dump` を推奨)。よって Free では (a)+(b) が実質の安全網。より強い保険が必要なら、**移行ウィンドウだけ一時的に Pro 化して PITR を張る**選択肢もある。
2. **スキーマ追加(マイグレーション。rollback-test 必須・適用前に結果提示)**: `models` に不足列、`model_versions`(model_id, season_id, status, changelog, created_at …、unique(model_id, season_id))、`products.model_version_id`、Retail 価格版・staleness に必要な列/テーブル。
3. **バックフィル(dry-run → 検証 → apply)**: 5.5 のルールで Model / Version を生成し Product を紐付け。競合は**適用せずレポート**。
4. **検証**: 件数・金額(cost/Ideal WS/retail)が移行前後で整合するか、サンプル Product で確認。Retail は不変であること。
5. **ロールバック手順**: 問題時はバックアップテーブルから restore(復元 SQL を runbook に明記)。

## 5. 残実装タスク

### 5.1 商品作成フロー
`Season を選択 → Model を選択 → Version を選択(既定は最新 Active、非 deprecated から選択可) → メイン素材と用尺 → カラー/価格`。Version 選択で category・非メイン素材・サイズ・組成が確定し、tags・mfg は初期値としてコピー(以後編集可)。該当 (Model, Season) の版が無ければ copy-forward で作成。

### 5.2 Model 詳細セクション + 編集リンク + サイドバー
- Product 編集ページに **Model 詳細セクション**(参照中の Model/Version・共有レシピを読み取り表示、`old version` 表示)。
- **「Model を編集」リンク**で Model/Version 編集画面へ遷移。
- サイドバー: **Products の下に「Models」サブメニュー**(Materials → Suppliers と同様の構造)。

### 5.3 Deprecation UX
- Model/Version 一覧・編集から**手動で Deprecate/復帰**。Deprecated 版は新規 Product の選択肢から除外、履歴・既存 Product では引き続き表示。
- Deprecate 時、その版を使う量産中/受注済み Product があれば警告表示(削除ではない)。

### 5.4 OC "out-of-date" アラート
- 3.6 の Yes で `order_items` 価格を更新し、かつ当該 Order の OC が発行済みの場合、**OC 生成セクションに「Alert(out-of-date)」アイコン**＋再生成導線。判定は「OC 発行日時 < 価格最終更新日時」等で行う。

### 5.5 バックフィルの重複排除ルール
- **Model 化**: Product を **(model_name, category)** でグルーピング(sex は無視)。→ 約 707 + category 分岐分。
- **Version 化(recipe signature)**: 各 Model 内で Product を **season 昇順**に走査し、**recipe signature** が変わった時点で新 Version を作る(start_season = その season、status = **Frozen**)。signature が同じなら**旧 Version を再利用**(reuse-until-changed と一致し、版を最小化)。
  - recipe signature = 「非メイン素材(material_color_id + role + usage_amount) の正規化集合」＋「orderable_sizes」＋「accessory_composition」を正規化(ソート)してハッシュ化。
- **紐付け**: 各 Product を一致する Version(signature 一致かつ `start_season ≤ product.season`)へ link。sex・メイン素材・カラー・価格・mfg・tags は Product に残す。Model の tags/mfg 既定は代表 Version からシード(任意)。
- **競合レポート(適用しない)**:
  - **同一シーズン内で同一 Model が複数 recipe** を持つ(= 1 シーズン 1 版の原則に反する歴史データ)→ **手動レビュー**へ(代表を選ぶか、実は別 Model か)。
  - 素材が解決不能な product_materials を含む Product。
  - model_name 空/表記ゆれ。
- dedupe により Duplicate 由来(全体の大半)の同一 recipe は 1 版に集約される見込み。

## 6. トレードオフ・却下案

- **却下: フル・ライブ共有(全フィールドを Model 参照)** — 過去 Product の価格・原価が Model 編集で勝手に動くため。金額は確定保持にした(3.3)。
- **却下: 全フィールド per-product コピー(Model=テンプレのみ)** — 「一箇所で直す」価値が消える。構成は共有・ライブに(3.3)。
- **却下: 代表 Product 1 件から v1 を作る移行** — 同 Model で recipe が異なる Product が潰れる(lossy)。distinct-recipe=Version の保存移行に(5.5)。
- **却下: Retail のハード OC ロック** — 運用が硬直。ロックせずガイド付き(Yes/No)＋ OC アラートに変更(3.6)。
- **却下: Model を Season に内包/Version==Season 厳密** — 変更のないシーズンで無意味な版が増える。reuse-until-changed に(3.1)。
- **material.season を価格軸にする案** — 非メイン素材は概ね season 非依存(ALLSS)であり、season は検索フラグと確認済み。Version は具体レコードに束縛(3.2/3.5)。

## 7. 既知の割り切り・未決事項

- 1 シーズン 1 版の原則は**新規運用ルール**。歴史データが反する場合はバックフィルで競合レポートし手動解決(5.5)。
- Cost Finalised と Retail の更新可否は**別トリガー**(前者=量産開始、後者=編集時ガイド)。統合はしない。
- 価格版・staleness の具体的なスキーマ(履歴テーブル or 列)は実装時に確定。

## 8. フェーズ分割(推奨実装順)

1. スキーマ + バックアップ + バックフィル(dry-run→検証→apply)。
2. Models サブメニュー・一覧・Model/Version 編集(memo、状態遷移)。
3. 商品作成フロー(Season→Model→Version→メイン素材)と Product 編集の Model 詳細セクション。
4. 素材コスト更新の伝播(ライブ再計算＋ cost-finalised スナップショット)と staleness flags。
5. Retail 価格のガイド付き更新(販売数表示・Yes/No・OC out-of-date アラート)。
6. Deprecation UX。
