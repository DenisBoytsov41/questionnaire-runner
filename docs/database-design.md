# База данных и контейнеры

Проект планируется запускать в трёх контейнерах:

```text
frontend  - собранный web-интерфейс оператора
backend   - сервер API
db        - PostgreSQL
```

Backend работает с PostgreSQL через переменную `DATABASE_URL`. Файловое хранилище больше не используется в рабочем пути приложения.

## Запуск контейнеров

```powershell
docker compose up --build
```

После запуска:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:4100
Документация API: http://localhost:4100/api/docs
PostgreSQL: localhost:5432
```

Backend ждёт готовности контейнера `db`, применяет миграции и затем запускает API.

## Миграции

Миграции лежат в папке:

```text
db/migrations
```

Правила:

- каждый файл миграции имеет номер и понятное имя;
- миграции применяются по порядку имени файла;
- применённые миграции записываются в таблицу `schema_migrations`;
- каждая миграция выполняется в транзакции;
- уже применённые миграции не выполняются повторно.

Локальный запуск миграций:

```powershell
npm run build:server
$env:DATABASE_URL="postgresql://questionnaire:change-me@localhost:5432/questionnaire_runner"
npm run migrate
```

## Основные сущности

- `users` - пользователи системы.
- `questionnaires` - карточка опросника без конкретной версии.
- `questionnaire_versions` - версии JSON-сценариев, импортированные из 1С.
- `questionnaire_runs` - прохождения опросника оператором.
- `audit_log` - журнал важных действий.
- `schema_migrations` - служебная таблица применённых миграций.

## Роли

```text
user      - созданный пользователь без доступа к рабочим сценариям
operator  - оператор первой линии, проходит опубликованные опросники
admin     - администратор, импортирует сценарии и управляет пользователями
```

## Почему ответы пока храним в jsonb

На первом backend-этапе важнее сохранить факт прохождения целиком: ответы, маршрут, сообщения, вердикты и текст для заявки. Поэтому таблица `questionnaire_runs` хранит эти данные в полях `jsonb`.

Это удобно для текущего состояния проекта:

- frontend уже формирует результат как объект;
- структура ответов может меняться вместе со схемой из 1С;
- можно быстрее запустить хранение результатов;
- позже можно добавить отдельную таблицу ответов для аналитики.

Если понадобится отчётность по каждому вопросу, добавим таблицу:

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

## Текущая миграция

Первая миграция находится в файле:

```text
db/migrations/001_initial_schema.sql
```

Она создаёт:

- расширение `pgcrypto` для `gen_random_uuid()`;
- типы `user_role` и `questionnaire_run_status`;
- таблицы `users`, `questionnaires`, `questionnaire_versions`, `questionnaire_runs`, `audit_log`;
- внешние ключи;
- индексы для частых выборок.

## Что уже подключено

- контейнер PostgreSQL;
- миграции в `db/migrations`;
- применение миграций перед запуском backend в Docker;
- слой хранения backend через PostgreSQL;
- автоматическое создание первого администратора при пустой таблице `users`.

Дальше можно улучшать слой БД: заменить полную перезапись состояния на отдельные точечные запросы для пользователей, опросников и прохождений.
