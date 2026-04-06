-- sheet_tabs: スプレッドシートのシート管理
create table if not exists sheet_tabs (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users on delete cascade,
  name       text        not null default 'Sheet1',
  sort_order int         not null default 0,
  created_at timestamptz not null default now()
);

alter table sheet_tabs enable row level security;

drop policy if exists "users_own_sheet_tabs" on sheet_tabs;
create policy "users_own_sheet_tabs"
  on sheet_tabs for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- sheet_cells: セルのデータ（空でないセルのみ保存）
create table if not exists sheet_cells (
  id         uuid        primary key default gen_random_uuid(),
  sheet_id   uuid        not null references sheet_tabs(id) on delete cascade,
  row_idx    int         not null,
  col_idx    int         not null,
  value      text        not null default '',
  unique(sheet_id, row_idx, col_idx)
);

alter table sheet_cells enable row level security;

drop policy if exists "users_own_sheet_cells" on sheet_cells;
create policy "users_own_sheet_cells"
  on sheet_cells for all
  using (
    exists (
      select 1 from sheet_tabs
      where sheet_tabs.id = sheet_cells.sheet_id
        and sheet_tabs.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from sheet_tabs
      where sheet_tabs.id = sheet_cells.sheet_id
        and sheet_tabs.user_id = auth.uid()
    )
  );
