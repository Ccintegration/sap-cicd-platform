import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Server,
  Activity,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Settings,
  Code,
  Database,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { BackendBaseTenantService } from "@/lib/backend-tenant-service";
import { backendClient } from "@/lib/backend-client";
import BackendURLConfig from "./BackendURLConfig";

interface BackendHealth {
  isAvailable: boolean;
  status?: any;
  error?: string;
}

const BackendStatus: React.FC = () => {
  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [tokenStatus, setTokenStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    checkBackendStatus();
  }, []);

  const checkBackendStatus = async () => {
    setIsLoading(true);
    try {
      // Check backend health
      const healthResult = await BackendBaseTenantService.getBackendHealth();
      setHealth(healthResult);

      if (healthResult.isAvailable) {
        // Get backend configuration
        const configResult = await BackendBaseTenantService.getBackendConfig();
        setConfig(configResult);

        // Get token status
        const tokenResult =
          await BackendBaseTenantService.getBackendTokenStatus();
        setTokenStatus(tokenResult);

        toast.success("✅ Backend server is running and healthy!");
      } else {
        toast.error("❌ Backend server is not available", {
          description: healthResult.error || "Cannot connect to backend",
        });
      }
    } catch (error) {
      console.error("Failed to check backend status:", error);
      setHealth({
        isAvailable: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const refreshToken = async () => {
    setIsRefreshing(true);
    try {
      const success = await BackendBaseTenantService.refreshBackendToken();
      if (success) {
        toast.success("✅ Backend token refreshed successfully!");
        // Refresh token status
        const tokenResult =
          await BackendBaseTenantService.getBackendTokenStatus();
        setTokenStatus(tokenResult);
      } else {
        toast.error("❌ Failed to refresh backend token");
      }
    } catch (error) {
      toast.error("❌ Token refresh failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const toggleBackend = () => {
    const currentConfig = BackendBaseTenantService.getConfiguration();
    const newState = !currentConfig.useBackend;

    BackendBaseTenantService.enableBackend(newState);

    toast.info(
      newState
        ? "🔄 Backend mode enabled"
        : "🔄 Backend mode disabled (using simulation)",
      {
        description: newState
          ? "Will use Python FastAPI backend for SAP calls"
          : "Will use simulated data for demonstration",
      },
    );
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "healthy":
      case "running":
        return "text-green-600 bg-green-100";
      case "degraded":
        return "text-yellow-600 bg-yellow-100";
      case "down":
      case "error":
        return "text-red-600 bg-red-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const currentConfig = BackendBaseTenantService.getConfiguration();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Checking backend status...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Status Card */}
      <Card
        className={
          health?.isAvailable
            ? "border-green-200 bg-green-50"
            : "border-red-200 bg-red-50"
        }
      >
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Server
                className={`w-5 h-5 ${
                  health?.isAvailable ? "text-green-600" : "text-red-600"
                }`}
              />
              <span
                className={
                  health?.isAvailable ? "text-green-800" : "text-red-800"
                }
              >
                Python FastAPI Backend
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Badge
                className={
                  health?.isAvailable
                    ? "bg-green-100 text-green-800 border-green-300"
                    : "bg-red-100 text-red-800 border-red-300"
                }
              >
                {health?.isAvailable ? (
                  <CheckCircle className="w-3 h-3 mr-1" />
                ) : (
                  <XCircle className="w-3 h-3 mr-1" />
                )}
                {health?.isAvailable ? "Connected" : "Disconnected"}
              </Badge>
              <Button variant="outline" size="sm" onClick={checkBackendStatus}>
                <RefreshCw className="w-4 h-4 mr-1" />
                Refresh
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`space-y-3 ${
              health?.isAvailable ? "text-green-800" : "text-red-800"
            }`}
          >
            {health?.isAvailable ? (
              <div>
                <p className="font-medium">✅ Backend server is running!</p>
                <p className="text-sm">
                  Your Python FastAPI backend is accessible at{" "}
                  <code className="bg-white px-1 rounded">
                    {currentConfig.backendUrl}
                  </code>
                </p>
                {health.status && (
                  <p className="text-xs">
                    SAP Connection:{" "}
                    <Badge
                      className={getStatusColor(
                        health.status.services?.sap_connection,
                      )}
                    >
                      {health.status.services?.sap_connection || "unknown"}
                    </Badge>
                  </p>
                )}
              </div>
            ) : (
              <div>
                <p className="font-medium">❌ Backend server not available</p>
                <p className="text-sm">
                  Cannot connect to Python FastAPI backend at{" "}
                  <code className="bg-white px-1 rounded">
                    {currentConfig.backendUrl}
                  </code>
                </p>
                {health?.error && (
                  <p className="text-xs">Error: {health.error}</p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-blue-600" />
            <span>Backend Configuration</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <a
            href="https://ccci-integration-suite-fuom1yo5.it-cpi024.cfapps.eu10-002.hana.ondemand.com"
            className="block cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Backend Mode</p>
                <p className="text-sm text-gray-600">
                  {currentConfig.useBackend
                    ? "Using Python FastAPI backend for real SAP API calls"
                    : "Using simulated data for demonstration"}
                </p>
              </div>
              <Button
                variant={currentConfig.useBackend ? "default" : "outline"}
                onClick={toggleBackend}
              >
                <Database className="w-4 h-4 mr-2" />
                {currentConfig.useBackend
                  ? "Backend Enabled"
                  : "Enable Backend"}
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t">
              <div>
                <div className="text-sm font-medium">Backend URL</div>
                <p className="text-xs text-gray-600">
                  {currentConfig.backendUrl}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Fallback Mode</p>
                <p className="text-xs text-gray-600">
                  {currentConfig.fallbackToSimulation ? "Enabled" : "Disabled"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Current Mode</p>
                <p className="text-xs text-gray-600">
                  {currentConfig.useBackend
                    ? health?.isAvailable
                      ? "Backend"
                      : "Fallback"
                    : "Simulation"}
                </p>
              </div>
            </div>
          </a>
        </CardContent>
      </Card>

      {/* Backend Details */}
      {health?.isAvailable && (
        <Tabs defaultValue="url-config">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="url-config">URL Config</TabsTrigger>
            <TabsTrigger value="status">Status & Health</TabsTrigger>
            <TabsTrigger value="config">Configuration</TabsTrigger>
            <TabsTrigger value="token">Token Status</TabsTrigger>
          </TabsList>

          <TabsContent value="url-config" className="space-y-4">
            <BackendURLConfig />
          </TabsContent>

          <TabsContent value="status" className="space-y-4">
            <Card>
              <CardContent className="p-4">
                {health.status ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <Badge className={getStatusColor(health.status.status)}>
                          {health.status.status?.toUpperCase() || "UNKNOWN"}
                        </Badge>
                        <p className="text-xs text-gray-500 mt-1">
                          Overall Status
                        </p>
                      </div>
                      <div className="text-center">
                        <Badge
                          className={getStatusColor(
                            health.status.services?.api,
                          )}
                        >
                          {health.status.services?.api?.toUpperCase() ||
                            "UNKNOWN"}
                        </Badge>
                        <p className="text-xs text-gray-500 mt-1">
                          API Service
                        </p>
                      </div>
                      <div className="text-center">
                        <Badge
                          className={getStatusColor(
                            health.status.services?.sap_connection,
                          )}
                        >
                          {health.status.services?.sap_connection?.toUpperCase() ||
                            "UNKNOWN"}
                        </Badge>
                        <p className="text-xs text-gray-500 mt-1">
                          SAP Connection
                        </p>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-medium">
                          {new Date(
                            health.status.timestamp,
                          ).toLocaleTimeString()}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Last Updated
                        </p>
                      </div>
                    </div>

                    {health.status.sap_error && (
                      <Alert variant="destructive">
                        <XCircle className="w-4 h-4" />
                        <AlertDescription>
                          <p className="font-medium">SAP Connection Error:</p>
                          <p className="text-sm">{health.status.sap_error}</p>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center">
                    No detailed status available
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="config" className="space-y-4">
            <Card>
              <CardContent className="p-4">
                {config ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium">SAP Base URL</p>
                        <p className="text-xs text-gray-600 font-mono">
                          {config.sap_base_url}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">SAP Token URL</p>
                        <p className="text-xs text-gray-600 font-mono">
                          {config.sap_token_url}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Environment</p>
                        <p className="text-xs text-gray-600">
                          {config.environment}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Backend Version</p>
                        <p className="text-xs text-gray-600">
                          {config.backend_version}
                        </p>
                      </div>
                    </div>

                    {config.supported_apis && (
                      <div>
                        <p className="text-sm font-medium mb-2">
                          Supported APIs:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {config.supported_apis.map(
                            (api: string, index: number) => (
                              <Badge
                                key={index}
                                variant="outline"
                                className="text-xs"
                              >
                                {api}
                              </Badge>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center">
                    Configuration not available
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="token" className="space-y-4">
            <Card>
              <CardContent className="p-4">
                {tokenStatus ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">OAuth Token Status</p>
                        <p className="text-sm text-gray-600">
                          Current SAP authentication token status
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={refreshToken}
                        disabled={isRefreshing}
                      >
                        {isRefreshing ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <Zap className="w-4 h-4 mr-1" />
                        )}
                        Refresh Token
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <Badge
                          variant={
                            tokenStatus.has_token ? "default" : "secondary"
                          }
                        >
                          {tokenStatus.has_token ? "Yes" : "No"}
                        </Badge>
                        <p className="text-xs text-gray-500 mt-1">Has Token</p>
                      </div>
                      <div className="text-center">
                        <Badge
                          className={
                            tokenStatus.token_status === "valid"
                              ? "bg-green-100 text-green-800"
                              : tokenStatus.token_status === "expired"
                                ? "bg-red-100 text-red-800"
                                : "bg-gray-100 text-gray-800"
                          }
                        >
                          {tokenStatus.token_status}
                        </Badge>
                        <p className="text-xs text-gray-500 mt-1">Status</p>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-medium">
                          {tokenStatus.time_to_expiry_seconds
                            ? `${Math.floor(tokenStatus.time_to_expiry_seconds / 60)}m`
                            : "N/A"}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Time to Expiry
                        </p>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-medium">
                          {tokenStatus.token_type || "N/A"}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Token Type</p>
                      </div>
                    </div>

                    {tokenStatus.expires_at && (
                      <p className="text-xs text-gray-500">
                        Expires at:{" "}
                        {new Date(tokenStatus.expires_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center">
                    Token status not available
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Setup Instructions */}
      {!health?.isAvailable && (
        <Alert className="border-blue-200 bg-blue-50">
          <Code className="w-4 h-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <div className="space-y-2">
              <p className="font-medium">🚀 Start Your Python Backend</p>
              <div className="text-sm space-y-1">
                <p>
                  1. Navigate to the backend directory: <code>cd backend</code>
                </p>
                <p>
                  2. Install dependencies:{" "}
                  <code>pip install -r requirements.txt</code>
                </p>
                <p>
                  3. Start the server: <code>python main.py</code>
                </p>
                <p>
                  4. The backend will be available at{" "}
                  <code>http://localhost:8000</code>
                </p>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default BackendStatus;
