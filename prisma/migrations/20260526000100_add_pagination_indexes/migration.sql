create index if not exists questionnaires_updated_title_idx
  on questionnaires(updated_at desc, title);

create index if not exists questionnaires_archived_title_idx
  on questionnaires(archived, title);

create index if not exists questionnaire_runs_operator_started_idx
  on questionnaire_runs(operator_id, started_at desc);

create index if not exists questionnaire_runs_status_started_idx
  on questionnaire_runs(status, started_at desc);
