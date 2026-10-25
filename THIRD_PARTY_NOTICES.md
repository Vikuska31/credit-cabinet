# Сторонние компоненты

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
| FastAPI | 0.115.0 | MIT | mocks, documents-service | REST-сервисы на Python |
| Uvicorn | 0.30.6 | BSD-3-Clause | mocks, documents-service | Запуск FastAPI |
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

Модель ИИ-помощника (заполняет Егор): _название, источник весов, лицензия_. Используются только модели с открытыми весами, платные API не нужны.

## Смоделированные интеграции

Реальные внешние сервисы не вызываются.

- Банковские источники (реестр, БКИ, счета клиента): имитируются сервисом `mocks/`, у backend есть клиент `profiles/HttpBankDataSource`.
- Библиотека документов компании: сервис `documents-service/`, у backend есть клиент `profiles/HttpDocumentCatalog`. Документы берутся из демопрофилей.
- Подписание и выдача кредита: демонстрационные, юридической силы и реальных денег нет.

## Материалы, использованные при подготовке тестовых документов

Тестовые PDF в `data/demo-documents/` подготовлены с помощью библиотеки ReportLab (BSD-3-Clause) и шрифта Liberation Sans (SIL Open Font License 1.1). Инструменты использовались только при разработке и не входят в запускаемое решение.
