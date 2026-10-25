# AI-сервис кредитного кабинета

Python/FastAPI-сервис распознаёт цель и намерение. Он не имеет доступа к БД и API изменения заявки.
Единственная внешняя зависимость — Qwen через POST {LLM_BASE_URL}/chat/completions.

## Запуск

Python 3.12/3.13:
~~~sh
python -m venv .venv
# Linux/macOS: source .venv/bin/activate
# Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8003
~~~

Передайте через окружение AI_ENABLED=true, AI_SERVICE_TOKEN и LLM_BASE_URL (с /v1), LLM_MODEL_NAME.
LLM_API_TOKEN нужен только если сервер модели требует авторизацию.
Никакие реальные ключи не коммитятся; .env.example содержит только образцы.

Локальная конфигурация использует Qwen3-4B-Instruct-2507 с открытыми весами Apache 2.0:
https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507

Локальный Ollama:
~~~sh
ollama pull qwen3:4b-instruct-2507-q4_K_M
ollama serve
~~~
Для Python на хосте: LLM_BASE_URL=http://localhost:11434/v1, LLM_PROVIDER=ollama, LLM_MODEL_NAME=qwen3:4b-instruct-2507-q4_K_M.
Для Compose: LLM_BASE_URL=http://host.docker.internal:11434/v1. Сервер модели должен быть доступен контейнеру.
Ollama совместимость: https://docs.ollama.com/api/openai-compatibility
Используется точный Instruct-тег: плавающий qwen3:4b может указывать на Thinking-вариант.
Файл Q4 занимает около 2,5 ГБ; фактическая потребность в памяти больше размера файла.

vLLM: запустите Qwen/Qwen3-8B на доступном GPU, задайте LLM_PROVIDER=vllm,
LLM_MODEL_NAME=Qwen/Qwen3-8B и адрес /v1. Клиент отправляет chat_template_kwargs.enable_thinking=false.
Поддержку JSON Schema нужно проверять на выбранной версии исполнителя:
https://docs.vllm.ai/en/latest/features/structured_outputs/

Не включайте thinking для этих коротких структурированных задач. Ответы с обрезанным JSON,
tool_calls, неизвестными полями, неподтверждёнными числами и категориями отбрасываются.
Таймаут модели меньше Java-таймаута; на медленном CPU согласованно увеличьте оба.
Размер модели, квантование и фактическое качество определяются испытанием на оборудовании команды.
Для локального CPU: LLM_REQUEST_TIMEOUT_MS=60000, AI_TIMEOUT_MS=65000, AI_MAX_CONCURRENT_REQUESTS=1.
AI_MAX_QUEUED_REQUESTS=1 допускает ещё один ожидающий запрос, чтобы классификатор и помощник
могли работать одновременно. Ожидание входит в общий таймаут 60 секунд; заполненная очередь
возвращает OVERLOADED. Нулевое значение отключает очередь.

## API

GET /health не вызывает модель.
POST /v1/goals/classify и /v1/assistant требуют Authorization: Bearer <AI_SERVICE_TOKEN>.
Тела/схемы доступны в /openapi.json. Публичные запросы идут через /api/ai/* Java-бэкенда.
Сервис возвращает только структурированный анализ. Кнопки, вопросы и финансовые пояснения формирует Java.
При отсутствии конфигурации/модели возвращается UNAVAILABLE, без фиктивной классификации.

## Тесты

~~~sh
pip install -r requirements-dev.txt
python -m pytest -q tests
~~~
Тесты транспорта используют HTTP-stub, проверяют контракт и защитные проверки. Они не измеряют качество реальной Qwen.

Для реальной модели задайте RUN_QWEN_EVAL=1, LLM_BASE_URL, LLM_MODEL_NAME и выполните
`python -m pytest tests/test_live_model.py tests/test_live_assistant.py -q`.
Набор проверяет категории, неоднозначные и личные цели, извлечение суммы/срока и пять намерений.

Сквозная проверка Java → FastAPI → настоящая Qwen из корня репозитория:
`python tests/integration/ai_smoke.py --live --java "путь/к/java"`.
Она поднимает временные серверы на свободных портах и отдельное memory-хранилище,
проверяет отсутствие изменений от AI и ручную работу после остановки своего AI-сервиса.
Без `--live` используется HTTP-stub для проверки контракта.

## Если интерфейс пишет, что помощник недоступен

`/health` подтверждает работу Python-сервиса, но не загружает модель. Даже наличие модели в
`ollama list` не гарантирует, что ей хватит памяти для ответа. Проверяйте реальный запрос.
При HTTP 500 от Ollama с `unable to allocate CPU_REPACK buffer` не хватает памяти для загрузки.
На этой машине Qwen3 8B потребовала дополнительный буфер около 3,1 ГБ и не загрузилась.
Освободите память или используйте меньшую Instruct-модель; не отключайте валидацию ответа.
Статус UNAVAILABLE и ручной сценарий при этом ожидаемы.
В .run/ai.log записывается только тип задачи и код причины сбоя (например OVERLOADED/TIMEOUT),
без текста клиента, ответов модели и ключей. Интерфейс показывает причину понятным сообщением.

После изменения .env перезапустите процессы. Для общего локального запуска: Ctrl+C в его терминале,
затем из корня репозитория `..\.tools\python\Scripts\python.exe scripts/run_local.py --ai`.
В режиме memory перезапуск backend удалит тестовые заявки и сессии; загруженные PDF сохранятся.
В окружении с PostgreSQL используйте `--storage jdbc`.
