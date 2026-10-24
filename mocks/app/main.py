import json
import os
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException

app = FastAPI(title="Моки банковских источников (имитация)")

# Файл с профилями лежит в папке data/ (подключается через docker-compose)
profiles_file = Path(os.getenv("PROFILES_FILE", "/data/demo-profiles/profiles.json"))
if profiles_file.exists():
    profiles = json.loads(profiles_file.read_text(encoding="utf-8"))
else:
    profiles = []
by_inn = {p["company"]["inn"]: p for p in profiles}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/bank-data/{inn}")
def bank_data(inn: str, delay: float = 0, simulate: str = ""):
    # ?delay=3 включает задержку в секундах, ?simulate=error имитирует сбой
    if delay > 0:
        time.sleep(min(delay, 10))
    if simulate == "error":
        raise HTTPException(status_code=503, detail="Источник временно недоступен (имитация)")
    profile = by_inn.get(inn)
    if profile is None:
        raise HTTPException(status_code=404, detail="Компания не найдена")
    return profile["bank_data"]
