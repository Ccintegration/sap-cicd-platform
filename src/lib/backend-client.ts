/**
 * Backend API Client
 * Handles communication with the Python FastAPI backend
 */

import {
  BaseTenantData,
  IntegrationPackage,
  IntegrationFlow,
  ConnectionTestResult,
  TenantFormData,
} from "./types";

// Backend configuration - supports multiple environments
const getBackendBaseUrl = (): string => {
  // Check for environment variable first
  if (typeof window !== "undefined") {
    // @ts-ignore - for injected environment variables
    if (window.BACKEND_URL) {
      // @ts-ignore
      return window.BACKEND_URL;
    }
  }

  // Check for saved backend URL in localStorage (for cloud environments)
  if (typeof window !== "undefined") {
    const savedUrl = localStorage.getItem("backend_ngrok_url");
    if (savedUrl && savedUrl.trim() !== "") {
      return savedUrl.trim();
    }
  }

  // Check for environment-specific URLs
  const hostname =
    typeof window !== "undefined" ? window.location.hostname : "localhost";

  // If running in Builder.io environment
  if (hostname.includes("builder.codes") || hostname.includes("builder.io")) {
    // For cloud environment, try common backend URLs
    // You can set a specific backend URL here if you have one deployed
    return ""; // Leave empty for now, will use simulation mode
  }

  // Default to localhost for local development
  return "http://localhost:8000";
};

const BACKEND_BASE_URL = getBackendBaseUrl();
const API_PREFIX = "/api";

interface BackendResponse<T = any> {
  success: boolean;
  data?: T;
  message: string;
  timestamp: string;
  error?: string;
}

interface BackendHealth {
  status: string;
  timestamp: string;
  services: {
    api: string;
    sap_connection: string;
  };
  sap_error?: string;
}

export class BackendAPIClient {
  private baseUrl: string;

  constructor(baseUrl: string = BACKEND_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Get the configured backend URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Update the backend URL dynamically
   */
  updateBaseUrl(newUrl: string): void {
    this.baseUrl = newUrl;
  }

  /**
   * Refresh backend URL from latest configuration
   */
  refreshBackendUrl(): void {
    this.baseUrl = getBackendBaseUrl();
  }

  /**
   * Make HTTP request to backend with error handling
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    // Check if backend URL is available
    if (!this.baseUrl || this.baseUrl === "") {
      throw new BackendConnectionError(
        "No backend server configured. Running in cloud environment without local backend access.",
      );
    }

    const url = `${this.baseUrl}${API_PREFIX}${endpoint}`;

    const defaultHeaders = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    try {
      console.log(`🔄 [Backend] ${config.method || "GET"} ${url}`);

      const response = await fetch(url, config);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.detail || errorMessage;
          } else {
            const errorText = await response.text();
            errorMessage = `${errorMessage}. Response: ${errorText.substring(0, 200)}`;
          }
        } catch (parseError) {
          // If we can't parse the error response, use the status text
          errorMessage = `${errorMessage}. Could not parse error response.`;
        }

        throw new Error(errorMessage);
      }

      // Check if response is JSON before parsing
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const responseText = await response.text();
        throw new Error(
          `Expected JSON response but got: ${contentType}. Response: ${responseText.substring(0, 100)}`,
        );
      }

      const data = await response.json();
      console.log(`✅ [Backend] Request successful`);

      return data;
    } catch (error) {
      console.error(`❌ [Backend] Request failed:`, error);

      // Handle specific network errors
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new BackendConnectionError(
          `Cannot connect to backend server at ${this.baseUrl}. ` +
            `${
              this.baseUrl.includes("localhost")
                ? "Backend may not be running locally. " +
                  "Start your Python backend or use ngrok for cloud access."
                : "Backend server may be down or inaccessible."
            }`,
        );
      }

      throw error;
    }
  }

  /**
   * Health and Status Methods
   */

  async getHealth(): Promise<BackendHealth> {
    if (!this.baseUrl || this.baseUrl === "") {
      throw new BackendConnectionError("No backend URL configured");
    }

    const response = await fetch(`${this.baseUrl}/health`);
    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(
        `Backend health check failed: ${response.status} - ${errorText}`,
      );
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const responseText = await response.text();
      throw new Error(
        `Expected JSON response but got: ${contentType}. Response: ${responseText.substring(0, 100)}`,
      );
    }

    return response.json();
  }

  async getStatus(): Promise<{ message: string; status: string }> {
    if (!this.baseUrl || this.baseUrl === "") {
      throw new BackendConnectionError("No backend URL configured");
    }

    const response = await fetch(`${this.baseUrl}/`);
    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(
        `Backend status check failed: ${response.status} - ${errorText}`,
      );
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const responseText = await response.text();
      throw new Error(
        `Expected JSON response but got: ${contentType}. Response: ${responseText.substring(0, 100)}`,
      );
    }

    return response.json();
  }

  async getConfig(): Promise<BackendResponse> {
    return this.makeRequest("/config");
  }

  /**
   * SAP Integration Suite Methods
   */

  async getIntegrationPackages(): Promise<IntegrationPackage[]> {
    const response: BackendResponse<IntegrationPackage[]> =
      await this.makeRequest("/sap/packages");

    if (!response.success) {
      throw new Error(response.error || "Failed to fetch packages");
    }

    return response.data || [];
  }

  async getIntegrationFlows(): Promise<IntegrationFlow[]> {
    const response: BackendResponse<IntegrationFlow[]> =
      await this.makeRequest("/sap/iflows");

    if (!response.success) {
      throw new Error(response.error || "Failed to fetch iFlows");
    }

    return response.data || [];
  }

  async getBaseTenantData(): Promise<BaseTenantData> {
    const response: BackendResponse<BaseTenantData> = await this.makeRequest(
      "/sap/base-tenant-data",
    );

    if (!response.success) {
      throw new Error(response.error || "Failed to fetch base tenant data");
    }

    if (!response.data) {
      throw new Error("No data received from backend");
    }

    // Ensure dates are properly parsed
    const data = response.data;
    return {
      ...data,
      lastSynced: new Date(data.lastSynced),
      packages: data.packages.map((pkg) => ({
        ...pkg,
        lastModified: new Date(pkg.lastModified),
      })),
      iflows: data.iflows.map((iflow) => ({
        ...iflow,
        lastDeployed: iflow.lastDeployed
          ? new Date(iflow.lastDeployed)
          : undefined,
      })),
    };
  }

  async getPackageDetails(packageId: string): Promise<any> {
    const response: BackendResponse = await this.makeRequest(
      `/sap/packages/${packageId}`,
    );

    if (!response.success) {
      throw new Error(
        response.error || `Failed to fetch package details: ${packageId}`,
      );
    }

    return response.data;
  }

  async getIFlowDetails(iflowId: string): Promise<any> {
    const response: BackendResponse = await this.makeRequest(
      `/sap/iflows/${iflowId}`,
    );

    if (!response.success) {
      throw new Error(
        response.error || `Failed to fetch iFlow details: ${iflowId}`,
      );
    }

    return response.data;
  }

  /**
   * Token Management Methods
   */

  async refreshToken(): Promise<void> {
    const response: BackendResponse = await this.makeRequest(
      "/sap/refresh-token",
      {
        method: "POST",
      },
    );

    if (!response.success) {
      throw new Error(response.error || "Failed to refresh token");
    }
  }

  async getTokenStatus(): Promise<any> {
    const response: BackendResponse =
      await this.makeRequest("/sap/token-status");

    if (!response.success) {
      throw new Error(response.error || "Failed to get token status");
    }

    return response.data;
  }

  /**
   * Tenant Testing Methods
   */

  async testConnection(
    tenantData: TenantFormData,
  ): Promise<ConnectionTestResult> {
    const payload = {
      name: tenantData.name,
      description: tenantData.description || "",
      client_id: tenantData.oauthCredentials.clientId,
      client_secret: tenantData.oauthCredentials.clientSecret,
      token_url: tenantData.oauthCredentials.tokenUrl,
      base_url: tenantData.baseUrl,
    };

    const response: ConnectionTestResult = await this.makeRequest(
      "/tenants/test-connection",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );

    return response;
  }

  /**
   * Utility Methods
   */

  async isBackendAvailable(): Promise<boolean> {
    try {
      // If no backend URL is configured, return false immediately
      if (!this.baseUrl || this.baseUrl === "") {
        console.info(
          "No backend URL configured - running in cloud environment",
        );
        return false;
      }

      await this.getStatus();
      return true;
    } catch (error) {
      console.warn("Backend not available:", error);
      return false;
    }
  }

  async waitForBackend(timeoutMs: number = 30000): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const isAvailable = await this.isBackendAvailable();
        if (isAvailable) {
          return true;
        }
      } catch (error) {
        // Continue trying
      }

      // Wait 1 second before retrying
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return false;
  }

  getBackendUrl(): string {
    return this.baseUrl;
  }
}

// Default client instance
export const backendClient = new BackendAPIClient();

// Backend-specific error types
export class BackendError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: any,
  ) {
    super(message);
    this.name = "BackendError";
  }
}

export class BackendConnectionError extends BackendError {
  constructor(message: string = "Cannot connect to backend server") {
    super(message, 0);
    this.name = "BackendConnectionError";
  }
}

export class BackendSAPError extends BackendError {
  constructor(message: string, details?: any) {
    super(message, 500, details);
    this.name = "BackendSAPError";
  }
}

// Helper functions for error handling
export function isBackendError(error: any): error is BackendError {
  return error instanceof BackendError;
}

export function isBackendConnectionError(
  error: any,
): error is BackendConnectionError {
  return error instanceof BackendConnectionError;
}

export function isBackendSAPError(error: any): error is BackendSAPError {
  return error instanceof BackendSAPError;
}
