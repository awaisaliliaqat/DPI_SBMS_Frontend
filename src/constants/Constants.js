// Base URL configuration
export const BASE_URL = 'http://125.209.66.147:5001';

// Base path for React Router (must match the basename in App.js)
export const BASENAME = '/ShopBoard';

export const PERMISSIONS = [
  { id: 'create', name: 'Create' },
  { id: 'read', name: 'Read' },
  { id: 'update', name: 'Update' },
  { id: 'delete', name: 'Delete' },
  { id: 'approvals', name: 'Approvals' },
  { id: 'read_approved_request', name: 'Read Approved Request' },
  { id: 'read_full_comments', name: 'Read Full Comments' },
  { id: 'read_vendor_comments_only', name: 'Read Vendor Comments Only' },
  { id: 'add_comment', name: 'Add Comment' },
  { id: 'read_marketing_comments', name: 'Read Marketing Comments' },
  { id: 'print', name: 'Print' },
  { id: 'manual_approval', name: 'Manual Approval' },
  { id: 'payment_release', name: 'Payment Release' },
];

// Feature-specific permissions mapping
// For shopboardRequest, all permissions are available
// For all other features, only CRUD permissions are available
export const FEATURE_PERMISSIONS = {
  shopboardRequest: [
    { id: 'create', name: 'Create' },
    { id: 'read', name: 'Read' },
    { id: 'update', name: 'Update' },
    { id: 'delete', name: 'Delete' },
    { id: 'approvals', name: 'Approvals' },
    { id: 'read_approved_request', name: 'Read Approved Request' },
    { id: 'read_full_comments', name: 'Read Full Comments' },
    { id: 'read_vendor_comments_only', name: 'Read Vendor Comments Only' },
    { id: 'add_comment', name: 'Add Comment' },
    { id: 'read_marketing_comments', name: 'Read Marketing Comments' },
    { id: 'print', name: 'Print' },
    { id: 'manual_approval', name: 'Manual Approval' },
    { id: 'payment_release', name: 'Payment Release' },
  ],
  // Default permissions for all other features (CRUD only)
  default: [
    { id: 'create', name: 'Create' },
    { id: 'read', name: 'Read' },
    { id: 'update', name: 'Update' },
    { id: 'delete', name: 'Delete' },
  ],
};

// Helper function to get permissions for a feature
export const getPermissionsForFeature = (featureName) => {
  if (!featureName) return [];
  
  // Normalize feature name to handle variations (shopboardRequest, shopboard_requests, etc.)
  let normalizedName = featureName;
  
  // Handle shopboard request variations
  if (featureName.toLowerCase() === 'shopboard_requests' || 
      featureName.toLowerCase() === 'shopboardrequests' ||
      (featureName.toLowerCase().includes('shopboard') && featureName.toLowerCase().includes('request'))) {
    normalizedName = 'shopboardRequest';
  }
  
  // Check if feature has specific permissions defined
  if (FEATURE_PERMISSIONS[normalizedName]) {
    return FEATURE_PERMISSIONS[normalizedName];
  }
  
  // Return default CRUD permissions for other features
  return FEATURE_PERMISSIONS.default;
};

// Features to exclude from role management dropdown (by name property from API)
export const EXCLUDED_FEATURES = ['settings', 'dashboard', 'areahead_shop', 'permissions', 'reports'];
