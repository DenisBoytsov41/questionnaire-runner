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

Учётная запись из `ADMIN_LOGIN` автоматически создаётся или назначается главным администратором:

```text
Логин: admin
Пароль: значение ADMIN_PASSWORD из .env
```

## Запуск в Docker

Проект подготовлен к запуску в четырёх контейнерах:

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

Backend ждёт готовности PostgreSQL, применяет Prisma-миграции из `prisma/migrations` и затем запускает API.

В pgAdmin заранее добавлен сервер `Questionnaire PostgreSQL`. После входа на `http://localhost:5050` откройте `Servers -> Questionnaire PostgreSQL -> Databases -> questionnaire_runner`; если pgAdmin попросит пароль, используйте `POSTGRES_PASSWORD` из `.env`.

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
$env:ADMIN_PASSWORD="replace-with-unique-admin-password"
$env:JWT_SECRET="local-secret"
$env:SWAGGER_USER="docs"
$env:SWAGGER_PASSWORD="replace-with-unique-api-docs-secret"
npm run dev:server
```

## Миграции базы данных

Схема базы описана в [prisma/schema.prisma](prisma/schema.prisma). Новые изменения структуры делаем через Prisma: меняем схему, создаём файл миграции, проверяем его и применяем.

Локальный запуск миграций:

```powershell
npm run build:server
$env:DATABASE_URL="postgresql://questionnaire:change-me@localhost:5432/questionnaire_runner"
npm run migrate
```

Создать новую миграцию после изменения `prisma/schema.prisma`:

```powershell
npm run db:migration:create -- --name add_short_description
```

Посмотреть базу через Prisma Studio:

```powershell
npm run db:studio
```

Подробная инструкция по миграциям лежит в [docs/database-migrations.md](docs/database-migrations.md). Схема базы описана в [docs/database-design.md](docs/database-design.md).

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

По умолчанию для разработки используется логин `admin`, а пароль берётся из `ADMIN_PASSWORD`. Для нормального окружения задайте своё уникальное значение.

## Роли

```text
user      - созданный пользователь без доступа к рабочим сценариям;
operator  - оператор, может проходить опубликованные опросники;
admin     - администратор, управляет операторами и сценариями, но не может изменять других администраторов;
superadmin - главный администратор, управляет администраторами и всей системой.
```

Главный администратор определяется переменной `ADMIN_LOGIN`. Его роль и доступ нельзя изменить через API управления пользователями.

## Основные маршруты backend

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/me
PATCH /api/me/profile

GET   /api/users
PATCH /api/users/:id

GET  /api/questionnaires
GET  /api/questionnaires/:id
POST /api/admin/questionnaires/import
POST /api/admin/questionnaires/:id/publish

POST  /api/questionnaire-runs
GET   /api/questionnaire-runs
GET   /api/questionnaire-runs/:id
PATCH /api/questionnaire-runs/:id/draft
POST  /api/questionnaire-runs/:id/finish
```

## Быстрая проверка backend

```powershell
$login = Invoke-RestMethod -Method Post `
  -Uri http://localhost:4100/api/auth/login `
  -ContentType 'application/json' `
  -Body '{"login":"admin","password":"<ADMIN_PASSWORD из .env>"}'

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
