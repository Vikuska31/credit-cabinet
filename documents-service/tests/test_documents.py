import importlib.util
from pathlib import Path

from fastapi.testclient import TestClient

spec = importlib.util.spec_from_file_location("documents_main", Path(__file__).parents[1] / "app/main.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
HEADERS = {"Authorization": "Bearer test-documents"}


def test_authorized_persistent_upload_version_and_company_scope(tmp_path):
    def create():
        return TestClient(module.create_app(tmp_path / "data", tmp_path / "uploads", "test-documents"))
    path = "/companies/7701000001/documents"
    with create() as c:
        assert c.get(path).status_code == 401
        for version in (1, 2):
            r = c.post(path, headers=HEADERS, data={"type": "PURCHASE_DOCUMENT", "title": "Счёт"}, files={"file": ("invoice.pdf", b"%PDF-1.4\n%%EOF", "application/pdf")})
            assert r.status_code == 200 and r.json()["version"] == version
        doc_id = r.json()["id"]
        assert c.get(path + "/" + doc_id + "/file", headers=HEADERS).content.startswith(b"%PDF-")
        assert c.get("/companies/7702000002/documents/" + doc_id + "/file", headers=HEADERS).status_code == 404
    with create() as c:
        assert len(c.get(path, headers=HEADERS).json()) == 2


def test_invalid_type_file_and_period(tmp_path):
    with TestClient(module.create_app(tmp_path, tmp_path / "uploads", "test-documents")) as c:
        for data, content in [({"type": "UNKNOWN", "title": "x"}, b"%PDF-x"), ({"type": "PURCHASE_DOCUMENT", "title": "x"}, b"not-pdf"), ({"type": "FINANCIAL_SUMMARY", "title": "x"}, b"%PDF-x")]:
            assert c.post("/companies/7701000001/documents", headers=HEADERS, data=data, files={"file": ("a.pdf", content)}).status_code == 400


def test_seeded_demo_pdfs_download_with_company_ownership(tmp_path):
    data = Path(__file__).resolve().parents[2] / "data"
    with TestClient(module.create_app(data, tmp_path / "uploads", "test-documents")) as c:
        for own, foreign in (("7701000001", "7702000002"), ("7702000002", "7701000001")):
            documents = c.get(f"/companies/{own}/documents", headers=HEADERS).json()
            summary = next(d for d in documents if d["type"] == "FINANCIAL_SUMMARY")
            response = c.get(f'/companies/{own}/documents/{summary["id"]}/file', headers=HEADERS)
            assert response.status_code == 200 and response.content.startswith(b"%PDF-")
            assert c.get(f'/companies/{foreign}/documents/{summary["id"]}/file', headers=HEADERS).status_code == 404
