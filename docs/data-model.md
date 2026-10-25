# data-model

БД: PostgreSQL 16. Миграции: `backend/src/main/resources/db/migration/` (Flyway, применяются при старте backend).

```mermaid
erDiagram
    applications {
        text id PK
        bigint number UK "сквозной номер заявки"
        text company_inn
        text status "ApplicationStatus"
        numeric amount
        int term_months
        timestamptz updated_at
        jsonb data "полное состояние заявки"
    }
    notifications {
        bigserial id PK
        text recipient "ИНН компании или employees"
        text text
        text application_id
        timestamptz created_at
        boolean read
    }
    goal_inquiries {
        text id PK
        text company_inn
        text text
        text status "OPEN / ANSWERED"
        text suggested_category
        text employee_message
        timestamptz created_at
        timestamptz answered_at
    }
    applications ||--o{ notifications : "application_id (необязательно)"
```

## Что где хранится

| Данные | Где |
|---|---|
| Заявки: цели, сумма, срок, шаг, ответы, список приложенных документов, отправленный расчёт, решение и причины, снимок банковских сведений, окончательное предложение, история событий | `applications`: поля для поиска в колонках, остальное в `data` (JSONB, формат — `LoanApplication.Snapshot`) |
| Уведомления клиенту и сотрудникам | `notifications` |
| Вопросы сотруднику по неясной цели «Другое» | `goal_inquiries` |
| Клиенты, карточки компаний, логины | не в БД: читаются из `data/demo-profiles/profiles.json` при старте, пароли хешируются (PBKDF2) в памяти |
| Сессии (токены входа) | в памяти backend: после перезапуска нужно войти заново |
| Файлы и версии документов | не в backend: `documents-service` (или секция `documents` в `profiles.json`) |
| Банковские сведения | не хранятся постоянно: запрашиваются у моков при отправке заявки, результат сохраняется в заявке как снимок |

Почему JSONB: заявка богатая (вложенные решения, история, снимки сведений) и меняется вместе с продуктом, при этом искать по ней нужно только по номеру, компании и статусу.
