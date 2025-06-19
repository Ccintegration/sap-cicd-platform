// File Path: src/components/pipeline/Stage4Validation.tsx
// Filename: Stage4Validation.tsx
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
  executionId?: string;
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
  const [refreshing, setRefreshing] = useState(false);
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
          "No integration flows selected. Please go back and select iFlows."
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

  // FIXED: Refresh button function with correct API sequence
  const refreshValidationResults = async () => {
    setRefreshing(true);
    setError(null);

    try {
      if (!data.selectedIFlows || data.selectedIFlows.length === 0) {
        setError("No integration flows selected. Please go back and select iFlows.");
        return;
      }

      console.log("🔄 [Refresh] Starting validation refresh for iFlows:", data.selectedIFlows);

      // Process each iFlow with correct API sequence
      for (const iflowId of data.selectedIFlows) {
        try {
          // Find the iflow details from previous stage data
          const iflowDetails = data.iflowDetails?.find(
            (iflow: any) => iflow.id === iflowId || iflow.Id === iflowId,
          );

          const iflowVersion = iflowDetails?.version || iflowDetails?.Version || "active";
          const iflowName = iflowDetails?.name || iflowDetails?.Name || `iFlow ${iflowId}`;

          console.log(`🔄 [Refresh] Processing ${iflowId} (${iflowName}) version ${iflowVersion}`);

          // STEP 1: Execute design guidelines (POST) - Generate new execution
          console.log(`🔄 [Refresh] Step 1: Executing design guidelines for ${iflowId}`);
          const executeUrl = `http://localhost:8000/api/sap/iflows/${iflowId}/execute-guidelines?version=${iflowVersion}`;
          const executeResponse = await fetch(executeUrl, { 
            method: "POST",
            headers: {
              'Content-Type': 'application/json',
            }
          });

          if (!executeResponse.ok) {
            throw new Error(`Failed to execute design guidelines for ${iflowId}: ${executeResponse.status}`);
          }

          const executeResult = await executeResponse.json();
          console.log(`🔄 [Refresh] Step 1 completed for ${iflowId}:`, executeResult);

          // Extract execution ID from response
          const executionId = executeResult.data?.execution_id;
          console.log(`🔄 [Refresh] Execution ID for ${iflowId}: ${executionId}`);

          // STEP 2: Wait for execution to complete
          console.log(`🔄 [Refresh] Step 2: Waiting for execution to complete for ${iflowId}...`);
          await new Promise(resolve => setTimeout(resolve, 8000)); // Wait 8 seconds

          // STEP 3: Fetch the execution results (GET) - Get the generated results
          console.log(`🔄 [Refresh] Step 3: Fetching design guidelines results for ${iflowId}`);
          
          let fetchUrl;
          if (executionId) {
            // Use specific execution ID endpoint
            fetchUrl = `http://localhost:8000/api/sap/iflows/${iflowId}/design-guidelines?version=${iflowVersion}&execution_id=${executionId}`;
          } else {
            // Fallback to general endpoint (will get latest)
            fetchUrl = `http://localhost:8000/api/sap/iflows/${iflowId}/design-guidelines?version=${iflowVersion}`;
          }

          const fetchResponse = await fetch(fetchUrl);

          if (fetchResponse.ok) {
            const fetchResult = await fetchResponse.json();
            console.log(`🔄 [Refresh] Step 3 completed for ${iflowId}:`, fetchResult);

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

            console.log(`✅ [Refresh] Successfully refreshed validation results for ${iflowId}`);

          } else {
            console.error(`❌ [Refresh] Failed to fetch guidelines results for ${iflowId}: ${fetchResponse.status}`);
          }

        } catch (error) {
          console.error(`❌ [Refresh] Failed to refresh validation for ${iflowId}:`, error);
          // Continue with other iFlows even if one fails
        }
      }

      console.log("✅ [Refresh] Validation refresh completed for all iFlows");

    } catch (error) {
      console.error("❌ [Refresh] Failed to refresh validation results:", error);
      setError(`Failed to refresh validation results: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setRefreshing(false);
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

  const handleNext = () => {
    // Pass validation results to next stage
    onComplete({
      ...data,
      validationResults: validationResults,
      overallCompliance: getOverallCompliance(),
    });
    onNext();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "PASSED":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "FAILED":
        return <XCircle className="w-4 h-4 text-red-500" />;
      case "WARNING":
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case "NOT_APPLICABLE":
        return <Clock className="w-4 h-4 text-gray-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PASSED":
        return "bg-green-100 text-green-800 border-green-300";
      case "FAILED":
        return "bg-red-100 text-red-800 border-red-300";
      case "WARNING":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "NOT_APPLICABLE":
        return "bg-gray-100 text-gray-800 border-gray-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <span>Overall Compliance Summary</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {validationResults.length}
              </div>
              <div className="text-sm text-gray-600">Total iFlows</div>
            </div>
            <div className="text-center">
              <div
                className={`text-3xl font-bold ${
                  overallCompliance >= 80
                    ? "text-green-600"
                    : overallCompliance >= 60
                      ? "text-yellow-600"
                      : "text-red-600"
                }`}
              >
                {overallCompliance}%
              </div>
              <div className="text-sm text-gray-600">Average Compliance</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {validationResults.filter((r) => r.isCompliant).length}
              </div>
              <div className="text-sm text-gray-600">Compliant iFlows</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">
                {nonCompliantIFlows.length}
              </div>
              <div className="text-sm text-gray-600">Non-Compliant iFlows</div>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Overall Compliance Score</span>
              <span>{overallCompliance}%</span>
            </div>
            <Progress value={overallCompliance} className="w-full" />
          </div>
        </CardContent>
      </Card>

      {/* Validation Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileCheck className="w-5 h-5 text-purple-600" />
            <span>Validation Results by iFlow</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {validationResults.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Shield className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No validation results available</p>
              <p className="text-sm">
                Please ensure integration flows are selected in previous stages
              </p>
            </div>
          ) : (
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
                    className="text-sm"
                  >
                    <div className="flex flex-col items-center">
                      <span className="truncate max-w-[100px]">
                        {result.iflowName}
                      </span>
                      <Badge
                        className={`mt-1 text-xs ${
                          result.isCompliant
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {result.compliancePercentage}%
                      </Badge>
                    </div>
                  </TabsTrigger>
                ))}
              </TabsList>

              {validationResults.map((result) => (
                <TabsContent
                  key={result.iflowId}
                  value={result.iflowId}
                  className="space-y-4"
                >
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-medium text-gray-900 mb-2">
                      {result.iflowName} (v{result.version})
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                      <p>
                        <strong>iFlow ID:</strong> {result.iflowId}
                      </p>
                      <p>
                        <strong>Total Rules:</strong> {result.totalRules}
                      </p>
                      <p>
                        <strong>Compliant Rules:</strong> {result.compliantRules}
                      </p>
                      <p>
                        <strong>Compliance:</strong>{" "}
                        <span
                          className={`font-bold ${
                            result.compliancePercentage >= 80
                              ? "text-green-600"
                              : result.compliancePercentage >= 60
                                ? "text-yellow-600"
                                : "text-red-600"
                          }`}
                        >
                          {result.compliancePercentage}%
                        </span>
                      </p>
                    </div>
                    {result.lastExecuted && (
                      <p className="text-xs text-gray-500 mt-2">
                        Last executed: {new Date(result.lastExecuted).toLocaleString()}
                      </p>
                    )}
                  </div>

                  {result.guidelines.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <p>No design guidelines results available</p>
                      <p className="text-sm">
                        Guidelines may still be executing or failed to execute
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {result.guidelines.map((guideline, index) => (
                        <div
                          key={index}
                          className={`border rounded-lg p-4 ${
                            guideline.Status === "FAILED"
                              ? "border-red-200 bg-red-50"
                              : guideline.Status === "WARNING"
                                ? "border-yellow-200 bg-yellow-50"
                                : "border-gray-200"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-3">
                              {getStatusIcon(guideline.Status)}
                              <div>
                                <h4 className="font-medium">
                                  {guideline.RuleName}
                                </h4>
                                <p className="text-sm text-gray-600">
                                  {guideline.Description || guideline.Message}
                                </p>
                                <div className="flex items-center space-x-2 mt-1">
                                  <Badge variant="outline" className="text-xs">
                                    {guideline.Category}
                                  </Badge>
                                  <Badge
                                    variant="outline"
                                    className="text-xs"
                                  >
                                    {guideline.Severity}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            <Badge className={getStatusColor(guideline.Status)}>
                              {guideline.Status}
                            </Badge>
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

      {/* Non-Compliant iFlows Alert */}
      {nonCompliantIFlows.length > 0 && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-800">
            Compliance Issues Detected
          </AlertTitle>
          <AlertDescription className="text-yellow-800">
            <div className="mt-2">
              <p className="mb-2">
                {nonCompliantIFlows.length} iFlow{nonCompliantIFlows.length === 1 ? '' : 's'} {nonCompliantIFlows.length === 1 ? 'has' : 'have'} compliance issues:
              </p>
              <ul className="list-disc list-inside space-y-1">
                {nonCompliantIFlows.map((iflow) => (
                  <li key={iflow.iflowId}>
                    <strong>{iflow.iflowName}</strong> - {iflow.compliancePercentage}% compliant
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm">
                Review the validation results above and consider fixing these issues before proceeding to deployment.
              </p>
            </div>
          </AlertDescription>
        </Alert>
      )}

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
          {/* FIXED: Refresh button with correct API sequence */}
          <Button
            onClick={refreshValidationResults}
            variant="outline"
            disabled={refreshing}
            className="flex items-center space-x-2"
          >
            {refreshing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            <span>{refreshing ? "Refreshing..." : "Refresh Results"}</span>
          </Button>

          <Button
            onClick={handleNext}
            className="flex items-center space-x-2"
          >
            <span>Next: Dependencies</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Stage4Validation;