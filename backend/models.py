"""
Pydantic models for SAP CI/CD Automation Platform
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

# Tenant Models
class OAuthCredentials(BaseModel):
    clientId: str = Field(..., description="OAuth Client ID")
    clientSecret: str = Field(..., description="OAuth Client Secret")
    tokenUrl: str = Field(..., description="OAuth Token URL")

class TenantFormData(BaseModel):
    name: str = Field(..., description="Tenant name")
    description: Optional[str] = Field(None, description="Tenant description")
    base_url: str = Field(..., description="SAP Integration Suite base URL")
    client_id: str = Field(..., description="OAuth Client ID")
    client_secret: str = Field(..., description="OAuth Client Secret")
    token_url: str = Field(..., description="OAuth Token URL")

class ConnectionTestResult(BaseModel):
    success: bool = Field(..., description="Whether the connection test was successful")
    message: str = Field(..., description="Connection test result message")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional connection details")

# SAP Integration Models
class IntegrationPackage(BaseModel):
    id: str = Field(..., description="Package ID")
    name: str = Field(..., description="Package name")
    description: Optional[str] = Field(None, description="Package description")
    version: Optional[str] = Field("1.0.0", description="Package version")
    modifiedDate: Optional[str] = Field(None, description="Last modified date")
    modifiedBy: Optional[str] = Field(None, description="Modified by user")
    createdDate: Optional[str] = Field(None, description="Creation date")
    createdBy: Optional[str] = Field(None, description="Created by user")

class IntegrationFlow(BaseModel):
    id: str = Field(..., description="iFlow ID")
    name: str = Field(..., description="iFlow name")
    packageId: Optional[str] = Field(None, description="Parent package ID")
    description: Optional[str] = Field(None, description="iFlow description")
    version: Optional[str] = Field("1.0.0", description="iFlow version")
    modifiedDate: Optional[str] = Field(None, description="Last modified date")
    modifiedBy: Optional[str] = Field(None, description="Modified by user")
    status: Optional[str] = Field("Active", description="iFlow status")
    lastDeployed: Optional[str] = Field(None, description="Last deployment date")

class BaseTenantData(BaseModel):
    lastSynced: datetime = Field(..., description="Last synchronization timestamp")
    packages: List[IntegrationPackage] = Field(default_factory=list, description="Integration packages")
    iflows: List[IntegrationFlow] = Field(default_factory=list, description="Integration flows")

# Token Models
class TokenInfo(BaseModel):
    access_token: str = Field(..., description="OAuth access token")
    token_type: str = Field("Bearer", description="Token type")
    expires_in: int = Field(3600, description="Token expiration time in seconds")
    expires_at: Optional[datetime] = Field(None, description="Token expiration timestamp")

# API Response Models
class APIError(BaseModel):
    error: str = Field(..., description="Error message")
    details: Optional[str] = Field(None, description="Error details")
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())

class PaginatedResponse(BaseModel):
    items: List[Any] = Field(..., description="Response items")
    total: int = Field(..., description="Total count")
    page: int = Field(1, description="Current page")
    size: int = Field(50, description="Page size")
    has_next: bool = Field(False, description="Has next page")

class APIResponse(BaseModel):
    success: bool
    data: Optional[Any] = None
    message: Optional[str] = None

class TenantConfig(BaseModel):
    name: str
    description: Optional[str] = None
    client_id: str
    client_secret: str
    token_url: str
    base_url: str
    auth_url: Optional[str] = None

class IntegrationPackage(BaseModel):
    id: str
    name: str
    version: Optional[str] = None
    description: Optional[str] = None
    shortText: Optional[str] = None
    vendor: Optional[str] = None
    mode: Optional[str] = None
    supportedPlatform: Optional[str] = None
    products: Optional[List[str]] = None
    keywords: Optional[List[str]] = None
    countries: Optional[List[str]] = None
    lastModified: Optional[datetime] = None