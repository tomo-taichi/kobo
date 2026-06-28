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
顧客への支払い請求書類。PDF タイトルは「請求書」（Japanese）/「Invoice」（English）で、**Document Language で決まる**（→ ADR-0007）。日本向けは**適格請求書（インボイス制度）**として扱い、発行事業者の**登録番号**（`company_settings.registration_no`, T+13桁）を記載する。消費税額は基準×税率と整合（円単位、ADR-0003）。発行日・支払期限も記載。
_Avoid_: ファイナルインボイス（PDF 表記は「請求書」/「Invoice」）

**Commercial Invoice**:
出荷時に発行する書類。**currency で出し分ける**: EUR → Commercial Invoice（英語・税関用: 製品名・数量・素材・原産国など）、JPY → 納品書（日本語・製品名・サイズ・上代/下代など）。Commercial Invoice は **Ship-To（顧客の shipping address）を記載**し、**Shipping Address が未完成だと発行できない**（→ Address Completeness）。**B2C の納品書は下代（Wholesale）列を出さず上代（Retail）のみ**表示する。Split Invoice の場合は該当バッチの商品のみ記載。

**Address Completeness（住所の完備）**:
住所は **address + city + postcode + country** が揃って「complete」。**Billing 未完成 → Final Invoice / Advance Invoice 発行不可**、**Shipping 未完成 → Commercial Invoice 発行不可**（OC・納品書は対象外）。`shipping_same` の場合 shipping は billing をコピーするので billing が完成すれば shipping も完成。Customer Detail の各住所セクションに Complete/Incomplete を表示し、書類生成ボタンを無効化＋サーバ側でも拒否する。

**Document Language（書類の言語）**:
顧客ごとに **English / Japanese を明示設定**（`customers.language`）。これが **OC・Advance Invoice・Final Invoice** の本文・タイトル言語（請求書↔Invoice 等）を決める。出荷書類（納品書/Commercial Invoice）はネイティブ言語固定で Language の影響を受けない（納品書=日本語固定、Commercial Invoice=英語固定）。Language は currency とは独立した別軸（ADR-0007 が ADR-0006 を置換）。社内 Web UI は常に英語。
_Avoid_: 言語を currency から導出すること（明示の language 設定で決まる）

**OC（Order Confirmation）**:
受注確認書。商品リスト（Product名・カラー・数量）と価格を表示。**B2B は Retail（参考）と Wholesale の両方**、**B2C は Retail のみ**（Wholesale 非表示）。Deposit 金額も記載。本文言語は Document Language に従う。

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
Order 単位で設定する retail 価格からの割引率。請求額 = `subtotal_retail_eur × (1 - discount_rate)`。全 Customer Type で同じ計算式。割引率のソースは Type 別: **B2B = Order ごとに手入力**（合計金額で変動／交渉）、**B2C VIP = Customer の preset `default_discount_rate` が Order を自動補完**（編集可）、**B2C 非VIP = 0%**（家族友人など手入力で最大100%も可）。
_Avoid_: Wholesale discount（Discount は retail からの割引であり、wholesale価格自体の変更ではない）

**Exchange Rate**:
EUR → JPY の換算レートは Order ごとに手動入力。市場レートの自動取得はしない。`JPY+EUR` 併記の請求書発行時にこのレートを使って JPY 金額を算出する。

**Invoice Currency Type**:
Invoice の表示通貨。`EUR`（海外バイヤー向け）・`JPY`（国内向け）の2種。顧客の `currency` が既定を決め、JPY なら納品書フォーマット＋¥表示。
_注_: 旧 `JPY+EUR`（両建て併記）は廃止。

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

**Customer Type**:
顧客の取引形態。**B2B** か **B2C** の2種（旧 group_type の Domestic/Overseas/Personal/Customer を置換）。

| Type | 対象 | PDF 価格表示 | Discount | Deposit 既定 | Portal |
|------|------|-------------|----------|-------------|--------|
| B2B | 受注会バイヤー（国内・海外問わず） | Wholesale | Order ごとに手入力（合計金額で変動） | 30% | アクセス可 |
| B2C | 一般顧客・オンライン・家族友人 | Retail のみ（Wholesale 概念なし） | 0%（VIP は preset、家族友人は手入力で最大100%） | 100% | VIP のみ可 |

国内/海外の区別は Customer Type には持たせず、currency・Document Language・billing_country で表現する。
_Avoid_: Customer Group Type / group_type（廃止。Domestic/Overseas→B2B、Customer/Personal→B2C に移行）

**VIP**:
B2C 顧客のフラグ（`is_vip`）。VIP は (1) Customer Detail で設定する preset の割引率（`default_discount_rate`）を持ち Order の discount を自動補完する、(2) B2B Portal へのアクセス権を持つ。非 VIP の B2C は割引 0%（retail）。
_Avoid_: B2C の下位カテゴリ（Personal/General という区分は持たない。家族友人は「Deposit なし＋手入力割引」で表現する）

**Portal Access**:
B2B Portal（顧客が直接オーダーできるサイト。別スコープ）へのアクセス可否フラグ（`portal_access`）。既定は B2B または (B2C かつ VIP) = true だが、顧客ごとに手動上書き可。

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
顧客ごとの Deposit あり/なしトグル（`deposit_required`）。あり=`Deposit_and_Production`（デポジット＋残額の2回払い）、なし=`Production_Only`（納品前一括、Deposit 0）。この設定が Order に反映される。

**Deposit Amount**:
合計金額 × `deposit_rate`。`deposit_rate` の既定は Customer Type 別（**B2B 30% / B2C 100%**）で、Customer の `default_deposit_rate` が Order を補完（Order ごとに編集可）。Deposit なしの顧客は 0。端数は切り捨て: JPY は10円単位（例: 13,334.12円 → 13,330円）、EUR は1ユーロ単位（例: 1,234.14€ → 1,234€）。
_注_: B2C は基本 100%（全額前金）のため、通常は残額請求（Final Invoice の balance）が発生しない。
