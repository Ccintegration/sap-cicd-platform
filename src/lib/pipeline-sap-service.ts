import { TenantService } from "./tenant-service";
import { backendClient } from "./backend-client";
import { SAPTenant, IntegrationPackage, IntegrationFlow } from "./types";

interface SAPPackage {
  id: string;
  name: string;
  description: string;
  version: string;
  lastModified: string;
  author: string;
  iflowCount: number;
  status: "active" | "draft" | "deprecated";
}

interface SAPIFlow {
  id: string;
  name: string;
  packageId: string;
  description: string;
  version: string;
  status: "active" | "draft" | "error";
  lastModified: string;
  author: string;
  type: "http" | "mail" | "sftp" | "database";
}

export class PipelineSAPService {
  /**
   * Get the base tenant (registered SAP Integration Suite tenant)
   */
  private static async getBaseTenant(): Promise<SAPTenant | null> {
    const tenants = await TenantService.getAllTenants();
    return tenants.find((tenant) => tenant.isBaseTenant) || null;
  }

  /**
   * Transform backend IntegrationPackage to pipeline format
   */
  private static transformPackage(pkg: IntegrationPackage): SAPPackage {
    return {
      id: pkg.id,
      name: pkg.name,
      description: pkg.description || "No description available",
      version: pkg.version || "1.0.0",
      lastModified: pkg.modifiedDate || new Date().toISOString(),
      author: pkg.modifiedBy || "SAP User",
      iflowCount: 0, // This will be calculated when needed
      status: "active" as const,
    };
  }

  /**
   * Transform backend IntegrationFlow to pipeline format
   */
  private static transformIFlow(iflow: IntegrationFlow): SAPIFlow {
    return {
      id: iflow.id,
      name: iflow.name,
      packageId: iflow.packageId || "",
      description: iflow.description || "No description available",
      version: iflow.version || "1.0.0",
      status: "active" as const,
      lastModified: iflow.modifiedDate || new Date().toISOString(),
      author: iflow.modifiedBy || "SAP User",
      type: this.determineFlowType(iflow.name, iflow.description),
    };
  }

  /**
   * Helper method to determine flow type from name/description
   */
  private static determineFlowType(
    name: string,
    description: string,
  ): "http" | "mail" | "sftp" | "database" {
    const text = (name + " " + description).toLowerCase();

    if (text.includes("mail") || text.includes("email")) return "mail";
    if (text.includes("sftp") || text.includes("ftp") || text.includes("file"))
      return "sftp";
    if (
      text.includes("database") ||
      text.includes("db") ||
      text.includes("sql")
    )
      return "database";

    return "http"; // Default
  }

  /**
   * Get all integration packages from backend API
   */
  static async getIntegrationPackages(): Promise<SAPPackage[]> {
    try {
      console.log(
        "🔄 Fetching integration packages from backend API → SAP Systems...",
      );

      // First verify we have a registered tenant
      const baseTenant = await this.getBaseTenant();
      if (!baseTenant) {
        throw new Error(
          "No base tenant registered. Please register your SAP Integration Suite tenant in Administration first.",
        );
      }

      console.log(`📡 Using registered tenant: ${baseTenant.name}`);

      // Refresh backend URL to get latest configuration
      backendClient.refreshBackendUrl();
      const currentBackendUrl = backendClient.getBaseUrl();

      if (!currentBackendUrl || currentBackendUrl === "") {
        throw new Error(
          "Backend URL not configured. Please configure your Python FastAPI backend URL in the Administration tab.",
        );
      }

      console.log(`🔗 Using backend URL: ${currentBackendUrl}`);

      // Fetch packages through backend API
      const packages = await backendClient.getIntegrationPackages();

      console.log(
        `✅ Successfully fetched ${packages.length} packages from SAP`,
      );

      // Transform to pipeline format
      const transformedPackages = packages.map(this.transformPackage);

      return transformedPackages;
    } catch (error) {
      console.error("❌ Failed to fetch packages from backend:", error);

      // Check if it's a backend connection error
      if (
        error instanceof Error &&
        (error.message.includes("Cannot connect to backend") ||
          error.message.includes("Backend may not be running") ||
          error.message.includes("No backend URL configured"))
      ) {
        throw new Error(
          `Backend connection failed: ${error.message}. Please ensure your Python FastAPI backend is running and accessible.`,
        );
      }

      // Re-throw the original error for other types of failures
      throw error;
    }
  }

  /**
   * Get integration flows from backend API
   */
  static async getIntegrationFlows(packageId?: string): Promise<SAPIFlow[]> {
    try {
      console.log(
        "🔄 Fetching integration flows from backend API → SAP Systems...",
      );

      // First verify we have a registered tenant
      const baseTenant = await this.getBaseTenant();
      if (!baseTenant) {
        throw new Error(
          "No base tenant registered. Please register your SAP Integration Suite tenant in Administration first.",
        );
      }

      console.log(`📡 Using registered tenant: ${baseTenant.name}`);

      // Refresh backend URL to get latest configuration
      backendClient.refreshBackendUrl();
      const currentBackendUrl = backendClient.getBaseUrl();

      if (!currentBackendUrl || currentBackendUrl === "") {
        throw new Error(
          "Backend URL not configured. Please configure your Python FastAPI backend URL in the Administration tab.",
        );
      }

      console.log(`🔗 Using backend URL: ${currentBackendUrl}`);

      // Fetch iFlows through backend API
      const iflows = await backendClient.getIntegrationFlows();

      console.log(`✅ Successfully fetched ${iflows.length} iFlows from SAP`);

      // Transform to pipeline format
      let transformedIFlows = iflows.map(this.transformIFlow);

      // Filter by package if specified
      if (packageId) {
        transformedIFlows = transformedIFlows.filter(
          (iflow) => iflow.packageId === packageId,
        );
        console.log(
          `🔍 Filtered to ${transformedIFlows.length} iFlows for package: ${packageId}`,
        );
      }

      return transformedIFlows;
    } catch (error) {
      console.error("❌ Failed to fetch iFlows from backend:", error);

      // Check if it's a backend connection error
      if (
        error instanceof Error &&
        (error.message.includes("Cannot connect to backend") ||
          error.message.includes("Backend may not be running") ||
          error.message.includes("No backend URL configured"))
      ) {
        throw new Error(
          `Backend connection failed: ${error.message}. Please ensure your Python FastAPI backend is running and accessible.`,
        );
      }

      // Re-throw the original error for other types of failures
      throw error;
    }
  }

  /**
   * Test connection through backend API
   */
  static async testConnection(): Promise<{
    success: boolean;
    message: string;
    tenantInfo?: any;
  }> {
    try {
      // First verify we have a registered tenant
      const baseTenant = await this.getBaseTenant();
      if (!baseTenant) {
        return {
          success: false,
          message:
            "No SAP tenant registered. Please register your tenant in the Administration tab first.",
        };
      }

      console.log(
        `🧪 Testing connection: Frontend → Backend → ${baseTenant.name}`,
      );

      // Refresh backend URL to get latest configuration
      backendClient.refreshBackendUrl();
      const currentBackendUrl = backendClient.getBaseUrl();

      if (!currentBackendUrl || currentBackendUrl === "") {
        throw new Error(
          "Backend URL not configured. Please configure your Python FastAPI backend URL in the Administration tab.",
        );
      }

      console.log(`🔗 Testing backend at: ${currentBackendUrl}`);

      // Test backend health first
      try {
        const health = await backendClient.getHealth();
        console.log("✅ Backend health check passed");
      } catch (healthError) {
        console.error("❌ Backend health check failed:", healthError);
        throw new Error(
          `Backend server is not accessible at ${currentBackendUrl}: ${healthError instanceof Error ? healthError.message : "Unknown error"}`,
        );
      }

      // Test actual data retrieval
      const packages = await backendClient.getIntegrationPackages();
      const iflows = await backendClient.getIntegrationFlows();

      console.log(
        `✅ Successfully connected! Got ${packages.length} packages and ${iflows.length} iFlows`,
      );

      return {
        success: true,
        message: `Successfully connected to ${baseTenant.name} through backend API!`,
        tenantInfo: {
          name: baseTenant.name,
          baseUrl: baseTenant.baseUrl,
          packageCount: packages.length,
          iflowCount: iflows.length,
          connectionType: "Backend API → SAP",
        },
      };
    } catch (error) {
      console.error("❌ Connection test failed:", error);

      let message = `Connection test failed: ${error instanceof Error ? error.message : "Unknown error"}`;

      // Provide specific guidance based on error type
      if (
        error instanceof Error &&
        error.message.includes("Cannot connect to backend")
      ) {
        message = `Backend connection failed. Please ensure your Python FastAPI backend is running. ${error.message}`;
      } else if (
        error instanceof Error &&
        error.message.includes("No backend URL configured")
      ) {
        message = `Backend URL not configured. Please configure your backend URL in the Administration tab.`;
      }

      return {
        success: false,
        message,
      };
    }
  }

  /**
   * Get tenant information for display
   */
  static async getTenantInfo(): Promise<{
    name: string;
    baseUrl: string;
    isRegistered: boolean;
  }> {
    const baseTenant = await this.getBaseTenant();

    if (!baseTenant) {
      return {
        name: "No tenant registered",
        baseUrl: "",
        isRegistered: false,
      };
    }

    return {
      name: baseTenant.name,
      baseUrl: baseTenant.baseUrl,
      isRegistered: true,
    };
  }

  /**
   * Get backend status for debugging
   */
  static async getBackendStatus(): Promise<{
    isConfigured: boolean;
    isHealthy: boolean;
    url: string;
    error?: string;
  }> {
    try {
      // Refresh backend URL to get latest configuration
      backendClient.refreshBackendUrl();
      const backendUrl = backendClient.getBaseUrl();

      if (!backendUrl || backendUrl === "") {
        return {
          isConfigured: false,
          isHealthy: false,
          url: "",
          error:
            "No backend URL configured. Please set backend URL in Administration tab.",
        };
      }

      const health = await backendClient.getHealth();

      return {
        isConfigured: true,
        isHealthy: true,
        url: backendUrl,
      };
    } catch (error) {
      return {
        isConfigured: true,
        isHealthy: false,
        url: backendClient.getBaseUrl(),
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
