-- bizflow_comments: 業務フロー図のコメントを保存
create table if not exists bizflow_comments (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users on delete cascade,
  diag_id    text        not null check (diag_id in ('zen','kessai','yoyaku')),
  svg_x      float       not null,
  svg_y      float       not null,
  svg_w      float       not null,
  svg_h      float       not null,
  text       text        not null,
  created_at timestamptz not null default now()
);

-- RLS
alter table bizflow_comments enable row level security;

drop policy if exists "users_own_bizflow_comments" on bizflow_comments;
create policy "users_own_bizflow_comments"
  on bizflow_comments for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
