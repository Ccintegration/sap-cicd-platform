# File Path: backend/main.py
# Filename: main.py
"""
FastAPI Backend Proxy for SAP Integration Suite - Updated with correct design guidelines APIs
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
import csv
from pathlib import Path

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
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:8080", "*"],
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

@app.get("/api/sap/iflows/{iflow_id}/configurations")
async def get_iflow_configurations(iflow_id: str, version: str = "active") -> APIResponse:
    """Get configuration parameters for a specific integration flow - enhanced endpoint"""
    global sap_client

    if not sap_client:
        logger.error("SAP client not initialized")
        raise HTTPException(status_code=500, detail="SAP client not initialized")

    try:
        logger.info(f"Fetching configuration for iFlow: {iflow_id}, version: {version}")
        
        # Get configurations from SAP
        configurations = await sap_client.get_iflow_configurations(iflow_id, version)
        
        # Transform configurations to expected frontend format
        parameters = []
        for config in configurations:
            try:
                parameter = {
                    "ParameterKey": config.get("ParameterKey", ""),
                    "ParameterValue": config.get("ParameterValue", ""),
                    "DataType": config.get("DataType", "string"),
                    "Description": config.get("Description", ""),
                    "Mandatory": config.get("Mandatory", False)
                }
                parameters.append(parameter)
                logger.debug(f"Processed parameter: {parameter['ParameterKey']}")
            except Exception as param_error:
                logger.warning(f"Failed to process parameter {config}: {param_error}")
                continue

        response_data = {
            "name": f"iFlow {iflow_id}",
            "version": version,
            "parameters": parameters,
            "total_parameters": len(parameters)
        }

        logger.info(f"Successfully retrieved {len(parameters)} configuration parameters for {iflow_id}")
        
        return APIResponse(
            success=True,
            data=response_data,
            message=f"Successfully retrieved {len(parameters)} configuration parameters for {iflow_id}",
            timestamp=datetime.now().isoformat()
        )

    except Exception as e:
        logger.error(f"Failed to fetch iflow configuration: {str(e)}", exc_info=True)
        
        # Return empty configuration with error details instead of failing
        error_response = {
            "name": f"iFlow {iflow_id}",
            "version": version,
            "parameters": [],
            "total_parameters": 0,
            "error": str(e)
        }
        
        return APIResponse(
            success=False,
            data=error_response,
            message=f"Failed to retrieve configuration for {iflow_id}: {str(e)}",
            timestamp=datetime.now().isoformat()
        )

# Enhanced SAP client method for better error handling
async def get_iflow_configurations(self, iflow_id: str, version: str) -> List[Dict[str, Any]]:
    """Get configuration parameters for a specific integration flow - enhanced version"""
    try:
        logger.info(f"Fetching configurations for iFlow: {iflow_id}, version: {version}")

        # SAP API: /IntegrationDesigntimeArtifacts(Id='{iflow_id}',Version='{version}')/Configurations
        url = f"{self.base_url}/api/v1/IntegrationDesigntimeArtifacts(Id='{iflow_id}',Version='{version}')/Configurations"
        
        logger.debug(f"SAP API URL: {url}")

        headers = await self._get_auth_headers()
        
        # Add timeout and retry logic
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.get(url, headers=headers)
                
                logger.debug(f"SAP API Response Status: {response.status_code}")
                logger.debug(f"SAP API Response Headers: {dict(response.headers)}")
                
                if response.status_code == 200:
                    try:
                        data = response.json()
                        logger.debug(f"SAP API Response Data Structure: {type(data)}")
                        
                        # Handle different response structures
                        configurations = []
                        
                        if isinstance(data, dict):
                            # OData format: {"d": {"results": [...]}}
                            if "d" in data:
                                if isinstance(data["d"], dict) and "results" in data["d"]:
                                    configurations = data["d"]["results"]
                                elif isinstance(data["d"], list):
                                    configurations = data["d"]
                            # Direct format: {"results": [...]}
                            elif "results" in data:
                                configurations = data["results"]
                            # Simple format: {"configurations": [...]}
                            elif "configurations" in data:
                                configurations = data["configurations"]
                            # Array format: [...]
                            elif "value" in data:
                                configurations = data["value"]
                        elif isinstance(data, list):
                            configurations = data
                        
                        logger.info(f"Found {len(configurations)} configuration parameters for {iflow_id}")
                        logger.debug(f"Configuration parameters: {configurations}")
                        
                        # Validate and clean the configurations
                        cleaned_configurations = []
                        for config in configurations:
                            if isinstance(config, dict):
                                # Ensure required fields exist
                                cleaned_config = {
                                    "ParameterKey": config.get("ParameterKey", config.get("Key", "")),
                                    "ParameterValue": config.get("ParameterValue", config.get("Value", "")),
                                    "DataType": config.get("DataType", config.get("Type", "string")),
                                    "Description": config.get("Description", ""),
                                    "Mandatory": config.get("Mandatory", config.get("Required", False))
                                }
                                cleaned_configurations.append(cleaned_config)
                        
                        return cleaned_configurations
                        
                    except json.JSONDecodeError as json_error:
                        logger.error(f"Failed to parse JSON response: {json_error}")
                        logger.debug(f"Raw response content: {response.text[:500]}...")
                        return []
                        
                elif response.status_code == 404:
                    logger.warning(f"iFlow {iflow_id} not found or no configurations available")
                    return []
                elif response.status_code == 401:
                    logger.error(f"Authentication failed for configurations request")
                    # Try to refresh token and retry once
                    await self._refresh_token()
                    headers = await self._get_auth_headers()
                    
                    retry_response = await client.get(url, headers=headers)
                    if retry_response.status_code == 200:
                        data = retry_response.json()
                        configurations = data.get("d", {}).get("results", [])
                        return configurations
                    else:
                        logger.error(f"Retry also failed with status: {retry_response.status_code}")
                        return []
                else:
                    logger.warning(f"Failed to get configurations for {iflow_id}: {response.status_code}")
                    logger.debug(f"Error response: {response.text}")
                    return []
                    
            except httpx.TimeoutException:
                logger.error(f"Timeout while fetching configurations for {iflow_id}")
                return []
            except httpx.RequestError as req_error:
                logger.error(f"Request error while fetching configurations: {req_error}")
                return []

    except Exception as e:
        logger.error(f"Error fetching configurations for {iflow_id}: {str(e)}", exc_info=True)
        return []


@app.get("/api/sap/iflows/{iflow_id}/configurations/debug")
async def debug_iflow_configurations(iflow_id: str, version: str = "active"):
    """Debug endpoint to check configuration API response format"""
    global sap_client

    if not sap_client:
        raise HTTPException(status_code=500, detail="SAP client not initialized")

    try:
        url = f"{sap_client.base_url}/api/v1/IntegrationDesigntimeArtifacts(Id='{iflow_id}',Version='{version}')/Configurations"
        headers = await sap_client._get_auth_headers()
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=headers)
            
            debug_info = {
                "url": url,
                "status_code": response.status_code,
                "headers": dict(response.headers),
                "content_type": response.headers.get("content-type"),
                "content_length": response.headers.get("content-length"),
                "raw_response": response.text[:1000] + "..." if len(response.text) > 1000 else response.text
            }
            
            if response.status_code == 200:
                try:
                    debug_info["parsed_json"] = response.json()
                except:
                    debug_info["json_parse_error"] = "Failed to parse as JSON"
            
            return debug_info
            
    except Exception as e:
        return {"error": str(e), "traceback": traceback.format_exc()}


@app.get("/api/sap/iflows/{iflow_id}/configuration")
async def get_iflow_configuration(iflow_id: str, version: str = "active") -> APIResponse:
    """Get configuration parameters for a specific integration flow - simplified endpoint"""
    global sap_client

    if not sap_client:
        raise HTTPException(status_code=500, detail="SAP client not initialized")

    try:
        logger.info(f"Fetching configuration for iFlow: {iflow_id}, version: {version}")
        
        # Get configurations
        configurations = await sap_client.get_iflow_configurations(iflow_id, version)

        # Transform configurations to expected format
        parameters = []
        for config in configurations:
            parameters.append({
                "ParameterKey": config.get("ParameterKey", ""),
                "ParameterValue": config.get("ParameterValue", ""),
                "DataType": config.get("DataType", "string"),
                "Description": config.get("Description", ""),
                "Mandatory": config.get("Mandatory", False)
            })

        response_data = {
            "name": f"iFlow {iflow_id}",
            "version": version,
            "parameters": parameters
        }

        return APIResponse(
            success=True,
            data=response_data,
            message=f"Successfully retrieved configuration for {iflow_id}",
            timestamp=datetime.now().isoformat()
        )

    except Exception as e:
        logger.error(f"Failed to fetch iflow configuration: {str(e)}")
        
        # Return empty configuration instead of failing
        return APIResponse(
            success=True,
            data={
                "name": f"iFlow {iflow_id}",
                "version": version,
                "parameters": []
            },
            message=f"No configuration parameters found for {iflow_id}",
            timestamp=datetime.now().isoformat()
        )

class IFlowConfigurationData(BaseModel):
    iflowId: str
    iflowName: str
    version: str
    configurations: Dict[str, str]

class SaveConfigurationRequest(BaseModel):
    environment: str
    timestamp: str
    iflows: List[IFlowConfigurationData]

# Create configurations directory if it doesn't exist
CONFIGURATIONS_DIR = Path("configurations")
CONFIGURATIONS_DIR.mkdir(exist_ok=True)

@app.post("/api/save-iflow-configurations")
async def save_iflow_configurations(request: SaveConfigurationRequest):
    """
    Save iFlow configurations to CSV file
    Creates separate CSV files for each environment
    """
    try:
        # Generate filename based on environment and timestamp
        timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"iflow_configurations_{request.environment}_{timestamp_str}.csv"
        filepath = CONFIGURATIONS_DIR / filename
        
        # Also create/update a latest file for each environment
        latest_filename = f"iflow_configurations_{request.environment}_latest.csv"
        latest_filepath = CONFIGURATIONS_DIR / latest_filename
        
        # Prepare CSV data
        csv_data = []
        
        for iflow in request.iflows:
            # Create a row for each configuration parameter
            for param_key, param_value in iflow.configurations.items():
                csv_data.append({
                    'Environment': request.environment,
                    'Timestamp': request.timestamp,
                    'iFlow_ID': iflow.iflowId,
                    'iFlow_Name': iflow.iflowName,
                    'iFlow_Version': iflow.version,
                    'Parameter_Key': param_key,
                    'Parameter_Value': param_value,
                    'Saved_At': datetime.now().isoformat()
                })
        
        # Define CSV headers
        headers = [
            'Environment',
            'Timestamp', 
            'iFlow_ID',
            'iFlow_Name',
            'iFlow_Version',
            'Parameter_Key',
            'Parameter_Value',
            'Saved_At'
        ]
        
        # Write to timestamped file
        with open(filepath, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=headers)
            writer.writeheader()
            writer.writerows(csv_data)
        
        # Write to latest file (overwrite previous)
        with open(latest_filepath, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=headers)
            writer.writeheader()
            writer.writerows(csv_data)
        
        # Log the save operation
        logger.info(f"✅ Saved {len(csv_data)} configuration parameters to {filename}")
        logger.info(f"📁 Files created: {filepath}, {latest_filepath}")
        
        return {
            "success": True,
            "message": f"Successfully saved {len(csv_data)} configuration parameters",
            "data": {
                "filename": filename,
                "latest_filename": latest_filename,
                "filepath": str(filepath),
                "latest_filepath": str(latest_filepath),
                "total_parameters": len(csv_data),
                "total_iflows": len(request.iflows),
                "environment": request.environment
            },
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to save configurations: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save configurations: {str(e)}"
        )

@app.get("/api/list-configuration-files")
async def list_configuration_files():
    """
    List all saved configuration files
    """
    try:
        files = []
        
        if CONFIGURATIONS_DIR.exists():
            for file_path in CONFIGURATIONS_DIR.glob("*.csv"):
                stat = file_path.stat()
                files.append({
                    "filename": file_path.name,
                    "filepath": str(file_path),
                    "size": stat.st_size,
                    "created": datetime.fromtimestamp(stat.st_ctime).isoformat(),
                    "modified": datetime.fromtimestamp(stat.st_mtime).isoformat()
                })
        
        # Sort by modification time (newest first)
        files.sort(key=lambda x: x["modified"], reverse=True)
        
        return {
            "success": True,
            "message": f"Found {len(files)} configuration files",
            "data": {
                "files": files,
                "total_files": len(files),
                "configurations_directory": str(CONFIGURATIONS_DIR)
            },
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to list configuration files: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list configuration files: {str(e)}"
        )

@app.get("/api/download-configuration-file/{filename}")
async def download_configuration_file(filename: str):
    """
    Download a specific configuration file
    """
    try:
        filepath = CONFIGURATIONS_DIR / filename
        
        if not filepath.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Configuration file '{filename}' not found"
            )
        
        # Read CSV file and return as JSON
        configurations = []
        with open(filepath, 'r', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            configurations = list(reader)
        
        return {
            "success": True,
            "message": f"Successfully loaded configuration file '{filename}'",
            "data": {
                "filename": filename,
                "filepath": str(filepath),
                "configurations": configurations,
                "total_records": len(configurations)
            },
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to download configuration file: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to download configuration file: {str(e)}"
        )

@app.get("/api/sap/iflows/{iflow_id}/design-guidelines")
async def get_design_guidelines(iflow_id: str, version: str, execution_id: Optional[str] = None) -> APIResponse:
    """Get design guidelines execution results for a specific integration flow"""
    global sap_client

    if not sap_client:
        raise HTTPException(status_code=500, detail="SAP client not initialized")

    try:
        logger.info(f"Fetching design guidelines for iFlow: {iflow_id}, version: {version}, execution_id: {execution_id}")
        guidelines = await sap_client.get_design_guidelines(iflow_id, version, execution_id)

        return APIResponse(
            success=True,
            data=guidelines,
            message=f"Successfully retrieved design guidelines for {iflow_id}",
            timestamp=datetime.now().isoformat()
        )

    except Exception as e:
        logger.error(f"Failed to fetch design guidelines: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch design guidelines: {str(e)}"
        )

@app.post("/api/sap/iflows/{iflow_id}/execute-guidelines")
async def execute_design_guidelines(iflow_id: str, version: str) -> APIResponse:
    """Execute design guidelines for a specific integration flow"""
    global sap_client

    if not sap_client:
        raise HTTPException(status_code=500, detail="SAP client not initialized")

    try:
        logger.info(f"Executing design guidelines for iFlow: {iflow_id}, version: {version}")
        result = await sap_client.execute_design_guidelines(iflow_id, version)

        return APIResponse(
            success=True,
            data=result,
            message=f"Successfully executed design guidelines for {iflow_id}",
            timestamp=datetime.now().isoformat()
        )

    except Exception as e:
        logger.error(f"Failed to execute design guidelines: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to execute design guidelines: {str(e)}"
        )

@app.get("/api/sap/iflows/{iflow_id}/design-guidelines-with-execution/{execution_id}")
async def get_design_guidelines_by_execution(iflow_id: str, version: str, execution_id: str) -> APIResponse:
    """Get design guidelines execution results using specific execution ID"""
    global sap_client

    if not sap_client:
        raise HTTPException(status_code=500, detail="SAP client not initialized")

    try:
        logger.info(f"Fetching design guidelines for iFlow: {iflow_id}, version: {version}, execution_id: {execution_id}")
        guidelines = await sap_client.get_design_guidelines(iflow_id, version, execution_id)

        return APIResponse(
            success=True,
            data=guidelines,
            message=f"Successfully retrieved design guidelines for execution {execution_id}",
            timestamp=datetime.now().isoformat()
        )

    except Exception as e:
        logger.error(f"Failed to fetch design guidelines: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch design guidelines: {str(e)}"
        )

@app.get("/api/sap/iflows/{iflow_id}/resources")
async def get_iflow_resources(iflow_id: str, version: str) -> APIResponse:
    """Get resources/dependencies for a specific integration flow"""
    global sap_client

    if not sap_client:
        raise HTTPException(status_code=500, detail="SAP client not initialized")

    try:
        logger.info(f"Fetching resources for iFlow: {iflow_id}, version: {version}")
        resources = await sap_client.get_iflow_resources(iflow_id, version)

        return APIResponse(
            success=True,
            data=resources,
            message=f"Successfully retrieved resources for {iflow_id}",
            timestamp=datetime.now().isoformat()
        )

    except Exception as e:
        logger.error(f"Failed to fetch iflow resources: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch iflow resources: {str(e)}"
        )

@app.post("/api/sap/iflows/{iflow_id}/deploy")
async def deploy_iflow(iflow_id: str, version: str, target_environment: str) -> APIResponse:
    """Deploy integration flow to runtime"""
    global sap_client

    if not sap_client:
        raise HTTPException(status_code=500, detail="SAP client not initialized")

    try:
        logger.info(f"Deploying iFlow: {iflow_id}, version: {version} to {target_environment}")
        result = await sap_client.deploy_iflow(iflow_id, version, target_environment)

        return APIResponse(
            success=True,
            data=result,
            message=f"Successfully deployed {iflow_id} to {target_environment}",
            timestamp=datetime.now().isoformat()
        )

    except Exception as e:
        logger.error(f"Failed to deploy iflow: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to deploy iflow: {str(e)}"
        )

@app.get("/api/sap/iflows")
async def get_integration_flows(package_ids: Optional[str] = None) -> APIResponse:
    """Get Integration Flows from SAP Integration Suite

    Args:
        package_ids: Comma-separated list of package IDs to filter by (optional)
    """
    global sap_client

    if not sap_client:
        raise HTTPException(status_code=500, detail="SAP client not initialized")

    try:
        # Parse package IDs if provided
        selected_package_ids = []
        if package_ids:
            selected_package_ids = [pkg_id.strip() for pkg_id in package_ids.split(',') if pkg_id.strip()]
            logger.info(f"Fetching Integration Flows from {len(selected_package_ids)} selected packages: {selected_package_ids}")
        else:
            logger.info("Fetching Integration Flows from all packages")

        iflows = await sap_client.get_integration_flows(selected_package_ids if selected_package_ids else None)

        return APIResponse(
            success=True,
            data=iflows,
            message=f"Successfully retrieved {len(iflows)} integration flows{f' from {len(selected_package_ids)} packages' if selected_package_ids else ''}",
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
        token_info = await sap_client.get_token_status()

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
            "iFlow Details",
            "Design Guidelines",
            "iFlow Configurations",
            "iFlow Resources"
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