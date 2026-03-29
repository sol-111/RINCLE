-- ── email_config（グローバルメール設定・シングルトン） ──────────────────────
create table if not exists email_config (
  id            int primary key default 1,
  from_address  text not null default 'no-reply@rincle.co.jp',
  sender_name   text not null default 'RINCLE（リンクル）',
  footer        text not null default 'もし本メールに心当たりがない場合は、メールにてお問い合わせをお願いいたします。

--------
このメールは送信専用のため、ご返信いただいてもお答えできませんのでご了承ください。
また、このメールに心当たりがない場合は、下記までご連絡ください。

────────────────────
RINCLE（リンクル）スポーツバイクレンタル
no-reply@rincle.co.jp
https://rincle.co.jp',
  updated_at    timestamptz not null default now()
);

-- id=1 の行が存在しない場合のみ初期データ挿入
insert into email_config (id) values (1)
on conflict (id) do nothing;
