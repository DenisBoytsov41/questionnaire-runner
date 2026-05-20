# Простая схема базы данных для backend

Документ описывает ближайшую понятную схему БД для проекта. Сейчас backend хранит данные в файле `server/data/storage.json`, но модель ниже можно использовать как первый шаг при переходе на PostgreSQL.

## Сущности

- `users` - пользователи системы.
- `questionnaires` - карточка опросника без конкретной версии.
- `questionnaire_versions` - версии JSON-сценариев, импортированные из 1С.
- `questionnaire_runs` - прохождения опросника оператором.
- `audit_log` - журнал важных действий.

## Роли

```text
user      - созданный пользователь без доступа к рабочим сценариям
operator  - оператор первой линии, проходит опубликованные опросники
admin     - администратор, импортирует сценарии и управляет пользователями
```

## Черновой SQL

```sql
create type user_role as enum ('user', 'operator', 'admin');
create type questionnaire_run_status as enum ('draft', 'finished');

create table users (
  id uuid primary key default gen_random_uuid(),
  login text not null unique,
  full_name text not null,
  role user_role not null default 'user',
  active boolean not null default true,
  password_hash text not null,
  password_salt text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table questionnaires (
  id text primary key,
  title text not null,
  active_version_id uuid null,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table questionnaire_versions (
  id uuid primary key default gen_random_uuid(),
  questionnaire_id text not null references questionnaires(id),
  version integer not null,
  title text not null,
  active boolean not null default true,
  published boolean not null default false,
  source_json jsonb not null,
  imported_by uuid not null references users(id),
  imported_at timestamptz not null default now(),
  unique (questionnaire_id, version)
);

alter table questionnaires
  add constraint questionnaires_active_version_fk
  foreign key (active_version_id)
  references questionnaire_versions(id);

create table questionnaire_runs (
  id uuid primary key default gen_random_uuid(),
  questionnaire_id text not null references questionnaires(id),
  questionnaire_version_id uuid not null references questionnaire_versions(id),
  operator_id uuid not null references users(id),
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
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references users(id),
  action text not null,
  entity_type text not null,
  entity_id text null,
  details_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

## Индексы

```sql
create index users_role_idx on users(role);
create index questionnaires_archived_idx on questionnaires(archived);
create index questionnaire_versions_questionnaire_idx on questionnaire_versions(questionnaire_id, version desc);
create index questionnaire_runs_operator_idx on questionnaire_runs(operator_id, updated_at desc);
create index questionnaire_runs_questionnaire_idx on questionnaire_runs(questionnaire_id, started_at desc);
create index questionnaire_runs_status_idx on questionnaire_runs(status);
create index audit_log_created_idx on audit_log(created_at desc);
```

## Почему ответы пока лучше хранить JSON

На первом backend-этапе нам важнее не потерять фактическое прохождение: ответы, маршрут, сообщения, вердикты и текст для заявки. Поэтому `questionnaire_runs` хранит эти данные в `jsonb`. Это проще для MVP и хорошо совпадает с текущим frontend-результатом.

Если позже понадобится аналитика по отдельным вопросам, можно добавить таблицу `questionnaire_run_answers`:

```sql
create table questionnaire_run_answers (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references questionnaire_runs(id) on delete cascade,
  question_id text not null,
  question_title text not null,
  answer_value jsonb not null,
  display_value text not null,
  answered_at timestamptz not null,
  unique (run_id, question_id)
);
```

## Порядок перехода с файла на БД

1. Добавить подключение к PostgreSQL через `DATABASE_URL`.
2. Создать миграции для таблиц выше.
3. Перенести методы из `server/lib/storage.ts` на репозиторий БД.
4. Оставить API без изменения для frontend.
5. Добавить импорт старого `server/data/storage.json` в БД, если к тому моменту там будут важные тестовые данные.
