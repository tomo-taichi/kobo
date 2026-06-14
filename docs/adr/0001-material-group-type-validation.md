# Material グループと Material タイプの対応を強制する

product_data の material_group には選択できる Material タイプを制限するバリデーションを設ける。Fabric（woven/knitted/leather）は main/lining/body_lining/sleeve_lining/pocket_front/pocket_back/interlining グループにのみ、Accessory Material（accessory/eyewear/other）は accessory_parts/accessory_tag グループにのみ選択可能とする。誤った組み合わせを防ぎ、原価計算・混率生成の正確性を保証するため。
