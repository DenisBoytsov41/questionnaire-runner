# Questionnaire Runner

Web-интерфейс для прохождения сценариев первой линии и первый backend для хранения сценариев, пользователей и результатов.

## Frontend

```powershell
npm run dev
npm run build
```

Frontend работает как автономный runner: можно загрузить файл сценария из 1С, пройти опросник, скопировать итог и скачать файл результата.

## Backend

Первый backend лежит в папке `server`. Сейчас он использует файловое хранилище `server/data/storage.json`, чтобы быстро проверить модель без установки базы данных. Файл хранилища не коммитится.

```powershell
npm run build:server
npm run dev:server
```

По умолчанию сервер запускается на `http://localhost:4100`.

Если хранилища ещё нет, автоматически создаётся администратор:

```text
Логин: admin
Пароль: admin123
```

Для локальной разработки можно переопределить:

```powershell
$env:ADMIN_LOGIN="admin"
$env:ADMIN_PASSWORD="strong-password"
$env:JWT_SECRET="local-secret"
npm run dev:server
```

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
