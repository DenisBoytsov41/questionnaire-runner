create type user_role as enum ('user', 'operator', 'admin');
create type questionnaire_run_status as enum ('draft', 'finished');

create table users (
  id text primary key,
  login text not null unique,
  full_name text not null,
  role user_role not null default 'user',
  active boolean not null default true,
  password_hash text not null,
  password_salt text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  email text not null default '',
  phone text not null default '',
  position text not null default '',
  preferences_json jsonb not null default '{"theme":"light","textSize":"normal","readingMode":"normal"}'::jsonb
);

create table questionnaires (
  id text primary key,
  title text not null,
  active_version_id text null,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table questionnaire_versions (
  id text primary key,
  questionnaire_id text not null references questionnaires(id),
  version integer not null,
  title text not null,
  active boolean not null default true,
  published boolean not null default false,
  source_json jsonb not null,
  imported_by text null references users(id),
  imported_at timestamptz not null default now(),
  unique (questionnaire_id, version)
);

alter table questionnaires
  add constraint questionnaires_active_version_fk
  foreign key (active_version_id)
  references questionnaire_versions(id);

create table questionnaire_runs (
  id text primary key,
  questionnaire_id text not null references questionnaires(id),
  questionnaire_version_id text not null references questionnaire_versions(id),
  operator_id text null references users(id),
  status questionnaire_run_status not null default 'draft',
  current_question_id text null,
  answers_json jsonb not null default '{}'::jsonb,
  route_json jsonb not null default '[]'::jsonb,
  messages_json jsonb not null default '[]'::jsonb,
  verdicts_json jsonb not null default '[]'::jsonb,
  summary_text text not null default '',
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz null
);

create table audit_log (
  id text primary key,
  user_id text null references users(id),
  action text not null,
  entity_type text not null,
  entity_id text null,
  details_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index users_role_idx on users(role);
create index users_active_role_idx on users(active, role);
create index questionnaires_archived_idx on questionnaires(archived);
create index questionnaire_versions_questionnaire_idx on questionnaire_versions(questionnaire_id, version desc);
create index questionnaire_runs_operator_idx on questionnaire_runs(operator_id, updated_at desc);
create index questionnaire_runs_questionnaire_idx on questionnaire_runs(questionnaire_id, started_at desc);
create index questionnaire_runs_status_idx on questionnaire_runs(status);
create index audit_log_created_idx on audit_log(created_at desc);
