import React from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import SignIn from '../Signin';
import { useAuth } from '../auth/AuthContext';
import { AuthProvider } from '../auth/AuthContext';
import DashboardLayout from '../dashboard/components/DashboardLayout';
// import DashboardHome from '../pages/DashboardHome';
// import UserManagement from '../pages/UserManagement';
import RoleManagement from '../pages/Role';
import UserManagement from '../pages/UserManagement';
import AreaHeadRequests from '../pages/AreaHeadRequests';
import VendorRequests from '../pages/VendorRequests';
import RequestItemsAdjustment from '../pages/RequestItemsAdjustment';
import RequestTypesManagement from '../pages/RequestTypesManagement';
import VendorAssignment from '../pages/VendorAssignment';
import RequestPrintView from '../pages/RequestPrintView';
import Stats from '../pages/Stats';
import BudgetManagement from '../pages/BudgetManagement';
import Payments from '../pages/Payments';
import SmtpSettings from '../pages/SmtpSettings';
import PaymentBatch from '../pages/PaymentBatch';
import SalesHeadManagement from '../pages/SalesHeadManagement';
import CustomSubDealers from '../pages/CustomSubDealers';
import ManualSurvey from '../pages/ManualSurvey';
// import Reports from '../pages/Reports';
// import Settings from '../pages/Settings';

// Protected Route component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  
  React.useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/signin', { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);
  
  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>;
  }
  
  if (!isAuthenticated) {
    return null; // Will redirect via useEffect
  }
  
  return children;
};

const RedirectToSignin = () => {
  const navigate = useNavigate();
  React.useEffect(() => {
    navigate('/signin', { replace: true });
  }, [navigate]);
  return null;
};

const AppRoutesContent = () => {
  return (
    <Routes>
      <Route path="/signin" element={<SignIn />} />
      
      {/* Public route for request print view (with token validation) */}
      <Route path="/request-view/:id" element={<RequestPrintView />} />
      
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
        <Route path="area-head-requests" element={<AreaHeadRequests />} />
        <Route path="vendor-requests" element={<VendorRequests />} />
        <Route path="request-items-adjustment" element={<RequestItemsAdjustment />} />
        <Route path="request-types" element={<RequestTypesManagement />} />
        <Route path="vendor-assignment" element={<VendorAssignment />} />
        <Route path="statistics" element={<Stats />} />
        <Route path="budget-management" element={<BudgetManagement />} />
        <Route path="payments" element={<Payments />} />
        <Route path="smtp-settings" element={<SmtpSettings />} />
        <Route path="payment-batch" element={<PaymentBatch />} />
        <Route path="sales-head-management" element={<SalesHeadManagement />} />
        <Route path="custom-sub-dealers" element={<CustomSubDealers />} />
        <Route path="manual-survey" element={<ManualSurvey />} />
        {/* <Route path="users" element={<FeatureManagement />} /> */}
        <Route index element={<RedirectToSignin />} />
      </Route>
      
      {/* Fallback route */}
      <Route path="*" element={<RedirectToSignin />} />
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