"""
Pydantic models for SAP CI/CD Automation Platform
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

# Tenant Models
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
