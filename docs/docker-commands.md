# Docker: запуск и управление проектом

Проект рассчитан на запуск в трёх контейнерах:

```text
frontend  - web-интерфейс оператора
backend   - сервер API
db        - PostgreSQL
pgadmin   - web-интерфейс управления PostgreSQL
```

## Первый запуск

Перед запуском откройте Docker Desktop и дождитесь, пока он полностью запустится.

```powershell
docker compose up --build
```

После запуска:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:4100
Swagger:  http://localhost:4100/api/docs
БД:       localhost:5432
pgAdmin:  http://localhost:5050
```

Доступы по умолчанию:

```text
Администратор: admin / admin123
Документация API: docs / docs-password
pgAdmin: admin@k-service44.ru / admin123
```

## Запуск в фоне

Если не нужно держать окно терминала занятым:

```powershell
docker compose up --build -d
```

Проверить состояние:

```powershell
docker compose ps
```

Если всё в порядке, у контейнеров будет состояние `healthy`.

## Проверка состояния контейнеров

Общая проверка:

```powershell
docker compose ps
```

Проверить backend из браузера или PowerShell:

```powershell
Invoke-RestMethod http://localhost:4100/api/health
```

Проверить frontend:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:5173
```

Посмотреть подробное состояние healthcheck backend:

```powershell
docker inspect questionnaire-backend --format "{{json .State.Health}}"
```

Посмотреть подробное состояние healthcheck frontend:

```powershell
docker inspect questionnaire-frontend --format "{{json .State.Health}}"
```

Посмотреть подробное состояние healthcheck БД:

```powershell
docker inspect questionnaire-db --format "{{json .State.Health}}"
```

## pgAdmin

pgAdmin открывается в браузере:

```text
http://localhost:5050
```

Доступ по умолчанию:

```text
Email: admin@k-service44.ru
Пароль: admin123
```

Если пароль переопределён в `.env`, используйте значение `PGADMIN_DEFAULT_PASSWORD`.

Чтобы подключить PostgreSQL внутри pgAdmin:

```text
Name: Questionnaire DB
Host name/address: db
Port: 5432
Maintenance database: questionnaire_runner
Username: questionnaire
Password: значение POSTGRES_PASSWORD из .env
```

Важно: внутри Docker-сети нужно указывать хост `db`, а не `localhost`.

## Остановка

Остановить контейнеры без удаления данных БД:

```powershell
docker compose down
```

Остановить и удалить данные БД:

```powershell
docker compose down -v
```

Команда с `-v` удаляет volume PostgreSQL. Используйте её только если данные можно потерять.

## Пересборка после изменений

Если менялся код frontend или backend:

```powershell
docker compose up --build
```

Если нужно пересобрать только backend:

```powershell
docker compose build backend
docker compose up backend
```

Если нужно пересобрать только frontend:

```powershell
docker compose build frontend
docker compose up frontend
```

## Логи

Все логи:

```powershell
docker compose logs
```

Красивый общий просмотр с цветами по контейнерам:

```powershell
npm run docker:logs
```

Или напрямую:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/docker-logs.ps1
```

Цвета:

```text
frontend - голубой
backend  - зелёный
db       - фиолетовый
```

Логи backend:

```powershell
docker compose logs backend
```

Логи frontend:

```powershell
docker compose logs frontend
```

Логи БД:

```powershell
docker compose logs db
```

Следить за логами в реальном времени:

```powershell
docker compose logs -f
```

Следить только за backend:

```powershell
docker compose logs -f backend
```

Красивый просмотр только backend:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/docker-logs.ps1 -Service backend
```

## Перезапуск контейнеров

Перезапустить всё:

```powershell
docker compose restart
```

Перезапустить только backend:

```powershell
docker compose restart backend
```

Перезапустить только frontend:

```powershell
docker compose restart frontend
```

Перезапустить только БД:

```powershell
docker compose restart db
```

## Проверка конфигурации

Проверить, что `docker-compose.yml` корректный:

```powershell
docker compose config
```

Посмотреть итоговые переменные окружения контейнеров:

```powershell
docker compose config
```

## Миграции БД

В обычном Docker-запуске миграции выполняются автоматически перед запуском backend.

Если нужно применить миграции вручную внутри backend-контейнера:

```powershell
docker compose run --rm backend node dist-server/server/db/migrate.js
```

Если нужно посмотреть список применённых миграций:

```powershell
docker compose exec db psql -U questionnaire -d questionnaire_runner -c "select * from schema_migrations order by applied_at;"
```

## Работа с PostgreSQL

Открыть консоль PostgreSQL:

```powershell
docker compose exec db psql -U questionnaire -d questionnaire_runner
```

Показать таблицы:

```powershell
docker compose exec db psql -U questionnaire -d questionnaire_runner -c "\dt"
```

Показать пользователей:

```powershell
docker compose exec db psql -U questionnaire -d questionnaire_runner -c "select id, login, full_name, role, active from users;"
```

Показать опросники:

```powershell
docker compose exec db psql -U questionnaire -d questionnaire_runner -c "select id, title, active_version_id, archived from questionnaires;"
```

Показать прохождения:

```powershell
docker compose exec db psql -U questionnaire -d questionnaire_runner -c "select id, questionnaire_id, operator_id, status, started_at, finished_at from questionnaire_runs order by started_at desc;"
```

## Полный сброс БД

Если нужно начать с чистой базы:

```powershell
docker compose down -v
docker compose up --build
```

После этого PostgreSQL создаст новую пустую БД, backend применит миграции и создаст администратора.

## Изменение паролей и портов

Создайте локальный `.env` рядом с `docker-compose.yml`.

Пример:

```env
FRONTEND_PORT=5173
BACKEND_PORT=4100
POSTGRES_PORT=5432

ADMIN_LOGIN=admin
ADMIN_PASSWORD=strong-password

SWAGGER_USER=docs
SWAGGER_PASSWORD=strong-docs-password

POSTGRES_DB=questionnaire_runner
POSTGRES_USER=questionnaire
POSTGRES_PASSWORD=strong-db-password

PGADMIN_PORT=5050
PGADMIN_DEFAULT_EMAIL=admin@k-service44.ru
PGADMIN_DEFAULT_PASSWORD=strong-pgadmin-password

JWT_SECRET=very-long-random-secret
```

Файл `.env` не коммитится. В репозитории должен оставаться только `.env.example`.

## Если порт уже занят

Проверьте, какие контейнеры запущены:

```powershell
docker compose ps
docker ps
```

Можно сменить порт в `.env`:

```env
FRONTEND_PORT=5174
BACKEND_PORT=4101
POSTGRES_PORT=5433
```

После изменения:

```powershell
docker compose up --build
```

## Если Docker не запускается

Типичная ошибка:

```text
dockerDesktopLinuxEngine: The system cannot find the file specified
```

Что сделать:

```text
1. Открыть Docker Desktop.
2. Дождаться полной загрузки.
3. Повторить команду docker compose up --build.
```

## Если PostgreSQL 18 ругается на volume

В PostgreSQL 18 изменилось ожидаемое место подключения volume. В проекте volume должен подключаться к:

```text
/var/lib/postgresql
```

Если до исправления уже был создан неудачный volume, удалите его и запустите проект заново:

```powershell
docker compose down -v
docker compose up --build
```

Эта команда удалит данные БД текущего Docker-проекта. Для первого запуска это нормально.

## Если backend не стартует

Посмотреть логи:

```powershell
docker compose logs backend
```

Частые причины:

```text
1. БД ещё не готова.
2. Неверная строка подключения DATABASE_URL.
3. Ошибка в миграции.
4. Занят порт backend.
```

Проверить БД:

```powershell
docker compose ps
docker compose logs db
```

## Если frontend открылся, но backend недоступен

Проверить backend:

```powershell
docker compose ps backend
docker compose logs backend
```

Проверить API:

```powershell
Invoke-RestMethod http://localhost:4100/api/docs
```

Документация API защищена паролем, поэтому браузер должен запросить логин и пароль.

## Очистка Docker

Удалить остановленные контейнеры, неиспользуемые сети и кэш:

```powershell
docker system prune
```

Удалить ещё и неиспользуемые образы:

```powershell
docker system prune -a
```

Осторожно: эти команды чистят Docker шире, чем только текущий проект.

## Рекомендуемый рабочий набор команд

Обычный запуск:

```powershell
docker compose up --build
```

Запуск в фоне:

```powershell
docker compose up --build -d
```

Посмотреть состояние:

```powershell
docker compose ps
```

Посмотреть логи backend:

```powershell
docker compose logs -f backend
```

Остановить:

```powershell
docker compose down
```
