# api

## Внешнее API (браузер ↔ backend, Федя)

Все пути с префиксом `/api`. Вход возвращает `token`, дальше заголовок `Authorization: Bearer <token>`.
Ошибки: `{ "code", "message", "fieldErrors": [{ "field", "message" }] }`. Коды: 400 ошибка полей, 401 нет входа, 403 нет прав, 404 не найдено (в том числе чужая заявка), 409 недопустимое действие в этом состоянии.

### Вход и профиль
| Метод и путь | Назначение |
|---|---|
| `POST /auth/login` `{login, password}` | Вход клиента |
| `POST /auth/staff/login` `{login, password}` | Вход сотрудника (отдельный, клиентский вход прав банка не даёт) |
| `GET /auth/demo-profiles` | Кнопки: ИП новичок / ООО с историей / Риск просрочки |
| `POST /auth/demo-login` `{profileId}` | Вход демопрофилем |
| `POST /auth/logout`, `GET /me`, `GET /profile` | Выход, кто я, профиль компании |

### Кредиты и документы
| Метод и путь | Назначение |
|---|---|
| `GET /goals`, `GET /tariff` | Цели с подсказками, диапазоны тарифа |
| `POST /offers/preview` `{goals, amount, termMonths}` | Подсказки и два расчёта |
| `GET /documents` | Библиотека документов компании |
| `GET /documents/already-on-file` | Что уже есть в карточке банка |

### Заявки (клиент)
| Метод и путь | Назначение |
|---|---|
| `POST /applications` | Создать черновик |
| `PATCH /applications/{id}` | Сохранить шаг (поля `DraftUpdate`, `null` = не менять) |
| `GET /applications[?status=]`, `GET /applications/{id}` | Список и карточка (у сотрудника видны `bankData`) |
| `GET /applications/{id}/documents` | Комплект: что нужно, приложено, найдено в библиотеке |
| `POST /applications/{id}/documents/attach-suggested` | «Приложим найденные файлы» |
| `POST /applications/{id}/submit` | Отправить заявку (повтор не создаёт дубль) |
| `POST /applications/{id}/clarification-response` | «Дополнить» |
| `POST /applications/{id}/accept`, `/decline` | Принять условия (демо-выдача) / отказаться |
| `POST /applications/{id}/retry-check` | Повторить проверку после сбоя |
| `GET /applications/{id}/schedule` | График платежей |

### Сотрудник
| Метод и путь | Назначение |
|---|---|
| `GET /applications` | Все отправленные заявки (черновики скрыты) |
| `POST /staff/applications/{id}/clarification-requests` `{field, documentType, message}` | Запрос уточнения |
| `GET /staff/goal-inquiries`, `POST /staff/goal-inquiries/{id}/answer` `{category, message}` | Неясные цели |

### Прочее
`POST /goal-inquiries {text}`, `GET /goal-inquiries` — «Передать вопрос сотруднику»; `GET /notifications`, `POST /notifications/{id}/read`; `GET /health`.

## Внутреннее API (backend → другие сервисы)

### Моки банковских источников (Вика, уже есть)
`GET {MOCKS_URL}/bank-data/{inn}` → блоки `registry`, `credit_history`, `obligations`, `overdue`, `inflows` (формат — `data/demo-profiles/profiles.json`, раздел `bank_data`). Отсутствующий блок или поле backend считает неизвестным, а не нулём. Таймаут 10 с; любой сбой или 503 → заявка получает статус «Проверка не завершена» и повтор, а не отказ.

### documents-service (Вика, контракт предложен backend-ом)
`GET {DOCUMENTS_URL}/companies/{inn}/documents` → список:
```json
[{ "id": "d-1", "type": "FINANCIAL_SUMMARY", "title": "Финансовая сводка · июль–сентябрь 2026",
   "periodFrom": "2026-07", "periodTo": "2026-09", "version": 1, "uploadedAt": "2026-10-05T09:00:00Z" }]
```
`type`: `FINANCIAL_SUMMARY`, `TAX_DECLARATION`, `ACCOUNTING_REPORTS`, `TAX_DEBT_CERTIFICATE`, `PURCHASE_DOCUMENT`, `REPAIR_ESTIMATE`, `PREMISES_RIGHTS`. Для документов без периода `periodFrom`/`periodTo` = `null`. Загрузка, версии и скачивание файла идут напрямую из браузера в documents-service или через её прокси, backend нужен только список. Если сервис недоступен, библиотека считается пустой.

### Помощник с маскотом (Егор)
Реализованы `GET /api/ai/capabilities`, `POST /api/ai/goals/classify`, `POST /api/ai/assistant`.
Внутренние маршруты: `POST {AI_URL}/v1/goals/classify`, `POST {AI_URL}/v1/assistant`, отдельная сервисная авторизация.
Контракты, ограничения и деградация: [ai-integration.md](ai-integration.md). Схемы FastAPI: `ai-service /openapi.json`.

### Файлы документов
Загрузка и скачивание доступны через защищённые `POST /api/documents` и `GET /api/documents/{id}/file`.
Внутренние маршруты `/companies/{inn}/documents` и `/companies/{inn}/documents/{id}/file` требуют `DOCUMENTS_SERVICE_TOKEN`.
Пользовательский ИНН задаёт Java по текущему Principal; файлы и версии сохраняет documents-service.
