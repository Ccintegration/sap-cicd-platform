import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
  status: "active" | "draft" | "error";
  lastModified: string;
  version: string;
  author: string;
  type: "http" | "mail" | "sftp" | "database";
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
      // If specific packages are selected, load iflows for those packages
      // Otherwise load all iflows
      const sapIFlows = await PipelineSAPService.getIntegrationFlows();

      // Filter by selected packages if any
      let filteredIFlows = sapIFlows;
      if (data.selectedPackages && data.selectedPackages.length > 0) {
        filteredIFlows = sapIFlows.filter((iflow) =>
          data.selectedPackages.includes(iflow.packageId),
        );
      }

      setIFlows(filteredIFlows);
      setFilteredIFlows(filteredIFlows);
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
        iflow.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        iflow.description.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    setFilteredIFlows(filtered);
  }, [iFlows, searchTerm]);

  const handleIFlowToggle = (iFlowId: string) => {
    const newSelected = selectedIFlows.includes(iFlowId)
      ? selectedIFlows.filter((id) => id !== iFlowId)
      : [...selectedIFlows, iFlowId];

    setSelectedIFlows(newSelected);
    onComplete({ selectedIFlows: newSelected });
  };

  const handleSelectAll = () => {
    if (selectedIFlows.length === filteredIFlows.length) {
      setSelectedIFlows([]);
      onComplete({ selectedIFlows: [] });
    } else {
      const allIds = filteredIFlows.map((iflow) => iflow.id);
      setSelectedIFlows(allIds);
      onComplete({ selectedIFlows: allIds });
    }
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
    switch (type) {
      case "http":
        return "🌐";
      case "mail":
        return "📧";
      case "sftp":
        return "📁";
      case "database":
        return "🗄️";
      default:
        return "⚙️";
    }
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
          Choose the specific integration flows to include in your pipeline.
          {data.selectedPackages && data.selectedPackages.length > 0 ? (
            <span className="text-blue-600 ml-1">
              Showing iFlows from {data.selectedPackages.length} selected
              package(s).
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

        {/* iFlows List */}
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {filteredIFlows.length === 0 ? (
            <div className="text-center py-8">
              <List className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                {searchTerm
                  ? "No integration flows match your search"
                  : data.selectedPackages && data.selectedPackages.length > 0
                    ? "No integration flows found in selected packages"
                    : "No integration flows found"}
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
            filteredIFlows.map((iflow) => (
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
                      <span>Package: {iflow.packageId}</span>
                      <span>
                        Modified:{" "}
                        {new Date(iflow.lastModified).toLocaleDateString()}
                      </span>
                      <span>Author: {iflow.author}</span>
                      <span>Type: {iflow.type}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Selection Summary */}
        {selectedIFlows.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-md p-3">
            <p className="text-sm text-green-800">
              <strong>{selectedIFlows.length}</strong> integration flow
              {selectedIFlows.length === 1 ? "" : "s"} selected for CI/CD
              pipeline
            </p>
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
            onClick={onNext}
            disabled={!canProceed}
            className="flex items-center space-x-2"
          >
            <span>Next: Configuration</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default Stage2IFlowList;
