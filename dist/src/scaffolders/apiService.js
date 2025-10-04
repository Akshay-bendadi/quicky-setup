import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export async function scaffoldApiService(projectPath, language, authStorage, framework = "next") {
    const ext = language === "ts" ? "ts" : "js";
    // Determine services directory based on framework
    const servicesDir = framework === "next"
        ? path.join(projectPath, 'services')
        : path.join(projectPath, 'src', 'services');
    // Ensure services directory exists
    if (!fs.existsSync(servicesDir)) {
        fs.mkdirSync(servicesDir, { recursive: true });
    }
    // Create API service file
    const apiServiceContent = language === 'ts' ? `import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

declare global {
  interface Window {
    location: Location;
  }
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Extend AxiosRequestConfig to include custom properties
declare module 'axios' {
  export interface AxiosRequestConfig {
    _retry?: boolean;
  }
}

// Create axios instance with type
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for API calls
api.interceptors.request.use(
  (config: AxiosRequestConfig) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers = config.headers || {};
        config.headers['Authorization'] = \`Bearer \${token}\`;
      }
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor for API calls
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      // Handle unauthorized access
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;` : `import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for API calls
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers = config.headers || {};
        config.headers['Authorization'] = \`Bearer \${token}\`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for API calls
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      // Handle unauthorized access
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;`;
    fs.writeFileSync(path.join(servicesDir, `api.${ext}`), apiServiceContent);
    // Create auth service if authStorage is specified
    if (authStorage) {
        const authServiceContent = language === 'ts' ? `import { AxiosResponse } from 'axios';
import api from './api';

interface User {
  id: string | number;
  email: string;
  [key: string]: any;
}

interface AuthResponse {
  token: string;
  user: User;
  [key: string]: any;
}

export const authService = {
  async login(credentials: { email: string; password: string }): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/login', credentials);
    if (response.data.token && typeof window !== 'undefined') {
      localStorage.setItem('token', response.data.token);
    }
    return response.data;
  },

  logout(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }
  },

  getCurrentUser(): Promise<AxiosResponse<{ user: User }>> {
    return api.get<{ user: User }>('/auth/me');
  },
};

export default authService;` : `import api from './api';

export const authService = {
  async login(credentials) {
    const response = await api.post('/auth/login', credentials);
    if (response.data.token && typeof window !== 'undefined') {
      localStorage.setItem('token', response.data.token);
    }
    return response.data;
  },

  logout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }
  },

  getCurrentUser() {
    return api.get('/auth/me');
  },
};

export default authService;`;
        fs.writeFileSync(path.join(servicesDir, `authService.${ext}`), authServiceContent);
    }
    console.log("✅ API service created!");
}
