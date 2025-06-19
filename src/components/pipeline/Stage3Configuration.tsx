// File Path: src/components/pipeline/Stage3Configuration.tsx
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
        setLoading(false);
        return;
      }

      console.log("Loading configurations for selected iFlows:", data.selectedIFlows);

      const configPromises = data.selectedIFlows.map(async (iflowId: string) => {
        try {
          // Find the iflow details to get version and name
          const iflowDetails = data.iflowDetails?.find(
            (iflow: any) => iflow.id === iflowId || iflow.Id === iflowId,
          );

          const iflowVersion = iflowDetails?.version || iflowDetails?.Version || "active";
          const iflowName = iflowDetails?.name || iflowDetails?.Name || `iFlow ${iflowId}`;

          console.log(`Loading configuration for ${iflowId} (${iflowName}) version ${iflowVersion}`);

          // Call backend API to get configuration parameters
          const response = await fetch(
            `http://localhost:8000/api/sap/iflows/${iflowId}/configurations?version=${iflowVersion}`
          );

          if (!response.ok) {
            console.warn(`Failed to load configuration for ${iflowId}: ${response.status}`);
            return {
              iflowId,
              iflowName,
              version: iflowVersion,
              parameters: [],
              environments: [],
            };
          }

          const result = await response.json();
          const parameters = result.data?.parameters || [];

          console.log(`Loaded ${parameters.length} parameters for ${iflowId}`);

          return {
            iflowId,
            iflowName,
            version: iflowVersion,
            parameters,
            environments: [],
          };
        } catch (error) {
          console.error(`Error loading configuration for ${iflowId}:`, error);
          
          const iflowDetails = data.iflowDetails?.find(
            (iflow: any) => iflow.id === iflowId || iflow.Id === iflowId,
          );

          return {
            iflowId,
            iflowName: iflowDetails?.name || iflowDetails?.Name || `iFlow ${iflowId}`,
            version: iflowDetails?.version || iflowDetails?.Version || "active",
            parameters: [],
            environments: [],
          };
        }
      });

      const configs = await Promise.all(configPromises);
      setIFlowConfigurations(configs);

    } catch (error) {
      console.error("Failed to load configurations:", error);
      setError("Failed to load configuration parameters from SAP tenant");
    } finally {
      setLoading(false);
    }
  };

  const loadConfigurationHistory = async () => {
    try {
      // Load configuration history from backend if available
      // This is a placeholder - implement backend API call
      const history: ConfigurationHistory[] = [];
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
      const response = await fetch('http://localhost:8000/api/save-iflow-configurations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configurationData),
      });

      if (!response.ok) {
        throw new Error(`Failed to save configurations: ${response.status}`);
      }

      const result = await response.json();
      console.log("✅ Configurations saved successfully to backend:", result);

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
        console.log("✅ Configurations saved successfully to CSV files on server");

        // Auto-hide success message after 3 seconds
        setTimeout(() => setSaveSuccess(false), 3000);
      }

      setUnsavedChanges(false);
      await loadConfigurationHistory();

    } catch (error) {
      console.error("Failed to save configurations:", error);
      setError(`Failed to save configurations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      if (!isAutoSave) setSaving(false);
    }
  };

  const handleEnvironmentChange = (environment: string) => {
    setSelectedEnvironment(environment);
    
    // Load existing configurations for this environment
    if (data.configurations && data.configurations[environment]) {
      setConfigurationChanges(data.configurations[environment].configurations || {});
    } else {
      setConfigurationChanges({});
    }
    setUnsavedChanges(false);
  };

  // FIXED: handleNext function that ONLY navigates, NO API calls
  const handleNext = () => {
    console.log("🚀 [Stage3] Next button clicked - navigating to validation stage");
    
    // Update pipeline data with current configuration state
    const environmentConfigs = {
      environment: selectedEnvironment,
      configurations: configurationChanges,
      timestamp: new Date().toISOString(),
    };

    // Pass data to next stage WITHOUT making any API calls
    onComplete({
      ...data,
      configurations: {
        ...data.configurations,
        [selectedEnvironment]: environmentConfigs,
      },
      currentEnvironmentConfigs: environmentConfigs,
    });

    // Navigate to next stage
    onNext();
  };

  const getTotalParametersCount = () => {
    return iflowConfigurations.reduce((total, config) => total + config.parameters.length, 0);
  };

  const getConfiguredParametersCount = () => {
    let configured = 0;
    iflowConfigurations.forEach((config) => {
      config.parameters.forEach((param) => {
        const currentValue = configurationChanges[config.iflowId]?.[param.ParameterKey] || param.ParameterValue;
        if (currentValue && currentValue.trim() !== "") {
          configured++;
        }
      });
    });
    return configured;
  };

  const getComplianceScore = () => {
    const total = getTotalParametersCount();
    if (total === 0) return 0;
    return Math.round((getConfiguredParametersCount() / total) * 100);
  };

  const filteredConfigurations = iflowConfigurations.map((config) => ({
    ...config,
    parameters: config.parameters.filter((param) => {
      const currentValue = configurationChanges[config.iflowId]?.[param.ParameterKey] || param.ParameterValue;
      
      // Search filter
      const matchesSearch = !searchQuery || 
        param.ParameterKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (param.Description || "").toLowerCase().includes(searchQuery.toLowerCase());
      
      // Data type filter
      const matchesDataType = filterDataType === "all" || param.DataType === filterDataType;
      
      // Mandatory filter
      const matchesMandatory = !showMandatoryOnly || param.Mandatory;
      
      // Empty filter
      const matchesEmpty = !showEmptyOnly || !currentValue || currentValue.trim() === "";
      
      return matchesSearch && matchesDataType && matchesMandatory && matchesEmpty;
    }),
  })).filter(config => config.parameters.length > 0);

  const handleBulkUpdate = (iflowId: string, updates: Record<string, string>) => {
    setConfigurationChanges((prev) => ({
      ...prev,
      [iflowId]: {
        ...prev[iflowId],
        ...updates,
      },
    }));
    setUnsavedChanges(true);
  };

  const maskField = (fieldId: string) => {
    const newMasked = new Set(maskedFields);
    if (newMasked.has(fieldId)) {
      newMasked.delete(fieldId);
    } else {
      newMasked.add(fieldId);
    }
    setMaskedFields(newMasked);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">
            Loading configuration parameters from SAP Integration Suite...
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Frontend → Backend API → SAP Integration Suite
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-purple-900 bg-clip-text text-transparent">
            Configuration Management
          </h2>
          <p className="text-gray-600 mt-1">
            Configure environment-specific parameters for your selected integration flows
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          Step 3 of 8
        </Badge>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Success Alert */}
      {saveSuccess && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            ✅ Configurations saved successfully to CSV files on the server!
          </AlertDescription>
        </Alert>
      )}

      {/* Environment Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Globe className="w-5 h-5 text-blue-600" />
            <span>Target Environment</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {environments.map((env) => (
              <div
                key={env.id}
                onClick={() => handleEnvironmentChange(env.id)}
                className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 ${
                  selectedEnvironment === env.id
                    ? "border-blue-300 bg-blue-50 shadow-lg"
                    : "border-gray-200 hover:border-gray-300 hover:shadow-md"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">{env.name}</h3>
                  <Badge className={env.color}>{env.id}</Badge>
                </div>
                <p className="text-sm text-gray-600">{env.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filters and Tools */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-purple-600" />
            <span>Configuration Tools</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search parameters..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            {/* Data Type Filter */}
            <Select value={filterDataType} onValueChange={setFilterDataType}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by data type" />
              </SelectTrigger>
              <SelectContent>
                {dataTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type === "all" ? "All Data Types" : type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Toggle Filters */}
            <div className="flex items-center space-x-2">
              <Switch
                checked={showMandatoryOnly}
                onCheckedChange={setShowMandatoryOnly}
              />
              <Label className="text-sm">Mandatory Only</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                checked={showEmptyOnly}
                onCheckedChange={setShowEmptyOnly}
              />
              <Label className="text-sm">Empty Values Only</Label>
            </div>
          </div>
          
          {/* Auto-save toggle */}
          <div className="flex items-center space-x-2 mt-4">
            <Switch
              checked={autoSave}
              onCheckedChange={setAutoSave}
            />
            <Label className="text-sm">Enable Auto-save (every 30 seconds)</Label>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Parameters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-green-600" />
            <span>Configuration Parameters</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredConfigurations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Settings className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No configuration parameters found</p>
              <p className="text-sm">
                {iflowConfigurations.length === 0
                  ? "Please select integration flows in the previous step"
                  : "Try adjusting your search filters"}
              </p>
            </div>
          ) : (
            <Tabs defaultValue={filteredConfigurations[0]?.iflowId} className="w-full">
              <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${filteredConfigurations.length}, 1fr)` }}>
                {filteredConfigurations.map((config) => (
                  <TabsTrigger key={config.iflowId} value={config.iflowId} className="text-sm">
                    <div className="flex flex-col items-center">
                      <span className="truncate max-w-[100px]">{config.iflowName}</span>
                      <Badge variant="secondary" className="mt-1 text-xs">
                        {config.parameters.length} params
                      </Badge>
                    </div>
                  </TabsTrigger>
                ))}
              </TabsList>

              {filteredConfigurations.map((config) => (
                <TabsContent key={config.iflowId} value={config.iflowId} className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-medium text-gray-900 mb-2">
                      {config.iflowName} (v{config.version})
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                      <p><strong>iFlow ID:</strong> {config.iflowId}</p>
                      <p><strong>Version:</strong> {config.version}</p>
                      <p><strong>Environment:</strong> {selectedEnvironment}</p>
                      <p><strong>Parameters:</strong> {config.parameters.length}</p>
                    </div>
                  </div>

                  {config.parameters.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Info className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <p>No configuration parameters available for this iFlow</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="font-medium">Configuration Parameters</h4>
                        <div className="text-sm text-gray-500">
                          {config.parameters.filter(p => {
                            const currentValue = configurationChanges[config.iflowId]?.[p.ParameterKey] || p.ParameterValue;
                            return currentValue && currentValue.trim() !== "";
                          }).length} of {config.parameters.length} configured
                        </div>
                      </div>

                      <div className="space-y-4">
                        {config.parameters.map((param) => {
                          const fieldId = `${config.iflowId}-${param.ParameterKey}`;
                          const ismasked = maskedFields.has(fieldId);
                          const currentValue = configurationChanges[config.iflowId]?.[param.ParameterKey] || param.ParameterValue;
                          const isSecure = param.DataType === "secureParameter" || param.DataType === "password";
                          const isEmpty = !currentValue || currentValue.trim() === "";
                          const isRequired = param.Mandatory;

                          return (
                            <div
                              key={param.ParameterKey}
                              className={`border rounded-lg p-4 ${
                                isRequired && isEmpty
                                  ? "border-red-200 bg-red-50"
                                  : "border-gray-200 hover:border-gray-300"
                              }`}
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 mb-1">
                                    <Label className="font-medium" htmlFor={fieldId}>
                                      {param.ParameterKey}
                                    </Label>
                                    {isRequired && (
                                      <Badge variant="destructive" className="text-xs">
                                        Required
                                      </Badge>
                                    )}
                                    <Badge variant="outline" className="text-xs">
                                      {param.DataType}
                                    </Badge>
                                  </div>
                                  {param.Description && (
                                    <p className="text-sm text-gray-600 mb-2">
                                      {param.Description}
                                    </p>
                                  )}
                                </div>
                                {isSecure && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => maskField(fieldId)}
                                        >
                                          {ismasked ? (
                                            <EyeOff className="w-4 h-4" />
                                          ) : (
                                            <Eye className="w-4 h-4" />
                                          )}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {ismasked ? "Show value" : "Hide value"}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>

                              <div className="space-y-2">
                                {param.DataType === "boolean" ? (
                                  <Select
                                    value={currentValue || ""}
                                    onValueChange={(value) =>
                                      updateConfiguration(config.iflowId, param.ParameterKey, value)
                                    }
                                  >
                                    <SelectTrigger id={fieldId}>
                                      <SelectValue placeholder="Select value" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="true">True</SelectItem>
                                      <SelectItem value="false">False</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : param.DataType === "text" || param.DataType === "longtext" ? (
                                  <Textarea
                                    id={fieldId}
                                    value={currentValue || ""}
                                    onChange={(e) =>
                                      updateConfiguration(config.iflowId, param.ParameterKey, e.target.value)
                                    }
                                    placeholder={`Enter ${param.ParameterKey}...`}
                                    rows={3}
                                    className="resize-y"
                                  />
                                ) : (
                                  <Input
                                    id={fieldId}
                                    type={isSecure ? (ismasked ? "password" : "text") : "text"}
                                    value={currentValue || ""}
                                    onChange={(e) =>
                                      updateConfiguration(config.iflowId, param.ParameterKey, e.target.value)
                                    }
                                    placeholder={`Enter ${param.ParameterKey}...`}
                                    className={isRequired && isEmpty ? "border-red-300" : ""}
                                  />
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
              ))}
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