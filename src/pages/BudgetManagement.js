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
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
} from '@mui/material';
import {
  Assessment as StatsIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { GridActionsCellItem } from '@mui/x-data-grid';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { GridToolbarContainer, GridToolbarColumnsButton } from '@mui/x-data-grid';
import { useAuth } from '../auth/AuthContext';
import { useApi } from '../hooks/useApi';
import ReusableDataTable from '../components/ReusableData';
import PageContainer from '../components/PageContainer';

const INITIAL_PAGE_SIZE = 10;

// Custom toolbar with only columns button
function CustomToolbar() {
  return (
    <GridToolbarContainer>
      <GridToolbarColumnsButton 
        sx={{
          color: '#757575',
          '&:hover': {
            color: '#424242',
            backgroundColor: 'rgba(0, 0, 0, 0.04)',
          },
        }}
      />
    </GridToolbarContainer>
  );
}

export default function BudgetManagement() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const { user } = useAuth();
  const { get, post, put, del } = useApi();

  // Permissions based on tab key 'budgetManagement'
  const permKey = 'budgetManagement';
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
  const [rowToDelete, setRowToDelete] = React.useState(null);

  // Stats modal state
  const [statsModalOpen, setStatsModalOpen] = React.useState(false);
  const [statsData, setStatsData] = React.useState(null);
  const [loadingStats, setLoadingStats] = React.useState(false);

  // Form state
  const [formData, setFormData] = React.useState({
    year: '',
    total_budget: '',
  });

  // Data load
  const loadBudgets = React.useCallback(async () => {
    if (!canRead) return;
    setError(null);
    setIsLoading(true);
    try {
      const data = await get('/api/budget-management');
      if (data?.success && Array.isArray(data.data)) {
        setRowsState({ rows: data.data, rowCount: data.data.length });
      } else {
        throw new Error('Invalid data format');
      }
    } catch (e) {
      setError(e.message || 'Failed to load budgets');
      toast.error('Failed to load budgets');
    } finally {
      setIsLoading(false);
    }
  }, [get, canRead]);

  React.useEffect(() => {
    loadBudgets();
  }, [loadBudgets]);

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
    setFormData({ year: '', total_budget: '' });
    setModalMode('create');
    setModalOpen(true);
  }, [canCreate]);

  const handleView = React.useCallback((row) => {
    if (!canRead) return;
    setSelectedRow(row);
    setFormData({
      year: row.year ? String(row.year) : '',
      total_budget: row.total_budget ? String(row.total_budget) : '',
    });
    setModalMode('view');
    setModalOpen(true);
  }, [canRead]);

  const handleEdit = React.useCallback((row) => {
    if (!canUpdate) return;
    setSelectedRow(row);
    setFormData({
      year: row.year ? String(row.year) : '',
      total_budget: row.total_budget ? String(row.total_budget) : '',
    });
    setModalMode('edit');
    setModalOpen(true);
  }, [canUpdate]);

  const handleDelete = React.useCallback(async (row) => {
    if (!canDelete) return;
    setRowToDelete(row);
    setDeleteWarningOpen(true);
  }, [canDelete]);

  const confirmDelete = React.useCallback(async () => {
    if (!rowToDelete) return;
    
    try {
      const response = await del(`/api/budget-management/${rowToDelete.id}`);
      if (response?.success) {
        toast.success('Budget deleted successfully');
        loadBudgets();
        setDeleteWarningOpen(false);
        setRowToDelete(null);
      }
    } catch (e) {
      let errorMessage = 'Delete failed';
      try {
        const errorData = JSON.parse(e.message);
        errorMessage = errorData.message || errorData.error || e.message;
      } catch {
        errorMessage = e.message || 'Delete failed';
      }
      toast.error(errorMessage);
      setDeleteWarningOpen(false);
      setRowToDelete(null);
    }
  }, [rowToDelete, del, loadBudgets]);

  const handleRefresh = React.useCallback(() => {
    if (!isLoading && canRead) loadBudgets();
  }, [isLoading, canRead, loadBudgets]);

  // Handle Stats button click
  const handleStats = React.useCallback(async (row) => {
    if (!canRead) return;
    setStatsModalOpen(true);
    setLoadingStats(true);
    setStatsData(null);
    
    try {
      const response = await get(`/api/budget-management/${row.id}/stats`);
      if (response?.success && response.data) {
        setStatsData(response.data);
      } else {
        throw new Error('Failed to load stats');
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      toast.error('Failed to load monthly budget statistics');
    } finally {
      setLoadingStats(false);
    }
  }, [canRead, get]);

  // Submit
  const onSubmit = async () => {
    // Basic validation
    const yearStr = String(formData.year || '').trim();
    if (!yearStr) {
      return toast.error('Year is required');
    }

    if (!formData.total_budget || parseFloat(formData.total_budget) <= 0) {
      return toast.error('Total budget must be greater than 0');
    }

    // Validate year
    const yearNum = parseInt(yearStr, 10);
    if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
      return toast.error('Year must be a valid year between 2000 and 2100');
    }

    try {
      if (modalMode === 'create') {
        await post('/api/budget-management', {
          year: yearNum,
          total_budget: parseFloat(formData.total_budget),
        });
        toast.success('Budget created successfully with 12 monthly budgets');
        loadBudgets();
      } else if (modalMode === 'edit' && selectedRow) {
        await put(`/api/budget-management/${selectedRow.id}`, {
          total_budget: parseFloat(formData.total_budget),
        });
        toast.success('Budget updated successfully');
        loadBudgets();
      }
      setModalOpen(false);
    } catch (e) {
      let errorMessage = 'Operation failed';
      try {
        const errorData = JSON.parse(e.message);
        errorMessage = errorData.message || errorData.error || e.message;
      } catch {
        errorMessage = e.message || 'Operation failed';
      }
      toast.error(errorMessage);
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
      field: 'year', 
      headerName: 'Year', 
      width: 150,
      flex: 1
    },
    { 
      field: 'total_budget', 
      headerName: 'Total Budget', 
      width: 200,
      flex: 1.5,
      renderCell: (params) => {
        const value = params.value || 0;
        return `Rs ${parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
    },
    {
      field: 'monthlyBudgets',
      headerName: 'Monthly Budgets',
      width: 200,
      flex: 1.5,
      renderCell: (params) => {
        const monthlyBudgets = params.value || [];
        if (monthlyBudgets.length === 0) return 'N/A';
        const monthlyAmount = monthlyBudgets[0]?.month_budget || 0;
        return `Rs ${parseFloat(monthlyAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per month`;
      }
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
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
      width: 250,
      getActions: (params) => {
        const actions = [];
        
        if (canRead) {
          actions.push(
            <GridActionsCellItem
              key="stats"
              icon={<StatsIcon />}
              label="Stats"
              onClick={() => handleStats(params.row)}
              color="primary"
            />
          );
        }
        
        if (canUpdate) {
          actions.push(
            <GridActionsCellItem
              key="edit"
              icon={<EditIcon />}
              label="Edit"
              onClick={() => handleEdit(params.row)}
              color="info"
            />
          );
        }
        
        if (canDelete) {
          actions.push(
            <GridActionsCellItem
              key="delete"
              icon={<DeleteIcon />}
              label="Delete"
              onClick={() => handleDelete(params.row)}
              color="error"
            />
          );
        }
        
        return actions;
      },
    },
  ], [canRead, handleStats]);

  const pageTitle = 'Budget Management';

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
        onView={null}
        onEdit={null}
        onDelete={null}
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
        aria-labelledby="budget-dialog-title" 
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
          id="budget-dialog-title" 
          sx={{ 
            fontWeight: 600,
            fontSize: '1.5rem',
            pb: 2,
            pt: 3,
            borderBottom: '1px solid #e0e0e0'
          }}
        >
          {modalMode === 'create' ? 'Create' : modalMode === 'edit' ? 'Edit' : 'View'} Yearly Budget
        </DialogTitle>
        <DialogContent sx={{ pt: 4, pb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Year Field */}
            <TextField
              label="Year *"
              type="number"
              value={formData.year}
              onChange={(e) => setFormData(prev => ({ ...prev, year: e.target.value }))}
              variant="outlined"
              fullWidth
              required
              disabled={modalMode === 'view' || modalMode === 'edit'}
              error={modalMode !== 'view' && (!String(formData.year || '').trim() || parseInt(String(formData.year || ''), 10) < 2000 || parseInt(String(formData.year || ''), 10) > 2100)}
              helperText={
                modalMode !== 'view' && (!String(formData.year || '').trim() || parseInt(String(formData.year || ''), 10) < 2000 || parseInt(String(formData.year || ''), 10) > 2100)
                  ? 'Year must be between 2000 and 2100'
                  : modalMode === 'edit' ? 'Year cannot be changed after creation' : ''
              }
              inputProps={{ min: 2000, max: 2100 }}
              sx={{ mt: 2 }}
            />

            {/* Total Budget Field */}
            <TextField
              label="Total Budget (Rs) *"
              type="number"
              value={formData.total_budget}
              onChange={(e) => setFormData(prev => ({ ...prev, total_budget: e.target.value }))}
              variant="outlined"
              fullWidth
              required
              disabled={modalMode === 'view'}
              error={modalMode !== 'view' && (!formData.total_budget || parseFloat(formData.total_budget) <= 0)}
              helperText={
                modalMode !== 'view' && (!formData.total_budget || parseFloat(formData.total_budget) <= 0)
                  ? 'Total budget must be greater than 0'
                  : modalMode === 'create' ? '12 monthly budgets will be created automatically (Total Budget / 12)' : ''
              }
              inputProps={{ step: '0.01', min: '0.01' }}
            />

            {/* Info Box */}
            {modalMode === 'create' && (
              <Box sx={{ 
                p: 2, 
                backgroundColor: '#e3f2fd', 
                borderRadius: 1,
                border: '1px solid #90caf9'
              }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  Information:
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  • A budget for the selected year will be created
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  • 12 monthly budgets will be automatically created (Total Budget ÷ 12)
                </Typography>
                <Typography variant="body2">
                  • You cannot add another budget for the same year
                </Typography>
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
              disabled={
                isLoading || 
                !String(formData.year || '').trim() || 
                !formData.total_budget || 
                parseFloat(formData.total_budget) <= 0 ||
                parseInt(String(formData.year || ''), 10) < 2000 ||
                parseInt(String(formData.year || ''), 10) > 2100
              }
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
            color: 'warning.main'
          }}
        >
          Confirm Delete
        </DialogTitle>
        <DialogContent sx={{ pt: 3, pb: 2 }}>
          <Typography sx={{ color: '#333' }}>
            Are you sure you want to delete the budget for year <strong>"{rowToDelete?.year}"</strong>?
          </Typography>
          <Typography variant="body2" sx={{ color: '#666', mt: 2 }}>
            This will also delete all associated monthly budgets. This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2, borderTop: '1px solid #e0e0e0', gap: 1 }}>
          <Button
            onClick={() => {
              setDeleteWarningOpen(false);
              setRowToDelete(null);
            }}
            variant="outlined"
            sx={{ minWidth: 100 }}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmDelete}
            variant="contained"
            color="error"
            sx={{ minWidth: 100 }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Stats Modal */}
      <Dialog
        open={statsModalOpen}
        onClose={() => setStatsModalOpen(false)}
        aria-labelledby="stats-dialog-title"
        maxWidth="lg"
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
          id="stats-dialog-title"
          sx={{
            fontWeight: 600,
            fontSize: '1.5rem',
            pb: 2,
            pt: 3,
            borderBottom: '1px solid #e0e0e0'
          }}
        >
          Monthly Budget Statistics - {statsData?.yearlyBudget?.year || ''}
        </DialogTitle>
        <DialogContent sx={{ pt: 4, pb: 2 }}>
          {loadingStats ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : statsData && statsData.monthlyStats ? (
            <Box>
              <Box sx={{ mb: 3, p: 2, backgroundColor: '#e3f2fd', borderRadius: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  Year {statsData.yearlyBudget.year} - Total Budget: Rs {parseFloat(statsData.yearlyBudget.totalBudget || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
                <Typography variant="body2" sx={{ color: '#666', mb: 1 }}>
                  Unused budget from completed months carries forward to the next month. Over-expenditure (negative carry-forward) reduces the available budget for subsequent months.
                </Typography>
                {statsData.yearEndOverExpenditure && statsData.yearEndOverExpenditure > 0 && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      ⚠️ Year-End Over-Expenditure: Rs {statsData.yearEndOverExpenditure.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                      The total expenses exceeded the allocated budget by this amount at the end of the year.
                    </Typography>
                  </Alert>
                )}
              </Box>
              
              <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
                <Table stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, backgroundColor: '#f5f5f5' }}>Month</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, backgroundColor: '#f5f5f5' }}>Monthly Budget</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, backgroundColor: '#f5f5f5' }}>Carried Forward</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, backgroundColor: '#f5f5f5' }}>Available Budget</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, backgroundColor: '#f5f5f5' }}>Spent Amount</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, backgroundColor: '#f5f5f5' }}>Remaining</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, backgroundColor: '#f5f5f5' }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {statsData.monthlyStats.map((stat) => (
                      <TableRow
                        key={stat.month}
                        sx={{
                          backgroundColor: stat.isCurrent ? '#e8f5e9' : stat.isCompleted ? '#f5f5f5' : 'transparent',
                          '&:hover': { backgroundColor: stat.isCurrent ? '#c8e6c9' : '#fafafa' }
                        }}
                      >
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: stat.isCurrent ? 600 : 400 }}>
                            {stat.monthName}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          Rs {parseFloat(stat.monthBudget || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ 
                            color: stat.carriedForward > 0 ? '#2e7d32' : stat.carriedForward < 0 ? '#d32f2f' : '#666',
                            fontWeight: stat.carriedForward < 0 ? 600 : 400
                          }}>
                            Rs {parseFloat(stat.carriedForward || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ 
                            fontWeight: 600, 
                            color: stat.availableBudget < 0 ? '#d32f2f' : '#1976d2'
                          }}>
                            Rs {parseFloat(stat.availableBudget || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          Rs {parseFloat(stat.spentAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ 
                            fontWeight: 600,
                            color: stat.remaining > 0 ? '#2e7d32' : stat.remaining < 0 ? '#d32f2f' : '#666'
                          }}>
                            Rs {parseFloat(stat.remaining || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          {stat.isCurrent ? (
                            <Chip label="Current" color="success" size="small" />
                          ) : stat.isCompleted ? (
                            <Chip label="Completed" color="default" size="small" />
                          ) : (
                            <Chip label="Upcoming" color="info" size="small" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          ) : (
            <Alert severity="info">No statistics available</Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2, borderTop: '1px solid #e0e0e0', gap: 1 }}>
          <Button
            onClick={() => setStatsModalOpen(false)}
            variant="outlined"
            sx={{ minWidth: 100 }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <ToastContainer position="top-right" autoClose={5000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="light" toastStyle={{ backgroundColor: '#ffffff', color: '#333333' }} />
    </PageContainer>
  );
}

