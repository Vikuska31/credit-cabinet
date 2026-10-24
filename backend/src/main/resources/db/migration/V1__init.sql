-- Заявка: поля для поиска вынесены в колонки, полное состояние (цели, ответы, решение,
-- снимок банковских сведений, история) лежит в data как JSON.
CREATE SEQUENCE application_number_seq START 1;

CREATE TABLE applications (
    id          TEXT PRIMARY KEY,
    number      BIGINT      NOT NULL UNIQUE,
    company_inn TEXT        NOT NULL,
    status      TEXT        NOT NULL,
    amount      NUMERIC(14, 2),
    term_months INT,
    updated_at  TIMESTAMPTZ NOT NULL,
    data        JSONB       NOT NULL
);
CREATE INDEX idx_applications_company ON applications (company_inn, number DESC);
CREATE INDEX idx_applications_status ON applications (status);

CREATE TABLE notifications (
    id             BIGSERIAL PRIMARY KEY,
    recipient      TEXT        NOT NULL,   -- ИНН компании или 'employees'
    text           TEXT        NOT NULL,
    application_id TEXT,
    created_at     TIMESTAMPTZ NOT NULL,
    read           BOOLEAN     NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_notifications_recipient ON notifications (recipient, created_at DESC);

CREATE TABLE goal_inquiries (
    id                 TEXT PRIMARY KEY,
    company_inn        TEXT        NOT NULL,
    text               TEXT        NOT NULL,
    status             TEXT        NOT NULL,
    suggested_category TEXT,
    employee_message   TEXT,
    created_at         TIMESTAMPTZ NOT NULL,
    answered_at        TIMESTAMPTZ
);
CREATE INDEX idx_goal_inquiries_company ON goal_inquiries (company_inn);
