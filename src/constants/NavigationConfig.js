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