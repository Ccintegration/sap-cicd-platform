import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowRight,
  List,
  Play,
  Clock,
  AlertTriangle,
  CheckCircle,
  Search,
  Loader2,
  RefreshCw,
  ChevronLeft,
} from "lucide-react";
import { PipelineSAPService } from "@/lib/pipeline-sap-service";

interface IFlow {
  id: string;
  name: string;
  description: string;
  packageId: string;
  packageName?: string;
  status: "active" | "draft" | "error";
  lastModified: string;
  version: string;
  author: string;
  type: "integration flow"; // Fixed to always be "integration flow"
}

interface Stage2Props {
  data: any;
  onComplete: (data: any) => void;
  onNext: () => void;
  onPrevious: () => void;
}

const Stage2IFlowList: React.FC<Stage2Props> = ({
  data,
  onComplete,
  onNext,
  onPrevious,
}) => {
  const [selectedIFlows, setSelectedIFlows] = useState<string[]>(
    data.selectedIFlows || [],
  );
  const [iFlows, setIFlows] = useState<IFlow[]>([]);
  const [iFlowsByPackage, setIFlowsByPackage] = useState<Record<string, IFlow[]>>({});
  const [filteredIFlows, setFilteredIFlows] = useState<IFlow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadIFlows();
  }, [data.selectedPackages]);

  const loadIFlows = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log("🔍 [DEBUG] Complete pipeline data:", data);
      console.log("🔍 [DEBUG] data.selectedPackages:", data.selectedPackages);

      // Pass selected packages to backend so it only fetches flows from those packages
      const selectedPackageIds =
        data.selectedPackages && data.selectedPackages.length > 0
          ? data.selectedPackages
          : undefined;

      console.log(
        "🔄 Loading integration flows for packages:",
        selectedPackageIds || "all packages",
      );

      const sapIFlows =
        await PipelineSAPService.getIntegrationFlows(selectedPackageIds);

      console.log(`✅ Loaded ${sapIFlows.length} integration flows`);

      setIFlows(sapIFlows);
      setFilteredIFlows(sapIFlows);

      // Group iFlows by package
      const groupedByPackage: Record<string, IFlow[]> = {};
      sapIFlows.forEach((iflow) => {
        const packageId = iflow.packageId;
        if (!groupedByPackage[packageId]) {
          groupedByPackage[packageId] = [];
        }
        groupedByPackage[packageId].push(iflow);
      });
      setIFlowsByPackage(groupedByPackage);
    } catch (error) {
      console.error("Failed to load iFlows:", error);

      let errorMessage = "Failed to load integration flows from SAP tenant";

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
    const filtered = iFlows.filter(
      (iflow) =>
        iflow.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        iflow.description?.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    setFilteredIFlows(filtered);
  }, [iFlows, searchTerm]);

  const handleIFlowToggle = (iFlowId: string) => {
    const newSelected = selectedIFlows.includes(iFlowId)
      ? selectedIFlows.filter((id) => id !== iFlowId)
      : [...selectedIFlows, iFlowId];

    setSelectedIFlows(newSelected);
    // Only update local state, don't call onComplete until Next is clicked
  };

  const handleSelectAll = () => {
    if (selectedIFlows.length === filteredIFlows.length) {
      setSelectedIFlows([]);
    } else {
      const allIds = filteredIFlows.map((iflow) => iflow.id);
      setSelectedIFlows(allIds);
    }
  };

  const handleNext = () => {
    // Only proceed to next stage when user explicitly clicks Next button
    if (selectedIFlows.length === 0) {
      alert("Please select at least one integration flow before proceeding to configuration.");
      return;
    }

    // Ensure data is updated with selected iflows before proceeding
    const selectedIFlowDetails = iFlows.filter(iflow => selectedIFlows.includes(iflow.id));
    
    onComplete({ 
      ...data,
      selectedIFlows: selectedIFlows,
      iflowDetails: selectedIFlowDetails
    });
    onNext();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "draft":
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case "error":
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <Play className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 border-green-300";
      case "draft":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "error":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getTypeIcon = (type: string) => {
    return "⚙️"; // Always show gear icon for integration flows
  };

  const canProceed = selectedIFlows.length > 0;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">
            Fetching integration flows from SAP Integration Suite...
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
          <List className="w-5 h-5 text-green-600" />
          <span>Select Integration Flows</span>
          <Badge variant="outline" className="ml-auto">
            Step 2 of 8
          </Badge>
        </CardTitle>
        <p className="text-sm text-gray-600">
          Choose the specific integration flows to include in your pipeline. You can select multiple integration flows.
          {data.selectedPackages && data.selectedPackages.length > 0 ? (
            <span className="text-blue-600 ml-1">
              Showing iFlows from {data.selectedPackages.length} selected
              package(s): {data.selectedPackages.join(", ")}.
            </span>
          ) : (
            <span className="text-amber-600 ml-1">
              Showing all available iFlows.
            </span>
          )}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <div className="text-red-600">❌</div>
              <div>
                <p className="text-sm font-medium text-red-800">
                  Connection Error
                </p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
                <div className="mt-3 flex space-x-2">
                  <Button variant="outline" size="sm" onClick={loadIFlows}>
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

        {/* Search and Select All */}
        <div className="flex items-center space-x-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search integration flows..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            onClick={handleSelectAll}
            disabled={filteredIFlows.length === 0}
          >
            {selectedIFlows.length === filteredIFlows.length
              ? "Deselect All"
              : "Select All"}
          </Button>
        </div>

        {/* iFlows by Package Tabs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <List className="w-5 h-5" />
              <span>Integration Flows by Package</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(iFlowsByPackage).length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <List className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No integration flows available</p>
                <p className="text-sm">Please ensure packages are selected in the previous stage</p>
              </div>
            ) : (
              <Tabs
                defaultValue={Object.keys(iFlowsByPackage)[0]}
                className="w-full"
              >
                <TabsList
                  className="grid w-full"
                  style={{
                    gridTemplateColumns: `repeat(${Object.keys(iFlowsByPackage).length}, 1fr)`,
                  }}
                >
                  {Object.keys(iFlowsByPackage).map((packageId) => (
                    <TabsTrigger
                      key={packageId}
                      value={packageId}
                      className="text-sm"
                    >
                      <div className="flex flex-col items-center">
                        <span className="truncate">{packageId}</span>
                        <Badge variant="secondary" className="mt-1 text-xs">
                          {iFlowsByPackage[packageId].length} iFlows
                        </Badge>
                      </div>
                    </TabsTrigger>
                  ))}
                </TabsList>

                {Object.entries(iFlowsByPackage).map(([packageId, packageIFlows]) => (
                  <TabsContent
                    key={packageId}
                    value={packageId}
                    className="space-y-3"
                  >
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="font-medium text-gray-900 mb-2">
                        Package: {packageId}
                      </h3>
                      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                        <p>
                          <strong>iFlows Available:</strong> {packageIFlows.length}
                        </p>
                        <p>
                          <strong>Selected from this package:</strong> {packageIFlows.filter(iflow => selectedIFlows.includes(iflow.id)).length}
                        </p>
                      </div>
                    </div>

                    {packageIFlows.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <List className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p>No integration flows found in this package</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {packageIFlows.map((iflow) => (
                          <div
                            key={iflow.id}
                            className={`border rounded-lg p-4 transition-colors cursor-pointer ${
                              selectedIFlows.includes(iflow.id)
                                ? "border-green-300 bg-green-50"
                                : "border-gray-200 hover:border-gray-300"
                            }`}
                            onClick={() => handleIFlowToggle(iflow.id)}
                          >
                            <div className="flex items-start space-x-3">
                              <Checkbox
                                checked={selectedIFlows.includes(iflow.id)}
                                onChange={() => handleIFlowToggle(iflow.id)}
                                className="mt-1"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    {getStatusIcon(iflow.status)}
                                    <h3 className="font-medium text-gray-900 truncate">
                                      {iflow.name}
                                    </h3>
                                  </div>
                                  <div className="flex items-center space-x-2 ml-4">
                                    <span className="text-lg" title={`Type: ${iflow.type}`}>
                                      {getTypeIcon(iflow.type)}
                                    </span>
                                    <Badge className={getStatusBadgeColor(iflow.status)}>
                                      {iflow.status}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs">
                                      v{iflow.version}
                                    </Badge>
                                  </div>
                                </div>
                                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                  {iflow.description}
                                </p>
                                <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                                  <span>
                                    Modified:{" "}
                                    {new Date(iflow.lastModified).toLocaleDateString()}
                                  </span>
                                  <span>Author: {iflow.author}</span>
                                  <span>Type: Integration Flow</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </CardContent>
        </Card>

        {/* Selection Summary */}
        {selectedIFlows.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-md p-3">
            <p className="text-sm text-green-800">
              <strong>{selectedIFlows.length}</strong> integration flow
              {selectedIFlows.length === 1 ? "" : "s"} selected for CI/CD
              pipeline
            </p>
            <div className="text-xs text-green-600 mt-1">
              Selected: {selectedIFlows.join(", ")}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={onPrevious}>
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous: Packages
          </Button>
          <div className="text-sm text-gray-500 self-center">
            {iFlows.length > 0 && (
              <span>
                Showing {filteredIFlows.length} of {iFlows.length} iFlows
                <span className="text-green-600 ml-2">
                  (📡 Real data from SAP Integration Suite)
                </span>
              </span>
            )}
          </div>
          <Button
            onClick={handleNext}
            disabled={!canProceed}
            className="flex items-center space-x-2"
          >
            <span>Next: Configuration ({selectedIFlows.length} iFlow{selectedIFlows.length === 1 ? '' : 's'} selected)</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default Stage2IFlowList;