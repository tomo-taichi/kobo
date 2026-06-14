# 製造コストはガーメントタイプ別の固定金額プリセットから選択する

Cutting / Sewing / Knitting / Thread / Finish / Packing の6コスト項目は、ガーメントタイプ（TSHIRT / SHIRT / TROUSERS / JACKET / COAT）ごとに決まった JPY 固定金額から選択式で入力する。0円も選択可。値は既存 FileMaker の運用から継承。Product に各コスト項目のカラムを持ち、素材コスト（product_materials の単価×使用量の合計）と足し合わせて `cost_jpy` を自動計算・保存する。
