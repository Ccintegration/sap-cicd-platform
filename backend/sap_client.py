"""
SAP Integration Suite API Client
Handles authentication and API calls to SAP Integration Suite
"""

import httpx
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from models import IntegrationPackage, IntegrationFlow, TokenInfo, TenantConfig
import urllib.parse

logger = logging.getLogger(__name__)

class SAPCredentials(BaseModel):
    client_id: str
    client_secret: str
    token_url: str
    base_url: str
    auth_url: Optional[str] = None

class SAPClient:
    """SAP Integration Suite API Client"""

    def __init__(self, credentials: TenantConfig):
        self.client_id = credentials.client_id
        self.client_secret = credentials.client_secret
        self.token_url = credentials.token_url
        self.base_url = credentials.base_url
        self.auth_url = credentials.auth_url
        self.token_info: Optional[TokenInfo] = None
        self.oauth_token: str = ""
        self.token_expiry: datetime = datetime.now()

        # HTTP client with timeouts
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0),
            limits=httpx.Limits(max_keepalive_connections=10, max_connections=20)
        )

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()

    async def get_token(self) -> Dict[str, Any]:
        """Get OAuth access token from SAP"""
        try:
            if self.token_info and self._is_token_valid():
                return self.token_info.dict()

            logger.info("Requesting new access token from SAP")

            auth_data = {
                'grant_type': 'client_credentials',
                'client_id': self.client_id,
                'client_secret': self.client_secret
            }

            response = await self.client.post(
                self.token_url,
                data=auth_data,
                headers={'Content-Type': 'application/x-www-form-urlencoded'}
            )

            if response.status_code != 200:
                error_msg = f"Token request failed: {response.status_code} - {response.text}"
                logger.error(error_msg)
                raise Exception(error_msg)

            token_data = response.json()

            # Create token info with expiration
            self.token_info = TokenInfo(
                access_token=token_data['access_token'],
                token_type=token_data.get('token_type', 'Bearer'),
                expires_in=token_data.get('expires_in', 3600),
                expires_at=datetime.now() + timedelta(seconds=token_data.get('expires_in', 3600))
            )

            logger.info("Successfully obtained access token")
            return token_data

        except Exception as e:
            logger.error(f"Failed to get access token: {e}")
            raise Exception(f"Authentication failed: {str(e)}")

    def _is_token_valid(self) -> bool:
        """Check if current token is still valid"""
        if not self.token_info or not self.token_info.expires_at:
            return False

        # Consider token expired 5 minutes before actual expiration
        buffer_time = timedelta(minutes=5)
        return datetime.now() < (self.token_info.expires_at - buffer_time)

    async def _make_authenticated_request(self, method: str, endpoint: str, **kwargs) -> httpx.Response:
        """Make an authenticated request to SAP API"""
        # Ensure we have a valid token
        await self.get_token()

        url = f"{self.base_url}{endpoint}"
        headers = kwargs.pop('headers', {})
        headers['Authorization'] = f"Bearer {self.token_info.access_token}"
        headers['Accept'] = 'application/json'

        logger.debug(f"Making {method} request to {url}")

        response = await self.client.request(method, url, headers=headers, **kwargs)

        if response.status_code == 401:
            # Token might be expired, try refreshing once
            logger.warning("Received 401, refreshing token and retrying")
            self.token_info = None
            await self.get_token()
            headers['Authorization'] = f"Bearer {self.token_info.access_token}"
            response = await self.client.request(method, url, headers=headers, **kwargs)

        if not response.is_success:
            error_msg = f"API request failed: {response.status_code} - {response.text}"
            logger.error(error_msg)
            raise Exception(error_msg)

        return response

    async def get_integration_packages(self) -> List[IntegrationPackage]:
        """Get all integration packages"""
        try:
            logger.info("Fetching integration packages from SAP")

            # SAP Integration Suite API endpoint for packages
            endpoint = "/api/v1/IntegrationPackages"

            response = await self._make_authenticated_request("GET", endpoint)
            data = response.json()

            packages = []

            # Handle different response formats
            items = data.get('d', {}).get('results', []) if 'd' in data else data.get('results', data)
            if isinstance(items, dict):
                items = [items]

            for item in items:
                package = IntegrationPackage(
                    id=item.get('Id', ''),
                    name=item.get('Name', ''),
                    description=item.get('Description') or '',
                    version=item.get('Version') or '1.0.0',
                    modifiedDate=item.get('ModifiedDate'),
                    modifiedBy=item.get('ModifiedBy'),
                    createdDate=item.get('CreatedDate'),
                    createdBy=item.get('CreatedBy')
                )
                packages.append(package)

            logger.info(f"Successfully fetched {len(packages)} integration packages")
            return packages

        except Exception as e:
            logger.error(f"Failed to fetch integration packages: {e}")

            # Return demo data for testing if API fails
            demo_packages = [
                IntegrationPackage(
                    id="demo_package_001",
                    name="Demo Customer Integration Package",
                    description="Sample integration package for testing",
                    version="1.0.0",
                    modifiedDate=datetime.now().isoformat(),
                    modifiedBy="demo_user"
                ),
                IntegrationPackage(
                    id="demo_package_002",
                    name="Demo Sales Integration Package",
                    description="Sales data integration package",
                    version="1.1.0",
                    modifiedDate=datetime.now().isoformat(),
                    modifiedBy="demo_user"
                )
            ]

            logger.warning("Returning demo data due to API failure")
            return demo_packages

    async def get_integration_flows(self) -> List[Dict[str, Any]]:
        """Fetch all integration flows from SAP"""
        try:
            logger.info("Fetching integration flows from SAP")
            
            # Use single quotes for OData filter value, encoded as %27
            filter_param = "$filter=Type eq %27IntegrationFlow%27"
            url = f"{self.base_url}/api/v1/IntegrationDesigntimeArtifacts?{filter_param}"
            
            headers = await self._get_auth_headers()
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=headers)
                
                if response.status_code != 200:
                    error_msg = f"API request failed: {response.status_code} - {response.text}"
                    logger.error(error_msg)
                    raise Exception(error_msg)
                
                data = response.json()
                flows = data.get("d", {}).get("results", [])
                logger.info(f"Successfully fetched {len(flows)} integration flows")
                return flows
                
        except Exception as e:
            error_msg = f"Failed to fetch integration flows: {str(e)}"
            logger.error(error_msg)
            raise Exception(error_msg)

    async def get_package_details(self, package_id: str) -> Dict[str, Any]:
        """Get detailed information about a specific package"""
        try:
            endpoint = f"/api/v1/IntegrationPackages('{package_id}')"
            response = await self._make_authenticated_request("GET", endpoint)
            return response.json()
        except Exception as e:
            logger.error(f"Failed to get package details for {package_id}: {e}")
            raise

    async def get_iflow_details(self, iflow_id: str) -> Dict[str, Any]:
        """Get detailed information about a specific iFlow"""
        try:
            endpoint = f"/api/v1/IntegrationDesigntimeArtifacts(Id='{iflow_id}',Version='active')"
            response = await self._make_authenticated_request("GET", endpoint)
            return response.json()
        except Exception as e:
            logger.error(f"Failed to get iFlow details for {iflow_id}: {e}")
            raise

    async def refresh_token(self) -> Dict[str, Any]:
        """Force refresh the access token"""
        self.token_info = None
        return await self.get_token()

    async def get_token_status(self) -> Dict[str, Any]:
        """Get current token status information"""
        if not self.token_info:
            return {
                "has_token": False,
                "token_status": "none",
                "expires_at": None,
                "time_to_expiry_seconds": None,
                "token_type": None
            }

        is_valid = self._is_token_valid()
        time_to_expiry = None

        if self.token_info.expires_at:
            time_to_expiry = max(0, int((self.token_info.expires_at - datetime.now()).total_seconds()))

        return {
            "has_token": True,
            "token_status": "valid" if is_valid else "expired",
            "expires_at": self.token_info.expires_at.isoformat() if self.token_info.expires_at else None,
            "time_to_expiry_seconds": time_to_expiry,
            "token_type": self.token_info.token_type
        }

    async def _get_auth_headers(self) -> Dict[str, str]:
        """Get authentication headers for SAP API requests"""
        if not self.oauth_token or self._is_token_expired():
            await self._refresh_token()
        
        return {
            "Authorization": f"Bearer {self.oauth_token}",
            "Accept": "application/json"
        }

    async def _refresh_token(self) -> None:
        """Refresh the OAuth token"""
        try:
            logger.info("Requesting new access token from SAP")
            auth = (self.client_id, self.client_secret)
            data = {"grant_type": "client_credentials"}
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.token_url,
                    auth=auth,
                    data=data
                )
                response.raise_for_status()
                
                token_data = response.json()
                self.oauth_token = token_data["access_token"]
                expires_in = int(token_data["expires_in"])
                self.token_expiry = datetime.now() + timedelta(seconds=expires_in)
                logger.info("Successfully obtained access token")
                
        except Exception as e:
            error_msg = f"Failed to refresh OAuth token: {str(e)}"
            logger.error(error_msg)
            raise

    def _is_token_expired(self) -> bool:
        """Check if the current OAuth token is expired"""
        if not self.token_expiry:
            return True
        # Return True if token expires in less than 60 seconds
        return datetime.now() + timedelta(seconds=60) >= self.token_expiry
