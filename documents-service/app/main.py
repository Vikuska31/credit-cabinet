import json
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse

app = FastAPI(title="Сервис документов (демо)")

# Папка data подключается через docker-compose как /data
data_dir = Path(os.getenv("DATA_DIR", "/data"))
profiles_file = Path(os.getenv("PROFILES_FILE", str(data_dir / "demo-profiles" / "profiles.json")))

raw = json.loads(profiles_file.read_text(encoding="utf-8")) if profiles_file.exists() else []
profiles = raw["profiles"] if isinstance(raw, dict) else raw

documents_by_inn = {}
files_by_id = {}

for profile in profiles:
    inn = profile["company"]["inn"]
    items = []
    for number, doc in enumerate(profile.get("documents", []), start=1):
        doc_id = f'{profile["id"]}-doc-{number}'
        period = doc.get("period")
        period_from, period_to = period.split("..") if period else (None, None)
        uploaded = doc.get("uploaded_at", "2026-10-15")
        items.append({
            "id": doc_id,
            "type": doc["type"].upper(),
            "title": doc["title"],
            "periodFrom": period_from,
            "periodTo": period_to,
            "version": doc.get("version", 1),
            "uploadedAt": f"{uploaded}T09:00:00Z",
        })
        files_by_id[doc_id] = data_dir / doc["file"]
    documents_by_inn[inn] = items


@app.get("/health")
def health():
    return {"status": "ok"}


# Контракт из docs/api.md: список документов компании
@app.get("/companies/{inn}/documents")
def company_documents(inn: str):
    return documents_by_inn.get(inn, [])


# Скачать или посмотреть файл документа (заготовка, контракт согласовать с Лизой)
@app.get("/documents/{doc_id}/file")
def document_file(doc_id: str):
    path = files_by_id.get(doc_id)
    if path is None or not path.exists():
        raise HTTPException(status_code=404, detail="Файл не найден")
    return FileResponse(path, media_type="application/pdf", filename=path.name)
