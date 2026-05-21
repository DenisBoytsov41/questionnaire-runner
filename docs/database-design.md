# База данных и контейнеры

Проект планируется запускать в четырёх контейнерах:

```text
frontend  - собранный web-интерфейс оператора
backend   - сервер API
db        - PostgreSQL
pgadmin   - web-интерфейс управления PostgreSQL
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
pgAdmin: http://localhost:5050
```

Backend ждёт готовности контейнера `db`, применяет Prisma-миграции и затем запускает API.

## Миграции

Основная схема базы описана в файле:

```text
prisma/schema.prisma
```

Миграции лежат в папке:

```text
prisma/migrations
```

Правила:

- структуру таблиц меняем сначала в `prisma/schema.prisma`;
- файл миграции создаём командой Prisma, а не вручную с нуля;
- применённые миграции Prisma записывает в таблицу `_prisma_migrations`;
- уже применённые миграции не редактируем, для следующих изменений создаём новый файл;
- backend автоматически применяет новые миграции перед запуском API.

Локальный запуск миграций:

```powershell
npm run build:server
$env:DATABASE_URL="postgresql://questionnaire:change-me@localhost:5432/questionnaire_runner"
npm run migrate
```

Создать новую миграцию:

```powershell
npm run db:migration:create -- --name add_short_description
```

## Основные сущности

- `users` - пользователи системы.
- `questionnaires` - карточка опросника без конкретной версии.
- `questionnaire_versions` - версии JSON-сценариев, импортированные из 1С.
- `questionnaire_runs` - прохождения опросника оператором.
- `audit_log` - журнал важных действий.
- `_prisma_migrations` - служебная таблица применённых Prisma-миграций.

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

## Текущие миграции

Базовая Prisma-миграция находится в файле:

```text
prisma/migrations/00000000000000_baseline/migration.sql
```

Она создаёт:

- типы `user_role` и `questionnaire_run_status`;
- таблицы `users`, `questionnaires`, `questionnaire_versions`, `questionnaire_runs`, `audit_log`;
- внешние ключи;
- индексы для частых выборок;
- поля профиля пользователя: `email`, `phone`, `position`, `preferences_json`.

Старые файлы `db/migrations/*.sql` оставлены как история перехода на PostgreSQL. Для новых изменений используем `prisma/schema.prisma` и `prisma/migrations`.

## Что уже подключено

- контейнер PostgreSQL;
- контейнер pgAdmin;
- Prisma-схема в `prisma/schema.prisma`;
- миграции в `prisma/migrations`;
- применение миграций перед запуском backend в Docker;
- слой хранения backend через PostgreSQL;
- автоматическое создание первого администратора при пустой таблице `users`.
- точечные запросы к БД вместо полной перезаписи состояния;
- профиль пользователя и настройки интерфейса;
- журнал важных действий в `audit_log`.
