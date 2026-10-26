# Передача команде: интеграция Qwen и кредитного сценария

Дата: 26.10.2026. Рабочая ветка: `feature/ai-assistant`. Целевая ветка PR: `main`.

Этот файл можно передать участнику команды или его ИИ вместе с репозиторием.
Изменения охватывают AI, Java-бэкенд, фронтенд, документы и запуск проекта.
Их следует рассматривать вместе: интерфейс использует публичный Java API, а Java обращается к внутренним Python-сервисам.

## 1. Что получилось

Было: Java-ядро существовало отдельно, часть экранов использовала демонстрационные данные и локальное состояние,
AI-сервис отсутствовал, библиотека документов не обеспечивала полный путь загрузки и скачивания.

Теперь работает цепочка:

```text
React / TypeScript
        │ /api/*, клиентская сессия
        ▼
Java / Spring Boot
        ├── тарифы, расчёты, заявки, статусы и права доступа
        ├── FastAPI AI ── OpenAI-совместимый HTTP API ── Qwen
        └── FastAPI документов ── PDF на диске + SQLite
```

Основной кредитный сценарий доступен при отключённом AI. Предложения модели пользователь подтверждает кнопкой.
Кредитные решения, ставка, комиссия и расчёт платежа остаются в существующей банковской логике.

## 2. AI-сервис — зона Егора

Новая реализация находится в `ai-service/`:

| Файлы | Назначение |
|---|---|
| `app/main.py` | FastAPI-маршруты, сервисная авторизация, ограничения тела запроса, ответы при недоступности |
| `app/config.py` | Настройки через окружение, адрес модели, имя модели, ключ, таймауты, параллельность и очередь |
| `app/llm_client.py` | OpenAI-совместимый HTTP-клиент, JSON Schema, ограничение ответа, общий таймаут ожидания и генерации |
| `app/schemas.py` | Строгие входные и выходные модели, перечисления статусов, намерений и категорий |
| `app/validation.py` | Проверка цитат, чисел, бизнес-назначения, ссылок на объекты и согласованности полей |
| `app/prompts/goals.txt`, `app/prompts/assistant.txt` | Инструкции классификатора и помощника |
| `tests/` | Проверки API/валидации и отдельные opt-in проверки настоящей Qwen |
| `Dockerfile`, `.dockerignore`, `requirements*.txt`, `README.md` | Сборка, фиксированные зависимости и запуск |

### Разбор «Другое»

Поддерживаются `GOODS`, `ADVERTISING`, `EXPENSES`, `EQUIPMENT`, `REPAIR` — одна или несколько категорий.
Неоднозначная цель требует уточнения. Личная цель возвращает `NON_BUSINESS`, смешанная — уточнение.
`OTHER` не возвращается как результат классификации.

### Помощник

Распознаёт `START_SELECTION`, `CONTINUE_DRAFT`, `OPEN_APPLICATION`, `SHOW_DOCUMENT`, `EXPLAIN_TERMS`;
извлекает явно названные цель, сумму, валюту и срок. Неясный или посторонний запрос обрабатывается отдельно.
Контекст содержит ограниченные списки доступных объектов с временными ссылками, а не полную заявку.

Модель не возвращает исполняемые команды или произвольные ссылки. Разрешённые действия формирует Java.
Содержимое PDF в модель не отправляется и не анализируется.

### Защита и устойчивость

- Схема передаётся и в `response_format`, и в текст инструкции. Связи статуса с вопросом и пустыми полями закреплены в схеме генерации.
- После генерации проверяются типы, допустимые значения, источник цитат, числовые значения и ссылки на объекты.
- Для цитаты допустимо восстановить только исходный регистр букв. Исправленные слова, опечатки или числа таким способом не принимаются.
- Для CPU используются один выполняющийся запрос и один ожидающий. Ожидание входит в общий таймаут.
- Ошибка модели даёт `UNAVAILABLE` с кодом причины; пользователь может продолжить вручную.
- В диагностический лог пишутся тип задачи и код сбоя, без текста клиента, ответов модели и ключей.

## 3. Java-бэкенд — проверить Феде

### Новые файлы

- `backend/src/main/java/ru/creditcabinet/backend/ai/AiContracts.java` — DTO публичного AI API.
- `ai/AiGateway.java`, `ai/HttpAiGateway.java` — внутренний HTTP-вызов AI, сервисный токен, таймаут и ограничения.
- `ai/AiFacade.java` — минимизация контекста, повторная проверка результата, права, разрешённые действия и серверные пояснения условий.
- `config/AiConfig.java` — создание клиента и работа при отключённом AI.
- `web/AiController.java` — публичные AI-маршруты.
- `web/DocumentFilesController.java` — загрузка и скачивание PDF через Java с проверкой владельца.
- `backend/src/test/java/ru/creditcabinet/backend/AiFacadeTest.java`, `AiHttpTest.java`, `HttpAiGatewayTest.java` — регрессия и HTTP-проверки.

### Изменённые существующие файлы

| Файл | Изменение |
|---|---|
| `application/ApplicationService.java` | Сбрасывается старая подтверждённая категория «Другое», если изменили текст или убрали `OTHER` из выбранных целей |
| `config/AppConfig.java` | Передача сервисного токена клиенту документов |
| `profiles/HttpDocumentCatalog.java` | Авторизация внутренних запросов к сервису документов; сохранён прежний конструктор |
| `config/WebConfig.java` | Настраиваемый CORS для локального фронтенда |
| `web/ApiExceptionHandler.java` | Обработка ошибок DTO, параметров, JSON и размера загрузки |
| `src/main/resources/application.properties` | Настройки AI, документов, CORS и multipart |

Алгоритмы в `LoanCalculator`, `DecisionEngine`, правила тарифа и миграции БД этим PR не переписываются.
AI-запрос не вызывает создание, изменение, отправку, принятие или отклонение заявки.

## 4. Фронтенд — проверить Лизе

Изменён не только виджет AI: экраны связаны с фактическими API и DTO Java.

| Область | Основные файлы | Поведение |
|---|---|---|
| API и типы | `src/api/{client,auth,applications,catalog,ai}.ts`, `src/types/index.ts` | Bearer-сессия, единые ошибки, реальные DTO и маршруты |
| Сессия и навигация | `src/context/AppContext.tsx`, `src/App.tsx`, `src/pages/Login.tsx` | Вход, восстановление профиля, выход, разделение клиентского и служебного входа |
| Подбор | `src/pages/Credits.tsx` | Несколько целей, серверный тариф, два расчёта, явное начало черновика |
| Оформление | `src/pages/Wizard.tsx` | Сохранение параметров и шага, восстановление по ID, документы, согласие и отправка |
| Заявки | `src/pages/Applications.tsx` | Реальные статусы, результат, принятие/отклонение, повтор проверки и ответ на уточнение |
| Документы | `src/pages/Documents.tsx`, `src/utils/documents.ts` | Загрузка PDF, метаданные, версии и скачивание |
| Сотрудник | `src/pages/Staff.tsx` | Минимальный `/bank` для заявок и уточнений |
| AI | `src/components/ai/{OtherGoalInput,AssistantPanel}.tsx`, `src/utils/ai.ts` | Уточнение, подтверждение категорий, пять действий помощника, понятные ошибки |
| Остальные экраны | `Home.tsx`, `Product.tsx`, `components/Layout.tsx` | Согласование переходов с реальным сценарием; старый маршрут продукта направляет в подбор |
| Оформление | `src/cabinet.css`, `src/index.css`, `src/main.tsx`, `src/utils/{format,goals}.ts` | Общие стили, форматирование, подписи категорий, адаптация узких экранов |
| Сборка и проверка | `vite.config.ts`, `nginx.conf`, `Dockerfile`, `package*.json`, `.prettierrc.json`, `playwright.config.ts`, `e2e/` | Прокси `/api`, сборка, форматирование и браузерные сценарии |

Удалён несуществующий API продуктов `src/api/products.ts`. Выбранный вариант «Меньше платёж» использует фактический увеличенный срок.
Изменение текста «Другое» сбрасывает старый AI-ответ. Повторный анализ очищает прежнюю ошибку и показывает обработку.
Неизвестное намерение получает подсказку о возможностях помощника.

## 5. Документы и общий запуск — проверить Вике

`documents-service/app/main.py` дополнен фактической загрузкой PDF, выдачей файлов, метаданными SQLite,
версиями и разграничением по компании. Внутренние запросы требуют `DOCUMENTS_SERVICE_TOKEN`.
Файл должен иметь PDF-сигнатуру и размер не более 20 МБ. Для финансовых документов обязателен период.
Повторная загрузка того же типа и названия создаёт новую версию.

`documents-service/requirements.txt` фиксирует зависимости, включая `python-multipart`.
Тесты находятся в `documents-service/tests/`.

Изменены `docker-compose.yml`, `.env.example`, `.gitignore`, `README.md`, `THIRD_PARTY_NOTICES.md`.
В Compose добавлен необязательный профиль `ai`, внутренние сервисные адреса, токены и постоянное хранилище документов.
Основной backend запускается без зависимости от доступности AI.

Добавлены:

- `scripts/run_local.py` — локальный запуск без Docker; по умолчанию заявки хранятся в памяти, `--storage jdbc` выбирает PostgreSQL.
- `scripts/export_ai_openapi.py` — экспорт AI-контрактов.
- `tests/integration/ai_smoke.py` — отдельные тестовые серверы, проверка HTTP-stub или реальной модели с `--live`.
- `docs/ai-integration.md`, `docs/implementation-status.md`, `docs/openapi/*.json` — запуск, контракты и фактический статус проверок.

В актуальном `main` уже появились демо-PDF Вики, обновлённые профили и продуктовые правила Лены.
Ветка обновлена до `origin/main` (`2678e08`) без конфликтов; авторство этих изменений остаётся за соответствующими участниками.

## 6. Контракты, которые важно сохранить

| Маршрут | Назначение |
|---|---|
| `GET /api/ai/capabilities` | Включён ли AI и какие функции доступны |
| `POST /api/ai/goals/classify` | `{text, clarifications:[{questionCode,answer}]}` |
| `POST /api/ai/assistant` | `{message, context:{screen,applicationId,documentId}, history:[{role,content}]}` |
| `POST /api/documents` | Multipart: `file`, `type`, `title`, `periodFrom`, `periodTo` |
| `GET /api/documents/{id}/file` | Скачивание файла своей компании |

AI-маршруты требуют клиентскую сессию; сотрудник не вызывает их как клиент.
Идентификаторы объектов проверяются по владельцу. Во внутренний сервис Java передаёт временные ссылки.
Публичный JSON содержит `schemaVersion="1"`, статус, результат и `fallbackReason`; результат помощника также содержит `actions` и `fieldErrors`.
Сумма передаётся десятичной строкой, срок — целым числом месяцев; неуказанные скаляры — `null`.
При недоступности модели используется HTTP 200 со статусом `UNAVAILABLE` и пустыми предложениями.

Внутренние маршруты: `GET /health`, `POST /v1/goals/classify`, `POST /v1/assistant`.
`/health` подтверждает работу сервиса, но не проверяет загрузку весов в память.
Точные схемы и примеры: [ai-integration.md](ai-integration.md), [openapi/ai-service.json](openapi/ai-service.json), [openapi/backend-ai.json](openapi/backend-ai.json).

## 7. Настройки и запуск

Используется Qwen3-4B-Instruct-2507 с открытыми весами Apache-2.0, Ollama-тег `qwen3:4b-instruct-2507-q4_K_M`.
Qwen3 8B на проверявшемся компьютере не загрузилась из-за нехватки памяти.
Размер файла модели около 2,5 ГБ; во время работы требуется дополнительная память.
Настоящие веса, ключи, `.env`, загрузки и локальные логи в PR не включаются.

| Настройка | Значение/смысл |
|---|---|
| `AI_ENABLED` | В примере `false`; локальный `--ai` включает AI для дочерних процессов |
| `AI_SERVICE_TOKEN` | Отдельный токен Java → AI |
| `DOCUMENTS_SERVICE_TOKEN` | Отдельный токен Java → документы |
| `LLM_BASE_URL` | `http://localhost:11434/v1` с хоста; из Compose обычно `http://host.docker.internal:11434/v1` |
| `LLM_API_TOKEN` | Ключ сервера модели при необходимости; для локального Ollama обычно пустой |
| `LLM_MODEL_NAME` | `qwen3:4b-instruct-2507-q4_K_M` |
| `LLM_PROVIDER` | Проверен `ollama`; предусмотрен вариант `vllm` |
| `LLM_REQUEST_TIMEOUT_MS` / `AI_TIMEOUT_MS` | 60000 / 65000 |
| `AI_MAX_CONCURRENT_REQUESTS` / `AI_MAX_QUEUED_REQUESTS` | Один выполняющийся и один ожидающий запрос |

После установки зависимостей, сборки JAR и подготовки локального `.env`:

```powershell
ollama pull qwen3:4b-instruct-2507-q4_K_M
python scripts/run_local.py --ai
```

На подготовленном компьютере Егора вместо `python` доступен `..\.tools\python\Scripts\python.exe`.
Кабинет: `http://127.0.0.1:5173`. Изменения `.env` требуют перезапуска.
В режиме `memory` перезапуск удаляет заявки и сессии; PDF и SQLite сохраняются в `uploads/`.
Вариант общего запуска: `docker compose --profile ai up --build` с `AI_ENABLED=true`.
Подробная подготовка окружения: [ai-service/README.md](../ai-service/README.md) и [ai-integration.md](ai-integration.md).

## 8. Что проверено и что остаётся

- AI-сервис: 38 тестов API, валидации, очереди, отмены и таймаута.
- Реальная Qwen: 24 сценария — 16 классификаций и 8 сценариев помощника.
- Сквозной Java → FastAPI → Qwen: два одновременных виджета, извлечение параметров, разрешённые действия, отсутствие AI-записей и ручной сценарий после отключения AI.
- Аналогичный сквозной тест с HTTP-stub прошёл.
- Документы: 3 теста, включая скачивание новых PDF из main и запрет доступа другой компании.
- Java: 12 тестов; регрессия ядра включает 39 внутренних проверок. Четыре PostgreSQL-теста ранее пропущены без запущенной БД.
- Frontend build и lint прошли. Пять браузерных сценариев проходили на предыдущем этапе; последние изменения AI-интерфейса и мобильного layout повторно в Chrome не проверялись.
- Docker Compose и PostgreSQL остаются обязательной проверкой команды перед merge/демонстрацией.
- vLLM предусмотрен конфигурацией, но в этом окружении проверялся Ollama.

Детальный и актуализируемый отчёт: [implementation-status.md](implementation-status.md).

## 9. На что посмотреть участникам при review

| Участник | Проверка |
|---|---|
| Федя | Java DTO и маршруты, права на заявки/документы, состояние «Другое», совместимость с JDBC и действующими правилами |
| Лиза | Формы, реальные статусы, восстановление шага, подтверждение AI, применение параметров только по кнопке, адаптация экрана |
| Вика | Compose/PostgreSQL, сервисные токены, постоянные хранилища, новые демо-PDF и повторное использование документов |
| Лена | Сквозной путь клиента и тексты, неоднозначные/личные цели, уточнения и ручной сценарий без AI |
| Егор | Модель, промпты, структурированные ответы, проверка данных, таймауты/очередь и opt-in оценка Qwen |

Отдельный UX-пункт для Лены и Лизы: текущий `Product.tsx` перенаправляет в подбор;
выделенную страницу продукта из продуктового сценария нужно согласовать при review.

При дальнейших изменениях сохраняйте публичные DTO или одновременно обновляйте Java, фронтенд, Python и OpenAPI.
Не передавайте управление состоянием заявки модели: подтверждение и права остаются в приложении.

## 10. Полный список файлов PR

Ниже приводится автоматически сверенный список относительно актуального `origin/main`.
`A` — добавлен, `M` — изменён, `D` — удалён, `Rxxx` — Git распознал переименование.

<!-- PR_FILE_INVENTORY -->

```text
M	.env.example
M	.gitignore
M	README.md
M	THIRD_PARTY_NOTICES.md
A	ai-service/.dockerignore
A	ai-service/Dockerfile
A	ai-service/README.md
R100	ai-service/.gitkeep	ai-service/app/__init__.py
A	ai-service/app/config.py
A	ai-service/app/llm_client.py
A	ai-service/app/main.py
A	ai-service/app/prompts/assistant.txt
A	ai-service/app/prompts/goals.txt
A	ai-service/app/schemas.py
A	ai-service/app/validation.py
A	ai-service/requirements-dev.txt
A	ai-service/requirements.txt
A	ai-service/tests/test_api.py
A	ai-service/tests/test_live_assistant.py
A	ai-service/tests/test_live_model.py
A	backend/src/main/java/ru/creditcabinet/backend/ai/AiContracts.java
A	backend/src/main/java/ru/creditcabinet/backend/ai/AiFacade.java
A	backend/src/main/java/ru/creditcabinet/backend/ai/AiGateway.java
A	backend/src/main/java/ru/creditcabinet/backend/ai/HttpAiGateway.java
M	backend/src/main/java/ru/creditcabinet/backend/application/ApplicationService.java
A	backend/src/main/java/ru/creditcabinet/backend/config/AiConfig.java
M	backend/src/main/java/ru/creditcabinet/backend/config/AppConfig.java
M	backend/src/main/java/ru/creditcabinet/backend/config/WebConfig.java
M	backend/src/main/java/ru/creditcabinet/backend/profiles/HttpDocumentCatalog.java
A	backend/src/main/java/ru/creditcabinet/backend/web/AiController.java
M	backend/src/main/java/ru/creditcabinet/backend/web/ApiExceptionHandler.java
A	backend/src/main/java/ru/creditcabinet/backend/web/DocumentFilesController.java
M	backend/src/main/resources/application.properties
A	backend/src/test/java/ru/creditcabinet/backend/AiFacadeTest.java
A	backend/src/test/java/ru/creditcabinet/backend/AiHttpTest.java
A	backend/src/test/java/ru/creditcabinet/backend/HttpAiGatewayTest.java
M	docker-compose.yml
A	docs/ai-integration.md
M	docs/api.md
A	docs/implementation-status.md
D	docs/openapi/.gitkeep
A	docs/openapi/ai-service.json
A	docs/openapi/backend-ai.json
A	docs/team-handoff-ai-integration.md
M	documents-service/app/main.py
M	documents-service/requirements.txt
A	documents-service/tests/test_documents.py
A	frontend/.prettierrc.json
M	frontend/Dockerfile
A	frontend/e2e/cabinet.spec.ts
M	frontend/nginx.conf
M	frontend/package-lock.json
M	frontend/package.json
A	frontend/playwright.config.ts
M	frontend/src/App.tsx
A	frontend/src/api/ai.ts
M	frontend/src/api/applications.ts
M	frontend/src/api/auth.ts
A	frontend/src/api/catalog.ts
M	frontend/src/api/client.ts
D	frontend/src/api/products.ts
A	frontend/src/cabinet.css
M	frontend/src/components/Layout.tsx
A	frontend/src/components/ai/AssistantPanel.tsx
A	frontend/src/components/ai/OtherGoalInput.tsx
M	frontend/src/context/AppContext.tsx
M	frontend/src/index.css
M	frontend/src/main.tsx
M	frontend/src/pages/Applications.tsx
M	frontend/src/pages/Credits.tsx
M	frontend/src/pages/Documents.tsx
M	frontend/src/pages/Home.tsx
M	frontend/src/pages/Login.tsx
M	frontend/src/pages/Product.tsx
A	frontend/src/pages/Staff.tsx
M	frontend/src/pages/Wizard.tsx
M	frontend/src/types/index.ts
A	frontend/src/utils/ai.ts
A	frontend/src/utils/documents.ts
M	frontend/src/utils/format.ts
A	frontend/src/utils/goals.ts
M	frontend/vite.config.ts
A	scripts/export_ai_openapi.py
A	scripts/run_local.py
A	tests/integration/ai_smoke.py
```
