# 顧客分類を B2B/B2C に再編し、書類言語を currency から切り離す

> **状態: Accepted。** [ADR-0006](0006-document-language-by-currency.md) を置換する。

## 決定

顧客モデルを次のように再編する。

1. **Customer Type = B2B | B2C**（旧 `group_type` の Domestic/Overseas/Personal/Customer を置換）。
   - 移行: Domestic/Overseas → **B2B**、Customer/Personal → **B2C**。
   - 国内/海外の区別は Customer Type に持たせない（currency・language・billing_country で表現）。
2. **B2C には `is_vip` フラグのみ**（Personal/General の下位区分は作らない）。家族・友人は「Deposit なし＋手入力割引」で表現する。
3. **Document Language（`language` = en | ja）を顧客に明示設定**。これが **OC / Advance Invoice / Final Invoice** の本文・タイトル言語を決める（請求書↔Invoice）。
4. **出荷書類の種別とフォーマットは currency で決める**: `JPY` → 納品書（日本語固定）、`EUR` → Commercial Invoice（英語固定）。出荷書類は Language の影響を受けない（ネイティブ言語固定）。
5. **価格表示は Customer Type で決める**: B2B = Wholesale（OC は Retail 参考も併記、納品書は上代+下代）、B2C = Retail のみ（納品書は下代を出さない）。B2C に Wholesale の概念はない。
6. **Discount のソースは Type 別**: B2B = Order 手入力（合計金額で変動）、B2C VIP = 顧客 preset `default_discount_rate` が Order を補完、B2C 非VIP = 0%。
7. **Deposit**: 顧客に `deposit_required`（あり/なし）と `default_deposit_rate`（既定 B2B 30% / B2C 100%）。Order に反映・編集可。
8. **Portal Access**: `portal_access` フラグ。既定 = B2B または (B2C かつ VIP)、手動上書き可。B2B Portal 本体は別スコープ。
9. **`JPY+EUR` 両建て表示は廃止**。currency は EUR | JPY のみ。

## 背景・トレードオフ

ADR-0006 は「日本人顧客のみ日本語」という要件を currency 一本で近似していたが、(a) EUR 建ての日本人顧客が英語書類になる、(b) 言語と通貨が本来別概念、という割り切りを抱えていた。今回、言語を**明示フィールド**に分離することでこの歪みを解消する。

一方、**出荷書類の種別（納品書 vs Commercial Invoice）は currency 起点のまま**にした。納品書は国内向け・Commercial Invoice は税関用という性質の違いがあり、これは「金額通貨＝出荷先が国内か海外か」とほぼ一致するため。種別と本文言語で判定軸が分かれる（currency と language）が、両テンプレートはネイティブ言語固定にすることで「英語の納品書」「日本語の Commercial Invoice」という不自然な組み合わせを作らない。

Customer Type を B2B/B2C の2値に潰したのは、国内/海外や VIP/家族友人といった軸を**別フィールド（currency・language・is_vip・deposit）に分解**して直交させるため。旧 group_type は分類軸が混在していた。

## 既知の割り切り

- **Language と出荷書類種別がズレる縁辺ケース**を許容する。例: `currency=JPY` かつ `language=en` の顧客は、OC/Invoice は英語だが出荷書類は日本語固定の納品書になる。稀との判断。
- **Payment Term の文面**は旧 group_type 固有だったが、再編後は Customer Type（B2B/B2C）＋ `deposit_required` を基準に出し分ける。
- B2C は基本 Deposit 100%（全額前金）のため、通常 Final Invoice の残額請求は発生しない。Deposit なし B2C（家族友人）は納品前一括。
- **B2B Portal は本 ADR のスコープ外**。`portal_access` フラグのみ先行して持ち、認証・直接オーダーの設計は別途。
