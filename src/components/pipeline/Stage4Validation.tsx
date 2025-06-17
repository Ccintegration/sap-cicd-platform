import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  Play,
  Clock,
  TrendingUp,
  AlertCircle,
  FileCheck,
  Zap,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface DesignGuidelineResult {
  RuleId: string;
  RuleName: string;
  Category: string;
  Severity: string;
  Status: "PASSED" | "FAILED" | "WARNING" | "NOT_APPLICABLE";
  Message?: string;
  Description?: string;
  ExecutionDate?: string;
}

interface IFlowValidation {
  iflowId: string;
  iflowName: string;
  version: string;
  guidelines: DesignGuidelineResult[];
  totalRules: number;
  compliantRules: number;
  compliancePercentage: number;
  isCompliant: boolean;
  lastExecuted?: string;
  hasExecutionHistory: boolean;
}

interface Stage4Props {
  data: any;
  onComplete: (data: any) => void;
  onNext: () => void;
  onPrevious: () => void;
}

const Stage4Validation: React.FC<Stage4Props> = ({
  data,
  onComplete,
  onNext,
  onPrevious,
}) => {
  const [validationResults, setValidationResults] = useState<IFlowValidation[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState<Record<string, boolean>>({});
  const [executed, setExecuted] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadValidationResults();
  }, [data.selectedIFlows]);

  const loadValidationResults = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!data.selectedIFlows || data.selectedIFlows.length === 0) {
        setError(
          "No integration flows selected. Please go back and select iFlows.",
        );
        setLoading(false);
        return;
      }

      console.log("Loading design guidelines for iFlows:", data.selectedIFlows);
      console.log("Available iFlow details:", data.iflowDetails);

      const validationPromises = data.selectedIFlows.map(
        async (iflowId: string) => {
          try {
            // Find the iflow details from previous stage data
            const iflowDetails = data.iflowDetails?.find(
              (iflow: any) => iflow.id === iflowId || iflow.Id === iflowId,
            );

            // Use the actual version from iflow details, not hardcoded "1.0.0"
            const iflowVersion = iflowDetails?.version || iflowDetails?.Version || "active";
            const iflowName = iflowDetails?.name || iflowDetails?.Name || `iFlow ${iflowId}`;

            console.log(`Fetching design guidelines for iFlow: ${iflowId}, version: ${iflowVersion}`);

            // Make API call to backend for design guidelines
            const backendUrl = `http://localhost:8000/api/sap/iflows/${iflowId}/design-guidelines?version=${iflowVersion}`;
            const response = await fetch(backendUrl);

            if (!response.ok) {
              throw new Error(
                `Failed to fetch design guidelines for ${iflowId}: ${response.status}`,
              );
            }

            const result = await response.json();
            const validationData = result.data;

            return {
              iflowId,
              iflowName,
              version: iflowVersion,
              guidelines: validationData.guidelines || [],
              totalRules: validationData.total_rules || 0,
              compliantRules: validationData.compliant_rules || 0,
              compliancePercentage: validationData.compliance_percentage || 0,
              isCompliant: validationData.is_compliant || false,
              lastExecuted: validationData.last_executed,
              hasExecutionHistory: validationData.guidelines.length > 0,
            };
          } catch (error) {
            console.error(
              `Failed to load validation results for ${iflowId}:`,
              error,
            );
            
            // Find the iflow details for error case as well
            const iflowDetails = data.iflowDetails?.find(
              (iflow: any) => iflow.id === iflowId || iflow.Id === iflowId,
            );

            const iflowVersion = iflowDetails?.version || iflowDetails?.Version || "active";
            const iflowName = iflowDetails?.name || iflowDetails?.Name || `iFlow ${iflowId}`;

            return {
              iflowId,
              iflowName,
              version: iflowVersion,
              guidelines: [],
              totalRules: 0,
              compliantRules: 0,
              compliancePercentage: 0,
              isCompliant: false,
              hasExecutionHistory: false,
            };
          }
        },
      );

      const results = await Promise.all(validationPromises);
      setValidationResults(results);

      // Only auto-execute for iFlows that haven't been executed yet and have no history
      const iflowsToExecute = results.filter(
        (result) => !result.hasExecutionHistory && !executed[result.iflowId]
      );
      
      if (iflowsToExecute.length > 0) {
        console.log(`Auto-executing design guidelines for ${iflowsToExecute.length} iFlows`);
        
        // Execute sequentially to avoid overwhelming the API
        for (const iflow of iflowsToExecute) {
          if (!executed[iflow.iflowId]) {
            await executeDesignGuidelines(iflow.iflowId, iflow.version, false);
            setExecuted(prev => ({ ...prev, [iflow.iflowId]: true }));
          }
        }
      }
    } catch (error) {
      console.error("Failed to load validation results:", error);
      setError("Failed to load design validation results");
    } finally {
      setLoading(false);
    }
  };

  const executeDesignGuidelines = async (
    iflowId: string,
    version: string = "active",
    showSuccess = true,
  ) => {
    // Prevent multiple executions for same iFlow
    if (executing[iflowId] || executed[iflowId]) {
      console.log(`Skipping execution for ${iflowId} - already executing or executed`);
      return;
    }

    setExecuting((prev) => ({ ...prev, [iflowId]: true }));

    try {
      console.log(`Executing design guidelines for iFlow: ${iflowId}, version: ${version}`);

      // Step 1: Execute design guidelines (POST)
      const executeUrl = `http://localhost:8000/api/sap/iflows/${iflowId}/execute-guidelines?version=${version}`;
      const executeResponse = await fetch(executeUrl, { 
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!executeResponse.ok) {
        throw new Error(`Failed to execute design guidelines: ${executeResponse.status}`);
      }

      const executeResult = await executeResponse.json();
      console.log(`Design guidelines execution started for ${iflowId}:`, executeResult);

      // Extract execution ID from response
      const executionId = executeResult.data?.execution_id;
      console.log(`Execution ID for ${iflowId}: ${executionId}`);

      // Mark as executed to prevent re-execution
      setExecuted(prev => ({ ...prev, [iflowId]: true }));

      // Step 2: Wait for execution to complete (increased wait time)
      console.log(`Waiting 8 seconds for execution to complete for ${iflowId}...`);
      await new Promise(resolve => setTimeout(resolve, 8000));

      // Step 3: Fetch the execution results using execution ID if available
      console.log(`Fetching design guidelines results for ${iflowId}${executionId ? ` with execution ID: ${executionId}` : ''}`);
      
      let fetchUrl;
      if (executionId) {
        // Use specific execution ID endpoint
        fetchUrl = `http://localhost:8000/api/sap/iflows/${iflowId}/design-guidelines?version=${version}&execution_id=${executionId}`;
      } else {
        // Fallback to general endpoint (will get latest)
        fetchUrl = `http://localhost:8000/api/sap/iflows/${iflowId}/design-guidelines?version=${version}`;
      }

      const fetchResponse = await fetch(fetchUrl);

      if (fetchResponse.ok) {
        const fetchResult = await fetchResponse.json();
        console.log(`Design guidelines results for ${iflowId}:`, fetchResult);

        // Update the specific iFlow's results
        setValidationResults(prev => 
          prev.map(result => 
            result.iflowId === iflowId 
              ? {
                  ...result,
                  guidelines: fetchResult.data.guidelines || [],
                  totalRules: fetchResult.data.total_rules || 0,
                  compliantRules: fetchResult.data.compliant_rules || 0,
                  compliancePercentage: fetchResult.data.compliance_percentage || 0,
                  isCompliant: fetchResult.data.is_compliant || false,
                  hasExecutionHistory: (fetchResult.data.guidelines || []).length > 0,
                  lastExecuted: fetchResult.data.last_executed,
                  executionId: fetchResult.data.execution_id,
                }
              : result
          )
        );

        if (showSuccess && fetchResult.data.guidelines.length > 0) {
          console.log(`✅ Successfully retrieved ${fetchResult.data.guidelines.length} design guidelines results for ${iflowId}`);
        }

        // If we didn't get guidelines, try polling a few more times
        if (!fetchResult.data.guidelines || fetchResult.data.guidelines.length === 0) {
          console.log(`No guidelines found yet for ${iflowId}, trying again in 5 seconds...`);
          
          // Try 2 more times with 5-second intervals
          for (let attempt = 1; attempt <= 2; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            const retryResponse = await fetch(fetchUrl);
            if (retryResponse.ok) {
              const retryResult = await retryResponse.json();
              if (retryResult.data.guidelines && retryResult.data.guidelines.length > 0) {
                console.log(`✅ Got guidelines on attempt ${attempt + 1} for ${iflowId}`);
                
                setValidationResults(prev => 
                  prev.map(result => 
                    result.iflowId === iflowId 
                      ? {
                          ...result,
                          guidelines: retryResult.data.guidelines || [],
                          totalRules: retryResult.data.total_rules || 0,
                          compliantRules: retryResult.data.compliant_rules || 0,
                          compliancePercentage: retryResult.data.compliance_percentage || 0,
                          isCompliant: retryResult.data.is_compliant || false,
                          hasExecutionHistory: (retryResult.data.guidelines || []).length > 0,
                          lastExecuted: retryResult.data.last_executed,
                          executionId: retryResult.data.execution_id,
                        }
                      : result
                  )
                );
                break;
              }
            }
          }
        }
      } else {
        console.error(`Failed to fetch guidelines results for ${iflowId}: ${fetchResponse.status}`);
      }

    } catch (error) {
      console.error(`Failed to execute design guidelines for ${iflowId}:`, error);
      setError(`Failed to execute design guidelines for ${iflowId}: ${error.message}`);
    } finally {
      setExecuting((prev) => ({ ...prev, [iflowId]: false }));
    }
  };

  const getOverallCompliance = () => {
    if (validationResults.length === 0) return 0;
    const totalCompliance = validationResults.reduce(
      (sum, result) => sum + result.compliancePercentage,
      0,
    );
    return Math.round(totalCompliance / validationResults.length);
  };

  const getNonCompliantIFlows = () => {
    return validationResults.filter((result) => !result.isCompliant);
  };

  const getComplianceColor = (percentage: number) => {
    if (percentage >= 75) return "text-green-600";
    if (percentage >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const getComplianceBadgeColor = (percentage: number) => {
    if (percentage >= 75) return "bg-green-100 text-green-800";
    if (percentage >= 50) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  const getRuleIcon = (status: string) => {
    switch (status) {
      case "PASSED":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "FAILED":
        return <XCircle className="w-4 h-4 text-red-500" />;
      case "WARNING":
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const canProceed = () => {
    // Allow proceeding even without execution for now
    return true;
  };

  const handleNext = () => {
    const overallCompliance = getOverallCompliance();
    const nonCompliantIFlows = getNonCompliantIFlows();

    onComplete({
      ...data,
      validationResults: {
        overallCompliance,
        nonCompliantIFlows: nonCompliantIFlows.map((iflow) => ({
          id: iflow.iflowId,
          name: iflow.iflowName,
          compliance: iflow.compliancePercentage,
        })),
        results: validationResults,
      },
    });
    onNext();
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center p-8">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mr-3" />
          <span className="text-lg">Loading design validation results...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full border-red-200">
        <CardContent className="flex items-center justify-center p-8">
          <AlertCircle className="w-8 h-8 text-red-500 mr-3" />
          <div>
            <p className="text-lg font-medium text-red-800">{error}</p>
            <Button onClick={loadValidationResults} className="mt-4">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const overallCompliance = getOverallCompliance();
  const nonCompliantIFlows = getNonCompliantIFlows();

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-0 shadow-lg bg-gradient-to-r from-green-50 to-blue-50">
        <CardHeader>
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-green-100 rounded-full">
              <Shield className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-2xl text-green-800">
                Design Guidelines Validation
              </CardTitle>
              <p className="text-green-600 mt-1">
                Validate your integration flows against SAP design guidelines to
                ensure best practices and compliance.
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Overall Compliance Summary */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <FileCheck className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-sm text-gray-600">iFlows Validated</p>
                <p className="text-2xl font-bold text-blue-600">
                  {validationResults.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <TrendingUp className="w-8 h-8 text-purple-500" />
              <div>
                <p className="text-sm text-gray-600">Overall Compliance</p>
                <p
                  className={`text-2xl font-bold ${getComplianceColor(overallCompliance)}`}
                >
                  {overallCompliance}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-sm text-gray-600">Compliant iFlows</p>
                <p className="text-2xl font-bold text-green-600">
                  {validationResults.filter((r) => r.isCompliant).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <XCircle className="w-8 h-8 text-red-500" />
              <div>
                <p className="text-sm text-gray-600">Non-Compliant</p>
                <p className="text-2xl font-bold text-red-600">
                  {nonCompliantIFlows.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Alert */}
      {nonCompliantIFlows.length > 0 && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-800">
            Design Guidelines Compliance Warning
          </AlertTitle>
          <AlertDescription className="text-yellow-700">
            {nonCompliantIFlows.length} integration flow(s) have compliance
            percentage below 75%. Please review the design guidelines violations
            before proceeding with deployment.
            <div className="mt-2">
              <strong>Non-compliant iFlows:</strong>{" "}
              {nonCompliantIFlows.map((iflow) => iflow.iflowName).join(", ")}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Detailed Results by iFlow */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileCheck className="w-5 h-5" />
            <span>Detailed Results by iFlow</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {validationResults.map((result) => (
            <div key={result.iflowId} className="border rounded-lg p-4 space-y-4">
              {/* iFlow Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {result.iflowName}
                  </h3>
                  <p className="text-sm text-gray-600">ID: {result.iflowId} | Version: {result.version}</p>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-bold ${getComplianceColor(result.compliancePercentage)}`}>
                    {result.compliancePercentage}%
                  </div>
                  <Badge className={getComplianceBadgeColor(result.compliancePercentage)}>
                    {result.isCompliant ? "Compliant" : "Non-Compliant"}
                  </Badge>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Compliance Progress</span>
                  <span>{result.compliantRules}/{result.totalRules} rules passed</span>
                </div>
                <Progress value={result.compliancePercentage} className="w-full" />
              </div>

              {/* Guidelines Breakdown */}
              {result.guidelines.length > 0 ? (
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900">Design Guidelines Results:</h4>
                  
                  {/* Rules by Status */}
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div className="bg-green-50 p-3 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {result.guidelines.filter(g => g.Status === "PASSED").length}
                      </div>
                      <div className="text-xs text-green-600">Passed</div>
                    </div>
                    <div className="bg-red-50 p-3 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">
                        {result.guidelines.filter(g => g.Status === "FAILED").length}
                      </div>
                      <div className="text-xs text-red-600">Failed</div>
                    </div>
                    <div className="bg-yellow-50 p-3 rounded-lg">
                      <div className="text-2xl font-bold text-yellow-600">
                        {result.guidelines.filter(g => g.Status === "WARNING").length}
                      </div>
                      <div className="text-xs text-yellow-600">Warnings</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-2xl font-bold text-gray-600">
                        {result.guidelines.filter(g => g.Status === "NOT_APPLICABLE").length}
                      </div>
                      <div className="text-xs text-gray-600">N/A</div>
                    </div>
                  </div>

                  {/* Failed Rules Details */}
                  {result.guidelines.filter(g => g.Status === "FAILED").length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <h5 className="font-medium text-red-800 mb-3">Failed Rules that need attention:</h5>
                      <div className="space-y-2">
                        {result.guidelines
                          .filter(g => g.Status === "FAILED")
                          .map((guideline, index) => (
                            <div key={index} className="bg-white p-3 rounded border-l-4 border-red-400">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <p className="font-medium text-red-900">
                                    {guideline.RuleName || guideline.RuleId}
                                  </p>
                                  <p className="text-sm text-red-700">
                                    Category: {guideline.Category} | Severity: {guideline.Severity}
                                  </p>
                                  {guideline.Message && (
                                    <p className="text-sm text-red-600 mt-1 italic">
                                      {guideline.Message}
                                    </p>
                                  )}
                                </div>
                                <XCircle className="w-5 h-5 text-red-500 mt-1" />
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Warning Rules Details */}
                  {result.guidelines.filter(g => g.Status === "WARNING").length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <h5 className="font-medium text-yellow-800 mb-3">Warnings to review:</h5>
                      <div className="space-y-2">
                        {result.guidelines
                          .filter(g => g.Status === "WARNING")
                          .map((guideline, index) => (
                            <div key={index} className="bg-white p-3 rounded border-l-4 border-yellow-400">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <p className="font-medium text-yellow-900">
                                    {guideline.RuleName || guideline.RuleId}
                                  </p>
                                  <p className="text-sm text-yellow-700">
                                    Category: {guideline.Category} | Severity: {guideline.Severity}
                                  </p>
                                  {guideline.Message && (
                                    <p className="text-sm text-yellow-600 mt-1 italic">
                                      {guideline.Message}
                                    </p>
                                  )}
                                </div>
                                <AlertTriangle className="w-5 h-5 text-yellow-500 mt-1" />
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* All Passed */}
                  {result.guidelines.filter(g => g.Status === "FAILED" || g.Status === "WARNING").length === 0 && 
                   result.guidelines.length > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                      <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                      <p className="text-green-800 font-medium">
                        Excellent! All design guidelines passed for this iFlow.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <Shield className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No design guidelines execution results available</p>
                  {!executed[result.iflowId] && !executing[result.iflowId] && (
                    <Button
                      onClick={() => executeDesignGuidelines(result.iflowId, result.version)}
                      size="sm"
                      className="mt-3"
                    >
                      <Play className="w-4 h-4 mr-1" />
                      Execute Guidelines
                    </Button>
                  )}
                  {executing[result.iflowId] && (
                    <p className="text-blue-600 mt-2">
                      <RefreshCw className="w-4 h-4 inline animate-spin mr-1" />
                      Executing guidelines...
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="w-5 h-5" />
            <span>iFlow Validation Results</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={validationResults[0]?.iflowId} className="w-full">
            <TabsList
              className="grid w-full"
              style={{
                gridTemplateColumns: `repeat(${validationResults.length}, 1fr)`,
              }}
            >
              {validationResults.map((result) => (
                <TabsTrigger
                  key={result.iflowId}
                  value={result.iflowId}
                  className="text-sm flex flex-col items-center p-2"
                >
                  <span className="truncate">{result.iflowName}</span>
                  <Badge
                    className={`text-xs mt-1 ${getComplianceBadgeColor(result.compliancePercentage)}`}
                  >
                    {result.compliancePercentage}%
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            {validationResults.map((result) => (
              <TabsContent
                key={result.iflowId}
                value={result.iflowId}
                className="space-y-4"
              >
                {/* iFlow Summary */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-medium text-gray-900 mb-1">
                        {result.iflowName}
                      </h3>
                      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                        <p>
                          <strong>ID:</strong> {result.iflowId}
                        </p>
                        <p>
                          <strong>Version:</strong> {result.version}
                        </p>
                        <p>
                          <strong>Total Rules:</strong> {result.totalRules}
                        </p>
                        <p>
                          <strong>Compliant Rules:</strong>{" "}
                          {result.compliantRules}
                        </p>
                      </div>
                    </div>
                    <div className="text-center">
                      <div
                        className={`text-3xl font-bold ${getComplianceColor(result.compliancePercentage)}`}
                      >
                        {result.compliancePercentage}%
                      </div>
                      <Progress
                        value={result.compliancePercentage}
                        className="w-24 mt-2"
                      />
                      {!result.hasExecutionHistory && !executed[result.iflowId] && (
                        <Button
                          onClick={() =>
                            executeDesignGuidelines(result.iflowId, result.version)
                          }
                          disabled={executing[result.iflowId]}
                          size="sm"
                          className="mt-2"
                        >
                          {executing[result.iflowId] ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                          <span className="ml-1">
                            {executing[result.iflowId]
                              ? "Executing..."
                              : "Execute"}
                          </span>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Guidelines Results */}
                {result.guidelines.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Shield className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No design guidelines execution history found</p>
                    <p className="text-sm mt-2">
                      Click "Execute" to run design guidelines validation
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {result.guidelines.map((guideline, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          {getRuleIcon(guideline.Status)}
                          <div>
                            <p className="font-medium text-sm">
                              {guideline.RuleName || guideline.RuleId}
                            </p>
                            <p className="text-xs text-gray-600">
                              {guideline.Category} • {guideline.Severity}
                            </p>
                            {guideline.Message && (
                              <p className="text-xs text-gray-500 mt-1">
                                {guideline.Message}
                              </p>
                            )}
                          </div>
                        </div>
                        <Badge
                          variant={
                            guideline.Status === "PASSED"
                              ? "default"
                              : guideline.Status === "FAILED"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {guideline.Status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Validation Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Validation Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Overall Compliance:</strong> {overallCompliance}%
                </p>
                <Progress value={overallCompliance} className="w-full" />
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">
                  <strong>Validation Status:</strong>{" "}
                  {overallCompliance >= 75 ? (
                    <span className="text-green-600">✓ Compliant</span>
                  ) : (
                    <span className="text-red-600">⚠ Non-Compliant</span>
                  )}
                </p>
              </div>
            </div>

            {nonCompliantIFlows.length > 0 && (
              <Alert className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertTitle className="text-red-800">
                  Compliance Issues Detected
                </AlertTitle>
                <AlertDescription className="text-red-700">
                  <p className="mb-2">
                    The following iFlows have compliance issues that should be
                    addressed:
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    {nonCompliantIFlows.map((iflow) => (
                      <li key={iflow.iflowId}>
                        <strong>{iflow.iflowName}</strong>:{" "}
                        {iflow.compliancePercentage}% compliant
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 font-medium">
                    ⚠ Consider reviewing and fixing these issues before
                    proceeding to deployment.
                  </p>
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-between pt-4">
        <Button
          onClick={onPrevious}
          variant="outline"
          className="flex items-center space-x-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Previous: Configuration</span>
        </Button>

        <div className="flex space-x-4">
          <Button
            onClick={loadValidationResults}
            variant="outline"
            className="flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh Results</span>
          </Button>

          <Button
            onClick={handleNext}
            className="flex items-center space-x-2"
          >
            <span>Next: Dependencies (Proceed without validation)</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Stage4Validation;