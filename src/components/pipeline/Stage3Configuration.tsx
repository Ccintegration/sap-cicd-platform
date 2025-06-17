import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [selectedEnvironment, setSelectedEnvironment] = useState("development");
  const [configurationChanges, setConfigurationChanges] = useState<
    Record<string, Record<string, string>>
  >({});

  const environments = [
    {
      id: "development",
      name: "Development",
      color: "bg-blue-100 text-blue-800",
    },
    { id: "testing", name: "Testing", color: "bg-yellow-100 text-yellow-800" },
    {
      id: "production",
      name: "Production",
      color: "bg-green-100 text-green-800",
    },
  ];

  useEffect(() => {
    loadConfigurations();
  }, [data.selectedIFlows]);

  const loadConfigurations = async () => {
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

      console.log('Loading configurations for iFlows:', data.selectedIFlows);
      console.log('iFlow details available:', data.iflowDetails);

      const configurationsPromises = data.selectedIFlows.map(
        async (iflowId: string) => {
          try {
            // Find the iflow details from previous stage data
            const iflowDetails = data.iflowDetails?.find(
              (iflow: any) => iflow.id === iflowId || iflow.Id === iflowId,
            );
            
            // Use the actual version from iflow details, fallback to 'active'
            const iflowVersion = iflowDetails?.version || iflowDetails?.Version || "active";
            const iflowName = iflowDetails?.name || iflowDetails?.Name || `iFlow ${iflowId}`;

            console.log(`Fetching configurations for iFlow: ${iflowId}, version: ${iflowVersion}`);

            // Make API call to backend for configuration parameters
            const backendUrl = `http://localhost:8000/api/sap/iflows/${iflowId}/configurations?version=${iflowVersion}`;
            const response = await fetch(backendUrl);

            if (!response.ok) {
              throw new Error(`Failed to fetch configurations for ${iflowId}: ${response.status}`);
            }

            const result = await response.json();
            
            const parameters = result.data || [];
            console.log(`Found ${parameters.length} parameters for ${iflowId}:`, parameters);

            return {
              iflowId,
              iflowName,
              version: iflowVersion,
              parameters,
              environments: environments.map((env) => ({
                environment: env.id,
                configurations: {},
              })),
            };
          } catch (error) {
            console.error(
              `Failed to load configurations for ${iflowId}:`,
              error,
            );
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

  const updateConfiguration = (
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
  };

  const saveConfigurations = async () => {
    setSaving(true);
    try {
      // Save configurations for the selected environment
      const environmentConfigs = {
        environment: selectedEnvironment,
        configurations: configurationChanges,
        timestamp: new Date().toISOString(),
      };

      // Store in pipeline data for later stages
      onComplete({
        ...data,
        configurations: {
          ...data.configurations,
          [selectedEnvironment]: environmentConfigs,
        },
        currentEnvironmentConfigs: environmentConfigs,
      });

      console.log("Configurations saved for", selectedEnvironment);
    } catch (error) {
      console.error("Failed to save configurations:", error);
      setError("Failed to save configurations");
    } finally {
      setSaving(false);
    }
  };

  const handleNext = () => {
    // Save configurations before proceeding
    saveConfigurations();
    
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
    
    onNext();
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

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center p-8">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mr-3" />
          <span className="text-lg">Loading configuration parameters...</span>
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
            <div className="mt-4 space-y-2">
              <Button onClick={loadConfigurations} className="mr-2">
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
              <div className="text-sm text-gray-600">
                <p><strong>Expected iFlows:</strong> {data.selectedIFlows?.join(', ') || 'None'}</p>
                <p><strong>Available iFlow Details:</strong> {data.iflowDetails?.length || 0} items</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-0 shadow-lg bg-gradient-to-r from-purple-50 to-indigo-50">
        <CardHeader>
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-purple-100 rounded-full">
              <Settings className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <CardTitle className="text-2xl text-purple-800">
                Environment Configuration
              </CardTitle>
              <p className="text-purple-600 mt-1">
                Configure environment-specific settings for your selected
                iFlows. These settings will be applied during deployment.
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <FileText className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-sm text-gray-600">iFlows to Configure</p>
                <p className="text-2xl font-bold text-blue-600">
                  {iflowConfigurations.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Settings className="w-8 h-8 text-orange-500" />
              <div>
                <p className="text-sm text-gray-600">Total Parameters</p>
                <p className="text-2xl font-bold text-orange-600">
                  {getTotalParametersCount()}
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
                <p className="text-sm text-gray-600">Configured</p>
                <p className="text-2xl font-bold text-green-600">
                  {getConfiguredParametersCount()}/{getTotalParametersCount()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Target Environment Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Globe className="w-5 h-5" />
            <span>Target Environment</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {environments.map((env) => (
              <div
                key={env.id}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedEnvironment === env.id
                    ? "border-purple-300 bg-purple-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                onClick={() => setSelectedEnvironment(env.id)}
              >
                <div className="text-center">
                  <Badge className={env.color}>{env.name}</Badge>
                  <p className="text-sm text-gray-600 mt-2">
                    {env.id}.company.com
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* iFlow Configurations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="w-5 h-5" />
            <span>iFlow Configurations</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {iflowConfigurations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Settings className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No iFlow configurations available</p>
              <p className="text-sm">Please ensure iFlows are selected in the previous stage</p>
            </div>
          ) : (
            <Tabs
              defaultValue={iflowConfigurations[0]?.iflowId}
              className="w-full"
            >
              <TabsList
                className="grid w-full"
                style={{
                  gridTemplateColumns: `repeat(${iflowConfigurations.length}, 1fr)`,
                }}
              >
                {iflowConfigurations.map((config) => (
                  <TabsTrigger
                    key={config.iflowId}
                    value={config.iflowId}
                    className="text-sm"
                  >
                    <div className="flex flex-col items-center">
                      <span className="truncate">{config.iflowName}</span>
                      <Badge variant="secondary" className="mt-1 text-xs">
                        {config.parameters.length} params
                      </Badge>
                    </div>
                  </TabsTrigger>
                ))}
              </TabsList>

              {iflowConfigurations.map((config) => (
                <TabsContent
                  key={config.iflowId}
                  value={config.iflowId}
                  className="space-y-4"
                >
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-medium text-gray-900 mb-2">
                      {config.iflowName}
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                      <p>
                        <strong>ID:</strong> {config.iflowId}
                      </p>
                      <p>
                        <strong>Version:</strong> {config.version}
                      </p>
                      <p>
                        <strong>Environment:</strong> {selectedEnvironment}
                      </p>
                      <p>
                        <strong>Parameters:</strong> {config.parameters.length}
                      </p>
                    </div>
                  </div>

                  {config.parameters.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Settings className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>No configuration parameters found for this iFlow</p>
                      <p className="text-sm">This iFlow may not have any configurable parameters</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {config.parameters.map((param) => (
                        <div
                          key={param.ParameterKey}
                          className="p-4 border rounded-lg"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <Label
                                htmlFor={`${config.iflowId}-${param.ParameterKey}`}
                                className="font-medium"
                              >
                                {param.ParameterKey}
                                {param.Mandatory && (
                                  <span className="text-red-500 ml-1">*</span>
                                )}
                              </Label>
                              <p className="text-sm text-gray-600 mt-1">
                                Type: {param.DataType || "String"}
                              </p>
                              {param.Description && (
                                <p className="text-sm text-gray-500 mt-1">
                                  {param.Description}
                                </p>
                              )}
                            </div>

                            <div className="md:col-span-2">
                              {param.DataType === "xstring" ||
                              (param.Description &&
                                param.Description.toLowerCase().includes(
                                  "certificate",
                                )) ? (
                                <Textarea
                                  id={`${config.iflowId}-${param.ParameterKey}`}
                                  value={
                                    configurationChanges[config.iflowId]?.[
                                      param.ParameterKey
                                    ] || ""
                                  }
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
                              ) : (
                                <Input
                                  id={`${config.iflowId}-${param.ParameterKey}`}
                                  type={
                                    param.DataType === "secureParameter"
                                      ? "password"
                                      : "text"
                                  }
                                  value={
                                    configurationChanges[config.iflowId]?.[
                                      param.ParameterKey
                                    ] || ""
                                  }
                                  onChange={(e) =>
                                    updateConfiguration(
                                      config.iflowId,
                                      param.ParameterKey,
                                      e.target.value,
                                    )
                                  }
                                  placeholder={`Enter ${param.ParameterKey} for ${selectedEnvironment}`}
                                  className="w-full"
                                />
                              )}
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

      {/* Configuration Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              <strong>Target Environment:</strong>{" "}
              {environments.find((e) => e.id === selectedEnvironment)?.name}
            </p>
            <p className="text-sm text-gray-600">
              <strong>Total iFlows:</strong> {iflowConfigurations.length}
            </p>
            <p className="text-sm text-gray-600">
              <strong>Total Parameters:</strong> {getTotalParametersCount()}
            </p>
            <p className="text-sm text-gray-600">
              <strong>Configured Parameters:</strong>{" "}
              {getConfiguredParametersCount()}/{getTotalParametersCount()}
            </p>
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
          <span>Previous: iFlow Selection</span>
        </Button>

        <div className="flex space-x-4">
          <Button
            onClick={saveConfigurations}
            disabled={saving}
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

          <Button
            onClick={handleNext}
            className="flex items-center space-x-2"
          >
            <span>Next: Design Validation</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Stage3Configuration;