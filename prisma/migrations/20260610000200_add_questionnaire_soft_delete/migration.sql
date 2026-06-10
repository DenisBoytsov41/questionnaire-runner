alter table questionnaires
  add column if not exists deleted_at timestamptz null;

create index if not exists questionnaires_deleted_updated_idx
  on questionnaires(deleted_at, updated_at desc);
