-- doc_folders: ドキュメントのフォルダ（1階層）
create table if not exists doc_folders (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users on delete cascade,
  name       text        not null default '新しいフォルダ',
  sort_order int         not null default 0,
  created_at timestamptz not null default now()
);

alter table doc_folders enable row level security;

drop policy if exists "users_own_doc_folders" on doc_folders;
create policy "users_own_doc_folders"
  on doc_folders for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- docs: ドキュメント本体
create table if not exists docs (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users on delete cascade,
  folder_id  uuid        references doc_folders(id) on delete set null,
  name       text        not null default '新しいドキュメント',
  content    jsonb       not null default '{"type":"doc","content":[]}',
  sort_order int         not null default 0,
  updated_at timestamptz not null default now()
);

alter table docs enable row level security;

drop policy if exists "users_own_docs" on docs;
create policy "users_own_docs"
  on docs for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
