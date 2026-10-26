# Подключение ИИ и кредитного сценария

## Архитектура

React → Spring Boot → FastAPI AI → OpenAI-совместимый сервер Qwen.
Spring остаётся источником прав, тарифов, статусов и финансовых расчётов.
AI-запросы не вызывают create/update/submit/accept/decline и не меняют согласие или документы.

## Запуск без AI

Скопируйте .env.example в локальный .env; замените демонстрационные пароли/сервисные токены.
AI_ENABLED=false:
~~~sh
docker compose up --build
~~~
Кабинет: http://localhost:3000. Вход — кнопкой демопрофиля или demo.ip/demo.ooo/demo.risk с demo1234.
Сотрудник: employee / employee1234, кнопка «Войти как сотрудник»; открывается /bank для заявок, уточнений и ответов по неясной цели.
Основной сервер: http://localhost:8080/api/health.
Моки и документы доступны только внутри сети Compose.
Документы и версии сохраняются в SQLite и файлах в named volume uploads, заявки — в PostgreSQL.

Для проверки без Docker можно запустить Java с APP_STORAGE=memory, SPRING_FLYWAY_ENABLED=false,
Python documents-service с DATA_DIR, UPLOAD_DIR, DOCUMENTS_SERVICE_TOKEN и backend с DOCUMENTS_URL.
Фронтенд: npm ci; npm run dev — Vite проксирует /api на localhost:8080.
В memory-режиме заявки исчезают после перезапуска; Compose использует PostgreSQL.

После установки зависимостей и сборки JAR все локальные компоненты можно запустить одной командой:
`python scripts/run_local.py` (без ИИ) или `python scripts/run_local.py --ai`.
На этой Windows-машине доступен также `..\.tools\python\Scripts\python.exe scripts/run_local.py`.
Локальный запуск: http://127.0.0.1:5173; Ctrl+C завершает только запущенные скриптом процессы.
Скрипт использует memory по умолчанию; `--storage jdbc` подключает настроенный PostgreSQL.

## Запуск с Qwen

Подготовьте Ollama/vLLM согласно ai-service/README.md.
В .env задайте AI_ENABLED=true, AI_SERVICE_TOKEN, LLM_BASE_URL, LLM_MODEL_NAME и при необходимости LLM_API_TOKEN.
Локальный вариант: `ollama pull qwen3:4b-instruct-2507-q4_K_M`; точное имя уже указано в .env.example.
Для CPU согласованы таймауты модели/Java 60/65 секунд и один одновременный AI-запрос.
AI_MAX_QUEUED_REQUESTS=1 позволяет второму виджету дождаться первого; ожидание входит в таймаут.
Изменения .env применяются после перезапуска. `/health` не проверяет возможность загрузки весов в память.
~~~sh
docker compose --profile ai up --build
~~~
backend не зависит от запуска/health модели. AI отключается через AI_ENABLED=false и пересоздание backend;
если модель недоступна, AI-маршруты отвечают UNAVAILABLE, ручной сценарий сохраняется.

## Публичный контракт v1

Все маршруты требуют клиентскую сессию Bearer. Сотрудник получает 403.
GET /api/ai/capabilities → {schemaVersion:"1",enabled,features:{goalClassification,assistant}}.
POST /api/ai/goals/classify принимает {text,clarifications:[{questionCode,answer}]}.
Результат: schemaVersion,status,goals,reasonCode,questionCode,clarifyingQuestion,evidence,fallbackReason.
Статусы: CLASSIFIED / NEEDS_CLARIFICATION / NON_BUSINESS / UNSUPPORTED / UNAVAILABLE.
Категории: GOODS,ADVERTISING,EXPENSES,EQUIPMENT,REPAIR. OTHER не является результатом классификации.
Результат подтверждается клиентом; несколько категорий записываются обычным PATCH в goals без OTHER.
Исходный текст сохраняется в otherGoalText. При изменении текста прежнее подтверждение сбрасывается.

POST /api/ai/assistant принимает {message,context:{screen,applicationId,documentId},history:[{role,content}]}.
screen: HOME/CREDITS/WIZARD/APPLICATIONS/DOCUMENTS; history только user/assistant, максимум 6.
Результат: schemaVersion,status,intent,entities,questionCode,clarifyingQuestion,reply,actions,fieldErrors,fallbackReason.
entities: purposeText,goals,amount (десятичная строка),currency,termMonths; неуказанные скаляры null.
Статусы: READY / NEEDS_CLARIFICATION / NON_BUSINESS / UNSUPPORTED / UNAVAILABLE.
Намерения: START_SELECTION,CONTINUE_DRAFT,OPEN_APPLICATION,SHOW_DOCUMENT,EXPLAIN_TERMS,UNKNOWN,OUT_OF_SCOPE.
Action: {type,label,requiresConfirmation:true,applicationId?,documentId?,topic?}.
Java сериализует неприменимые необязательные поля также как null.
Каждый action проверен по владельцу и состоянию. URL и HTTP-команды модель не задаёт.

NON_BUSINESS — результат анализа личного назначения, не кредитный отказ.
При неоднозначности вопрос выбирается по закрытому questionCode.
Неполные данные можно дополнить вручную. Иные валюты не конвертируются.
Ставки и комиссии берутся из Tariff, платежи из LoanOffer; свободный финансовый текст модели не показывается.

HTTP 400 — валидация, 401/403 — доступ, 404 — чужой/отсутствующий объект.
Недоступность модели: HTTP 200, status=UNAVAILABLE, пустые категории/entities/actions.
fallbackReason: DISABLED,DEPENDENCY_UNAVAILABLE,TIMEOUT,INVALID_RESPONSE,OVERLOADED.
Интерфейс различает причины недоступности и убирает прежнюю ошибку при повторном запросе.
При сравнении цитаты допускается восстановить только регистр из исходного текста;
в JSON возвращается точная исходная подстрока. Исправление слов, опечаток или чисел не допускается.
Не передаются пароли, Bearer-токен клиента, ИНН, bankData или полный ApplicationView.
Внутренний AI API защищён отдельным сервисным токеном.

## Документы

GET /api/documents — метаданные своей компании.
POST /api/documents — multipart: file (PDF до 20 МБ), type, title, periodFrom/periodTo в YYYY-MM.
Для финансовой сводки/декларации/отчётности период обязателен.
GET /api/documents/{id}/file проверяет владельца и возвращает файл как attachment.
Java сам задаёт ИНН во внутреннем запросе, пользователь его не передаёт.
Внутренние маршруты документов требуют DOCUMENTS_SERVICE_TOKEN.
Повторная загрузка того же типа и названия создаёт новую версию, старые версии сохраняются.
Профили содержат демометаданные. Отсутствующий демонстрационный PDF возвращает 404;
загруженный пользователем PDF доступен для скачивания.

## Ручная приёмка

1. ООО с историей → товары, 1 млн, 24 мес. → два расчёта, комиссия, общая выплата.
2. Начать оформление → сохранить шаг → перезагрузить → тот же ID, поля и шаг.
3. Приложить найденную сводку → согласие → отправить → реальное решение → явно принять/отклонить.
4. ИП без сводки → NEEDS_CLARIFICATION → загрузить PDF с нужным периодом → дополнить ту же заявку.
5. Оборудование+реклама → требование документа поставщика; без него отправка блокируется.
6. Ремонт → смета и право пользования помещением. Личная цель не становится кредитным отказом.
7. Помощник: извлечённые значения показываются перед кнопкой; до нажатия ни одна заявка не меняется.
8. Выключить модель → UNAVAILABLE; пройти шаги 1–3 вручную.
9. Проверить чужой ID, запрещённый intent, некорректный JSON и обрезанный ответ.

## Автоматизированные проверки

- В backend: `./mvnw test`; интеграционные PostgreSQL-тесты требуют доступной БД, иначе пропускаются.
- В ai-service: `python -m pytest -q tests`; семантическая проверка реальной модели включается только через `RUN_QWEN_EVAL=1` с настроенным Qwen endpoint.
- В documents-service: `python -m pytest -q tests` (нужны pytest и httpx в тестовом окружении).
- В frontend: `npm ci`, `npm run build`, `npm run lint`; браузерные проверки — `npm run test:e2e`.
  Для e2e запустите backend на 8080 (AI выключен) и documents-service на 8002 с одинаковым DOCUMENTS_SERVICE_TOKEN.
  По умолчанию используется установленный Chrome; другой канал задаётся E2E_BROWSER_CHANNEL. Vite запускается тестами.
- Сквозной HTTP-контракт: `python tests/integration/ai_smoke.py --java /path/to/java` после сборки JAR.
  Этот тест сам запускает временные Java/FastAPI и HTTP-stub модели и завершает их. Он не измеряет качество Qwen.
- Экспорт схем: `python scripts/export_ai_openapi.py` (зависимости AI-сервиса должны быть установлены).
  Экспортирует `docs/openapi/ai-service.json` и публичный контракт `docs/openapi/backend-ai.json`.

Результаты выполненных проверок и оставшиеся проверки окружения: [implementation-status.md](implementation-status.md).
