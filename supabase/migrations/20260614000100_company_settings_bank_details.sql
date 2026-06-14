ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS bank_wise_eu     text,
  ADD COLUMN IF NOT EXISTS bank_rakuten_jp  text;

UPDATE company_settings SET
  bank_wise_eu = '=== EU BANK (TransferWise)===
[ACCOUNT NAME]: NULLA CO. LTD.
[BIC]: TRWIBEB1XXX
[IBAN]: BE17 9671 9427 7121
[ADDRESS]: TransferWise Europe SA, Avenue Louise 54, Room S52, Brussels, 1050, Belgium',
  bank_rakuten_jp = '銀行名 / 楽天銀行
支店名 / 第三営業支店 (253)
口座 / 普通 7000859
名前 / 株式会社NULLA
住所 / 110-0005 東京都台東区上野6-1-6 御徒町グリーンハイツ1005'
WHERE TRUE;
