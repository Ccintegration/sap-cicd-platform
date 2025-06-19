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
  Loader2,
  XCircle,
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
  loadingError?: string;
  isLoading?: boolean;
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
  const [iflowConfigurations, setIFlowConfigurations] = useState<IFlowConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [selectedEnvironment, setSelectedEnvironment] = useState("development");
  const [configurationChanges, setConfigurationChanges] = useState<Record<string, Record<string, string>>>({});
  const [importingConfigs, setImportingConfigs] = useState(false);
  const [exportingConfigs, setExportingConfigs] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyMandatory, setShowOnlyMandatory] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [configurationHistory, setConfigurationHistory] = useState<ConfigurationHistory[]>([]);
  const [unsavedChanges, setUnsavedChanges] = useState(false);

  useEffect(() => {
    loadConfigurations();
  }, [data.selectedIFlows]);

  const loadConfigurations = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!data.selectedIFlows || data.selectedIFlows.length === 0) {
        setError("No integration flows selected. Please go back and select iFlows.");
        setLoading(false);
        return;
      }

      console.log("🔧 [Stage3] Loading configurations for selected iFlows:", data.selectedIFlows);

      // Create initial configuration objects with loading state
      const initialConfigs: IFlowConfiguration[] = data.selectedIFlows.map((iflowId: string) => {
        const iflowDetails = data.iflowDetails?.find(
          (iflow: any) => iflow.id === iflowId || iflow.Id === iflowId
        );

        return {
          iflowId,
          iflowName: iflowDetails?.name || iflowDetails?.Name || `iFlow ${iflowId}`,
          version: iflowDetails?.version || iflowDetails?.Version || "active",
          parameters: [],
          environments: [],
          isLoading: true,
        };
      });

      setIFlowConfigurations(initialConfigs);

      // Load configurations for each iFlow
      const configPromises = data.selectedIFlows.map(async (iflowId: string, index: number) => {
        try {
          const iflowDetails = data.iflowDetails?.find(
            (iflow: any) => iflow.id === iflowId || iflow.Id === iflowId
          );

          const iflowVersion = iflowDetails?.version || iflowDetails?.Version || "active";
          const iflowName = iflowDetails?.name || iflowDetails?.Name || `iFlow ${iflowId}`;

          console.log(`🔧 [Stage3] Loading configuration for ${iflowId} (${iflowName}) version ${iflowVersion}`);

          // Call backend API to get configuration parameters
          const response = await fetch(
            `http://localhost:8000/api/sap/iflows/${iflowId}/configurations?version=${iflowVersion}`,
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
              },
            }
          );

          console.log(`🔧 [Stage3] API Response status for ${iflowId}: ${response.status}`);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const result = await response.json();
          console.log(`🔧 [Stage3] API Response for ${iflowId}:`, result);

          let parameters: ConfigurationParameter[] = [];
          
          if (result.success && result.data) {
            parameters = result.data.parameters || [];
            console.log(`🔧 [Stage3] Loaded ${parameters.length} parameters for ${iflowId}`);
          } else {
            console.warn(`🔧 [Stage3] API returned unsuccessful response for ${iflowId}:`, result);
            if (result.message) {
              throw new Error(result.message);
            }
          }

          // Update the specific iFlow configuration
          setIFlowConfigurations(prev => 
            prev.map((config, i) => 
              i === index 
                ? {
                    ...config,
                    parameters,
                    isLoading: false,
                    loadingError: undefined,
                  }
                : config
            )
          );

          return {
            iflowId,
            iflowName,
            version: iflowVersion,
            parameters,
            environments: [],
          };

        } catch (error) {
          console.error(`🔧 [Stage3] Error loading configuration for ${iflowId}:`, error);
          
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          
          // Update the specific iFlow configuration with error
          setIFlowConfigurations(prev => 
            prev.map((config, i) => 
              i === index 
                ? {
                    ...config,
                    parameters: [],
                    isLoading: false,
                    loadingError: errorMessage,
                  }
                : config
            )
          );

          return null;
        }
      });

      await Promise.all(configPromises);

    } catch (error) {
      console.error("🔧 [Stage3] Failed to load configurations:", error);
      setError("Failed to load configuration parameters from SAP tenant");
    } finally {
      setLoading(false);
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
        iflows: iflowConfigurations.map(config => ({
          iflowId: config.iflowId,
          iflowName: config.iflowName,
          version: config.version,
          configurations: configurationChanges[config.iflowId] || {},
        })).filter(config => Object.keys(config.configurations).length > 0)
      };

      console.log("💾 [Stage3] Saving configurations:", configurationData);

      const response = await fetch('http://localhost:8000/api/save-iflow-configurations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configurationData),
      });

      if (!response.ok) {
        throw new Error(`Failed to save configurations: ${response.statusText}`);
      }

      const result = await response.json();
      console.log("💾 [Stage3] Save result:", result);

      setSaveSuccess(true);
      setUnsavedChanges(false);
      
      if (!isAutoSave) {
        // Show success message for manual saves
        setTimeout(() => setSaveSuccess(false), 3000);
      }

    } catch (error) {
      console.error("💾 [Stage3] Failed to save configurations:", error);
      setError(error instanceof Error ? error.message : 'Failed to save configurations');
    } finally {
      if (!isAutoSave) setSaving(false);
    }
  };

  const handleNext = () => {
    // Save current configurations and move to next stage
    onComplete({ 
      configurations: configurationChanges,
      selectedEnvironment,
      iflowConfigurations 
    });
    onNext();
  };

  const exportConfigurations = async () => {
    setExportingConfigs(true);
    try {
      const exportData = {
        environment: selectedEnvironment,
        timestamp: new Date().toISOString(),
        configurations: configurationChanges,
        iflows: iflowConfigurations,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `iflow-configurations-${selectedEnvironment}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      setError('Failed to export configurations');
    } finally {
      setExportingConfigs(false);
    }
  };

  const filteredConfigurations = iflowConfigurations.filter(config => {
    if (!searchQuery) return true;
    return (
      config.iflowName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      config.iflowId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      config.parameters.some(param => 
        param.ParameterKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
        param.Description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  });

  const getTotalParameters = () => {
    return iflowConfigurations.reduce((total, config) => total + config.parameters.length, 0);
  };

  const getConfiguredParameters = () => {
    return Object.values(configurationChanges).reduce(
      (total, configs) => total + Object.keys(configs).length,
      0
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading configuration parameters from SAP tenant...</p>
          <div className="mt-4 space-y-2">
            {iflowConfigurations.map(config => (
              <div key={config.iflowId} className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                {config.isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Loading {config.iflowName}...</span>
                  </>
                ) : config.loadingError ? (
                  <>
                    <XCircle className="w-4 h-4 text-red-500" />
                    <span>Failed: {config.iflowName}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Loaded {config.iflowName} ({config.parameters.length} params)</span>
                  </>
                )}
              </div>
            ))}
          </div>
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
              <Settings className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Failed to Load Configurations
              </h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <div className="space-x-2">
                <Button onClick={loadConfigurations} variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry
                </Button>
                <Button onClick={onPrevious} variant="ghost">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Go Back
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <div>
                <h3 className="text-lg font-semibold flex items-center space-x-2">
                  <Settings className="w-5 h-5 text-blue-600" />
                  <span>Configuration Parameters</span>
                </h3>
                <p className="text-sm text-gray-600">
                  Configure parameters for {iflowConfigurations.length} integration flows
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="outline">
                  {getTotalParameters()} total parameters
                </Badge>
                <Badge variant={getConfiguredParameters() > 0 ? "default" : "secondary"}>
                  {getConfiguredParameters()} configured
                </Badge>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Select
                value={selectedEnvironment}
                onValueChange={setSelectedEnvironment}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="development">Development</SelectItem>
                  <SelectItem value="qa">QA</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={exportConfigurations}
                disabled={exportingConfigs}
              >
                {exportingConfigs ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span className="ml-2">Export</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => saveConfigurations(false)}
                disabled={saving || Object.keys(configurationChanges).length === 0}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span className="ml-2">Save</span>
              </Button>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search parameters, iFlows, or descriptions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="mandatory-only"
                checked={showOnlyMandatory}
                onCheckedChange={setShowOnlyMandatory}
              />
              <Label htmlFor="mandatory-only" className="text-sm">
                Mandatory only
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="show-passwords"
                checked={showPasswords}
                onCheckedChange={setShowPasswords}
              />
              <Label htmlFor="show-passwords" className="text-sm">
                Show passwords
              </Label>
            </div>
          </div>

          {/* Save Success Message */}
          {saveSuccess && (
            <Alert className="mt-4 border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                Configurations saved successfully for {selectedEnvironment} environment
              </AlertDescription>
            </Alert>
          )}

          {/* Unsaved Changes Warning */}
          {unsavedChanges && !saveSuccess && (
            <Alert className="mt-4 border-yellow-200 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-700">
                You have unsaved changes. Don't forget to save your configurations.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Configuration Forms */}
      <div className="space-y-6">
        {filteredConfigurations.map((config) => (
          <Card key={config.iflowId} className="border border-gray-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <Server className="w-5 h-5 text-blue-600" />
                    <span>{config.iflowName}</span>
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    ID: {config.iflowId} • Version: {config.version}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">
                    {config.parameters.length} parameters
                  </Badge>
                  {config.loadingError && (
                    <Badge variant="destructive">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Error
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {config.loadingError ? (
                <Alert className="border-red-200 bg-red-50">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-700">
                    Failed to load configuration parameters: {config.loadingError}
                  </AlertDescription>
                </Alert>
              ) : config.parameters.length === 0 ? (
                <div className="text-center py-8">
                  <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No configuration parameters found</p>
                  <p className="text-sm text-gray-500 mt-1">
                    This integration flow may not have configurable parameters
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {config.parameters
                    .filter(param => {
                      if (showOnlyMandatory && !param.Mandatory) return false;
                      if (!searchQuery) return true;
                      return (
                        param.ParameterKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        param.Description?.toLowerCase().includes(searchQuery.toLowerCase())
                      );
                    })
                    .map((parameter) => (
                      <div
                        key={parameter.ParameterKey}
                        className="p-4 border border-gray-200 rounded-lg space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <Label className="font-medium text-gray-900">
                                {parameter.ParameterKey}
                              </Label>
                              {parameter.Mandatory && (
                                <Badge variant="destructive" className="text-xs">
                                  Required
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-xs">
                                {parameter.DataType}
                              </Badge>
                            </div>
                            {parameter.Description && (
                              <p className="text-sm text-gray-600 mb-2">
                                {parameter.Description}
                              </p>
                            )}
                          </div>
                          
                          {parameter.ParameterKey.toLowerCase().includes('password') ||
                           parameter.ParameterKey.toLowerCase().includes('secret') ||
                           parameter.ParameterKey.toLowerCase().includes('key') ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="p-1">
                                    <Lock className="w-4 h-4 text-amber-500" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Sensitive parameter</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : null}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs text-gray-500 mb-1 block">
                              Current Value
                            </Label>
                            <div className="p-2 bg-gray-50 rounded border text-sm font-mono">
                              {parameter.ParameterValue || (
                                <span className="text-gray-400 italic">Not set</span>
                              )}
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500 mb-1 block">
                              New Value for {selectedEnvironment}
                            </Label>
                            {parameter.DataType === 'boolean' ? (
                              <Select
                                value={configurationChanges[config.iflowId]?.[parameter.ParameterKey] || parameter.ParameterValue || ''}
                                onValueChange={(value) =>
                                  updateConfiguration(config.iflowId, parameter.ParameterKey, value)
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select value" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="true">True</SelectItem>
                                  <SelectItem value="false">False</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : parameter.DataType === 'text' || parameter.ParameterKey.toLowerCase().includes('description') ? (
                              <Textarea
                                value={configurationChanges[config.iflowId]?.[parameter.ParameterKey] || parameter.ParameterValue || ''}
                                onChange={(e) =>
                                  updateConfiguration(config.iflowId, parameter.ParameterKey, e.target.value)
                                }
                                placeholder={`Enter ${parameter.ParameterKey}`}
                                rows={3}
                              />
                            ) : (
                              <Input
                                type={
                                  parameter.ParameterKey.toLowerCase().includes('password') ||
                                  parameter.ParameterKey.toLowerCase().includes('secret') ||
                                  parameter.ParameterKey.toLowerCase().includes('key')
                                    ? showPasswords ? 'text' : 'password'
                                    : parameter.DataType === 'number' ? 'number'
                                    : 'text'
                                }
                                value={configurationChanges[config.iflowId]?.[parameter.ParameterKey] || parameter.ParameterValue || ''}
                                onChange={(e) =>
                                  updateConfiguration(config.iflowId, parameter.ParameterKey, e.target.value)
                                }
                                placeholder={`Enter ${parameter.ParameterKey}`}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                  {config.parameters.filter(param => {
                    if (showOnlyMandatory && !param.Mandatory) return false;
                    if (!searchQuery) return true;
                    return (
                      param.ParameterKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      param.Description?.toLowerCase().includes(searchQuery.toLowerCase())
                    );
                  }).length === 0 && (
                    <div className="text-center py-4">
                      <p className="text-gray-600">No parameters match your search criteria</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {filteredConfigurations.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No integration flows match your search criteria</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={onPrevious}
          className="flex items-center space-x-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Previous</span>
        </Button>

        <div className="flex items-center space-x-4">
          {unsavedChanges && (
            <Badge variant="outline" className="px-3 py-1 border-yellow-300 text-yellow-700">
              Unsaved changes
            </Badge>
          )}
          <Button
            onClick={handleNext}
            className="flex items-center space-x-2"
          >
            <span>Next: Validation</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-700">
            {error}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default Stage3Configuration;