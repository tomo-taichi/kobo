# KOBO

taichimurakami ブランドの商品管理・受注管理・書類発行・量産管理・タグ印刷を行う業務システム。FileMaker から移行。

## プロジェクト状況（実装優先順位）

- **現在の優先タスク**: **ADR-0009（量産管理システム）** の完成（Brand 側）。これを最優先で進める。
- **Customer Portal（ADR-0008）**: **設計のみ完了・実装は保留中**。Phase 1（Foundation）の計画まで策定済みだが未着手。
- Customer Portal の実装は **ADR-0009 完了後に再開**する予定。
- **ADR-0011（Model DB & versioning）Phase 1 = 本番適用済み**:
  - スキーマ: `model_versions` / `model_version_materials` / `model_tags` / `products.model_version_id`（＋ RLS `is_internal()` ＋ grants）、`models` の identity `unique(name, category)`、`models.gender` は NULL 許容、`model_versions` は **active 限定の部分ユニーク**（frozen は同一 season に複数可、active は 1 season 1 版）、旧 `models.category` CHECK は削除。
  - バックフィル: **Models 714 / Versions 936（全 frozen）/ model_version_materials 2,613 / products 紐付け 1,921**。既存 product の列・データは**無変更**（dual-write。version からの読み替えは未実施）。`model_tags` は空。
  - バックアップ: JSON＋`pg_dump` の二重オフサイトを取得済み（`data/backups/`, gitignore）。
  - **次 = Phase 2（Models 一覧・Model/Version 編集 UI）**。既存 `/models` scaffolding は ADR-0011 以前の旧 Model（`gender` 直持ち・version なし）で ADR と矛盾するため **作り直し**。実装単位:
    1. **スキーマ微追加**（additive）: `models.archived`（bulk Archive 用）、`model_versions.updated_at` の保存時更新。
    2. **定数整理**: `MODEL_CATEGORIES` を撤廃し `PRODUCT_CATEGORIES` に統一、`MODEL_GENDERS` 削除（sex は Product 側）、status/role ラベル追加。
    3. **サイドバー**: Products に `sub:[Models]`（Materials→Suppliers と同型）。
    4. **Models 一覧の作り直し**: checkbox + 全選択 + 検索 + カテゴリ filter + showArchived + `BulkBar`（Archive/Unarchive/Delete。版持ち Model は FK でブロック→件数報告）。行クリックで `/models/[id]`。
    5. **Model 詳細/編集**: 属性（name/category、`(name,category)` 一意）＋既定テンプレート（`model_tags`・製造 template）＋ Version 履歴を season 順に一覧。
    6. **Version 編集**（Product 編集に倣った専用ページ）: 非メイン素材行（`MaterialPickerModal` 再利用・role×material×color×usage）、Orderable Sizes、Accessory Composition、製造時間（時間入力→分保存）、changelog。**frozen 版は読み取り専用**。
    7. **copy-forward 新版作成**: 対象 Season を選び最新版 recipe を複製して `active` 版を生成（バックフィル版は全 frozen のため必須。同 (model,season) に active があれば partial unique でブロック）。
    8. **状態遷移は Deprecate / 復帰のみ**（`setModelVersionStatus`。復帰の既定は `deprecated→frozen`、`active` へ戻すのは同 season に active が無い時のみ）。freeze は Phase 4 の batch 連動、影響 Product 警告は Phase 6。
  - **Phase 2 の非対象**（別フェーズ）: version→Product の live 読み替え・即時反映（Phase 3/4。Phase 2 は master レコード編集に留まる）、作成フロー Season→Model→Version→メイン素材と Product 側 Model 詳細セクション（Phase 3）、素材コスト伝播・staleness（Phase 4）、Retail ガイド更新・OC out-of-date（Phase 5）、Deprecate 時の影響 Product 警告一覧（Phase 6）。
  - **以降**: Phase 3（作成フロー・Product の Model 詳細セクション）→ Phase 4（version 読み替え・cost 伝播・staleness）→ Phase 5（Retail ガイド更新）→ Phase 6（Deprecation UX）。
- **技術的負債（スコープ外・いつか別途対応）**: リポジトリ全体で `eslint` 218 errors のベースライン（大半は `as any` 由来の `@typescript-eslint/no-explicit-any`）。build は eslint を gate しないため、当面のコード変更の受け入れ基準は **tsc + build + vitest**（＋新規 lint エラーを増やさない）。

## 認証

**Account**:
複数アカウント対応。各アカウントは固有の ID（メールアドレス）とパスワードを持つ。Supabase Auth（email + password）で実装する。全アカウントに **User Role** があり **Brand User** か **Customer User** に分かれる（→ User Role）。

**User Role**:
アカウントの種別。**Brand User**（生産側。Brand Portal の全機能にアクセス）と **Customer User**（顧客側。Customer Portal のみ）。`profiles(uid, role, customer_id)` で管理し、Customer User は 1 Customer に 1:1 で紐づく（`customer_id`）。Brand User は `customer_id` なし。
_Avoid_: 「ユーザー＝顧客」（User は Account、Customer は取引先レコード。1 Customer に 1 Customer User）

**Brand Portal**:
現行の業務システム全体（`src/app/(app)`）。Brand User のみアクセス可能。商品・受注・書類・量産・顧客管理など。

**Customer Portal**:
Customer User 向けの顧客専用画面（`src/app/(portal)`）。自社に紐づくデータのみ閲覧・操作できる。データアクセスはサーバ側（service role）で `customer_id` に限定し、顧客の JWT では Brand の各テーブルを直接読めない（各テーブルの RLS を `using(is_brand())` に変更）。

## ホーム画面

**Home Dashboard**:
ログイン後のトップ画面。クライアント（Customer）別に Order Status A〜F の進捗をリマインド表示する。Status が F に達していない未完了 Order を一覧表示し、対応漏れを防ぐ。

## Language

**Season**:
商品・受注を束ねるグループ単位。名前は自由入力だが、命名規則がある：
- **新形式 `YY.1` / `YY.2`**: `YY.1` = 20YY年 **SS**（Spring & Summer）コレクション、`YY.2` = 20YY年 **AW**（Autumn & Winter）コレクション。例: `26.1` = 2026 SS、`26.2` = 2026 AW。
- **旧形式 `YYSS` / `YYAW`**: 例 `14AW` = 2014 Autumn/Winter（2013〜2022頃まで使用）。
- **特殊グループ（季節に依存しない）**: `ALLSS`（= All Season。シーズンを問わず通年で使う Material / Product の登録先）、`委託`（委託販売専用グループ）。
各 Season は `eur_jpy_rate`（EUR→JPY 換算レート）を持つ。
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
アイテムの型（例: Mountain Parka）。**identity = (name, category)**（同名でも category が違えば別 Model。sex は identity に含めない）。1つの Model から複数の Product が派生する。**category は Model が持ち Product は継承**。**sex は Product 側**が持つ（Model では扱わない）。**構成情報**——メイン以外の Material とその用尺（Lining 含む）・Orderable Sizes・Accessories Composition——を **Model Version** 側で共有管理する。ただし例外が2つ（**Tags** と **Manufacturing cost**）：どちらも Model の値を **Product 作成時に初期値としてコピー**（beginning setup）し、以後は **Product 側で独立に編集**する（実際のメイン素材に応じて調整）。Model 側の値は既定テンプレートとして残り、コピー後の Model 編集は既存 Product に波及しない。Tags は Product ごとに追加・削除できる。Product はそれ以外（Season・メイン素材とその用尺・カラー・価格など）を持つ。構成は時間とともに小改良されるため **Model Version** で版管理する。
_Avoid_: Item type

**Model Version**:
同一 Model の構成の「版」。Model 名は変えずに一部仕様（例: ポケット仕様）を改訂した各世代。各 Product は 1 つの Model Version を参照し、どの版を使っているか追跡できる。状態：
- **Active**: 編集可能。編集は同版を参照する**量産前 Product に即時反映（ライブ）**。新規 Product の既定版。
- **Frozen**: 凍結。ある Product の **ProductionBatch 生成（量産開始）** 時に、その版が凍結される。以後その版は編集不可。
- **Deprecated**: 手動。新規 Product では選択不可だが履歴として保持。

凍結後に構成を変えるときは**新しい Version を作成**（copy-forward）し、今後の Product にのみ適用する（量産中 Product は凍結版のまま）。**量産中への反映は自動では行わず**、必要時のみ手動で新版を該当 Batch に適用し、影響する MaterialOrder を「要再確認」としてフラグする（最終発注数は手入力のため）。構成は Version で共有するが、**金額（原価・卸/上代）は Product 側に確定値として保持**し、Model 編集で過去 Product の価格は自動変更されない（→ ADR-0011）。非メイン素材は通常 `ALLSS` の**特定レコードに束縛**し、価格はそのレコード値（season 非依存）。**Version は (Model, Season) で一意**——1 つの Season につき最大 1 版で、同一 Season に複数版は作れない。よって版の履歴＝シーズンの並び。新しい Season の版は直前の版から **copy-forward** で作成する。Product は自身の **production season** を持ち、構成が変わらない限り旧 Version を再利用する（`Product.season ≥ Version.season`、構成を変えた新 Season のみ新 Version を作る）。各 Version は**前版からの変更点を記す memo（changelog）**を持つ。

**Product**:
実際の商品。特定の Season・（メイン）素材・カラー・価格を持ち、1つの Model（の Version）から派生する。全商品の大半は既存 Product の Duplicate（複製）で作成される。
_Avoid_: Item（UIラベルとしては使うが、エンティティ名は Product）

**Retail Price（採用小売価格）**:
Product（カラー単位）の採用小売価格。**ロックはしない**。各価格の横に**販売数**（その価格で Order に追加された数量）を表示する。既存 Order で使われている価格を変更しようとすると**確認ポップアップ**を出す（該当 Order を一覧表示し「以下の Order の価格も更新しますか？」Yes / No）：
- **Yes** → 該当 Order の価格（`order_items`）を更新する。該当 Order の **OC が発行済みなら、OC 生成セクションに「Alert」アイコン**を表示し「OC が最新でない可能性」を知らせる。
- **No** → 既存 Order は据え置き、**新しい価格を追加**して以降の新規 Order に使う（実質の価格版管理）。

既存 Order は発注時に `order_items` に価格を確定済み（過去は原則不変。Yes を選んだ場合のみ明示的に更新される）。

**Cost Finalised（原価確定フラグ）**:
従来の「cost lock」を**フラグ**に置き換えたもの。**量産開始（ProductionBatch 生成）で自動的に cost-finalised** となり、以降その Product の原価は Material set cost の更新に影響されない（スナップショット固定 → Q10 の (Q)）。ハードな編集ロックではなく、ステータス表示＋自動再計算の抑制として働く（必要に応じ手動で finalise / 解除）。

**Staleness flag（陳腐化フラグ）**:
Product に表示する可視化フラグ。**old version** = 参照する Model Version が最新でない。**old price** = 確定原価が、その後更新された Material set cost（メイン素材・モデル素材のいずれか）を反映していない。いずれも**自動更新はせず**、「今すぐ更新するか次回からにするか」をユーザーが判断するための表示（手動＋フラグ方針）。

**Sample**:
`is_sample=true` の Product。受注会で実物を展示するサンプル商品。通常通り Order に追加できる。

**Invalid Product**:
`is_invalid=true` の Product。廃番商品。Order の商品選択画面に表示されない。

**Duplicate**:
既存 Product を複製して新しい Product を作る操作。全商品の83%がこの方法で作成される。`duplicated_from` は「どこからコピーしたか」という履歴のみで、複製元との継続的な同期関係はない。

**Material**:
原材料の総称。Fabric と Accessory Material の2つのサブタイプがある。価格は**レコード単位**で持ち、`season_id` は主に**検索・絞り込み用のフラグ**（同一アイテムがシーズン別に別レコードとして登録され得る）。量産で本当に重要なのは Material の season ではなく **Order の season**。非メイン素材（Lining / 芯地 / 付属など）は通常 season 非依存で `ALLSS` に登録する。raw cost（`unit_price_jpy`）と set cost（`set_price_jpy`）は**同一レコードを上書き更新**する（値上がり時も複製しない）。set cost が原価計算に使われ、更新すると **Model と量産前 Product の原価・Ideal WS が再計算**される。**cost-finalised（量産開始済み）Product はスナップショット固定**で影響を受けない。**採用済み Final Retail は据え置き**（自動変更しない）。（→ ADR-0011）
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
- **製造コスト各種**: 6項目（Cutting / Sewing / Knitting / Thread / Finish / Packing）を **作業時間（時間, 小数点1桁）で入力**（ADR-0009）。金額 = `時間 × 時給`（時給 = `company_settings.labor_rate_jpy_per_hour`、既定 ¥2,000/時、編集可）。DB は `products.*_minutes`（分）で保存し、フォームは時間で編集（保存時に `時間 × 60 = 分`）。`products.*_cost_jpy` は保存時に同期（既存の集計・請求計算はそのまま動く）。ガーメントタイプ別プリセットは**時間**で提供（例: Sewing COAT = 5.0h）。

| プリセット(時間) | TSHIRT | SHIRT | TROUSERS | JACKET | COAT |
|-----------|--------|-------|----------|--------|------|
| Cutting   | 0.25 | 0.5 | 0.5 | 0.75 | 1.0 |
| Sewing    | 0.75 | 2.0 | 3.0 | 4.0  | 5.0 |
| Knitting  | 0.25 | 0.5 | 0.5 | 0.75 | 1.0 |
| Thread    | 0.75 | 2.0 | 3.0 | 4.0  | 5.0 |
| Finish    | 0.25 | 0.5 | 0.5 | 0.75 | 1.0 |
| Packing   | 0.25 | 0.5 | 0.5 | 0.75 | 1.0 |

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
Order の進行状態。Customer Portal から顧客が投稿した Order は **Submitted**（A の前）で始まり、それ以外は A〜F。支払い・書類発行のライフサイクルを追う（量産進捗は別途 Production Progress で管理）。

| Status | 意味 |
|--------|------|
| Submitted | 顧客が Customer Portal で投稿（Brand の検証待ち。`origin=portal`）|
| A | OC 送付済み（Brand が検証・編集して OC 発行 → Submitted から遷移）|
| B | OC 承認受領（Customer Portal で顧客が承認 → A から遷移。Brand 手動設定も可）|
| C | Deposit 支払い確認済み |
| D | Final Invoice 送付済み |
| E | 全額支払い確認済み |
| F | Commercial Invoice 発行済み（＝出荷済み）|

`orders.origin` = `brand`（Brand が作成）| `portal`（顧客が投稿）。全額支払い確認（E）が出荷の前提条件。F に進んだ時点で納品完了。

**Order Submission**:
Customer Portal での顧客による発注。Submit すると Brand Portal の Orders に `status=Submitted` / `origin=portal` で出現。Brand が検証・商品を増減して確定し OC を送付（→ A）。顧客が Customer Portal で OC を承認（→ B）。以降、Deposit が必要な顧客は入金へ（B2B=銀行振込、B2C=クレジット）、不要な顧客は量産完了を待つ。

**Product Lifecycle（商品進捗）**:
Customer Portal で Order 明細（Order 内の product×color 行）ごとに表示する 8 ステップ: PATTERN→CUT→SEW→FIN→READY（Production Progress、product×season）→ Invoiced（`order_items.is_flagged_invoice`）→ Paid（当該明細を含む Final Invoice バッチの入金済みフラグ）→ Shipped（`order_items.is_flagged_delivery`）。Paid は Final Invoice（`order_documents`）単位の入金ステータスから導出する。

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
