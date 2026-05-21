# Questionnaire Runner

Web-интерфейс для прохождения сценариев первой линии и backend для хранения сценариев, пользователей и результатов.

## Быстрый запуск frontend

```powershell
npm run dev
npm run build
```

Frontend работает как автономный интерфейс оператора: можно загрузить файл сценария из 1С, пройти опросник, скопировать итог и скачать файл результата.

## Быстрый запуск backend

Backend находится в папке `server` и работает с PostgreSQL через переменную `DATABASE_URL`.

```powershell
npm run build:server
$env:DATABASE_URL="postgresql://questionnaire:change-me@localhost:5432/questionnaire_runner"
npm run migrate
npm run dev:server
```

По умолчанию сервер запускается на `http://localhost:4100`.

Если в таблице пользователей ещё нет записей, автоматически создаётся администратор:

```text
Логин: admin
Пароль: admin123
```

## Запуск в Docker

Проект подготовлен к запуску в трёх контейнерах:

```text
frontend  - web-интерфейс
backend   - API
db        - PostgreSQL
pgadmin   - web-интерфейс управления PostgreSQL
```

Запуск:

```powershell
docker compose up --build
```

После запуска:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:4100
Проверка backend: http://localhost:4100/api/health
Документация API: http://localhost:4100/api/docs
PostgreSQL: localhost:5432
pgAdmin:  http://localhost:5050
```

Backend ждёт готовности PostgreSQL, применяет миграции из `db/migrations` и затем запускает API.

Подробная инструкция по Docker-командам лежит в [docs/docker-commands.md](docs/docker-commands.md).

Красивый просмотр логов всех контейнеров:

```powershell
npm run docker:logs
```

## Переменные окружения

Пример файла окружения лежит в [.env.example](.env.example).

Для локальной разработки можно переопределить:

```powershell
$env:ADMIN_LOGIN="admin"
$env:ADMIN_PASSWORD="strong-password"
$env:JWT_SECRET="local-secret"
$env:SWAGGER_USER="docs"
$env:SWAGGER_PASSWORD="docs-password"
npm run dev:server
```

## Миграции базы данных

Миграции лежат в папке `db/migrations`.

Локальный запуск миграций:

```powershell
npm run build:server
$env:DATABASE_URL="postgresql://questionnaire:change-me@localhost:5432/questionnaire_runner"
npm run migrate
```

Схема будущей базы описана в [docs/database-design.md](docs/database-design.md).

## Документация API

Закрытая документация доступна после запуска backend:

```text
http://localhost:4100/api/docs
```

Доступ защищён отдельным логином и паролем из переменных:

```text
SWAGGER_USER
SWAGGER_PASSWORD
```

По умолчанию для разработки используются `admin` / `admin123`, но для нормального окружения их нужно заменить.

## Роли

```text
user      - созданный пользователь без доступа к рабочим сценариям;
operator  - оператор, может проходить опубликованные опросники;
admin     - администратор, может импортировать сценарии, управлять пользователями и видеть все результаты.
```

## Основные маршруты backend

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/me

GET   /api/users
PATCH /api/users/:id

GET  /api/questionnaires
GET  /api/questionnaires/:id
POST /api/admin/questionnaires/import

POST  /api/questionnaire-runs
PATCH /api/questionnaire-runs/:id/draft
POST  /api/questionnaire-runs/:id/finish
GET   /api/questionnaire-runs
```

## Быстрая проверка backend

```powershell
$login = Invoke-RestMethod -Method Post `
  -Uri http://localhost:4100/api/auth/login `
  -ContentType 'application/json' `
  -Body '{"login":"admin","password":"admin123"}'

$token = $login.token
$json = Get-Content -Path 'public/questionnaires/Чек-лист звонка по ККТ.json' -Raw -Encoding utf8

Invoke-RestMethod -Method Post `
  -Uri http://localhost:4100/api/admin/questionnaires/import `
  -ContentType 'application/json' `
  -Headers @{ Authorization = "Bearer $token" } `
  -Body $json

Invoke-RestMethod -Method Get `
  -Uri http://localhost:4100/api/questionnaires `
  -Headers @{ Authorization = "Bearer $token" }
```
