-- ── ref_target 一括設定 ─────────────────────────────────────────────────────────
-- seed.sql の INSERT には ref_target が含まれていなかったため全行が ''。
-- bubble ファイルの custom.*/list.custom.* フィールドを正として正確な参照先を設定する。
-- ER図のエッジはこのカラムを参照しているため、空だと矢印が一切表示されない。
--
-- ※ field_id '156' / '157' は seed での参照先が bubble と逆転していたため
--   ref_target と display_name を同時に修正する。

-- ── → user ─────────────────────────────────────────────────────────────────────
UPDATE db_fields SET ref_target = 'user'
WHERE field_id IN (
  '52',   -- bicycle.shop_user
  '71',   -- price_menu.shop_user
  '75',   -- option.shop_user
  '89',   -- sub_option.shop_user
  '92',   -- prefecture.shop_user
  '93',   -- prefecture.shoplist_list_user
  '137',  -- reservation.___user (店舗)
  '159',  -- reservation_detail.___user
  '166',  -- shop_schedule.____user
  '173',  -- business_hours.____user
  '182',  -- sales_record.shop_user
  '184',  -- shop_notification.shop_user
  '191'   -- contact_inquiry._____user
);

-- ── → ____ (reservation) ────────────────────────────────────────────────────────
UPDATE db_fields SET ref_target = '____ (reservation)'
WHERE field_id IN (
  '25',   -- user.cart_custom_____
  '157'   -- reservation_detail._____custom_____ ← FIXED: seed は booking_customer と誤記
);

-- ── → _____ (booking_customer) ──────────────────────────────────────────────────
-- FIXED: seed では '→ ____ (reservation)' と誤記されていた
UPDATE db_fields SET
  ref_target    = '_____ (booking_customer)',
  display_name  = '乗車人情報参照'
WHERE field_id = '156';   -- reservation_detail.______custom______

-- display_name も合わせて修正（157 は上の reservation UPDATE で ref_target 設定済み）
UPDATE db_fields SET display_name = '予約情報参照'
WHERE field_id = '157';   -- reservation_detail._____custom_____

-- ── → prefecture ────────────────────────────────────────────────────────────────
UPDATE db_fields SET ref_target = 'prefecture'
WHERE field_id = '26';    -- user.prefecture_custom_prefecture

-- ── → price_menu ────────────────────────────────────────────────────────────────
UPDATE db_fields SET ref_target = 'price_menu'
WHERE field_id IN (
  '53',   -- bicycle.price_menu_custom_price_menu
  '155',  -- reservation_detail.price_menu_custom_price_menu
  '161'   -- option_price.price_menu_custom_price_menu
);

-- ── → bicycle ───────────────────────────────────────────────────────────────────
UPDATE db_fields SET ref_target = 'bicycle'
WHERE field_id IN (
  '88',   -- sub_option.bicycles_list_custom_bicycle
  '154',  -- reservation_detail.____custom_bicycle
  '168'   -- shop_schedule.__________s_list_custom_bicycle
);

-- ── → option ────────────────────────────────────────────────────────────────────
UPDATE db_fields SET ref_target = 'option'
WHERE field_id = '87';    -- sub_option.parent_option_custom_option

-- ── → sub_option ────────────────────────────────────────────────────────────────
UPDATE db_fields SET ref_target = 'sub_option'
WHERE field_id = '162';   -- option_price.______custom_sub_option

-- ── → q_a_category ──────────────────────────────────────────────────────────────
UPDATE db_fields SET ref_target = 'q_a_category'
WHERE field_id = '100';   -- q_a.category_custom_q_a_category

-- ── → _______1 (reservation_detail) ────────────────────────────────────────────
UPDATE db_fields SET ref_target = '_______1 (reservation_detail)'
WHERE field_id = '138';   -- reservation.________list_custom_______1

-- ── → _________1 (option_price) ─────────────────────────────────────────────────
UPDATE db_fields SET ref_target = '_________1 (option_price)'
WHERE field_id IN (
  '139',  -- reservation.__________list_custom__________1 (bubble で deleted 済みだが seed に残存)
  '158'   -- reservation_detail.__________list_custom__________1
);
