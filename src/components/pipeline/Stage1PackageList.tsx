import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Package,
  Calendar,
  User,
  ArrowRight,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { PipelineSAPService } from "@/lib/pipeline-sap-service";

interface Package {
  id: string;
  name: string;
  description: string;
  version: string;
  lastModified: string;
  author: string;
  iflowCount: number;
  status: "active" | "draft" | "deprecated";
}

interface Stage1Props {
  data: any;
  onComplete: (data: any) => void;
  onNext: () => void;
}

const Stage1PackageList: React.FC<Stage1Props> = ({
  data,
  onComplete,
  onNext,
}) => {
  const [packages, setPackages] = useState<Package[]>([]);
  const [filteredPackages, setFilteredPackages] = useState<Package[]>([]);
  const [selectedPackages, setSelectedPackages] = useState<string[]>(
    data.selectedPackages || [],
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPackages();
  }, []);

  const loadPackages = async () => {
    setLoading(true);
    setError(null);
    try {
      const sapPackages = await PipelineSAPService.getIntegrationPackages();
      setPackages(sapPackages);
      setFilteredPackages(sapPackages);
    } catch (error) {
      console.error("Failed to load packages:", error);

      let errorMessage = "Failed to load packages from SAP tenant";

      if (error instanceof Error) {
        if (error.message.includes("No base tenant registered")) {
          errorMessage =
            "No SAP tenant registered. Please register your tenant in the Administration tab first.";
        } else if (error.message.includes("Backend URL not configured")) {
          errorMessage =
            "Backend URL not configured. Please configure your Python FastAPI backend URL in the Administration tab.";
        } else if (error.message.includes("Cannot connect to backend")) {
          errorMessage = `Backend connection failed: ${error.message}. Please ensure your Python FastAPI backend is running and accessible.`;
        } else {
          errorMessage = error.message;
        }
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const filtered = packages.filter(
      (pkg) =>
        pkg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pkg.description.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    setFilteredPackages(filtered);
  }, [packages, searchTerm]);

  const handlePackageToggle = (packageId: string) => {
    const newSelected = selectedPackages.includes(packageId)
      ? selectedPackages.filter((id) => id !== packageId)
      : [...selectedPackages, packageId];

    setSelectedPackages(newSelected);
    onComplete({ selectedPackages: newSelected });
  };

  const handleSelectAll = () => {
    if (selectedPackages.length === filteredPackages.length) {
      setSelectedPackages([]);
      onComplete({ selectedPackages: [] });
    } else {
      const allIds = filteredPackages.map((pkg) => pkg.id);
      setSelectedPackages(allIds);
      onComplete({ selectedPackages: allIds });
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 border-green-300";
      case "draft":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "deprecated":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const canProceed = selectedPackages.length > 0;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">
            Fetching packages from SAP Integration Suite...
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Frontend → Backend API → SAP Integration Suite
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Package className="w-5 h-5 text-blue-600" />
          <span>Select Integration Packages</span>
          <Badge variant="outline" className="ml-auto">
            Step 1 of 8
          </Badge>
        </CardTitle>
        <p className="text-sm text-gray-600">
          Choose the integration packages you want to include in your CI/CD
          pipeline. Data is fetched from your SAP Integration Suite via the
          backend API.
        </p>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <div className="text-red-600">❌</div>
              <div>
                <p className="text-sm font-medium text-red-800">
                  Connection Error
                </p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
                <div className="mt-3 flex space-x-2">
                  <Button variant="outline" size="sm" onClick={loadPackages}>
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Retry
                  </Button>
                  {(error.includes("Backend URL not configured") ||
                    error.includes("Cannot connect to backend")) && (
                    <Button variant="outline" size="sm" asChild>
                      <a href="/administration">Go to Administration</a>
                    </Button>
                  )}
                  {error.includes("No SAP tenant registered") && (
                    <Button variant="outline" size="sm" asChild>
                      <a href="/administration">Register Tenant</a>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-red-800 text-sm font-medium">
                  Failed to load packages from SAP
                </p>
                <Button variant="outline" size="sm" onClick={loadPackages}>
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Retry
                </Button>
              </div>
              <p className="text-red-700 text-xs">{error}</p>
              <div className="text-xs text-red-600 space-y-1">
                <p>• Check that your Python backend is running</p>
                <p>• Verify backend URL configuration in Administration</p>
                <p>• Ensure SAP tenant credentials are valid</p>
              </div>
            </div>
          </div>
        )}

        {/* Search and Select All */}
        <div className="flex items-center space-x-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search packages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            onClick={handleSelectAll}
            disabled={filteredPackages.length === 0}
          >
            {selectedPackages.length === filteredPackages.length
              ? "Deselect All"
              : "Select All"}
          </Button>
        </div>

        {/* Packages List */}
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {filteredPackages.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                {searchTerm
                  ? "No packages match your search"
                  : "No packages found"}
              </p>
              {searchTerm && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchTerm("")}
                  className="mt-2"
                >
                  Clear search
                </Button>
              )}
            </div>
          ) : (
            filteredPackages.map((pkg) => (
              <div
                key={pkg.id}
                className={`border rounded-lg p-4 transition-colors cursor-pointer ${
                  selectedPackages.includes(pkg.id)
                    ? "border-blue-300 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                onClick={() => handlePackageToggle(pkg.id)}
              >
                <div className="flex items-start space-x-3">
                  <Checkbox
                    checked={selectedPackages.includes(pkg.id)}
                    onChange={() => handlePackageToggle(pkg.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-900 truncate">
                        {pkg.name}
                      </h3>
                      <div className="flex items-center space-x-2 ml-4">
                        <Badge className={getStatusBadgeColor(pkg.status)}>
                          {pkg.status}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          v{pkg.version}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {pkg.description}
                    </p>
                    <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {new Date(pkg.lastModified).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <User className="w-3 h-3" />
                        <span>{pkg.author}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Package className="w-3 h-3" />
                        <span>{pkg.iflowCount} iFlows</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Selection Summary */}
        {selectedPackages.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-sm text-blue-800">
              <strong>{selectedPackages.length}</strong> package
              {selectedPackages.length === 1 ? "" : "s"} selected for CI/CD
              pipeline
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between pt-4">
          <div className="text-sm text-gray-500">
            {packages.length > 0 && (
              <span>
                Showing {filteredPackages.length} of {packages.length} packages
                <span className="text-green-600 ml-2">
                  (📡 Real data from SAP Integration Suite)
                </span>
              </span>
            )}
          </div>
          <Button
            onClick={onNext}
            disabled={!canProceed}
            className="flex items-center space-x-2"
          >
            <span>Next: Select iFlows</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default Stage1PackageList;
