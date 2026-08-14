import * as React from 'react';
import {
  Alert,
  Box,
  Button,
  Typography,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { GridToolbarContainer, GridToolbarColumnsButton } from '@mui/x-data-grid';
import { useAuth } from '../auth/AuthContext';
import { useApi } from '../hooks/useApi';
import ReusableDataTable from '../components/ReusableData';
import PageContainer from '../components/PageContainer';

const INITIAL_PAGE_SIZE = 10;

const isEnableQuantity = (value) => value === true || value === 1 || value === '1' || value === 'true';

// Custom toolbar with only columns button
function CustomToolbar() {
  return (
    <GridToolbarContainer>
      <GridToolbarColumnsButton 
        sx={{
          color: '#757575', // Light grey color to match default
          '&:hover': {
            color: '#424242', // Slightly darker on hover
            backgroundColor: 'rgba(0, 0, 0, 0.04)',
          },
        }}
      />
    </GridToolbarContainer>
  );
}

export default function RequestTypesManagement() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const { user } = useAuth();
  const { get, post, put, del } = useApi();

  // Permissions based on tab key 'requestTypes'
  const permKey = 'requestTypes';
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
  const [modalMode, setModalMode] = React.useState('view'); // 'create' | 'edit' | 'view'
  const [selectedRow, setSelectedRow] = React.useState(null);

  // Delete warning dialog state
  const [deleteWarningOpen, setDeleteWarningOpen] = React.useState(false);
  const [deleteWarningMessage, setDeleteWarningMessage] = React.useState('');
  const [rowToDelete, setRowToDelete] = React.useState(null);

  // Form state
  const [formData, setFormData] = React.useState({
    name: '',
    request_type: 'fixed', // 'manual' | 'fixed' | 'fees'
    enable_quantity: false,
  });

  // Request type options
  const requestTypeOptions = [
    { value: 'fixed', label: 'Fixed' },
    { value: 'manual', label: 'Manual' },
    { value: 'fees', label: 'Fees' },
  ];

  // Data load
  const loadRequestTypes = React.useCallback(async () => {
    if (!canRead) return;
    setError(null);
    setIsLoading(true);
    try {
      const data = await get('/api/request-types');
      if (data?.success && Array.isArray(data.data)) {
        setRowsState({ rows: data.data, rowCount: data.data.length });
      } else {
        throw new Error('Invalid data format');
      }
    } catch (e) {
      setError(e.message || 'Failed to load request types');
      toast.error('Failed to load request types');
    } finally {
      setIsLoading(false);
    }
  }, [get, canRead]);

  React.useEffect(() => {
    loadRequestTypes();
  }, [loadRequestTypes]);

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

  // Actions
  const handleCreate = React.useCallback(() => {
    if (!canCreate) return;
    setSelectedRow(null);
    setFormData({ name: '', request_type: 'fixed', enable_quantity: false });
    setModalMode('create');
    setModalOpen(true);
  }, [canCreate]);

  const handleView = React.useCallback((row) => {
    if (!canRead) return;
    setSelectedRow(row);
    setFormData({
      name: row.name || '',
      request_type: row.request_type || 'fixed',
      enable_quantity: isEnableQuantity(row.enable_quantity),
    });
    setModalMode('view');
    setModalOpen(true);
  }, [canRead]);

  const handleEdit = React.useCallback((row) => {
    if (!canUpdate) return;
    setSelectedRow(row);
    setFormData({
      name: row.name || '',
      request_type: row.request_type || 'fixed',
      enable_quantity: isEnableQuantity(row.enable_quantity),
    });
    setModalMode('edit');
    setModalOpen(true);
  }, [canUpdate]);

  const handleDelete = React.useCallback(async (row) => {
    if (!canDelete) return;
    
    // Set the row to delete and open confirmation dialog
    setRowToDelete(row);
    setDeleteWarningOpen(true);
  }, [canDelete]);

  const confirmDelete = React.useCallback(async () => {
    if (!rowToDelete) return;
    
    try {
      const response = await del(`/api/request-types/${rowToDelete.id}`);
      if (response?.success) {
        toast.success('Request type deleted successfully');
        loadRequestTypes();
        setDeleteWarningOpen(false);
        setRowToDelete(null);
        setDeleteWarningMessage('');
      }
    } catch (e) {
      // Parse error message from apiService (it throws JSON stringified error)
      let errorMessage = 'Delete failed';
      try {
        const errorData = JSON.parse(e.message);
        errorMessage = errorData.message || errorData.error || e.message;
      } catch {
        errorMessage = e.message || 'Delete failed';
      }
      
      // Check if the error message indicates the request type is in use
      if (errorMessage.includes('being used by') || errorMessage.includes('shopboard request')) {
        // Show warning dialog with the error message
        setDeleteWarningMessage(errorMessage);
      } else {
        // Show toast for other errors
        toast.error(errorMessage);
        setDeleteWarningOpen(false);
        setRowToDelete(null);
        setDeleteWarningMessage('');
      }
    }
  }, [rowToDelete, del, loadRequestTypes]);

  const handleRefresh = React.useCallback(() => {
    if (!isLoading && canRead) loadRequestTypes();
  }, [isLoading, canRead, loadRequestTypes]);

  // Submit
  const onSubmit = async () => {
    // Basic validation
    if (!formData.name || formData.name.trim() === '') {
      return toast.error('Name is required');
    }

    if (!formData.request_type) {
      return toast.error('Request type is required');
    }

    try {
      if (modalMode === 'create') {
        await post('/api/request-types', {
          name: formData.name.trim(),
          request_type: formData.request_type,
          enable_quantity: !!formData.enable_quantity,
        });
        toast.success('Request type created successfully');
        loadRequestTypes();
      } else if (modalMode === 'edit' && selectedRow) {
        await put(`/api/request-types/${selectedRow.id}`, {
          name: formData.name.trim(),
          request_type: formData.request_type,
          enable_quantity: !!formData.enable_quantity,
        });
        toast.success('Request type updated successfully');
        loadRequestTypes();
      }
      setModalOpen(false);
    } catch (e) {
      toast.error(e.message || 'Operation failed');
    }
  };

  // Columns
  const columns = React.useMemo(() => [
    { 
      field: 'id', 
      headerName: 'ID', 
      width: 80,
      flex: 0.5
    },
    { 
      field: 'name', 
      headerName: 'Name', 
      width: 300,
      flex: 1.5
    },
    { 
      field: 'request_type', 
      headerName: 'Type', 
      width: 150,
      flex: 1,
      renderCell: (params) => {
        const type = params.value || 'fixed';
        const typeConfig = {
          fixed: { label: 'Fixed', color: 'primary' },
          manual: { label: 'Manual', color: 'warning' },
          fees: { label: 'Fees', color: 'info' },
        };
        const config = typeConfig[type] || typeConfig.fixed;
        return (
          <Chip
            label={config.label}
            color={config.color}
            size="small"
            variant="outlined"
          />
        );
      }
    },
    {
      field: 'enable_quantity',
      headerName: 'Enable Quantity',
      width: 160,
      flex: 0.8,
      sortable: true,
      renderCell: (params) => (
        <Checkbox
          checked={isEnableQuantity(params.value)}
          disabled
          color="primary"
        />
      )
    },
    {
      field: 'created_at',
      headerName: 'Created At',
      width: 180,
      flex: 1,
      renderCell: (params) => {
        if (!params.value) return 'N/A';
        try {
          const date = new Date(params.value);
          return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
        } catch (e) {
          return 'N/A';
        }
      }
    },
  ], []);

  const pageTitle = 'Request Types Management';

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
        paginationMode="client"
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
        disableColumnFilter={true}
        disableColumnMenu={true}
        slots={{
          toolbar: CustomToolbar
        }}
      />

      <Dialog 
        open={modalOpen} 
        onClose={() => setModalOpen(false)} 
        aria-labelledby="request-type-dialog-title" 
        maxWidth="sm"
        fullWidth
        PaperProps={{ 
          sx: { 
            backgroundColor: '#ffffff',
            borderRadius: 2,
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
          } 
        }}
      >
        <DialogTitle 
          id="request-type-dialog-title" 
          sx={{ 
            fontWeight: 600,
            fontSize: '1.5rem',
            pb: 2,
            pt: 3,
            borderBottom: '1px solid #e0e0e0'
          }}
        >
          {modalMode === 'create' ? 'Create' : modalMode === 'edit' ? 'Edit' : 'View'} Request Type
        </DialogTitle>
        <DialogContent sx={{ pt: 4, pb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Name Field */}
            <TextField
              label="Name *"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              variant="outlined"
              fullWidth
              required
              disabled={modalMode === 'view'}
              error={modalMode !== 'view' && !formData.name.trim()}
              helperText={
                modalMode !== 'view' && !formData.name.trim()
                  ? 'Name is required'
                  : ''
              }
              sx={{ mt: 2 }}
            />

            {/* Request Type Field */}
            <FormControl fullWidth required sx={{ mt: 1 }}>
              <InputLabel id="request-type-select-label" shrink={!!formData.request_type}>
                Request Type *
              </InputLabel>
              <Select
                labelId="request-type-select-label"
                value={formData.request_type}
                onChange={(e) => setFormData(prev => ({ ...prev, request_type: e.target.value }))}
                label="Request Type *"
                disabled={modalMode === 'view'}
                notched={!!formData.request_type}
              >
                {requestTypeOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Checkbox
                  checked={!!formData.enable_quantity}
                  onChange={(e) => setFormData(prev => ({ ...prev, enable_quantity: e.target.checked }))}
                  disabled={modalMode === 'view'}
                  color="primary"
                />
              }
              label="Enable Quantity"
            />

            {/* Info Box */}
            <Box sx={{ 
              p: 2, 
              backgroundColor: '#f5f5f5', 
              borderRadius: 1,
              border: '1px solid #e0e0e0'
            }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                Request Type Information:
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Fixed:</strong> Price is calculated based on area (width × height × price per sqft)
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Manual:</strong> Price per sqft can be edited manually, calculated as area × price per sqft
              </Typography>
              <Typography variant="body2">
                <strong>Fees:</strong>User can manually add this price regardless of dimensions (width/height are 0)
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2, borderTop: '1px solid #e0e0e0', gap: 1 }}>
          <Button 
            onClick={() => setModalOpen(false)} 
            variant="outlined"
            sx={{ minWidth: 100 }}
          >
            Close
          </Button>
          {(modalMode === 'create' || modalMode === 'edit') && (
            <Button 
              onClick={onSubmit} 
              variant="contained" 
              disabled={isLoading || !formData.name.trim() || !formData.request_type}
              sx={{ minWidth: 100 }}
            >
              {modalMode === 'create' ? 'Create' : 'Update'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Delete Warning Dialog */}
      <Dialog
        open={deleteWarningOpen}
        onClose={() => {
          setDeleteWarningOpen(false);
          setRowToDelete(null);
          setDeleteWarningMessage('');
        }}
        aria-labelledby="delete-warning-dialog-title"
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#ffffff',
            borderRadius: 2,
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
          }
        }}
      >
        <DialogTitle
          id="delete-warning-dialog-title"
          sx={{
            fontWeight: 600,
            fontSize: '1.25rem',
            pb: 2,
            pt: 3,
            borderBottom: '1px solid #e0e0e0',
            color: deleteWarningMessage ? 'error.main' : 'warning.main'
          }}
        >
          {deleteWarningMessage ? '⚠️ Cannot Delete Request Type' : 'Confirm Delete'}
        </DialogTitle>
        <DialogContent sx={{ pt: 3, pb: 2 }}>
          {deleteWarningMessage ? (
            <Box>
              <Alert severity="error" sx={{ mb: 2 }}>
                <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
                  {deleteWarningMessage}
                </Typography>
                <Typography variant="body2" sx={{ color: '#666' }}>
                  This request type cannot be deleted because it is already attached to one or more shopboard requests. 
                  Please remove it from all shopboard requests before attempting to delete it.
                </Typography>
              </Alert>
            </Box>
          ) : (
            <Typography sx={{ color: '#333' }}>
              Are you sure you want to delete request type <strong>"{rowToDelete?.name}"</strong>?
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2, borderTop: '1px solid #e0e0e0', gap: 1 }}>
          <Button
            onClick={() => {
              setDeleteWarningOpen(false);
              setRowToDelete(null);
              setDeleteWarningMessage('');
            }}
            variant="outlined"
            sx={{ minWidth: 100 }}
          >
            {deleteWarningMessage ? 'Close' : 'Cancel'}
          </Button>
          {!deleteWarningMessage && (
            <Button
              onClick={confirmDelete}
              variant="contained"
              color="error"
              sx={{ minWidth: 100 }}
            >
              Delete
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <ToastContainer position="top-right" autoClose={5000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="light" toastStyle={{ backgroundColor: '#ffffff', color: '#333333' }} />
    </PageContainer>
  );
}

