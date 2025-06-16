import React, { useState } from "react";
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
  const [connectionResult, setConnectionResult] =
    useState<ConnectionTestResult | null>(null);
  const [error, setError] = useState<string>("");
  const [registeredTenants, setRegisteredTenants] = useState<SAPTenant[]>([]);
  const [isLoadingTenants, setIsLoadingTenants] = useState(false);

  React.useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      setIsLoadingTenants(true);
      const tenants = await TenantService.getAllTenants();
      setRegisteredTenants(tenants);
    } catch (err) {
      toast.error("Failed to load registered tenants");
    } finally {
      setIsLoadingTenants(false);
    }
  };

  const handleSubmit = async (data: TenantFormData) => {
    setIsLoading(true);
    setError("");
    setConnectionResult(null);

    try {
      // Test the connection first
      const result = await TenantService.testConnection(
        data.oauthCredentials,
        data.baseUrl,
      );
      setConnectionResult(result);

      if (result.success) {
        // If connection is successful, create the tenant
        const newTenant = await TenantService.createTenant(data);
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
      } else {
        toast.error("Connection test failed", {
          description: "Please check your credentials and try again.",
        });
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An unexpected error occurred";
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
      await TenantService.deleteTenant(id);
      toast.success("Tenant deleted successfully");
      await loadTenants();
    } catch (err) {
      toast.error("Failed to delete tenant");
    }
  };

  const handleRetryConnection = async (tenant: SAPTenant) => {
    try {
      await TenantService.updateTenantConnectionStatus(tenant.id, "testing");
      await loadTenants();

      const result = await TenantService.testConnection(
        tenant.oauthCredentials,
        tenant.baseUrl,
      );

      const newStatus = result.success ? "connected" : "error";
      await TenantService.updateTenantConnectionStatus(tenant.id, newStatus);
      await loadTenants();

      toast[result.success ? "success" : "error"](
        result.success ? "Connection restored" : "Connection failed",
        { description: result.message },
      );
    } catch (err) {
      await TenantService.updateTenantConnectionStatus(tenant.id, "error");
      await loadTenants();
      toast.error("Connection test failed");
    }
  };

  const getStatusBadge = (status: SAPTenant["connectionStatus"]) => {
    const variants = {
      connected: {
        variant: "default" as const,
        color: "bg-green-100 text-green-800 border-green-300",
      },
      disconnected: {
        variant: "secondary" as const,
        color: "bg-gray-100 text-gray-800 border-gray-300",
      },
      testing: {
        variant: "outline" as const,
        color: "bg-yellow-100 text-yellow-800 border-yellow-300",
      },
      error: {
        variant: "destructive" as const,
        color: "bg-red-100 text-red-800 border-red-300",
      },
    };

    const config = variants[status];
    return (
      <Badge className={config.color}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
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
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as any)}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="form" className="flex items-center space-x-2">
                <Edit className="w-4 h-4" />
                <span>Manual Entry</span>
              </TabsTrigger>
              <TabsTrigger
                value="upload"
                className="flex items-center space-x-2"
              >
                <FileText className="w-4 h-4" />
                <span>JSON Upload</span>
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
                onSubmit={handleSubmit}
                isLoading={isLoading}
                error={error}
              />
            </TabsContent>
          </Tabs>

          <ConnectionTest
            isLoading={isLoading}
            result={connectionResult}
            error={error}
          />
        </CardContent>
      </Card>

      {/* Registered Tenants Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Database className="w-6 h-6 text-blue-600" />
              <CardTitle className="text-xl">Registered Tenants</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadTenants}
              disabled={isLoadingTenants}
            >
              Refresh
            </Button>
          </div>
          <CardDescription>
            Manage your registered SAP Integration Suite tenants and monitor
            their connection status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingTenants ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center space-y-2">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-sm text-gray-500">Loading tenants...</p>
              </div>
            </div>
          ) : registeredTenants.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Tenants Registered
              </h3>
              <p className="text-gray-500 mb-4">
                Register your first SAP Integration Suite tenant using the form
                above.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {registeredTenants.map((tenant) => (
                <Card key={tenant.id} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <CardTitle className="text-lg">
                            {tenant.name}
                          </CardTitle>
                          {tenant.isBaseTenant && (
                            <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                              Base Tenant
                            </Badge>
                          )}
                        </div>
                        {tenant.description && (
                          <CardDescription className="text-sm">
                            {tenant.description}
                          </CardDescription>
                        )}
                      </div>
                      {getStatusBadge(tenant.connectionStatus)}
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
                        <p className="font-medium text-gray-500">Status</p>
                        <p className="text-gray-800 capitalize">
                          {tenant.status}
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
                        disabled={tenant.connectionStatus === "testing"}
                      >
                        {tenant.connectionStatus === "testing" ? (
                          <div className="w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                        ) : (
                          <CheckCircle className="w-3 h-3 mr-2" />
                        )}
                        Test Connection
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteTenant(tenant.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-3 h-3 mr-2" />
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
