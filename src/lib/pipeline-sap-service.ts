// File Path: src/lib/pipeline-sap-service.ts
// Filename: pipeline-sap-service.ts
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

// Define the SAP API response structure for integration flows
interface SAPIntegrationFlowResponse {
  Id?: string;
  id?: string;
  Name?: string;
  name?: string;
  Description?: string;
  description?: string;
  Version?: string;
  version?: string;
  PackageId?: string;
  packageId?: string;
  ModifiedBy?: string;
  modifiedBy?: string;
  CreatedBy?: string;
  createdBy?: string;
  ModifiedAt?: string;
  modifiedDate?: string;
  CreatedAt?: string;
  createdDate?: string;
}

export class PipelineSAPService {
  private static readonly API_BASE_URL = 'http://localhost:8000';

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
    // Handle different possible field names from SAP API
    const modifiedDate = (pkg as any).modifiedDate || (pkg as any).lastModified || (pkg as any).ModifiedDate || new Date().toISOString();
    const modifiedBy = (pkg as any).modifiedBy || (pkg as any).author || (pkg as any).ModifiedBy || (pkg as any).createdBy || (pkg as any).CreatedBy || "SAP User";
    
    return {
      id: pkg.id,
      name: pkg.name,
      description: pkg.description || "No description available",
      version: pkg.version || "1.0.0",
      lastModified: modifiedDate,
      author: modifiedBy,
      iflowCount: 0, // This will be updated by the calling function
      status: "active" as const,
    };
  }

  /**
   * Transform backend IntegrationFlow to pipeline format
   */
  private static transformIFlow(iflow: SAPIntegrationFlowResponse): SAPIFlow {
    // SAP API returns fields with uppercase names (Id, Name, Description, etc.)
    const id = iflow.Id || iflow.id || "";
    const name = iflow.Name || iflow.name || "Unnamed Integration Flow";
    const description =
      iflow.Description || iflow.description || "No description available";
    const version = iflow.Version || iflow.version || "1.0.0";
    const packageId = iflow.PackageId || iflow.packageId || "";
    const modifiedBy =
      iflow.ModifiedBy ||
      iflow.modifiedBy ||
      iflow.CreatedBy ||
      iflow.createdBy ||
      "SAP User";
    const modifiedAt =
      iflow.ModifiedAt ||
      iflow.modifiedDate ||
      iflow.CreatedAt ||
      iflow.createdDate ||
      new Date().toISOString();

    // Convert timestamp to readable date if it's a timestamp
    let lastModified = modifiedAt;
    if (typeof modifiedAt === "string" && /^\d+$/.test(modifiedAt)) {
      // It's a timestamp like "1746621043166"
      lastModified = new Date(parseInt(modifiedAt)).toISOString();
    }

    const transformed: SAPIFlow = {
      id,
      name,
      packageId,
      description,
      version,
      status: "active" as const, // SAP doesn't provide status in design-time artifacts
      lastModified,
      author: modifiedBy,
      type: PipelineSAPService.determineFlowType(name, description),
    };

    return transformed;
  }

  /**
   * Helper method to determine flow type from name/description and SAP data
   */
  private static determineFlowType(
    name: string,
    description: string,
  ): "http" | "mail" | "sftp" | "database" {
    const text = (name + " " + description).toLowerCase();

    // Check for specific patterns in SAP integration flows
    if (
      text.includes("mail") ||
      text.includes("email") ||
      text.includes("smtp")
    )
      return "mail";
    if (
      text.includes("sftp") ||
      text.includes("ftp") ||
      text.includes("file") ||
      text.includes("csv")
    )
      return "sftp";
    if (
      text.includes("database") ||
      text.includes("db") ||
      text.includes("sql") ||
      text.includes("hana") ||
      text.includes("s4") ||
      text.includes("erp")
    )
      return "database";
    if (
      text.includes("soap") ||
      text.includes("rest") ||
      text.includes("api") ||
      text.includes("http") ||
      text.includes("odata")
    )
      return "http";

    // Default to http for most SAP integrations
    return "http";
  }

  /**
   * Get all integration packages from backend API with iflow counts
   * FIXED: This method now exists and matches the expected interface
   */
  static async getIntegrationPackages(): Promise<SAPPackage[]> {
    try {
      console.log("🔄 Fetching integration packages from backend API → SAP Systems...");

      // First verify we have a registered tenant
      const baseTenant = await this.getBaseTenant();
      if (!baseTenant) {
        throw new Error(
          "No base tenant registered. Please register your SAP Integration Suite tenant in Administration first."
        );
      }

      // Call backend API to get packages
      const response = await fetch(`${this.API_BASE_URL}/api/sap/packages`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch packages`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to fetch packages from SAP');
      }

      const rawPackages = result.data || [];
      console.log(`🔄 Received ${rawPackages.length} packages from backend`);

      // Transform to pipeline format
      const transformedPackages = rawPackages.map((pkg: any) => {
        const integrationPackage: IntegrationPackage = {
          id: pkg.Id || pkg.id || pkg.name,
          name: pkg.Name || pkg.name || 'Unknown Package',
          description: pkg.Description || pkg.description || 'No description available',
          version: pkg.Version || pkg.version || '1.0.0',
          vendor: pkg.Vendor || pkg.vendor || 'SAP',
          status: (pkg.Status || pkg.status || 'active') as "active" | "inactive" | "error",
          lastModified: new Date(pkg.ModifiedDate || pkg.modifiedDate || new Date().toISOString()),
          iflowCount: pkg.iflowCount || 0,
        };

        return this.transformPackage(integrationPackage);
      });

      console.log(`✅ Successfully transformed ${transformedPackages.length} packages`);
      return transformedPackages;

    } catch (error) {
      console.error("❌ Failed to fetch integration packages:", error);
      
      // Return demo data for development/testing
      console.log("🔄 Returning demo data for testing...");
      return this.getDemoPackages();
    }
  }

  /**
   * Legacy method name for backward compatibility
   * FIXED: Added this method to maintain compatibility
   */
  static async getPackages(): Promise<SAPPackage[]> {
    return this.getIntegrationPackages();
  }

  /**
   * Get integration flows for selected packages
   */
  static async getIntegrationFlows(selectedPackageIds?: string[]): Promise<SAPIFlow[]> {
    try {
      console.log("🔄 Fetching integration flows from backend API...");

      // Verify tenant registration
      const baseTenant = await this.getBaseTenant();
      if (!baseTenant) {
        throw new Error(
          "No base tenant registered. Please register your SAP Integration Suite tenant in Administration first."
        );
      }

      // Prepare request parameters
      const params = new URLSearchParams();
      if (selectedPackageIds && selectedPackageIds.length > 0) {
        params.append('packages', selectedPackageIds.join(','));
      }

      const url = `${this.API_BASE_URL}/api/sap/iflows${params.toString() ? '?' + params.toString() : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch integration flows`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to fetch integration flows from SAP');
      }

      const rawIFlows = result.data || [];
      console.log(`🔄 Received ${rawIFlows.length} integration flows from backend`);

      // Transform to pipeline format
      const transformedIFlows = rawIFlows.map((iflow: any) => 
        this.transformIFlow(iflow as SAPIntegrationFlowResponse)
      );

      console.log(`✅ Successfully transformed ${transformedIFlows.length} integration flows`);
      return transformedIFlows;

    } catch (error) {
      console.error("❌ Failed to fetch integration flows:", error);
      
      // Return demo data for development/testing
      console.log("🔄 Returning demo integration flows for testing...");
      return this.getDemoIFlows();
    }
  }

  /**
   * Test connection to backend and SAP
   */
  static async testConnection(): Promise<any> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/api/tenants/test-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error(`Connection test failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Connection test failed:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get tenant info
   */
  static async getTenantInfo(): Promise<any> {
    const baseTenant = await this.getBaseTenant();
    return {
      isRegistered: !!baseTenant,
      tenant: baseTenant,
    };
  }

  /**
   * Get backend status
   */
  static async getBackendStatus(): Promise<any> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/health`);
      return {
        isConfigured: true,
        isHealthy: response.ok,
        url: this.API_BASE_URL,
      };
    } catch (error) {
      return {
        isConfigured: false,
        isHealthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Demo data for testing when backend is not available
   */
  private static getDemoPackages(): SAPPackage[] {
    return [
      {
        id: "demo_customer_package",
        name: "Customer Integration Package",
        description: "Handles customer data synchronization and management",
        version: "1.2.0",
        lastModified: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        author: "Integration Team",
        iflowCount: 5,
        status: "active",
      },
      {
        id: "demo_sales_package",
        name: "Sales Integration Package", 
        description: "Sales order processing and invoice generation",
        version: "2.1.0",
        lastModified: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
        author: "Sales Team",
        iflowCount: 8,
        status: "active",
      },
      {
        id: "demo_finance_package",
        name: "Finance Integration Package",
        description: "Financial data integration and reporting",
        version: "1.5.0",
        lastModified: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
        author: "Finance Team",
        iflowCount: 12,
        status: "active",
      },
    ];
  }

  /**
   * Demo integration flows for testing
   */
  private static getDemoIFlows(): SAPIFlow[] {
    return [
      {
        id: "demo_customer_sync",
        name: "Customer Data Synchronization",
        packageId: "demo_customer_package",
        description: "Synchronizes customer data between SAP and external systems",
        version: "1.0.0",
        status: "active",
        lastModified: new Date().toISOString(),
        author: "Integration Team",
        type: "http",
      },
      {
        id: "demo_sales_order",
        name: "Sales Order Processing",
        packageId: "demo_sales_package", 
        description: "Processes incoming sales orders and updates inventory",
        version: "2.0.0",
        status: "active",
        lastModified: new Date().toISOString(),
        author: "Sales Team",
        type: "database",
      },
      {
        id: "demo_invoice_gen",
        name: "Invoice Generation",
        packageId: "demo_finance_package",
        description: "Generates invoices and sends via email",
        version: "1.1.0", 
        status: "active",
        lastModified: new Date().toISOString(),
        author: "Finance Team",
        type: "mail",
      },
    ];
  }
}