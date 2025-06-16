"""
FastAPI Backend Proxy for SAP Integration Suite
Handles authentication, token management, and API proxying
"""

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import httpx
import asyncio
import logging
from datetime import datetime, timedelta
import os
import json

from config import Settings, get_settings
from sap_client import SAPClient, SAPCredentials
from models import (
    IntegrationFlow,
    BaseTenantData,
    ConnectionTestResult,
    APIResponse,
    TenantConfig,
    IntegrationPackage
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="SAP Integration Suite Proxy",
    description="Backend proxy for SAP Integration Suite API calls",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:8080", "*"],  # Add your frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global SAP client instance
sap_client: Optional[SAPClient] = None

@app.on_event("startup")
async def startup_event():
    """Initialize SAP client on startup"""
    global sap_client
    settings = get_settings()
    
    # Initialize with CCCI_SANDBOX credentials
    credentials = SAPCredentials(
        client_id=settings.sap_client_id,
        client_secret=settings.sap_client_secret,
        token_url=settings.sap_token_url,
        base_url=settings.sap_base_url
    )
    
    sap_client = SAPClient(credentials)
    logger.info("SAP Client initialized successfully")

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "message": "SAP Integration Suite Backend Proxy",
        "status": "running",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    }

@app.get("/health")
async def health_check():
    """Detailed health check"""
    global sap_client
    
    health_status = {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": {
            "api": "running",
            "sap_connection": "unknown"
        }
    }
    
    # Test SAP connection
    if sap_client:
        try:
            # Quick connectivity test
            is_healthy = await sap_client.test_connection()
            health_status["services"]["sap_connection"] = "healthy" if is_healthy else "degraded"
        except Exception as e:
            health_status["services"]["sap_connection"] = "error"
            health_status["sap_error"] = str(e)
    
    return health_status

# Tenant Management Endpoints

@app.post("/api/tenants/test-connection")
async def test_tenant_connection(tenant_config: TenantConfig) -> ConnectionTestResult:
    """Test connection to SAP tenant with provided credentials"""
    try:
        logger.info(f"Testing connection for tenant: {tenant_config.name}")
        
        # Create temporary SAP client with provided credentials
        credentials = SAPCredentials(
            client_id=tenant_config.client_id,
            client_secret=tenant_config.client_secret,
            token_url=tenant_config.token_url,
            base_url=tenant_config.base_url
        )
        
        temp_client = SAPClient(credentials)
        
        # Test authentication
        start_time = datetime.now()
        token = await temp_client.get_access_token()
        response_time = (datetime.now() - start_time).total_seconds() * 1000
        
        # Test API accessibility
        packages = await temp_client.get_integration_packages()
        
        return ConnectionTestResult(
            success=True,
            message="Connection successful! SAP Integration Suite is accessible.",
            response_time=int(response_time),
            details={
                "token_obtained": True,
                "api_accessible": True,
                "packages_found": len(packages),
                "test_timestamp": datetime.now().isoformat()
            }
        )
        
    except Exception as e:
        logger.error(f"Connection test failed: {str(e)}")
        return ConnectionTestResult(
            success=False,
            message=f"Connection failed: {str(e)}",
            response_time=0,
            details={
                "token_obtained": False,
                "api_accessible": False,
                "error": str(e),
                "test_timestamp": datetime.now().isoformat()
            }
        )

# SAP Integration Suite API Endpoints

@app.get("/api/sap/packages", response_model=APIResponse)
async def get_packages():
    """Get all Integration Packages from SAP Integration Suite"""
    global sap_client
    
    if not sap_client:
        raise HTTPException(status_code=500, detail="SAP client not initialized")
    
    try:
        logger.info("Fetching Integration Packages from SAP")
        packages = await sap_client.get_integration_packages()
        return APIResponse(
            success=True,
            data=packages,
            message="Successfully fetched integration packages"
        )
    except Exception as e:
        logger.error(f"Failed to fetch packages: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@app.get("/api/sap/iflows")
async def get_integration_flows() -> APIResponse:
    """Get all Integration Flows from SAP Integration Suite"""
    global sap_client
    
    if not sap_client:
        raise HTTPException(status_code=500, detail="SAP client not initialized")
    
    try:
        logger.info("Fetching Integration Flows from SAP")
        iflows = await sap_client.get_integration_flows()
        
        return APIResponse(
            success=True,
            data=iflows,
            message=f"Successfully retrieved {len(iflows)} integration flows",
            timestamp=datetime.now().isoformat()
        )
        
    except Exception as e:
        logger.error(f"Failed to fetch iflows: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch integration flows: {str(e)}"
        )

@app.get("/api/sap/base-tenant-data")
async def get_base_tenant_data() -> APIResponse:
    """Get complete base tenant data (packages + iflows)"""
    global sap_client
    
    if not sap_client:
        raise HTTPException(status_code=500, detail="SAP client not initialized")
    
    try:
        logger.info("Fetching complete base tenant data from SAP")
        
        # Fetch packages and iflows in parallel for better performance
        packages_task = sap_client.get_integration_packages()
        iflows_task = sap_client.get_integration_flows()
        
        packages, iflows = await asyncio.gather(packages_task, iflows_task)
        
        base_tenant_data = BaseTenantData(
            tenant_id="ccci-sandbox-001",
            tenant_name="CCCI_SANDBOX",
            packages=packages,
            iflows=iflows,
            last_synced=datetime.now(),
            connection_status="connected"
        )
        
        return APIResponse(
            success=True,
            data=base_tenant_data.dict(),
            message=f"Successfully retrieved base tenant data: {len(packages)} packages, {len(iflows)} iflows",
            timestamp=datetime.now().isoformat()
        )
        
    except Exception as e:
        logger.error(f"Failed to fetch base tenant data: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch base tenant data: {str(e)}"
        )

@app.get("/api/sap/packages/{package_id}")
async def get_package_details(package_id: str) -> APIResponse:
    """Get detailed information about a specific integration package"""
    global sap_client
    
    if not sap_client:
        raise HTTPException(status_code=500, detail="SAP client not initialized")
    
    try:
        logger.info(f"Fetching package details for: {package_id}")
        package_details = await sap_client.get_package_details(package_id)
        
        return APIResponse(
            success=True,
            data=package_details,
            message=f"Successfully retrieved package details for {package_id}",
            timestamp=datetime.now().isoformat()
        )
        
    except Exception as e:
        logger.error(f"Failed to fetch package details: {str(e)}")
        raise HTTPException(
            status_code=404,
            detail=f"Package not found or failed to fetch: {str(e)}"
        )

@app.get("/api/sap/iflows/{iflow_id}")
async def get_iflow_details(iflow_id: str) -> APIResponse:
    """Get detailed information about a specific integration flow"""
    global sap_client
    
    if not sap_client:
        raise HTTPException(status_code=500, detail="SAP client not initialized")
    
    try:
        logger.info(f"Fetching iflow details for: {iflow_id}")
        iflow_details = await sap_client.get_iflow_details(iflow_id)
        
        return APIResponse(
            success=True,
            data=iflow_details,
            message=f"Successfully retrieved iflow details for {iflow_id}",
            timestamp=datetime.now().isoformat()
        )
        
    except Exception as e:
        logger.error(f"Failed to fetch iflow details: {str(e)}")
        raise HTTPException(
            status_code=404,
            detail=f"Integration flow not found or failed to fetch: {str(e)}"
        )

# Token Management Endpoints

@app.post("/api/sap/refresh-token")
async def refresh_sap_token() -> APIResponse:
    """Manually refresh SAP OAuth token"""
    global sap_client
    
    if not sap_client:
        raise HTTPException(status_code=500, detail="SAP client not initialized")
    
    try:
        logger.info("Manually refreshing SAP OAuth token")
        await sap_client.refresh_token()
        
        return APIResponse(
            success=True,
            data={"token_refreshed": True},
            message="SAP OAuth token refreshed successfully",
            timestamp=datetime.now().isoformat()
        )
        
    except Exception as e:
        logger.error(f"Failed to refresh token: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to refresh token: {str(e)}"
        )

@app.get("/api/sap/token-status")
async def get_token_status() -> APIResponse:
    """Get current OAuth token status"""
    global sap_client
    
    if not sap_client:
        raise HTTPException(status_code=500, detail="SAP client not initialized")
    
    try:
        token_info = sap_client.get_token_info()
        
        return APIResponse(
            success=True,
            data=token_info,
            message="Token status retrieved successfully",
            timestamp=datetime.now().isoformat()
        )
        
    except Exception as e:
        logger.error(f"Failed to get token status: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get token status: {str(e)}"
        )

# Configuration Endpoints

@app.get("/api/config")
async def get_backend_config() -> APIResponse:
    """Get backend configuration information"""
    settings = get_settings()
    
    config_info = {
        "sap_base_url": settings.sap_base_url,
        "sap_token_url": settings.sap_token_url,
        "environment": settings.environment,
        "debug": settings.debug,
        "backend_version": "1.0.0",
        "supported_apis": [
            "Integration Packages",
            "Integration Flows",
            "Package Details",
            "iFlow Details"
        ]
    }
    
    return APIResponse(
        success=True,
        data=config_info,
        message="Backend configuration retrieved",
        timestamp=datetime.now().isoformat()
    )

# Error handlers

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Custom HTTP exception handler"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": exc.detail,
            "status_code": exc.status_code,
            "timestamp": datetime.now().isoformat()
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """General exception handler"""
    logger.error(f"Unhandled exception: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "Internal server error",
            "details": str(exc) if get_settings().debug else "An unexpected error occurred",
            "timestamp": datetime.now().isoformat()
        }
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
