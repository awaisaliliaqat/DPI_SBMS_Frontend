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
      responseType,
      ...restOptions
    } = options;

    // Get token from localStorage or context
    const token = localStorage.getItem('authToken');
    
    // Check if data is FormData
    const isFormData = data instanceof FormData;
    
    // Prepare headers
    const defaultHeaders = {
      // Don't set Content-Type for FormData - let browser set it with boundary
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(requiresAuth && token && { 'Authorization': `Bearer ${token}` }),
      ...headers,
    };

    // Note: responseType is for the response, not the request
    // We still send JSON in the request body, but expect blob in response

    // Prepare request config
    const config = {
      method,
      headers: defaultHeaders,
      responseType, // Pass responseType through
      ...restOptions,
    };

    // Add body for non-GET requests
    if (data && method !== 'GET') {
      // For FormData, send as-is (browser will set Content-Type with boundary)
      if (isFormData) {
        config.body = data;
      } else {
        config.body = JSON.stringify(data);
      }
    }

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, config);

      // Handle error responses
      if (!response.ok) {
        console.log('[apiService] Error response:', response.status, response.statusText, endpoint);
        let errorData;
        try {
          // Read body once (no clone) to avoid stream/clone issues
          const text = await response.text();
          console.log('[apiService] Error body (raw):', text?.substring?.(0, 200));
          try {
            errorData = JSON.parse(text);
          } catch {
            errorData = { message: text || `HTTP ${response.status}: ${response.statusText}` };
          }
        } catch (readErr) {
          console.warn('[apiService] Failed to read error response body:', readErr);
          errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
        }

        // For login endpoint, don't handle 401 as unauthorized - let the component handle it
        if (endpoint.includes('/auth/signin') && response.status === 401) {
          throw new Error(JSON.stringify(errorData));
        }

        // Handle unauthorized / forbidden (401 = not authenticated, 403 = expired token or no permission)
        if (response.status === 401 || response.status === 403) {
          console.log('[apiService] 401/403 -> handleUnauthorized(), status:', response.status);
          this.handleUnauthorized();
          throw new Error(errorData?.message || (response.status === 403 ? 'Session expired or access denied' : 'Authentication required'));
        }

        // Handle other error responses
        throw new Error(JSON.stringify(errorData));
      }

      // Parse successful response
      const contentType = response.headers.get('content-type');
      
      // Handle blob responses (Excel files, PDFs, images, etc.)
      if (responseType === 'blob' || 
          options.responseType === 'blob' ||
          contentType?.includes('application/vnd.openxmlformats-officedocument') || 
          contentType?.includes('application/pdf') || 
          contentType?.includes('image/') ||
          contentType?.includes('application/octet-stream')) {
        return await response.blob();
      }
      
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
    console.log('[apiService] handleUnauthorized: clearing storage, redirecting to signin');
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    // HashRouter: signin route is at BASENAME/#/signin — use full URL so hash is replaced (avoids .../signin#/area-head-requests)
    const signinUrl = `${window.location.origin}${BASENAME}/#/signin`;
    const isOnSigninRoute = window.location.hash === '#/signin';
    if (!isOnSigninRoute) {
      window.location.href = signinUrl;
    } else {
      console.log('[apiService] handleUnauthorized: already on signin, skip redirect');
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