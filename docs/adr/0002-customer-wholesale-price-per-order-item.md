# order_items に customer_wholesale_eur を追加する

`order_items` に `customer_wholesale_eur`（= `retail_price_eur × (1 - discount_rate)`）カラムを追加する。仕様書の `wholesale_price_eur` は商品の `markup_rate` ベースの理想WS価格スナップショットであり、実際の請求単価とは異なる。Invoice PDF には顧客ごとの実際の請求単価を表示する必要があるため、Order 確定時に計算・保存する専用カラムが必要。
