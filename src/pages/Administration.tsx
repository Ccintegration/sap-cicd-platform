// File Path: src/pages/Administration.tsx
// Filename: Administration.tsx
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
import TenantConnectionStatus from "@/components/pipeline/TenantConnectionStatus";

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
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-3xl p-8 text-white shadow-2xl">
          <div className="absolute inset-0 bg-black/20 rounded-3xl"></div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl transform translate-x-32 -translate-y-32"></div>
          <div className="relative">
            <div className="flex items-center space-x-4 mb-4">
              <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                <Shield className="w-8 h-8" />
              </div>
              <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
                Administrative Console
              </Badge>
            </div>
            <h1 className="text-4xl font-black mb-3">
              SAP CI/CD Administration
            </h1>
            <p className="text-xl text-blue-100 max-w-3xl">
              Manage your SAP Integration Suite tenants, configure system
              settings, and monitor the health of your CI/CD automation
              platform.
            </p>
          </div>
        </div>
      </div>

      {/* System Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {systemStats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card
              key={index}
              className="relative overflow-hidden border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105"
            >
              <div
                className={`absolute inset-0 ${stat.bgColor} opacity-50`}
              ></div>
              <CardContent className="relative p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">
                      {stat.title}
                    </p>
                    <p className="text-3xl font-black text-gray-900">
                      {stat.value}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {stat.description}
                    </p>
                  </div>
                  <div className={`${stat.bgColor} p-3 rounded-2xl`}>
                    <Icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Frontend → Backend → SAP Connection Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Server className="w-6 h-6 text-green-600" />
            <CardTitle className="text-xl">System Connection Status</CardTitle>
          </div>
          <CardDescription>
            Monitor the health and connectivity of your CI/CD pipeline components
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TenantConnectionStatus />
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