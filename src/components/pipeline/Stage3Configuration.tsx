// File Path: frontend/components/pipeline/Stage3Configuration.tsx
// Filename: Stage3Configuration.tsx
import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Settings,
  Globe,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  FileText,
  Server,
  Download,
  Upload,
  Copy,
  Search,
  Filter,
  Eye,
  EyeOff,
  History,
  GitCompare,
  Info,
  AlertTriangle,
  Clock,
  Database,
  Key,
  Lock,
  Unlock,
} from "lucide-react";

interface ConfigurationParameter {
  ParameterKey: string;
  ParameterValue: string;
  DataType: string;
  Description?: string;
  Mandatory?: boolean;
}

interface EnvironmentConfig {
  environment: string;
  configurations: Record<string, string>;
}

interface IFlowConfiguration {
  iflowId: string;
  iflowName: string;
  version: string;
  parameters: ConfigurationParameter[];
  environments: EnvironmentConfig[];
}

interface Stage3Props {
  data: any;
  onComplete: (data: any) => void;
  onNext: () => void;
  onPrevious: () => void;
}

interface ConfigurationHistory {
  timestamp: string;
  environment: string;
  configurations: Record<string, Record<string, string>>;
  savedBy: string;
}

const Stage3Configuration: React.FC<Stage3Props> = ({
  data,
  onComplete,
  onNext,
  onPrevious,
}) => {
  const [iflowConfigurations, setIFlowConfigurations] = useState<
    IFlowConfiguration[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [selectedEnvironment, setSelectedEnvironment] = useState("development");
  const [configurationChanges, setConfigurationChanges] = useState<
    Record<string, Record<string, string>>
  >({});
  const [importingConfigs, setImportingConfigs] = useState(false);
  const [exportingConfigs, setExportingConfigs] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDataType, setFilterDataType] = useState("all");
  const [showMandatoryOnly, setShowMandatoryOnly] = useState(false);
  const [showEmptyOnly, setShowEmptyOnly] = useState(false);
  const [maskedFields, setMaskedFields] = useState<Set<string>>(new Set());
  const [configurationHistory, setConfigurationHistory] = useState<ConfigurationHistory[]>([]);
  const [showComparisonDialog, setShowComparisonDialog] = useState(false);
  const [comparisonSource, setComparisonSource] = useState("");
  const [comparisonTarget, setComparisonTarget] = useState("");
  const [comparisonResult, setComparisonResult] = useState<any>(null);
  const [autoSave, setAutoSave] = useState(false);
  const [autoSaveInterval, setAutoSaveInterval] = useState<NodeJS.Timeout | null>(null);
  const [unsavedChanges, setUnsavedChanges] = useState(false);

  const environments = [
    {
      id: "development",
      name: "Development",
      color: "bg-blue-100 text-blue-800",
      description: "Development environment for testing new features"
    },
    { 
      id: "testing", 
      name: "Testing", 
      color: "bg-yellow-100 text-yellow-800",
      description: "Testing environment for quality assurance"
    },
    {
      id: "staging",
      name: "Staging",
      color: "bg-purple-100 text-purple-800",
      description: "Pre-production environment for final validation"
    },
    {
      id: "production",
      name: "Production",
      color: "bg-green-100 text-green-800",
      description: "Live production environment"
    },
  ];

  const dataTypes = [
    "all",
    "string",
    "integer", 
    "boolean",
    "secureParameter",
    "password",
    "xstring",
    "text",
    "longtext"
  ];

  useEffect(() => {
    loadConfigurations();
    loadConfigurationHistory();
  }, [data.selectedIFlows]);

  useEffect(() => {
    handleEnvironmentChange(selectedEnvironment);
  }, [selectedEnvironment]);

  useEffect(() => {
    // Setup auto-save
    if (autoSave && unsavedChanges) {
      if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
      }
      const interval = setInterval(() => {
        saveConfigurations(true);
      }, 30000); // Auto-save every 30 seconds
      setAutoSaveInterval(interval);
    } else if (autoSaveInterval) {
      clearInterval(autoSaveInterval);
      setAutoSaveInterval(null);
    }

    return () => {
      if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
      }
    };
  }, [autoSave, unsavedChanges]);

  const loadConfigurations = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!data.selectedIFlows || data.selectedIFlows.length === 0) {
        setError(
          "No integration flows selected. Please go back and select iFlows."
        );
        return;
      }

      // Backend API client
      const backendAPIClient = (await import("@/lib/backend-client")).default;

      // Load configurations for each selected iFlow
      const configurationsPromises = data.selectedIFlows.map(
        async (iflowId: string) => {
          try {
            console.log(`Loading configuration for iFlow: ${iflowId}`);
            const configData = await backendAPIClient.getIFlowConfiguration(iflowId);
            
            return {
              iflowId,
              iflowName: configData.name || `iFlow ${iflowId}`,
              version: configData.version || "active",
              parameters: configData.parameters || [],
              environments: environments.map((env) => ({
                environment: env.id,
                configurations: {},
              })),
            };
          } catch (error) {
            console.error(`Failed to load configuration for ${iflowId}:`, error);
            
            // Return a configuration with empty parameters for failed requests
            const iflowDetails = data.iflowDetails?.find(
              (iflow: any) => iflow.id === iflowId || iflow.Id === iflowId,
            );
            
            const iflowVersion = iflowDetails?.version || iflowDetails?.Version || "active";
            const iflowName = iflowDetails?.name || iflowDetails?.Name || `iFlow ${iflowId}`;

            return {
              iflowId,
              iflowName,
              version: iflowVersion,
              parameters: [],
              environments: environments.map((env) => ({
                environment: env.id,
                configurations: {},
              })),
            };
          }
        },
      );

      const results = await Promise.all(configurationsPromises);
      const validConfigurations = results.filter(
        (config): config is IFlowConfiguration => config !== null,
      );

      console.log('Final configurations loaded:', validConfigurations);
      setIFlowConfigurations(validConfigurations);

      // Initialize configuration changes
      const initialChanges: Record<string, Record<string, string>> = {};
      validConfigurations.forEach((config) => {
        initialChanges[config.iflowId] = {};
        config.parameters.forEach((param) => {
          initialChanges[config.iflowId][param.ParameterKey] =
            param.ParameterValue || "";
        });
      });
      setConfigurationChanges(initialChanges);

    } catch (error) {
      console.error("Failed to load configurations:", error);
      setError(`Failed to load integration flow configurations: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadExistingConfigurations = async (environment: string) => {
    try {
      const backendAPIClient = (await import("@/lib/backend-client")).default;
      const existingConfigs = await backendAPIClient.getEnvironmentConfigurations(environment);
      
      if (existingConfigs.length > 0) {
        const updatedChanges = { ...configurationChanges };
        
        existingConfigs.forEach(config => {
          if (updatedChanges[config.iFlow_ID]) {
            updatedChanges[config.iFlow_ID][config.Parameter_Key] = config.Parameter_Value;
          }
        });
        
        setConfigurationChanges(updatedChanges);
      }
    } catch (error) {
      console.warn(`Failed to load existing configurations for ${environment}:`, error);
    }
  };

  const loadConfigurationHistory = async () => {
    try {
      const backendAPIClient = (await import("@/lib/backend-client")).default;
      const filesResponse = await backendAPIClient.listConfigurationFiles();
      
      // Parse history from files (simplified)
      const history: ConfigurationHistory[] = filesResponse.data.files
        .filter(file => !file.filename.includes('_latest'))
        .map(file => {
          const parts = file.filename.replace('.csv', '').split('_');
          return {
            timestamp: file.modified,
            environment: parts[2] || 'unknown',
            configurations: {},
            savedBy: 'system'
          };
        })
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10); // Keep last 10 entries
      
      setConfigurationHistory(history);
    } catch (error) {
      console.warn('Failed to load configuration history:', error);
    }
  };

  const updateConfiguration = useCallback((
    iflowId: string,
    parameterKey: string,
    value: string,
  ) => {
    setConfigurationChanges((prev) => ({
      ...prev,
      [iflowId]: {
        ...prev[iflowId],
        [parameterKey]: value,
      },
    }));

    setUnsavedChanges(true);

    // Clear save success message when user makes changes
    if (saveSuccess) {
      setSaveSuccess(false);
    }
  }, [saveSuccess]);

  const saveConfigurations = async (isAutoSave: boolean = false) => {
    if (!isAutoSave) setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      // Prepare configuration data for backend
      const configurationData = {
        environment: selectedEnvironment,
        timestamp: new Date().toISOString(),
        iflows: iflowConfigurations.map((config) => ({
          iflowId: config.iflowId,
          iflowName: config.iflowName,
          version: config.version,
          configurations: configurationChanges[config.iflowId] || {},
        })),
      };

      // Save to Python backend via CSV
      const backendAPIClient = (await import("@/lib/backend-client")).default;
      
      // Call the backend API to save configurations
      await backendAPIClient.saveIFlowConfigurations(configurationData);

      // Update local state for later stages
      const environmentConfigs = {
        environment: selectedEnvironment,
        configurations: configurationChanges,
        timestamp: new Date().toISOString(),
      };

      onComplete({
        ...data,
        configurations: {
          ...data.configurations,
          [selectedEnvironment]: environmentConfigs,
        },
        currentEnvironmentConfigs: environmentConfigs,
      });

      // Show success message
      if (!isAutoSave) {
        setSaveSuccess(true);
        console.log("✅ Configurations saved successfully to backend");

        // Auto-hide success message after 3 seconds
        setTimeout(() => setSaveSuccess(false), 3000);
      }

      setUnsavedChanges(false);
      await loadConfigurationHistory();

    } catch (error) {
      console.error("❌ Failed to save configurations:", error);
      setError(`Failed to save configurations: ${error.message}`);
    } finally {
      if (!isAutoSave) setSaving(false);
    }
  };

  const handleNext = () => {
    // Update complete data with all necessary information for next stage
    onComplete({
      ...data,
      configurations: {
        ...data.configurations,
        [selectedEnvironment]: {
          environment: selectedEnvironment,
          configurations: configurationChanges,
          timestamp: new Date().toISOString(),
        },
      },
      currentEnvironmentConfigs: {
        environment: selectedEnvironment,
        configurations: configurationChanges,
        timestamp: new Date().toISOString(),
      },
      iflowConfigurations: iflowConfigurations,
    });
    
    // Navigate to next stage
    onNext();
  };

  const handleEnvironmentChange = async (environmentId: string) => {
    setSelectedEnvironment(environmentId);
    await loadExistingConfigurations(environmentId);
  };

  const exportConfigurations = async () => {
    setExportingConfigs(true);
    try {
      const backendAPIClient = (await import("@/lib/backend-client")).default;
      const blob = await backendAPIClient.exportConfigurations(selectedEnvironment, 'json');
      
      const url = URL.createObjectURL(blob);
      const exportFileDefaultName = `iflow_configurations_${selectedEnvironment}_${new Date().toISOString().split('T')[0]}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', url);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      URL.revokeObjectURL(url);
      console.log('✅ Configurations exported successfully');
    } catch (error) {
      console.error('❌ Failed to export configurations:', error);
      setError(`Failed to export configurations: ${error.message}`);
    } finally {
      setExportingConfigs(false);
    }
  };

  const importConfigurations = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportingConfigs(true);
    try {
      const backendAPIClient = (await import("@/lib/backend-client")).default;
      const result = await backendAPIClient.importConfigurations(file, selectedEnvironment, false);
      
      console.log('✅ Configurations imported successfully:', result);
      
      // Reload configurations
      await loadExistingConfigurations(selectedEnvironment);
      
      // Show import results
      if (result.errors.length > 0) {
        setError(`Import completed with ${result.errors.length} errors: ${result.errors.join(', ')}`);
      }
    } catch (error) {
      console.error('❌ Failed to import configurations:', error);
      setError(`Failed to import configurations: ${error.message}`);
    } finally {
      setImportingConfigs(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const copyConfigurationsFromEnvironment = async (sourceEnvironment: string) => {
    try {
      const backendAPIClient = (await import("@/lib/backend-client")).default;
      const sourceConfigs = await backendAPIClient.getEnvironmentConfigurations(sourceEnvironment);
      
      const updatedChanges = { ...configurationChanges };
      
      sourceConfigs.forEach(config => {
        if (updatedChanges[config.iFlow_ID]) {
          updatedChanges[config.iFlow_ID][config.Parameter_Key] = config.Parameter_Value;
        }
      });
      
      setConfigurationChanges(updatedChanges);
      setUnsavedChanges(true);
      console.log(`✅ Configurations copied from ${sourceEnvironment}`);
    } catch (error) {
      console.error(`❌ Failed to copy configurations from ${sourceEnvironment}:`, error);
      setError(`Failed to copy configurations: ${error.message}`);
    }
  };

  const compareEnvironments = async () => {
    try {
      const backendAPIClient = (await import("@/lib/backend-client")).default;
      const result = await backendAPIClient.compareConfigurations(comparisonSource, comparisonTarget);
      setComparisonResult(result);
    } catch (error) {
      console.error('Failed to compare environments:', error);
      setError(`Failed to compare environments: ${error.message}`);
    }
  };

  const toggleFieldMask = (fieldKey: string) => {
    const newMaskedFields = new Set(maskedFields);
    if (newMaskedFields.has(fieldKey)) {
      newMaskedFields.delete(fieldKey);
    } else {
      newMaskedFields.add(fieldKey);
    }
    setMaskedFields(newMaskedFields);
  };

  const getFilteredParameters = (parameters: ConfigurationParameter[]) => {
    return parameters.filter(param => {
      // Search filter
      if (searchQuery && !param.ParameterKey.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !param.Description?.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Data type filter
      if (filterDataType !== "all" && param.DataType !== filterDataType) {
        return false;
      }

      // Mandatory only filter
      if (showMandatoryOnly && !param.Mandatory) {
        return false;
      }

      // Empty only filter
      if (showEmptyOnly && param.ParameterValue && param.ParameterValue.trim() !== "") {
        return false;
      }

      return true;
    });
  };

  const getTotalParametersCount = () => {
    return iflowConfigurations.reduce(
      (total, config) => total + config.parameters.length,
      0,
    );
  };

  const getConfiguredParametersCount = () => {
    let count = 0;
    iflowConfigurations.forEach((config) => {
      config.parameters.forEach((param) => {
        const currentValue =
          configurationChanges[config.iflowId]?.[param.ParameterKey];
        if (currentValue && currentValue.trim() !== "") {
          count++;
        }
      });
    });
    return count;
  };

  const getComplianceScore = () => {
    const total = getTotalParametersCount();
    const configured = getConfiguredParametersCount();
    return total > 0 ? Math.round((configured / total) * 100) : 0;
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Loading integration flow configurations...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="mt-4 flex space-x-2">
            <Button onClick={loadConfigurations} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
            <Button onClick={onPrevious} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Environment Selection & Auto-save */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Globe className="w-5 h-5" />
              <span>Target Environment</span>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="auto-save"
                  checked={autoSave}
                  onCheckedChange={setAutoSave}
                />
                <Label htmlFor="auto-save" className="text-sm">Auto-save</Label>
              </div>
              {unsavedChanges && (
                <Badge variant="outline" className="text-orange-600">
                  <Clock className="w-3 h-3 mr-1" />
                  Unsaved changes
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {environments.map((env) => (
              <TooltipProvider key={env.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => handleEnvironmentChange(env.id)}
                      variant={selectedEnvironment === env.id ? "default" : "outline"}
                      className="flex flex-col items-center space-y-1 h-auto py-3"
                    >
                      <Badge className={env.color}>{env.name}</Badge>
                      <span className="text-xs text-gray-500">{env.id}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{env.description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Configuration Management Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Server className="w-5 h-5" />
            <span>Configuration Management</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={exportConfigurations}
              disabled={exportingConfigs}
              variant="outline"
              size="sm"
            >
              {exportingConfigs ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Export Config
            </Button>
            
            <div className="relative">
              <input
                type="file"
                accept=".json,.csv"
                onChange={importConfigurations}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={importingConfigs}
              />
              <Button
                disabled={importingConfigs}
                variant="outline"
                size="sm"
              >
                {importingConfigs ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Import Config
              </Button>
            </div>

            {environments
              .filter(env => env.id !== selectedEnvironment)
              .map(env => (
                <Button
                  key={env.id}
                  onClick={() => copyConfigurationsFromEnvironment(env.id)}
                  variant="outline"
                  size="sm"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy from {env.name}
                </Button>
              ))
            }

            <Dialog open={showComparisonDialog} onOpenChange={setShowComparisonDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <GitCompare className="w-4 h-4 mr-2" />
                  Compare Environments
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl">
                <DialogHeader>
                  <DialogTitle>Environment Comparison</DialogTitle>
                  <DialogDescription>
                    Compare configurations between different environments
                  </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4 my-4">
                  <div>
                    <Label>Source Environment</Label>
                    <Select value={comparisonSource} onValueChange={setComparisonSource}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select source" />
                      </SelectTrigger>
                      <SelectContent>
                        {environments.map(env => (
                          <SelectItem key={env.id} value={env.id}>{env.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Target Environment</Label>
                    <Select value={comparisonTarget} onValueChange={setComparisonTarget}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select target" />
                      </SelectTrigger>
                      <SelectContent>
                        {environments.map(env => (
                          <SelectItem key={env.id} value={env.id}>{env.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={compareEnvironments} disabled={!comparisonSource || !comparisonTarget}>
                    Compare
                  </Button>
                </DialogFooter>
                {comparisonResult && (
                  <div className="mt-4 space-y-4">
                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-green-600">{comparisonResult.added.length}</div>
                        <div className="text-sm text-gray-600">Added</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-blue-600">{comparisonResult.modified.length}</div>
                        <div className="text-sm text-gray-600">Modified</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-red-600">{comparisonResult.removed.length}</div>
                        <div className="text-sm text-gray-600">Removed</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-gray-600">{comparisonResult.unchanged.length}</div>
                        <div className="text-sm text-gray-600">Unchanged</div>
                      </div>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Success Message */}
      {saveSuccess && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            ✅ Configurations saved successfully to backend server!
          </AlertDescription>
        </Alert>
      )}

      {/* Search and Filter Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="w-5 h-5" />
            <span>Search & Filter</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search parameters..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={filterDataType} onValueChange={setFilterDataType}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by data type" />
              </SelectTrigger>
              <SelectContent>
                {dataTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {type === "all" ? "All Types" : type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center space-x-2">
              <Switch
                id="mandatory-only"
                checked={showMandatoryOnly}
                onCheckedChange={setShowMandatoryOnly}
              />
              <Label htmlFor="mandatory-only" className="text-sm">Mandatory only</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="empty-only"
                checked={showEmptyOnly}
                onCheckedChange={setShowEmptyOnly}
              />
              <Label htmlFor="empty-only" className="text-sm">Empty only</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Forms */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="w-5 h-5" />
            <span>iFlow Configuration Parameters</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {iflowConfigurations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No configuration parameters found for the selected iFlows.</p>
            </div>
          ) : (
            <Tabs defaultValue={iflowConfigurations[0]?.iflowId}>
              <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {iflowConfigurations.map((config) => {
                  const filteredParams = getFilteredParameters(config.parameters);
                  const configuredCount = config.parameters.filter(param => {
                    const value = configurationChanges[config.iflowId]?.[param.ParameterKey];
                    return value && value.trim() !== "";
                  }).length;
                  
                  return (
                    <TabsTrigger
                      key={config.iflowId}
                      value={config.iflowId}
                      className="text-xs flex flex-col items-center p-2"
                    >
                      <span className="truncate max-w-32">{config.iflowName}</span>
                      <div className="flex space-x-1 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {filteredParams.length}/{config.parameters.length}
                        </Badge>
                        <Badge variant={configuredCount === config.parameters.length ? "default" : "secondary"} className="text-xs">
                          {configuredCount} configured
                        </Badge>
                      </div>
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {iflowConfigurations.map((config) => {
                const filteredParameters = getFilteredParameters(config.parameters);
                
                return (
                  <TabsContent key={config.iflowId} value={config.iflowId}>
                    {filteredParameters.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Settings className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No configuration parameters match the current filters.</p>
                        <p className="text-sm mt-2">
                          Try adjusting your search criteria or filters.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-medium">{config.iflowName}</h3>
                            <p className="text-sm text-gray-600">Version: {config.version}</p>
                          </div>
                          <div className="flex space-x-2">
                            <Badge variant="outline">
                              {filteredParameters.length} parameters shown
                            </Badge>
                            <Badge variant="secondary">
                              {config.parameters.length} total
                            </Badge>
                          </div>
                        </div>

                        <div className="grid gap-4">
                          {filteredParameters.map((param) => {
                            const fieldKey = `${config.iflowId}-${param.ParameterKey}`;
                            const isMasked = maskedFields.has(fieldKey);
                            const isSecure = param.DataType === "secureParameter" || param.DataType === "password";
                            const currentValue = configurationChanges[config.iflowId]?.[param.ParameterKey] || "";
                            const hasChanged = currentValue !== param.ParameterValue;

                            return (
                              <div
                                key={param.ParameterKey}
                                className={`border rounded-lg p-4 space-y-3 transition-colors ${
                                  hasChanged ? 'border-blue-200 bg-blue-50' : ''
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <Label
                                      htmlFor={fieldKey}
                                      className="text-sm font-medium"
                                    >
                                      {param.ParameterKey}
                                      {param.Mandatory && (
                                        <span className="text-red-500 ml-1">*</span>
                                      )}
                                    </Label>
                                    {hasChanged && (
                                      <Badge variant="outline" className="text-xs text-blue-600">
                                        Modified
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Badge variant="secondary" className="text-xs">
                                      {param.DataType}
                                    </Badge>
                                    {param.Mandatory && (
                                      <Badge variant="destructive" className="text-xs">
                                        Required
                                      </Badge>
                                    )}
                                    {isSecure && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => toggleFieldMask(fieldKey)}
                                        className="h-6 w-6 p-0"
                                      >
                                        {isMasked ? (
                                          <EyeOff className="w-3 h-3" />
                                        ) : (
                                          <Eye className="w-3 h-3" />
                                        )}
                                      </Button>
                                    )}
                                    {param.Description && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Info className="w-4 h-4 text-gray-400" />
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p className="max-w-xs">{param.Description}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                  </div>
                                </div>

                                {param.Description && (
                                  <p className="text-sm text-gray-600">
                                    {param.Description}
                                  </p>
                                )}

                                <div className="space-y-2">
                                  {param.DataType === "xstring" ||
                                  param.DataType === "text" ||
                                  param.DataType === "longtext" ? (
                                    <Textarea
                                      id={fieldKey}
                                      value={currentValue}
                                      onChange={(e) =>
                                        updateConfiguration(
                                          config.iflowId,
                                          param.ParameterKey,
                                          e.target.value,
                                        )
                                      }
                                      placeholder={`Enter ${param.ParameterKey} for ${selectedEnvironment}`}
                                      className="w-full"
                                      rows={3}
                                    />
                                  ) : param.DataType === "boolean" ? (
                                    <Select
                                      value={currentValue || ""}
                                      onValueChange={(value) =>
                                        updateConfiguration(
                                          config.iflowId,
                                          param.ParameterKey,
                                          value,
                                        )
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select true or false" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="true">True</SelectItem>
                                        <SelectItem value="false">False</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <div className="relative">
                                      <Input
                                        id={fieldKey}
                                        type={
                                          isSecure && !isMasked
                                            ? "password"
                                            : param.DataType === "number" || param.DataType === "integer"
                                            ? "number"
                                            : "text"
                                        }
                                        value={
                                          isSecure && isMasked && currentValue 
                                            ? "••••••••" 
                                            : currentValue
                                        }
                                        onChange={(e) =>
                                          updateConfiguration(
                                            config.iflowId,
                                            param.ParameterKey,
                                            e.target.value,
                                          )
                                        }
                                        onFocus={(e) => {
                                          if (isSecure && isMasked) {
                                            e.target.value = currentValue;
                                          }
                                        }}
                                        placeholder={`Enter ${param.ParameterKey} for ${selectedEnvironment}`}
                                        className="w-full"
                                      />
                                      {isSecure && (
                                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                          {currentValue ? (
                                            <Lock className="w-4 h-4 text-gray-400" />
                                          ) : (
                                            <Unlock className="w-4 h-4 text-gray-400" />
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  
                                  {/* Show current vs default value comparison */}
                                  {param.ParameterValue && 
                                   param.ParameterValue !== currentValue && (
                                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                                      <div className="flex items-center space-x-2">
                                        <AlertTriangle className="w-4 h-4 text-yellow-600" />
                                        <span className="font-medium">Default value:</span>
                                        <code className="bg-gray-100 px-1 rounded">{param.ParameterValue}</code>
                                      </div>
                                    </div>
                                  )}

                                  {/* Show validation errors */}
                                  {param.Mandatory && (!currentValue || currentValue.trim() === "") && (
                                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm">
                                      <div className="flex items-center space-x-2 text-red-600">
                                        <AlertCircle className="w-4 h-4" />
                                        <span>This field is required</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Configuration Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {environments.find((e) => e.id === selectedEnvironment)?.name}
              </div>
              <div className="text-sm text-gray-600">Target Environment</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {iflowConfigurations.length}
              </div>
              <div className="text-sm text-gray-600">Total iFlows</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {getTotalParametersCount()}
              </div>
              <div className="text-sm text-gray-600">Total Parameters</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {getConfiguredParametersCount()}/{getTotalParametersCount()}
              </div>
              <div className="text-sm text-gray-600">Configured</div>
            </div>

            <div className="text-center">
              <div className={`text-2xl font-bold ${getComplianceScore() >= 80 ? 'text-green-600' : getComplianceScore() >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                {getComplianceScore()}%
              </div>
              <div className="text-sm text-gray-600">Compliance</div>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Configuration Progress</span>
              <span>{getComplianceScore()}% Complete</span>
            </div>
            <Progress 
              value={getComplianceScore()} 
              className="w-full"
            />
          </div>

          {/* Configuration History */}
          {configurationHistory.length > 0 && (
            <div className="mt-4">
              <Separator className="my-4" />
              <div className="flex items-center space-x-2 mb-2">
                <History className="w-4 h-4" />
                <span className="text-sm font-medium">Recent Saves</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {configurationHistory.slice(0, 3).map((history, index) => (
                  <div key={index} className="p-2 bg-gray-50 rounded text-xs">
                    <div className="font-medium">{history.environment}</div>
                    <div className="text-gray-600">{new Date(history.timestamp).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
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
          <span>Previous: iFlow Selection</span>
        </Button>

        <div className="flex space-x-4">
          {/* Save button that ONLY saves, no navigation */}
          <Button
            onClick={() => saveConfigurations(false)}
            disabled={saving || getTotalParametersCount() === 0}
            variant="outline"
            className="flex items-center space-x-2"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{saving ? "Saving..." : "Save Configuration"}</span>
          </Button>

          {/* Next button that ONLY navigates */}
          <Button
            onClick={handleNext}
            disabled={getTotalParametersCount() === 0}
            className="flex items-center space-x-2"
          >
            <span>Next: Design Validation</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Unsaved Changes Warning */}
      {unsavedChanges && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            You have unsaved changes. {autoSave ? "Auto-save is enabled." : "Don't forget to save your changes."}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default Stage3Configuration;