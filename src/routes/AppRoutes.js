import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import SignIn from '../Signin';
import { useAuth } from '../auth/AuthContext';
import { AuthProvider } from '../auth/AuthContext';
import DashboardLayout from '../dashboard/components/DashboardLayout';
// import DashboardHome from '../pages/DashboardHome';
// import UserManagement from '../pages/UserManagement';
import RoleManagement from '../pages/Role';
import UserManagement from '../pages/UserManagement';
import FeatureManagement from '../pages/Feature';
// import Reports from '../pages/Reports';
// import Settings from '../pages/Settings';

// Protected Route component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>;
  }
  
  return isAuthenticated ? children : <Navigate to="/signin" />;
};

const AppRoutesContent = () => {
  return (
    <Routes>
      <Route path="/signin" element={<SignIn />} />
      
      {/* Dashboard Layout Route - contains navbar and sidebar */}
      <Route 
        path="/" 
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="users" element={<UserManagement />} />
        <Route path="roles" element={<RoleManagement />} />
        {/* <Route path="users" element={<FeatureManagement />} /> */}
        <Route index element={<Navigate to="/signin" />} />
      </Route>
      
      {/* Fallback route */}
      <Route path="*" element={<Navigate to="/signin" />} />
    </Routes>
  );
};

const AppRoutes = () => {
  return (
    <AuthProvider>
      <AppRoutesContent />
    </AuthProvider>
  );
};

export default AppRoutes;