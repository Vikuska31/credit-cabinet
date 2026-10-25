"""Java -> FastAPI -> HTTP contract test; --live uses the configured real Qwen."""
import argparse
import json
import os
import shutil
import socket
import subprocess
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[2]
EMPTY = {"purposeText": None, "goals": [], "amount": None, "currency": None, "termMonths": None}
calls = []
fail_model = False


class ModelStub(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_POST(self):
        global calls
        if fail_model:
            self.send_response(503)
            self.end_headers()
            return
        payload = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        assert self.path == "/v1/chat/completions"
        assert payload["response_format"]["type"] == "json_schema"
        data = json.loads(payload["messages"][1]["content"])
        calls.append(data)
        if "text" in data:
            result = {"schemaVersion": "1", "status": "CLASSIFIED", "businessUse": "BUSINESS", "goals": ["EQUIPMENT", "ADVERTISING"], "reasonCode": "BUSINESS_PURPOSE", "questionCode": None,
                      "evidence": [{"goal": "EQUIPMENT", "quote": "станок"}, {"goal": "ADVERTISING", "quote": "реклама"}]}
        else:
            resume = data["message"].startswith("Продолжить")
            result = {"schemaVersion": "1", "status": "READY", "businessUse": "NOT_APPLICABLE" if resume else "BUSINESS", "intent": "CONTINUE_DRAFT" if resume else "START_SELECTION",
                      "entities": EMPTY if resume else {"purposeText": "оборудование пекарни", "goals": ["EQUIPMENT"], "amount": "1500000.00", "currency": "RUB", "termMonths": 24},
                      "questionCode": None, "explanationTopic": None, "targetRef": data["context"]["applications"][0]["ref"] if resume else None,
                      "evidence": [] if resume else [{"field": "purposeText", "quote": "оборудование пекарни"}, {"field": "goals", "quote": "оборудование пекарни"}, {"field": "amount", "quote": "полтора миллиона"}, {"field": "termMonths", "quote": "два года"}]}
        body = json.dumps({"choices": [{"finish_reason": "stop", "message": {"content": json.dumps(result, ensure_ascii=False)}}]}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def wait(client, url, process):
    deadline = time.monotonic() + 45
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(f"Service stopped before readiness: {url}; exit={process.returncode}; see .run/ai-smoke-*.log")
        try:
            if client.get(url).status_code == 200:
                return
        except httpx.HTTPError:
            pass
        time.sleep(0.2)
    raise RuntimeError("Readiness timeout: " + url)


def stop(process):
    if process.poll() is not None:
        return
    # Windows venv redirectors can have a child interpreter; terminate our tree.
    if os.name == "nt":
        subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                       creationflags=subprocess.CREATE_NO_WINDOW)
    else:
        process.terminate()
    try:
        process.wait(timeout=8)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait()


def main():
    global fail_model
    parser = argparse.ArgumentParser()
    parser.add_argument("--java", default=str(Path(os.environ["JAVA_HOME"]) / "bin/java") if "JAVA_HOME" in os.environ else shutil.which("java"))
    parser.add_argument("--live", action="store_true", help="Use real Qwen configured in environment/root .env")
    args = parser.parse_args()
    assert args.java, "Set JAVA_HOME or pass --java"
    jar = ROOT / "backend/target/backend-0.0.1-SNAPSHOT.jar"
    assert jar.is_file(), "Build backend first"
    model = None
    if not args.live:
        model = ThreadingHTTPServer(("127.0.0.1", 0), ModelStub)
        threading.Thread(target=model.serve_forever, daemon=True).start()
    ai_port, java_port = port(), port()
    while java_port == ai_port:
        java_port = port()
    base = f"http://127.0.0.1:{java_port}"
    env = os.environ.copy()
    if args.live and (ROOT / ".env").exists():
        for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
            if line.strip() and not line.lstrip().startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                env.setdefault(key.strip(), value.strip().strip("\"'"))
    env.update({"AI_ENABLED": "true", "AI_SERVICE_TOKEN": "smoke-service", "APP_STORAGE": "memory", "SPRING_FLYWAY_ENABLED": "false", "DOCUMENTS_URL": "", "MOCKS_URL": "", "AI_URL": f"http://127.0.0.1:{ai_port}", "PROFILES_FILE": str(ROOT / "data/demo-profiles/profiles.json")})
    if args.live:
        env["LLM_BASE_URL"] = env.get("LLM_BASE_URL", "http://localhost:11434/v1").replace("host.docker.internal", "localhost")
        env.setdefault("LLM_REQUEST_TIMEOUT_MS", "60000")
        env.setdefault("AI_TIMEOUT_MS", "65000")
    else:
        env.update({"LLM_API_TOKEN": "", "LLM_BASE_URL": f"http://127.0.0.1:{model.server_port}/v1", "LLM_MODEL_NAME": "test-http-stub"})
    flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    processes = []
    logs = ROOT / ".run"
    logs.mkdir(exist_ok=True)
    with (httpx.Client(timeout=75 if args.live else 20, trust_env=False) as client,
          (logs / "ai-smoke-python.log").open("wb") as ai_log,
          (logs / "ai-smoke-backend.log").open("wb") as java_log):
        try:
            ai = subprocess.Popen([sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(ai_port), "--log-level", "error"], cwd=ROOT / "ai-service", env=env, stdout=ai_log, stderr=subprocess.STDOUT, creationflags=flags)
            processes.append(ai)
            backend = subprocess.Popen([args.java, "-XX:+UseSerialGC", "-Xms16m", "-Xmx96m", "-XX:ReservedCodeCacheSize=32m", "-jar", str(jar), "--server.port=" + str(java_port), "--logging.level.root=WARN", "--logging.level.org.springframework=WARN"], cwd=ROOT / "backend", env=env, stdout=java_log, stderr=subprocess.STDOUT, creationflags=flags)
            processes.append(backend)
            wait(client, f"http://127.0.0.1:{ai_port}/health", ai)
            wait(client, base + "/api/health", backend)
            r = client.post(base + "/api/auth/demo-login", json={"profileId": "ooo-istoriya"})
            r.raise_for_status()
            client.headers["Authorization"] = "Bearer " + r.json()["token"]
            result = client.post(base + "/api/ai/goals/classify", json={"text": "станок и реклама для мастерской", "clarifications": []}).json()
            assert result["status"] == "CLASSIFIED" and len(result["goals"]) == 2, result
            draft = client.post(base + "/api/applications").json()
            body = {"message": "Продолжить черновик", "context": {"screen": "HOME", "applicationId": None, "documentId": None}, "history": []}
            result = client.post(base + "/api/ai/assistant", json=body).json()
            assert result["actions"][0]["applicationId"] == draft["id"], result
            # Both widgets can submit while the single model worker is busy.
            simultaneous_body = body | {"message": "Покупка станков для мастерскойв"} if args.live else body
            simultaneous_text = "Покупка станков для мастерскойв" if args.live else "станок и реклама для мастерской"
            with ThreadPoolExecutor(max_workers=2) as pool:
                assistant_call = pool.submit(client.post, base + "/api/ai/assistant", json=simultaneous_body)
                goal_call = pool.submit(client.post, base + "/api/ai/goals/classify",
                                        json={"text": simultaneous_text, "clarifications": []})
                assistant_result = assistant_call.result().json()
                goal_result = goal_call.result().json()
            assert assistant_result["status"] == "READY", assistant_result
            assert goal_result["status"] == "CLASSIFIED", goal_result
            if args.live:
                assert assistant_result["intent"] == "START_SELECTION", assistant_result
                assert assistant_result["actions"][0]["type"] == "START_SELECTION", assistant_result
                assert goal_result["goals"] == ["EQUIPMENT"], goal_result
            body["message"] = "полтора миллиона на оборудование пекарни на два года"
            result = client.post(base + "/api/ai/assistant", json=body).json()
            assert result["entities"]["amount"] == "1500000.00" and result["entities"]["termMonths"] == 24, result
            assert result["actions"][0]["type"] == "START_SELECTION"
            assert client.get(base + "/api/applications/" + draft["id"]).json() == draft
            if args.live:
                stop(ai)  # Stop only this test's AI process; prove manual fallback.
            else:
                assert calls
                assert all("companyInn" not in json.dumps(c) and "bankData" not in json.dumps(c) and draft["id"] not in json.dumps(c) for c in calls)
                fail_model = True
            result = client.post(base + "/api/ai/assistant", json=body).json()
            assert result["status"] == "UNAVAILABLE" and result["actions"] == []
            assert client.patch(base + "/api/applications/" + draft["id"], json={"goals": ["GOODS"], "amount": 1000000, "termMonths": 24}).status_code == 200
            print("PASS: Java -> FastAPI -> " + ("real Qwen" if args.live else "HTTP model stub") + "; categories; numbers; simultaneous widgets; authorized actions; no AI writes; manual fallback")
        finally:
            for process in reversed(processes):
                stop(process)
            if model:
                model.shutdown()
                model.server_close()


if __name__ == "__main__":
    main()
