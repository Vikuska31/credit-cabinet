# backend — ядро (Федя)

Java 21, Spring Boot 4.1.2, Maven, PostgreSQL. Бизнес-логика на чистой Java (без зависимости от Spring), поверх неё пакеты `config` (сборка бинов), `web` (REST), `storage` и `profiles` (внешние данные).

## Что внутри (`src/main/java/ru/creditcabinet/backend`)

| Пакет | Назначение |
|---|---|
| `tariff` | Синтетический тариф, аннуитетный калькулятор, два расчёта, график платежей, цели и подсказки |
| `decision` | Решение по явным правилам: отказ / нужны сведения / одобрение / встречное предложение, с причинами |
| `application` | Заявка, состояния и переходы, черновик, отправка без дублей, уточнения, принятие, демо-выдача |
| `auth` | Вход по паролю (PBKDF2) и по кнопке демопрофиля, роли CLIENT/EMPLOYEE, профиль компании |
| `inquiry` | Запрос сотруднику по неясной цели «Другое» |
| `notification` | Уведомления клиенту и сотрудникам |
| `bank`, `application.DocumentCatalog` | Интерфейсы источников и библиотеки документов |
| `profiles` | Чтение профилей Вики, клиенты к её мокам и `documents-service` |
| `storage` | Хранение в PostgreSQL (JDBC): заявки, уведомления, вопросы по цели |

## Запуск и проверка

```bash
docker compose up -d db          # PostgreSQL на localhost:5432 (из корня репозитория, нужен .env)
cd backend
./mvnw spring-boot:run           # http://localhost:8080
./mvnw test                      # ядро + HTTP-сценарии; тест на PostgreSQL пропускается, если БД не запущена
```

Без БД для быстрой отладки: `APP_STORAGE=memory ./mvnw spring-boot:run` (отключите Flyway: `SPRING_FLYWAY_ENABLED=false`).

### Переменные окружения

| Переменная | По умолчанию | Назначение |
|---|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | localhost, 5432, credit_cabinet, app, change_me | PostgreSQL |
| `PROFILES_FILE` | `../data/demo-profiles/profiles.json` | Демопрофили Вики (в контейнере `/data/demo-profiles/profiles.json`) |
| `MOCKS_URL` | пусто | Моки банковских источников, например `http://mocks:8001`. Пусто = читать `bank_data` из `profiles.json` |
| `DOCUMENTS_URL` | пусто | `documents-service`. Пусто = документы из `profiles.json` |
| `APP_TODAY` | пусто | Зафиксировать «сегодня» для демо (`2026-10-26`). Без этого с 1 ноября демо-сводки (июль–сентябрь) перестанут считаться актуальными, и ООО будет получать запрос уточнения вместо одобрения |
| `STAFF_LOGIN`, `STAFF_PASSWORD` | employee, employee1234 | Запасной сотрудник, если в `profiles.json` нет секции `employees` |

### Контейнер

```bash
docker build -t credit-cabinet-backend backend
```
Пример сервиса для `docker-compose.yml` (подключает Вика):
```yaml
  backend:
    build: ./backend
    env_file: .env
    environment:
      DB_HOST: db
      MOCKS_URL: http://mocks:8001
      PROFILES_FILE: /data/demo-profiles/profiles.json
    volumes:
      - ./data:/data:ro
    depends_on:
      db:
        condition: service_healthy
    ports:
      - "8080:8080"
```

REST-описание: `docs/api.md`. Модель данных: `docs/data-model.md`. Состояния заявки: `docs/state-diagram.md`.
Тестовые входы: `demo.ip`, `demo.ooo`, `demo.risk` (пароль `demo1234`) и кнопки демопрофилей; сотрудник `employee` / `employee1234` через `/api/auth/staff/login`.

## Допущения, которые нужно утвердить

Числа тарифа в `tariff/Tariff.java` придуманы для прототипа: 300 тыс. – 10 млн ₽, 6–60 мес., 21% годовых, комиссия 1%, допустимая долговая нагрузка 35% от среднемесячных поступлений, просрочка в прошлом не больше 30 дней, бизнесу не меньше 6 мес.
Учётка сотрудника `employee` / `employee1234` — тестовая, в `profiles.json` её нет.

## Документы

Логика в `domain/DocumentRequirements.java`: экспресс-комплект (сумма до 3 млн ₽) и полный пакет выше порога; документы под цели (оборудование, ремонт). Паспорт, ИНН, ЕГРЮЛ/ЕГРИП, устав и бенефициары у действующего клиента уже в карточке банка и не запрашиваются. Набор собран по российской практике, это не политика Альфа-Банка.
