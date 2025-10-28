import * as React from 'react';
import {
  Alert,
  Box,
  Button,
  Typography,
  TextField,
  Autocomplete,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  InputAdornment,
  FormControlLabel,
  Checkbox,
  CircularProgress,
} from '@mui/material';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from '../auth/AuthContext';
import { useApi } from '../hooks/useApi';
import ReusableDataTable from '../components/ReusableData';
import PageContainer from '../components/PageContainer';
import { Visibility, VisibilityOff, Refresh } from '@mui/icons-material';

const INITIAL_PAGE_SIZE = 10;

export default function VendorAssignment() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const { user } = useAuth();
  const { get, post, del } = useApi();

  // Permissions based on tab key 'vendorAssignment'
  const permKey = 'vendorAssignment';
  const canRead = user?.permissions?.[permKey]?.includes('read') || false;
  const canCreate = user?.permissions?.[permKey]?.includes('create') || false;
  const canUpdate = user?.permissions?.[permKey]?.includes('update') || false;
  const canDelete = user?.permissions?.[permKey]?.includes('delete') || false;

  const [rowsState, setRowsState] = React.useState({ rows: [], rowCount: 0 });
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const [paginationModel, setPaginationModel] = React.useState({
    page: searchParams.get('page') ? Number(searchParams.get('page')) : 0,
    pageSize: searchParams.get('pageSize') ? Number(searchParams.get('pageSize')) : INITIAL_PAGE_SIZE,
  });
  const [filterModel, setFilterModel] = React.useState(
    searchParams.get('filter') ? JSON.parse(searchParams.get('filter') ?? '') : { items: [] },
  );
  const [sortModel, setSortModel] = React.useState(
    searchParams.get('sort') ? JSON.parse(searchParams.get('sort') ?? '') : [],
  );

  // Modal state
  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalMode, setModalMode] = React.useState('create'); // 'create' | 'edit' | 'view'
  const [selectedRow, setSelectedRow] = React.useState(null);

  // Form state
  const [vendors, setVendors] = React.useState([]);
  const [regions, setRegions] = React.useState([]);
  const [loadingVendors, setLoadingVendors] = React.useState(false);
  const [loadingRegions, setLoadingRegions] = React.useState(false);
  const [formData, setFormData] = React.useState({
    vendor_id: '',
    region_id: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [useSystemPassword, setUseSystemPassword] = React.useState(false);
  const [formErrors, setFormErrors] = React.useState({});
  
  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [userToDelete, setUserToDelete] = React.useState(null);

  // Load vendors from SAP
  const loadVendors = React.useCallback(async (excludeAssigned = false) => {
    setLoadingVendors(true);
    try {
      const url = excludeAssigned ? '/api/sap/vendors?excludeAssigned=true' : '/api/sap/vendors';
      const response = await get(url);
      if (response?.success && Array.isArray(response.data)) {
        setVendors(response.data);
        console.log('Vendors loaded:', response.data.length, 'vendors');
        
        // Show message if no vendors available when filtering
        if (excludeAssigned && response.data.length === 0) {
          toast.warning('All vendors have been assigned to regions. No new assignments can be made.', {
            position: "top-right",
            autoClose: 7000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          });
        }
      } else {
        console.log('Vendors response:', response);
        setVendors([]);
      }
    } catch (e) {
      console.error('Error loading vendors:', e);
      toast.error('Failed to load vendors');
      setVendors([]);
    } finally {
      setLoadingVendors(false);
    }
  }, [get]);

  // Load regions
  const loadRegions = React.useCallback(async () => {
    setLoadingRegions(true);
    try {
      const response = await get('/api/regions');
      if (response?.success && Array.isArray(response.data)) {
        setRegions(response.data);
        console.log('Regions loaded:', response.data.length, 'regions');
      } else {
        console.log('Regions response:', response);
        setRegions([]);
      }
    } catch (e) {
      console.error('Error loading regions:', e);
      toast.error('Failed to load regions');
      setRegions([]);
    } finally {
      setLoadingRegions(false);
    }
  }, [get]);

  // Load SAP users from database
  const loadSapUsers = React.useCallback(async () => {
    if (!canRead) return;
    setError(null);
    setIsLoading(true);
    try {
      const { page, pageSize } = paginationModel;
      const response = await get(`/api/sap-users?page=${page + 1}&limit=${pageSize}`);
      if (response?.success && Array.isArray(response.data)) {
        setRowsState({ 
          rows: response.data, 
          rowCount: response.pagination?.totalItems || response.data.length 
        });
        console.log('SAP users loaded:', response.data.length, 'users');
      } else {
        console.log('SAP users response:', response);
        setRowsState({ rows: [], rowCount: 0 });
      }
    } catch (e) {
      setError(e.message || 'Failed to load SAP users');
      toast.error('Failed to load SAP users');
      console.error('Error loading SAP users:', e);
    } finally {
      setIsLoading(false);
    }
  }, [get, canRead, paginationModel]);

  // Load data when component mounts
  React.useEffect(() => {
    loadRegions();
    loadSapUsers();
  }, [loadRegions, loadSapUsers]);

  // URL sync handlers
  const handlePaginationModelChange = React.useCallback((model) => {
    setPaginationModel(model);
    searchParams.set('page', String(model.page));
    searchParams.set('pageSize', String(model.pageSize));
    const newSearchParamsString = searchParams.toString();
    navigate(`${pathname}${newSearchParamsString ? '?' : ''}${newSearchParamsString}`);
  }, [navigate, pathname, searchParams]);

  const handleFilterModelChange = React.useCallback((model) => {
    setFilterModel(model);
    if (model.items.length > 0 || (model.quickFilterValues && model.quickFilterValues.length > 0)) {
      searchParams.set('filter', JSON.stringify(model));
    } else {
      searchParams.delete('filter');
    }
    const newSearchParamsString = searchParams.toString();
    navigate(`${pathname}${newSearchParamsString ? '?' : ''}${newSearchParamsString}`);
  }, [navigate, pathname, searchParams]);

  const handleSortModelChange = React.useCallback((model) => {
    setSortModel(model);
    if (model.length > 0) {
      searchParams.set('sort', JSON.stringify(model));
    } else {
      searchParams.delete('sort');
    }
    const newSearchParamsString = searchParams.toString();
    navigate(`${pathname}${newSearchParamsString ? '?' : ''}${newSearchParamsString}`);
  }, [navigate, pathname, searchParams]);

  // Password generation
  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 6; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  // Handle system password generation
  const handleSystemPasswordToggle = (checked) => {
    setUseSystemPassword(checked);
    if (checked) {
      const generatedPassword = generatePassword();
      setFormData(prev => ({
        ...prev,
        password: generatedPassword,
        confirmPassword: generatedPassword
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        password: '',
        confirmPassword: ''
      }));
    }
  };

  // Form validation
  const validateForm = () => {
    const errors = {};

    if (!formData.vendor_id) {
      errors.vendor_id = 'Vendor is required';
    }

    if (!formData.region_id) {
      errors.region_id = 'Region is required';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Confirm password is required';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Actions
  const handleCreate = React.useCallback(() => {
    if (!canCreate) return;
    setSelectedRow(null);
    setFormData({
      vendor_id: '',
      region_id: '',
      password: '',
      confirmPassword: '',
    });
    setFormErrors({});
    setUseSystemPassword(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setModalMode('create');
    setModalOpen(true);
    // Load only unassigned vendors for create mode
    loadVendors(true);
  }, [canCreate, loadVendors]);

  const handleView = React.useCallback((row) => {
    if (!canRead) return;
    setSelectedRow(row);
    setFormData({
      vendor_id: row.username || '',
      region_id: row.region_id || '',
      password: '••••••', // Don't show actual password
      confirmPassword: '••••••',
    });
    setModalMode('view');
    setModalOpen(true);
  }, [canRead]);

  const handleEdit = React.useCallback((row) => {
    if (!canUpdate) return;
    setSelectedRow(row);
    setFormData({
      vendor_id: row.username || '',
      region_id: row.region_id || '',
      password: '', // Leave empty for editing
      confirmPassword: '',
    });
    setFormErrors({});
    setModalMode('edit');
    setModalOpen(true);
    // Load all vendors for edit mode (vendor dropdown will be disabled)
    loadVendors(false);
  }, [canUpdate, loadVendors]);

  const handleDelete = React.useCallback((row) => {
    if (!canDelete) return;
    setUserToDelete(row);
    setDeleteDialogOpen(true);
  }, [canDelete]);

  const confirmDelete = React.useCallback(async () => {
    if (!userToDelete) return;
    
    setIsLoading(true);
    try {
      await del(`/api/sap-users/${userToDelete.id}`);
      
      toast.success('SAP user deleted successfully!', {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      
      // Close dialog and reset state
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      
      // Reload the SAP users list
      loadSapUsers();
    } catch (error) {
      console.error('Error deleting SAP user:', error);
      toast.error(`Failed to delete SAP user: ${error.message}`, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } finally {
      setIsLoading(false);
    }
  }, [userToDelete, del, loadSapUsers]);

  const cancelDelete = React.useCallback(() => {
    setDeleteDialogOpen(false);
    setUserToDelete(null);
  }, []);

  const handleRefresh = React.useCallback(() => {
    if (!isLoading && canRead) {
      loadSapUsers();
    }
  }, [isLoading, canRead, loadSapUsers]);

  // Submit handler
  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error('Please fix the form errors');
      return;
    }

    setIsLoading(true);
    try {
      // Find the selected vendor to get contact details
      const selectedVendor = vendors.find(v => (v.id || v.CardCode) === formData.vendor_id);
      
      // Prepare payload for SAP user creation
      const payload = {
        vendor_id: formData.vendor_id,
        region_id: formData.region_id,
        password: formData.password,
        card_name: selectedVendor?.name || selectedVendor?.CardName || 'Unknown Vendor',
        contact_person: selectedVendor?.contact_person || selectedVendor?.CntctPrsn || null,
        cellular: selectedVendor?.cellular || selectedVendor?.Cellular || null,
        phone: selectedVendor?.phone || selectedVendor?.Phone1 || null,
        address: selectedVendor?.address || selectedVendor?.Address || null
      };

      // Console log the payload as requested
      console.log('Vendor Assignment Payload:', payload);
      console.log('Selected Vendor:', vendors.find(v => (v.id || v.CardCode) === formData.vendor_id));
      console.log('Selected Region:', regions.find(r => r.id === formData.region_id));

      // Create SAP user via API
      const response = await post('/api/sap-users/create', payload);
      
      if (response.success) {
        toast.success('SAP user created successfully!', {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
        
        // Close modal
        setModalOpen(false);
        
        // Reset form
        setFormData({
          vendor_id: '',
          region_id: '',
          password: '',
          confirmPassword: '',
        });
        setUseSystemPassword(false);
        setFormErrors({});
        
        // Reload SAP users to show the new one
        loadSapUsers();
      } else {
        throw new Error(response.message || 'Failed to create SAP user');
      }
    } catch (error) {
      console.error('Error creating SAP user:', error);
      toast.error(`Failed to create SAP user: ${error.message}`, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Columns for the data table - SAP users
  const columns = React.useMemo(() => [
    { 
      field: 'id', 
      headerName: 'ID', 
      width: 80 
    },
    { 
      field: 'username', 
      headerName: 'Vendor Code', 
      width: 120,
      renderCell: (params) => params.value || 'N/A'
    },
    { 
      field: 'card_name', 
      headerName: 'Vendor Name', 
      width: 200,
      renderCell: (params) => params.value || 'N/A'
    },
    { 
      field: 'region', 
      headerName: 'Region', 
      width: 150,
      renderCell: (params) => params.value?.name || 'N/A'
    },
    { 
      field: 'contact_person', 
      headerName: 'Contact Person', 
      width: 150,
      renderCell: (params) => params.value || 'N/A'
    },
    { 
      field: 'cellular', 
      headerName: 'Cellular', 
      width: 120,
      renderCell: (params) => params.value || 'N/A'
    },
    { 
      field: 'phone', 
      headerName: 'Phone', 
      width: 120,
      renderCell: (params) => params.value || 'N/A'
    },
    { 
      field: 'created_at', 
      headerName: 'Created At', 
      width: 180,
      renderCell: (params) => {
        if (!params.value) return 'N/A';
        try {
          const date = new Date(params.value);
          return (
            <Typography variant="body2">
              {date.toLocaleDateString()} 
              <br />
              {date.toLocaleTimeString()}
            </Typography>
          );
        } catch (error) {
          return params.value;
        }
      }
    },
  ], []);

  const pageTitle = 'SAP User Management';

  if (!canRead) {
    return (
      <PageContainer title={pageTitle} breadcrumbs={[{ title: pageTitle }]}>
        <Alert severity="error" sx={{ mb: 2 }}>
          You do not have permission to view this page
        </Alert>
        <ToastContainer position="top-right" autoClose={5000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="light" toastStyle={{ backgroundColor: '#ffffff', color: '#333333' }} />
      </PageContainer>
    );
  }

  return (
    <PageContainer title={pageTitle} breadcrumbs={[{ title: pageTitle }]}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <ReusableDataTable
        data={rowsState.rows}
        columns={columns}
        loading={isLoading}
        error={error}
        paginationModel={paginationModel}
        onPaginationModelChange={handlePaginationModelChange}
        rowCount={rowsState.rowCount}
        paginationMode="server"
        sortModel={sortModel}
        onSortModelChange={handleSortModelChange}
        sortingMode="client"
        filterModel={filterModel}
        onFilterModelChange={handleFilterModelChange}
        filterMode="client"
        onView={canRead ? handleView : null}
        onEdit={canUpdate ? handleEdit : null}
        onDelete={canDelete ? handleDelete : null}
        onCreate={canCreate ? handleCreate : null}
        onRefresh={canRead ? handleRefresh : null}
        pageSizeOptions={[5, 10, 25, 50]}
        showToolbar={true}
      />

      {/* Vendor Assignment Modal */}
      <Dialog 
        open={modalOpen} 
        onClose={() => setModalOpen(false)} 
        aria-labelledby="vendor-assignment-dialog-title" 
        PaperProps={{ 
          sx: { 
            backgroundColor: '#ffffff', 
            minWidth: '520px', 
            maxWidth: '720px' 
          } 
        }}
      >
        <DialogTitle id="vendor-assignment-dialog-title" sx={{ fontWeight: 'bold' }}>
          {modalMode === 'create' ? 'Add' : modalMode === 'edit' ? 'Edit' : 'View'} SAP User
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {/* Vendor Selection */}
            <Autocomplete
              options={vendors}
              getOptionLabel={(option) => option.name || option.CardName || ''}
              isOptionEqualToValue={(option, value) => String(option.id || option.CardCode) === String(value.id || value.CardCode)}
              value={
                formData.vendor_id 
                  ? vendors.find(x => String(x.id || x.CardCode) === String(formData.vendor_id)) || 
                    // If not found in vendors list, create a mock object for display
                    (modalMode !== 'create' ? { 
                      id: formData.vendor_id, 
                      CardCode: formData.vendor_id, 
                      name: selectedRow?.card_name || formData.vendor_id,
                      CardName: selectedRow?.card_name || formData.vendor_id 
                    } : null)
                  : null
              }
              onChange={(event, newValue) => {
                console.log('Vendor selected:', newValue);
                setFormData(prev => ({ 
                  ...prev, 
                  vendor_id: newValue?.id || newValue?.CardCode || '' 
                }));
                // Clear vendor error when selection is made
                if (formErrors.vendor_id) {
                  setFormErrors(prev => ({ ...prev, vendor_id: '' }));
                }
              }}
              renderInput={(params) => (
                <TextField 
                  {...params} 
                  label={
                    modalMode === 'create' 
                      ? `Vendor * (${vendors.length} unassigned available)` 
                      : modalMode === 'edit'
                      ? `Vendor (Cannot be changed)`
                      : `Vendor * (${vendors.length} available)`
                  } 
                  variant="outlined" 
                  required 
                  error={!!formErrors.vendor_id}
                  helperText={
                    formErrors.vendor_id || 
                    (modalMode === 'create' && vendors.length === 0 
                      ? "All vendors have been assigned to regions" 
                      : modalMode === 'edit' 
                      ? "Vendor cannot be changed in edit mode"
                      : undefined)
                  }
                />
              )}
              disabled={modalMode === 'view' || modalMode === 'edit'}
              loading={loadingVendors}
              loadingText="Loading vendors..."
              noOptionsText={
                modalMode === 'create' && vendors.length === 0 
                  ? "All vendors have been assigned to regions" 
                  : "No vendors found"
              }
              freeSolo={false}
              selectOnFocus
              clearOnBlur
              handleHomeEndKeys
              openOnFocus
            />

            {/* Region Selection */}
            <FormControl fullWidth error={!!formErrors.region_id}>
              <InputLabel>Region *</InputLabel>
              <Select
                value={formData.region_id}
                label="Region *"
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, region_id: e.target.value }));
                  // Clear region error when selection is made
                  if (formErrors.region_id) {
                    setFormErrors(prev => ({ ...prev, region_id: '' }));
                  }
                }}
                disabled={modalMode === 'view' || loadingRegions}
              >
                {loadingRegions ? (
                  <MenuItem disabled>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <CircularProgress size={20} sx={{ mr: 1 }} />
                      Loading regions...
                    </Box>
                  </MenuItem>
                ) : (
                  regions.map(region => (
                    <MenuItem key={region.id} value={region.id}>
                      {region.name}
                    </MenuItem>
                  ))
                )}
              </Select>
              {formErrors.region_id && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                  {formErrors.region_id}
                </Typography>
              )}
            </FormControl>

            {/* Password Fields - Only show when not in view mode */}
            {modalMode !== 'view' && (
              <>
                {/* System Generated Password Option */}
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={useSystemPassword}
                      onChange={(e) => handleSystemPasswordToggle(e.target.checked)}
                    />
                  }
                  label="Use system generated password"
                />

                {/* Password Field */}
                <TextField
                  label="Password *"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, password: e.target.value }));
                    // Clear password error when typing
                    if (formErrors.password) {
                      setFormErrors(prev => ({ ...prev, password: '' }));
                    }
                  }}
                  variant="outlined"
                  disabled={useSystemPassword}
                  error={!!formErrors.password}
                  helperText={formErrors.password || 'Minimum 6 characters'}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="toggle password visibility"
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                {/* Confirm Password Field */}
                <TextField
                  label="Confirm Password *"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, confirmPassword: e.target.value }));
                    // Clear confirm password error when typing
                    if (formErrors.confirmPassword) {
                      setFormErrors(prev => ({ ...prev, confirmPassword: '' }));
                    }
                  }}
                  variant="outlined"
                  disabled={useSystemPassword}
                  error={!!formErrors.confirmPassword}
                  helperText={formErrors.confirmPassword}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="toggle confirm password visibility"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          edge="end"
                        >
                          {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                {/* Regenerate Password Button (only when system password is enabled) */}
                {useSystemPassword && (
                  <Button
                    variant="outlined"
                    startIcon={<Refresh />}
                    onClick={() => {
                      const newPassword = generatePassword();
                      setFormData(prev => ({
                        ...prev,
                        password: newPassword,
                        confirmPassword: newPassword
                      }));
                    }}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    Regenerate Password
                  </Button>
                )}
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setModalOpen(false)} variant="outlined">
            Close
          </Button>
          {(modalMode === 'create' || modalMode === 'edit') && (
            <Button onClick={handleSubmit} variant="contained" disabled={isLoading}>
              {modalMode === 'create' ? 'Add Assignment' : 'Update Assignment'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={cancelDelete}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
        PaperProps={{
          sx: {
            backgroundColor: '#ffffff',
            minWidth: '400px',
          }
        }}
      >
        <DialogTitle 
          id="delete-dialog-title"
          sx={{ 
            color: '#d32f2f',
            fontWeight: 'bold',
          }}
        >
          Confirm Delete
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#333', mb: 2 }}>
            Are you sure you want to delete the SAP user <strong>"{userToDelete?.card_name || userToDelete?.username}"</strong>?
          </Typography>
          <Typography variant="body2" sx={{ color: '#666', mb: 1 }}>
            This will:
          </Typography>
          <Typography variant="body2" sx={{ color: '#666', ml: 2 }}>
            • Remove the vendor from the system
          </Typography>
          <Typography variant="body2" sx={{ color: '#666', ml: 2 }}>
            • Make the vendor available for new assignments
          </Typography>
          <Typography variant="body2" sx={{ color: '#666', ml: 2 }}>
            • Delete all associated data
          </Typography>
          <Typography variant="body2" sx={{ color: '#d32f2f', mt: 2, fontWeight: 'bold' }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button 
            onClick={cancelDelete}
            variant="outlined"
            sx={{ 
              color: '#666',
              borderColor: '#ddd',
              '&:hover': {
                borderColor: '#999',
                backgroundColor: '#f5f5f5',
              }
            }}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={confirmDelete}
            variant="contained"
            sx={{
              backgroundColor: '#d32f2f',
              color: '#ffffff',
              '&:hover': {
                backgroundColor: '#c62828',
              },
              '&:disabled': {
                backgroundColor: '#ffcdd2',
                color: '#ffffff',
              }
            }}
            disabled={isLoading}
          >
            {isLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <ToastContainer position="top-right" autoClose={5000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="light" toastStyle={{ backgroundColor: '#ffffff', color: '#333333' }} />
    </PageContainer>
  );
}
