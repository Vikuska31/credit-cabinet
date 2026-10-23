from fastapi import FastAPI, HTTPException

app = FastAPI(title="Mocks")

# Заглушка: настоящие профили придут от Егора
COMPANIES = {
    "7700000001": {"name": "ООО Пример", "status": "active"},
}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/egrul/{inn}")
def egrul(inn: str):
    if inn not in COMPANIES:
        raise HTTPException(status_code=404, detail="Компания не найдена")
    return COMPANIES[inn]
