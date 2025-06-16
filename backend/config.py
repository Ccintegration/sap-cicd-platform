"""
Configuration management for SAP Integration Suite Backend
"""

import os
from functools import lru_cache
from pydantic_settings import BaseSettings
from pydantic import Field
from typing import List

class Settings(BaseSettings):
    """Application settings"""
    
    # Application settings
    app_name: str = "SAP Integration Suite Backend"
    environment: str = Field(default="development", env="ENVIRONMENT")
    debug: bool = Field(default=True, env="DEBUG")
    
    # Server settings
    host: str = Field(default="0.0.0.0", env="HOST")
    port: int = Field(default=8000, env="PORT")
    reload: bool = Field(default=True, env="RELOAD")
    
    # CORS settings
    allowed_origins: List[str] = Field(
        default=[
            "http://localhost:3000",
            "http://localhost:5173", 
            "http://localhost:8080",
            "https://2eb62935ac7a480ba3a90806f9af053b-82e2889c39e44190a89b82122.projects.builder.codes"
        ],
        env="ALLOWED_ORIGINS"
    )
    
    # SAP Integration Suite credentials (CCCI_SANDBOX)
    sap_client_id: str = Field(
        default="sb-4d88ec4d-cf00-4e40-b9a3-bf20640f4941!b236015|it!b182722",
        env="SAP_CLIENT_ID"
    )
    sap_client_secret: str = Field(
        default="68998671-12de-4a2c-ab02-8968d571b4cd$1hejXEfNv1qrX8raaVfuD_x-6PtP1xub7uRFmr55gaI=",
        env="SAP_CLIENT_SECRET"
    )
    sap_token_url: str = Field(
        default="https://ccci-integration-suite-fuom1yo5.authentication.eu10.hana.ondemand.com/oauth/token",
        env="SAP_TOKEN_URL"
    )
    sap_base_url: str = Field(
        default="https://ccci-integration-suite-fuom1yo5.it-cpi024.cfapps.eu10-002.hana.ondemand.com",
        env="SAP_BASE_URL"
    )
    
    # HTTP client settings
    http_timeout: int = Field(default=30, env="HTTP_TIMEOUT")
    max_retries: int = Field(default=3, env="MAX_RETRIES")
    
    # Token management
    token_cache_ttl: int = Field(default=3600, env="TOKEN_CACHE_TTL")  # seconds
    token_refresh_buffer: int = Field(default=300, env="TOKEN_REFRESH_BUFFER")  # seconds
    
    # Logging
    log_level: str = Field(default="INFO", env="LOG_LEVEL")
    log_format: str = Field(
        default="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        env="LOG_FORMAT"
    )
    
    # Database (for future use)
    database_url: str = Field(default="sqlite:///./sap_backend.db", env="DATABASE_URL")
    
    # Security
    secret_key: str = Field(
        default="your-secret-key-change-in-production",
        env="SECRET_KEY"
    )
    
    # Rate limiting
    rate_limit_requests: int = Field(default=100, env="RATE_LIMIT_REQUESTS")
    rate_limit_window: int = Field(default=60, env="RATE_LIMIT_WINDOW")  # seconds
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False

@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()

# Environment-specific configurations
def get_development_settings() -> Settings:
    """Get development-specific settings"""
    settings = get_settings()
    settings.debug = True
    settings.reload = True
    settings.log_level = "DEBUG"
    return settings

def get_production_settings() -> Settings:
    """Get production-specific settings"""
    settings = get_settings()
    settings.debug = False
    settings.reload = False
    settings.log_level = "INFO"
    settings.environment = "production"
    return settings

def get_test_settings() -> Settings:
    """Get test-specific settings"""
    settings = get_settings()
    settings.environment = "test"
    settings.database_url = "sqlite:///./test_sap_backend.db"
    return settings

# Configuration validation
def validate_sap_config(settings: Settings) -> bool:
    """Validate SAP configuration"""
    required_fields = [
        settings.sap_client_id,
        settings.sap_client_secret,
        settings.sap_token_url,
        settings.sap_base_url
    ]
    
    if not all(required_fields):
        return False
    
    # Validate URL formats
    if not settings.sap_token_url.startswith("https://"):
        return False
    
    if not settings.sap_base_url.startswith("https://"):
        return False
    
    # Validate client ID format (SAP specific)
    if not any(pattern in settings.sap_client_id for pattern in ["sb-", "!b", "|it!"]):
        return False
    
    return True

# Export settings instance
settings = get_settings()
