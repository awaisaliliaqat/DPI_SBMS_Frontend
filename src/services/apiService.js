// services/apiService.js
import { BASE_URL, BASENAME } from '../constants/Constants';

class ApiService {
  constructor() {
    this.baseURL = BASE_URL;
  }

  // Generic request method
  async request(endpoint, options = {}) {
    const {
      method = 'GET',
      data = null,
      headers = {},
      requiresAuth = true,
      ...restOptions
    } = options;

    // Get token from localStorage or context
    const token = localStorage.getItem('authToken');
    
    // Prepare headers
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...(requiresAuth && token && { 'Authorization': `Bearer ${token}` }),
      ...headers,
    };

    // Prepare request config
    const config = {
      method,
      headers: defaultHeaders,
      ...restOptions,
    };

    // Add body for non-GET requests
    if (data && method !== 'GET') {
      config.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, config);
      
      // Handle error responses
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = await response.text();
        }

        // For login endpoint, don't handle 401 as unauthorized - let the component handle it
        if (endpoint.includes('/auth/signin') && response.status === 401) {
          throw new Error(JSON.stringify(errorData));
        }

        // Handle unauthorized responses (401 = not authenticated, 403 = forbidden/no permission)
        if (response.status === 401) {
          // Only log out on 401 (not authenticated)
          this.handleUnauthorized();
          throw new Error('Authentication required');
        }
        // For 403 (Forbidden), don't log out - just throw error
        if (response.status === 403) {
          throw new Error(JSON.stringify(errorData));
        }

        // Handle other error responses
        throw new Error(JSON.stringify(errorData));
      }

      // Parse successful response
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      
      return await response.text();
      
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Handle unauthorized access
  handleUnauthorized() {
    // Clear local storage
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    
    // Redirect to login (check if not already on signin page)
    const signinPath = `${BASENAME}/signin`;
    if (!window.location.pathname.endsWith('/signin')) {
      window.location.href = signinPath;
    }
  }

  // Specific HTTP methods
  async get(endpoint, options = {}) {
    return this.request(endpoint, { method: 'GET', ...options });
  }

  async post(endpoint, data, options = {}) {
    return this.request(endpoint, { method: 'POST', data, ...options });
  }

  async put(endpoint, data, options = {}) {
    return this.request(endpoint, { method: 'PUT', data, ...options });
  }

  async patch(endpoint, data, options = {}) {
    return this.request(endpoint, { method: 'PATCH', data, ...options });
  }

  async delete(endpoint, options = {}) {
    return this.request(endpoint, { method: 'DELETE', ...options });
  }

  // File upload method
  async upload(endpoint, formData, options = {}) {
    const headers = {
      ...(options.headers || {}),
    };
    delete headers['Content-Type'];

    return this.request(endpoint, {
      method: 'POST',
      data: formData,
      headers,
      ...options,
    });
  }
}

// Create singleton instance
export const apiService = new ApiService();