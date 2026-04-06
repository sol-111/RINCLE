-- Add format column to sheet_cells
alter table sheet_cells add column if not exists format jsonb;
