package ru.creditcabinet.backend.common;

import java.util.List;

/** Базовая ошибка бизнес-логики. Позже Spring-слой превратит её в HTTP-ответ по полю {@link #status()}. */
public class ApiException extends RuntimeException {
    private final int status;
    private final String code;
    private final List<FieldError> fieldErrors;

    public ApiException(int status, String code, String message, List<FieldError> fieldErrors) {
        super(message);
        this.status = status;
        this.code = code;
        this.fieldErrors = List.copyOf(fieldErrors);
    }

    public int status() { return status; }
    public String code() { return code; }
    public List<FieldError> fieldErrors() { return fieldErrors; }

    public record FieldError(String field, String message) {}

    public static ApiException validation(List<FieldError> errors) {
        return new ApiException(400, "validation_error", "Проверьте введённые данные", errors);
    }

    public static ApiException validation(String field, String message) {
        return validation(List.of(new FieldError(field, message)));
    }

    public static ApiException unauthorized(String message) {
        return new ApiException(401, "unauthorized", message, List.of());
    }

    public static ApiException forbidden(String message) {
        return new ApiException(403, "forbidden", message, List.of());
    }

    public static ApiException notFound(String message) {
        return new ApiException(404, "not_found", message, List.of());
    }

    public static ApiException conflict(String code, String message) {
        return new ApiException(409, code, message, List.of());
    }
}
