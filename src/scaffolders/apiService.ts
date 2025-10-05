import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Define types for better type safety
interface LoginCredentials {
  email: string;
  password: string;
  [key: string]: any;
}

interface AuthResponse {
  token: string;
  user: any;
  [key: string]: any;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type Framework = "next" | "react";
type AuthStorage = "localStorage" | "cookie" | null;

export async function scaffoldApiService(
  projectPath: string,
  language: "js" | "ts",
  authStorage?: AuthStorage,
  framework: Framework = "next"
): Promise<void> {
  const ext = language === "ts" ? "ts" : "js";
  const envVar = framework === 'next' ? 'NEXT_PUBLIC_API_URL' : 'VITE_API_URL';

  // Determine services directory based on framework
  const servicesDir = framework === "next"
    ? path.join(projectPath, 'lib')
    : path.join(projectPath, 'src', 'lib');

  // Ensure services directory exists
  if (!fs.existsSync(servicesDir)) {
    fs.mkdirSync(servicesDir, { recursive: true });
  }

  // Create API client file with both JS and TS versions
  let apiClientContent: string | undefined = undefined; // Initialize with empty string

  // IIFE to set up API client content
  apiClientContent = (() => {
    // Common imports and interfaces for TypeScript
    if (language === 'ts') {
      if (authStorage === 'localStorage') {
        return `"use client";

import axios, { AxiosResponse } from "axios";
import { objectToQueryString } from "./url";
import SystemRoutes from "./Routes";
import API_ENDPOINTS from "./apiEndpoints";
import { ApiResponse } from "@/types";

export interface ApiError {
  code: string;
  message: string;
  status: number;
  data: Record<string, any>;
}

type ApiVariables = Record<string, any>;

interface OptimisticUpdateParams<T> {
  updatedFields: T;
  currentFields: T;
  setLocalData: (data: T) => void;
}

const defaults = {
  baseURL: process.env.${envVar} || "http://api.example.com",
  error: {
    code: "INTERNAL_ERROR",
    message: "Something went wrong. Please check your internet connection or contact support.",
    status: 503,
    data: {},
  } as ApiError,
};

axios.defaults.withCredentials = true;
let hasTriedRefresh = false;

// ---------- LocalStorage Helpers ----------
const getStoredAuthToken = (): string | undefined => 
  typeof window !== 'undefined' ? localStorage.getItem("accessToken") || undefined : undefined;

const storeAuthToken = (token: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem("accessToken", token);
  }
};

const getRefreshToken = (): string | undefined => 
  typeof window !== 'undefined' ? localStorage.getItem("refreshToken") || undefined : undefined;

const storeRefreshToken = (token: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem("refreshToken", token);
  }
};

const removeTokens = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
  }
};

// ---------- Refresh Token ----------
const refreshToken = async (): Promise<any> => {
  try {
    const refreshTokenValue = getRefreshToken();
    if (!refreshTokenValue) throw new Error("No refresh token found");

    const response = await axios.post<ApiResponse<any>>(
      \`\${process.env.NEXT_PUBLIC_API_URL}\${API_ENDPOINTS.REFRESH_TOKEN}\`,
      { refreshToken: refreshTokenValue }
    );

    if (response.data?.data?.accessToken) storeAuthToken(response.data.data.accessToken);
    if (response.data?.data?.refreshToken) storeRefreshToken(response.data.data.refreshToken);

    return response.data;
  } catch (error: any) {
    console.error("Token refresh failed", error);
    removeTokens();
    if (typeof window !== 'undefined') {
      window.location.href = SystemRoutes.LOGIN;
    }
    throw error;
  }
};

// ---------- Helper ----------
function hasRefreshTokenCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.includes("refreshToken=");
}

// ---------- Main API ----------
const api = async <T>(
  method: "get" | "post" | "put" | "patch" | "delete",
  url: string,
  options?: { params?: ApiVariables; data?: ApiVariables; headers?: ApiVariables }
): Promise<T> => {
  try {
    const token = getStoredAuthToken();

    const response: AxiosResponse<T> = await axios({
      url: \`\${defaults.baseURL}\${url}\`,
      method,
      headers: {
        "Content-Type": "application/json",
        "Frontend-Path": typeof window !== 'undefined' ? window.location.pathname : '',
        ...(token ? { Authorization: \`Bearer \${token}\` } : {}),
        ...(options?.headers || {}),
      },
      params: options?.params,
      data: options?.data,
      paramsSerializer: objectToQueryString,
    });

    hasTriedRefresh = false;
    return response.data;
  } catch (error: any) {
    if (axios.isAxiosError(error) && error.response) {
      const status = error.response.status;

      if (status === 401 && !hasTriedRefresh && hasRefreshTokenCookie()) {
        try {
          hasTriedRefresh = true;
          await refreshToken();
          const retryToken = getStoredAuthToken();
          
          const retryResponse: AxiosResponse<T> = await axios({
            url: \`\${defaults.baseURL}\${url}\`,
            method,
            headers: {
              "Content-Type": "application/json",
              "Frontend-Path": typeof window !== 'undefined' ? window.location.pathname : '',
              ...(retryToken ? { Authorization: \`Bearer \${retryToken}\` } : {}),
              ...(options?.headers || {}),
            },
            params: options?.params,
            data: options?.data,
            paramsSerializer: objectToQueryString,
          });
          
          hasTriedRefresh = false;
          return retryResponse.data;
        } catch (refreshError) {
          console.error("Token refresh failed", refreshError);
          hasTriedRefresh = false;
          if (typeof window !== 'undefined') {
            window.location.href = SystemRoutes.LOGIN;
          }
          throw { message: "Session expired. Please log in again." };
        }
      }

      if (status === 402) console.warn("402 - Organization is out of tokens");
      throw { message: error?.response?.data?.message ?? "Unknown API error" };
    }
    throw defaults.error;
  }
};

// ---------- Optimistic Update ----------
const optimisticUpdate = async <T extends Record<string, any>>(
  url: string,
  { updatedFields, currentFields, setLocalData }: OptimisticUpdateParams<T>
): Promise<void> => {
  try {
    setLocalData(updatedFields);
    await api<T>("put", url, { data: updatedFields });
  } catch (error) {
    setLocalData(currentFields);
    console.error(error);
  }
};

// ---------- API Methods ----------
const apiMethods = {
  get: <T>(url: string, options?: { params?: ApiVariables }) => 
    api<T>("get", url, options),
  post: <T>(url: string, options?: { params?: any; data?: any; headers?: any }) => 
    api<T>("post", url, options),
  put: <T>(url: string, options?: { data?: any; params?: any }) => 
    api<T>("put", url, options),
  patch: <T>(url: string, options?: { data?: any }) => 
    api<T>("patch", url, options),
  delete: <T>(url: string, options?: { params?: any; data?: any }) => 
    api<T>("delete", url, options),
  optimisticUpdate,
};

export default apiMethods;

// ---------- FormData API ----------
const apiWithFormData = async <T>(
  method: "post" | "put" | "patch", 
  url: string, 
  formData: FormData
): Promise<T> => {
  try {
    const token = getStoredAuthToken();
    const response: AxiosResponse<T> = await axios({
      url: \`\${defaults.baseURL}\${url}\`,
      method,
      headers: { 
        "Content-Type": "multipart/form-data", 
        ...(token ? { Authorization: \`Bearer \${token}\` } : {}) 
      },
      data: formData,
    });
    return response.data;
  } catch (error: any) {
    if (axios.isAxiosError(error) && error.response) {
      if (error.response.status === 401 && typeof window !== 'undefined') {
        window.location.href = SystemRoutes.LOGIN;
      }
      throw { message: error?.response?.data?.message ?? "Unknown error" };
    }
    throw defaults.error;
  }
};

export const apiWithFormDataMethods = {
  post: <T>(url: string, formData: FormData) => 
    apiWithFormData<T>("post", url, formData),
  put: <T>(url: string, formData: FormData) => 
    apiWithFormData<T>("put", url, formData),
  patch: <T>(url: string, formData: FormData) => 
    apiWithFormData<T>("patch", url, formData),
};`;
      } else if (authStorage === 'cookie') {
        return `"use client";

import axios, { AxiosResponse } from "axios";
import { objectToQueryString } from "./url";
import SystemRoutes from "./Routes";
import API_ENDPOINTS from "./apiEndpoints";

export interface ApiError {
  code: string;
  message: string;
  status: number;
  data: Record<string, any>;
}

type ApiVariables = Record<string, any>;

interface OptimisticUpdateParams<T> {
  updatedFields: T;
  currentFields: T;
  setLocalData: (data: T) => void;
}

const defaults = {
  baseURL: process.env.${envVar} || "http://api.example.com",
  error: {
    code: "INTERNAL_ERROR",
    message: "Something went wrong. Please check your internet connection or contact support.",
    status: 503,
    data: {},
  } as ApiError,
};

axios.defaults.withCredentials = true;
let hasTriedRefresh = false;

// ---------- Refresh Token ----------
const refreshToken = async (): Promise<any> => {
  try {
    const response = await axios.post(
      API_ENDPOINTS.REFRESH_TOKEN, 
      {}, 
      { withCredentials: true }
    );
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.message || "Token refresh failed");
  }
};

function hasRefreshToken(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.includes("refreshToken=");
}

// ---------- Main API ----------
const api = async <T>(
  method: "get" | "post" | "put" | "patch" | "delete",
  url: string,
  options?: { params?: ApiVariables; data?: ApiVariables; headers?: ApiVariables }
): Promise<T> => {
  try {
    const response: AxiosResponse<T> = await axios({
      url: \`\${defaults.baseURL}\${url}\`,
      method,
      headers: {
        "Content-Type": "application/json",
        "Frontend-Path": typeof window !== 'undefined' ? window.location.pathname : '',
        ...(options?.headers || {}),
      },
      params: options?.params,
      data: options?.data,
      paramsSerializer: objectToQueryString,
      withCredentials: true,
    });

    hasTriedRefresh = false;
    return response.data;
  } catch (error: any) {
    if (axios.isAxiosError(error) && error.response) {
      const status = error.response.status;

      if (status === 401 && !hasTriedRefresh && hasRefreshToken()) {
        try {
          hasTriedRefresh = true;
          await refreshToken();

          const retryResponse: AxiosResponse<T> = await axios({
            url: \`\${defaults.baseURL}\${url}\`,
            method,
            headers: {
              "Content-Type": "application/json",
              "Frontend-Path": typeof window !== 'undefined' ? window.location.pathname : '',
              ...(options?.headers || {}),
            },
            params: options?.params,
            data: options?.data,
            paramsSerializer: objectToQueryString,
            withCredentials: true,
          });

          hasTriedRefresh = false;
          return retryResponse.data;
        } catch (refreshError) {
          console.error("🔁 Token refresh failed.", refreshError);
          hasTriedRefresh = false;
          if (typeof window !== 'undefined') {
            window.location.href = SystemRoutes.LOGIN;
          }
          throw { message: "Session expired. Please log in again." };
        }
      }

      if (status === 402) console.warn("⚠️ 402 - Organization is out of tokens");
      throw { message: error?.response?.data?.message ?? "Unknown API error" };
    }
    throw defaults.error;
  }
};

// ---------- Optimistic Update ----------
const optimisticUpdate = async <T extends Record<string, any>>(
  url: string,
  { updatedFields, currentFields, setLocalData }: OptimisticUpdateParams<T>
): Promise<void> => {
  try {
    setLocalData(updatedFields);
    await api<T>("put", url, { data: updatedFields });
  } catch (error) {
    setLocalData(currentFields);
    console.error(error);
  }
};

// ---------- API Methods ----------
const apiMethods = {
  get: <T>(url: string, options?: { params?: ApiVariables }) => 
    api<T>("get", url, options),
  post: <T>(url: string, options?: { params?: any; data?: any; headers?: any }) => 
    api<T>("post", url, options),
  put: <T>(url: string, options?: { data?: any; params?: any }) => 
    api<T>("put", url, options),
  patch: <T>(url: string, options?: { data?: any }) => 
    api<T>("patch", url, options),
  delete: <T>(url: string, options?: { params?: any; data?: any }) => 
    api<T>("delete", url, options),
  optimisticUpdate,
};

export default apiMethods;

// ---------- FormData API ----------
const apiWithFormData = async <T>(
  method: "post" | "put" | "patch", 
  url: string, 
  formData: FormData
): Promise<T> => {
  try {
    const response: AxiosResponse<T> = await axios({
      url: \`\${defaults.baseURL}\${url}\`,
      method,
      headers: { "Content-Type": "multipart/form-data" },
      data: formData,
      withCredentials: true,
    });
    return response.data;
  } catch (error: any) {
    if (axios.isAxiosError(error) && error.response) {
      if (error.response.status === 401 && typeof window !== 'undefined') {
        window.location.href = SystemRoutes.LOGIN;
      }
      throw { message: error?.response?.data?.message ?? "Unknown error" };
    }
    throw defaults.error;
  }
};

export const apiWithFormDataMethods = {
  post: <T>(url: string, formData: FormData) => 
    apiWithFormData<T>("post", url, formData),
  put: <T>(url: string, formData: FormData) => 
    apiWithFormData<T>("put", url, formData),
  patch: <T>(url: string, formData: FormData) => 
    apiWithFormData<T>("patch", url, formData),
};`;
      }
    } else {
      // JavaScript version
      if (authStorage === 'localStorage') {
        return `"use client";

import axios from "axios";
import { objectToQueryString } from "./url";
import SystemRoutes from "./Routes";
import API_ENDPOINTS from "./apiEndpoints";

const defaults = {
  baseURL: process.env.${envVar} || "http://api.example.com",
  error: {
    code: "INTERNAL_ERROR",
    message: "Something went wrong. Please check your internet connection or contact support.",
    status: 503,
    data: {},
  },
};

axios.defaults.withCredentials = true;
let hasTriedRefresh = false;

// ---------- LocalStorage Helpers ----------
const getStoredAuthToken = () => 
  typeof window !== 'undefined' ? localStorage.getItem("accessToken") || undefined : undefined;

const storeAuthToken = (token) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem("accessToken", token);
  }
};

const getRefreshToken = () => 
  typeof window !== 'undefined' ? localStorage.getItem("refreshToken") || undefined : undefined;

const storeRefreshToken = (token) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem("refreshToken", token);
  }
};

const removeTokens = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
  }
};

// ---------- Refresh Token ----------
const refreshToken = async () => {
  try {
    const refreshTokenValue = getRefreshToken();
    if (!refreshTokenValue) throw new Error("No refresh token found");

    const response = await axios.post(
      \`\${process.env.NEXT_PUBLIC_API_URL}\${API_ENDPOINTS.REFRESH_TOKEN}\`,
      { refreshToken: refreshTokenValue }
    );

    if (response.data?.data?.accessToken) storeAuthToken(response.data.data.accessToken);
    if (response.data?.data?.refreshToken) storeRefreshToken(response.data.data.refreshToken);

    return response.data;
  } catch (error) {
    console.error("Token refresh failed", error);
    removeTokens();
    if (typeof window !== 'undefined') {
      window.location.href = SystemRoutes.LOGIN;
    }
    throw error;
  }
};

// ---------- Helper ----------
function hasRefreshTokenCookie() {
  if (typeof document === "undefined") return false;
  return document.cookie.includes("refreshToken=");
}

// ---------- Main API ----------
const api = async (method, url, options = {}) => {
  try {
    const token = getStoredAuthToken();

    const response = await axios({
      url: \`\${defaults.baseURL}\${url}\`,
      method,
      headers: {
        "Content-Type": "application/json",
        "Frontend-Path": typeof window !== 'undefined' ? window.location.pathname : '',
        ...(token ? { Authorization: \`Bearer \${token}\` } : {}),
        ...(options.headers || {}),
      },
      params: options.params,
      data: options.data,
      paramsSerializer: objectToQueryString,
    });

    hasTriedRefresh = false;
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      const status = error.response.status;

      if (status === 401 && !hasTriedRefresh && hasRefreshTokenCookie()) {
        try {
          hasTriedRefresh = true;
          await refreshToken();
          const retryToken = getStoredAuthToken();
          
          const retryResponse = await axios({
            url: \`\${defaults.baseURL}\${url}\`,
            method,
            headers: {
              "Content-Type": "application/json",
              "Frontend-Path": typeof window !== 'undefined' ? window.location.pathname : '',
              ...(retryToken ? { Authorization: \`Bearer \${retryToken}\` } : {}),
              ...(options.headers || {}),
            },
            params: options.params,
            data: options.data,
            paramsSerializer: objectToQueryString,
          });
          
          hasTriedRefresh = false;
          return retryResponse.data;
        } catch (refreshError) {
          console.error("Token refresh failed", refreshError);
          hasTriedRefresh = false;
          if (typeof window !== 'undefined') {
            window.location.href = SystemRoutes.LOGIN;
          }
          throw { message: "Session expired. Please log in again." };
        }
      }

      if (status === 402) console.warn("402 - Organization is out of tokens");
      throw { message: error?.response?.data?.message ?? "Unknown API error" };
    }
    throw defaults.error;
  }
};

// ---------- Optimistic Update ----------
const optimisticUpdate = async (url, { updatedFields, currentFields, setLocalData }) => {
  try {
    setLocalData(updatedFields);
    await api("put", url, { data: updatedFields });
  } catch (error) {
    setLocalData(currentFields);
    console.error(error);
  }
};

// ---------- API Methods ----------
const apiMethods = {
  get: (url, options) => api("get", url, options),
  post: (url, options) => api("post", url, options),
  put: (url, options) => api("put", url, options),
  patch: (url, options) => api("patch", url, options),
  delete: (url, options) => api("delete", url, options),
  optimisticUpdate,
};

export default apiMethods;

// ---------- FormData API ----------
const apiWithFormData = async (method, url, formData) => {
  try {
    const token = getStoredAuthToken();
    const response = await axios({
      url: \`\${defaults.baseURL}\${url}\`,
      method,
      headers: { 
        "Content-Type": "multipart/form-data", 
        ...(token ? { Authorization: \`Bearer \${token}\` } : {}) 
      },
      data: formData,
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      if (error.response.status === 401 && typeof window !== 'undefined') {
        window.location.href = SystemRoutes.LOGIN;
      }
      throw { message: error?.response?.data?.message ?? "Unknown error" };
    }
    throw defaults.error;
  }
};

export const apiWithFormDataMethods = {
  post: (url, formData) => apiWithFormData("post", url, formData),
  put: (url, formData) => apiWithFormData("put", url, formData),
  patch: (url, formData) => apiWithFormData("patch", url, formData),
};`;
      } else if (authStorage === 'cookie') {
        return `"use client";

import axios from "axios";
import { objectToQueryString } from "./url";
import SystemRoutes from "./Routes";
import API_ENDPOINTS from "./apiEndpoints";

const defaults = {
  baseURL: process.env.${envVar} || "http://api.example.com",
  error: {
    code: "INTERNAL_ERROR",
    message: "Something went wrong. Please check your internet connection or contact support.",
    status: 503,
    data: {},
  },
};

axios.defaults.withCredentials = true;
let hasTriedRefresh = false;

// ---------- Refresh Token ----------
const refreshToken = async () => {
  try {
    const response = await axios.post(
      API_ENDPOINTS.REFRESH_TOKEN, 
      {}, 
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || "Token refresh failed");
  }
};

function hasRefreshToken() {
  if (typeof document === "undefined") return false;
  return document.cookie.includes("refreshToken=");
}

// ---------- Main API ----------
const api = async (method, url, options = {}) => {
  try {
    const response = await axios({
      url: \`\${defaults.baseURL}\${url}\`,
      method,
      headers: {
        "Content-Type": "application/json",
        "Frontend-Path": typeof window !== 'undefined' ? window.location.pathname : '',
        ...(options.headers || {}),
      },
      params: options.params,
      data: options.data,
      paramsSerializer: objectToQueryString,
      withCredentials: true,
    });

    hasTriedRefresh = false;
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      const status = error.response.status;

      if (status === 401 && !hasTriedRefresh && hasRefreshToken()) {
        try {
          hasTriedRefresh = true;
          await refreshToken();

          const retryResponse = await axios({
            url: \`\${defaults.baseURL}\${url}\`,
            method,
            headers: {
              "Content-Type": "application/json",
              "Frontend-Path": typeof window !== 'undefined' ? window.location.pathname : '',
              ...(options.headers || {}),
            },
            params: options.params,
            data: options.data,
            paramsSerializer: objectToQueryString,
            withCredentials: true,
          });

          hasTriedRefresh = false;
          return retryResponse.data;
        } catch (refreshError) {
          console.error("🔁 Token refresh failed.", refreshError);
          hasTriedRefresh = false;
          if (typeof window !== 'undefined') {
            window.location.href = SystemRoutes.LOGIN;
          }
          throw { message: "Session expired. Please log in again." };
        }
      }

      if (status === 402) console.warn("⚠️ 402 - Organization is out of tokens");
      throw { message: error?.response?.data?.message ?? "Unknown API error" };
    }
    throw defaults.error;
  }
};

// ---------- Optimistic Update ----------
const optimisticUpdate = async (url, { updatedFields, currentFields, setLocalData }) => {
  try {
    setLocalData(updatedFields);
    await api("put", url, { data: updatedFields });
  } catch (error) {
    setLocalData(currentFields);
    console.error(error);
  }
};

// ---------- API Methods ----------
const apiMethods = {
  get: (url, options) => api("get", url, options),
  post: (url, options) => api("post", url, options),
  put: (url, options) => api("put", url, options),
  patch: (url, options) => api("patch", url, options),
  delete: (url, options) => api("delete", url, options),
  optimisticUpdate,
};

export default apiMethods;

// ---------- FormData API ----------
const apiWithFormData = async (method, url, formData) => {
  try {
    const response = await axios({
      url: \`\${defaults.baseURL}\${url}\`,
      method,
      headers: { "Content-Type": "multipart/form-data" },
      data: formData,
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      if (error.response.status === 401 && typeof window !== 'undefined') {
        window.location.href = SystemRoutes.LOGIN;
      }
      throw { message: error?.response?.data?.message ?? "Unknown error" };
    }
    throw defaults.error;
  }
};

export const apiWithFormDataMethods = {
  post: (url, formData) => apiWithFormData("post", url, formData),
  put: (url, formData) => apiWithFormData("put", url, formData),
  patch: (url, formData) => apiWithFormData("patch", url, formData),
};`;
      }
    }
  })();

  // Create the API client file if content is not empty
  if ((authStorage === 'localStorage' || authStorage === 'cookie') && apiClientContent) {
    fs.writeFileSync(path.join(servicesDir, `apiClient.${ext}`), apiClientContent);
  }

  const routesContent = language === 'ts' ? `
class SystemRoutes {
  // --------- Authentication ---------
  public static LOGIN = \`/login\`;
  public static REGISTER = \`/register\`;
  public static FORGOT_PASSWORD = \`/forgot-password\`;

  // --------- Dashboard / Home ---------
  public static HOME = \`/\`;
  public static DASHBOARD = \`/dashboard\`;

  // --------- Profile ---------
  public static PROFILE = \`/profile\`;
  public static NOT_FOUND = \`/404\`;
  public static UNAUTHORIZED = \`/unauthorized\`;
}

export default SystemRoutes;
`: `
class SystemRoutes {
  // --------- Authentication ---------
  static LOGIN = \`/login\`;
  static REGISTER = \`/register\`;
  static FORGOT_PASSWORD = \`/forgot-password\`;

  // --------- Dashboard / Home ---------
  static HOME = \`/\`;
  static DASHBOARD = \`/dashboard\`;

  // --------- Profile ---------
  static PROFILE = \`/profile\`;
  static NOT_FOUND = \`/404\`;
  static UNAUTHORIZED = \`/unauthorized\`;
}

export default SystemRoutes;
`;

  const apiEndpointsContent = language === 'ts' ? `
class API_ENDPOINTS {
  // --------- Authentication Base ---------
  public static AUTH_BASE = \`/auth\`;

  // --------- Auth Endpoints ---------
  public static LOGIN = \`\${this.AUTH_BASE}/log-in\`;
  public static REGISTER = \`\${this.AUTH_BASE}/register-user\`;
  public static PROFILE = \`/user/profile\`;
  public static VERIFY_MFA_CODE = \`\${this.AUTH_BASE}/mfa-login\`;
  public static FORGOT_PASSWORD = \`\${this.AUTH_BASE}/forgot-password\`;
  public static RESET_PASSWORD = \`\${this.AUTH_BASE}/change-password\`;
  public static REFRESH_TOKEN = \`\${this.AUTH_BASE}/refresh\`;
  public static RESEND_OTP = \`\${this.AUTH_BASE}/resend-otp\`;
  public static LOGOUT = \`\${this.AUTH_BASE}/logout\`;

  // --------- Google Auth ---------
  public static GOOGLE_AUTH = \`\${this.AUTH_BASE}/google-login\`;

  // --------- Update User ---------
  public static UPDATE_USER = \`/user\`;
}

export default API_ENDPOINTS;
` : `
class API_ENDPOINTS {
  // --------- Authentication Base ---------
  static AUTH_BASE = \`/auth\`;

  // --------- Auth Endpoints ---------
  static LOGIN = \`\${this.AUTH_BASE}/log-in\`;
  static REGISTER = \`\${this.AUTH_BASE}/register-user\`;
  static PROFILE = \`/user/profile\`;
  static VERIFY_MFA_CODE = \`\${this.AUTH_BASE}/mfa-login\`;
  static FORGOT_PASSWORD = \`\${this.AUTH_BASE}/forgot-password\`;
  static RESET_PASSWORD = \`\${this.AUTH_BASE}/change-password\`;
  static REFRESH_TOKEN = \`\${this.AUTH_BASE}/refresh\`;
  static RESEND_OTP = \`\${this.AUTH_BASE}/resend-otp\`;
  static LOGOUT = \`\${this.AUTH_BASE}/logout\`;

  // --------- Google Auth ---------
  static GOOGLE_AUTH = \`\${this.AUTH_BASE}/google-login\`;

  // --------- Update User ---------
  static UPDATE_USER = \`/user\`;
}

export default API_ENDPOINTS;
`;;

  // Write utility files
  fs.writeFileSync(path.join(servicesDir, `Routes.${ext}`), routesContent);
  fs.writeFileSync(path.join(servicesDir, `apiEndpoints.${ext}`), apiEndpointsContent);

 console.log("✅ Axios setup created!");
}
