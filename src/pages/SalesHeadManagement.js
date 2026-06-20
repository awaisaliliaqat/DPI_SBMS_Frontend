import * as React from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  MenuItem,
  Pagination,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import AddIcon from '@mui/icons-material/Add';
import PeopleIcon from '@mui/icons-material/People';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from '../auth/AuthContext';
import { useApi } from '../hooks/useApi';
import ReusableDataTable from '../components/ReusableData';
import PageContainer from '../components/PageContainer';

const INITIAL_PAGE_SIZE = 10;
const MANAGE_PAGE_SIZE = 8;

const DIALOG_DIRECTOR = 'director';
const DIALOG_ADDITIONAL_DIRECTOR = 'additional_director';

const EMPTY_CREATE_FORM = { card_name: '', username: '', email: '', password: '', confirmPassword: '', user_type: 'director' };

export default function SalesHeadManagement() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { get, post } = useApi();

  const canRead = user?.permissions?.salesHeadManagement?.includes('read') || false;
  const canAssignDirector = user?.permissions?.salesHeadManagement?.includes('assign_director') || false;
  const canAssignAdditionalDirector = user?.permissions?.salesHeadManagement?.includes('assign_additional_director') || false;

  // ── Main table state ──────────────────────────────────────────────────────
  const [rowsState, setRowsState] = React.useState({ rows: [], rowCount: 0 });
  const [expandedHeads, setExpandedHeads] = React.useState({});
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  // ── Director / additional director lists ──────────────────────────────────
  const [directors, setDirectors] = React.useState([]);
  const [loadingDirectors, setLoadingDirectors] = React.useState(false);
  const [additionalDirectors, setAdditionalDirectors] = React.useState([]);
  const [loadingAdditionalDirectors, setLoadingAdditionalDirectors] = React.useState(false);
  const [directorAssignments, setDirectorAssignments] = React.useState({});
  const [additionalDirectorAssignments, setAdditionalDirectorAssignments] = React.useState({});

  // ── "Manage Directors" modal ──────────────────────────────────────────────
  const [manageOpen, setManageOpen] = React.useState(false);
  const [managePage, setManagePage] = React.useState(1);
  const [manageFilter, setManageFilter] = React.useState('all'); // 'all' | 'director' | 'additional_director'

  // ── Create user form (nested inside manage modal) ─────────────────────────
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createForm, setCreateForm] = React.useState(EMPTY_CREATE_FORM);
  const [createFormErrors, setCreateFormErrors] = React.useState({});
  const [createSaving, setCreateSaving] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);

  // ── Assign director dialog ────────────────────────────────────────────────
  const [assignDialogOpen, setAssignDialogOpen] = React.useState(false);
  const [assignDialogMode, setAssignDialogMode] = React.useState(DIALOG_DIRECTOR);
  const [selectedAssignRow, setSelectedAssignRow] = React.useState(null);
  const [selectedValueInDialog, setSelectedValueInDialog] = React.useState('');
  const [assignSaving, setAssignSaving] = React.useState(false);

  // ── Toggle active (FUTURE USE: wired to Active column — uncomment column in grid when ready) ──
  const [togglingActive, setTogglingActive] = React.useState({});

  // ── URL pagination / filter / sort ────────────────────────────────────────
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

  // ── Permission guard ──────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!canRead) {
      setError('You do not have permission to view this page');
      toast.error('You do not have permission to view this page');
    }
  }, [canRead]);

  // ── URL nav helpers ───────────────────────────────────────────────────────
  const handlePaginationModelChange = React.useCallback((model) => {
    setPaginationModel(model);
    searchParams.set('page', String(model.page));
    searchParams.set('pageSize', String(model.pageSize));
    const s = searchParams.toString();
    navigate(`${pathname}${s ? '?' : ''}${s}`);
  }, [navigate, pathname, searchParams]);

  const handleFilterModelChange = React.useCallback((model) => {
    setFilterModel(model);
    if (model.items.length > 0 || (model.quickFilterValues && model.quickFilterValues.length > 0)) {
      searchParams.set('filter', JSON.stringify(model));
    } else {
      searchParams.delete('filter');
    }
    const s = searchParams.toString();
    navigate(`${pathname}${s ? '?' : ''}${s}`);
  }, [navigate, pathname, searchParams]);

  const handleSortModelChange = React.useCallback((model) => {
    setSortModel(model);
    if (model.length > 0) searchParams.set('sort', JSON.stringify(model));
    else searchParams.delete('sort');
    const s = searchParams.toString();
    navigate(`${pathname}${s ? '?' : ''}${s}`);
  }, [navigate, pathname, searchParams]);

  // ── Data loaders ──────────────────────────────────────────────────────────
  const loadSalesHeads = React.useCallback(async () => {
    if (!canRead) return;
    setError(null);
    setIsLoading(true);
    try {
      const response = await get('/api/sap-users/sales-head-management');
      if (response?.success && Array.isArray(response.data)) {
        setExpandedHeads({});
        setDirectorAssignments({});
        setAdditionalDirectorAssignments({});
        setRowsState({ rows: response.data, rowCount: response.totalCount || response.data.length });
      } else {
        setRowsState({ rows: [], rowCount: 0 });
      }
    } catch (e) {
      setError(e.message || 'Failed to load sales heads');
      toast.error('Failed to load sales heads');
    } finally {
      setIsLoading(false);
    }
  }, [canRead, get]);

  const loadDirectors = React.useCallback(async () => {
    if (!canRead) return;
    setLoadingDirectors(true);
    try {
      const res = await get('/api/sap-users/directors');
      setDirectors((res?.success && Array.isArray(res.data)) ? res.data.map((d) => ({
        id: String(d.id),
        name: (d.card_name && String(d.card_name).trim()) || d.username || `Director ${d.id}`,
        username: d.username,
        email: d.email,
        is_active: d.is_active,
        user_type: 'director',
      })) : []);
    } catch { setDirectors([]); }
    finally { setLoadingDirectors(false); }
  }, [canRead, get]);

  const loadAdditionalDirectors = React.useCallback(async () => {
    if (!canRead) return;
    setLoadingAdditionalDirectors(true);
    try {
      const res = await get('/api/sap-users/additional-directors');
      setAdditionalDirectors((res?.success && Array.isArray(res.data)) ? res.data.map((d) => ({
        id: String(d.id),
        name: (d.card_name && String(d.card_name).trim()) || d.username || `Addl. Director ${d.id}`,
        username: d.username,
        email: d.email,
        is_active: d.is_active,
        user_type: 'additional_director',
      })) : []);
    } catch { setAdditionalDirectors([]); }
    finally { setLoadingAdditionalDirectors(false); }
  }, [canRead, get]);

  React.useEffect(() => { loadSalesHeads(); }, [loadSalesHeads]);
  React.useEffect(() => { loadDirectors(); }, [loadDirectors]);
  React.useEffect(() => { loadAdditionalDirectors(); }, [loadAdditionalDirectors]);

  // ── Combined list for Manage modal ────────────────────────────────────────
  const allDirectorUsers = React.useMemo(() => {
    const combined = [...directors, ...additionalDirectors];
    if (manageFilter === 'director') return combined.filter((u) => u.user_type === 'director');
    if (manageFilter === 'additional_director') return combined.filter((u) => u.user_type === 'additional_director');
    return combined;
  }, [directors, additionalDirectors, manageFilter]);

  const manageTotalPages = Math.max(1, Math.ceil(allDirectorUsers.length / MANAGE_PAGE_SIZE));
  const managePageItems = allDirectorUsers.slice((managePage - 1) * MANAGE_PAGE_SIZE, managePage * MANAGE_PAGE_SIZE);

  // ── Maps for display ──────────────────────────────────────────────────────
  const directorsMap = React.useMemo(() => {
    const m = {}; directors.forEach((d) => { m[d.id] = d.name; }); return m;
  }, [directors]);

  const additionalDirectorsMap = React.useMemo(() => {
    const m = {}; additionalDirectors.forEach((d) => { m[d.id] = d.name; }); return m;
  }, [additionalDirectors]);

  // ── Manage modal open/close ───────────────────────────────────────────────
  const openManageModal = React.useCallback(() => {
    setManagePage(1);
    setManageFilter('all');
    setManageOpen(true);
  }, []);

  // ── Create user ───────────────────────────────────────────────────────────
  const openCreateDialog = React.useCallback(() => {
    setCreateForm(EMPTY_CREATE_FORM);
    setCreateFormErrors({});
    setShowPassword(false);
    setCreateOpen(true);
  }, []);

  const closeCreateDialog = React.useCallback(() => setCreateOpen(false), []);

  const handleCreateFormChange = React.useCallback((field, value) => {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
    setCreateFormErrors((prev) => ({ ...prev, [field]: '' }));
  }, []);

  const validateCreateForm = (form) => {
    const errs = {};
    if (!String(form.username || '').trim()) errs.username = 'Username is required';
    if (!String(form.password || '').trim()) errs.password = 'Password is required';
    else if (String(form.password).length < 6) errs.password = 'Minimum 6 characters';
    if (form.confirmPassword !== form.password) errs.confirmPassword = 'Passwords do not match';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errs.email = 'Invalid email';
    return errs;
  };

  const handleCreateSubmit = React.useCallback(async () => {
    const errs = validateCreateForm(createForm);
    if (Object.keys(errs).length > 0) { setCreateFormErrors(errs); return; }
    setCreateSaving(true);
    try {
      const res = await post('/api/sap-users/create-management-user', {
        username: String(createForm.username).trim(),
        email: String(createForm.email || '').trim() || undefined,
        password: createForm.password,
        card_name: String(createForm.card_name || '').trim() || undefined,
        user_type: createForm.user_type,
      });
      if (res?.success) {
        toast.success(res.message || 'User created successfully');
        closeCreateDialog();
        if (createForm.user_type === 'director') loadDirectors();
        else loadAdditionalDirectors();
      } else {
        throw new Error(res?.message || 'Failed to create user');
      }
    } catch (e) {
      let msg = e.message || 'Failed to create user';
      try { const p = JSON.parse(msg); if (p?.message) msg = p.message; } catch { /**/ }
      toast.error(msg);
    } finally {
      setCreateSaving(false);
    }
  }, [createForm, post, closeCreateDialog, loadDirectors, loadAdditionalDirectors]);

  // ── Assign dialog ─────────────────────────────────────────────────────────
  const openAssignDialog = React.useCallback((row, mode) => {
    setAssignDialogMode(mode);
    setSelectedAssignRow(row);
    const current = mode === DIALOG_DIRECTOR
      ? (directorAssignments[row.assignmentKey] ?? row.assignedDirectorId ?? '')
      : (additionalDirectorAssignments[row.assignmentKey] ?? row.assignedAdditionalDirectorId ?? '');
    setSelectedValueInDialog(current ? String(current) : '');
    setAssignDialogOpen(true);
  }, [directorAssignments, additionalDirectorAssignments]);

  const closeAssignDialog = React.useCallback(() => {
    setAssignDialogOpen(false);
    setSelectedAssignRow(null);
    setSelectedValueInDialog('');
  }, []);

  const applyAssignment = React.useCallback(async () => {
    if (!selectedAssignRow || !selectedValueInDialog) {
      toast.error(`Please select a ${assignDialogMode === DIALOG_DIRECTOR ? 'director' : 'additional director'} first`);
      return;
    }
    const userId = Number(selectedValueInDialog);
    if (!Number.isFinite(userId) || userId < 1) { toast.error('Invalid selection'); return; }
    const row = selectedAssignRow;
    const targetType = row.rowType === 'head' ? 'sales_head' : 'sales_manager';
    const salesHeadName = row.rowType === 'head' ? String(row.username || '').trim() : String(row.parentSalesHeadUsername || '').trim();
    if (!salesHeadName) { toast.error('Could not resolve sales head name'); return; }

    const endpoint = assignDialogMode === DIALOG_DIRECTOR ? '/api/sap-users/assign-director' : '/api/sap-users/assign-additional-director';
    const idKey = assignDialogMode === DIALOG_DIRECTOR ? 'director_user_id' : 'additional_director_user_id';
    const body = { [idKey]: userId, target_type: targetType, sales_head_name: salesHeadName };
    if (targetType === 'sales_manager') body.sales_manager_name = String(row.username || '').trim();

    setAssignSaving(true);
    try {
      const res = await post(endpoint, body);
      if (res?.success) {
        await loadSalesHeads();
        toast.success(res.message || 'Assigned successfully');
        closeAssignDialog();
      } else throw new Error(res?.message || 'Failed to assign');
    } catch (e) {
      let msg = e.message || 'Failed to assign';
      try { const p = JSON.parse(msg); if (p?.message) msg = p.message; } catch { /**/ }
      toast.error(msg);
    } finally { setAssignSaving(false); }
  }, [selectedAssignRow, selectedValueInDialog, assignDialogMode, closeAssignDialog, post, loadSalesHeads]);

  // ── Toggle active (FUTURE USE: used by Active column when uncommented) ───────
  const handleToggleActive = React.useCallback(async (row, newValue) => {
    const username = String(row.username || '').trim();
    if (!username) { toast.error('Cannot toggle: username is missing'); return; }
    const key = row.assignmentKey;
    setTogglingActive((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await post('/api/sap-users/toggle-user-active', { username, is_active: newValue });
      if (res?.success) {
        toast.success(res.message || `User ${newValue ? 'activated' : 'deactivated'}`);
        await loadSalesHeads();
      } else throw new Error(res?.message || 'Failed to toggle status');
    } catch (e) {
      let msg = e.message || 'Failed to toggle status';
      try { const p = JSON.parse(msg); if (p?.message) msg = p.message; } catch { /**/ }
      toast.error(msg);
    } finally { setTogglingActive((prev) => ({ ...prev, [key]: false })); }
  }, [post, loadSalesHeads]);

  // ── Main table: filtered / sorted / paginated ─────────────────────────────
  const normalizedValue = React.useCallback((value) => {
    if (Array.isArray(value)) return value.join(' ').toLowerCase();
    if (value === null || value === undefined) return '';
    return String(value).toLowerCase();
  }, []);

  const processedHeads = React.useMemo(() => {
    let rows = [...rowsState.rows];
    const quickFilters = (filterModel?.quickFilterValues || []).map((v) => String(v).trim().toLowerCase()).filter(Boolean);
    if (quickFilters.length > 0) {
      rows = rows.filter((row) => {
        const haystack = [row.username, ...(row.sourceTypes || []), ...(row.cities || []), ...(row.cellulars || []), ...(row.shCodes || [])].join(' ').toLowerCase();
        return quickFilters.every((q) => haystack.includes(q));
      });
    }
    const filterItems = (filterModel?.items || []).filter((item) => item?.field && item?.value !== undefined && String(item.value).trim() !== '');
    if (filterItems.length > 0) {
      rows = rows.filter((row) => filterItems.every((item) => {
        const cellValue = normalizedValue(row[item.field]);
        const target = String(item.value).toLowerCase();
        const op = item.operator || 'contains';
        if (op === 'equals' || op === 'is') return cellValue === target;
        if (op === 'startsWith') return cellValue.startsWith(target);
        if (op === 'endsWith') return cellValue.endsWith(target);
        return cellValue.includes(target);
      }));
    }
    if (sortModel.length > 0) {
      const { field, sort } = sortModel[0];
      rows.sort((a, b) => {
        const va = normalizedValue(a[field]); const vb = normalizedValue(b[field]);
        if (va < vb) return sort === 'desc' ? 1 : -1;
        if (va > vb) return sort === 'desc' ? -1 : 1;
        return 0;
      });
    }
    return rows;
  }, [rowsState.rows, filterModel, sortModel, normalizedValue]);

  const displayRows = React.useMemo(() => {
    const start = paginationModel.page * paginationModel.pageSize;
    const rows = [];
    processedHeads.slice(start, start + paginationModel.pageSize).forEach((head) => {
      const managers = Array.isArray(head.managers) ? head.managers : [];
      const headKey = `head-${head.id}`;
      rows.push({ ...head, rowType: 'head', hasChildren: managers.length > 0, assignmentKey: headKey, parentHeadId: head.id });
      if (expandedHeads[head.id]) {
        managers.forEach((manager, idx) => {
          rows.push({
            ...manager,
            id: `head-${head.id}-manager-${idx + 1}`,
            rowType: 'manager',
            hasChildren: false,
            assignmentKey: `manager-${head.id}-${manager.username || idx}`,
            parentHeadId: head.id,
            parentSalesHeadUsername: head.username,
          });
        });
      }
    });
    return rows;
  }, [processedHeads, expandedHeads, paginationModel]);

  const columns = React.useMemo(() => [
    {
      field: 'expand', headerName: '', width: 50, sortable: false, filterable: false,
      renderCell: (params) => {
        if (params.row.rowType !== 'head' || !params.row.hasChildren) return null;
        return (
          <IconButton size="small" onClick={() => setExpandedHeads((p) => ({ ...p, [params.row.id]: !p[params.row.id] }))}>
            {expandedHeads[params.row.id] ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
          </IconButton>
        );
      },
    },
    { field: 'id', headerName: 'ID', width: 70 },
    {
      field: 'username', headerName: 'Username', width: 240,
      renderCell: (params) => (
        <Box sx={{ pl: params.row.rowType === 'manager' ? 2 : 0, fontStyle: params.row.rowType === 'manager' ? 'italic' : 'normal' }}>
          {params.row.rowType === 'manager' ? `↳ ${params.value}` : params.value}
        </Box>
      ),
    },
    { field: 'sourceTypes', headerName: 'Source Type', width: 150, renderCell: (p) => (p.value || []).join(', ') },
    { field: 'cities', headerName: 'Cities', width: 200, renderCell: (p) => (p.value || []).join(', ') },
    { field: 'cellulars', headerName: 'Cell No', width: 170, renderCell: (p) => (p.value || []).join(', ') },
    {
      field: 'assignedDirector', headerName: 'Director', width: 190,
      renderCell: (params) => {
        const id = directorAssignments[params.row.assignmentKey] ?? params.row.assignedDirectorId ?? '';
        const name = id ? directorsMap[String(id)] : '';
        return <Typography variant="body2" sx={{ color: name ? '#0f172a' : '#94a3b8', fontSize: '0.78rem', fontWeight: 500 }}>{name || 'Not Assigned'}</Typography>;
      },
    },
    {
      field: 'assignedAdditionalDirector', headerName: 'Addl. Director', width: 190,
      renderCell: (params) => {
        const id = additionalDirectorAssignments[params.row.assignmentKey] ?? params.row.assignedAdditionalDirectorId ?? '';
        const name = id ? additionalDirectorsMap[String(id)] : '';
        return <Typography variant="body2" sx={{ color: name ? '#0f172a' : '#94a3b8', fontSize: '0.78rem', fontWeight: 500 }}>{name || 'Not Assigned'}</Typography>;
      },
    },
    // FUTURE USE: Active/Inactive toggle column — uncomment when ready to show on Sales Head page.
    // handleToggleActive and togglingActive state are kept below; do not remove.
    // {
    //   field: 'isActive', headerName: 'Active', width: 90, sortable: false, filterable: false,
    //   renderCell: (params) => {
    //     const key = params.row.assignmentKey;
    //     const isNull = params.row.isActive === null || params.row.isActive === undefined;
    //     const checked = isNull ? false : Boolean(params.row.isActive);
    //     return (
    //       <Tooltip title={isNull ? 'Not synced yet' : (checked ? 'Active — click to deactivate' : 'Inactive — click to activate')}>
    //         <span>
    //           <Switch size="small" checked={checked} disabled={Boolean(togglingActive[key]) || isNull}
    //             onChange={(e) => handleToggleActive(params.row, e.target.checked)} color="success" />
    //         </span>
    //       </Tooltip>
    //     );
    //   },
    // },
    {
      field: 'actions', headerName: 'Actions', width: 270, sortable: false, filterable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={0.8}>
          {canAssignDirector && (
            <Button variant="outlined" size="small" onClick={() => openAssignDialog(params.row, DIALOG_DIRECTOR)}
              sx={{ minWidth: 108, height: 28, px: 1, fontSize: '0.7rem', textTransform: 'none', borderRadius: 2 }}>
              Assign Director
            </Button>
          )}
          {canAssignAdditionalDirector && (
            <Button variant="outlined" size="small" color="secondary" onClick={() => openAssignDialog(params.row, DIALOG_ADDITIONAL_DIRECTOR)}
              sx={{ minWidth: 118, height: 28, px: 1, fontSize: '0.7rem', textTransform: 'none', borderRadius: 2 }}>
              Assign Addl. Dir
            </Button>
          )}
        </Stack>
      ),
    },
  ], [expandedHeads, directorsMap, additionalDirectorsMap, directorAssignments, additionalDirectorAssignments, openAssignDialog, canAssignDirector, canAssignAdditionalDirector]);

  // ── Render ────────────────────────────────────────────────────────────────
  const pageTitle = 'Sales Head Management';

  if (!canRead) {
    return (
      <PageContainer title={pageTitle} breadcrumbs={[{ title: pageTitle }]}>
        <Alert severity="error" sx={{ mb: 2 }}>You do not have permission to view this page</Alert>
        <ToastContainer />
      </PageContainer>
    );
  }

  const isDialogDirector = assignDialogMode === DIALOG_DIRECTOR;
  const dialogList = isDialogDirector ? directors : additionalDirectors;
  const dialogLoading = isDialogDirector ? loadingDirectors : loadingAdditionalDirectors;
  const dialogLabel = isDialogDirector ? 'Director' : 'Additional Director';
  const loadingManage = loadingDirectors || loadingAdditionalDirectors;

  return (
    <PageContainer title={pageTitle} breadcrumbs={[{ title: pageTitle }]}>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* ── Toolbar: one Directors button ── */}
      {canAssignDirector && (
        <Stack direction="row" sx={{ mb: 2, mt: 0.5 }}>
          <Button
            variant="contained"
            startIcon={<PeopleIcon />}
            size="small"
            onClick={openManageModal}
            sx={{ textTransform: 'none', borderRadius: 2 }}
          >
            Directors
          </Button>
        </Stack>
      )}

      {/* ── Main sales-head table ── */}
      <Box sx={{ mt: 0.5 }}>
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
            '& .sales-manager-row': { backgroundColor: 'rgba(0,0,0,0.02)' },
            '& .MuiDataGrid-cell': { display: 'flex', alignItems: 'center' },
          }}
        />
      </Box>

      {/* ══════════════════════════════════════════════════════════════════════
          Manage Directors Modal
      ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={manageOpen} onClose={() => setManageOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" fontWeight={600}>Directors</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              size="small"
              onClick={openCreateDialog}
              sx={{ textTransform: 'none', borderRadius: 2 }}
            >
              Add New
            </Button>
          </Stack>
        </DialogTitle>

        <Divider />

        <DialogContent sx={{ pt: 1.5 }}>
          {/* Filter chips */}
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            {[
              { value: 'all', label: `All (${directors.length + additionalDirectors.length})` },
              { value: 'director', label: `Directors (${directors.length})` },
              { value: 'additional_director', label: `Additional Directors (${additionalDirectors.length})` },
            ].map((opt) => (
              <Chip
                key={opt.value}
                label={opt.label}
                clickable
                color={manageFilter === opt.value ? 'primary' : 'default'}
                variant={manageFilter === opt.value ? 'filled' : 'outlined'}
                size="small"
                onClick={() => { setManageFilter(opt.value); setManagePage(1); }}
              />
            ))}
          </Stack>

          {/* List table */}
          {loadingManage ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={32} />
            </Box>
          ) : allDirectorUsers.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
              No users found. Click "Add New" to create one.
            </Typography>
          ) : (
            <>
              <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                      <TableCell sx={{ fontWeight: 600, fontSize: '0.78rem' }}>#</TableCell>
                      <TableCell sx={{ fontWeight: 600, fontSize: '0.78rem' }}>Full Name</TableCell>
                      <TableCell sx={{ fontWeight: 600, fontSize: '0.78rem' }}>Username</TableCell>
                      <TableCell sx={{ fontWeight: 600, fontSize: '0.78rem' }}>Email</TableCell>
                      <TableCell sx={{ fontWeight: 600, fontSize: '0.78rem' }}>Type</TableCell>
                      <TableCell sx={{ fontWeight: 600, fontSize: '0.78rem' }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {managePageItems.map((u, idx) => (
                      <TableRow key={u.id} hover>
                        <TableCell sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
                          {(managePage - 1) * MANAGE_PAGE_SIZE + idx + 1}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.82rem', fontWeight: 500 }}>{u.name || '—'}</TableCell>
                        <TableCell sx={{ fontSize: '0.82rem' }}>{u.username || '—'}</TableCell>
                        <TableCell sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>{u.email || '—'}</TableCell>
                        <TableCell>
                          <Chip
                            label={u.user_type === 'director' ? 'Director' : 'Addl. Director'}
                            size="small"
                            color={u.user_type === 'director' ? 'primary' : 'secondary'}
                            variant="outlined"
                            sx={{ fontSize: '0.68rem', height: 20 }}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={u.is_active ? 'Active' : 'Inactive'}
                            size="small"
                            color={u.is_active ? 'success' : 'error'}
                            variant="outlined"
                            sx={{ fontSize: '0.68rem', height: 20 }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Pagination */}
              {manageTotalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <Pagination
                    count={manageTotalPages}
                    page={managePage}
                    onChange={(_, val) => setManagePage(val)}
                    size="small"
                    color="primary"
                    shape="rounded"
                  />
                </Box>
              )}
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setManageOpen(false)} variant="outlined">Close</Button>
        </DialogActions>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════════════════
          Add New Director / Additional Director
      ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={createOpen} onClose={closeCreateDialog} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>Add New</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {/* Type selector */}
            <FormControl fullWidth size="small">
              <Select
                value={createForm.user_type}
                onChange={(e) => handleCreateFormChange('user_type', e.target.value)}
              >
                <MenuItem value="director">Director</MenuItem>
                <MenuItem value="additional_director">Additional Director</MenuItem>
              </Select>
            </FormControl>

            <TextField label="Full Name" size="small" fullWidth value={createForm.card_name}
              onChange={(e) => handleCreateFormChange('card_name', e.target.value)} placeholder="e.g. John Doe" />

            <TextField label="Username *" size="small" fullWidth value={createForm.username}
              onChange={(e) => handleCreateFormChange('username', e.target.value)}
              error={!!createFormErrors.username} helperText={createFormErrors.username} />

            <TextField label="Email" size="small" fullWidth type="email" value={createForm.email}
              onChange={(e) => handleCreateFormChange('email', e.target.value)}
              error={!!createFormErrors.email} helperText={createFormErrors.email} />

            <TextField
              label="Password *" size="small" fullWidth
              type={showPassword ? 'text' : 'password'}
              value={createForm.password}
              onChange={(e) => handleCreateFormChange('password', e.target.value)}
              error={!!createFormErrors.password} helperText={createFormErrors.password}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowPassword((p) => !p)} edge="end">
                      {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              label="Confirm Password *" size="small" fullWidth
              type={showPassword ? 'text' : 'password'}
              value={createForm.confirmPassword}
              onChange={(e) => handleCreateFormChange('confirmPassword', e.target.value)}
              error={!!createFormErrors.confirmPassword} helperText={createFormErrors.confirmPassword}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeCreateDialog} variant="text" disabled={createSaving}>Cancel</Button>
          <Button onClick={handleCreateSubmit} variant="contained" disabled={createSaving}
            startIcon={createSaving ? <CircularProgress size={14} color="inherit" /> : null}>
            {createSaving ? 'Creating…' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════════════════
          Assign Director / Additional Director Dialog
      ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={assignDialogOpen} onClose={closeAssignDialog} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>Assign {dialogLabel}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1.5, color: 'text.secondary' }}>
            {selectedAssignRow
              ? `Target: ${selectedAssignRow.rowType === 'manager' ? 'Sales Manager' : 'Sales Head'} — ${selectedAssignRow.username}`
              : ''}
          </Typography>
          <FormControl fullWidth size="small">
            <Select value={selectedValueInDialog} displayEmpty onChange={(e) => setSelectedValueInDialog(e.target.value)} disabled={dialogLoading}>
              <MenuItem value=""><em>{dialogLoading ? `Loading…` : `Select ${dialogLabel}`}</em></MenuItem>
              {dialogList.map((item) => (
                <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {dialogList.length === 0 && !dialogLoading && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              No {dialogLabel.toLowerCase()} users found. Use the "Directors" button to add one.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeAssignDialog} variant="text" disabled={assignSaving}>Cancel</Button>
          <Button onClick={applyAssignment} variant="contained" disabled={assignSaving}>
            {assignSaving ? 'Saving…' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      <ToastContainer />
    </PageContainer>
  );
}
