import * as React from 'react';
import {
  Alert,
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  IconButton,
  Backdrop,
  CircularProgress,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  Download as DownloadIcon,
  CheckCircle as CompleteIcon,
  Cancel as RejectIcon,
  Payment as PaymentIcon,
  Description as RequestIcon,
  History as HistoryIcon,
  Print as PrintIcon,
  Receipt as InvoiceIcon,
  ShoppingCart as OldPurchasesIcon,
} from '@mui/icons-material';
import { GridActionsCellItem } from '@mui/x-data-grid';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from '../auth/AuthContext';
import { useApi } from '../hooks/useApi';
import ReusableDataTable from '../components/ReusableData';
import PageContainer from '../components/PageContainer';
import DynamicModal from '../components/DynamicModel';
import InvoiceViewer from '../components/InvoiceViewer';
import OldPurchasesModal from '../components/OldPurchasesModal';
import { BASE_URL } from '../constants/Constants';
import {
  getStatusDisplayName,
  getStatusColor as getStatusColorHelper,
} from '../constants/ShopboardRequestStatus';

const INITIAL_PAGE_SIZE = 10;

function getFileUrlAndName(item, index, fallbackLabel) {
  if (item == null) return { url: '', fileName: fallbackLabel };
  if (typeof item === 'object' && item.url != null) return { url: item.url, fileName: item.fileName || fallbackLabel };
  const str = typeof item === 'string' ? item : '';
  return { url: str, fileName: str.startsWith('data:') ? fallbackLabel : str.split('/').pop() || fallbackLabel };
}

async function openFileInNewTab(url) {
  if (!url) return;
  if (url.startsWith('data:')) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch {
      window.open(url, '_blank');
    }
  } else {
    window.open(url, '_blank');
  }
}

const isVoucherSentStatus = (status) =>
  String(status || '').trim().toLowerCase() === 'voucher sent';

const getBatchStatusColor = (status) => {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'voucher sent') return 'warning';
  if (normalized === 'payment successful') return 'success';
  if (normalized === 'rejected') return 'error';
  return 'default';
};

export default function PaymentBatch() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const { user } = useAuth();

  // Check user permissions
  const canRead = user?.permissions?.paymentBatch?.includes('read') || false;

  const { get, post } = useApi();
  const [rowsState, setRowsState] = React.useState({
    rows: [],
    rowCount: 0,
  });

  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  
  // Modal state
  const [viewModalOpen, setViewModalOpen] = React.useState(false);
  const [selectedBatch, setSelectedBatch] = React.useState(null);
  const [batchDetails, setBatchDetails] = React.useState(null);
  const [loadingDetails, setLoadingDetails] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [confirmDialog, setConfirmDialog] = React.useState(null);
  const [rejectComment, setRejectComment] = React.useState('');

  // Per-request actions (same as Payments page)
  const [loadingRequestDetails, setLoadingRequestDetails] = React.useState(false);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [selectedRequest, setSelectedRequest] = React.useState(null);
  const [detailedViewModalOpen, setDetailedViewModalOpen] = React.useState(false);
  const [selectedDetailedRequest, setSelectedDetailedRequest] = React.useState(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = React.useState(false);
  const [selectedInvoiceRequest, setSelectedInvoiceRequest] = React.useState(null);
  const [historyDialogOpen, setHistoryDialogOpen] = React.useState(false);
  const [requestToAction, setRequestToAction] = React.useState(null);
  const [requestHistory, setRequestHistory] = React.useState([]);
  const [loadingHistory, setLoadingHistory] = React.useState(false);
  const [oldPurchasesModalOpen, setOldPurchasesModalOpen] = React.useState(false);
  const [selectedDealerForOldPurchases, setSelectedDealerForOldPurchases] = React.useState(null);

  // Table state management
  const [paginationModel, setPaginationModel] = React.useState({
    page: searchParams.get('page') ? Number(searchParams.get('page')) : 0,
    pageSize: searchParams.get('pageSize')
      ? Number(searchParams.get('pageSize'))
      : INITIAL_PAGE_SIZE,
  });

  const [filterModel, setFilterModel] = React.useState(
    searchParams.get('filter')
      ? JSON.parse(searchParams.get('filter') ?? '')
      : { items: [] },
  );

  const [sortModel, setSortModel] = React.useState(
    searchParams.get('sort') ? JSON.parse(searchParams.get('sort') ?? '') : [],
  );

  // URL state synchronization
  const handlePaginationModelChange = React.useCallback(
    (model) => {
      setPaginationModel(model);
      searchParams.set('page', String(model.page));
      searchParams.set('pageSize', String(model.pageSize));
      const newSearchParamsString = searchParams.toString();
      navigate(
        `${pathname}${newSearchParamsString ? '?' : ''}${newSearchParamsString}`,
      );
    },
    [navigate, pathname, searchParams],
  );

  const handleFilterModelChange = React.useCallback(
    (model) => {
      setFilterModel(model);
      if (
        model.items.length > 0 ||
        (model.quickFilterValues && model.quickFilterValues.length > 0)
      ) {
        searchParams.set('filter', JSON.stringify(model));
      } else {
        searchParams.delete('filter');
      }
      const newSearchParamsString = searchParams.toString();
      navigate(
        `${pathname}${newSearchParamsString ? '?' : ''}${newSearchParamsString}`,
      );
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
      navigate(
        `${pathname}${newSearchParamsString ? '?' : ''}${newSearchParamsString}`,
      );
    },
    [navigate, pathname, searchParams],
  );

  // API call to fetch payment batches with pagination
  const loadPaymentBatches = React.useCallback(async () => {
    if (!canRead) {
      setRowsState({
        rows: [],
        rowCount: 0,
      });
      return;
    }
    
    setError(null);
    setIsLoading(true);

    try {
      const { page, pageSize } = paginationModel;
      
      const apiUrl = `/api/payment-batches?page=${page}&size=${pageSize}`;
      
      const batchesData = await get(apiUrl);
      
      if (batchesData.success) {
        setRowsState({
          rows: batchesData.data || [],
          rowCount: batchesData.totalCount || 0,
        });
      } else {
        setRowsState({
          rows: [],
          rowCount: 0,
        });
      }
      
    } catch (loadError) {
      // Don't show error toast if it's a permission issue (403) or if user doesn't have permission
      if (loadError.message && !loadError.message.includes('401') && !loadError.message.includes('403')) {
        setError(loadError.message || 'Failed to load payment batches');
        toast.error('Failed to load payment batches', {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      }
      console.error('Error loading payment batches:', loadError);
      setRowsState({
        rows: [],
        rowCount: 0,
      });
    } finally {
      setIsLoading(false);
    }
  }, [paginationModel, get, canRead]);

  // Load data when component mounts or pagination changes
  React.useEffect(() => {
    // Only load if user has read permission
    if (canRead) {
      loadPaymentBatches();
    }
  }, [loadPaymentBatches, canRead]);


  // Helper function to get vendor name
  const getVendorName = React.useCallback((request) => {
    if (request?.vendor && (request.vendor.card_name || request.vendor.username)) {
      return request.vendor.card_name || request.vendor.username;
    }
    if (request?.vendor_name) {
      return request.vendor_name;
    }
    if (request?.vendor_code) {
      return String(request.vendor_code);
    }
    return 'Not Assigned';
  }, []);

  // Fetch batch details
  const fetchBatchDetails = React.useCallback(async (batchId) => {
    setLoadingDetails(true);
    try {
      const response = await get(`/api/payment-batches/${batchId}`);
      if (response.success) {
        setBatchDetails(response.data);
      } else {
        throw new Error(response.message || 'Failed to load batch details');
      }
    } catch (error) {
      console.error('Error fetching batch details:', error);
      toast.error(`Failed to load batch details: ${error.message}`, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } finally {
      setLoadingDetails(false);
    }
  }, [get]);

  // Action handlers
  const handleView = React.useCallback((batchData) => {
    if (!canRead) return;
    setSelectedBatch(batchData);
    setViewModalOpen(true);
    fetchBatchDetails(batchData.id);
  }, [canRead, fetchBatchDetails]);

  const handleRefresh = React.useCallback(() => {
    if (!isLoading && canRead) {
      loadPaymentBatches();
    }
  }, [isLoading, loadPaymentBatches, canRead]);

  const handleCompleteBatch = React.useCallback(async (batchId, batchNumber) => {
    setActionLoading(true);
    try {
      const response = await post(`/api/payment-batches/${batchId}/complete`, {});
      if (response.success) {
        toast.success(response.message || `Batch ${batchNumber} completed`, {
          position: 'top-right',
          autoClose: 3000,
        });
        setViewModalOpen(false);
        setSelectedBatch(null);
        setBatchDetails(null);
        loadPaymentBatches();
      } else {
        throw new Error(response.message || 'Failed to complete batch');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to complete batch', {
        position: 'top-right',
        autoClose: 5000,
      });
    } finally {
      setActionLoading(false);
      setConfirmDialog(null);
    }
  }, [post, loadPaymentBatches]);

  const handleRejectBatch = React.useCallback(async (batchId, batchNumber, comment) => {
    setActionLoading(true);
    try {
      const response = await post(`/api/payment-batches/${batchId}/reject`, { comment });
      if (response.success) {
        toast.success(response.message || `Batch ${batchNumber} rejected`, {
          position: 'top-right',
          autoClose: 3000,
        });
        setViewModalOpen(false);
        setSelectedBatch(null);
        setBatchDetails(null);
        loadPaymentBatches();
      } else {
        throw new Error(response.message || 'Failed to reject batch');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to reject batch', {
        position: 'top-right',
        autoClose: 5000,
      });
    } finally {
      setActionLoading(false);
      setConfirmDialog(null);
      setRejectComment('');
    }
  }, [post, loadPaymentBatches]);

  const handleRejectBatchItem = React.useCallback(async (batchId, requestId, comment) => {
    setActionLoading(true);
    try {
      const response = await post(`/api/payment-batches/${batchId}/items/${requestId}/reject`, { comment });
      if (response.success) {
        toast.success(response.message || `Request #${requestId} rejected`, {
          position: 'top-right',
          autoClose: 3000,
        });
        await fetchBatchDetails(batchId);
        loadPaymentBatches();
        if (response.data?.remainingRequests === 0) {
          setViewModalOpen(false);
          setSelectedBatch(null);
          setBatchDetails(null);
        }
      } else {
        throw new Error(response.message || 'Failed to reject request');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to reject request', {
        position: 'top-right',
        autoClose: 5000,
      });
    } finally {
      setActionLoading(false);
      setConfirmDialog(null);
      setRejectComment('');
    }
  }, [post, fetchBatchDetails, loadPaymentBatches]);

  const openConfirmDialog = React.useCallback((config) => {
    setRejectComment('');
    setConfirmDialog(config);
  }, []);

  const fetchFullRequest = React.useCallback(async (id, includeFiles) => {
    const url = includeFiles
      ? `/api/shopboard-requests/${id}?includeFiles=${encodeURIComponent(includeFiles)}`
      : `/api/shopboard-requests/${id}`;
    const res = await get(url);
    if (res?.success && res?.data) return res.data;
    throw new Error('Failed to load request details');
  }, [get]);

  const handleViewRequest = React.useCallback(async (requestData) => {
    if (!canRead || !requestData?.id) return;
    setLoadingRequestDetails(true);
    try {
      const full = await fetchFullRequest(requestData.id, 'details');
      setSelectedRequest(full);
      setModalOpen(true);
    } catch (e) {
      toast.error('Failed to load request details', { position: 'top-right', autoClose: 5000 });
    } finally {
      setLoadingRequestDetails(false);
    }
  }, [canRead, fetchFullRequest]);

  const handleViewRequestDetails = React.useCallback(async (requestData) => {
    if (!requestData?.id) return;
    setLoadingRequestDetails(true);
    try {
      const full = await fetchFullRequest(requestData.id, 'details');
      setSelectedDetailedRequest(full);
      setDetailedViewModalOpen(true);
    } catch (e) {
      toast.error('Failed to load request details', { position: 'top-right', autoClose: 5000 });
    } finally {
      setLoadingRequestDetails(false);
    }
  }, [fetchFullRequest]);

  const handleViewRequestInvoice = React.useCallback(async (requestData) => {
    if (!canRead || !requestData?.id) return;
    setLoadingRequestDetails(true);
    try {
      const full = await fetchFullRequest(requestData.id, 'invoice');
      setSelectedInvoiceRequest(full);
      setInvoiceModalOpen(true);
    } catch (e) {
      toast.error('Failed to load request details', { position: 'top-right', autoClose: 5000 });
    } finally {
      setLoadingRequestDetails(false);
    }
  }, [canRead, fetchFullRequest]);

  const fetchRequestHistory = React.useCallback(async (requestId) => {
    setLoadingHistory(true);
    try {
      const response = await get(`/api/shopboard-logs/request/${requestId}`);
      if (response.success && response.data) {
        const sorted = [...response.data].sort((a, b) => {
          if (a.action === 'CURRENT' && b.action !== 'CURRENT') return -1;
          if (b.action === 'CURRENT' && a.action !== 'CURRENT') return 1;
          const da = a.changed_at ? new Date(a.changed_at).getTime() : 0;
          const db = b.changed_at ? new Date(b.changed_at).getTime() : 0;
          return db - da;
        });
        setRequestHistory(sorted);
      } else {
        setRequestHistory([]);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
      toast.error('Failed to load history', { position: 'top-right', autoClose: 5000 });
      setRequestHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [get]);

  const handleViewRequestHistory = React.useCallback((requestData) => {
    if (!canRead || !requestData?.id) return;
    setRequestToAction(requestData);
    setRequestHistory([]);
    setHistoryDialogOpen(true);
    fetchRequestHistory(requestData.id);
  }, [canRead, fetchRequestHistory]);

  const handleViewOldPurchases = React.useCallback((requestData) => {
    if (!canRead) return;
    const dealerId = requestData?.dealer?.code || requestData?.dealer_id;
    const dealerName = requestData?.dealer?.name || 'Dealer';
    if (!dealerId) {
      toast.error('Dealer information not available', { position: 'top-right', autoClose: 3000 });
      return;
    }
    setSelectedDealerForOldPurchases({ id: dealerId, name: dealerName });
    setOldPurchasesModalOpen(true);
  }, [canRead]);

  const generatePDF = React.useCallback(async (requestData) => {
    if (!canRead || !requestData?.id) return;
    setLoadingRequestDetails(true);
    try {
      const full = await fetchFullRequest(requestData.id, 'details');
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.top = '-10000px';
      iframe.style.left = '-10000px';
      iframe.style.width = '210mm';
      iframe.style.height = '297mm';
      document.body.appendChild(iframe);
      const iframeDoc = iframe.contentWindow.document;
      const templateHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Payment Details - ${full.id}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}@page{size:A4;margin:10mm}body{font-family:Arial,sans-serif;color:#333;width:210mm;margin:0 auto}.container{padding:15px}.header{text-align:center;margin-bottom:15px;border-bottom:2px solid #2c3e50;padding-bottom:8px}.header h1{font-size:24px;color:#2c3e50}.header h2{font-size:14px;color:#7f8c8d;font-weight:normal}.section{margin-bottom:12px}.section-title{font-size:12px;font-weight:bold;color:#2c3e50;text-transform:uppercase;border-bottom:1.5px solid #3498db;margin-bottom:8px;padding-bottom:4px}.fields-row{display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:8px}.field-label{font-size:9.5px;font-weight:bold;color:#555}.field-value{font-size:10.5px;border-bottom:.5px solid #ddd;min-height:14px}.items-table{width:100%;border-collapse:collapse;font-size:10px}.items-table th,.items-table td{padding:6px;border:1px solid #ddd}.items-table th{background:#f8f9fa}.total-box{background:#3498db;color:#fff;padding:8px;border-radius:3px;margin:10px 0;text-align:center}.total-amount{font-size:18px;font-weight:bold}</style></head>
<body><div class="container"><div class="header"><h1>DIAMOND PAINTS</h1><h2>Payment Details Report</h2></div>
<div class="section"><div class="section-title">Dealer Information</div>
<div class="fields-row"><div class="field"><div class="field-label">Dealer Name:</div><div class="field-value" id="dealer-name">-</div></div>
<div class="field"><div class="field-label">Dealer Code:</div><div class="field-value" id="dealer-code">-</div></div></div>
<div class="fields-row"><div class="field"><div class="field-label">Phone:</div><div class="field-value" id="dealer-phone">-</div></div>
<div class="field"><div class="field-label">Address:</div><div class="field-value" id="dealer-address">-</div></div></div></div>
<div class="section"><div class="section-title">Request Items</div>
<table class="items-table"><thead><tr><th>#</th><th>Type</th><th>Width</th><th>Height</th><th>Cost</th></tr></thead><tbody id="request-items"></tbody></table>
<div class="total-box"><div>Total Cost</div><div class="total-amount" id="total-cost">Rs 0.00</div></div></div>
<div class="section"><div class="section-title">Payment Information</div>
<div class="fields-row"><div class="field"><div class="field-label">Vendor:</div><div class="field-value" id="assigned-vendor">-</div></div>
<div class="field"><div class="field-label">Status:</div><div class="field-value" id="payment-status">-</div></div></div></div></div>
<script>
function populateTemplate(data){
  const clean=v=>v==null||v===''?'N/A':String(v);
  document.getElementById('dealer-name').textContent=clean(data.dealer&&data.dealer.name);
  document.getElementById('dealer-code').textContent=clean(data.dealer&&data.dealer.code);
  document.getElementById('dealer-phone').textContent=clean(data.dealer&&data.dealer.phone);
  document.getElementById('dealer-address').textContent=clean(data.dealer&&data.dealer.city);
  const tbody=document.getElementById('request-items');
  const items=data.requestItems||[];
  let total=0;
  if(items.length){items.forEach((item,i)=>{const cost=parseFloat(item.price)||0;total+=cost;const tr=document.createElement('tr');tr.innerHTML='<td>'+(i+1)+'</td><td>'+clean(item.requestType&&item.requestType.name)+'</td><td>'+(item.width||'N/A')+'</td><td>'+(item.height||'N/A')+'</td><td>Rs '+cost.toFixed(2)+'</td>';tbody.appendChild(tr);});}
  else{tbody.innerHTML='<tr><td colspan="5" style="text-align:center">No items</td></tr>';}
  document.getElementById('total-cost').textContent='Rs '+total.toFixed(2);
  document.getElementById('assigned-vendor').textContent=clean((data.vendor&&(data.vendor.card_name||data.vendor.name))||data.vendor_name||'Not assigned');
  document.getElementById('payment-status').textContent=clean(data.status);
  setTimeout(function(){window.print();},400);
}
window.populateRequestTemplate=populateTemplate;
</script></body></html>`;
      iframeDoc.open();
      iframeDoc.write(templateHtml);
      iframeDoc.close();
      iframe.onload = () => {
        setTimeout(() => {
          if (iframe.contentWindow.populateRequestTemplate) {
            iframe.contentWindow.populateRequestTemplate(full);
            setTimeout(() => {
              if (document.body.contains(iframe)) document.body.removeChild(iframe);
            }, 1000);
          }
        }, 100);
      };
      toast.success('PDF generation initiated. Please use the print dialog to save as PDF.', {
        position: 'top-right',
        autoClose: 3000,
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF. Please try again.', { position: 'top-right', autoClose: 5000 });
    } finally {
      setLoadingRequestDetails(false);
    }
  }, [canRead, fetchFullRequest]);

  const getRequestFields = (requestData = null) => {
    if (!requestData) return [];
    const fields = [];
    const hasParent =
      requestData?.dealer_relation?.parent &&
      requestData?.dealer?.id &&
      requestData.dealer.id !== requestData.dealer_relation.parent.id;
    if (hasParent && requestData.dealer_relation.parent) {
      fields.push(
        { name: 'parent_dealer_code', label: 'Parent Dealer Code', type: 'text', disabled: true },
        { name: 'parent_dealer_name', label: 'Parent Dealer Name', type: 'text', disabled: true },
        { name: 'parent_dealer_phone', label: 'Parent Dealer Phone', type: 'text', disabled: true },
      );
    }
    fields.push(
      { name: 'dealer_name', label: 'Dealer Name', type: 'text', disabled: true },
      { name: 'dealer_code', label: 'Dealer Code', type: 'text', disabled: true },
      { name: 'dealer_phone', label: 'Dealer Phone', type: 'text', disabled: true },
      { name: 'dealer_city', label: 'Dealer City', type: 'text', disabled: true },
      { name: 'dealer_type', label: 'Dealer Type', type: 'text', disabled: true },
      { name: 'vendor_name', label: 'Vendor Name', type: 'text', disabled: true },
      { name: 'status', label: 'Status', type: 'text', disabled: true },
      { name: 'total_cost', label: 'Total Cost', type: 'text', disabled: true },
      { name: 'created_at', label: 'Created At', type: 'text', disabled: true },
      { name: 'approval_date', label: 'Approval Date', type: 'text', disabled: true },
    );
    return fields;
  };

  const renderMainChanges = (log) => {
    const mc = log.main_changes || {};
    const entries = Object.entries(mc);
    if (entries.length === 0) return null;
    return (
      <Box sx={{ mb: 2 }}>
        {entries.map(([key, value], idx) => {
          if (key === 'assigned_vm' || value == null) return null;
          if (Array.isArray(value) && value.length === 0) return null;
          if (key === 'vendor_code') {
            return (
              <Typography key={`${key}-${idx}`} variant="body2" sx={{ color: '#333', mb: 0.5 }}>
                Vendor: {mc.vendor_name || value}
              </Typography>
            );
          }
          if (key === 'dealer_id') {
            return (
              <Typography key={`${key}-${idx}`} variant="body2" sx={{ color: '#333', mb: 0.5 }}>
                Dealer: {mc.dealer_name || value}
              </Typography>
            );
          }
          if (key === 'total_cost') {
            const num = Number(value);
            if (!isNaN(num) && num > 0) {
              return (
                <Typography key={`${key}-${idx}`} variant="body2" sx={{ color: '#333', mb: 0.5 }}>
                  Total Cost: Rs {num.toFixed(2)}
                </Typography>
              );
            }
            return null;
          }
          return (
            <Typography key={`${key}-${idx}`} variant="body2" sx={{ color: '#333', mb: 0.5 }}>
              {key}: {String(value)}
            </Typography>
          );
        })}
      </Box>
    );
  };

  const handleRowClick = React.useCallback(
    ({ row }) => {
      handleView(row);
    },
    [handleView],
  );

  // Column definitions
  const columns = React.useMemo(
    () => [
      { 
        field: 'id', 
        headerName: 'ID',
        width: 70,
        align: 'left',
        headerAlign: 'left',
      },
      {
        field: 'batch_number',
        headerName: 'Batch Number',
        width: 200,
        align: 'left',
        headerAlign: 'left',
        renderCell: (params) => (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
              {params.value}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'total_requests',
        headerName: 'Total Requests',
        width: 150,
        align: 'left',
        headerAlign: 'left',
        renderCell: (params) => (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Typography variant="body2">{params.value}</Typography>
          </Box>
        ),
      },
      {
        field: 'total_amount',
        headerName: 'Total Amount',
        width: 180,
        align: 'left',
        headerAlign: 'left',
        renderCell: (params) => (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#2e7d32' }}>
              Rs {parseFloat(params.value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'vendor_names',
        headerName: 'Vendor Name',
        minWidth: 200,
        flex: 1,
        align: 'left',
        headerAlign: 'left',
        renderCell: (params) => (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Typography variant="body2" sx={{ whiteSpace: 'normal', lineHeight: 1.4 }}>
              {params.value || 'Not Assigned'}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'status',
        headerName: 'Status',
        width: 150,
        align: 'left',
        headerAlign: 'left',
        renderCell: (params) => (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Chip 
              label={params.value || 'N/A'} 
              variant="filled" 
              size="small"
              color={getBatchStatusColor(params.value)}
            />
          </Box>
        ),
      },
      {
        field: 'payment_date',
        headerName: 'Payment Date',
        width: 180,
        align: 'left',
        headerAlign: 'left',
        renderCell: (params) => {
          const paymentDate = params.value;
          if (!paymentDate) return 'N/A';
          
          try {
            const date = new Date(paymentDate);
            return (
              <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                <Typography variant="body2">
                  {date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </Typography>
              </Box>
            );
          } catch (error) {
            return 'N/A';
          }
        },
      },
      {
        field: 'created_at',
        headerName: 'Created At',
        width: 180,
        align: 'left',
        headerAlign: 'left',
        renderCell: (params) => {
          const createdAt = params.value;
          if (!createdAt) return 'N/A';
          
          try {
            const date = new Date(createdAt);
            return (
              <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                <Typography variant="body2">
                  {date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  }) + ' ' + date.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                  })}
                </Typography>
              </Box>
            );
          } catch (error) {
            return 'N/A';
          }
        },
      },
      {
        field: 'creator',
        headerName: 'Created By',
        width: 150,
        align: 'left',
        headerAlign: 'left',
        renderCell: (params) => {
          const creator = params.row.creator;
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
              <Typography variant="body2">
                {creator?.username || 'N/A'}
              </Typography>
            </Box>
          );
        },
      },
      {
        field: 'actions',
        type: 'actions',
        headerName: 'Actions',
        width: 220,
        align: 'left',
        headerAlign: 'left',
        getActions: (params) => {
          const row = params.row;
          const actions = [];
          const voucherSent = isVoucherSentStatus(row.status);
          
          if (canRead) {
            actions.push(
              <GridActionsCellItem
                key="view"
                icon={<Tooltip title="View"><VisibilityIcon /></Tooltip>}
                label="View"
                onClick={() => handleView(row)}
                color="primary"
              />
            );
          }

          if (canRead && voucherSent) {
            actions.push(
              <GridActionsCellItem
                key="complete"
                icon={<Tooltip title="Complete Batch"><CompleteIcon sx={{ color: '#2e7d32' }} /></Tooltip>}
                label="Complete Batch"
                onClick={() => openConfirmDialog({
                  type: 'complete-batch',
                  batchId: row.id,
                  batchNumber: row.batch_number,
                  title: 'Complete Batch',
                  message: `Mark all requests in batch ${row.batch_number} as Payment Successful?`,
                })}
                color="success"
              />
            );
            actions.push(
              <GridActionsCellItem
                key="reject-batch"
                icon={<Tooltip title="Reject Batch"><RejectIcon sx={{ color: '#d32f2f' }} /></Tooltip>}
                label="Reject Batch"
                onClick={() => openConfirmDialog({
                  type: 'reject-batch',
                  batchId: row.id,
                  batchNumber: row.batch_number,
                  title: 'Reject Batch',
                  message: `Reject batch ${row.batch_number} and mark all requests as Finance Rejected?`,
                })}
                color="error"
              />
            );
          }
          
          return actions;
        },
      },
    ],
    [canRead, handleView, openConfirmDialog],
  );

  const pageTitle = 'Payment Batch';

  // Check if user has read permission on mount
  React.useEffect(() => {
    if (!canRead) {
      setError('You do not have permission to view this page');
      toast.error('You do not have permission to view this page', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    }
  }, [canRead, navigate]);

  // If user doesn't have read permission, show error message
  if (!canRead) {
    return (
      <PageContainer title={pageTitle} breadcrumbs={[{ title: pageTitle }]}>
        <Alert severity="error" sx={{ mb: 2 }}>
          You do not have permission to view this page
        </Alert>
        
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
          toastStyle={{
            backgroundColor: '#ffffff',
            color: '#333333',
          }}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={pageTitle}
      breadcrumbs={[{ title: pageTitle }]}
    >
      <Backdrop open={loadingRequestDetails} sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.modal + 2 }}>
        <CircularProgress color="inherit" />
      </Backdrop>

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
        
        // Pagination
        paginationModel={paginationModel}
        onPaginationModelChange={handlePaginationModelChange}
        rowCount={rowsState.rowCount}
        paginationMode="server"
        
        // Sorting
        sortModel={sortModel}
        onSortModelChange={handleSortModelChange}
        sortingMode="server"
        
        // Filtering
        filterModel={filterModel}
        onFilterModelChange={handleFilterModelChange}
        filterMode="client"
        
        // Actions - disable default actions since we have custom ones in columns
        onView={null}
        onEdit={null}
        onDelete={null}
        onRefresh={handleRefresh}
        
        // Row interaction
        onRowClick={canRead ? handleRowClick : null}
        
        // Configuration
        pageSizeOptions={[5, 10, 25, 50]}
        showToolbar={true}
        hideCreateButton={true}
        disableColumnFilter={true}
        disableColumnMenu={true}
      />

      {/* View Batch Details Modal */}
      <Dialog
        open={viewModalOpen}
        onClose={() => {
          setViewModalOpen(false);
          setSelectedBatch(null);
          setBatchDetails(null);
        }}
        aria-labelledby="view-batch-dialog-title"
        PaperProps={{
          sx: {
            backgroundColor: '#ffffff',
            minWidth: '800px',
            maxWidth: '1100px',
            borderRadius: 2,
            boxShadow: 6,
          }
        }}
      >
        <DialogTitle 
          id="view-batch-dialog-title"
          sx={{ 
            color: 'success.main',
            fontWeight: 'bold',
            borderBottom: '1px solid #eaeaea',
            padding: '20px 24px 16px 24px'
          }}
        >
          Payment Batch: {selectedBatch?.batch_number}
        </DialogTitle>
        <DialogContent sx={{ padding: '20px 24px' }}>
          {loadingDetails ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <Typography>Loading batch details...</Typography>
            </Box>
          ) : batchDetails ? (
            <Box>
              {/* Total Amount */}
              <Box sx={{ 
                mt: 2,
                mb: 3, 
                p: 3, 
                backgroundColor: '#e8f5e9', 
                borderRadius: 2,
                border: '2px solid #4caf50'
              }}>
                <Typography variant="h6" sx={{ mb: 1, color: '#2e7d32', fontWeight: 600 }}>
                  Total Payment Amount
                </Typography>
                <Typography variant="h4" sx={{ color: '#1b5e20', fontWeight: 'bold' }}>
                  Rs {parseFloat(batchDetails.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1, color: '#666' }}>
                  {batchDetails.items?.length || 0} request(s) in batch
                </Typography>
              </Box>

              {/* Individual Request Details */}
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#1a237e' }}>
                Individual Request Details
              </Typography>
              <Box sx={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: 1 }}>
                <Table>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                      <TableCell sx={{ fontWeight: 'bold', color: '#666' }}>Request ID</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: '#666' }}>Dealer</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: '#666' }}>Vendor</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: '#666' }}>Invoice No.</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: '#666' }}>Invoice Date</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: '#666' }}>Amount</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold', color: '#666', minWidth: 220 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {batchDetails.items && batchDetails.items.length > 0 ? (
                      batchDetails.items.map((item) => {
                        const request = item.request;
                        const canRejectItem =
                          isVoucherSentStatus(batchDetails.status) &&
                          request?.status === 'voucher_sent';
                        return (
                          <TableRow 
                            key={item.id}
                            sx={{ 
                              '&:hover': { backgroundColor: '#f5f5f5' }
                            }}
                          >
                            <TableCell>#{request?.id || item.request_id}</TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {request?.dealer?.name || 'N/A'}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#666' }}>
                                {request?.dealer?.code || 'N/A'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {request ? getVendorName(request) : 'N/A'}
                              </Typography>
                              {request?.vendor_code && (
                                <Typography variant="caption" sx={{ color: '#666' }}>
                                  {request.vendor?.username || String(request.vendor_code)}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              {request?.invoice_number || 'N/A'}
                            </TableCell>
                            <TableCell>
                              {request?.invoice_date 
                                ? new Date(request.invoice_date).toLocaleDateString('en-US', { 
                                    year: 'numeric', 
                                    month: 'short', 
                                    day: 'numeric' 
                                  })
                                : 'N/A'}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600, color: '#2e7d32' }}>
                              Rs {parseFloat(item.amount || request?.total_cost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell align="center">
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 0.25 }}>
                                {canRead && request && (
                                  <>
                                    <Tooltip title="Request">
                                      <IconButton size="small" color="primary" onClick={() => handleViewRequest(request)}>
                                        <RequestIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="View Details">
                                      <IconButton size="small" color="info" onClick={() => handleViewRequestDetails(request)}>
                                        <VisibilityIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                    {request.has_invoice_files && (
                                      <Tooltip title="View Invoice Documents">
                                        <IconButton size="small" color="info" onClick={() => handleViewRequestInvoice(request)}>
                                          <InvoiceIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                    )}
                                    {request.dealer && (
                                      <Tooltip title="Old Purchases">
                                        <IconButton size="small" color="info" onClick={() => handleViewOldPurchases(request)}>
                                          <OldPurchasesIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                    )}
                                    <Tooltip title="View History">
                                      <IconButton size="small" onClick={() => handleViewRequestHistory(request)}>
                                        <HistoryIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Print PDF">
                                      <IconButton size="small" color="secondary" onClick={() => generatePDF(request)}>
                                        <PrintIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  </>
                                )}
                                {canRejectItem && (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="error"
                                    disabled={actionLoading}
                                    onClick={() => openConfirmDialog({
                                      type: 'reject-item',
                                      batchId: batchDetails.id,
                                      requestId: request?.id || item.request_id,
                                      title: 'Reject Request',
                                      message: `Reject request #${request?.id || item.request_id} and mark it as Finance Rejected?`,
                                    })}
                                    sx={{ ml: 0.5 }}
                                  >
                                    Reject
                                  </Button>
                                )}
                              </Box>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                          <Typography variant="body2" sx={{ color: '#666', fontStyle: 'italic' }}>
                            No requests found in this batch
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Box>
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center', p: 4 }}>
              <Typography variant="body1" sx={{ color: '#666' }}>
                Failed to load batch details
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ padding: '16px 24px 20px 24px', gap: 1, flexWrap: 'wrap' }}>
          {batchDetails && isVoucherSentStatus(batchDetails.status) && (
            <>
              <Button
                onClick={() => openConfirmDialog({
                  type: 'reject-batch',
                  batchId: batchDetails.id,
                  batchNumber: batchDetails.batch_number,
                  title: 'Reject Batch',
                  message: `Reject batch ${batchDetails.batch_number} and mark all requests as Finance Rejected?`,
                })}
                variant="outlined"
                color="error"
                disabled={actionLoading || !batchDetails.items?.length}
                startIcon={<RejectIcon />}
              >
                Reject Batch
              </Button>
              <Button
                onClick={() => openConfirmDialog({
                  type: 'complete-batch',
                  batchId: batchDetails.id,
                  batchNumber: batchDetails.batch_number,
                  title: 'Process Payment',
                  message: `Mark all ${batchDetails.items?.length || 0} request(s) in this batch as Payment Successful?`,
                })}
                variant="contained"
                color="success"
                disabled={actionLoading || !batchDetails.items?.length}
                startIcon={<PaymentIcon />}
                sx={{ fontWeight: 'bold' }}
              >
                Process Payment
              </Button>
            </>
          )}
          <Button
            onClick={async () => {
              if (!selectedBatch?.id) return;
              
              setDownloading(true);
              try {
                const response = await post(`/api/payment-batches/${selectedBatch.id}/generate-excel`, {}, {
                  responseType: 'blob'
                });

                // Create download link
                const url = window.URL.createObjectURL(response);
                const link = document.createElement('a');
                link.href = url;
                link.download = `Payment_Batch_${selectedBatch.batch_number}_${new Date().toISOString().split('T')[0]}.xlsx`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                
                toast.success('Excel file downloaded successfully!', {
                  position: "top-right",
                  autoClose: 3000,
                  hideProgressBar: false,
                  closeOnClick: true,
                  pauseOnHover: true,
                  draggable: true,
                });
              } catch (error) {
                console.error('Error generating Excel:', error);
                toast.error(`Failed to generate Excel file: ${error.message}`, {
                  position: "top-right",
                  autoClose: 5000,
                  hideProgressBar: false,
                  closeOnClick: true,
                  pauseOnHover: true,
                  draggable: true,
                });
              } finally {
                setDownloading(false);
              }
            }}
            variant="outlined"
            color="primary"
            disabled={downloading || !batchDetails || !batchDetails.items || batchDetails.items.length === 0}
            startIcon={<DownloadIcon />}
            sx={{
              minWidth: '140px',
            }}
          >
            {downloading ? 'Downloading...' : 'Download Excel'}
          </Button>
          <Button
            onClick={() => {
              setViewModalOpen(false);
              setSelectedBatch(null);
              setBatchDetails(null);
            }}
            variant="outlined"
            color="secondary"
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm action dialog */}
      <Dialog
        open={Boolean(confirmDialog)}
        onClose={() => {
          if (!actionLoading) {
            setConfirmDialog(null);
            setRejectComment('');
          }
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>
          {confirmDialog?.title}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: confirmDialog?.type === 'reject-batch' || confirmDialog?.type === 'reject-item' ? 2 : 0 }}>
            {confirmDialog?.message}
          </Typography>
          {(confirmDialog?.type === 'reject-batch' || confirmDialog?.type === 'reject-item') && (
            <TextField
              fullWidth
              multiline
              rows={4}
              required
              label="Rejection Comment"
              placeholder="Provide a reason for finance rejection..."
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              error={rejectComment.trim() === '' && rejectComment.length > 0}
              helperText="Comment is required"
            />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setConfirmDialog(null);
              setRejectComment('');
            }}
            disabled={actionLoading}
            color="secondary"
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!confirmDialog) return;
              const trimmedComment = rejectComment.trim();
              if ((confirmDialog.type === 'reject-batch' || confirmDialog.type === 'reject-item') && !trimmedComment) {
                toast.error('Rejection comment is required', { position: 'top-right', autoClose: 3000 });
                return;
              }
              if (confirmDialog.type === 'complete-batch') {
                handleCompleteBatch(confirmDialog.batchId, confirmDialog.batchNumber);
              } else if (confirmDialog.type === 'reject-batch') {
                handleRejectBatch(confirmDialog.batchId, confirmDialog.batchNumber, trimmedComment);
              } else if (confirmDialog.type === 'reject-item') {
                handleRejectBatchItem(confirmDialog.batchId, confirmDialog.requestId, trimmedComment);
              }
            }}
            disabled={
              actionLoading ||
              ((confirmDialog?.type === 'reject-batch' || confirmDialog?.type === 'reject-item') && !rejectComment.trim())
            }
            color={confirmDialog?.type === 'reject-batch' || confirmDialog?.type === 'reject-item' ? 'error' : 'success'}
            variant="contained"
          >
            {actionLoading ? 'Processing...' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Request view modal (same as Payments) */}
      <DynamicModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        mode="view"
        title="Payment Details"
        initialData={(() => {
          const data = selectedRequest || {};
          const hasParent =
            data?.dealer_relation?.parent &&
            data?.dealer?.id &&
            data.dealer.id !== data.dealer_relation.parent.id;
          const flattenedData = {
            ...data,
            dealer_name: data?.dealer?.name || 'N/A',
            dealer_code: data?.dealer?.code || 'N/A',
            dealer_phone: data?.dealer?.phone || 'N/A',
            dealer_city: data?.dealer?.city || 'N/A',
            dealer_type: data?.dealer_type === 'new' ? 'New' : 'Old',
            vendor_name: getVendorName(data) || 'N/A',
            status: getStatusDisplayName(data?.status) || 'N/A',
            total_cost: data?.total_cost ? `Rs ${parseFloat(data.total_cost).toFixed(2)}` : 'N/A',
            created_at: data?.created_at ? new Date(data.created_at).toLocaleString() : 'N/A',
            approval_date: data?.approval_date ? new Date(data.approval_date).toLocaleString() : 'N/A',
          };
          if (hasParent && data.dealer_relation.parent) {
            const parent = data.dealer_relation.parent;
            flattenedData.parent_dealer_code = parent.code || 'N/A';
            flattenedData.parent_dealer_name = parent.name || 'N/A';
            flattenedData.parent_dealer_phone = parent.phone || 'N/A';
          }
          return flattenedData;
        })()}
        fields={getRequestFields(selectedRequest)}
        onSubmit={() => setModalOpen(false)}
        loading={false}
        hideSubmitButton={true}
        customContent={
          selectedRequest?.survey_form_attachments &&
          Array.isArray(selectedRequest.survey_form_attachments) &&
          selectedRequest.survey_form_attachments.length > 0 ? (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#1976d2' }}>
                Survey Form Attachments
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {selectedRequest.survey_form_attachments.map((file, index) => {
                  const { url, fileName } = getFileUrlAndName(file, index, `Survey Form ${index + 1}`);
                  const fileUrl =
                    url.startsWith('data:') || url.startsWith('http')
                      ? url
                      : url.startsWith('/')
                        ? `${BASE_URL}${url}`
                        : `${BASE_URL}/uploads/survey_forms/${url}`;
                  return (
                    <Chip
                      key={index}
                      label={fileName}
                      size="small"
                      color="primary"
                      variant="outlined"
                      onClick={() => (url.startsWith('data:') ? openFileInNewTab(fileUrl) : window.open(fileUrl, '_blank'))}
                      sx={{ cursor: 'pointer', '&:hover': { backgroundColor: '#e3f2fd' } }}
                    />
                  );
                })}
              </Box>
            </Box>
          ) : null
        }
      />

      {/* Detailed view modal */}
      <Dialog
        open={detailedViewModalOpen}
        onClose={() => setDetailedViewModalOpen(false)}
        aria-labelledby="batch-request-detailed-view-title"
        PaperProps={{
          sx: {
            backgroundColor: '#ffffff',
            minWidth: '800px',
            maxWidth: '1200px',
            maxHeight: '90vh',
            overflow: 'auto',
            borderRadius: 2,
            boxShadow: 6,
          },
        }}
      >
        <DialogTitle
          id="batch-request-detailed-view-title"
          sx={{ color: 'info.main', fontWeight: 'bold', borderBottom: '1px solid #eaeaea', mb: 1 }}
        >
          Payment Details - #{selectedDetailedRequest?.id}
        </DialogTitle>
        <DialogContent>
          {selectedDetailedRequest && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
              <Box sx={{ p: 3, borderRadius: 2, backgroundColor: '#f8f9fa', border: '1px solid #e0e0e0' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: 'primary.main' }}>
                  Dealer Information
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>Dealer Name</Typography>
                    <Typography variant="body1">{selectedDetailedRequest.dealer?.name || 'N/A'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>Dealer Code</Typography>
                    <Typography variant="body1">{selectedDetailedRequest.dealer?.code || 'N/A'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>Phone</Typography>
                    <Typography variant="body1">{selectedDetailedRequest.dealer?.phone || 'N/A'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>Address</Typography>
                    <Typography variant="body1">{selectedDetailedRequest.dealer?.city || 'N/A'}</Typography>
                  </Box>
                </Box>
              </Box>

              <Box sx={{ p: 3, borderRadius: 2, backgroundColor: '#f8f9fa', border: '1px solid #e0e0e0' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: 'primary.main' }}>
                  Request Items & Dimensions
                </Typography>
                {selectedDetailedRequest.requestItems?.length > 0 ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {selectedDetailedRequest.requestItems.map((item, index) => (
                      <Box key={index} sx={{ p: 2, borderRadius: 2, backgroundColor: '#ffffff', border: '1px solid #e0e0e0' }}>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 2 }}>
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>Request Type</Typography>
                            <Typography variant="body2">{item.requestType?.name || 'N/A'}</Typography>
                          </Box>
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>Width (ft)</Typography>
                            <Typography variant="body2">{item.width || 'N/A'}</Typography>
                          </Box>
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>Height (ft)</Typography>
                            <Typography variant="body2">{item.height || 'N/A'}</Typography>
                          </Box>
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>Price per ft²</Typography>
                            <Typography variant="body2">
                              {(() => {
                                const widthFt = parseFloat(item.width) || 0;
                                const heightFt = parseFloat(item.height) || 0;
                                const areaSqft = widthFt * heightFt;
                                const priceNum = parseFloat(item.price) || 0;
                                const ppsf = areaSqft > 0 ? priceNum / areaSqft : null;
                                return ppsf ? `Rs ${ppsf.toFixed(2)}` : 'N/A';
                              })()}
                            </Typography>
                          </Box>
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>Total Cost</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                              {item.price ? `Rs ${parseFloat(item.price).toFixed(2)}` : 'N/A'}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    ))}
                    <Box sx={{ mt: 1, p: 2, backgroundColor: '#e3f2fd', borderRadius: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>Total Cost (All Items)</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                          Rs{(selectedDetailedRequest.requestItems || []).reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0).toFixed(2)}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                ) : (
                  <Typography variant="body1" sx={{ color: '#666', fontStyle: 'italic' }}>No request items found</Typography>
                )}
              </Box>

              <Box sx={{ p: 3, borderRadius: 2, backgroundColor: '#f8f9fa', border: '1px solid #e0e0e0' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: 'primary.main' }}>Attachments</Typography>
                {[
                  { key: 'site_photo_attachement', label: 'Site Photos', color: 'primary', folder: 'site_photos' },
                  { key: 'old_board_photo_attachment', label: 'Old Board Photos', color: 'secondary', folder: 'old_board_photos' },
                  { key: 'survey_form_attachments', label: 'Survey Forms', color: 'success', folder: 'survey_forms' },
                ].map((section) => (
                  <Box key={section.key} sx={{ mb: 2 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>{section.label}</Typography>
                    {selectedDetailedRequest[section.key]?.length > 0 ? (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {selectedDetailedRequest[section.key].map((file, index) => {
                          const { url, fileName } = getFileUrlAndName(file, index, `${section.label} ${index + 1}`);
                          const fileUrl =
                            url.startsWith('data:') || url.startsWith('http')
                              ? url
                              : url.startsWith('/')
                                ? `${BASE_URL}${url}`
                                : `${BASE_URL}/uploads/${section.folder}/${url}`;
                          return (
                            <Chip
                              key={`${section.key}-${index}`}
                              label={fileName}
                              size="small"
                              color={section.color}
                              variant="outlined"
                              onClick={() => openFileInNewTab(fileUrl)}
                              sx={{ cursor: 'pointer' }}
                            />
                          );
                        })}
                      </Box>
                    ) : (
                      <Typography variant="body2" sx={{ color: '#666', fontStyle: 'italic' }}>No {section.label.toLowerCase()} uploaded</Typography>
                    )}
                  </Box>
                ))}
              </Box>

              <Box sx={{ p: 3, borderRadius: 2, backgroundColor: '#f8f9fa', border: '1px solid #e0e0e0' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: 'primary.main' }}>Payment Information</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>Status</Typography>
                    <Chip
                      label={getStatusDisplayName(selectedDetailedRequest.status)}
                      variant="filled"
                      size="small"
                      color={getStatusColorHelper(selectedDetailedRequest.status)}
                    />
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>Vendor</Typography>
                    <Typography variant="body1">{getVendorName(selectedDetailedRequest) || 'Not Assigned'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>Total Cost</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                      {selectedDetailedRequest.total_cost ? `Rs ${parseFloat(selectedDetailedRequest.total_cost).toFixed(2)}` : 'N/A'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>Approval Date</Typography>
                    <Typography variant="body1">
                      {selectedDetailedRequest.approval_date
                        ? new Date(selectedDetailedRequest.approval_date).toLocaleString()
                        : 'N/A'}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setDetailedViewModalOpen(false)} variant="outlined">Close</Button>
        </DialogActions>
      </Dialog>

      <InvoiceViewer
        open={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        invoiceData={selectedInvoiceRequest?.invoice}
        requestId={selectedInvoiceRequest?.id}
        requestItems={selectedInvoiceRequest?.requestItems}
        invoiceNumber={selectedInvoiceRequest?.invoice_number}
        invoiceDate={selectedInvoiceRequest?.invoice_date}
        invoice_files_data={selectedInvoiceRequest?.invoice_files_data}
        dealer_acknowledgment_files_data={selectedInvoiceRequest?.dealer_acknowledgment_files_data}
        invoice_site_photos_by_item_data={selectedInvoiceRequest?.invoice_site_photos_by_item_data}
      />

      <Dialog
        open={historyDialogOpen}
        onClose={() => setHistoryDialogOpen(false)}
        aria-labelledby="batch-request-history-title"
        PaperProps={{
          sx: {
            backgroundColor: '#ffffff',
            minWidth: '600px',
            maxWidth: '900px',
            maxHeight: '80vh',
            overflow: 'auto',
          },
        }}
      >
        <DialogTitle id="batch-request-history-title" sx={{ color: 'info.main', fontWeight: 'bold' }}>
          Request History - #{requestToAction?.id || 'N/A'}
        </DialogTitle>
        <DialogContent>
          {loadingHistory ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <Typography>Loading history...</Typography>
            </Box>
          ) : requestHistory.length === 0 ? (
            <Box sx={{ textAlign: 'center', p: 4 }}>
              <Typography variant="body1" sx={{ color: '#666' }}>No history found for this request.</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {requestHistory.map((log, index) => (
                <Box key={index} sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 1, backgroundColor: '#f9f9f9' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                      {log.changed_by
                        ? (log.changed_by.card_name && log.changed_by.user_type === 'vendor'
                          ? `${log.changed_by.card_name} (${log.changed_by.username})`
                          : log.changed_by.username)
                        : 'Unknown User'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#666' }}>
                      {log.changed_at ? new Date(log.changed_at).toLocaleString() : 'Unknown Date'}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ color: '#333', mb: 1, fontWeight: 'bold' }}>
                    Action: {log.action}
                  </Typography>
                  {renderMainChanges(log)}
                  {log.item_changes?.length > 0 && (
                    <Box sx={{ mt: 1, p: 1, backgroundColor: '#f0f0f0', borderRadius: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>Request items:</Typography>
                      {log.item_changes.map((item, idx) => (
                        <Box key={idx} sx={{ mb: 1, p: 1, backgroundColor: '#ffffff', borderRadius: 0.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                            {item.action}: {item.request_type}
                          </Typography>
                          {item.width && parseFloat(item.width) > 0 && (
                            <Typography variant="body2" sx={{ color: '#333', mb: 0.5 }}>Width: {item.width} ft</Typography>
                          )}
                          {item.height && parseFloat(item.height) > 0 && (
                            <Typography variant="body2" sx={{ color: '#333', mb: 0.5 }}>Height: {item.height} ft</Typography>
                          )}
                          {item.price && (
                            <Typography variant="body2" sx={{ color: '#333', mb: 0.5 }}>
                              Total Price: Rs {parseFloat(item.price).toFixed(2)}
                            </Typography>
                          )}
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => {
              setHistoryDialogOpen(false);
              setRequestHistory([]);
            }}
            variant="outlined"
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <OldPurchasesModal
        open={oldPurchasesModalOpen}
        onClose={() => {
          setOldPurchasesModalOpen(false);
          setSelectedDealerForOldPurchases(null);
        }}
        dealerId={selectedDealerForOldPurchases?.id}
        dealerName={selectedDealerForOldPurchases?.name}
      />

      {/* React Toastify Container */}
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
        toastStyle={{
          backgroundColor: '#ffffff',
          color: '#333333',
        }}
      />
    </PageContainer>
  );
}

