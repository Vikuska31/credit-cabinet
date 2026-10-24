# Сторонние компоненты

## Библиотеки и образы
| Компонент | Версия | Где | Назначение |
|---|---|---|---|
| Spring Boot (web, jdbc, validation) | 4.1.2 | backend | Основной сервер, REST |
| Flyway (core, PostgreSQL) | из Spring Boot 4.1.2 | backend | Миграции БД |
| PostgreSQL JDBC Driver | из Spring Boot 4.1.2 | backend | Подключение к БД |
| Jackson 3 (tools.jackson) | из Spring Boot 4.1.2 | backend | JSON |
| JUnit 5 | из Spring Boot 4.1.2 | backend (тесты) | Тесты |
| Eclipse Temurin JDK/JRE | 21 | образ backend | Сборка и запуск |
| postgres | 16 | docker-compose | База данных |

## Модели и датасеты

## Смоделированные интеграции
- Банковские источники (реестр, БКИ, счета клиента): имитируются сервисом `mocks/`, у backend есть клиент `profiles/HttpBankDataSource`.
- Подписание и выдача кредита: демонстрационные, юридической силы и реальных денег нет.
