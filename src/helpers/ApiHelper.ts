import axios, { AxiosError } from "axios";
import * as Sentry from "@sentry/react-native";

interface ApiConfig {
  keyName: string;
  url: string;
  jwt: string;
  permisssions: string[];
}

// Custom error class to ensure we always have a proper error code for React Native bridge
class ApiError extends Error {
  code: string;
  originalError?: Error;

  constructor(message: string, code: string = "API_ERROR", originalError?: Error) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.originalError = originalError;
  }
}

class ApiHelperClass {
  public apiConfigs: ApiConfig[] = [];

  private getConfig(keyName: string): ApiConfig {
    const config = this.apiConfigs.find(c => c.keyName === keyName);
    if (!config) throw new ApiError(`API config not found: ${keyName}`, "CONFIG_NOT_FOUND");
    return config;
  }

  private handleError(error: unknown, context: string): never {
    // Ensure we always have a proper error with a code to prevent NullPointerException
    // in React Native's PromiseImpl.reject when error code is null
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const code = axiosError.code || "NETWORK_ERROR";
      const message = axiosError.message || "Network request failed";

      // Log to Sentry with additional context
      Sentry.addBreadcrumb({
        category: "api",
        message: `API Error in ${context}: ${message}`,
        level: "error",
        data: {
          code,
          url: axiosError.config?.url,
          status: axiosError.response?.status
        }
      });

      throw new ApiError(message, code, axiosError);
    }

    if (error instanceof Error) {
      throw new ApiError(error.message, "UNKNOWN_ERROR", error);
    }

    throw new ApiError(String(error), "UNKNOWN_ERROR");
  }

  async get(path: string, keyName: string): Promise<any> {
    try {
      const config = this.getConfig(keyName);
      const response = await axios.get(config.url + path, { timeout: 30000 });  // 30 second timeout to prevent ANR
      return response.data;
    } catch (error) {
      this.handleError(error, `GET ${path}`);
    }
  }

  async getAnonymous(path: string, keyName: string): Promise<any> {
    try {
      const config = this.getConfig(keyName);
      const response = await axios.get(config.url + path, { timeout: 30000 });  // 30 second timeout to prevent ANR
      return response.data;
    } catch (error) {
      this.handleError(error, `GET_ANON ${path}`);
    }
  }

  async post(path: string, data: any, keyName: string): Promise<any> {
    try {
      const config = this.getConfig(keyName);
      const fullUrl = config.url + path;
      console.log("POST request to:", fullUrl);
      const response = await axios.post(fullUrl, data, { timeout: 30000 });  // 30 second timeout to prevent ANR
      return response.data;
    } catch (error) {
      this.handleError(error, `POST ${path}`);
    }
  }
}

export const ApiHelper = new ApiHelperClass();
