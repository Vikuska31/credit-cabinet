# Сторонние компоненты

## Интеграция AI и документов
- Qwen3-4B-Instruct-2507: открытые веса, Apache-2.0, https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507. Ollama: qwen3:4b-instruct-2507-q4_K_M. Веса в репозиторий не включены. Qwen3-8B остаётся возможной альтернативой при достаточной памяти.
- Ollama или vLLM: отдельный исполнитель модели, OpenAI-совместимый HTTP API; версия исполнителя закрепляется в окружении команды.
- AI-сервис: FastAPI 0.115.12 (MIT), Uvicorn 0.34.3 (BSD-3-Clause), Pydantic 2.11.10 (MIT), pydantic-settings 2.10.1 (MIT), HTTPX 0.28.1 (BSD-3-Clause).
- Документы: python-multipart 0.0.20 (Apache-2.0), SQLite из стандартной библиотеки Python.
- Проверки: pytest 8.4.2 (MIT), pytest-asyncio 1.2.0 (Apache-2.0).
- Браузерные проверки: Playwright 1.56.1 (Apache-2.0); форматирование: Prettier 3.6.2 (MIT).

Список чужих компонентов, моделей, датасетов и сервисов, которые использует решение, и смоделированных интеграций. Каждый участник дописывает сюда то, что подключает.

## Библиотеки и образы

| Компонент | Версия | Лицензия | Где | Назначение |
|---|---|---|---|---|
| Spring Boot (web, jdbc, validation) | 4.1.2 | Apache 2.0 | backend | Основной сервер, REST |
| Flyway (core, PostgreSQL) | из Spring Boot 4.1.2 | Apache 2.0 | backend | Миграции БД |
| PostgreSQL JDBC Driver | из Spring Boot 4.1.2 | BSD-2-Clause | backend | Подключение к БД |
| Jackson 3 (tools.jackson) | из Spring Boot 4.1.2 | Apache 2.0 | backend | JSON |
| JUnit 5 | из Spring Boot 4.1.2 | EPL 2.0 | backend (тесты) | Тесты |
| Eclipse Temurin JDK/JRE | 21 | GPL 2.0 with Classpath Exception | образ backend | Сборка и запуск |
| FastAPI | 0.115.0 в mocks; 0.115.12 в documents-service и ai-service | MIT | Python-сервисы | REST |
| Uvicorn | 0.30.6 в mocks; 0.34.3 в documents-service и ai-service | BSD-3-Clause | Python-сервисы | Запуск FastAPI |
| Python (образ `python:3.12-slim`) | 3.12 | PSF License (в образе также пакеты Debian со своими лицензиями) | mocks, documents-service | Запуск Python-сервисов |
| postgres | 16 | PostgreSQL License | docker-compose | База данных |
| Docker Compose | актуальная при запуске | Apache 2.0 | запуск | Запуск всех сервисов одной командой |

## Клиентская часть (проверяет Лиза)

| Компонент | Версия | Лицензия | Где | Назначение |
|---|---|---|---|---|
| React, React DOM | 19.x | MIT | frontend | Интерфейс |
| React Router | 7.x | MIT | frontend | Переходы между страницами |
| Alfa Lab Core Components (`@alfalab/core-components`) | 50.x | MIT (проверить в репозитории пакета) | frontend | Готовые элементы интерфейса |
| Vite | 8.x | MIT | frontend (сборка) | Сборка сайта |
| TypeScript | 6.0.x | Apache 2.0 | frontend (сборка) | Проверка типов |
| Node.js (образ `node:22-alpine`) | 22 | MIT | образ frontend (сборка) | Сборка сайта |
| nginx (образ `nginx:1.27-alpine`) | 1.27 | BSD-2-Clause | образ frontend | Отдача сайта и передача запросов к API |

Внешний ресурс во время работы: картинка банковской карты на экране входа загружается с CDN библиотеки Alfa Lab. Без интернета она не показывается, остальное работает.

## Модели и датасеты

Сторонние датасеты не используются. Все данные синтетические: профили компаний, банковские сведения и документы в папке `data/` вымышлены.

ИИ-помощник: Qwen3-4B-Instruct-2507, источник весов и лицензия указаны выше. Локальная конфигурация использует открытые веса через Ollama; платный API не требуется.

## Смоделированные интеграции

Реальные внешние сервисы не вызываются.

- Банковские источники (реестр, БКИ, счета клиента): имитируются сервисом `mocks/`, у backend есть клиент `profiles/HttpBankDataSource`.
- Библиотека документов компании: сервис `documents-service/`, у backend есть клиент `profiles/HttpDocumentCatalog`. Начальные документы берутся из демопрофилей; пользовательские PDF, версии и метаданные сохраняются сервисом.
- Подписание и выдача кредита: демонстрационные, юридической силы и реальных денег нет.

## Материалы, использованные при подготовке тестовых документов

Тестовые PDF в `data/demo-documents/` подготовлены с помощью библиотеки ReportLab (BSD-3-Clause) и шрифта Liberation Sans (SIL Open Font License 1.1). Инструменты использовались только при разработке и не входят в запускаемое решение.
