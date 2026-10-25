import hmac
import json
import os
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
from contextlib import contextmanager

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse

TYPES = {"FINANCIAL_SUMMARY", "TAX_DECLARATION", "ACCOUNTING_REPORTS", "TAX_DEBT_CERTIFICATE", "PURCHASE_DOCUMENT", "REPAIR_ESTIMATE", "PREMISES_RIGHTS"}
MAX_FILE = 20 * 1024 * 1024


def create_app(data_dir=None, uploads_dir=None, token=None):
    data = Path(data_dir or os.getenv("DATA_DIR", "/data")).resolve()
    uploads = Path(uploads_dir or os.getenv("UPLOAD_DIR", "./uploads")).resolve()
    service_token = token if token is not None else os.getenv("DOCUMENTS_SERVICE_TOKEN", "")
    app = FastAPI(title="Библиотека документов компании", version="1.0.0")

    def connect():
        uploads.mkdir(parents=True, exist_ok=True)
        con = sqlite3.connect(uploads / "metadata.sqlite")
        con.row_factory = sqlite3.Row
        con.execute("CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, inn TEXT NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL, periodFrom TEXT, periodTo TEXT, version INTEGER NOT NULL, uploadedAt TEXT NOT NULL, file TEXT NOT NULL)")
        profiles_path = data / "demo-profiles/profiles.json"
        profiles = json.loads(profiles_path.read_text(encoding="utf-8")) if profiles_path.exists() else []
        if isinstance(profiles, dict):
            profiles = profiles["profiles"]
        for profile in profiles:
            for number, doc in enumerate(profile.get("documents", []), start=1):
                path = (data / doc["file"]).resolve()
                if not path.is_relative_to(data):
                    continue
                period = doc.get("period")
                start, end = period.split("..") if period else (None, None)
                con.execute("INSERT OR IGNORE INTO documents VALUES (?,?,?,?,?,?,?,?,?)",
                            (f'{profile["id"]}-doc-{number}', profile["company"]["inn"], doc["type"].upper(), doc["title"], start, end, doc.get("version", 1), doc.get("uploaded_at", "2026-10-15") + "T09:00:00Z", str(path)))
        con.commit()
        return con

    @contextmanager
    def database():
        con = connect()
        try:
            with con:
                yield con
        finally:
            con.close()

    def authorize(authorization: str = Header(default="")):
        if not service_token or not hmac.compare_digest(authorization, "Bearer " + service_token):
            raise HTTPException(401, "Service authentication required")

    def dto(row):
        return {k: row[k] for k in ("id", "type", "title", "periodFrom", "periodTo", "version", "uploadedAt")}

    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.get("/companies/{inn}/documents", dependencies=[Depends(authorize)])
    def list_documents(inn: str):
        with database() as con:
            return [dto(row) for row in con.execute("SELECT * FROM documents WHERE inn=? ORDER BY uploadedAt DESC,id", (inn,))]

    @app.post("/companies/{inn}/documents", dependencies=[Depends(authorize)])
    async def upload(inn: str, file: UploadFile = File(...), type: str = Form(...), title: str = Form(...),
                     periodFrom: str = Form(default=""), periodTo: str = Form(default="")):
        title = title.strip()
        if not re.fullmatch(r"\d{10}|\d{12}", inn) or type not in TYPES or not title or len(title) > 200:
            raise HTTPException(400, "Проверьте тип документа и название")
        if bool(periodFrom) != bool(periodTo):
            raise HTTPException(400, "Укажите начало и конец периода")
        for value in (periodFrom, periodTo):
            if value:
                try:
                    if not re.fullmatch(r"\d{4}-\d{2}", value):
                        raise ValueError()
                    datetime.strptime(value, "%Y-%m")
                except ValueError:
                    raise HTTPException(400, "Некорректный период") from None
        if periodFrom > periodTo:
            raise HTTPException(400, "Начало периода позже конца")
        if type in {"FINANCIAL_SUMMARY", "TAX_DECLARATION", "ACCOUNTING_REPORTS"} and not periodFrom:
            raise HTTPException(400, "Для финансового документа укажите период")
        content = await file.read(MAX_FILE + 1)
        await file.close()
        if len(content) > MAX_FILE or not content.startswith(b"%PDF-"):
            raise HTTPException(400, "Требуется PDF до 20 МБ")
        doc_id = str(uuid4())
        path = uploads / (doc_id + ".pdf")
        with database() as con:
            con.execute("BEGIN IMMEDIATE")
            version = con.execute("SELECT COALESCE(MAX(version),0)+1 FROM documents WHERE inn=? AND type=? AND title=?", (inn, type, title)).fetchone()[0]
            now = datetime.now(timezone.utc).isoformat()
            path.write_bytes(content)
            con.execute("INSERT INTO documents VALUES (?,?,?,?,?,?,?,?,?)", (doc_id, inn, type, title, periodFrom or None, periodTo or None, version, now, str(path)))
            row = con.execute("SELECT * FROM documents WHERE id=?", (doc_id,)).fetchone()
        return dto(row)

    @app.get("/companies/{inn}/documents/{doc_id}/file", dependencies=[Depends(authorize)])
    def download(inn: str, doc_id: str):
        with database() as con:
            row = con.execute("SELECT * FROM documents WHERE inn=? AND id=?", (inn, doc_id)).fetchone()
        if row is None or not Path(row["file"]).is_file():
            raise HTTPException(404, "Файл не найден")
        return FileResponse(row["file"], media_type="application/pdf", filename=doc_id + ".pdf")

    return app


app = create_app()
