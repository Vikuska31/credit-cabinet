"""Run the cabinet without Docker. Ctrl+C stops only the child processes started here."""
import argparse
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ai", action="store_true", help="Enable the real Qwen HTTP integration")
    parser.add_argument("--java", default=None)
    parser.add_argument("--storage", choices=["memory", "jdbc"], default="memory")
    args = parser.parse_args()
    config = ROOT / ".env"
    if not config.exists():
        shutil.copyfile(ROOT / ".env.example", config)
        print("Created local .env from the example. Replace demo secrets before sharing a deployment.")
    env = os.environ.copy()
    for line in config.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            env.setdefault(key.strip(), value.strip().strip("\"'"))
    portable = ROOT.parent / ".tools"
    python = portable / "python/Scripts/python.exe"
    python = str(python) if python.exists() else sys.executable
    java = args.java
    if not java and env.get("JAVA_HOME"):
        java = str(Path(env["JAVA_HOME"]) / "bin/java")
    if not java and os.name == "nt":
        jdks = sorted(Path("C:/Program Files/Java").glob("jdk-*/bin/java.exe"), reverse=True)
        java = str(jdks[0]) if jdks else None
    java = java or shutil.which("java")
    node = shutil.which("node")
    if not node:
        candidates = sorted(portable.glob("node-*-win-x64/node.exe"), reverse=True)
        node = str(candidates[0]) if candidates else None
    jar = ROOT / "backend/target/backend-0.0.1-SNAPSHOT.jar"
    vite = ROOT / "frontend/node_modules/vite/bin/vite.js"
    if not java or not node or not jar.exists() or not vite.exists():
        raise SystemExit("Need Java 21+, Node 22+, built backend JAR and npm ci in frontend. See docs/ai-integration.md.")
    env.update({"APP_STORAGE": args.storage, "SPRING_FLYWAY_ENABLED": "false" if args.storage == "memory" else "true",
                "AI_ENABLED": "true" if args.ai else "false", "AI_URL": "http://127.0.0.1:8003",
                "MOCKS_URL": "", "DOCUMENTS_URL": "http://127.0.0.1:8002", "DATA_DIR": str(ROOT / "data"),
                "PROFILES_FILE": str(ROOT / "data/demo-profiles/profiles.json"), "UPLOAD_DIR": str(ROOT / "uploads")})
    env["LLM_BASE_URL"] = env.get("LLM_BASE_URL", "http://localhost:11434/v1").replace("host.docker.internal", "localhost")
    if not env.get("DOCUMENTS_SERVICE_TOKEN") or (args.ai and not env.get("AI_SERVICE_TOKEN")):
        raise SystemExit("Set DOCUMENTS_SERVICE_TOKEN and, for --ai, AI_SERVICE_TOKEN in .env.")
    folder = ROOT / ".run"
    folder.mkdir(exist_ok=True)
    flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    commands = [
        ("documents", [python, "-m", "uvicorn", "app.main:app", "--app-dir", str(ROOT / "documents-service"), "--host", "127.0.0.1", "--port", "8002"]),
        ("backend", [java, "-jar", str(jar), "--logging.level.root=WARN", "--logging.level.org.springframework=WARN"]),
        ("frontend", [node, str(vite), "--host", "127.0.0.1", "--port", "5173", "--strictPort"]),
    ]
    if args.ai:
        commands.insert(1, ("ai", [python, "-m", "uvicorn", "app.main:app", "--app-dir", str(ROOT / "ai-service"), "--host", "127.0.0.1", "--port", "8003"]))
    processes = []
    logs = []
    try:
        for name, command in commands:
            log = (folder / (name + ".log")).open("wb")
            logs.append(log)
            cwd = ROOT / "frontend" if name == "frontend" else ROOT
            processes.append((name, subprocess.Popen(command, cwd=cwd, env=env, stdout=log, stderr=log, creationflags=flags)))
        print("Cabinet: http://127.0.0.1:5173 | demo profiles or demo.ooo / demo1234", flush=True)
        print("AI: " + ("enabled; requires a running Qwen endpoint" if args.ai else "disabled; manual scenario available"), flush=True)
        print("Storage: " + args.storage + "; documents persist in uploads/. Logs: .run/. Ctrl+C to stop.", flush=True)
        while True:
            for name, process in processes:
                if process.poll() is not None:
                    raise RuntimeError(name + " stopped; see .run/" + name + ".log")
            time.sleep(0.5)
    except KeyboardInterrupt:
        pass
    finally:
        for _, process in reversed(processes):
            if process.poll() is None:
                if os.name == "nt":
                    # A venv executable can redirect to a child interpreter.
                    # Stop the complete tree that this launcher started.
                    subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"],
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                   creationflags=flags)
                else:
                    process.terminate()
                try:
                    process.wait(timeout=8)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
        for log in logs:
            log.close()


if __name__ == "__main__":
    main()
