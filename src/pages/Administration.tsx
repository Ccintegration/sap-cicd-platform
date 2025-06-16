import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Settings,
  Shield,
  Database,
  Users,
  Activity,
  Server,
  Lock,
  HardDrive,
} from "lucide-react";
import TenantRegistration from "@/components/administration/TenantRegistration";
// import WorkflowManagement from "@/components/administration/WorkflowManagement";
import WorkflowManagementBasic from "@/components/administration/WorkflowManagementBasic";
import BackendStatus from "@/components/administration/BackendStatus";

const Administration: React.FC = () => {
  const systemStats = [
    {
      title: "Active Tenants",
      value: "3",
      description: "SAP IS tenants registered",
      icon: Database,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Active Connections",
      value: "2",
      description: "Currently connected",
      icon: Activity,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "System Status",
      value: "Online",
      description: "All services operational",
      icon: Server,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
    {
      title: "Security",
      value: "Secure",
      description: "OAuth credentials encrypted",
      icon: Lock,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-50 via-white to-purple-50 rounded-xl -z-10"></div>
        <div className="p-8 text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur-lg opacity-20"></div>
              <div className="relative flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl shadow-xl">
                <Settings className="w-8 h-8" />
              </div>
            </div>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-blue-900 to-purple-900 bg-clip-text text-transparent mb-2">
            System Administration
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Manage SAP Integration Suite tenants, configure OAuth connections,
            and monitor system health
          </p>
        </div>
      </div>

      {/* System Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {systemStats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="relative overflow-hidden">
              <div
                className={`absolute top-0 right-0 w-20 h-20 ${stat.bgColor} rounded-full -translate-y-8 translate-x-8 opacity-20`}
              ></div>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Live
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-gray-900">
                    {stat.value}
                  </p>
                  <p className="text-sm font-medium text-gray-700">
                    {stat.title}
                  </p>
                  <p className="text-xs text-gray-500">{stat.description}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Security Notice */}
      <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardContent className="p-6">
          <div className="flex items-start space-x-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Shield className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-1">
                Security & Compliance
              </h3>
              <p className="text-sm text-blue-800 mb-3">
                All OAuth credentials are encrypted at rest and transmitted
                securely over HTTPS. Connection tests are performed using
                industry-standard security protocols.
              </p>
              <div className="flex items-center space-x-4 text-xs text-blue-700">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Encryption: AES-256</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Protocol: OAuth 2.0</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Transport: HTTPS/TLS 1.3</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Backend Configuration - Required for Pipeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Server className="w-6 h-6 text-purple-600" />
            <span>Python Backend Configuration</span>
          </CardTitle>
          <CardDescription>
            Configure your Python FastAPI backend URL for CI/CD Pipeline
            connectivity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BackendStatus />
        </CardContent>
      </Card>

      {/* Tenant Management Section */}
      <TenantRegistration />

      {/* Workflow Management Section - Basic */}
      <WorkflowManagementBasic />

      {/* System Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <HardDrive className="w-6 h-6 text-blue-600" />
            <CardTitle className="text-xl">System Information</CardTitle>
          </div>
          <CardDescription>
            System configuration and operational details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">Application Version</h4>
              <p className="text-sm text-gray-600">v2.1.0</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">Environment</h4>
              <Badge variant="outline">Production</Badge>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">Uptime</h4>
              <p className="text-sm text-gray-600">7 days, 14 hours</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">Last Backup</h4>
              <p className="text-sm text-gray-600">2 hours ago</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">API Health</h4>
              <Badge className="bg-green-100 text-green-800 border-green-300">
                Healthy
              </Badge>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">Storage Used</h4>
              <p className="text-sm text-gray-600">234 MB / 1 GB</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Administration;
