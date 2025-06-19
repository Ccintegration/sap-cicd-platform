// File Path: src/components/pipeline/Stage1PackageList.tsx
// Filename: Stage1PackageList.tsx
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Search,
  Package,
  Calendar,
  User,
  ArrowRight,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
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
  const [sortedPackages, setSortedPackages] = useState<Package[]>([]);
  const [selectedPackages, setSelectedPackages] = useState<string[]>(
    data.selectedPackages || [],
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [packagesPerPage, setPackagesPerPage] = useState(10);
  
  // Calculate pagination values
  const totalPages = Math.ceil(sortedPackages.length / packagesPerPage);
  const startIndex = (currentPage - 1) * packagesPerPage;
  const endIndex = startIndex + packagesPerPage;
  const currentPackages = sortedPackages.slice(startIndex, endIndex);

  useEffect(() => {
    loadPackages();
  }, []);

  useEffect(() => {
    // Filter packages based on search term
    const filtered = packages.filter(
      (pkg) =>
        pkg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pkg.description.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    setFilteredPackages(filtered);
  }, [packages, searchTerm]);

  useEffect(() => {
    // Sort packages by lastModified in descending order (latest first)
    const sorted = [...filteredPackages].sort((a, b) => {
      const dateA = new Date(a.lastModified).getTime();
      const dateB = new Date(b.lastModified).getTime();
      return dateB - dateA; // Descending order (latest first)
    });
    setSortedPackages(sorted);
    
    // Reset to first page when search or packages change
    setCurrentPage(1);
  }, [filteredPackages]);

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

  const handlePackageToggle = (packageId: string) => {
    const newSelected = selectedPackages.includes(packageId)
      ? selectedPackages.filter((id) => id !== packageId)
      : [...selectedPackages, packageId];

    setSelectedPackages(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedPackages.length === currentPackages.length) {
      // Deselect all packages on current page
      const currentPageIds = currentPackages.map(pkg => pkg.id);
      setSelectedPackages(selectedPackages.filter(id => !currentPageIds.includes(id)));
    } else {
      // Select all packages on current page
      const currentPageIds = currentPackages.map(pkg => pkg.id);
      const newSelected = [...new Set([...selectedPackages, ...currentPageIds])];
      setSelectedPackages(newSelected);
    }
  };

  const handleNext = () => {
    if (selectedPackages.length === 0) {
      alert("Please select at least one package before proceeding.");
      return;
    }

    onComplete({ 
      ...data,
      selectedPackages: selectedPackages 
    });
    onNext();
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePackagesPerPageChange = (value: string) => {
    setPackagesPerPage(parseInt(value));
    setCurrentPage(1); // Reset to first page
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

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 10;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      if (currentPage > 4) {
        pages.push('...');
      }
      
      // Show pages around current page
      const start = Math.max(2, currentPage - 2);
      const end = Math.min(totalPages - 1, currentPage + 2);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (currentPage < totalPages - 3) {
        pages.push('...');
      }
      
      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

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
          pipeline. You can select multiple packages. Data is fetched from your SAP Integration Suite via the
          backend API.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
                  <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-red-800 mb-1">
                  Unable to load packages
                </h3>
                <p className="text-sm text-red-700">{error}</p>
                <div className="text-xs text-red-600 space-y-1 mt-2">
                  <p>• Check that your Python backend is running</p>
                  <p>• Verify backend URL configuration in Administration</p>
                  <p>• Ensure SAP tenant credentials are valid</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadPackages}
                  className="mt-3"
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Retry
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Search and Controls */}
        <div className="flex items-center justify-between space-x-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search packages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          
          {/* Packages per page selector */}
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-600">Show:</label>
            <Select value={packagesPerPage.toString()} onValueChange={handlePackagesPerPageChange}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="30">30</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-gray-600">per page</span>
          </div>

          <Button
            variant="outline"
            onClick={handleSelectAll}
            disabled={currentPackages.length === 0}
          >
            {selectedPackages.filter(id => currentPackages.some(pkg => pkg.id === id)).length === currentPackages.length
              ? "Deselect Page"
              : "Select Page"}
          </Button>
        </div>

        {/* Results summary */}
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div>
            {sortedPackages.length > 0 && (
              <span>
                Showing {startIndex + 1}-{Math.min(endIndex, sortedPackages.length)} of {sortedPackages.length} packages
                {searchTerm && (
                  <span className="ml-1">(filtered from {packages.length} total)</span>
                )}
                <span className="text-green-600 ml-2">
                  (📡 Real data from SAP Integration Suite, sorted by latest updated)
                </span>
              </span>
            )}
          </div>
          <div>
            {selectedPackages.length > 0 && (
              <span className="font-medium text-blue-600">
                {selectedPackages.length} package{selectedPackages.length === 1 ? '' : 's'} selected
              </span>
            )}
          </div>
        </div>

        {/* Packages List */}
        <div className="space-y-3">
          {currentPackages.length === 0 ? (
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
            currentPackages.map((pkg) => (
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center space-x-2">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
                
                {getPageNumbers().map((page, index) => (
                  <PaginationItem key={index}>
                    {page === '...' ? (
                      <PaginationEllipsis />
                    ) : (
                      <PaginationLink
                        onClick={() => handlePageChange(page as number)}
                        isActive={currentPage === page}
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    )}
                  </PaginationItem>
                ))}
                
                <PaginationItem>
                  <PaginationNext 
                    onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}

        {/* Page info */}
        {totalPages > 1 && (
          <div className="text-center text-sm text-gray-500">
            Page {currentPage} of {totalPages}
          </div>
        )}

        {/* Selection Summary */}
        {selectedPackages.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-sm text-blue-800">
              <strong>{selectedPackages.length}</strong> package
              {selectedPackages.length === 1 ? "" : "s"} selected for CI/CD
              pipeline
            </p>
            <div className="text-xs text-blue-600 mt-1">
              Selected: {selectedPackages.join(", ")}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between pt-4">
          <div className="text-sm text-gray-500">
            {packages.length > 0 && (
              <span>
                Total: {packages.length} packages available
              </span>
            )}
          </div>
          <Button
            onClick={handleNext}
            disabled={!canProceed}
            className="flex items-center space-x-2"
          >
            <span>Next: Select iFlows ({selectedPackages.length} package{selectedPackages.length === 1 ? '' : 's'} selected)</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default Stage1PackageList;