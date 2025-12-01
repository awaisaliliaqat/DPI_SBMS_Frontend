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
  Paper,
  Divider,
  Chip,
  Grid,
  IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from '../auth/AuthContext';
import { useApi } from '../hooks/useApi';
import ReusableDataTable from '../components/ReusableData';
import PageContainer from '../components/PageContainer';

const INITIAL_PAGE_SIZE = 10;

export default function RequestItemsAdjustment() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const { user } = useAuth();
  const { get, post, put, del } = useApi();

  // Permissions based on tab key 'requestPriceAdjustment'
  const permKey = 'requestPriceAdjustment';
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

  // Form state
  const [vendors, setVendors] = React.useState([]);
  const [requestTypes, setRequestTypes] = React.useState([]);
  const [formData, setFormData] = React.useState({
    user_id: '',
    requestItems: [], // Array of { request_type_id, price }
  });
  // Track original items when edit modal opens (to detect removals)
  const [originalRequestItems, setOriginalRequestItems] = React.useState([]);

  // Load all dropdown data (vendors + request types) - for create modal
  // Only loads vendors that don't have active pricing (exclude_with_pricing=true)
  const loadDropdowns = React.useCallback(async () => {
    try {
      const [vendorsRes, reqTypesRes] = await Promise.all([
        get('/api/users/vendors?exclude_with_pricing=true'),
        get('/api/request-types')
      ]);
      if (vendorsRes?.success && Array.isArray(vendorsRes.data)) {
        setVendors(vendorsRes.data);
      }
      if (reqTypesRes?.success && Array.isArray(reqTypesRes.data)) {
        setRequestTypes(reqTypesRes.data);
      }
    } catch (e) {
      console.error('Error loading dropdowns:', e);
      toast.error('Failed to load dropdown data');
    }
  }, [get]);

  // Load only request types - for edit/view modal (vendor is already known)
  const loadRequestTypes = React.useCallback(async () => {
    try {
      const reqTypesRes = await get('/api/request-types');
      if (reqTypesRes?.success && Array.isArray(reqTypesRes.data)) {
        setRequestTypes(reqTypesRes.data);
      }
    } catch (e) {
      console.error('Error loading request types:', e);
      toast.error('Failed to load request types');
    }
  }, [get]);

  // Dropdowns will be loaded only when modal opens (in handleCreate, handleView, handleEdit)

  // Data load
  const loadPricing = React.useCallback(async () => {
    if (!canRead) return;
    setError(null);
    setIsLoading(true);
    try {
      const data = await get('/api/vendor-request-pricing');
      // API returns { success, data } - data is grouped by vendor
      const rows = (data?.data || []).map((vendor, index) => ({
        ...vendor,
        id: vendor.vendor_id || `vendor-${index}`, // Use vendor_id as unique ID for the row
      }));
      console.log('Loaded pricing data (grouped by vendor):', rows);
      setRowsState({ rows, rowCount: rows.length });
    } catch (e) {
      setError(e.message || 'Failed to load');
      toast.error('Failed to load pricing');
    } finally {
      setIsLoading(false);
    }
  }, [get, canRead]);

  React.useEffect(() => {
    loadPricing();
  }, [loadPricing]);

  // Update prices for fixed/fees types when requestTypes are loaded
  React.useEffect(() => {
    if (modalOpen && requestTypes.length > 0 && formData.requestItems.length > 0) {
      const updatedItems = formData.requestItems.map(item => {
        const requestType = requestTypes.find(rt => rt.id === item.request_type_id);
        const isFixedOrFees = requestType?.request_type === 'manual' || requestType?.request_type === 'fees';
        if (isFixedOrFees) {
          return { ...item, price: '0' };
        }
        return item;
      });
      
      // Only update if there were changes
      const hasChanges = updatedItems.some((item, index) => {
        const original = formData.requestItems[index];
        return item.price !== original.price;
      });
      
      if (hasChanges) {
        setFormData(prev => ({ ...prev, requestItems: updatedItems }));
      }
    }
  }, [requestTypes, modalOpen]); // Only depend on requestTypes and modalOpen

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
    setFormData({ user_id: '', requestItems: [] });
    setOriginalRequestItems([]); // No original items for create mode
    setModalMode('create');
    setModalOpen(true);
    // Load dropdowns when modal opens
    loadDropdowns();
  }, [canCreate, loadDropdowns]);

  const handleView = React.useCallback((row) => {
    if (!canRead) return;
    // Use data directly from row - no API call needed
    setSelectedRow(row);
    setFormData({
      user_id: row.user_id || '',
      requestItems: (row.requestItems || []).map(item => ({
        request_type_id: item.request_type_id,
        price: item.price ?? '',
      })),
    });
    setOriginalRequestItems([]); // No need to track for view mode
    setModalMode('view');
    setModalOpen(true);
    // Only load request types (vendor is already known and can't be changed)
    loadRequestTypes();
  }, [canRead, loadRequestTypes]);

  const handleEdit = React.useCallback((row) => {
    if (!canUpdate) return;
    // Use data directly from row - no API call needed
    setSelectedRow(row);
    const initialItems = (row.requestItems || []).map(item => ({
      request_type_id: item.request_type_id,
      price: item.price ?? '',
      id: item.id, // Store the database ID for tracking removals
    }));
    setFormData({
      user_id: row.user_id || '',
      requestItems: initialItems,
    });
    // Store original items to track what was removed
    setOriginalRequestItems(initialItems.map(item => ({
      request_type_id: item.request_type_id,
      id: item.id,
    })));
    setModalMode('edit');
    setModalOpen(true);
    // Only load request types (vendor is already known and can't be changed)
    loadRequestTypes();
  }, [canUpdate, loadRequestTypes]);

  const handleDelete = React.useCallback(async (row) => {
    if (!canDelete) return;
    // Confirm deletion
    if (!window.confirm(`Are you sure you want to delete all pricing for vendor ${row.vendor_name || row.vendor_id}?`)) {
      return;
    }
    try {
      // Delete all active items for this vendor
      if (row.requestItems && row.requestItems.length > 0) {
        await Promise.all(
          row.requestItems.map(item => 
            del(`/api/vendor-request-pricing/${item.id}`).catch(() => null)
          )
        );
      }
      toast.success('Deleted successfully');
      loadPricing();
    } catch (e) {
      toast.error(e.message || 'Delete failed');
    }
  }, [canDelete, del, loadPricing]);

  const handleRefresh = React.useCallback(() => {
    if (!isLoading && canRead) loadPricing();
  }, [isLoading, canRead, loadPricing]);

  // Submit
  const onSubmit = async () => {
    // Basic validation
    if (!formData.user_id) return toast.error('Vendor is required');
    if (!formData.requestItems || formData.requestItems.length === 0) {
      return toast.error('At least one request type is required');
    }

    // Validate that all items have prices (skip fixed/fees types as they're always 0)
    const invalidItems = formData.requestItems.filter(item => {
      const requestType = requestTypes.find(rt => rt.id === item.request_type_id);
      const isFixedOrFees = requestType?.request_type === 'manual' || requestType?.request_type === 'fees';
      // Skip validation for fixed/fees types
      if (isFixedOrFees) return false;
      return !item.price || item.price === '';
    });
    if (invalidItems.length > 0) {
      return toast.error('Please provide a price for all selected request types');
    }

    // Prepare request items with proper format
    const requestItems = formData.requestItems.map(item => {
      const requestType = requestTypes.find(rt => rt.id === item.request_type_id);
      const isFixedOrFees = requestType?.request_type === 'manual' || requestType?.request_type === 'fees';
      return {
        request_type_id: item.request_type_id,
        price: isFixedOrFees ? 0 : (item.price === '' ? null : Number(item.price)),
      };
    });

    // Calculate removed items (only for edit mode)
    let removedItems = [];
    if (modalMode === 'edit' && originalRequestItems.length > 0) {
      const currentRequestTypeIds = formData.requestItems.map(item => item.request_type_id);
      removedItems = originalRequestItems
        .filter(original => !currentRequestTypeIds.includes(original.request_type_id))
        .map(original => ({
          id: original.id,
          request_type_id: original.request_type_id,
        }));
    }

    try {
      if (modalMode === 'create') {
        await post('/api/vendor-request-pricing', {
          user_id: formData.user_id,
          requestItems: requestItems,
        });
        toast.success('Created successfully');
        loadPricing();
      } else if (modalMode === 'edit' && selectedRow) {
        // For edit, send both new/updated items and removed items
        await post('/api/vendor-request-pricing', {
          user_id: formData.user_id,
          requestItems: requestItems,
          removedItems: removedItems, // Send removed items to backend
        });
        toast.success('Updated successfully');
        loadPricing();
      }
      setModalOpen(false);
    } catch (e) {
      toast.error(e.message || 'Operation failed');
    }
  };

  // Handle request type selection change
  const handleRequestTypesChange = React.useCallback((selectedTypes) => {
    const selectedIds = selectedTypes.map(t => t.id);
    const currentIds = formData.requestItems.map(item => item.request_type_id);
    
    // Find newly added types
    const newTypes = selectedIds.filter(id => !currentIds.includes(id));
    // Find removed types
    const removedIds = currentIds.filter(id => !selectedIds.includes(id));
    
    // Update requestItems: remove deleted, keep existing, add new
    let updatedItems = formData.requestItems
      .filter(item => !removedIds.includes(item.request_type_id))
      .map(item => {
        // Check if this item's request type is fixed or fees, set price to 0
        const requestType = requestTypes.find(rt => rt.id === item.request_type_id);
        const isFixedOrFees = requestType?.request_type === 'manual' || requestType?.request_type === 'fees';
        return {
          ...item,
          price: isFixedOrFees ? '0' : item.price
        };
      });
    
    // Add new items
    newTypes.forEach(id => {
      const requestType = requestTypes.find(rt => rt.id === id);
      const isFixedOrFees = requestType?.request_type === 'manual' || requestType?.request_type === 'fees';
      updatedItems.push({ 
        request_type_id: id, 
        price: isFixedOrFees ? '0' : '' 
      });
    });
    
    setFormData(prev => ({ ...prev, requestItems: updatedItems }));
  }, [formData.requestItems, requestTypes]);

  // Handle price change for a specific request type
  const handlePriceChange = React.useCallback((requestTypeId, price) => {
    setFormData(prev => ({
      ...prev,
      requestItems: prev.requestItems.map(item =>
        item.request_type_id === requestTypeId
          ? { ...item, price: price }
          : item
      ),
    }));
  }, []);

  // Remove a request item
  const handleRemoveItem = React.useCallback((requestTypeId) => {
    setFormData(prev => ({
      ...prev,
      requestItems: prev.requestItems.filter(item => item.request_type_id !== requestTypeId),
    }));
  }, []);

  // Columns - Grouped by vendor
  const columns = React.useMemo(() => [
    { 
      field: 'vendor_id', 
      headerName: 'Vendor Code', 
      width: 140,
      flex: 0.8
    },
    { 
      field: 'vendor_name', 
      headerName: 'Vendor Name', 
      width: 250,
      flex: 1.2
    },
  ], []);

  const pageTitle = 'Request Items Adjustment';

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
      />

      <Dialog 
        open={modalOpen} 
        onClose={() => {
          setModalOpen(false);
          setOriginalRequestItems([]); // Reset when modal closes
        }} 
        aria-labelledby="pricing-dialog-title" 
        maxWidth="md"
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
          id="pricing-dialog-title" 
          sx={{ 
            fontWeight: 600,
            fontSize: '1.5rem',
            pb: 1,
            borderBottom: '1px solid #e0e0e0'
          }}
        >
          {modalMode === 'create' ? 'Create' : modalMode === 'edit' ? 'Edit' : 'View'} Request Items Pricing
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Vendor Selection */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 500, color: 'text.secondary' }}>
                Vendor Information
              </Typography>
              {modalMode === 'create' ? (
                <Autocomplete
                  options={vendors}
                  getOptionLabel={(option) => option.name || ''}
                  isOptionEqualToValue={(option, value) => String(option.user_id) === String(value?.user_id)}
                  value={
                    formData.user_id 
                      ? vendors.find(x => String(x.user_id) === String(formData.user_id)) || null
                      : null
                  }
                  onChange={(event, newValue) => {
                    setFormData(prev => ({ ...prev, user_id: newValue?.user_id || '' }));
                  }}
                  renderInput={(params) => (
                    <TextField 
                      {...params} 
                      label="Vendor *" 
                      variant="outlined" 
                      required 
                      fullWidth
                    />
                  )}
                  loading={vendors.length === 0}
                  loadingText="Loading vendors..."
                  noOptionsText="No vendors found"
                  fullWidth
                />
              ) : (
                <TextField
                  label="Vendor"
                  value={`${selectedRow?.vendor_name || ''} (${selectedRow?.vendor_id || ''})`}
                  variant="outlined"
                  fullWidth
                  disabled
                />
              )}
            </Box>

            <Divider />

            {/* Request Types Selection */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 500, color: 'text.secondary' }}>
                Request Types & Pricing
              </Typography>
              <Autocomplete
                multiple
                options={requestTypes}
                getOptionLabel={(o) => o.name || ''}
                isOptionEqualToValue={(opt, val) => String(opt.id) === String(val.id)}
                value={
                  formData.requestItems.length > 0
                    ? requestTypes.filter(x => 
                        formData.requestItems.some(item => item.request_type_id === x.id)
                      )
                    : []
                }
                onChange={(e, newValue) => handleRequestTypesChange(newValue)}
                renderInput={(params) => (
                  <TextField 
                    {...params} 
                    label="Select Request Types *" 
                    variant="outlined" 
                    required 
                    placeholder="Select one or more request types"
                    fullWidth
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      label={option.name}
                      {...getTagProps({ index })}
                      key={option.id}
                      sx={{ mb: 0.5 }}
                    />
                  ))
                }
                disabled={modalMode === 'view'}
                fullWidth
              />
            </Box>

            {/* Individual Price Inputs */}
            {formData.requestItems.length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 500, color: 'text.secondary' }}>
                  Set Prices for Each Request Type
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {formData.requestItems.map((item, idx) => {
                    const requestType = requestTypes.find(rt => rt.id === item.request_type_id);
                    const originalItem = selectedRow?.requestItems?.find(ri => ri.request_type_id === item.request_type_id);
                    const isFixedOrFees = requestType?.request_type === 'manual' || requestType?.request_type === 'fees';
                    return (
                      <Paper
                        key={item.request_type_id}
                        elevation={0}
                        sx={{
                          p: 2,
                          border: '1px solid #e0e0e0',
                          borderRadius: 1,
                          backgroundColor: '#fafafa',
                          '&:hover': {
                            backgroundColor: '#f5f5f5',
                          },
                        }}
                      >
                        <Grid container spacing={2} alignItems="center">
                          <Grid item xs={isFixedOrFees ? 10 : 12} sm={isFixedOrFees ? 4 : 4}>
                            <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary', mb: 0.5 }}>
                              {requestType?.name || 'Unknown Request Type'}
                            </Typography>
                            {isFixedOrFees && (
                              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                                Price: 0 (automatically set)
                              </Typography>
                            )}
                            {originalItem && (
                              <Box sx={{ mt: 1 }}>
                                <Typography variant="caption" color="text.secondary" display="block">
                                  From: {originalItem.from_date || 'N/A'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" display="block">
                                  To: {originalItem.to_date || 'Active'}
                                </Typography>
                              </Box>
                            )}
                          </Grid>
                          {!isFixedOrFees && (
                            <Grid item xs={10} sm={7}>
                              <TextField
                                label="Price"
                                type="number"
                                value={item.price}
                                onChange={(e) => {
                                  handlePriceChange(item.request_type_id, e.target.value);
                                }}
                                variant="outlined"
                                size="small"
                                fullWidth
                                inputProps={{ step: '0.01', min: '0' }}
                                disabled={modalMode === 'view'}
                                required
                                error={modalMode !== 'view' && (!item.price || item.price === '')}
                                helperText={
                                  modalMode !== 'view' && (!item.price || item.price === '')
                                    ? 'Price is required'
                                    : ''
                                }
                              />
                            </Grid>
                          )}
                          {modalMode !== 'view' && (
                            <Grid item xs={2} sm={1}>
                              <IconButton
                                onClick={() => handleRemoveItem(item.request_type_id)}
                                color="error"
                                size="small"
                                sx={{ 
                                  '&:hover': { 
                                    backgroundColor: 'error.light',
                                    color: 'error.contrastText'
                                  } 
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Grid>
                          )}
                        </Grid>
                      </Paper>
                    );
                  })}
                </Box>
              </Box>
            )}
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
              disabled={isLoading}
              sx={{ minWidth: 100 }}
            >
              {modalMode === 'create' ? 'Create' : 'Update'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <ToastContainer position="top-right" autoClose={5000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="light" toastStyle={{ backgroundColor: '#ffffff', color: '#333333' }} />
    </PageContainer>
  );
}