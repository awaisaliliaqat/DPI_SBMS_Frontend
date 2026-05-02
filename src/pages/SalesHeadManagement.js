import * as React from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from '../auth/AuthContext';
import { useApi } from '../hooks/useApi';
import ReusableDataTable from '../components/ReusableData';
import PageContainer from '../components/PageContainer';

const INITIAL_PAGE_SIZE = 10;

export default function SalesHeadManagement() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { get } = useApi();

  const canRead = user?.permissions?.salesHeadManagement?.includes('read') || false;

  const [rowsState, setRowsState] = React.useState({
    rows: [],
    rowCount: 0,
  });
  const [expandedHeads, setExpandedHeads] = React.useState({});
  const [directorAssignments, setDirectorAssignments] = React.useState({}); // committed assignments
  const [directors, setDirectors] = React.useState([]);
  const [loadingDirectors, setLoadingDirectors] = React.useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = React.useState(false);
  const [selectedAssignRow, setSelectedAssignRow] = React.useState(null);
  const [selectedDirectorInDialog, setSelectedDirectorInDialog] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const [paginationModel, setPaginationModel] = React.useState({
    page: searchParams.get('page') ? Number(searchParams.get('page')) : 0,
    pageSize: searchParams.get('pageSize') ? Number(searchParams.get('pageSize')) : INITIAL_PAGE_SIZE,
  });

  const [filterModel, setFilterModel] = React.useState(
    searchParams.get('filter')
      ? JSON.parse(searchParams.get('filter') ?? '')
      : { items: [] },
  );

  const [sortModel, setSortModel] = React.useState(
    searchParams.get('sort') ? JSON.parse(searchParams.get('sort') ?? '') : [],
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
      const newSearchParamsString = searchParams.toString();
      navigate(`${pathname}${newSearchParamsString ? '?' : ''}${newSearchParamsString}`);
    },
    [navigate, pathname, searchParams],
  );

  const handleFilterModelChange = React.useCallback(
    (model) => {
      setFilterModel(model);
      if (model.items.length > 0 || (model.quickFilterValues && model.quickFilterValues.length > 0)) {
        searchParams.set('filter', JSON.stringify(model));
      } else {
        searchParams.delete('filter');
      }
      const newSearchParamsString = searchParams.toString();
      navigate(`${pathname}${newSearchParamsString ? '?' : ''}${newSearchParamsString}`);
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
      const newSearchParamsString = searchParams.toString();
      navigate(`${pathname}${newSearchParamsString ? '?' : ''}${newSearchParamsString}`);
    },
    [navigate, pathname, searchParams],
  );

  const loadSalesHeads = React.useCallback(async () => {
    if (!canRead) return;

    setError(null);
    setIsLoading(true);
    try {
      const response = await get('/api/sap-users/sales-head-management');

      if (response?.success && Array.isArray(response.data)) {
        setExpandedHeads({});
        setDirectorAssignments({});
        setRowsState({
          rows: response.data,
          rowCount: response.totalCount || response.data.length,
        });
      } else {
        setRowsState({ rows: [], rowCount: 0 });
      }
    } catch (loadError) {
      setError(loadError.message || 'Failed to load sales heads');
      toast.error('Failed to load sales heads');
    } finally {
      setIsLoading(false);
    }
  }, [canRead, get]);

  // Fetch directors once for this page
  const loadDirectors = React.useCallback(async () => {
    if (!canRead) return;

    setLoadingDirectors(true);
    try {
      const response = await get('/api/sap-users/directors');
      if (response?.success && Array.isArray(response.data)) {
        const mapped = response.data.map((d) => ({
          id: String(d.id),
          name: d.username || d.email || `Director ${d.id}`,
        }));
        setDirectors(mapped);
      } else {
        setDirectors([]);
      }
    } catch (directorError) {
      setDirectors([]);
      toast.error('Failed to load directors');
    } finally {
      setLoadingDirectors(false);
    }
  }, [canRead, get]);

  React.useEffect(() => {
    loadSalesHeads();
  }, [loadSalesHeads]);

  React.useEffect(() => {
    loadDirectors();
  }, [loadDirectors]);

  const toggleExpand = React.useCallback((headId) => {
    setExpandedHeads((prev) => ({
      ...prev,
      [headId]: !prev[headId],
    }));
  }, []);

  const directorsMap = React.useMemo(() => {
    const map = {};
    directors.forEach((d) => {
      map[String(d.id)] = d.name;
    });
    return map;
  }, [directors]);

  const openAssignDialog = React.useCallback((row) => {
    const assignmentKey = row.assignmentKey;
    const currentDirectorId = directorAssignments[assignmentKey] ?? row.assignedDirectorId ?? '';
    setSelectedAssignRow(row);
    setSelectedDirectorInDialog(currentDirectorId ? String(currentDirectorId) : '');
    setAssignDialogOpen(true);
  }, [directorAssignments]);

  const closeAssignDialog = React.useCallback(() => {
    setAssignDialogOpen(false);
    setSelectedAssignRow(null);
    setSelectedDirectorInDialog('');
  }, []);

  const applyDirectorAssignment = React.useCallback(() => {
    if (!selectedAssignRow) return;
    if (!selectedDirectorInDialog) {
      toast.error('Please select a director first');
      return;
    }

    const row = selectedAssignRow;
    const assignmentKey = row.assignmentKey;
    const directorId = String(selectedDirectorInDialog);

    setDirectorAssignments((prev) => ({
      ...prev,
      [assignmentKey]: directorId,
    }));

    // UI-only local update on modal "Update"
    setRowsState((prev) => {
      const updatedRows = prev.rows.map((head) => {
        if (row.rowType === 'head' && head.id === row.id) {
          return { ...head, assignedDirectorId: directorId };
        }

        if (row.rowType === 'manager' && head.id === row.parentHeadId) {
          const managers = Array.isArray(head.managers) ? head.managers : [];
          return {
            ...head,
            managers: managers.map((manager) =>
              manager.username === row.username
                ? { ...manager, assignedDirectorId: directorId }
                : manager,
            ),
          };
        }

        return head;
      });

      return {
        ...prev,
        rows: updatedRows,
      };
    });

    toast.success('Director updated');
    closeAssignDialog();
  }, [selectedAssignRow, selectedDirectorInDialog, closeAssignDialog]);

  const normalizedValue = React.useCallback((value) => {
    if (Array.isArray(value)) return value.join(' ').toLowerCase();
    if (value === null || value === undefined) return '';
    return String(value).toLowerCase();
  }, []);

  const processedHeads = React.useMemo(() => {
    let rows = [...rowsState.rows];

    const quickFilters = (filterModel?.quickFilterValues || [])
      .map((v) => String(v).trim().toLowerCase())
      .filter(Boolean);

    if (quickFilters.length > 0) {
      rows = rows.filter((row) => {
        const haystack = [
          row.username,
          ...(row.sourceTypes || []),
          ...(row.cities || []),
          ...(row.cellulars || []),
          ...(row.shCodes || []),
        ].join(' ').toLowerCase();

        return quickFilters.every((q) => haystack.includes(q));
      });
    }

    const filterItems = (filterModel?.items || []).filter(
      (item) => item?.field && item?.value !== undefined && item?.value !== null && String(item.value).trim() !== '',
    );

    if (filterItems.length > 0) {
      rows = rows.filter((row) =>
        filterItems.every((item) => {
          const cellValue = normalizedValue(row[item.field]);
          const target = String(item.value).toLowerCase();
          const operator = item.operator || 'contains';

          if (operator === 'equals' || operator === 'is') return cellValue === target;
          if (operator === 'startsWith') return cellValue.startsWith(target);
          if (operator === 'endsWith') return cellValue.endsWith(target);
          return cellValue.includes(target);
        }),
      );
    }

    if (sortModel.length > 0) {
      const { field, sort } = sortModel[0];
      rows.sort((a, b) => {
        const va = normalizedValue(a[field]);
        const vb = normalizedValue(b[field]);
        if (va < vb) return sort === 'desc' ? 1 : -1;
        if (va > vb) return sort === 'desc' ? -1 : 1;
        return 0;
      });
    }

    return rows;
  }, [rowsState.rows, filterModel, sortModel, normalizedValue]);

  const displayRows = React.useMemo(() => {
    const startIndex = paginationModel.page * paginationModel.pageSize;
    const endIndex = startIndex + paginationModel.pageSize;
    const paginatedHeads = processedHeads.slice(startIndex, endIndex);
    const rows = [];

    paginatedHeads.forEach((head) => {
      const managers = Array.isArray(head.managers) ? head.managers : [];
      const headAssignmentKey = `head-${head.id}`;
      rows.push({
        ...head,
        rowType: 'head',
        hasChildren: managers.length > 0,
        assignmentKey: headAssignmentKey,
        parentHeadId: head.id,
      });

      if (expandedHeads[head.id]) {
        managers.forEach((manager, idx) => {
          const managerKey = `manager-${head.id}-${manager.username || idx}`;
          rows.push({
            ...manager,
            id: `head-${head.id}-manager-${idx + 1}`,
            rowType: 'manager',
            hasChildren: false,
            username: manager.username,
            assignmentKey: managerKey,
            parentHeadId: head.id,
          });
        });
      }
    });

    return rows;
  }, [processedHeads, expandedHeads, paginationModel.page, paginationModel.pageSize]);

  const columns = React.useMemo(
    () => [
      {
        field: 'expand',
        headerName: '',
        width: 60,
        sortable: false,
        filterable: false,
        renderCell: (params) => {
          if (params.row.rowType !== 'head' || !params.row.hasChildren) {
            return null;
          }
          const isExpanded = !!expandedHeads[params.row.id];
          return (
            <IconButton size="small" onClick={() => toggleExpand(params.row.id)}>
              {isExpanded ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
            </IconButton>
          );
        },
      },
      { field: 'id', headerName: 'ID', width: 70 },
      {
        field: 'username',
        headerName: 'Username',
        width: 260,
        renderCell: (params) => (
          <Box sx={{ pl: params.row.rowType === 'manager' ? 2 : 0, fontStyle: params.row.rowType === 'manager' ? 'italic' : 'normal' }}>
            {params.row.rowType === 'manager' ? `- ${params.value}` : params.value}
          </Box>
        ),
      },
      {
        field: 'sourceTypes',
        headerName: 'Source Type',
        width: 200,
        renderCell: (params) => (params.value || []).join(', '),
      },
      {
        field: 'cities',
        headerName: 'Cities',
        width: 220,
        renderCell: (params) => (params.value || []).join(', '),
      },
      {
        field: 'cellulars',
        headerName: 'Cell No',
        width: 220,
        renderCell: (params) => (params.value || []).join(', '),
      },
      {
        field: 'assignedDirector',
        headerName: 'Assigned Director',
        width: 220,
        renderCell: (params) => {
          const assignmentKey = params.row.assignmentKey;
          const selectedDirectorId = directorAssignments[assignmentKey] ?? params.row.assignedDirectorId ?? '';
          const directorName = selectedDirectorId ? directorsMap[String(selectedDirectorId)] : '';

          return (
            <Typography variant="body2" sx={{ color: directorName ? '#0f172a' : '#64748b', fontWeight: 500 }}>
              {directorName || 'Not Assigned'}
            </Typography>
          );
        },
      },
      {
        field: 'actions',
        headerName: 'Actions',
        width: 160,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <Button
            variant="outlined"
            size="small"
            onClick={() => openAssignDialog(params.row)}
            sx={{
              minWidth: 108,
              height: 30,
              px: 1.2,
              fontSize: '0.72rem',
              textTransform: 'none',
              borderRadius: 2,
            }}
          >
            Assign Director
          </Button>
        ),
      },
    ],
    [
      expandedHeads,
      toggleExpand,
      directors,
      loadingDirectors,
      directorsMap,
      directorAssignments,
      openAssignDialog,
      applyDirectorAssignment,
    ],
  );

  const pageTitle = 'Sales Head Management';

  if (!canRead) {
    return (
      <PageContainer title={pageTitle} breadcrumbs={[{ title: pageTitle }]}>
        <Alert severity="error" sx={{ mb: 2 }}>
          You do not have permission to view this page
        </Alert>
        <ToastContainer />
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

      <Box sx={{ mt: 1.5 }}>
        <ReusableDataTable
          data={displayRows}
          columns={columns}
          loading={isLoading}
          error={error}
          paginationModel={paginationModel}
          onPaginationModelChange={handlePaginationModelChange}
          rowCount={processedHeads.length}
          paginationMode="server"
          sortModel={sortModel}
          onSortModelChange={handleSortModelChange}
          sortingMode="server"
          filterModel={filterModel}
          onFilterModelChange={handleFilterModelChange}
          filterMode="server"
          onRefresh={canRead ? loadSalesHeads : null}
          pageSizeOptions={[5, 10, 25, 50]}
          showToolbar={true}
          rowHeight={44}
          getRowClassName={(params) => (params.row.rowType === 'manager' ? 'sales-manager-row' : '')}
          sx={{
            '& .sales-manager-row': {
              backgroundColor: 'rgba(0, 0, 0, 0.02)',
            },
            '& .MuiDataGrid-cell': {
              display: 'flex',
              alignItems: 'center',
            },
          }}
        />
      </Box>

      <Dialog open={assignDialogOpen} onClose={closeAssignDialog} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>Assign Director</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1.5, color: 'text.secondary' }}>
            {selectedAssignRow
              ? `Target: ${selectedAssignRow.rowType === 'manager' ? 'Sales Manager' : 'Sales Head'} - ${selectedAssignRow.username}`
              : ''}
          </Typography>
          <FormControl fullWidth size="small">
            <Select
              value={selectedDirectorInDialog}
              displayEmpty
              onChange={(event) => setSelectedDirectorInDialog(event.target.value)}
              disabled={loadingDirectors}
            >
              <MenuItem value="">
                <em>{loadingDirectors ? 'Loading directors...' : 'Select Director'}</em>
              </MenuItem>
              {directors.map((director) => (
                <MenuItem key={director.id} value={director.id}>
                  {director.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeAssignDialog} variant="text">Cancel</Button>
          <Button onClick={applyDirectorAssignment} variant="contained">Update</Button>
        </DialogActions>
      </Dialog>

      <ToastContainer />
    </PageContainer>
  );
}
