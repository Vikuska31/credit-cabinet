package ru.creditcabinet.backend.domain;

public enum CompanyForm {
    IP("ИП"), OOO("ООО");

    private final String title;
    CompanyForm(String title) { this.title = title; }
    public String title() { return title; }
}
