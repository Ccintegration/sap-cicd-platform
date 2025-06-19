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

// Fixed interface - added onPrevious property
interface Stage1Props {
  data: any;
  onComplete: (data: any) => void;
  onNext: () => void;
  onPrevious: () => void; // Added this missing property
}

const Stage1PackageList: React.FC<Stage1Props> = ({
  data,
  onComplete,
  onNext,
  onPrevious, // Now properly destructured
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
        pkg.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pkg.author.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredPackages(filtered);
  }, [packages, searchTerm]);

  useEffect(() => {
    // Sort filtered packages (default: by name)
    const sorted = [...filteredPackages].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    setSortedPackages(sorted);
    setCurrentPage(1); // Reset to first page when data changes
  }, [filteredPackages]);

  const loadPackages = async () => {
    setLoading(true);
    setError(null);
    try {
      // FIXED: Use getIntegrationPackages instead of getPackages
      const packagesData = await PipelineSAPService.getIntegrationPackages();
      setPackages(packagesData);
    } catch (err) {
      setError("Failed to load packages from SAP tenant");
      console.error("Error loading packages:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePackageSelection = (packageId: string, checked: boolean) => {
    setSelectedPackages(prev => {
      if (checked) {
        return [...prev, packageId];
      } else {
        return prev.filter(id => id !== packageId);
      }
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedPackages(currentPackages.map(pkg => pkg.id));
    } else {
      setSelectedPackages([]);
    }
  };

  const handleNext = () => {
    // Validate selection before proceeding
    if (selectedPackages.length === 0) {
      setError("Please select at least one package to continue");
      return;
    }

    setError(null);
    onComplete({ selectedPackages });
    onNext();
  };

  const getStatusColor = (status: Package["status"]) => {
    switch (status) {
      case "active": return "bg-green-100 text-green-800 border-green-300";
      case "draft": return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "deprecated": return "bg-red-100 text-red-800 border-red-300";
      default: return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading packages from SAP tenant...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <Package className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Failed to Load Packages
              </h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <Button onClick={loadPackages} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Filter Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search packages by name, description, or author..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={packagesPerPage.toString()}
              onValueChange={(value) => setPackagesPerPage(parseInt(value))}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 per page</SelectItem>
                <SelectItem value="10">10 per page</SelectItem>
                <SelectItem value="20">20 per page</SelectItem>
                <SelectItem value="50">50 per page</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Package List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Package className="w-6 h-6 text-blue-600" />
                <span>Integration Packages</span>
                <Badge variant="outline">
                  {sortedPackages.length} packages
                </Badge>
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Select packages to proceed to iFlow selection
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="select-all"
                checked={
                  currentPackages.length > 0 &&
                  currentPackages.every(pkg => selectedPackages.includes(pkg.id))
                }
                onCheckedChange={handleSelectAll}
              />
              <label htmlFor="select-all" className="text-sm font-medium">
                Select All ({currentPackages.length})
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {currentPackages.map((pkg) => (
              <div
                key={pkg.id}
                className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                  selectedPackages.includes(pkg.id)
                    ? "border-blue-300 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-start space-x-4">
                  <Checkbox
                    id={`package-${pkg.id}`}
                    checked={selectedPackages.includes(pkg.id)}
                    onCheckedChange={(checked) =>
                      handlePackageSelection(pkg.id, checked as boolean)
                    }
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <label
                        htmlFor={`package-${pkg.id}`}
                        className="font-medium text-gray-900 cursor-pointer"
                      >
                        {pkg.name}
                      </label>
                      <Badge className={getStatusColor(pkg.status)}>
                        {pkg.status}
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {pkg.description}
                    </p>
                    
                    <div className="flex items-center space-x-6 text-xs text-gray-500">
                      <div className="flex items-center space-x-1">
                        <User className="w-3 h-3" />
                        <span>{pkg.author}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {new Date(pkg.lastModified).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Package className="w-3 h-3" />
                        <span>{pkg.iflowCount} iFlows</span>
                      </div>
                      <div>
                        <span>v{pkg.version}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {currentPackages.length === 0 && (
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">
                  {searchTerm
                    ? "No packages found matching your search criteria"
                    : "No packages available"}
                </p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Showing {startIndex + 1} to {Math.min(endIndex, sortedPackages.length)} of{" "}
                {sortedPackages.length} packages
              </p>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      className={currentPage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = i + 1;
                    return (
                      <PaginationItem key={pageNum}>
                        <PaginationLink
                          onClick={() => setCurrentPage(pageNum)}
                          isActive={currentPage === pageNum}
                          className="cursor-pointer"
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
                  
                  {totalPages > 5 && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}
                  
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      className={currentPage >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={onPrevious}
          className="flex items-center space-x-2"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Previous</span>
        </Button>

        <div className="flex items-center space-x-4">
          {selectedPackages.length > 0 && (
            <Badge variant="outline" className="px-3 py-1">
              {selectedPackages.length} package{selectedPackages.length !== 1 ? 's' : ''} selected
            </Badge>
          )}
          <Button
            onClick={handleNext}
            disabled={selectedPackages.length === 0}
            className="flex items-center space-x-2"
          >
            <span>Next: Select iFlows</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {error && selectedPackages.length === 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
};

export default Stage1PackageList;