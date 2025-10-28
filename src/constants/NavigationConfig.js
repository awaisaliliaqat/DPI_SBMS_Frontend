// constants/NavigationConfig.js
export const NAVIGATION_CONFIG = {
  user: {
    displayName: 'User Management',
    routerLink: '/users',
    icon: '👥', // You can replace with actual icons
    requiredPermission: 'manage'
    },
    role: {
    displayName: 'Roles',
    routerLink: '/roles',
    icon: '📊',
    requiredPermission: 'view' // or whatever permission you want
  },
  shopboardRequest: {
    displayName: 'Area Head Requests',
    routerLink: '/area-head-requests',
    icon: '📋',
    requiredPermission: 'read'
  },
  vendorRequests: {
    displayName: 'Vendor Requests',
    routerLink: '/vendor-requests',
    icon: '🏪',
    requiredPermission: 'read'
  },
  requestPriceAdjustment: {
    displayName: 'Request Items Adjustment',
    routerLink: '/request-items-adjustment',
    icon: '💵',
    requiredPermission: 'read'
  },
  vendorAssignment: {
    displayName: 'SAP User Management',
    routerLink: '/vendor-assignment',
    icon: '👥',
    requiredPermission: 'read'
  },
  dashboard: {
    displayName: 'Dashboard',
    routerLink: '/dashboard',
    icon: '📊',
    requiredPermission: 'view' // or whatever permission you want
  },
  reports: {
    displayName: 'Reports',
    routerLink: '/reports',
    icon: '📈',
    requiredPermission: 'view'
  },
  settings: {
    displayName: 'Settings',
    routerLink: '/settings',
    icon: '⚙️',
    requiredPermission: 'manage'
  }
};