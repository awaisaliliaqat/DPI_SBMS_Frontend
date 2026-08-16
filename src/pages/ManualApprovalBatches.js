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
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  Print as PrintIcon,
  UploadFile as UploadFileIcon,
  Description as FormIcon,
} from '@mui/icons-material';
import { GridActionsCellItem } from '@mui/x-data-grid';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from '../auth/AuthContext';
import { useApi } from '../hooks/useApi';
import ReusableDataTable from '../components/ReusableData';
import PageContainer from '../components/PageContainer';
import { buildManualApprovalBatchFormHtml } from '../utils/manualApprovalBatchForm';

const INITIAL_PAGE_SIZE = 10;
const TAB_KEY = 'manualApprovalBatch';

const formatMoney = (value) =>
  `Rs. ${Number(value || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (value) => {
  if (!value) return 'N/A';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 'N/A' : d.toLocaleString('en-GB');
};

const describeItems = (items) =>
  (items || [])
    .map((item) => {
      const name = item.request_type_name || item.requestType?.name || 'N/A';
      const qty = item.quantity && item.quantity > 1 ? ` x${item.quantity}` : '';
      return `${name} (${item.width || '-'} x ${item.height || '-'})${qty}`;
    })
    .join(', ');

/** Opens a data URL in a new tab, converting to a blob first so large PDFs/images load reliably. */
async function openFileInNewTab(url) {
  if (!url) return;
  if (url.startsWith('data:')) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      return;
    } catch {
      // fall through to a direct open
    }
  }
  window.open(url, '_blank');
}

export default function ManualApprovalBatches() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const { user } = useAuth();
  // This page has its own tab permission, independent of shopboardRequest.
  const canRead = user?.permissions?.[TAB_KEY]?.includes('read') || false;
  const canUploadForm = canRead;

  const { get, upload } = useApi();

  const [viewMode, setViewMode] = React.useState(searchParams.get('view') === 'individual' ? 'individual' : 'batch');
  const [rowsState, setRowsState] = React.useState({ rows: [], rowCount: 0 });
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const [detailsModalOpen, setDetailsModalOpen] = React.useState(false);
  const [batchDetails, setBatchDetails] = React.useState(null);
  const [loadingDetails, setLoadingDetails] = React.useState(false);
  const [printingBatchId, setPrintingBatchId] = React.useState(null);
  const [uploadingBatchId, setUploadingBatchId] = React.useState(null);

  const uploadInputRef = React.useRef(null);
  const uploadTargetBatchId = React.useRef(null);

  const [paginationModel, setPaginationModel] = React.useState({
    page: searchParams.get('page') ? Number(searchParams.get('page')) : 0,
    pageSize: searchParams.get('pageSize') ? Number(searchParams.get('pageSize')) : INITIAL_PAGE_SIZE,
  });

  const [filterModel, setFilterModel] = React.useState(
    searchParams.get('filter') ? JSON.parse(searchParams.get('filter') ?? '') : { items: [] }
  );

  const [sortModel, setSortModel] = React.useState(
    searchParams.get('sort') ? JSON.parse(searchParams.get('sort') ?? '') : []
  );

  const handlePaginationModelChange = React.useCallback(
    (model) => {
      setPaginationModel(model);
      searchParams.set('page', String(model.page));
      searchParams.set('pageSize', String(model.pageSize));
      const qs = searchParams.toString();
      navigate(`${pathname}${qs ? '?' : ''}${qs}`);
    },
    [navigate, pathname, searchParams]
  );

  const handleFilterModelChange = React.useCallback(
    (model) => {
      setFilterModel(model);
      if (model.items.length > 0 || (model.quickFilterValues && model.quickFilterValues.length > 0)) {
        searchParams.set('filter', JSON.stringify(model));
      } else {
        searchParams.delete('filter');
      }
      const qs = searchParams.toString();
      navigate(`${pathname}${qs ? '?' : ''}${qs}`);
    },
    [navigate, pathname, searchParams]
  );

  const handleSortModelChange = React.useCallback(
    (model) => {
      setSortModel(model);
      if (model.length > 0) {
        searchParams.set('sort', JSON.stringify(model));
      } else {
        searchParams.delete('sort');
      }
      const qs = searchParams.toString();
      navigate(`${pathname}${qs ? '?' : ''}${qs}`);
    },
    [navigate, pathname, searchParams]
  );

  const handleViewModeChange = React.useCallback(
    (_event, nextMode) => {
      if (!nextMode || nextMode === viewMode) return;
      setViewMode(nextMode);
      setPaginationModel((prev) => ({ ...prev, page: 0 }));
      searchParams.set('view', nextMode);
      searchParams.set('page', '0');
      const qs = searchParams.toString();
      navigate(`${pathname}${qs ? '?' : ''}${qs}`);
    },
    [navigate, pathname, searchParams, viewMode]
  );

  const loadData = React.useCallback(async () => {
    if (!canRead) {
      setRowsState({ rows: [], rowCount: 0 });
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const { page, pageSize } = paginationModel;
      const endpoint =
        viewMode === 'individual'
          ? `/api/manual-approval-batches/individual?page=${page}&size=${pageSize}`
          : `/api/manual-approval-batches?page=${page}&size=${pageSize}`;

      const response = await get(endpoint);

      if (response.success) {
        setRowsState({
          rows: response.data || [],
          rowCount: response.totalCount || 0,
        });
      } else {
        setRowsState({ rows: [], rowCount: 0 });
      }
    } catch (loadError) {
      if (loadError.message && !loadError.message.includes('401') && !loadError.message.includes('403')) {
        setError(loadError.message || 'Failed to load manual approvals');
        toast.error('Failed to load manual approvals', {
          position: 'top-right',
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      }
      console.error('Error loading manual approvals:', loadError);
      setRowsState({ rows: [], rowCount: 0 });
    } finally {
      setIsLoading(false);
    }
  }, [canRead, get, paginationModel, viewMode]);

  React.useEffect(() => {
    if (canRead) loadData();
  }, [loadData, canRead]);

  const handleRefresh = React.useCallback(() => {
    if (!isLoading && canRead) loadData();
  }, [isLoading, canRead, loadData]);

  const handleViewBatch = React.useCallback(
    async (batchId) => {
      if (!canRead || !batchId) return;
      setDetailsModalOpen(true);
      setLoadingDetails(true);
      setBatchDetails(null);
      try {
        const response = await get(`/api/manual-approval-batches/${batchId}`);
        if (response.success) {
          setBatchDetails(response.data);
        } else {
          throw new Error(response.message || 'Failed to load batch details');
        }
      } catch (e) {
        toast.error(`Failed to load batch details: ${e.message}`, {
          position: 'top-right',
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      } finally {
        setLoadingDetails(false);
      }
    },
    [canRead, get]
  );

  /** Download form = the printable batch approval form (browser print dialog -> Save as PDF). */
  const handleDownloadBatchForm = React.useCallback(
    async (batchId) => {
      if (!batchId) return;
      setPrintingBatchId(batchId);
      try {
        const response = await get(`/api/manual-approval-batches/${batchId}`);
        if (!response.success) throw new Error(response.message || 'Failed to load batch');

        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.top = '-10000px';
        iframe.style.left = '-10000px';
        iframe.style.width = '210mm';
        iframe.style.height = '297mm';
        document.body.appendChild(iframe);

        const iframeDoc = iframe.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write(buildManualApprovalBatchFormHtml(response.data));
        iframeDoc.close();

        setTimeout(() => {
          try {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
          } catch (printErr) {
            console.error('Print failed:', printErr);
          }
          setTimeout(() => {
            if (iframe.parentNode) document.body.removeChild(iframe);
          }, 1000);
        }, 400);
      } catch (e) {
        toast.error(`Failed to generate form: ${e.message}`, {
          position: 'top-right',
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      } finally {
        setPrintingBatchId(null);
      }
    },
    [get]
  );

  const handleTriggerUpload = React.useCallback((batchId) => {
    if (!batchId) return;
    uploadTargetBatchId.current = batchId;
    if (uploadInputRef.current) {
      uploadInputRef.current.value = '';
      uploadInputRef.current.click();
    }
  }, []);

  const handleUploadFileSelected = React.useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      const batchId = uploadTargetBatchId.current;
      if (!file || !batchId) return;

      setUploadingBatchId(batchId);
      try {
        const formData = new FormData();
        formData.append('manual_approval_file', file);

        const response = await upload(`/api/manual-approval-batches/${batchId}/form`, formData);

        if (response.success) {
          toast.success('Signed form uploaded successfully', {
            position: 'top-right',
            autoClose: 3000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          });
          loadData();
        } else {
          throw new Error(response.message || 'Upload failed');
        }
      } catch (e) {
        toast.error(`Failed to upload form: ${e.message}`, {
          position: 'top-right',
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      } finally {
        setUploadingBatchId(null);
        uploadTargetBatchId.current = null;
      }
    },
    [upload, loadData]
  );

  const handleViewUploadedForm = React.useCallback(
    async (batchId) => {
      if (!batchId) return;
      try {
        const response = await get(`/api/manual-approval-batches/${batchId}/form`);
        if (response.success && response.data?.url) {
          openFileInNewTab(response.data.url);
        } else {
          throw new Error(response.message || 'No signed form found');
        }
      } catch (e) {
        toast.error(`Failed to open form: ${e.message}`, {
          position: 'top-right',
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      }
    },
    [get]
  );

  const batchColumns = React.useMemo(
    () => [
      { field: 'batch_number', headerName: 'Batch Number', width: 170 },
      {
        field: 'approval_date',
        headerName: 'Approval Date',
        width: 180,
        renderCell: (params) => <span>{formatDate(params.value)}</span>,
      },
      { field: 'created_by_name', headerName: 'Approved By', width: 160 },
      {
        field: 'total_requests',
        headerName: 'Requests',
        width: 110,
        align: 'right',
        headerAlign: 'right',
      },
      {
        field: 'total_amount',
        headerName: 'Total Amount',
        width: 160,
        align: 'right',
        headerAlign: 'right',
        renderCell: (params) => <span>{formatMoney(params.value)}</span>,
      },
      {
        field: 'has_form',
        headerName: 'Signed Form',
        width: 140,
        renderCell: (params) => (
          <Chip
            label={params.value ? 'Uploaded' : 'Pending'}
            color={params.value ? 'success' : 'default'}
            size="small"
          />
        ),
      },
      {
        field: 'actions',
        type: 'actions',
        headerName: 'Actions',
        width: 190,
        getActions: (params) => {
          const actions = [
            <GridActionsCellItem
              key="view"
              icon={<Tooltip title="View Requests"><VisibilityIcon /></Tooltip>}
              label="View Requests"
              onClick={() => handleViewBatch(params.row.id)}
              color="primary"
            />,
            <GridActionsCellItem
              key="download"
              icon={
                <Tooltip title="Download Form">
                  {printingBatchId === params.row.id ? <CircularProgress size={18} /> : <PrintIcon />}
                </Tooltip>
              }
              label="Download Form"
              onClick={() => handleDownloadBatchForm(params.row.id)}
              color="secondary"
            />,
          ];

          if (canUploadForm) {
            actions.push(
              <GridActionsCellItem
                key="upload"
                icon={
                  <Tooltip title="Upload Signed Form">
                    {uploadingBatchId === params.row.id ? <CircularProgress size={18} /> : <UploadFileIcon />}
                  </Tooltip>
                }
                label="Upload Signed Form"
                onClick={() => handleTriggerUpload(params.row.id)}
                color="warning"
              />
            );
          }

          if (params.row.has_form) {
            actions.push(
              <GridActionsCellItem
                key="viewForm"
                icon={<Tooltip title="View Signed Form"><FormIcon /></Tooltip>}
                label="View Signed Form"
                onClick={() => handleViewUploadedForm(params.row.id)}
                color="info"
              />
            );
          }

          return actions;
        },
      },
    ],
    [
      canUploadForm,
      handleViewBatch,
      handleDownloadBatchForm,
      handleTriggerUpload,
      handleViewUploadedForm,
      printingBatchId,
      uploadingBatchId,
    ]
  );

  const individualColumns = React.useMemo(
    () => [
      { field: 'request_id', headerName: 'Request ID', width: 110 },
      { field: 'dealer_name', headerName: 'Dealer Name', width: 200 },
      { field: 'vendor_name', headerName: 'Vendor Name', width: 170 },
      { field: 'created_by_name', headerName: 'Created By', width: 150 },
      {
        field: 'requestItems',
        headerName: 'Request Items',
        width: 280,
        sortable: false,
        renderCell: (params) => (
          <Tooltip title={describeItems(params.value) || 'N/A'}>
            <span>{describeItems(params.value) || 'N/A'}</span>
          </Tooltip>
        ),
      },
      {
        field: 'amount',
        headerName: 'Total Amount',
        width: 150,
        align: 'right',
        headerAlign: 'right',
        renderCell: (params) => <span>{formatMoney(params.value)}</span>,
      },
      { field: 'batch_number', headerName: 'Batch', width: 150 },
      {
        field: 'approval_date',
        headerName: 'Approval Date',
        width: 180,
        renderCell: (params) => <span>{formatDate(params.value)}</span>,
      },
      { field: 'approved_by_name', headerName: 'Approved By', width: 150 },
      {
        field: 'has_form',
        headerName: 'Signed Form',
        width: 140,
        renderCell: (params) => (
          <Chip
            label={params.value ? 'Uploaded' : 'Pending'}
            color={params.value ? 'success' : 'default'}
            size="small"
          />
        ),
      },
      {
        field: 'actions',
        type: 'actions',
        headerName: 'Actions',
        width: 130,
        getActions: (params) => {
          const actions = [
            <GridActionsCellItem
              key="viewBatch"
              icon={<Tooltip title="View Batch"><VisibilityIcon /></Tooltip>}
              label="View Batch"
              onClick={() => handleViewBatch(params.row.batch_id)}
              color="primary"
            />,
          ];

          if (params.row.has_form) {
            actions.push(
              <GridActionsCellItem
                key="viewForm"
                icon={<Tooltip title="View Signed Form"><FormIcon /></Tooltip>}
                label="View Signed Form"
                onClick={() => handleViewUploadedForm(params.row.batch_id)}
                color="info"
              />
            );
          }

          return actions;
        },
      },
    ],
    [handleViewBatch, handleViewUploadedForm]
  );

  const pageTitle = 'Manual Approvals';

  if (!canRead) {
    return (
      <PageContainer title={pageTitle} breadcrumbs={[{ title: pageTitle }]}>
        <Alert severity="error" sx={{ mb: 2 }}>
          You do not have permission to view this page
        </Alert>
        <ToastContainer position="top-right" autoClose={5000} theme="light" />
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

      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <ToggleButtonGroup value={viewMode} exclusive onChange={handleViewModeChange} size="small" color="primary">
          <ToggleButton value="batch" sx={{ textTransform: 'none', fontWeight: 'bold', px: 3 }}>
            Batches
          </ToggleButton>
          <ToggleButton value="individual" sx={{ textTransform: 'none', fontWeight: 'bold', px: 3 }}>
            Individual
          </ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="body2" color="text.secondary">
          {viewMode === 'batch'
            ? 'Each row is one bulk manual approval. Download the form, get it signed, then upload it back.'
            : 'Every manually approved request, with the batch and signed form it belongs to.'}
        </Typography>
      </Box>

      <input
        ref={uploadInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        style={{ display: 'none' }}
        onChange={handleUploadFileSelected}
      />

      <ReusableDataTable
        data={rowsState.rows}
        columns={viewMode === 'batch' ? batchColumns : individualColumns}
        loading={isLoading}
        error={error}
        paginationModel={paginationModel}
        onPaginationModelChange={handlePaginationModelChange}
        rowCount={rowsState.rowCount}
        paginationMode="server"
        sortModel={sortModel}
        onSortModelChange={handleSortModelChange}
        sortingMode="server"
        filterModel={filterModel}
        onFilterModelChange={handleFilterModelChange}
        filterMode="client"
        onView={null}
        onEdit={null}
        onDelete={null}
        onRefresh={handleRefresh}
        pageSizeOptions={[5, 10, 25, 50]}
        showToolbar={true}
        hideCreateButton={true}
        disableColumnFilter={true}
        disableColumnMenu={true}
      />

      <Dialog
        open={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false);
          setBatchDetails(null);
        }}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', borderBottom: '1px solid #eaeaea' }}>
          {batchDetails ? `Batch ${batchDetails.batch_number}` : 'Batch Details'}
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          {loadingDetails && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {!loadingDetails && batchDetails && (
            <Box>
              <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Approval Details
                </Typography>
                <Typography variant="body2">Approved By: {batchDetails.created_by_name}</Typography>
                <Typography variant="body2">Approval Date: {formatDate(batchDetails.approval_date)}</Typography>
                <Typography variant="body2">Total Requests: {batchDetails.total_requests}</Typography>
                <Typography variant="body2">Total Amount: {formatMoney(batchDetails.total_amount)}</Typography>
                <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                  Reason: {batchDetails.manual_approval_reason || 'N/A'}
                </Typography>
              </Paper>

              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 420 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Request ID</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Dealer Name</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Vendor Name</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Created By</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Request Items</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }} align="right">Total Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(batchDetails.requests || []).map((request) => (
                      <TableRow key={request.id} hover>
                        <TableCell>{request.id}</TableCell>
                        <TableCell>{request.dealer_name}</TableCell>
                        <TableCell>{request.vendor_name}</TableCell>
                        <TableCell>{request.created_by_name}</TableCell>
                        <TableCell sx={{ maxWidth: 320 }}>
                          <Typography variant="body2" sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                            {describeItems(request.requestItems) || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{formatMoney(request.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, gap: 1 }}>
          {batchDetails && (
            <Button
              variant="outlined"
              startIcon={<PrintIcon />}
              onClick={() => handleDownloadBatchForm(batchDetails.id)}
              sx={{ textTransform: 'none' }}
            >
              Download Form
            </Button>
          )}
          <Button
            variant="contained"
            onClick={() => {
              setDetailsModalOpen(false);
              setBatchDetails(null);
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
        toastStyle={{ backgroundColor: '#ffffff', color: '#333333' }}
      />
    </PageContainer>
  );
}
