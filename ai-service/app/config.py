from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    ai_enabled: bool = False
    ai_service_token: SecretStr = SecretStr("")
    llm_base_url: str = "http://localhost:11434/v1"
    llm_api_token: SecretStr = SecretStr("")
    llm_model_name: str = "qwen3:4b-instruct-2507-q4_K_M"
    llm_provider: str = "ollama"
    llm_request_timeout_ms: int = Field(default=60000, ge=100, le=120000)
    llm_max_output_tokens: int = Field(default=1200, ge=128, le=4096)
    ai_max_concurrent_requests: int = Field(default=1, ge=1, le=16)
    ai_max_queued_requests: int = Field(default=1, ge=0, le=16)
