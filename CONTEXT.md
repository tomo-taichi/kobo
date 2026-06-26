# KOBO

taichimurakami ブランドの商品管理・受注管理・書類発行・量産管理・タグ印刷を行う業務システム。FileMaker から移行。

## 認証

**Account**:
複数アカウント対応。各アカウントは固有の ID（メールアドレス）とパスワードを持つ。Supabase Auth（email + password）で実装する。

## ホーム画面

**Home Dashboard**:
ログイン後のトップ画面。クライアント（Customer）別に Order Status A〜F の進捗をリマインド表示する。Status が F に達していない未完了 Order を一覧表示し、対応漏れを防ぐ。

## Language

**Season**:
商品・受注を束ねるグループ単位。実際の季節コレクション（例: "26.2" = 2026年第2コレクション、"14AW" = 2014 Autumn/Winter）だけでなく、通年商品用の特殊グループ（"ALLSS"）や委託販売専用グループ（"委託"）も含む。名前は自由入力。
_Avoid_: Collection（コレクションは Season の一種に過ぎない）

**Order**:
顧客との受注契約。1件の取引を表す。旧FileMakerでは "Invoice" と呼ばれていた。1つの Order から複数の Invoice（書類）が発行される。
_Avoid_: Invoice（Invoice は Order から発行される書類を指す）

**Invoice**:
Order から発行される書類。OC（Order Confirmation）・Deposit Invoice・Final Invoice・Commercial Invoice の4種がある。PDF として出力・送付される。PDF テンプレートあり。
_Avoid_: Order

**Final Invoice**:
顧客への支払い請求書類。PDF タイトルは JPY 顧客向け「請求書」/ EUR 顧客向け「Invoice」（言語は currency で決まる → ADR-0006）。日本向けは**適格請求書（インボイス制度）**として扱い、発行事業者の**登録番号**（`company_settings.registration_no`, T+13桁）を記載する。消費税額は基準×税率と整合（円単位、ADR-0003）。発行日・支払期限も記載。
_Avoid_: ファイナルインボイス（PDF 表記は「請求書」/「Invoice」）

**Commercial Invoice**:
出荷時に発行する書類。**通貨で出し分ける**: EUR 顧客向けは Commercial Invoice（英語・税関用書類: 製品名・数量・素材・原産国など）、JPY 顧客向けは納品書（日本語・製品名・サイズ・上代/下代など）。Split Invoice の場合は該当バッチの商品のみ記載。
_注_: 旧ルールは group_type==="Domestic" のみ納品書だったが、Customer/Personal（JPY）も日本語の納品書に含めるため通貨ベースに統一。

**Document Language（書類の言語）**:
顧客向け PDF（OC・Advance Invoice・Final Invoice・納品書/Commercial Invoice）の言語は **`customers.currency` で決まる**: `JPY` = 日本語、`EUR` = 英語。言語と書類種別（納品書/Commercial Invoice）は同じ currency 軸で揃う。言語は「数値の通貨」とは別概念だが、判定キーは同じ currency を使う（EUR 建ての日本人顧客は英語書類になる点に留意）。社内の Web UI は言語切替なしで常に英語。
_Avoid_: 「日本人顧客」を group_type で判定すること（言語は currency で判定する）

**OC（Order Confirmation）**:
受注確認書。商品リスト（Product名・カラー・数量）・Retail 価格・Wholesale 価格の両方を表示する。EUR 建てと JPY 建ての2パターンで発行可能（`Invoice Currency Type` に準じる）。Deposit 金額も記載。

**Model**:
アイテムの型。カテゴリ（coat/jacket など）と性別（men/women/unisex）を持つマスターデータ。285件。1つの Model から複数の Product が派生する。
_Avoid_: Item type, Template

**Product**:
実際の商品。特定の Season・素材・カラー・価格を持つ。2,966件。全商品の83%は既存 Product の Duplicate（複製）で作成される。
_Avoid_: Item（UIラベルとしては使うが、エンティティ名は Product）

**Sample**:
`is_sample=true` の Product。受注会で実物を展示するサンプル商品。通常通り Order に追加できる。

**Invalid Product**:
`is_invalid=true` の Product。廃番商品。Order の商品選択画面に表示されない。

**Duplicate**:
既存 Product を複製して新しい Product を作る操作。全商品の83%がこの方法で作成される。`duplicated_from` は「どこからコピーしたか」という履歴のみで、複製元との継続的な同期関係はない。

**Material**:
原材料の総称。Fabric と Accessory Material の2つのサブタイプがある。
_Avoid_: 素材（日本語 UI ラベルとしては使うが、エンティティ名は Material）

**Fabric**:
Material のうち category が woven/knitted/leather のもの。生地。混率（Composition）を持つ。Main・Lining など構造的な product_data グループにのみ使用可能。
_Avoid_: Material（Fabric は Material のサブタイプ）

**Accessory Material**:
Material のうち category が accessory/eyewear/other のもの。ボタン・ジッパー・タグなど。混率を持たない。accessory_parts・accessory_tag グループにのみ使用可能。
_Avoid_: Accessory（単体では曖昧。Accessory Material と明示する）

**Size**:
サイズ体系: 1・2・3・4・5・6・7・8・9・10・Free の11種。Product 自体はサイズを持たない（1 Product = 1レコード）。Order 時にサイズ×数量のグリッドで入力する。`order_items` に1商品×サイズ分の行を持つか、別テーブル（`order_item_sizes`）でサイズごとの数量を管理する。

**Material Unit**:
Material マスタは単価（JPY）と単位を持つ。単位はその素材によって異なる（メートル・個数・ds など）。Product 作成時に Material マスタから素材を選択し、使用量を入力すると素材コスト（単価 × 使用量）が自動計算される。

**Supplier**:
生地・副資材の仕入先。Material マスタに紐づく（1 Material → 1 Supplier）。Supplier は名前と連絡先を持つ。支払い条件は管理しない。

**Composition（混率）**:
タグ印刷用の素材混率。選択式（自由入力ではない）。既存 FileMaker の形式をそのまま継承（半角カタカナ＋英語、例: `ｶｼﾐｱ-cashmere 100%`）。最大5つまで管理: `composition_a`〜`composition_e`。タグ印刷時は入力されている数だけ列として表示（2つなら2列、5つなら5列）。

**Tag（タグ）**:
2種類のタグを別 PDF として出力する: **製品タグ**（ブランド・品番・サイズ・Cleaning Instruction などを記載）と**混率タグ**（Composition を記載）。詳細なデザイン・項目は仕様書および別途相談で決定する。

**Cleaning Instruction**:
商品ごとに手動設定するケアラベル区分（A〜E/NA）。素材から自動導出はしない。

## 価格体系

**Cost（原価）**:
商品原価は JPY で管理。以下の合計が `products.cost_jpy` に自動計算・保存される:
- **素材コスト**: `product_materials` の（単価 × 使用量）の合計（自動計算）
- **製造コスト各種**: 以下6項目を選択式で入力（0円も可）。選択肢はガーメントタイプ別の固定金額（JPY）:

| コスト項目 | TSHIRT | SHIRT | TROUSERS | JACKET | COAT |
|-----------|--------|-------|----------|--------|------|
| Cutting   | 500    | 1,000 | 1,000    | 1,500  | 2,000 |
| Sewing    | 1,500  | 4,000 | 6,000    | 8,000  | 10,000 |
| Knitting  | 500    | 1,000 | 1,000    | 1,500  | 2,000 |
| Thread    | 1,500  | 4,000 | 6,000    | 8,000  | 10,000 |
| Finish    | 500    | 1,000 | 1,000    | 1,500  | 2,000 |
| Packing   | 500    | 1,000 | 1,000    | 1,500  | 2,000 |

EUR 換算レートはデフォルト 130（選択式・変更可）。`cost_eur` = `cost_jpy ÷ cost_eur_rate`。

**Ideal Wholesale Price**:
`wholesale_eur` = `cost_eur × markup_rate`。`markup_rate` デフォルト 3.0（手入力で変更可）。Order 時にスナップショットとして `order_items.wholesale_price_eur` に保存される。**参考値**（コスト画面の UI ラベルは "Ideal WS (EUR)"）として表示されるが、実際の請求単価ではない。

**Retail Price**:
`retail_price_eur` は**手入力で設定する最終小売価格**で、**Order が採用する価格**。コスト画面では参考値 **Retail (ref) = Ideal WS (EUR) × `retail_rate`**（"Retail Margin Rate"、デフォルト 3.5）を表示し、「use ref」ボタンで取り込めるが、実値はあくまで手入力が正（自動上書きしない）。Product テーブルは EUR のみ保持。Invoice 発行時に Order の換算レートで JPY 金額を算出する。Invoice の合計金額は `retail_price_eur × 数量` の合計を基準に計算し、そこから `discount_rate` を適用してその Order の実際の請求額を決める。
_注_: 旧仕様の手入力 `set_ws_price_eur`（"SET WS PRICE"、retail = set_ws × retail_rate）は廃止し列も削除。retail は手入力マスターに一本化。

**Customer Wholesale Price**:
顧客に実際に請求する商品単価。`order_items.customer_wholesale_eur` = `retail_price_eur × (1 - discount_rate)`。Order 確定時に計算・保存し、Invoice PDF の単価表示に使用する。
_Avoid_: Wholesale Price（単体では Ideal Wholesale と混同する）

**Discount Rate**:
Order 単位で設定する retail 価格からの割引率。請求額 = `subtotal_retail_eur × (1 - discount_rate)`。全顧客グループで同じ計算式を使う。Domestic/Overseas（B2B）は標準 WS 率、Customer（B2C）は 0%（= retail 価格）、Personal は最大 100%（無償）も可。
_Avoid_: Wholesale discount（Discount は retail からの割引であり、wholesale価格自体の変更ではない）

**Exchange Rate**:
EUR → JPY の換算レートは Order ごとに手動入力。市場レートの自動取得はしない。`JPY+EUR` 併記の請求書発行時にこのレートを使って JPY 金額を算出する。

**Invoice Currency Type**:
Invoice の表示通貨。`EUR`（海外バイヤー向け）・`JPY`（国内向け）・`JPY+EUR`（EUR で受注したが JPY 請求書も必要なクライアント向けに両方併記）の3種。

**Split Invoice**:
1つの Order を複数回に分けて Final Invoice / Commercial Invoice を発行すること。`order_items` に2つの独立したフラグを持つ:
- `is_flagged_invoice` — この商品を次の Final Invoice に含める
- `is_flagged_delivery` — この商品を次の Commercial Invoice（納品）に含める

フラグは別々に管理し、請求と出荷のタイミングがずれる場合に対応する。`orders.invoice_count` で分割連番を管理する。Order Status は手動管理: 全バッチの請求完了で D、全額支払い確認で E、最後の Commercial Invoice 発行で F。途中バッチごとにステータスは変えない。

**Invoice Type**:
Order の種別フラグ。`Original`（通常受注、大多数）・`Additional`（追加オーダー）・`委託`（委託販売）・`Revised`（修正）・`Copy`（参考用コピー）・`Not_in_Use`（無効）。

## Order ステータス

**Order Status**:
Order の進行状態を A〜F で表す。支払い・書類発行のライフサイクルを追う（量産進捗は別途 Production Progress で管理）。

| Status | 意味 |
|--------|------|
| A | OC 送付済み |
| B | クライアントから OC 承認受領 |
| C | Deposit 支払い確認済み |
| D | Final Invoice 送付済み |
| E | 全額支払い確認済み |
| F | Commercial Invoice 発行済み（＝出荷済み）|

全額支払い確認（E）が出荷の前提条件。F に進んだ時点で納品完了。

## 顧客分類

**Customer Group Type**:
顧客の取引形態を4種に分類。

| Group | 意味 | 価格 |
|-------|------|------|
| Domestic | 国内B2B（受注会参加バイヤー） | Wholesale |
| Overseas | 海外B2B（受注会参加バイヤー） | Wholesale |
| Personal | 家族・友人 | 個別 |
| Customer | B2C（オンライン受注、受注会非参加） | Retail（discount=0%） |

## 量産管理

**Production Progress**:
商品単位（product_id × season_id）で管理する量産進捗。5ステージを順番に進む。

| ステージ | 意味 |
|----------|------|
| PATTERN | パターン（型紙）作成完了 |
| CUT | 裁断完了 |
| SEW | 縫製完了 |
| FIN | 仕上げ（プレス・検品など）完了 |
| READY | 出荷準備完了 |

各ステージは全数完了でフラグを立てる（部分完了は管理しない）。

**Material Order**:
シーズン単位の生地発注管理。`total_usage`（全受注の使用量合計、自動計算）から `sample_remaining`（サンプル残、手入力）を差し引いた分が量産に必要な発注量の基準となる。実際の `order_qty` は端数調整などを考慮して手入力で確定する。

**Deposit Terms**:
顧客の支払い方式。`Deposit_and_Production`（デポジット＋残額の2回払い）と `Production_Only`（全額を納品前一括払い）の2種。海外バイヤーは前者が多い。

**Deposit Amount**:
合計金額の 30%（デフォルト）。Order ごとに手動変更可。端数は切り捨て: JPY は10円単位（例: 13,334.12円 → 13,330円）、EUR は1ユーロ単位（例: 1,234.14€ → 1,234€）。
