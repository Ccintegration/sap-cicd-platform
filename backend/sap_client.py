# backend/sap_client.py - Enhanced version with better configuration handling

import httpx
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import json
import asyncio

logger = logging.getLogger(__name__)

class SAPIntegrationSuiteClient:
    def __init__(self, client_id: str, client_secret: str, token_url: str, base_url: str):
        self.client_id = client_id
        self.client_secret = client_secret
        self.token_url = token_url
        self.base_url = base_url
        self.access_token = None
        self.token_expires_at = None
        self._token_lock = asyncio.Lock()

    async def _get_auth_headers(self) -> Dict[str, str]:
        """Get authentication headers with valid token"""
        async with self._token_lock:
            if not self.access_token or self._is_token_expired():
                await self._refresh_token()
            
            return {
                "Authorization": f"Bearer {self.access_token}",
                "Accept": "application/json",
                "Content-Type": "application/json"
            }

    def _is_token_expired(self) -> bool:
        """Check if the current token is expired"""
        if not self.token_expires_at:
            return True
        # Add 5 minute buffer
        return datetime.now() >= (self.token_expires_at - timedelta(minutes=5))

    async def _refresh_token(self):
        """Refresh the OAuth access token"""
        try:
            logger.info("Refreshing OAuth token...")
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                data = {
                    "grant_type": "client_credentials",
                    "client_id": self.client_id,
                    "client_secret": self.client_secret
                }
                
                response = await client.post(self.token_url, data=data)
                response.raise_for_status()
                
                token_data = response.json()
                self.access_token = token_data["access_token"]
                expires_in = token_data.get("expires_in", 3600)
                self.token_expires_at = datetime.now() + timedelta(seconds=expires_in)
                
                logger.info(f"Token refreshed successfully, expires at {self.token_expires_at}")
                
        except Exception as e:
            logger.error(f"Failed to refresh token: {str(e)}")
            raise Exception(f"Authentication failed: {str(e)}")

    async def get_iflow_configurations(self, iflow_id: str, version: str) -> List[Dict[str, Any]]:
        """Get configuration parameters for a specific integration flow - enhanced version"""
        try:
            logger.info(f"🔧 Fetching configurations for iFlow: {iflow_id}, version: {version}")

            # SAP API endpoint for configurations
            url = f"{self.base_url}/api/v1/IntegrationDesigntimeArtifacts(Id='{iflow_id}',Version='{version}')/Configurations"
            
            logger.debug(f"🔧 SAP API URL: {url}")

            headers = await self._get_auth_headers()
            
            # Use retry mechanism for better reliability
            configurations = await self._fetch_with_retry(url, headers, max_retries=3)
            
            logger.info(f"🔧 Successfully loaded {len(configurations)} configuration parameters for {iflow_id}")
            return configurations
            
        except Exception as e:
            logger.error(f"🔧 Error fetching configurations for {iflow_id}: {str(e)}", exc_info=True)
            return []

    async def _fetch_with_retry(self, url: str, headers: Dict[str, str], max_retries: int = 3) -> List[Dict[str, Any]]:
        """Fetch data from SAP API with retry logic"""
        last_exception = None
        
        for attempt in range(max_retries):
            try:
                logger.debug(f"🔧 Attempt {attempt + 1} of {max_retries}")
                
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.get(url, headers=headers)
                    
                    logger.debug(f"🔧 SAP API Response Status: {response.status_code}")
                    logger.debug(f"🔧 SAP API Response Headers: {dict(response.headers)}")
                    
                    if response.status_code == 200:
                        return await self._parse_configuration_response(response)
                    elif response.status_code == 401:
                        logger.warning("🔧 Authentication failed, refreshing token...")
                        # Token might be expired, refresh and retry
                        async with self._token_lock:
                            await self._refresh_token()
                            headers = await self._get_auth_headers()
                        continue
                    elif response.status_code == 404:
                        logger.warning(f"🔧 iFlow configurations not found (404)")
                        return []
                    elif response.status_code == 500:
                        logger.error(f"🔧 SAP server error (500), attempt {attempt + 1}")
                        if attempt < max_retries - 1:
                            await asyncio.sleep(2 ** attempt)  # Exponential backoff
                            continue
                        else:
                            raise Exception(f"SAP server error: {response.status_code}")
                    else:
                        logger.error(f"🔧 Unexpected status code: {response.status_code}")
                        logger.debug(f"🔧 Response content: {response.text[:500]}...")
                        raise Exception(f"SAP API error: {response.status_code} - {response.text[:200]}")
                        
            except httpx.TimeoutException:
                last_exception = Exception(f"Timeout on attempt {attempt + 1}")
                logger.warning(f"🔧 Request timeout on attempt {attempt + 1}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(2 ** attempt)
                    continue
            except httpx.RequestError as req_error:
                last_exception = Exception(f"Request error: {str(req_error)}")
                logger.error(f"🔧 Request error on attempt {attempt + 1}: {req_error}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(2 ** attempt)
                    continue
            except Exception as e:
                last_exception = e
                logger.error(f"🔧 Unexpected error on attempt {attempt + 1}: {str(e)}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(2 ** attempt)
                    continue
        
        # All retries failed
        if last_exception:
            raise last_exception
        else:
            raise Exception("All retry attempts failed")

    async def _parse_configuration_response(self, response: httpx.Response) -> List[Dict[str, Any]]:
        """Parse and validate SAP configuration response"""
        try:
            data = response.json()
            logger.debug(f"🔧 Raw response data type: {type(data)}")
            
            configurations = []
            
            # Handle different SAP API response formats
            if isinstance(data, dict):
                # OData format: {"d": {"results": [...]}}
                if "d" in data:
                    if isinstance(data["d"], dict) and "results" in data["d"]:
                        configurations = data["d"]["results"]
                        logger.debug(f"🔧 Found OData format with {len(configurations)} configurations")
                    elif isinstance(data["d"], list):
                        configurations = data["d"]
                        logger.debug(f"🔧 Found OData list format with {len(configurations)} configurations")
                # Direct format: {"results": [...]}
                elif "results" in data:
                    configurations = data["results"]
                    logger.debug(f"🔧 Found direct results format with {len(configurations)} configurations")
                # Simple format: {"configurations": [...]}
                elif "configurations" in data:
                    configurations = data["configurations"]
                    logger.debug(f"🔧 Found configurations format with {len(configurations)} configurations")
                # Value format: {"value": [...]}
                elif "value" in data:
                    configurations = data["value"]
                    logger.debug(f"🔧 Found value format with {len(configurations)} configurations")
                else:
                    logger.warning(f"🔧 Unknown response format, keys: {list(data.keys())}")
                    configurations = []
            elif isinstance(data, list):
                configurations = data
                logger.debug(f"🔧 Found direct list format with {len(configurations)} configurations")
            else:
                logger.warning(f"🔧 Unexpected data type: {type(data)}")
                configurations = []
            
            # Validate and clean the configurations
            cleaned_configurations = []
            for i, config in enumerate(configurations):
                try:
                    if not isinstance(config, dict):
                        logger.warning(f"🔧 Skipping non-dict configuration at index {i}: {type(config)}")
                        continue
                    
                    # Extract and validate configuration fields
                    cleaned_config = {
                        "ParameterKey": self._safe_get_string(config, ["ParameterKey", "Key", "Name"], f"param_{i}"),
                        "ParameterValue": self._safe_get_string(config, ["ParameterValue", "Value", "DefaultValue"], ""),
                        "DataType": self._safe_get_string(config, ["DataType", "Type", "DataType"], "string"),
                        "Description": self._safe_get_string(config, ["Description", "Help", "Comment"], ""),
                        "Mandatory": self._safe_get_boolean(config, ["Mandatory", "Required", "IsRequired"], False)
                    }
                    
                    # Validate that we have at least a parameter key
                    if cleaned_config["ParameterKey"]:
                        cleaned_configurations.append(cleaned_config)
                        logger.debug(f"🔧 Added parameter: {cleaned_config['ParameterKey']}")
                    else:
                        logger.warning(f"🔧 Skipping configuration without valid key: {config}")
                        
                except Exception as config_error:
                    logger.warning(f"🔧 Error processing configuration at index {i}: {config_error}")
                    continue
            
            logger.info(f"🔧 Successfully processed {len(cleaned_configurations)} valid configurations")
            return cleaned_configurations
            
        except json.JSONDecodeError as json_error:
            logger.error(f"🔧 Failed to parse JSON response: {json_error}")
            logger.debug(f"🔧 Raw response content: {response.text[:500]}...")
            return []
        except Exception as e:
            logger.error(f"🔧 Error parsing configuration response: {str(e)}")
            return []

    def _safe_get_string(self, data: Dict[str, Any], keys: List[str], default: str = "") -> str:
        """Safely extract string value from dict using multiple possible keys"""
        for key in keys:
            if key in data and data[key] is not None:
                value = data[key]
                if isinstance(value, str):
                    return value.strip()
                else:
                    return str(value).strip()
        return default

    def _safe_get_boolean(self, data: Dict[str, Any], keys: List[str], default: bool = False) -> bool:
        """Safely extract boolean value from dict using multiple possible keys"""
        for key in keys:
            if key in data and data[key] is not None:
                value = data[key]
                if isinstance(value, bool):
                    return value
                elif isinstance(value, str):
                    return value.lower() in ('true', '1', 'yes', 'on')
                elif isinstance(value, (int, float)):
                    return bool(value)
        return default

    async def test_connection(self) -> Dict[str, Any]:
        """Test the connection to SAP Integration Suite"""
        try:
            logger.info("🔍 Testing SAP Integration Suite connection...")
            
            # Test token acquisition
            start_time = datetime.now()
            await self._refresh_token()
            
            # Test basic API access
            headers = await self._get_auth_headers()
            url = f"{self.base_url}/api/v1/IntegrationPackages"
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, headers=headers)
                end_time = datetime.now()
                response_time = (end_time - start_time).total_seconds() * 1000
                
                if response.status_code == 200:
                    data = response.json()
                    packages_count = 0
                    
                    # Count packages from different response formats
                    if isinstance(data, dict):
                        if "d" in data and "results" in data["d"]:
                            packages_count = len(data["d"]["results"])
                        elif "results" in data:
                            packages_count = len(data["results"])
                        elif "value" in data:
                            packages_count = len(data["value"])
                    elif isinstance(data, list):
                        packages_count = len(data)
                    
                    logger.info(f"🔍 Connection test successful - found {packages_count} packages")
                    
                    return {
                        "success": True,
                        "message": f"Successfully connected to SAP Integration Suite. Found {packages_count} packages.",
                        "response_time": int(response_time),
                        "details": {
                            "token_obtained": True,
                            "api_accessible": True,
                            "packages_found": packages_count,
                            "test_timestamp": datetime.now().isoformat()
                        }
                    }
                else:
                    logger.error(f"🔍 Connection test failed with status: {response.status_code}")
                    return {
                        "success": False,
                        "message": f"API access failed with status {response.status_code}",
                        "response_time": int(response_time),
                        "details": {
                            "token_obtained": True,
                            "api_accessible": False,
                            "status_code": response.status_code,
                            "error": response.text[:200],
                            "test_timestamp": datetime.now().isoformat()
                        }
                    }
                    
        except Exception as e:
            logger.error(f"🔍 Connection test failed: {str(e)}")
            return {
                "success": False,
                "message": f"Connection failed: {str(e)}",
                "response_time": 0,
                "details": {
                    "token_obtained": False,
                    "api_accessible": False,
                    "error": str(e),
                    "test_timestamp": datetime.now().isoformat()
                }
            }

    async def get_integration_packages(self) -> List[Dict[str, Any]]:
        """Get all Integration Packages from SAP Integration Suite"""
        try:
            logger.info("📦 Fetching Integration Packages from SAP")
            
            url = f"{self.base_url}/api/v1/IntegrationPackages"
            headers = await self._get_auth_headers()
            
            packages = await self._fetch_with_retry(url, headers)
            logger.info(f"📦 Successfully fetched {len(packages)} integration packages")
            
            return packages
            
        except Exception as e:
            logger.error(f"📦 Failed to fetch integration packages: {str(e)}")
            raise Exception(f"Failed to fetch packages: {str(e)}")

    async def get_integration_flows_by_package(self, package_id: str) -> List[Dict[str, Any]]:
        """Get integration flows for a specific package"""
        try:
            logger.info(f"🔄 Fetching iFlows for package: {package_id}")
            
            url = f"{self.base_url}/api/v1/IntegrationPackages('{package_id}')/IntegrationDesigntimeArtifacts"
            headers = await self._get_auth_headers()
            
            iflows = await self._fetch_with_retry(url, headers)
            logger.info(f"🔄 Successfully fetched {len(iflows)} iFlows for package {package_id}")
            
            return iflows
            
        except Exception as e:
            logger.error(f"🔄 Failed to fetch iFlows for package {package_id}: {str(e)}")
            raise Exception(f"Failed to fetch iFlows for package {package_id}: {str(e)}")

    async def get_all_integration_flows(self) -> List[Dict[str, Any]]:
        """Get all integration flows from all packages"""
        try:
            logger.info("🔄 Fetching all Integration Flows from SAP")
            
            # First get all packages
            packages = await self.get_integration_packages()
            
            all_flows = []
            for package in packages:
                package_id = package.get("Id", "")
                if package_id:
                    try:
                        flows = await self.get_integration_flows_by_package(package_id)
                        # Add package info to each flow
                        for flow in flows:
                            flow["packageId"] = package_id
                            flow["packageName"] = package.get("Name", "")
                        all_flows.extend(flows)
                    except Exception as e:
                        logger.warning(f"🔄 Failed to fetch flows for package {package_id}: {str(e)}")
                        continue
            
            logger.info(f"🔄 Successfully fetched {len(all_flows)} total integration flows")
            return all_flows
            
        except Exception as e:
            logger.error(f"🔄 Failed to fetch all integration flows: {str(e)}")
            raise Exception(f"Failed to fetch integration flows: {str(e)}")

# Usage example and test function
async def test_sap_client():
    """Test function for the SAP client"""
    import os
    
    # Get credentials from environment or config
    client_id = os.getenv("SAP_CLIENT_ID")
    client_secret = os.getenv("SAP_CLIENT_SECRET")
    token_url = os.getenv("SAP_TOKEN_URL")
    base_url = os.getenv("SAP_BASE_URL")
    
    if not all([client_id, client_secret, token_url, base_url]):
        logger.error("Missing required SAP credentials in environment variables")
        return
    
    client = SAPIntegrationSuiteClient(client_id, client_secret, token_url, base_url)
    
    # Test connection
    result = await client.test_connection()
    print(f"Connection test: {'✅ PASSED' if result['success'] else '❌ FAILED'}")
    print(f"Message: {result['message']}")
    
    if result['success']:
        # Test configuration fetch for a sample iFlow
        try:
            configs = await client.get_iflow_configurations("sample_iflow_id", "active")
            print(f"Configuration test: ✅ PASSED - Found {len(configs)} parameters")
        except Exception as e:
            print(f"Configuration test: ❌ FAILED - {str(e)}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_sap_client())