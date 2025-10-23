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
} from '@mui/material';
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
    vendor_id: '',
    request_type_id: '',
    lump_sum_price: '',
    from_date: '',
  });

  // Load dropdown data
  const loadDropdowns = React.useCallback(async () => {
    try {
      const [vendorsRes, reqTypesRes] = await Promise.all([
        get('/api/sap/vendors'),
        get('/api/request-types')
      ]);
      if (vendorsRes?.success && Array.isArray(vendorsRes.data)) {
        setVendors(vendorsRes.data);
        console.log('Vendors loaded:', vendorsRes.data.length, 'vendors');
        console.log('First vendor:', vendorsRes.data[0]);
      } else {
        console.log('Vendors response:', vendorsRes);
      }
      if (reqTypesRes?.success && Array.isArray(reqTypesRes.data)) {
        setRequestTypes(reqTypesRes.data);
      }
    } catch (e) {
      console.error('Error loading dropdowns:', e);
      console.error('Error details:', e.message);
      toast.error('Failed to load vendors');
    }
  }, [get]);

  // Load dropdowns when component mounts
  React.useEffect(() => {
    loadDropdowns();
  }, [loadDropdowns]);

  // Data load
  const loadPricing = React.useCallback(async () => {
    if (!canRead) return;
    setError(null);
    setIsLoading(true);
    try {
      const data = await get('/api/vendor-request-pricing');
      // API returns { success, data }
      const rows = data?.data || [];
      console.log('Loaded pricing data:', rows);
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
    setFormData({ vendor_id: '', request_type_id: '', lump_sum_price: '', from_date: '' });
    setModalMode('create');
    setModalOpen(true);
    // Load dropdowns when modal opens
    loadDropdowns();
  }, [canCreate, loadDropdowns]);

  const handleView = React.useCallback((row) => {
    if (!canRead) return;
    setSelectedRow(row);
    setFormData({
      vendor_id: row.vendor_id,
      request_type_id: row.request_type_id,
      lump_sum_price: row.lump_sum_price ?? '',
      from_date: row.from_date,
    });
    setModalMode('view');
    setModalOpen(true);
    // Load dropdowns when modal opens
    loadDropdowns();
  }, [canRead, loadDropdowns]);

  const handleEdit = React.useCallback((row) => {
    if (!canUpdate) return;
    setSelectedRow(row);
    setFormData({
      vendor_id: row.vendor_id,
      request_type_id: row.request_type_id,
      lump_sum_price: row.lump_sum_price ?? '',
      from_date: row.from_date,
    });
    setModalMode('edit');
    setModalOpen(true);
    // Load dropdowns when modal opens
    loadDropdowns();
  }, [canUpdate, loadDropdowns]);

  const handleDelete = React.useCallback(async (row) => {
    if (!canDelete) return;
    try {
      await del(`/api/vendor-request-pricing/${row.id}`);
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
    if (!formData.vendor_id) return toast.error('Vendor is required');
    if (!formData.request_type_id) return toast.error('Request type is required');
    if (!formData.from_date) return toast.error('From date is required');

    try {
      if (modalMode === 'create') {
        await post('/api/vendor-request-pricing', {
          vendor_id: formData.vendor_id,
          request_type_id: formData.request_type_id,
          lump_sum_price: formData.lump_sum_price === '' ? null : Number(formData.lump_sum_price),
          from_date: formData.from_date,
        });
        toast.success('Created successfully');
        loadPricing();
      } else if (modalMode === 'edit' && selectedRow) {
        await put(`/api/vendor-request-pricing/${selectedRow.id}`, {
          lump_sum_price: formData.lump_sum_price === '' ? null : Number(formData.lump_sum_price),
          from_date: formData.from_date,
        });
        toast.success('Updated successfully');
        loadPricing();
      }
      setModalOpen(false);
    } catch (e) {
      toast.error(e.message || 'Operation failed');
    }
  };

  // Columns - SIMPLIFIED VERSION
  const columns = React.useMemo(() => [
    { 
      field: 'id', 
      headerName: 'ID', 
      width: 80 
    },
    { 
      field: 'vendor_id', 
      headerName: 'Vendor Code', 
      width: 120
    },
    { 
      field: 'vendor_name', 
      headerName: 'Vendor Name', 
      width: 200,
      renderCell: (params) => {
        // Use the vendor_name from the API response directly
        return params.row.vendor_name || 'N/A';
      }
    },
    { 
      field: 'request_type_name', 
      headerName: 'Request Type', 
      width: 200,
      renderCell: (params) => params.row?.requestType?.name || 'N/A'
    },
    { 
      field: 'lump_sum_price', 
      headerName: 'Price', 
      width: 160,
      renderCell: (params) => params.row?.lump_sum_price == null ? '' : Number(params.row.lump_sum_price).toFixed(2)
    },
    { 
      field: 'from_date', 
      headerName: 'From Date', 
      width: 140 
    },
    // { 
    //   field: 'to_date', 
    //   headerName: 'To Date', 
    //   width: 140,
    //   renderCell: (params) => params.row?.to_date ? String(params.row.to_date) : '-'
    // },
  ], [vendors]);

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

      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} aria-labelledby="pricing-dialog-title" PaperProps={{ sx: { backgroundColor: '#ffffff', minWidth: '520px', maxWidth: '720px' } }}>
        <DialogTitle id="pricing-dialog-title" sx={{ fontWeight: 'bold' }}>
          {modalMode === 'create' ? 'Create' : modalMode === 'edit' ? 'Edit' : 'View'} Pricing
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {/* Debug info */}
            {process.env.NODE_ENV === 'development' && (
              <Typography variant="caption" color="text.secondary">
                Debug: {vendors.length} vendors loaded
                {vendors.length === 0 && ' - Check console for errors'}
              </Typography>
            )}
            <Autocomplete
              options={vendors}
              getOptionLabel={(option) => option.name || ''}
              isOptionEqualToValue={(option, value) => String(option.id) === String(value.id)}
              value={
                formData.vendor_id 
                  ? vendors.find(x => String(x.id) === String(formData.vendor_id)) || null
                  : null
              }
              onChange={(event, newValue) => {
                console.log('Vendor selected:', newValue);
                setFormData(prev => ({ ...prev, vendor_id: newValue?.id || '' }));
              }}
              renderInput={(params) => (
                <TextField 
                  {...params} 
                  label={`Vendor * (${vendors.length} available)`} 
                  variant="outlined" 
                  required 
                />
              )}
              disabled={modalMode !== 'create'}
              loading={vendors.length === 0}
              loadingText="Loading vendors..."
              noOptionsText="No vendors found"
              freeSolo={false}
              selectOnFocus
              clearOnBlur
              handleHomeEndKeys
              openOnFocus
            />
            <Autocomplete
              options={requestTypes}
              getOptionLabel={(o) => o.name || ''}
              isOptionEqualToValue={(opt, val) => String(opt.id) === String(val.id)}
              value={
                requestTypes.find(x => String(x.id) === String(formData.request_type_id))
                || (selectedRow?.requestType ? { id: selectedRow.requestType.id, name: selectedRow.requestType.name } : null)
              }
              onChange={(e, v) => setFormData(prev => ({ ...prev, request_type_id: v?.id || '' }))}
              renderInput={(params) => <TextField {...params} label="Request Type *" variant="outlined" required />} 
              disabled={modalMode !== 'create'}
            />
            <TextField
              label="Total Price"
              type="number"
              value={formData.lump_sum_price}
              onChange={(e) => setFormData(prev => ({ ...prev, lump_sum_price: e.target.value }))}
              variant="outlined"
              inputProps={{ step: '0.01', min: '0' }}
              disabled={modalMode === 'view'}
            />
            <TextField
              label="From Date *"
              type="date"
              value={formData.from_date}
              onChange={(e) => setFormData(prev => ({ ...prev, from_date: e.target.value }))}
              variant="outlined"
              InputLabelProps={{ shrink: true }}
              disabled={modalMode === 'view'}
            />
            {selectedRow?.to_date && (
              <TextField label="To Date" value={selectedRow.to_date} disabled />
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setModalOpen(false)} variant="outlined">Close</Button>
          {(modalMode === 'create' || modalMode === 'edit') && (
            <Button onClick={onSubmit} variant="contained" disabled={isLoading}>
              {modalMode === 'create' ? 'Create' : 'Update'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <ToastContainer position="top-right" autoClose={5000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="light" toastStyle={{ backgroundColor: '#ffffff', color: '#333333' }} />
    </PageContainer>
  );
}