import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Globe,
  Settings,
  Link,
  ExternalLink,
  CheckCircle,
  XCircle,
  Info,
  Zap,
  Cloud,
  Monitor,
} from "lucide-react";
import { toast } from "sonner";
import { backendClient } from "@/lib/backend-client";

const BackendURLConfig: React.FC = () => {
  const [backendUrl, setBackendUrl] = useState("");
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    status: "unknown" | "connected" | "failed";
    message: string;
  }>({ status: "unknown", message: "" });

  useEffect(() => {
    // Load saved backend URL from localStorage
    const savedUrl = localStorage.getItem("backend_ngrok_url");
    if (savedUrl) {
      setBackendUrl(savedUrl);
    }

    // Check current environment
    checkCurrentEnvironment();
  }, []);

  const checkCurrentEnvironment = () => {
    const hostname = window.location.hostname;
    const isBuilderEnvironment =
      hostname.includes("builder.codes") || hostname.includes("builder.io");

    if (isBuilderEnvironment) {
      setConnectionStatus({
        status: "failed",
        message: "Running in Builder.io cloud - localhost not accessible",
      });
    }
  };

  const testConnection = async (url?: string) => {
    const testUrl = url || backendUrl;
    if (!testUrl) {
      toast.error("Please enter a backend URL");
      return;
    }

    setIsTestingConnection(true);
    try {
      // Create a temporary client with the test URL
      const testClient = new (backendClient.constructor as any)(testUrl);
      const isAvailable = await testClient.isBackendAvailable();

      if (isAvailable) {
        setConnectionStatus({
          status: "connected",
          message: "Backend connection successful!",
        });
        toast.success("✅ Backend connection successful!");
      } else {
        setConnectionStatus({
          status: "failed",
          message: "Backend server not responding",
        });
        toast.error("❌ Backend connection failed");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Connection failed";
      setConnectionStatus({
        status: "failed",
        message: errorMessage,
      });
      toast.error("❌ Connection test failed", {
        description: errorMessage,
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const saveBackendUrl = () => {
    if (backendUrl) {
      localStorage.setItem("backend_ngrok_url", backendUrl);

      // Update the backend client immediately
      backendClient.updateBaseUrl(backendUrl);

      toast.success("Backend URL saved and applied successfully!");

      // Test the connection automatically after saving
      setTimeout(() => {
        testConnection(backendUrl);
      }, 500);
    } else {
      localStorage.removeItem("backend_ngrok_url");
      backendClient.updateBaseUrl("");
      toast.info("Backend URL cleared");
      setConnectionStatus({
        status: "unknown",
        message: "Backend URL cleared",
      });
    }
  };

  const getCurrentEnvironment = () => {
    const hostname = window.location.hostname;
    if (hostname.includes("builder.codes") || hostname.includes("builder.io")) {
      return "Builder.io Cloud";
    } else if (hostname === "localhost" || hostname.startsWith("127.")) {
      return "Local Development";
    } else {
      return "Custom Environment";
    }
  };

  const getStatusIcon = () => {
    switch (connectionStatus.status) {
      case "connected":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Info className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus.status) {
      case "connected":
        return "border-green-200 bg-green-50";
      case "failed":
        return "border-red-200 bg-red-50";
      default:
        return "border-gray-200 bg-gray-50";
    }
  };

  return (
    <div className="space-y-6">
      {/* Environment Info */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-blue-800">
            <Cloud className="w-5 h-5" />
            <span>Environment Detection</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-blue-800">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span>Current Environment:</span>
              <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                {getCurrentEnvironment()}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Backend URL:</span>
              <code className="text-xs bg-white px-2 py-1 rounded">
                {backendUrl || "Not configured"}
              </code>
            </div>
            <div className="text-sm">
              <p className="font-medium mb-1">Environment Notes:</p>
              {getCurrentEnvironment() === "Builder.io Cloud" ? (
                <p className="text-sm">
                  You're running in Builder.io's cloud environment. Local
                  backend access requires ngrok or similar tunneling service.
                </p>
              ) : (
                <p className="text-sm">
                  You're running locally. Backend should be accessible at{" "}
                  <code>http://localhost:8000</code>.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connection Status */}
      <Card className={getStatusColor()}>
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            {getStatusIcon()}
            <div>
              <p className="font-medium">Backend Connection Status</p>
              <p className="text-sm">{connectionStatus.message}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Backend URL Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-purple-600" />
            <span>Backend URL Configuration</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="backendUrl">Backend Server URL</Label>
            <Input
              id="backendUrl"
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
              placeholder="https://your-ngrok-url.ngrok.io or http://localhost:8000"
              className="font-mono text-sm"
            />
            <p className="text-xs text-gray-500">
              Enter your backend server URL. Use ngrok URL for cloud access or
              localhost for local development.
            </p>
          </div>

          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={() => testConnection()}
              disabled={isTestingConnection || !backendUrl}
            >
              <Monitor className="w-4 h-4 mr-1" />
              {isTestingConnection ? "Testing..." : "Test Connection"}
            </Button>
            <Button onClick={saveBackendUrl} disabled={!backendUrl}>
              <Zap className="w-4 h-4 mr-1" />
              Save & Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Setup Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Link className="w-5 h-5 text-green-600" />
            <span>Setup Instructions</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {getCurrentEnvironment() === "Builder.io Cloud" ? (
            <div className="space-y-3">
              <Alert className="border-orange-200 bg-orange-50">
                <Info className="w-4 h-4 text-orange-600" />
                <AlertDescription className="text-orange-800">
                  <p className="font-medium mb-1">Cloud Environment Detected</p>
                  <p className="text-sm">
                    To connect your Python backend from Builder.io cloud, you
                    need to expose it via ngrok or similar service.
                  </p>
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <h4 className="font-medium">
                  Option 1: Use ngrok (Recommended)
                </h4>
                <div className="bg-gray-50 p-3 rounded text-sm font-mono space-y-1">
                  <p># 1. Start your Python backend locally</p>
                  <p>cd backend && python main.py</p>
                  <p># 2. In another terminal, install and run ngrok</p>
                  <p>npm install -g ngrok</p>
                  <p>ngrok http 8000</p>
                  <p># 3. Copy the https URL (e.g., https://abc123.ngrok.io)</p>
                  <p># 4. Paste it above and click "Save & Apply"</p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">
                  Option 2: Deploy Backend to Cloud
                </h4>
                <p className="text-sm text-gray-600">
                  Deploy your Python backend to Heroku, Railway, Render, or
                  similar cloud service and use that URL.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  <p className="font-medium mb-1">
                    Local Development Environment
                  </p>
                  <p className="text-sm">
                    Your backend should be accessible at{" "}
                    <code>http://localhost:8000</code>
                  </p>
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <h4 className="font-medium">Start Your Backend:</h4>
                <div className="bg-gray-50 p-3 rounded text-sm font-mono space-y-1">
                  <p>cd backend</p>
                  <p>python main.py</p>
                  <p># Backend will be available at http://localhost:8000</p>
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 border-t">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <ExternalLink className="w-4 h-4" />
              <span>
                For detailed setup instructions, check the{" "}
                <code>BACKEND_IMPLEMENTATION_GUIDE.md</code> file
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BackendURLConfig;
