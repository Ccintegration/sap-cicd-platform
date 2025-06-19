// File Path: src/components/administration/TenantRegistration.tsx
// Filename: TenantRegistration.tsx
import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Edit,
  CheckCircle,
  Settings,
  Database,
  Users,
  Trash2,
  ExternalLink,
  Loader2,
  RefreshCw,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import OAuthForm from "./OAuthForm";
import JsonUpload from "./JsonUpload";
import ConnectionTest from "./ConnectionTest";
import { TenantFormData, ConnectionTestResult, SAPTenant } from "@/lib/types";
import { TenantService } from "@/lib/tenant-service";

const TenantRegistration: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"form" | "upload">("form");
  const [isLoading, setIsLoading] = useState(false);
  const [connectionResult, setConnectionResult] = useState<ConnectionTestResult | null>(null);
  const [error, setError] = useState<string>("");
  const [registeredTenants, setRegisteredTenants] = useState<SAPTenant[]>([]);
  const [isLoadingTenants, setIsLoadingTenants] = useState(false);
  const [testingTenantId, setTestingTenantId] = useState<string | null>(null);

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      setIsLoadingTenants(true);
      const tenants = await TenantService.getAllTenants();
      setRegisteredTenants(tenants);
    } catch (err) {
      console.error("Failed to load tenants:", err);
      toast.error("Failed to load registered tenants", {
        description: err instanceof Error ? err.message : "Unknown error occurred"
      });
    } finally {
      setIsLoadingTenants(false);
    }
  };

  const handleSubmit = async (data: TenantFormData) => {
    setIsLoading(true);
    setError("");
    setConnectionResult(null);

    try {
      console.log("🚀 [TenantRegistration] Starting tenant registration process:", data);
      
      // Test the connection first
      toast.info("Testing connection...", {
        description: "Validating credentials and connectivity to SAP tenant"
      });

      const result = await TenantService.testConnection(
        data.oauthCredentials,
        data.baseUrl,
      );
      
      console.log("🔍 [TenantRegistration] Connection test result:", result);
      setConnectionResult(result);

      if (result.success) {
        console.log("✅ [TenantRegistration] Connection successful, creating tenant...");
        
        // If connection is successful, create the tenant
        const newTenant = await TenantService.createTenant(data);
        
        console.log("🎯 [TenantRegistration] Tenant created successfully:", newTenant);
        
        // Update connection status
        await TenantService.updateTenantConnectionStatus(
          newTenant.id,
          "connected",
        );

        toast.success("Tenant registered successfully!", {
          description: `${data.name} has been added to your tenants.`,
        });

        // Reload tenants list
        await loadTenants();

        // Reset form state
        setConnectionResult(null);
        setError("");
        
        // Switch to the tenants view to show the newly registered tenant
        // You might want to emit an event or callback here
        
      } else {
        console.error("❌ [TenantRegistration] Connection test failed:", result);
        setError(result.message || "Connection test failed");
        toast.error("Connection test failed", {
          description: result.message || "Please check your credentials and try again.",
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
      console.error("❌ [TenantRegistration] Registration failed:", err);
      setError(errorMessage);
      toast.error("Registration failed", {
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTenant = async (id: string) => {
    try {
      console.log("🗑️ [TenantRegistration] Deleting tenant:", id);
      
      // Show confirmation
      if (!window.confirm("Are you sure you want to delete this tenant? This action cannot be undone.")) {
        return;
      }

      await TenantService.deleteTenant(id);
      toast.success("Tenant deleted successfully");
      await loadTenants();
    } catch (err) {
      console.error("❌ [TenantRegistration] Failed to delete tenant:", err);
      toast.error("Failed to delete tenant", {
        description: err instanceof Error ? err.message : "Unknown error occurred"
      });
    }
  };

  const handleRetryConnection = async (tenant: SAPTenant) => {
    try {
      setTestingTenantId(tenant.id);
      console.log("🔄 [TenantRegistration] Retrying connection for tenant:", tenant.id);

      // Update status to testing
      await TenantService.updateTenantConnectionStatus(tenant.id, "testing");
      await loadTenants();

      // Test connection
      const result = await TenantService.testConnection(
        tenant.oauthCredentials,
        tenant.baseUrl,
      );

      console.log("🔍 [TenantRegistration] Retry connection result:", result);

      // Update status based on result
      const newStatus = result.success ? "connected" : "error";
      await TenantService.updateTenantConnectionStatus(tenant.id, newStatus);
      await loadTenants();

      toast[result.success ? "success" : "error"](
        result.success ? "Connection restored" : "Connection failed",
        { description: result.message },
      );
    } catch (err) {
      console.error("❌ [TenantRegistration] Connection retry failed:", err);
      
      // Update status to error
      await TenantService.updateTenantConnectionStatus(tenant.id, "error");
      await loadTenants();
      
      toast.error("Connection test failed", {
        description: err instanceof Error ? err.message : "Unknown error occurred"
      });
    } finally {
      setTestingTenantId(null);
    }
  };

  const getStatusBadge = (status: SAPTenant["connectionStatus"]) => {
    const variants = {
      connected: {
        variant: "default" as const,
        color: "bg-green-100 text-green-800 border-green-300",
        icon: CheckCircle,
      },
      disconnected: {
        variant: "secondary" as const,
        color: "bg-gray-100 text-gray-800 border-gray-300",
        icon: XCircle,
      },
      testing: {
        variant: "outline" as const,
        color: "bg-yellow-100 text-yellow-800 border-yellow-300",
        icon: Loader2,
      },
      error: {
        variant: "destructive" as const,
        color: "bg-red-100 text-red-800 border-red-300",
        icon: AlertTriangle,
      },
    };

    const config = variants[status];
    const Icon = config.icon;
    
    return (
      <Badge className={`${config.color} flex items-center space-x-1`}>
        <Icon className={`w-3 h-3 ${status === 'testing' ? 'animate-spin' : ''}`} />
        <span>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
      </Badge>
    );
  };

  const handleJsonUpload = async (data: TenantFormData) => {
    console.log("📁 [TenantRegistration] Processing JSON upload:", data);
    await handleSubmit(data);
  };

  return (
    <div className="space-y-8">
      {/* Registration Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Settings className="w-6 h-6 text-blue-600" />
            <CardTitle className="text-xl">
              Register SAP Integration Suite Tenant
            </CardTitle>
          </div>
          <CardDescription>
            Add a new SAP Integration Suite tenant by providing OAuth
            credentials manually or uploading a configuration file.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "form" | "upload")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="form" className="flex items-center space-x-2">
                <Edit className="w-4 h-4" />
                <span>Manual Entry</span>
              </TabsTrigger>
              <TabsTrigger value="upload" className="flex items-center space-x-2">
                <FileText className="w-4 h-4" />
                <span>Upload JSON</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="form" className="mt-6">
              <OAuthForm
                onSubmit={handleSubmit}
                isLoading={isLoading}
                error={error}
              />
            </TabsContent>

            <TabsContent value="upload" className="mt-6">
              <JsonUpload
                onSubmit={handleJsonUpload}
                isLoading={isLoading}
                error={error}
              />
            </TabsContent>
          </Tabs>

          {/* Connection Test Results - FIXED: Added isLoading prop */}
          {connectionResult && (
            <div className="mt-6">
              <ConnectionTest
                isLoading={isLoading}
                result={connectionResult}
                onRetry={() => {
                  setConnectionResult(null);
                  setError("");
                }}
              />
            </div>
          )}

          {/* Error Display */}
          {error && !connectionResult && (
            <Alert className="mt-6 border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-700">
                {error}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Registered Tenants Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Database className="w-6 h-6 text-blue-600" />
              <CardTitle className="text-xl">Registered Tenants</CardTitle>
              <Badge variant="outline">
                {registeredTenants.length} tenant{registeredTenants.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadTenants}
              disabled={isLoadingTenants}
            >
              {isLoadingTenants ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span className="ml-2">Refresh</span>
            </Button>
          </div>
          <CardDescription>
            Manage your registered SAP Integration Suite tenants and test connections.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingTenants ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-3 text-gray-600">Loading tenants...</span>
            </div>
          ) : registeredTenants.length === 0 ? (
            <div className="text-center py-8">
              <Database className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">No tenants registered yet</p>
              <p className="text-sm text-gray-500">
                Register your first SAP Integration Suite tenant above
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {registeredTenants.map((tenant) => (
                <Card key={tenant.id} className="border border-gray-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div>
                          <CardTitle className="text-lg">{tenant.name}</CardTitle>
                          {tenant.description && (
                            <CardDescription className="mt-1">
                              {tenant.description}
                            </CardDescription>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getStatusBadge(tenant.connectionStatus)}
                        <Badge variant="secondary">
                          {tenant.environment}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">
                        Base URL
                      </p>
                      <div className="flex items-center space-x-2">
                        <p className="text-sm text-gray-800 break-all">
                          {tenant.baseUrl}
                        </p>
                        <Button variant="ghost" size="sm" asChild>
                          <a
                            href={tenant.baseUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <p className="font-medium text-gray-500">Grant Type</p>
                        <p className="text-gray-800">
                          {tenant.oauthCredentials.grantType}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-500">Client ID</p>
                        <p className="text-gray-800 font-mono">
                          {tenant.oauthCredentials.clientId.substring(0, 12)}...
                        </p>
                      </div>
                    </div>

                    {tenant.lastTested && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">
                          Last Tested
                        </p>
                        <p className="text-xs text-gray-800">
                          {new Date(tenant.lastTested).toLocaleString()}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRetryConnection(tenant)}
                        disabled={testingTenantId === tenant.id || tenant.connectionStatus === "testing"}
                      >
                        {testingTenantId === tenant.id ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Testing...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Test Connection
                          </>
                        )}
                      </Button>

                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteTenant(tenant.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TenantRegistration;