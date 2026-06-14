# 請求書まわり仕様 — 通貨 / バージョン管理 / バッチ納品 / Payment Log 連携

2026-06-14 に `/grill-me` 2回で確定した、OC・Deposit Invoice・Final Invoice・Commercial Invoice・Delivery Note の仕様。実装の正準リファレンス。Payment Term の `group_type` 別出し分けは実装済み(`src/lib/pdf/labels.ts` `buildPaymentTerms`)。

## 用語 / データ
- 通貨判定元 = **`customers.currency`**(EUR/JPY)。`orders.currency_type` は無視。為替レート = `orders.exchange_rate`(Season レートのスナップショット)。
- Payment Log = **`customer_payments`**(debit/credit のレジャー、`order_id`・`amount`・`currency`・`entry_date`・`note`)。
- `customers.bank` ∈ {WISE_EU, Rakuten_JP}。`customers.group_type` ∈ {Domestic, Overseas, Personal, Customer}。

## A. 通貨表示(前半グリル + 2026-06-14 改訂)
- 税率は **`customers.tax_included`** 由来（true=10% / false=0%）。`is_tax` は廃止（フォームは tax_included を書き込む）。OC は `customers.tax_included` から直接導出。
- **EUR 顧客**: 全て € のまま(換算なし)。単価・行合計・Subtotal・Tax・Total すべて €。
- **JPY 顧客**: 単価(卸/小売)・行合計・Subtotal(Retail/Wholesale) は **€ のまま**。そこから:
  - Subtotal(Wholesale) を **€→¥ 換算**（floor 1,000）= `subWholesaleJpy`
  - **Tax は ¥ で計算** = floor(subWholesaleJpy × taxRate / 1000)×1000
  - **Total = subWholesaleJpy + taxJpy、¥ のみ表示**
  - 換算レート = `orders.exchange_rate`、全 JPY 金額は **1,000円未満切り捨て**
- **為替レートは書類に表示しない**(Deposit/Final の既存 "Exchange Rate" 行も削除)。
- Final Invoice(JPY)下部 = **€ 小計 +（Less: Deposit）+ ¥ Balance Due**。
- Financials ワークシートも同じ JPY-first 計算。JPY 顧客は Total 行を ¥ のみ表示（€/¥ 併記は他行のみ）。stored `deposit_amount_jpy` も JPY-first。

## B. Bank Details(Deposit / Final のみ)
- `company_settings.bank_wise_eu` / `bank_rakuten_jp`(複数行テキスト、編集可)に保持。`customers.bank` で出し分け。null なら非表示。グレー "BANK DETAILS:" ヘッダ + 本文。
- WISE_EU(英語) / Rakuten_JP(日本語)の本文は画像のとおり seed。

## C. バージョン管理 & ログ
- 生成ごとに version 行追加。**`version_label = YYMMDD_vNN`**(YYMMDD = そのバージョン作成日、vNN = 論理ドキュメントごとの通番)。
- **vNN は論理ドキュメント(バッチ)ごとに v01 から**。OC/Deposit は order あたり1論理。Final/Commercial/Delivery はバッチごとに別論理(seq_no)。
- Storage はバージョン込みパスで保存(上書き禁止)。PDF Documents ページで全ドキュメント・全バージョンを一覧 & 再 Download 可能。

## D. Deposit Invoice
- 生成時ポップアップで **Deposit Payment Deadline**(デフォルト = 作成日 + 7日、編集可)。PDF に「お支払い期限 / Payment Deadline: YYYY/MM/DD」表示、`order_documents` に保存。

## E. Batch 納品(Final / Commercial / Delivery)
- 生成時ポップアップで対象 `order_items` を複数選択 → `item_ids` 保存。
- 「処理済み」= 同 doc_type の過去ドキュメントの item の和集合 → ポップアップで除外/グレーアウト。**doc_type ごとに独立**追跡。
- 生成時に **「新規請求」/「既存請求の改訂」** を選択。
  - 新規 = 未処理 item から選択 → 新しい論理ドキュメント(Deposit/Final は debit 1件 + v01)。
  - 改訂 = 過去の論理ドキュメントを選び新バージョン追加。金額変更時のみ debit 同期(新 debit なし)。

## F. Payment Log 連携 & Deposit 差引
- `customer_payments` に **`category`**(deposit / balance / other)追加。
- Deposit/Final 発行で **debit を自動記録**(改訂では同期、重複なし)。入金は手動 credit + category。
- **Deposit 自動 debit = デポジット額**。**Final 自動 debit = ネット(バッチ商品額 − 充当デポジット = Balance due)**。→ 総 debit = 総商品額 で整合(確認済み)。
- **Final の Deposit 差引** = 当該 order の `category=deposit` credit 合計を**プールとして順次消費**。各 Final = バッチ請求額 − 未充当デポジット残(上限)。過去 Final の充当額を集計し二重/漏れなし。単一出荷なら全額差引。
- **Commercial Invoice / Delivery Note は customer_payments に debit を作らない**(税関/納品用、AR 請求は Final が担う。確認済み)。バージョン管理 + item 選択のみ。

## スキーマ(予定)
```
order_documents(論理): id, order_id, doc_type(oc|deposit|final|commercial|delivery),
  seq_no(order+doc_type内のバッチ番号), item_ids jsonb(バッチ文書のみ),
  deposit_deadline date(Depositのみ), payment_id(Deposit/Final→customer_payments),
  created_at, created_by
order_document_versions: id, document_id, version_no, version_label(YYMMDD_vNN),
  file_url, created_at, created_by
customer_payments += category text  -- deposit | balance | other
company_settings += bank_wise_eu text, bank_rakuten_jp text
```
- 既存 `orders.pdf_*_url` は「最新バージョンへのポインタ」として残す(将来整理可)。

## 付随
- **ADR-0003 を 10円 → 1,000円切り捨てに更新**(コードと整合)。
