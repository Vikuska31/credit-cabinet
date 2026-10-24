package ru.creditcabinet.backend.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import ru.creditcabinet.backend.common.ApiException;

import java.util.List;

@RestControllerAdvice
public class ApiExceptionHandler {

    public record ErrorBody(String code, String message, List<ApiException.FieldError> fieldErrors) {}

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ErrorBody> handle(ApiException e) {
        return ResponseEntity.status(e.status()).body(new ErrorBody(e.code(), e.getMessage(), e.fieldErrors()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ErrorBody> unreadable(HttpMessageNotReadableException e) {
        return ResponseEntity.badRequest().body(new ErrorBody("bad_request", "Не удалось прочитать запрос: проверьте формат полей", List.of()));
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ErrorBody> unexpected(Exception e) {
        // Подробности не отдаём наружу; в логах они остаются
        org.slf4j.LoggerFactory.getLogger(ApiExceptionHandler.class).error("Необработанная ошибка", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorBody("internal_error", "Внутренняя ошибка сервера", List.of()));
    }
}
