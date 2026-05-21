# Миграции базы данных

В проекте миграции базы данных ведутся через Prisma.

Основной файл схемы:

```text
prisma/schema.prisma
```

Файлы миграций:

```text
prisma/migrations
```

Служебная таблица Prisma в PostgreSQL:

```text
_prisma_migrations
```

## Главное правило

Уже применённые миграции не редактируем.

Если нужно изменить структуру базы, меняем `prisma/schema.prisma` и создаём новую миграцию.

## Обычный порядок работы

1. Изменить модель в `prisma/schema.prisma`.
2. Создать миграцию.
3. Проверить созданный SQL.
4. Применить миграцию.
5. Проверить backend.

Пример:

```powershell
npm run db:migration:create -- --name add_user_last_login
```

После выполнения команды появится новая папка в `prisma/migrations`. Внутри будет файл `migration.sql`. Его нужно открыть и убедиться, что Prisma создала ожидаемые изменения.

Применить миграции локально:

```powershell
npm run build:server
npm run migrate
```

Проверить схему:

```powershell
npx prisma validate
```

Отформатировать схему:

```powershell
npx prisma format
```

## Запуск в Docker

В обычном Docker-запуске вручную применять миграции не нужно. Backend делает это сам перед запуском API.

```powershell
docker compose up --build
```

Если контейнеры уже запущены и нужно применить новые миграции, достаточно пересобрать или перезапустить backend:

```powershell
docker compose up -d --build backend
```

или:

```powershell
docker compose restart backend
```

Если нужно применить миграции вручную внутри контейнера:

```powershell
docker compose run --rm backend npm run migrate
```

## Проверка применённых миграций

Посмотреть список миграций:

```powershell
docker compose exec db psql -U questionnaire -d questionnaire_runner -c "select migration_name, finished_at from _prisma_migrations order by started_at;"
```

Посмотреть таблицы:

```powershell
docker compose exec db psql -U questionnaire -d questionnaire_runner -c "\dt"
```

Открыть визуальный просмотр базы через Prisma Studio:

```powershell
npm run db:studio
```

Также можно использовать pgAdmin:

```text
http://localhost:5050
```

## Как назвать миграцию

Название должно коротко объяснять изменение.

Хорошие примеры:

```text
add_user_last_login
add_questionnaire_tags
add_run_answers_table
rename_summary_text
```

Плохие примеры:

```text
fix
new
update
test
```

## Если миграция ещё не применялась

Если миграция создана, но ещё не применялась ни у кого в базе, её можно удалить и создать заново.

Например, если Prisma сгенерировала не то, что ожидалось:

```powershell
Remove-Item -Recurse -Force prisma/migrations/20260521120000_bad_migration
npm run db:migration:create -- --name better_name
```

Перед удалением важно убедиться, что миграция не была применена в общей или рабочей базе.

## Если миграция уже применена

Если миграция уже применена, не меняем её файл.

Создаём новую миграцию, которая исправляет структуру:

```powershell
npm run db:migration:create -- --name fix_user_profile_fields
npm run migrate
```

## Если нужно сбросить локальную базу

Это удалит данные PostgreSQL текущего Docker-проекта.

```powershell
docker compose down -v
docker compose up --build
```

Такой сброс подходит для локальной разработки, когда данные можно потерять. Для рабочей базы так делать нельзя.

## Если миграция сломала запуск backend

Посмотреть логи backend:

```powershell
docker compose logs backend
```

Проверить состояние контейнеров:

```powershell
docker compose ps
```

Проверить подключение к базе:

```powershell
docker compose exec db psql -U questionnaire -d questionnaire_runner -c "select now();"
```

Частые причины:

- ошибка в SQL внутри миграции;
- схема Prisma не совпадает с реальной базой;
- неверные переменные окружения для подключения к PostgreSQL;
- база ещё не успела стать `healthy`;
- миграция уже была применена и затем отредактирована вручную.

## Команды проекта

```powershell
# Проверить Prisma-схему
npx prisma validate

# Отформатировать Prisma-схему
npx prisma format

# Создать миграцию без применения
npm run db:migration:create -- --name add_short_description

# Применить миграции
npm run migrate

# Сгенерировать Prisma Client
npm run db:generate

# Открыть Prisma Studio
npm run db:studio
```

## Что с папкой db/migrations

Старые SQL-файлы в `db/migrations` оставлены как история перехода на PostgreSQL.

Новые изменения базы делаем через:

```text
prisma/schema.prisma
prisma/migrations
```
