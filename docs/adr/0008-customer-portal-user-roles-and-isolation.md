# Customer Portal: user roles + data isolation

> **状態: Superseded by [ADR-0010](0010-user-functions-navigation-and-portal-flows.md)。** 単一ロール（brand/customer 二択）の方針は ADR-0010 で「internal/client の型 ＋ internal サブ権限（Brand/Production）」に置き換えた。データ隔離（サーバ限定アクセス＋`is_brand()` RLS ガード）と Supabase Auth 採用の方針は ADR-0010 でも引き継ぐ。

## 決定

1. **User Role = Brand User | Customer User**（`profiles(uid, role, customer_id)`）。Brand User は Brand Portal（`src/app/(app)`）の全機能、Customer User は Customer Portal（`src/app/(portal)`）のみ。Customer User は 1 Customer に **1:1**（`profiles.customer_id` UNIQUE）。認証は全員 Supabase Auth（email + password）。

2. **データ隔離はサーバ限定アクセス + RLS ガードの二層**:
   - Customer Portal のデータアクセスは **すべてサーバ側**（server component / server action, service role）で行い、毎クエリを `customer_id` に強制スコープする。顧客ブラウザに anon/authenticated Supabase クライアントを渡さない。
   - それでも顧客の JWT は `authenticated` ロールなので、現行の blanket ポリシー `to authenticated using(true)` のままだと PostgREST を直接叩けてしまう。これを塞ぐため、各テーブルのポリシーを **`using(is_brand())`** に変更する（`is_brand()` = `profiles` で role='brand' を判定）。顧客 JWT は Brand テーブルを直接読めなくなる。

3. **ログインは単一 `/login`**。認証後 `profiles.role` で振り分け（brand → `/`、customer → `/portal`）。`proxy.ts` がロールでクロスアクセスを遮断。

4. **ポータルログイン発行**は Customer Detail（`portal_access` が ON の顧客のみ）。email + 自動生成の初期パスワードを 1 度だけ表示。以後は本人がリセットメールで再設定。

## 背景・トレードオフ

現行 RLS は全テーブル `to authenticated using(true) with check(true)`＝ログインすれば誰でも全データ読み書き可能。顧客ログインを同じ Supabase Auth に載せると、ポータル UI を迂回して他社データを読めてしまうのが最大の懸念だった。

検討した隔離方式:
- **サーバ限定アクセス + 最小 RLS ガード（採用）** — ポータルの読み書きを service role のサーバ経由に限定し、加えて blanket ポリシーを `is_brand()` ガードに一括変更。顧客 JWT を無害化しつつ、Brand アプリのロジックは実質不変。
- **全 RLS をロール別に書き換え** — 最も「正しい」が全ポリシーを customer_id スコープで書き直す必要があり、Brand アプリを壊すリスク大。今回は不要（顧客は自分の JWT でテーブルを読まない）。
- **別 Supabase プロジェクト** — 完全隔離だが 2 DB + 同期パイプラインで過剰。

Supabase Auth を顧客にも使うのは、パスワードの安全なハッシュ・リセットメール導線を自前実装せず得るため。代償として `is_brand()` ガードを全テーブルに入れる（1 マイグレーションで機械的に適用）。

## 既知の割り切り

- `is_brand()` ガードは全 Brand テーブルに必要。1 つでも漏れると顧客 JWT がそのテーブルを読めてしまうため、マイグレーションで網羅する。
- Customer Portal の全データ取得は service role 経由のため、サーバコード側のスコープ漏れ（`customer_id` フィルタ忘れ）が事故になり得る。ポータル用の取得ヘルパに `customer_id` を必須引数として集約する。
- B2C のクレジット決済（Stripe）は本 ADR のスコープでは設計のみ。実装は後続フェーズ（MVP は「入金待ち」＋ Brand 手動計上）。
