# JPY 請求額の端数切り捨てルール

JPY 建ての請求額（合計・Deposit・Balance・Final など、書類に印字される全 JPY 金額）の端数は **1,000円単位で切り捨てる**（1,232,480円 → 1,232,000円）。EUR は1ユーロ単位（1,234.14€ → 1,234€）。書類に印字される金額が見栄えよく、かつ顧客側で暗算しやすいようにするため。`floor(amount / unit) × unit` で実装する。

更新履歴: 当初は JPY 10円単位だったが、2026-06 にユーザー指示で 1,000円単位に変更（OC/Deposit/Final の通貨表示仕様と統一）。`docs/specs/2026-06-14-invoicing-currency-versioning-batch.md` 参照。
