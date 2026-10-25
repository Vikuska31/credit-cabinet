package ru.creditcabinet.backend.bank;

/** Банковские источники. Потом реализуется HTTP-клиентом к мокам Вики: GET mocks:8001/bank-data/{inn}. */
public interface BankDataSource {

    /** @throws BankDataUnavailableException если источник не ответил: это сбой, а не плохая история */
    BankData fetch(String inn);

    class BankDataUnavailableException extends RuntimeException {
        public BankDataUnavailableException(String message) { super(message); }
    }
}
