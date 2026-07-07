import * as React from 'react';
import {
  Alert,
  Box,
  Button,
  Grid,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import {
  Clear as ClearIcon,
  FilterList as FilterListIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { GridToolbarContainer, GridToolbarColumnsButton } from '@mui/x-data-grid';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from '../auth/AuthContext';
import ReusableDataTable from '../components/ReusableData';
import PageContainer from '../components/PageContainer';
import { useApi } from '../hooks/useApi';

const INITIAL_PAGE_SIZE = 10;
const PERM_KEY = 'customSubDealers';

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

function formatDateTime(value) {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
}

export default function CustomSubDealers() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { get } = useApi();

  const canRead = user?.permissions?.[PERM_KEY]?.includes('read') || false;

  const [rowsState, setRowsState] = React.useState({ rows: [], rowCount: 0 });
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [nameFilter, setNameFilter] = React.useState(searchParams.get('name') || '');
  const [appliedNameFilter, setAppliedNameFilter] = React.useState(searchParams.get('name') || '');

  const [paginationModel, setPaginationModel] = React.useState({
    page: searchParams.get('page') ? Number(searchParams.get('page')) : 0,
    pageSize: searchParams.get('pageSize')
      ? Number(searchParams.get('pageSize'))
      : INITIAL_PAGE_SIZE,
  });

  const [sortModel, setSortModel] = React.useState(
    searchParams.get('sort') ? JSON.parse(searchParams.get('sort') ?? '[]') : [
      { field: 'created_at', sort: 'desc' },
    ],
  );

  React.useEffect(() => {
    if (!canRead) {
      setError('You do not have permission to view this page');
      toast.error('You do not have permission to view this page');
    }
  }, [canRead]);

  const handlePaginationModelChange = React.useCallback(
    (model) => {
      setPaginationModel(model);
      searchParams.set('page', String(model.page));
      searchParams.set('pageSize', String(model.pageSize));
      navigate(`${pathname}?${searchParams.toString()}`);
    },
    [navigate, pathname, searchParams],
  );

  const handleSortModelChange = React.useCallback(
    (model) => {
      setSortModel(model);
      if (model.length > 0) {
        searchParams.set('sort', JSON.stringify(model));
      } else {
        searchParams.delete('sort');
      }
      navigate(`${pathname}?${searchParams.toString()}`);
    },
    [navigate, pathname, searchParams],
  );

  const loadCustomSubDealers = React.useCallback(async () => {
    if (!canRead) return;

    setError(null);
    setIsLoading(true);

    try {
      const { page, pageSize } = paginationModel;
      const queryParams = new URLSearchParams({
        page: String(page),
        size: String(pageSize),
      });

      if (appliedNameFilter.trim()) {
        queryParams.append('name', appliedNameFilter.trim());
      }

      if (sortModel.length > 0) {
        queryParams.append('sort_field', sortModel[0].field);
        queryParams.append('sort_order', sortModel[0].sort || 'desc');
      }

      const response = await get(`/api/custom-sub-dealers?${queryParams.toString()}`);

      setRowsState({
        rows: Array.isArray(response?.data) ? response.data : [],
        rowCount: response?.totalCount ?? 0,
      });
    } catch (loadError) {
      const message = loadError.message || 'Failed to load custom sub dealers';
      setError(message);
      toast.error(message);
      console.error('Error loading custom sub dealers:', loadError);
    } finally {
      setIsLoading(false);
    }
  }, [appliedNameFilter, canRead, get, paginationModel, sortModel]);

  React.useEffect(() => {
    loadCustomSubDealers();
  }, [loadCustomSubDealers]);

  const handleApplyFilters = () => {
    const trimmed = nameFilter.trim();
    setAppliedNameFilter(trimmed);
    if (trimmed) {
      searchParams.set('name', trimmed);
    } else {
      searchParams.delete('name');
    }
    searchParams.set('page', '0');
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
    navigate(`${pathname}?${searchParams.toString()}`);
  };

  const handleClearFilters = () => {
    setNameFilter('');
    setAppliedNameFilter('');
    searchParams.delete('name');
    searchParams.set('page', '0');
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
    navigate(`${pathname}?${searchParams.toString()}`);
  };

  const columns = React.useMemo(
    () => [
      {
        field: 'id',
        headerName: 'ID',
        width: 80,
      },
      {
        field: 'name',
        headerName: 'Sub Dealer Name',
        minWidth: 200,
        flex: 1,
      },
      {
        field: 'parent_dealer_name',
        headerName: 'Parent Dealer Name',
        minWidth: 200,
        flex: 1,
        valueGetter: (value, row) => row.parent_dealer_name || row.parent_dealer?.name || 'N/A',
      },
      {
        field: 'parent_dealer_id',
        headerName: 'Parent Dealer Code',
        width: 160,
      },
      {
        field: 'contact',
        headerName: 'Contact',
        width: 140,
      },
      {
        field: 'phone',
        headerName: 'Phone',
        width: 140,
      },
      {
        field: 'city',
        headerName: 'City',
        width: 120,
      },
      {
        field: 'address',
        headerName: 'Address',
        minWidth: 220,
        flex: 1,
      },
      {
        field: 'created_by_name',
        headerName: 'Created By',
        width: 160,
        valueGetter: (value, row) =>
          row.created_by_name || row.creator?.card_name || row.creator?.username || 'N/A',
      },
      {
        field: 'created_at',
        headerName: 'Created At',
        minWidth: 170,
        renderCell: (params) => (
          <Typography variant="body2">{formatDateTime(params.value)}</Typography>
        ),
      },
    ],
    [],
  );

  if (!canRead) {
    return (
      <PageContainer title="Custom Sub Dealers" breadcrumbs={[{ title: 'Custom Sub Dealers' }]}>
        <Alert severity="error">You do not have permission to view this page.</Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Custom Sub Dealers"
      breadcrumbs={[{ title: 'Custom Sub Dealers' }]}
    >
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 2,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          backgroundColor: '#fafbff',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
          <FilterListIcon color="action" />
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Filters
          </Typography>
          {appliedNameFilter && (
            <Typography variant="body2" color="text.secondary">
              ({rowsState.rowCount} result{rowsState.rowCount === 1 ? '' : 's'})
            </Typography>
          )}
        </Box>

        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              size="small"
              label="Sub Dealer Name"
              placeholder="Search by name..."
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleApplyFilters();
              }}
              fullWidth
              InputProps={{
                startAdornment: <PersonIcon sx={{ mr: 1, color: 'action.active', fontSize: '1.2rem' }} />,
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#ffffff',
                },
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="contained" onClick={handleApplyFilters}>
                Apply
              </Button>
              <Button
                variant="outlined"
                startIcon={<ClearIcon />}
                onClick={handleClearFilters}
                disabled={!nameFilter && !appliedNameFilter}
              >
                Clear
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

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
        sortingMode="server"
        onView={null}
        onEdit={null}
        onDelete={null}
        onRefresh={loadCustomSubDealers}
        pageSizeOptions={[5, 10, 25, 50]}
        showToolbar={true}
        hideCreateButton={true}
        disableColumnFilter={true}
        disableColumnMenu={true}
        slots={{
          toolbar: CustomToolbar,
        }}
      />

      <ToastContainer />
    </PageContainer>
  );
}
