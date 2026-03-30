-- flow_diagrams: ユーザーごとに業務フロー図を1レコード保存
create table if not exists flow_diagrams (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users on delete cascade,
  nodes      jsonb       not null default '[]',
  edges      jsonb       not null default '[]',
  frames     jsonb       not null default '[]',
  next_id    integer     not null default 200,
  vx         float       not null default 0,
  vy         float       not null default 0,
  vscale     float       not null default 1,
  updated_at timestamptz not null default now()
);

-- ユーザーごとに1レコード（upsertのonConflict対象）
create unique index if not exists flow_diagrams_user_id_idx on flow_diagrams (user_id);

-- updated_at を自動更新するトリガー
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists flow_diagrams_updated_at on flow_diagrams;
create trigger flow_diagrams_updated_at
  before update on flow_diagrams
  for each row execute function set_updated_at();

-- RLS
alter table flow_diagrams enable row level security;

drop policy if exists "users_own_flow" on flow_diagrams;
create policy "users_own_flow"
  on flow_diagrams for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
