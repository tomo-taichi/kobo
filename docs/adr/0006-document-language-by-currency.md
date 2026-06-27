# 顧客向け書類の言語・出荷書類種別は customer currency で決める

> **状態: Superseded by [ADR-0007](0007-explicit-document-language-and-customer-type.md)。** 言語は currency 導出から **明示の `language` 設定**に変更。currency は **金額表示＋出荷書類フォーマット（納品書/Commercial Invoice）** の判定に限定する。以下は歴史的経緯として残す。

## 決定

顧客向け PDF（OC・Advance Invoice・Final Invoice・納品書/Commercial Invoice）の **言語** と、出荷書類の **種別**（納品書 か Commercial Invoice か）を、`customers.currency` で判定する:

- `JPY` → 日本語 + 納品書
- `EUR` → 英語 + Commercial Invoice（税関用）

社内 Web UI は言語切替を持たず常に英語。

## 背景・トレードオフ

「日本人顧客向けの書類のみ日本語、それ以外は英語」が要件。判定キーの候補は3つあった:

- **group_type**（Domestic/Overseas/Personal/Customer）— 旧実装は `group_type==="Domestic"` のみ日本語/納品書。しかし Customer（B2C）・Personal（家族友人）も日本人なのに英語になり、要件と矛盾していた。
- **billing_country === "Japan"** — 最も「日本人」に忠実だが、未入力だと判定不能。
- **currency**（採用）— 金額表示の通貨と同じ軸で言語・書類種別が揃い、判定が1か所に集約される。

currency を採用。group_type ベースの旧ルール（Domestic のみ納品書）はこれで置換される。

## 既知の割り切り

言語は本来「金額の通貨」とは別概念だが、判定キーを currency に一本化したため、**EUR 建ての日本人顧客は英語書類になる**（`JPY+EUR` 併記ニーズのクライアント等）。この組み合わせは稀との判断で許容する。必要になれば billing_country や明示フラグへの切替を再検討する。

なお Payment Term の**文面**は group_type 固有の商習慣（Domestic=月末締め / Customer=受注生産 / Overseas=デポジット / Personal=なし）なので group_type 基準のまま。言語(currency)とズレる縁辺ケース（例: EUR 建ての Customer）は許容。
