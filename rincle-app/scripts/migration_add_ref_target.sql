-- db_fields に ref_target カラムを追加（dtype=ref のとき参照先テーブル名を格納）
alter table db_fields add column if not exists ref_target text not null default '';
