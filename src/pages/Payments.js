import * as React from 'react';
import {
  Alert,
  Chip,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tooltip,
  Box,
  Backdrop,
  CircularProgress,
} from '@mui/material';
import {
  Description as RequestIcon,
  History as HistoryIcon,
  Visibility as VisibilityIcon,
  Print as PrintIcon,
  Receipt as InvoiceIcon,
  ShoppingCart as OldPurchasesIcon,
} from '@mui/icons-material';
import { GridActionsCellItem } from '@mui/x-data-grid';
import { GridToolbarContainer, GridToolbarColumnsButton } from '@mui/x-data-grid';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from '../auth/AuthContext';
import ReusableDataTable from '../components/ReusableData';
import PageContainer from '../components/PageContainer';
import DynamicModal from '../components/DynamicModel';
import InvoiceViewer from '../components/InvoiceViewer';
import ShopboardRequestFilters from '../components/ShopboardRequestFilters';
import OldPurchasesModal from '../components/OldPurchasesModal';
import { BASE_URL } from "../constants/Constants";
import { 
  SHOPBOARD_REQUEST_STATUS, 
  getStatusDisplayName, 
  getStatusColor as getStatusColorHelper 
} from "../constants/ShopboardRequestStatus";
import { useApi } from '../hooks/useApi';

const INITIAL_PAGE_SIZE = 10;

function getFileUrlAndName(item, index, fallbackLabel) {
  if (item == null) return { url: '', fileName: fallbackLabel };
  if (typeof item === 'object' && item.url != null) return { url: item.url, fileName: item.fileName || fallbackLabel };
  const str = typeof item === 'string' ? item : '';
  return { url: str, fileName: str.startsWith('data:') ? fallbackLabel : str.split('/').pop() || fallbackLabel };
}

// Open file in new tab; for data URLs use blob URL so image/PDF loads reliably
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

export default function Payments() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const { user, token } = useAuth();
  
  // Check user permissions - using payments permissions
  const canRead = user?.permissions?.payments?.includes('read') || false;

  const { get } = useApi();

  const [rowsState, setRowsState] = React.useState({
    rows: [],
    rowCount: 0,
  });

  // Filter state
  const [filters, setFilters] = React.useState({
    vendor: null,
    status: null,
    region: null,
    parentDealer: null,
    childDealer: null,
    salesHead: null,
    startDate: null,
    endDate: null,
  });

  // Helper function to get vendor name from request data
  const getVendorName = React.useCallback((row) => {
    if (!row) return 'Not Assigned';
    // Check if vendor object exists - handle both name (from SAP) and card_name (from users table)
    if (row.vendor) {
      if (row.vendor.name) {
        return row.vendor.name;
      }
      if (row.vendor.card_name) {
        return row.vendor.card_name;
      }
    }
    // Fallback: check if vendor_name exists directly
    if (row.vendor_name) {
      return row.vendor_name;
    }
    // If vendor_code exists but no vendor info, show "Not Assigned"
    if (row.vendor_code) {
      return 'Not Assigned';
    }
    return 'Not Assigned';
  }, []);
  
  // Use rowsState.rows directly since filtering is done on backend
  const filteredRows = rowsState.rows;

  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  
  // Modal state for viewing request details
  const [modalOpen, setModalOpen] = React.useState(false);
  const [selectedRequest, setSelectedRequest] = React.useState(null);
  
  // Modal state for detailed view
  const [detailedViewModalOpen, setDetailedViewModalOpen] = React.useState(false);
  const [selectedDetailedRequest, setSelectedDetailedRequest] = React.useState(null);
  
  // Invoice viewer modal state
  const [invoiceModalOpen, setInvoiceModalOpen] = React.useState(false);
  const [selectedInvoiceRequest, setSelectedInvoiceRequest] = React.useState(null);

  // Loading full request details when opening view/details/invoice modals
  const [loadingRequestDetails, setLoadingRequestDetails] = React.useState(false);
  
  // History state for viewing request history
  const [historyDialogOpen, setHistoryDialogOpen] = React.useState(false);
  const [requestHistory, setRequestHistory] = React.useState([]);
  const [loadingHistory, setLoadingHistory] = React.useState(false);
  const [requestToAction, setRequestToAction] = React.useState(null);
  
  // Old purchases modal state
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
  }, [canRead]);

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

  // API call to fetch payment successful requests
  const loadRequests = React.useCallback(async () => {
    if (!canRead) return;
    
    setError(null);
    setIsLoading(true);

    try {
      const { page, pageSize } = paginationModel;
      
      // Build query parameters
      const queryParams = new URLSearchParams({
        page: page.toString(),
        size: pageSize.toString(),
      });
      
      // Add vendor filter if selected
      if (filters.vendor && filters.vendor.id) {
        queryParams.append('vendor_id', filters.vendor.id.toString());
      }
      
      // Add region filter if selected
      if (filters.region && filters.region.name) {
        queryParams.append('region', filters.region.name);
      }
      
      // Add parent dealer filter if selected
      if (filters.parentDealer && filters.parentDealer.code) {
        queryParams.append('parent_dealer_code', filters.parentDealer.code);
      }
      
      // Add child dealer filter if selected
      if (filters.childDealer && filters.childDealer.code) {
        queryParams.append('child_dealer_code', filters.childDealer.code);
      }
      
      // Add start date filter if selected
      if (filters.startDate) {
        queryParams.append('start_date', filters.startDate);
      }
      
      // Add end date filter if selected
      if (filters.endDate) {
        queryParams.append('end_date', filters.endDate);
      }
      
      // Add sales head filter if selected - pass the first code
      if (filters.salesHead && filters.salesHead.sh_codes && filters.salesHead.sh_codes[0]) {
        queryParams.append('sales_head_id', filters.salesHead.id?.toString() || '');
      }
      
      // Use the new payments API endpoint
      const apiUrl = `/api/payments?${queryParams.toString()}`;
      
      const requestData = await get(apiUrl);
      
      // Handle the API response format: { success: true, data: [...], totalCount: number }
      let requestsData = [];
      if (requestData.success && requestData.data && Array.isArray(requestData.data)) {
        requestsData = requestData.data;
      } else if (requestData.requests && Array.isArray(requestData.requests)) {
        requestsData = requestData.requests;
      } else if (Array.isArray(requestData)) {
        requestsData = requestData;
      }

      // Update state with filtered data
      const totalCount = requestData.totalCount || requestData.count || requestsData.length;
      
      setRowsState({
        rows: requestsData,
        rowCount: totalCount,
      });

    } catch (loadError) {
      setError(loadError.message || 'Failed to load payments');
      toast.error('Failed to load payments', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      console.error('Error loading payments:', loadError);
    } finally {
      setIsLoading(false);
    }
  }, [paginationModel, get, canRead, filters]);

  // Fetch full request by ID. includeFiles: 'details' | 'invoice' loads only those file sets.
  const fetchFullRequest = React.useCallback(async (id, includeFiles) => {
    const url = includeFiles ? `/api/shopboard-requests/${id}?includeFiles=${encodeURIComponent(includeFiles)}` : `/api/shopboard-requests/${id}`;
    const res = await get(url);
    if (res?.success && res?.data) return res.data;
    throw new Error('Failed to load request details');
  }, [get]);

  // Load data when component mounts or pagination/filters change
  React.useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Action handlers - fetch full request with only the file set needed for each modal
  const handleView = React.useCallback(async (requestData) => {
    if (!canRead) return;
    setLoadingRequestDetails(true);
    try {
      const full = await fetchFullRequest(requestData.id, 'details');
      setSelectedRequest(full);
      setModalOpen(true);
    } catch (e) {
      toast.error('Failed to load request details', {
        position: 'top-right',
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } finally {
      setLoadingRequestDetails(false);
    }
  }, [canRead, fetchFullRequest]);

  const handleViewDetails = React.useCallback(async (requestData) => {
    setLoadingRequestDetails(true);
    try {
      const full = await fetchFullRequest(requestData.id, 'details');
      setSelectedDetailedRequest(full);
      setDetailedViewModalOpen(true);
    } catch (e) {
      toast.error('Failed to load request details', {
        position: 'top-right',
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } finally {
      setLoadingRequestDetails(false);
    }
  }, [fetchFullRequest]);

  const handleViewInvoice = React.useCallback(async (requestData) => {
    if (!canRead) return;
    setLoadingRequestDetails(true);
    try {
      const full = await fetchFullRequest(requestData.id, 'invoice');
      setSelectedInvoiceRequest(full);
      setInvoiceModalOpen(true);
    } catch (e) {
      toast.error('Failed to load request details', {
        position: 'top-right',
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } finally {
      setLoadingRequestDetails(false);
    }
  }, [canRead, fetchFullRequest]);

  const handleViewHistory = React.useCallback((requestData) => {
    if (!canRead) return;
    
    setRequestToAction(requestData);
    setRequestHistory([]);
    setHistoryDialogOpen(true);
    fetchRequestHistory(requestData.id);
  }, [canRead]);

  const handlePrint = React.useCallback((requestData) => {
    if (!canRead) return;
    
    // Generate PDF using the same logic as AreaHeadRequests
    generatePDF(requestData);
  }, [canRead]);

  const handleViewOldPurchases = React.useCallback((requestData) => {
    if (!canRead) return;
    
    // Get dealer information from the request
    const dealerId = requestData.dealer?.code || requestData.dealer_id;
    const dealerName = requestData.dealer?.name || 'Dealer';
    
    if (!dealerId) {
      toast.error('Dealer information not available', {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      return;
    }
    
    setSelectedDealerForOldPurchases({ id: dealerId, name: dealerName });
    setOldPurchasesModalOpen(true);
  }, [canRead]);

  // Fetch history for a specific request
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
        
        // Fetch dealer names for logs that have dealer_id
        const logsWithDealerNames = await Promise.all(
          sorted.map(async (log) => {
            if (log.main_changes?.dealer_id && !log.main_changes?.dealer_name) {
              try {
                const dealerResponse = await get(`/api/dealers/code/${log.main_changes.dealer_id}`);
                if (dealerResponse.success && dealerResponse.data) {
                  return {
                    ...log,
                    main_changes: {
                      ...log.main_changes,
                      dealer_name: `${dealerResponse.data.name} (${dealerResponse.data.code})`
                    }
                  };
                }
              } catch (dealerError) {
                console.error(`Error fetching dealer ${log.main_changes.dealer_id}:`, dealerError);
              }
            }
            return log;
          })
        );
        
        setRequestHistory(logsWithDealerNames);
      } else {
        setRequestHistory([]);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
      toast.error('Failed to load history', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      setRequestHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [get]);

  // Generate PDF for printing (using embedded template to avoid cross-origin issues)
  const generatePDF = React.useCallback((requestData) => {
    try {
      // Create a hidden iframe for PDF generation
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.top = '-10000px';
      iframe.style.left = '-10000px';
      iframe.style.width = '210mm';
      iframe.style.height = '297mm';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow.document;

      // Embedded template HTML with auto-print (same as AreaHeadRequests)
      const templateHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Details Report - ${requestData.id}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        @page {
            size: A4;
            margin: 10mm;
        }

        @media print {
            body {
                margin: 0;
                padding: 0;
                width: 210mm;
                height: 297mm;
            }
            .container {
                box-shadow: none;
                padding: 15px;
            }
        }

        body {
            font-family: 'Arial', sans-serif;
            line-height: 1.3;
            color: #333;
            background: white;
            width: 210mm;
            height: 297mm;
            margin: 0 auto;
            position: relative;
        }

        .container {
            width: 100%;
            min-height: calc(100% - 40px);
            background: white;
            padding: 15px;
            padding-bottom: 50px;
        }

        .header {
            text-align: center;
            margin-bottom: 15px;
            padding-bottom: 8px;
            border-bottom: 2px solid #2c3e50;
        }

        .header h1 {
            font-size: 24px;
            color: #2c3e50;
            margin-bottom: 3px;
            letter-spacing: 1.5px;
        }

        .header h2 {
            font-size: 14px;
            color: #7f8c8d;
            font-weight: normal;
        }

        .section {
            margin-bottom: 12px;
        }

        .section-title {
            font-size: 12px;
            font-weight: bold;
            color: #2c3e50;
            text-transform: uppercase;
            padding-bottom: 4px;
            margin-bottom: 8px;
            border-bottom: 1.5px solid #3498db;
            letter-spacing: 0.3px;
        }

        .fields-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 8px;
        }

        .field {
            margin-bottom: 6px;
        }

        .field-label {
            font-size: 9.5px;
            font-weight: bold;
            color: #555;
            margin-bottom: 2px;
        }

        .field-value {
            font-size: 10.5px;
            color: #333;
            padding-bottom: 2px;
            border-bottom: 0.5px solid #ddd;
            min-height: 14px;
        }

        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
            font-size: 10px;
        }

        .items-table thead {
            background: #f8f9fa;
        }

        .items-table th {
            padding: 8px 6px;
            text-align: left;
            font-size: 9.5px;
            font-weight: bold;
            color: #2c3e50;
            border: 1px solid #ddd;
        }

        .items-table td {
            padding: 6px;
            border: 1px solid #ddd;
            font-size: 10px;
            color: #333;
        }

        .items-table tbody tr:nth-child(even) {
            background: #f8f9fa;
        }

        .full-width {
            grid-column: 1 / -1;
        }

        .reason-box {
            background: #f8f9fa;
            padding: 8px;
            border-radius: 3px;
            margin-top: 6px;
        }

        .reason-label {
            font-size: 9.5px;
            font-weight: bold;
            color: #555;
            margin-bottom: 3px;
        }

        .reason-text {
            font-size: 10px;
            color: #333;
            line-height: 1.4;
        }

        .total-box {
            background: #3498db;
            color: white;
            padding: 8px;
            border-radius: 3px;
            margin: 10px 0;
            text-align: center;
        }

        .total-label {
            font-size: 10px;
            margin-bottom: 3px;
            opacity: 0.9;
        }

        .total-amount {
            font-size: 18px;
            font-weight: bold;
        }

        .footer {
            position: fixed;
            bottom: 10mm;
            left: 15px;
            right: 15px;
            padding-top: 8px;
            border-top: 0.5px solid #ddd;
            display: flex;
            justify-content: space-between;
            font-size: 9px;
            color: #7f8c8d;
            background: white;
        }

        .status-badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 2px;
            font-size: 9.5px;
            font-weight: bold;
        }

        .status-payment-successful {
            background: #d4edda;
            color: #155724;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <h1>DIAMOND PAINTS</h1>
            <h2>Payment Details Report</h2>
        </div>

        <!-- Dealer Information -->
        <div class="section">
            <div class="section-title">Dealer Information</div>
            <div class="fields-row">
                <div class="field">
                    <div class="field-label">Dealer Name:</div>
                    <div class="field-value" id="dealer-name">-</div>
                </div>
                <div class="field">
                    <div class="field-label">Dealer Code:</div>
                    <div class="field-value" id="dealer-code">-</div>
                </div>
            </div>
            <div class="fields-row">
                <div class="field">
                    <div class="field-label">Phone:</div>
                    <div class="field-value" id="dealer-phone">-</div>
                </div>
                <div class="field">
                    <div class="field-label">Dealer Type:</div>
                    <div class="field-value" id="dealer-type">-</div>
                </div>
            </div>
            <div class="fields-row">
                <div class="field full-width">
                    <div class="field-label">Address:</div>
                    <div class="field-value" id="dealer-address">-</div>
                </div>
            </div>
        </div>

        <!-- Request Items -->
        <div class="section">
            <div class="section-title">Request Items & Dimensions</div>
            <table class="items-table">
                <thead>
                    <tr>
                        <th>Item #</th>
                        <th>Request Type</th>
                        <th>Width (ft)</th>
                        <th>Height (ft)</th>
                        <th>Price per (sqft)</th>
                        <th>Total Area (sqft)</th>
                        <th>Total Cost</th>
                    </tr>
                </thead>
                <tbody id="request-items">
                    <!-- Items will be populated here -->
                </tbody>
            </table>
            <div class="total-box">
                <div class="total-label">Total Cost (All Items)</div>
                <div class="total-amount" id="total-cost">Rs. 0.00</div>
            </div>
        </div>

        <!-- Warranty & Installation -->
        <div class="section">
            <div class="section-title">Warranty & Installation Information</div>
            <div class="fields-row">
                <div class="field">
                    <div class="field-label">Warranty Status:</div>
                    <div class="field-value" id="warranty-status">-</div>
                </div>
                <div class="field">
                    <div class="field-label">Last Installation Date:</div>
                    <div class="field-value" id="last-installation-date">-</div>
                </div>
            </div>
            <div class="reason-box">
                <div class="reason-label">Reason for Replacement:</div>
                <div class="reason-text" id="replacement-reason">No reason provided</div>
            </div>
        </div>

        <!-- Payment Status & Vendor -->
        <div class="section">
            <div class="section-title">Payment Status & Vendor Information</div>
            <div class="fields-row">
                <div class="field">
                    <div class="field-label">Vendor:</div>
                    <div class="field-value" id="assigned-vendor">-</div>
                </div>
                <div class="field">
                    <div class="field-label">Payment Status:</div>
                    <div class="field-value" id="payment-status">-</div>
                </div>
            </div>
            <div class="fields-row">
                <div class="field">
                    <div class="field-label">Approval Date:</div>
                    <div class="field-value" id="approval-date">-</div>
                </div>
                <div class="field">
                    <div class="field-label">Created Date:</div>
                    <div class="field-value" id="created-date">-</div>
                </div>
            </div>
        </div>

        <!-- Footer -->
        <div class="footer">
            <div>Generated on: <span id="generation-date">-</span></div>
            <div>Diamond Paints - Payment Details Report</div>
        </div>
    </div>

    <script>
        function populateTemplate(data) {
            const cleanText = (text) => {
                if (!text) return 'N/A';
                return String(text).replace(/[^\\x20-\\x7E\\u00A0-\\u00FF]/g, '').trim();
            };

            const formatStatus = (status) => {
                if (!status) return 'N/A';
                const statusMap = {
                    'payment successful': 'Payment Successful',
                    'pending': 'Pending',
                    'approved': 'Approved',
                    'rejected': 'Rejected',
                    'completed': 'Completed'
                };
                return statusMap[status] || status.replace(/_/g, ' ').replace(/\\b\\w/g, l => l.toUpperCase());
            };

            const formatPhone = (phone) => {
                if (!phone) return 'N/A';
                const phoneStr = String(phone).replace(/\\D/g, '');
                if (phoneStr.startsWith('92')) {
                    return \`+92 \${phoneStr.slice(2, 5)} \${phoneStr.slice(5)}\`;
                }
                return phoneStr;
            };

            const formatDate = (date) => {
                if (!date) return 'N/A';
                return new Date(date).toLocaleDateString('en-GB');
            };

            // Populate dealer information
            document.getElementById('dealer-name').textContent = cleanText(data.dealer?.name || 'N/A');
            document.getElementById('dealer-code').textContent = cleanText(data.dealer?.code || 'N/A');
            document.getElementById('dealer-phone').textContent = formatPhone(data.dealer?.phone);
            document.getElementById('dealer-address').textContent = cleanText(data.dealer?.city || 'N/A');
            document.getElementById('dealer-type').textContent = data.dealer_type === 'new' ? 'New Dealer' : 'Existing Dealer';

            // Populate request items in table format
            const itemsTableBody = document.getElementById('request-items');
            const items = data.requestItems || data.request_items || [];
            let totalCost = 0;

            if (items.length > 0) {
                items.forEach((item, index) => {
                    const width = parseFloat(item.width) || 0;
                    const height = parseFloat(item.height) || 0;
                    const totalArea = width * height;
                    const pricePerSqft = parseFloat(item.price_per_square_foot || item.price_per_sqft || item.pricePerSqft) || 0;
                    const itemCost = parseFloat(item.price) || 0;
                    totalCost += itemCost;

                    const row = document.createElement('tr');
                    row.innerHTML = \`
                        <td>\${index + 1}</td>
                        <td>\${cleanText(item.requestType?.name || item.request_type || 'N/A')}</td>
                        <td>\${width > 0 ? width.toFixed(2) : 'N/A'}</td>
                        <td>\${height > 0 ? height.toFixed(2) : 'N/A'}</td>
                        <td>\${pricePerSqft > 0 ? \`Rs. \${pricePerSqft.toFixed(2)}\` : 'N/A'}</td>
                        <td>\${totalArea > 0 ? totalArea.toFixed(2) : 'N/A'}</td>
                        <td>\${itemCost > 0 ? \`Rs. \${itemCost.toFixed(2)}\` : 'N/A'}</td>
                    \`;
                    itemsTableBody.appendChild(row);
                });
            } else {
                itemsTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 10px; color: #666; font-size: 9px;">No request items found</td></tr>';
            }

            document.getElementById('total-cost').textContent = \`Rs. \${totalCost.toFixed(2)}\`;

            // Populate warranty information
            document.getElementById('warranty-status').textContent = cleanText(data.warrantyStatus?.name || 'N/A');
            document.getElementById('last-installation-date').textContent = formatDate(data.last_installation_date);
            document.getElementById('replacement-reason').textContent = cleanText(data.reason_for_replacement || 'No reason provided');

            // Populate vendor and payment information
            const vendorName = data.vendor?.card_name || data.vendor?.name || data.vendor_name || 'Not assigned';
            document.getElementById('assigned-vendor').textContent = cleanText(vendorName);
            document.getElementById('payment-status').textContent = formatStatus(data.status);
            document.getElementById('approval-date').textContent = formatDate(data.approval_date);
            document.getElementById('created-date').textContent = formatDate(data.created_at);

            // Update generation date
            document.getElementById('generation-date').textContent = new Date().toLocaleDateString('en-GB');

            // Auto-trigger print dialog after a short delay
            setTimeout(() => {
                window.print();
            }, 500);
        }

        window.populateRequestTemplate = populateTemplate;
    </script>
</body>
</html>`;

      // Write the template to the iframe
      iframeDoc.open();
      iframeDoc.write(templateHtml);
      iframeDoc.close();

      // Wait for iframe to load, then populate and trigger print
      iframe.onload = () => {
        setTimeout(() => {
          if (iframe.contentWindow.populateRequestTemplate) {
            iframe.contentWindow.populateRequestTemplate(requestData);
            
            // Clean up iframe after print dialog is closed
            setTimeout(() => {
              document.body.removeChild(iframe);
            }, 1000);
          }
        }, 100);
      };

      toast.success('PDF generation initiated. Please use the print dialog to save as PDF.', {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF. Please try again.', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    }
  }, []);

  const handleRowClick = React.useCallback(
    ({ row }) => {
      handleView(row);
    },
    [handleView],
  );

  // Get fields for view modal
  const getRequestFields = (requestData = null) => {
    const fields = [];
    
    // Return empty fields if requestData is null
    if (!requestData) {
      return fields;
    }
    
    const hasParent = requestData?.dealer_relation?.parent && 
                      requestData?.dealer?.id && 
                      requestData.dealer.id !== requestData.dealer_relation.parent.id;
    
    if (hasParent && requestData.dealer_relation.parent) {
      const parent = requestData.dealer_relation.parent;
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

  // Render main changes for history
  const renderMainChanges = (log, prevLog) => {
    const mc = log.main_changes || {};
    const entries = Object.entries(mc);
    if (entries.length === 0) return null;
    return (
      <Box sx={{ mb: 2 }}>
        {entries.map(([key, value], idx) => {
          if (key === 'assigned_vm') return null;
          if (value === null || value === undefined) return null;
          if (Array.isArray(value) && value.length === 0) return null;

          if (key === 'vendor_code') {
            const vendorDisplay = mc.vendor_name || value;
            return (
              <Typography key={`${key}-${idx}`} variant="body2" sx={{ color: '#333', mb: 0.5 }}>
                Vendor: {vendorDisplay}
              </Typography>
            );
          }
          if (key === 'dealer_id') {
            const dealerDisplay = mc.dealer_name || value;
            return (
              <Typography key={`${key}-${idx}`} variant="body2" sx={{ color: '#333', mb: 0.5 }}>
                Dealer: {dealerDisplay}
              </Typography>
            );
          }
          if (key === 'warranty_status_id') {
            return (
              <Typography key={`${key}-${idx}`} variant="body2" sx={{ color: '#333', mb: 0.5 }}>
                Warranty Status: {value}
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
          if (key === 'status') {
            return (
              <Typography key={`${key}-${idx}`} variant="body2" sx={{ color: '#333', mb: 0.5 }}>
                Status: {String(value)}
              </Typography>
            );
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

  // Column definitions for payments (payment successful requests only)
  const columns = React.useMemo(
    () => [
      { 
        field: 'id', 
        headerName: 'Request ID',
        width: 100,
        align: 'left',
        headerAlign: 'left',
        renderCell: (params) => {
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
              <Typography variant="body2">
                {params.value}
              </Typography>
            </Box>
          );
        },
      },
      {
        field: 'dealer_name',
        headerName: 'Dealer Name',
        minWidth: 200,
        align: 'left',
        headerAlign: 'left',
        renderCell: (params) => {
          const dealer = params.row.dealer;
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
              <Typography variant="body2">
                {dealer ? dealer.name : 'N/A'}
              </Typography>
            </Box>
          );
        },
      },
      {
        field: 'dealer_code',
        headerName: 'Dealer Code',
        width: 150,
        align: 'left',
        headerAlign: 'left',
        renderCell: (params) => {
          const dealer = params.row.dealer;
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
              <Typography variant="body2">
                {dealer ? dealer.code : 'N/A'}
              </Typography>
            </Box>
          );
        },
      },
      {
        field: 'vendor_name',
        headerName: 'Vendor Name',
        width: 200,
        align: 'left',
        headerAlign: 'left',
        renderCell: (params) => {
          const vendorName = getVendorName(params.row);
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
              <Typography variant="body2">
                {vendorName}
              </Typography>
            </Box>
          );
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
        field: 'created_at',
        headerName: 'Created At',
        minWidth: 170,
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
        field: 'approval_date',
        headerName: 'Approval Date',
        minWidth: 170,
        align: 'left',
        headerAlign: 'left',
        renderCell: (params) => {
          const approvalDate = params.value;
          if (!approvalDate) {
            return (
              <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                <Typography variant="body2" sx={{ color: '#999', fontStyle: 'italic' }}>
                  N/A
                </Typography>
              </Box>
            );
          }
          
          try {
            const date = new Date(approvalDate);
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
            return (
              <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                <Typography variant="body2" sx={{ color: '#999', fontStyle: 'italic' }}>
                  N/A
                </Typography>
              </Box>
            );
          }
        },
      },
      {
        field: 'status',
        headerName: 'Status',
        width: 150,
        align: 'left',
        headerAlign: 'left',
        renderCell: (params) => {
          const status = params.value;
          const displayStatus = getStatusDisplayName(status);
          const statusColor = getStatusColorHelper(status);
          
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
              <Chip 
                label={displayStatus} 
                variant="filled" 
                size="small"
                color={statusColor}
              />
            </Box>
          );
        },
      },
      {
        field: 'actions',
        type: 'actions',
        headerName: 'Actions',
        width: 200,
        getActions: (params) => {
          const row = params.row;
          const actions = [];
          
          // Always show request view action
          actions.push(
            <GridActionsCellItem
              key="view"
              icon={<Tooltip title="Request"><RequestIcon /></Tooltip>}
              label="Request"
              onClick={() => handleView(row)}
              color="primary"
            />
          );
          
          // Show detailed view
          actions.push(
            <GridActionsCellItem
              key="viewDetails"
              icon={<Tooltip title="View Details"><VisibilityIcon /></Tooltip>}
              label="View Details"
              onClick={() => handleViewDetails(row)}
              color="info"
            />
          );

          // Show invoice viewer if invoice files exist (from shopboard_request_files)
          if (row.has_invoice_files) {
            actions.push(
              <GridActionsCellItem
                key="viewInvoice"
                icon={<Tooltip title="View Invoice Documents"><InvoiceIcon /></Tooltip>}
                label="View Invoice"
                onClick={() => handleViewInvoice(row)}
                color="info"
              />
            );
          }

          // Show old purchases action for all requests (dealer history)
          if (canRead && row.dealer) {
            actions.push(
              <GridActionsCellItem
                key="viewOldPurchases"
                icon={<Tooltip title="Old Purchases"><OldPurchasesIcon /></Tooltip>}
                label="Old Purchases"
                onClick={() => handleViewOldPurchases(row)}
                color="info"
              />
            );
          }

          // Show history action
          actions.push(
            <GridActionsCellItem
              key="viewHistory"
              icon={<Tooltip title="View History"><HistoryIcon /></Tooltip>}
              label="View History"
              onClick={() => handleViewHistory(row)}
              color="default"
            />
          );

          // Show print action
          actions.push(
            <GridActionsCellItem
              key="print"
              icon={<Tooltip title="Print PDF"><PrintIcon /></Tooltip>}
              label="Print PDF"
              onClick={() => handlePrint(row)}
              color="secondary"
            />
          );
          
          return actions;
        },
      },
    ],
    [canRead, handleView, handleViewDetails, handleViewInvoice, handleViewOldPurchases, handleViewHistory, handlePrint, getVendorName],
  );

  const pageTitle = 'Payments';

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
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Backdrop open={loadingRequestDetails} sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.modal + 1 }}>
        <CircularProgress color="inherit" />
      </Backdrop>

      {/* Filters - same as AreaHeadRequests */}
      <ShopboardRequestFilters
        filters={filters}
        onFilterChange={setFilters}
        filteredCount={rowsState.rowCount}
        showFilteredCount={!!(filters.vendor || filters.status || filters.region || filters.parentDealer || filters.childDealer || filters.salesHead || filters.startDate || filters.endDate)}
      />

      <ReusableDataTable
        data={filteredRows}
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
        onRefresh={null}
        
        // Row interaction
        onRowClick={canRead ? handleRowClick : null}
        
        // Configuration
        pageSizeOptions={[5, 10, 25, 50]}
        showToolbar={true}
        hideCreateButton={true}
        disableColumnFilter={true}
        disableColumnMenu={true}
        slots={{
          toolbar: CustomToolbar
        }}
      />

      {/* View Request Details Modal */}
      <DynamicModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        mode="view"
        title="Payment Details"
        initialData={(() => {
          const data = selectedRequest || {};
          const hasParent = data?.dealer_relation?.parent && 
                            data?.dealer?.id && 
                            data.dealer.id !== data.dealer_relation.parent.id;
          
          // Flatten dealer and vendor data for DynamicModal
          const flattenedData = {
            ...data,
            // Dealer fields
            dealer_name: data?.dealer?.name || 'N/A',
            dealer_code: data?.dealer?.code || 'N/A',
            dealer_phone: data?.dealer?.phone || 'N/A',
            dealer_city: data?.dealer?.city || 'N/A',
            dealer_type: data?.dealer_type === 'new' ? 'New' : 'Old',
            // Vendor field
            vendor_name: getVendorName(data) || 'N/A',
            // Status field
            status: getStatusDisplayName(data?.status) || 'N/A',
            // Cost field
            total_cost: data?.total_cost ? `Rs ${parseFloat(data.total_cost).toFixed(2)}` : 'N/A',
            // Date fields
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
                  const fileUrl = url.startsWith('data:') || url.startsWith('http') ? url : (url.startsWith('/') ? `${BASE_URL}${url}` : `${BASE_URL}/uploads/survey_forms/${url}`);
                  const handleClick = () => (url.startsWith('data:') ? openFileInNewTab(fileUrl) : window.open(fileUrl, '_blank'));
                  return (
                    <Chip
                      key={index}
                      label={fileName}
                      size="small"
                      color="primary"
                      variant="outlined"
                      onClick={handleClick}
                      sx={{ cursor: 'pointer', '&:hover': { backgroundColor: '#e3f2fd' } }}
                    />
                  );
                })}
              </Box>
            </Box>
          ) : null
        }
      />

      {/* Detailed View Modal - same as AreaHeadRequests */}
      <Dialog
        open={detailedViewModalOpen}
        onClose={() => setDetailedViewModalOpen(false)}
        aria-labelledby="detailed-view-dialog-title"
        PaperProps={{
          sx: {
            backgroundColor: '#ffffff',
            minWidth: '800px',
            maxWidth: '1200px',
            maxHeight: '90vh',
            overflow: 'auto',
            borderRadius: 2,
            boxShadow: 6,
          }
        }}
      >
        <DialogTitle 
          id="detailed-view-dialog-title"
          sx={{ 
            color: 'info.main',
            fontWeight: 'bold',
            borderBottom: '1px solid #eaeaea',
            mb: 1,
          }}
        >
          Payment Details - #{selectedDetailedRequest?.id}
        </DialogTitle>
        <DialogContent>
          {selectedDetailedRequest && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
              {/* Dealer Information */}
              <Box sx={{ p: 3, borderRadius: 2, backgroundColor: '#f8f9fa', border: '1px solid #e0e0e0' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: 'primary.main' }}>
                  🏢 Dealer Information
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                      Dealer Name
                    </Typography>
                    <Typography variant="body1">
                      {selectedDetailedRequest.dealer?.name || 'N/A'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                      Dealer Code
                    </Typography>
                    <Typography variant="body1">
                      {selectedDetailedRequest.dealer?.code || 'N/A'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                      Phone
                    </Typography>
                    <Typography variant="body1">
                      {selectedDetailedRequest.dealer?.phone || 'N/A'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                      Address
                    </Typography>
                    <Typography variant="body1">
                      {selectedDetailedRequest.dealer?.city || 'N/A'}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* Request Items */}
              <Box sx={{ p: 3, borderRadius: 2, backgroundColor: '#f8f9fa', border: '1px solid #e0e0e0' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: 'primary.main' }}>
                  📋 Request Items & Dimensions
                </Typography>
                {selectedDetailedRequest.requestItems && selectedDetailedRequest.requestItems.length > 0 ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {selectedDetailedRequest.requestItems.map((item, index) => (
                      <Box key={index} sx={{ p: 2, borderRadius: 2, backgroundColor: '#ffffff', border: '1px solid #e0e0e0' }}>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 2, alignItems: 'center' }}>
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                              Request Type
                            </Typography>
                            <Typography variant="body2">
                              {item.requestType?.name || 'N/A'}
                            </Typography>
                          </Box>
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                              Width (ft)
                            </Typography>
                            <Typography variant="body2">
                              {item.width || 'N/A'}
                            </Typography>
                          </Box>
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                              Height (ft)
                            </Typography>
                            <Typography variant="body2">
                              {item.height || 'N/A'}
                            </Typography>
                          </Box>
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                              Price per ft²
                            </Typography>
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
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                              Total Cost
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                              {item.price ? `Rs ${parseFloat(item.price).toFixed(2)}` : 'N/A'}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    ))}
                    <Box sx={{ mt: 2, p: 2, backgroundColor: '#e3f2fd', borderRadius: 2, border: '1px solid #bbdefb' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                          Total Cost (All Items)
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                          Rs{(() => {
                            if (!selectedDetailedRequest.requestItems || !Array.isArray(selectedDetailedRequest.requestItems)) return '0.00';
                            const total = selectedDetailedRequest.requestItems.reduce((sum, item) => {
                              const price = parseFloat(item.price) || 0;
                              return sum + price;
                            }, 0);
                            return total.toFixed(2);
                          })()}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                ) : (
                  <Typography variant="body1" sx={{ color: '#666', fontStyle: 'italic' }}>
                    No request items found
                  </Typography>
                )}
              </Box>

              {/* Attachments - Site Photos, Old Board Photos, Survey Forms */}
              <Box sx={{ p: 3, borderRadius: 2, backgroundColor: '#f8f9fa', border: '1px solid #e0e0e0' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: 'primary.main' }}>
                  📎 Attachments
                </Typography>

                {/* Site Photos */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Site Photos
                  </Typography>
                  {selectedDetailedRequest.site_photo_attachement && selectedDetailedRequest.site_photo_attachement.length > 0 ? (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {selectedDetailedRequest.site_photo_attachement.map((file, index) => {
                        const { url, fileName } = getFileUrlAndName(file, index, `Site Photo ${index + 1}`);
                        const fileUrl = url.startsWith('data:') || url.startsWith('http') ? url : (url.startsWith('/') ? `${BASE_URL}${url}` : `${BASE_URL}/uploads/site_photos/${url}`);
                        return (
                          <Chip
                            key={`site-${index}`}
                            label={fileName}
                            size="small"
                            color="primary"
                            variant="outlined"
                            onClick={() => openFileInNewTab(fileUrl)}
                            sx={{ cursor: 'pointer', '&:hover': { backgroundColor: '#e3f2fd' } }}
                          />
                        );
                      })}
                    </Box>
                  ) : (
                    <Typography variant="body2" sx={{ color: '#666', fontStyle: 'italic' }}>
                      No site photos uploaded
                    </Typography>
                  )}
                </Box>

                {/* Old Board Photos */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Old Board Photos
                  </Typography>
                  {selectedDetailedRequest.old_board_photo_attachment && selectedDetailedRequest.old_board_photo_attachment.length > 0 ? (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {selectedDetailedRequest.old_board_photo_attachment.map((file, index) => {
                        const { url, fileName } = getFileUrlAndName(file, index, `Old Board Photo ${index + 1}`);
                        const fileUrl = url.startsWith('data:') || url.startsWith('http') ? url : (url.startsWith('/') ? `${BASE_URL}${url}` : `${BASE_URL}/uploads/old_board_photos/${url}`);
                        return (
                          <Chip
                            key={`old-${index}`}
                            label={fileName}
                            size="small"
                            color="secondary"
                            variant="outlined"
                            onClick={() => openFileInNewTab(fileUrl)}
                            sx={{ cursor: 'pointer', '&:hover': { backgroundColor: '#f3e5f5' } }}
                          />
                        );
                      })}
                    </Box>
                  ) : (
                    <Typography variant="body2" sx={{ color: '#666', fontStyle: 'italic' }}>
                      No old board photos uploaded
                    </Typography>
                  )}
                </Box>

                {/* Survey Forms */}
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Survey Forms
                  </Typography>
                  {selectedDetailedRequest.survey_form_attachments && selectedDetailedRequest.survey_form_attachments.length > 0 ? (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {selectedDetailedRequest.survey_form_attachments.map((file, index) => {
                        const { url, fileName } = getFileUrlAndName(file, index, `Survey Form ${index + 1}`);
                        const fileUrl = url.startsWith('data:') || url.startsWith('http') ? url : (url.startsWith('/') ? `${BASE_URL}${url}` : `${BASE_URL}/uploads/survey_forms/${url}`);
                        return (
                          <Chip
                            key={`survey-${index}`}
                            label={fileName}
                            size="small"
                            color="success"
                            variant="outlined"
                            onClick={() => openFileInNewTab(fileUrl)}
                            sx={{ cursor: 'pointer', '&:hover': { backgroundColor: '#e8f5e8' } }}
                          />
                        );
                      })}
                    </Box>
                  ) : (
                    <Typography variant="body2" sx={{ color: '#666', fontStyle: 'italic' }}>
                      No survey forms uploaded
                    </Typography>
                  )}
                </Box>
              </Box>

              {/* Status & Vendor Info */}
              <Box sx={{ p: 3, borderRadius: 2, backgroundColor: '#f8f9fa', border: '1px solid #e0e0e0' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: 'primary.main' }}>
                  📊 Payment Information
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                      Status
                    </Typography>
                    <Chip 
                      label={getStatusDisplayName(selectedDetailedRequest.status)} 
                      variant="filled" 
                      size="small"
                      color={getStatusColorHelper(selectedDetailedRequest.status)}
                    />
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                      Vendor
                    </Typography>
                    <Typography variant="body1">
                      {getVendorName(selectedDetailedRequest) || 'Not Assigned'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                      Total Cost
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                      {selectedDetailedRequest.total_cost ? `Rs ${parseFloat(selectedDetailedRequest.total_cost).toFixed(2)}` : 'N/A'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                      Approval Date
                    </Typography>
                    <Typography variant="body1">
                      {selectedDetailedRequest.approval_date ? 
                        new Date(selectedDetailedRequest.approval_date).toLocaleString() : 'N/A'}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 2, backgroundColor: '#f8f9fa', borderTop: '1px solid #e0e0e0' }}>
          <Button 
            onClick={() => setDetailedViewModalOpen(false)}
            variant="outlined"
            sx={{ 
              color: '#666',
              borderColor: '#ddd',
              borderRadius: 2,
              px: 3,
              '&:hover': {
                borderColor: '#999',
                backgroundColor: '#f5f5f5',
              }
            }}
          >
            ✖️ Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Invoice Viewer Modal */}
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

      {/* View History Dialog */}
      <Dialog
        open={historyDialogOpen}
        onClose={() => setHistoryDialogOpen(false)}
        aria-labelledby="history-dialog-title"
        PaperProps={{
          sx: {
            backgroundColor: '#ffffff',
            minWidth: '600px',
            maxWidth: '900px',
            maxHeight: '80vh',
            overflow: 'auto',
          }
        }}
      >
        <DialogTitle 
          id="history-dialog-title"
          sx={{ 
            color: 'info.main',
            fontWeight: 'bold',
          }}
        >
          Request History - #{requestToAction?.id || 'N/A'}
        </DialogTitle>
        <DialogContent>
          {loadingHistory ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <Typography>Loading history...</Typography>
            </Box>
          ) : requestHistory.length === 0 ? (
            <Box sx={{ textAlign: 'center', p: 4 }}>
              <Typography variant="body1" sx={{ color: '#666' }}>
                No history found for this request.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {requestHistory.map((log, index) => {
                const prevLog = index > 0 ? requestHistory[index - 1] : null;
                return (
                  <Box 
                    key={index} 
                    sx={{ 
                      p: 2, 
                      border: '1px solid #e0e0e0', 
                      borderRadius: 1, 
                      backgroundColor: '#f9f9f9' 
                    }}
                  >
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
                    
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                        Changes:
                      </Typography>
                      {renderMainChanges(log, prevLog)}
                      
                      {log.item_changes && log.item_changes.length > 0 && (
                        <Box sx={{ mt: 1, p: 1, backgroundColor: '#f0f0f0', borderRadius: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                            Request items:
                          </Typography>
                          {log.item_changes.map((item, idx) => (
                            <Box key={idx} sx={{ mb: 1, p: 1, backgroundColor: '#ffffff', borderRadius: 0.5 }}>
                              <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                                {item.action}: {item.request_type}
                              </Typography>
                              {item.width && parseFloat(item.width) > 0 && (
                                <Typography variant="body2" sx={{ color: '#333', mb: 0.5 }}>
                                  Width: {item.width} ft
                                </Typography>
                              )}
                              {item.height && parseFloat(item.height) > 0 && (
                                <Typography variant="body2" sx={{ color: '#333', mb: 0.5 }}>
                                  Height: {item.height} ft
                                </Typography>
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
                  </Box>
                );
              })}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button 
            onClick={() => {
              setHistoryDialogOpen(false);
              setRequestHistory([]);
            }}
            variant="outlined"
            sx={{ 
              color: '#666',
              borderColor: '#ddd',
              '&:hover': {
                borderColor: '#999',
                backgroundColor: '#f5f5f5',
              }
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Old Purchases Modal */}
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

