# User functions, navigation, and portal order flows

> **状態: Accepted。** ADR-0008（単一ロール brand/customer）を**置き換える**。ユーザーを internal / client の型で分け、internal に Brand/Production のサブ権限を持たせる。ナビを Brand ⇄ Production で切替可能にし、Client Portal のオーダーフローを B2B（申請→承認）と B2C（カート→決済）に分ける。

## 決定

### 1. アカウント／権限モデル

`profiles.user_type = 'internal' | 'client'` を**硬いセキュリティ境界**とする。

- **internal**（社内）: `is_brand` / `is_production` / `can_create_users`(管理者) の boolean 権限を持つ。`customer_id` は持たない。
- **client**（外部・顧客）: `customer_id` に紐づく（**1 顧客 : 多ユーザー**、UNIQUE なし＝会社に複数担当者）。内部フラグは**構造上一切持てない**。Customer Portal のみ、**読み取り専用の進捗閲覧**＋オーダー申請。

ADR-0008 の「brand/customer 二択」を、この 2 型 ＋ internal サブ権限に置き換える。

**セキュリティ根拠（内部/外部を型で分ける理由）**: 最小権限（外部アカウントは Brand/Production を絶対に持てず、設定ミスによる漏洩を排除）／爆発半径の限定（顧客アカウント漏洩は必ず 1 顧客分）／RLS が「internal＝`is_brand()`／client＝自分の customer_id のみ」の明快な二分岐になる。

### 2. ユーザー作成

- **管理者** = `is_brand` ON かつ `can_create_users` ON。内部・外部どちらのユーザーも作成できる。最初の管理者だけ手動／シードで用意。
- 作成方式 = **招待メール**（Supabase 管理API＝service role をサーバ側で使用。`inviteUserByEmail`／`generateLink`）。本人がリンクから初回パスワードを設定。
- 入口: **Client ユーザー**＝Customers ページ（顧客詳細）。**内部ユーザー**＝Settings → Users（管理者のみ）。

### 3. データ隔離

ADR-0008 を踏襲: **サーバ限定アクセス ＋ `is_brand()` RLS ガード**の二層。`is_brand()` は `profiles.is_brand`（internal かつ ON）を判定。Customer Portal の全取得は service role のサーバ経由で `customer_id` に強制スコープする。

### 4. ナビゲーション（Brand ⇄ Production）

- 上部に **Brand / Production スイッチャー**。両権限を持つ internal ユーザーにのみ表示（片方だけの人はそのモードのみ）。
- **Production 機能** = 6 ページ: Kanban / Production Progress / Finishing / Hours / Master List / Material Order。これらはシーズン単位（`/seasons/[id]/production/*`、`/seasons/[id]/material-orders`）のため、**共通タブバー＋シーズン切替**で相互移動する。入口は `/production` ハブ（シーズン一覧 → 選択 → タブバー付き 6 ページ）。
- **Brand 機能** = その他のページ（Seasons / Suppliers / Materials / Customers / Products / Orders / Settings）。

### 5. オーダーフロー（顧客タイプで分岐）

- **B2B（フラグ顧客）**: 顧客 or ブランドが **申請オーダー(Submitted)** を作成（商品・色・サイズ・数量のみ。価格/値引き/デポジットはブランド管理）→ ブランドが確認し Submit → **ブランド承認で確定** → デポジット請求書送付 →（既存 A〜F フロー）。`orders` に Submitted/Approved 状態 ＋ origin(発生元: brand/client) を追加する。顧客は Submitted の間のみ編集/取り下げ可、確定後は読み取り専用。
- **B2C 顧客**: 通常の EC 同様、**カート → チェックアウト → 決済**。決済は **MVP=入金待ち（ブランド手動計上）**、Stripe 本実装は後続。

### 6. フェーズ分割

- **Phase A**: ナビ（Brand/Production スイッチャー ＋ Production 共通タブバー ＋ シーズン切替）。認証変更・マイグレーションなし。
- **Phase B**: 認証基盤（`profiles` 拡張、単一 `/login` のロール振り分け、`is_brand()` RLS 一括ガード、Settings→Users 管理、招待メール作成）。各機能の権限ゲート。
- **Phase C**: Client Portal / B2B（`/portal` ルート群、Client ログイン、読み取り専用進捗ビュー、申請オーダー下書き→承認、Submitted/Approved＋origin、ブランド代理作成→Submit→承認）。
- **Phase D**: Client Portal / B2C（カート・チェックアウト・決済。MVP 入金待ち → Stripe）。

## 背景・トレードオフ

- (A) 3 機能を完全独立トグルにする案は、顧客アカウントに誤って Brand を付与しうるフットガンがあり却下。internal/client を型で分ける方が最小権限・監査性・RLS の単純さで勝る。
- 外部ユーザーの「自分のオーダーの Production 進捗閲覧」は、分離しても **ポータル側のサーバ限定・customer_id スコープの読み取り専用ビュー**で提供できる（社内 Kanban の担当者・工数・コメントは見せず、工程プログレスのみ）。
- B2C 決済は MVP を入金待ちにして、EC 導線（カート/チェックアウト）を先に固める。

## 既知の割り切り

- `is_brand()` ガードは全 Brand テーブルに必要（1 つ漏れると顧客 JWT が読めてしまう）。マイグレーションで網羅。
- 顧客内は**共有ビュー**（同一顧客の複数ユーザーは同じオーダーを見る）。担当者ごとの絞り込みは対象外。
- 最初の管理者のブートストラップは手動／シード。
