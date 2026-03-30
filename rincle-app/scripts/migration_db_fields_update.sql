-- ── db_fields 追加マイグレーション ─────────────────────────────────────────────
-- bubble ファイルと比較して seed.sql に未記載のフィールドを追加
-- sort_order / field_id は 198 (seed最終 197/198 の次) から採番

insert into db_fields (sort_order, field_id, table_name, field_name, display_name, required, ix, dtype, list, ref_target, validation, notes) values

-- ── ____ (reservation) 追加フィールド ──────────────────────────────────────────
(198, '199', '____ (reservation)', '______date',           '延長返却日',        false, false, 'date',    false, '',                   '', ''),
(199, '200', '',                   '______text',           '支払い方法',        false, false, 'text',    false, '',                   '', ''),
(200, '201', '',                   '___id_text',           '返金ID',            false, false, 'text',    false, '',                   '', ''),
(201, '202', '',                   '____1_boolean',        '返金済み',          false, false, 'boolean', false, '',                   '', ''),
(202, '203', '',                   '_________number',      '手数料デフォルト',  false, false, 'number',  false, '',                   '', ''),
(203, '204', '',                   '__charge_id1_text',    '返金charge_id',     false, false, 'text',    false, '',                   '', ''),
(204, '205', '',                   '____custom_______1',   '手数料',            false, false, 'ref',     false, '______1 (reservation_count)', '', ''),
(205, '206', '',                   '______option________', 'ステータス',        false, false, 'option',  false, '',                   '', '予約ステータス'),

-- ── user 追加フィールド ─────────────────────────────────────────────────────────
(206, '207', 'user',               '____text',             '担当者名',          false, false, 'text',    false, '',                   '', ''),
(207, '208', '',                   '_____text',            '認証番号',          false, false, 'text',    false, '',                   '', ''),
(208, '209', '',                   'phone1_text',          '電話番号②',         false, false, 'text',    false, '',                   '', ''),
(209, '210', '',                   'car_id_text',          'car_id',            false, false, 'text',    false, '',                   '', ''),
(210, '211', '',                   'archive_boolean',      'アーカイブ済み',    false, false, 'boolean', false, '',                   '', ''),
(211, '212', '',                   'is__________boolean',  'キャンペーン通知',  false, false, 'boolean', false, '',                   '', ''),
(212, '213', '',                   'business_address_text','事業者住所',        false, false, 'text',    false, '',                   '', ''),
(213, '214', '',                   'pay_jp_apply_form_url_text', 'Pay.JP申請URL(text)', false, false, 'text', false, '',             '', ''),
(214, '215', '',                   'pay_jp_apply_form_url_user', 'Pay.JP申請URL(user参照)', false, false, 'ref', false, 'user',       '', ''),

-- ── bicycle 追加フィールド ───────────────────────────────────────────────────────
(215, '216', 'bicycle',            '_____1_______number',  '（税抜き）1日プラン料金',   false, false, 'number', false, '', '', ''),
(216, '217', '',                   '_____1_____number',    '（税抜き）4時間プラン料金', false, false, 'number', false, '', '', ''),
(217, '218', '',                   '_____1____number',     '（税抜き）3日間プラン料金', false, false, 'number', false, '', '', ''),
(218, '219', '',                   '_____1____1_number',   '（税抜き）2日間プラン料金', false, false, 'number', false, '', '', ''),
(219, '220', '',                   '_____1____2_number',   '（税抜き）7日間プラン料金', false, false, 'number', false, '', '', ''),
(220, '221', '',                   '_____7__13__number',   '（税抜き）14日間プラン料金', false, false, 'number', false, '', '', ''),
(221, '222', '',                   '_____14__29__number',  '（税抜き）30日間プラン料金', false, false, 'number', false, '', '', ''),
(222, '223', '',                   '_______1____number',   '（税抜き）延長1日料金',     false, false, 'number', false, '', '', ''),
(223, '224', '',                   '_______1_____number',  '（税抜き）延長1時間料金',   false, false, 'number', false, '', '', ''),
(224, '225', '',                   'more_a_day_price_number',  '延長日単価',    false, false, 'number', false, '', '', ''),
(225, '226', '',                   'more_a_hour_price_number', '延長時間単価',  false, false, 'number', false, '', '', ''),
(226, '227', '',                   '________option____________', '貸出ステータス', false, false, 'option', false, '', '', '貸し出し可能ステータス'),

-- ── sub_option 追加フィールド ───────────────────────────────────────────────────
(227, '228', 'sub_option',         '7________number',       '7日間プラン料金',           false, false, 'number', false, '', '', ''),
(228, '229', '',                   '14________number',      '14日間プラン料金',          false, false, 'number', false, '', '', ''),
(229, '230', '',                   '30________number',      '30日間プラン料金',          false, false, 'number', false, '', '', ''),
(230, '231', '',                   '_____1____number',      '（税抜き）1日プラン料金',   false, false, 'number', false, '', '', ''),
(231, '232', '',                   '_____1_____number',     '（税抜き）3日間プラン料金', false, false, 'number', false, '', '', ''),
(232, '233', '',                   '_____1____1_number',    '（税抜き）4時間プラン料金', false, false, 'number', false, '', '', ''),
(233, '234', '',                   '_____1____2_number',    '（税抜き）2日間プラン料金', false, false, 'number', false, '', '', ''),
(234, '235', '',                   '_______1____number',    '（税抜き）延長1日料金',     false, false, 'number', false, '', '', ''),
(235, '236', '',                   '_______1_____number',   '（税抜き）延長1時間料金',   false, false, 'number', false, '', '', ''),
(236, '237', '',                   '_____7________number',  '（税抜き）7日間プラン料金', false, false, 'number', false, '', '', ''),
(237, '238', '',                   '_____14________number', '（税抜き）14日間プラン料金', false, false, 'number', false, '', '', ''),
(238, '239', '',                   '_____30________number', '（税抜き）30日間プラン料金', false, false, 'number', false, '', '', ''),
(239, '240', '',                   'more_a_day_price_number',  '延長日単価',    false, false, 'number', false, '', '', ''),
(240, '241', '',                   'more_a_hour_price_number', '延長時間単価',  false, false, 'number', false, '', '', ''),
(241, '242', '',                   'three_weeks_price_number', '3週間単価',     false, false, 'number', false, '', '', ''),
(242, '243', '',                   '________option____________', '貸出ステータス', false, false, 'option', false, '', '', '貸し出し可能ステータス'),
(243, '244', '',                   'number0_list_custom________', 'number0（営業日リスト）', false, false, 'ref', true, '_______ (shop_schedule)', '', ''),
(244, '245', '',                   'number1_list_custom________', 'number1（営業日リスト）', false, false, 'ref', true, '_______ (shop_schedule)', '', ''),
(245, '246', '',                   'number2_list_custom________', 'number2（営業日リスト）', false, false, 'ref', true, '_______ (shop_schedule)', '', ''),
(246, '247', '',                   'number3_list_custom________', 'number3（営業日リスト）', false, false, 'ref', true, '_______ (shop_schedule)', '', ''),
(247, '248', '',                   'number4_list_custom________', 'number4（営業日リスト）', false, false, 'ref', true, '_______ (shop_schedule)', '', ''),
(248, '249', '',                   'number5_list_custom________', 'number5（営業日リスト）', false, false, 'ref', true, '_______ (shop_schedule)', '', ''),
(249, '250', '',                   'number1_custom________',      'number1（営業日）',      false, false, 'ref',  false, '_______ (shop_schedule)', '', ''),
(250, '251', '',                   'number2_custom________',      'number2（営業日）',      false, false, 'ref',  false, '_______ (shop_schedule)', '', ''),

-- ── ______ (sales_record) 追加フィールド ───────────────────────────────────────
(251, '252', '______ (sales_record)', '__________option__________', '振り込みステータス', false, false, 'option', false, '', '', '振り込みステータス'),

-- ── _______news (shop_notification) 追加フィールド ─────────────────────────────
(252, '253', '_______news (shop_notification)', '___custom_______',       '請求参照',         false, false, 'ref', false, '______ (sales_record)',    '', ''),
(253, '254', '',                               '_______custom_________1', 'お問い合わせ参照', false, false, 'ref', false, '________1 (contact_inquiry)', '', ''),

-- ── ________1 (contact_inquiry) 追加フィールド ────────────────────────────────
(254, '255', '________1 (contact_inquiry)', '___custom_________', '種別', false, false, 'ref', false, '________ (ip_rights)', '', 'お問い合わせ種別テーブル参照'),

-- ── _____ (booking_customer) 追加フィールド ───────────────────────────────────
(255, '256', '_____ (booking_customer)', '___text',      '住所（bubble key）', false, false, 'text',   false, '', '', 'bubble内部キー ___text。seed の address_text と重複の可能性あり'),
(256, '257', '',                         '___number',    '身長',              false, false, 'number', false, '', '', ''),
(257, '258', '',                         '____1_number', '郵便番号',          false, false, 'number', false, '', '', '');
