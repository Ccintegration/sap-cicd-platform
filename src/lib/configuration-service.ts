// src/lib/configuration-service.ts
// Enhanced service for handling configuration API calls

export interface ConfigurationParameter {
  ParameterKey: string;
  ParameterValue: string;
  DataType: string;
  Description?: string;
  Mandatory?: boolean;
}

export interface IFlowConfigurationResponse {
  success: boolean;
  data?: {
    name: string;
    version: string;
    parameters: ConfigurationParameter[];
    total_parameters?: number;
    error?: string;
  };
  message?: string;
  timestamp?: string;
}

export class ConfigurationService {
  private static readonly BASE_URL = 'http://localhost:8000';
  
  /**
   * Get configuration parameters for a specific iFlow
   */
  static async getIFlowConfigurations(
    iflowId: string, 
    version: string = 'active'
  ): Promise<ConfigurationParameter[]> {
    try {
      console.log(`🔧 [ConfigService] Fetching configurations for ${iflowId} v${version}`);
      
      const url = `${this.BASE_URL}/api/sap/iflows/${iflowId}/configurations?version=${version}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        // Add timeout
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      console.log(`🔧 [ConfigService] Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`🔧 [ConfigService] HTTP Error: ${response.status} - ${errorText}`);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error(`🔧 [ConfigService] Invalid content type: ${contentType}`);
        throw new Error('Invalid response format - expected JSON');
      }

      const result: IFlowConfigurationResponse = await response.json();
      console.log(`🔧 [ConfigService] API Response:`, result);

      if (!result.success) {
        const errorMsg = result.message || 'API returned unsuccessful response';
        console.error(`🔧 [ConfigService] API Error: ${errorMsg}`);
        throw new Error(errorMsg);
      }

      if (!result.data) {
        console.warn(`🔧 [ConfigService] No data in response for ${iflowId}`);
        return [];
      }

      const parameters = result.data.parameters || [];
      console.log(`🔧 [ConfigService] Loaded ${parameters.length} parameters for ${iflowId}`);

      // Validate and clean parameters
      const validatedParameters = parameters.map(param => ({
        ParameterKey: param.ParameterKey || '',
        ParameterValue: param.ParameterValue || '',
        DataType: param.DataType || 'string',
        Description: param.Description || '',
        Mandatory: Boolean(param.Mandatory),
      }));

      return validatedParameters;

    } catch (error) {
      console.error(`🔧 [ConfigService] Error fetching configurations for ${iflowId}:`, error);
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error - unable to connect to backend API');
      }
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Unknown error occurred while fetching configurations');
    }
  }

  /**
   * Save configuration parameters to backend
   */
  static async saveConfigurations(configData: {
    environment: string;
    timestamp: string;
    iflows: Array<{
      iflowId: string;
      iflowName: string;
      version: string;
      configurations: Record<string, string>;
    }>;
  }): Promise<boolean> {
    try {
      console.log('💾 [ConfigService] Saving configurations:', configData);

      const response = await fetch(`${this.BASE_URL}/api/save-iflow-configurations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configData),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`💾 [ConfigService] Save failed: ${response.status} - ${errorText}`);
        throw new Error(`Failed to save configurations: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('💾 [ConfigService] Save result:', result);

      return result.success || false;

    } catch (error) {
      console.error('💾 [ConfigService] Error saving configurations:', error);
      throw error;
    }
  }

  /**
   * Test if the configuration API is accessible
   */
  static async testConfigurationAPI(): Promise<boolean> {
    try {
      const response = await fetch(`${this.BASE_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });

      return response.ok;
    } catch (error) {
      console.error('🔧 [ConfigService] API test failed:', error);
      return false;
    }
  }

  /**
   * Debug endpoint to check API response format
   */
  static async debugConfiguration(iflowId: string, version: string = 'active'): Promise<any> {
    try {
      const response = await fetch(
        `${this.BASE_URL}/api/sap/iflows/${iflowId}/configurations/debug?version=${version}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(30000),
        }
      );

      if (!response.ok) {
        throw new Error(`Debug request failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('🔧 [ConfigService] Debug request failed:', error);
      throw error;
    }
  }

  /**
   * Batch load configurations for multiple iFlows
   */
  static async batchLoadConfigurations(
    iflows: Array<{ id: string; name: string; version?: string }>
  ): Promise<Array<{
    iflowId: string;
    iflowName: string;
    version: string;
    parameters: ConfigurationParameter[];
    error?: string;
  }>> {
    console.log(`🔧 [ConfigService] Batch loading configurations for ${iflows.length} iFlows`);

    const results = await Promise.allSettled(
      iflows.map(async (iflow) => {
        try {
          const parameters = await this.getIFlowConfigurations(iflow.id, iflow.version);
          return {
            iflowId: iflow.id,
            iflowName: iflow.name,
            version: iflow.version || 'active',
            parameters,
          };
        } catch (error) {
          return {
            iflowId: iflow.id,
            iflowName: iflow.name,
            version: iflow.version || 'active',
            parameters: [],
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          iflowId: iflows[index].id,
          iflowName: iflows[index].name,
          version: iflows[index].version || 'active',
          parameters: [],
          error: result.reason?.message || 'Failed to load configuration',
        };
      }
    });
  }
}

// Enhanced error handling utility
export class ConfigurationError extends Error {
  constructor(
    message: string,
    public readonly iflowId?: string,
    public readonly statusCode?: number,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

// Retry utility for network operations
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      if (attempt === maxRetries) {
        throw lastError;
      }

      console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`, lastError.message);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Exponential backoff
      delay *= 2;
    }
  }

  throw lastError!;
}