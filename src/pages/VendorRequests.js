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
  IconButton,
  Box,
  TextField,
  Autocomplete,
  Divider,
  InputAdornment,
  Paper,
  Grid,
  Popover,
  Backdrop,
  CircularProgress,
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Description as RequestIcon,
  Edit as EditIcon,
  Refresh as ReviewAgainIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Comment as CommentIcon,
  History as HistoryIcon,
  Visibility as ViewIcon,
  Receipt as InvoiceIcon,
  Assignment as WorkOrderIcon,
  Print as PrintIcon,
  Group as SalesHeadIcon,
  Store as DealerIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
  Label as StatusIcon,
  CalendarToday as DateIcon,
  Close as CloseIcon,
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
import WorkOrderPDFGenerator from '../components/WorkOrderPDFGenerator';
import ManualSurveyHighlight from '../components/ManualSurveyHighlight';
import { BASE_URL } from "../constants/Constants";
import { 
  SHOPBOARD_REQUEST_STATUS, 
  getVendorStatusDisplayName, 
  getVendorStatusColor,
  mapStatusForVendor,
  VENDOR_APPROVAL_STATUS
} from "../constants/VendorRequestStatus";
import { useApi } from '../hooks/useApi';

const isVendorInvoiceDocumentsStatus = (status) =>
  status === SHOPBOARD_REQUEST_STATUS.INVOICE_SENT ||
  status === SHOPBOARD_REQUEST_STATUS.FINANCE_REJECTED ||
  status === SHOPBOARD_REQUEST_STATUS.SUBMITTED_FOR_PAYMENT ||
  status === SHOPBOARD_REQUEST_STATUS.PAYMENT_SUCCESSFUL;

const INITIAL_PAGE_SIZE = 10;

function getFileUrlAndName(item, index, fallbackLabel) {
  if (item == null) return { url: '', fileName: fallbackLabel };
  if (typeof item === 'object') {
    if (typeof item.url === 'string' && item.url.length > 0) {
      return {
        url: item.url,
        fileName: item.fileName || item.file_name || fallbackLabel,
      };
    }
    // Raw DB record leaked without url — do not surface binary content in the UI
    if (item.content != null) {
      console.warn('File item missing url field; expected normalized API response', item);
      return { url: '', fileName: item.file_name || item.fileName || fallbackLabel };
    }
  }
  const str = typeof item === 'string' ? item : '';
  return { url: str, fileName: str.startsWith('data:') ? fallbackLabel : str.split('/').pop() || fallbackLabel };
}

function resolveAttachmentUrl(url) {
  if (!url || typeof url !== 'string') return '';
  if (url.startsWith('data:') || url.startsWith('http')) return url;
  return url.startsWith('/') ? `${BASE_URL}${url}` : `${BASE_URL}/${url}`;
}

function normalizeDbFileList(items, labelPrefix) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item, index) => {
      const normalized = getFileUrlAndName(item, index, `${labelPrefix} ${index + 1}`);
      return normalized.url ? normalized : null;
    })
    .filter(Boolean);
}

function normalizeSitePhotosPerItem(map) {
  if (!map || typeof map !== 'object') return {};
  const result = {};
  Object.entries(map).forEach(([itemId, files]) => {
    const normalized = normalizeDbFileList(files, 'Site Photo');
    if (normalized.length > 0) result[itemId] = normalized;
  });
  return result;
}

function loadInvoiceExistingFilesFromRequest(full) {
  return {
    invoiceFiles: normalizeDbFileList(full?.invoice_files_data, 'Invoice'),
    dealerAckFiles: normalizeDbFileList(full?.dealer_acknowledgment_files_data, 'Acknowledgment'),
    sitePhotosPerItem: normalizeSitePhotosPerItem(full?.invoice_site_photos_by_item_data),
  };
}

function getExistingSitePhotosForItem(map, itemId) {
  if (!map) return [];
  return map[itemId] || map[String(itemId)] || [];
}

const isEnableQuantityFlag = (value) => value === true || value === 1 || value === '1' || value === 'true';

const getQtyMultiplier = (item, requestType) => {
  if (!isEnableQuantityFlag(requestType?.enable_quantity)) return 1;
  const q = parseInt(item?.quantity, 10);
  return Number.isFinite(q) && q > 0 ? q : 1;
};

const calcFixedOrManualTotal = (item, requestType) => {
  const widthFt = parseFloat(item?.width) || 0;
  const heightFt = parseFloat(item?.height) || 0;
  const areaSqft = widthFt * heightFt;
  const pricePerSqft = parseFloat(item?.price_per_sqft) || 0;
  const total = areaSqft * pricePerSqft * getQtyMultiplier(item, requestType);
  return isNaN(total) ? '' : Number(total.toFixed(2));
};

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

export default function VendorRequests() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const { user, hasPermission, token } = useAuth();
  
  // Check if user is a vendor (not admin or other user types)
  const isVendor = user?.user_type === 'vendor';
  
  // Check user permissions - using vendorRequests permissions
  const canRead = user?.permissions?.vendorRequests?.includes('read') || false;
  const canUpdate = user?.permissions?.vendorRequests?.includes('update') || false;
  const canCreate = user?.permissions?.vendorRequests?.includes('create') || false;
  const canDelete = user?.permissions?.vendorRequests?.includes('delete') || false;
  const canApprove = canUpdate; // Approve is an update operation
  const canReject = canUpdate; // Reject is an update operation

  const { get, post, put, patch, del } = useApi();

  const [rowsState, setRowsState] = React.useState({
    rows: [],
    rowCount: 0,
  });

  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  
  // Filter state - inline filter management
  const [selectedSalesHead, setSelectedSalesHead] = React.useState(null);
  const [salesHeads, setSalesHeads] = React.useState([]);
  const [loadingSalesHeads, setLoadingSalesHeads] = React.useState(false);
  
  const [selectedDealer, setSelectedDealer] = React.useState(null);
  const [filterDealers, setFilterDealers] = React.useState([]);
  const [loadingDealers, setLoadingDealers] = React.useState(false);
  
  const [selectedStatus, setSelectedStatus] = React.useState(null);
  const [statusOptions, setStatusOptions] = React.useState([]);
  const [loadingStatusOptions, setLoadingStatusOptions] = React.useState(false);
  
  const [startDate, setStartDate] = React.useState(null);
  const [endDate, setEndDate] = React.useState(null);
  const [dateRangeAnchor, setDateRangeAnchor] = React.useState(null);
  
  // Use filters state for API calls
  const [filters, setFilters] = React.useState({
    salesHead: null,
    dealer: null,
    status: null,
    startDate: null,
    endDate: null,
  });
  
  // Use ref to store current filters to avoid recreating loadRequests
  const filtersRef = React.useRef(filters);
  React.useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);
  
  // Fetch sales heads from API - run once on mount
  // Fetch for all users - backend will return empty array for non-vendors
  React.useEffect(() => {
    const fetchSalesHeads = async () => {
      if (!canRead) {
        setLoadingSalesHeads(false);
        setSalesHeads([]);
        return;
      }
      
      setLoadingSalesHeads(true);
      try {
        const response = await get('/api/shopboard-requests/vendor/sales-heads');
        if (response.success && Array.isArray(response.data)) {
          setSalesHeads(response.data);
        } else {
          setSalesHeads([]);
        }
      } catch (error) {
        console.error('Error fetching sales heads:', error);
        setSalesHeads([]);
      } finally {
        setLoadingSalesHeads(false);
      }
    };

    fetchSalesHeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount
  
  // Fetch dealers from API - run once on mount
  // Fetch for all users - backend will return empty array for non-vendors
  React.useEffect(() => {
    const fetchDealers = async () => {
      if (!canRead) {
        setLoadingDealers(false);
        setFilterDealers([]);
        return;
      }
      
      setLoadingDealers(true);
      try {
        const response = await get('/api/shopboard-requests/vendor/dealers');
        if (response.success && Array.isArray(response.data)) {
          setFilterDealers(response.data);
        } else {
          setFilterDealers([]);
        }
      } catch (error) {
        console.error('Error fetching dealers:', error);
        setFilterDealers([]);
      } finally {
        setLoadingDealers(false);
      }
    };

    fetchDealers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount
  
  // Fetch status options from API - run once on mount
  React.useEffect(() => {
    const fetchStatusOptions = async () => {
      if (!canRead) {
        setLoadingStatusOptions(false);
        setStatusOptions([]);
        return;
      }
      
      setLoadingStatusOptions(true);
      try {
        const response = await get('/api/shopboard-requests/vendor/status-options');
        if (response.success && Array.isArray(response.data)) {
          setStatusOptions(response.data);
        } else {
          setStatusOptions([]);
        }
      } catch (error) {
        console.error('Error fetching status options:', error);
        setStatusOptions([]);
      } finally {
        setLoadingStatusOptions(false);
      }
    };

    fetchStatusOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount
  
  // Update filters when selectedSalesHead, selectedDealer, selectedStatus, startDate, or endDate changes
  React.useEffect(() => {
    setFilters({
      salesHead: selectedSalesHead,
      dealer: selectedDealer,
      status: selectedStatus,
      startDate: startDate,
      endDate: endDate
    });
    // Reset to first page when filter changes
    if (selectedSalesHead !== null || selectedDealer !== null || selectedStatus !== null || startDate !== null || endDate !== null) {
      setPaginationModel(prev => {
        if (prev.page === 0) return prev;
        return { ...prev, page: 0 };
      });
    }
  }, [selectedSalesHead, selectedDealer, selectedStatus, startDate, endDate]);
  
  // Modal state for viewing request details
  const [modalOpen, setModalOpen] = React.useState(false);
  const [selectedRequest, setSelectedRequest] = React.useState(null);
  
  // Modal state for detailed view
  const [detailedViewModalOpen, setDetailedViewModalOpen] = React.useState(false);
  const [selectedDetailedRequest, setSelectedDetailedRequest] = React.useState(null);
  
  // Invoice upload modal state
  const [invoiceModalOpen, setInvoiceModalOpen] = React.useState(false);
  const [selectedInvoiceRequest, setSelectedInvoiceRequest] = React.useState(null);
  const [invoiceFile, setInvoiceFile] = React.useState(null);
  const [dealerAcknowledgmentFile, setDealerAcknowledgmentFile] = React.useState(null);
  // Per-item site photos for invoice modal: { [itemId]: File[] }
  const [sitePhotosPerItem, setSitePhotosPerItem] = React.useState({});
  const [invoiceLoading, setInvoiceLoading] = React.useState(false);
  const [invoiceNumber, setInvoiceNumber] = React.useState('');
  
  // Loading full request details when opening details/invoice modals
  const [loadingRequestDetails, setLoadingRequestDetails] = React.useState(false);

  // Invoice viewer modal state
  const [invoiceViewerModalOpen, setInvoiceViewerModalOpen] = React.useState(false);
  const [selectedInvoiceViewerRequest, setSelectedInvoiceViewerRequest] = React.useState(null);
  
  // Existing invoice files state (for display when editing)
  const [existingInvoiceFiles, setExistingInvoiceFiles] = React.useState([]);
  const [existingDealerAcknowledgmentFiles, setExistingDealerAcknowledgmentFiles] = React.useState([]);
  const [existingSitePhotosPerItem, setExistingSitePhotosPerItem] = React.useState({});
  
  // Rejection comments modal state (invoice_rejected)
  const [rejectionCommentsModalOpen, setRejectionCommentsModalOpen] = React.useState(false);
  const [selectedRejectionRequest, setSelectedRejectionRequest] = React.useState(null);
  const [rejectionComments, setRejectionComments] = React.useState([]);
  const [loadingRejectionComments, setLoadingRejectionComments] = React.useState(false);

  // Request rejection comments modal state (rejected status)
  const [requestRejectionCommentsModalOpen, setRequestRejectionCommentsModalOpen] = React.useState(false);
  const [requestRejectionCommentsList, setRequestRejectionCommentsList] = React.useState([]);
  const [loadingRequestRejectionComments, setLoadingRequestRejectionComments] = React.useState(false);
  const [selectedRequestRejection, setSelectedRequestRejection] = React.useState(null);
  
  // Edit modal state
  const [editModalOpen, setEditModalOpen] = React.useState(false);
  const [editingRequest, setEditingRequest] = React.useState(null);
  const [editFormData, setEditFormData] = React.useState({});

  // File upload state for edit modal
  const [sitePhotos, setSitePhotos] = React.useState([]);
  const [oldBoardPhotos, setOldBoardPhotos] = React.useState([]);
  const [existingSitePhotos, setExistingSitePhotos] = React.useState([]);
  const [existingOldBoardPhotos, setExistingOldBoardPhotos] = React.useState([]);


  // Action confirmation dialogs
  const [approveDialogOpen, setApproveDialogOpen] = React.useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = React.useState(false);
  const [commentsDialogOpen, setCommentsDialogOpen] = React.useState(false);
  const [requestToAction, setRequestToAction] = React.useState(null);
  
  // Comment state for rejection
  const [rejectionComment, setRejectionComment] = React.useState('');
  
  // Comments state for viewing area head comments
  const [requestComments, setRequestComments] = React.useState([]);
  const [loadingComments, setLoadingComments] = React.useState(false);
  
  // History state for viewing request history
  const [historyDialogOpen, setHistoryDialogOpen] = React.useState(false);
  const [requestHistory, setRequestHistory] = React.useState([]);
  const [loadingHistory, setLoadingHistory] = React.useState(false);

  // Dropdown options for edit form
  const [dealers, setDealers] = React.useState([]);
  const [requestTypes, setRequestTypes] = React.useState([]);
  const [warrantyStatuses, setWarrantyStatuses] = React.useState([]);
  const [loadingDropdowns, setLoadingDropdowns] = React.useState(false);
  // For history enrichment
  const [vendors, setVendors] = React.useState([]);
  const [warrantyStatusesHistory, setWarrantyStatusesHistory] = React.useState([]);

  // Table state management
  const [paginationModel, setPaginationModel] = React.useState({
    page: searchParams.get('page') ? Number(searchParams.get('page')) : 0,
    pageSize: searchParams.get('pageSize')
      ? Number(searchParams.get('pageSize'))
      : INITIAL_PAGE_SIZE,
  });
  
  // Use refs to track pagination and filters to avoid recreating loadRequests
  const paginationModelRef = React.useRef(paginationModel);
  React.useEffect(() => {
    paginationModelRef.current = paginationModel;
  }, [paginationModel]);

  const [filterModel, setFilterModel] = React.useState(
    searchParams.get('filter')
      ? JSON.parse(searchParams.get('filter') ?? '')
      : { items: [] },
  );

  const [sortModel, setSortModel] = React.useState(
    searchParams.get('sort')
      ? JSON.parse(searchParams.get('sort') ?? '')
      : [{ field: 'created_at', sort: 'desc' }],
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

  // Load dropdown data for edit form (warranty statuses only - dealer is already in editingRequest)
  const loadDropdownData = React.useCallback(async () => {
    setLoadingDropdowns(true);
    try {
      // Only fetch warranty statuses - dealer data is already available in editingRequest.dealer
      const warrantyStatusesRes = await get('/api/warranty-statuses');
      if (warrantyStatusesRes.success) setWarrantyStatuses(warrantyStatusesRes.data);
    } catch (error) {
      console.error('Error loading dropdown data:', error);
      toast.error('Failed to load form data', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } finally {
      setLoadingDropdowns(false);
    }
  }, [get]);

  // Load allowed request types for vendor
  // existingRequestTypeIds: optional array of request type IDs that should be included even if is_allowed=false
  const loadAllowedRequestTypes = React.useCallback(async (vendorCode, existingRequestTypeIds = null) => {
    if (!vendorCode) {
      setRequestTypes([]);
      return;
    }

    try {
      // Build query string
      let queryString = `vendor_code=${encodeURIComponent(vendorCode)}`;
      
      // If existing request type IDs are provided, include them in the query
      if (existingRequestTypeIds && Array.isArray(existingRequestTypeIds) && existingRequestTypeIds.length > 0) {
        const idsString = existingRequestTypeIds.map(id => String(id)).join(',');
        queryString += `&existing_request_type_ids=${encodeURIComponent(idsString)}`;
      }
      
      // Use vendor_code query parameter (vendorCode is the vendor_code from shopboard request)
      const response = await get(`/api/vendor-request-pricing/allowed-request-types?${queryString}`);
      
      if (response?.success && Array.isArray(response.data)) {
        setRequestTypes(response.data);
        if (response.data.length === 0) {
          toast.info('No allowed request types found for this vendor', {
            position: "top-right",
            autoClose: 5000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          });
        }
      } else {
        setRequestTypes([]);
        toast.warning('Failed to load allowed request types', {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      }
    } catch (error) {
      console.error('Error loading allowed request types:', error);
      setRequestTypes([]);
      toast.error('Failed to load allowed request types', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    }
  }, [get]);

  // Load dropdown data when edit modal opens
  React.useEffect(() => {
    if (editModalOpen && editingRequest) {
      // Load warranty statuses (dealer is already in editingRequest.dealer, no need to fetch)
      loadDropdownData();
      
      // Set dealer from editingRequest.dealer (no API call needed)
      if (editingRequest.dealer) {
        setDealers([editingRequest.dealer]);
      }
      
      // Load allowed request types for this vendor
      // Include existing request type IDs from the request items (even if is_allowed=false)
      const vendorCode = editingRequest.vendor_code || editingRequest.vendor?.code;
      if (vendorCode) {
        // Extract existing request type IDs from requestItems
        const existingRequestTypeIds = (editingRequest.requestItems || [])
          .map(item => item.request_type_id)
          .filter(id => id != null);
        
        loadAllowedRequestTypes(vendorCode, existingRequestTypeIds.length > 0 ? existingRequestTypeIds : null);
      } else {
        setRequestTypes([]);
        toast.warning('Vendor code not found for this request', {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      }
    }
  }, [editModalOpen, editingRequest, loadDropdownData, loadAllowedRequestTypes]);

  // Update items when requestTypes are loaded to handle manual and fees types
  React.useEffect(() => {
    if (editModalOpen && requestTypes.length > 0 && editFormData.request_items) {
      const updatedItems = editFormData.request_items.map(item => {
        const selectedRequestType = requestTypes.find(rt => rt.id === item.request_type_id);
        const isManual = selectedRequestType?.request_type === 'manual';
        const isFees = selectedRequestType?.request_type === 'fees';
        
        if (isManual) {
          // For manual type: set price_per_sqft from API if not already set, calculate price
          const pricePerSqft = item.price_per_sqft || selectedRequestType?.price || '';
          const total = calcFixedOrManualTotal({ ...item, price_per_sqft: pricePerSqft }, selectedRequestType);
          
          return {
            ...item,
            price_per_sqft: pricePerSqft,
            price: total === '' ? (item.price || '') : total
          };
        } else if (isFees) {
          // For fees type: set width/height to 0, price_per_sqft from API, keep price (editable)
          const pricePerSqft = selectedRequestType?.price || '';
          return {
            ...item,
            width: '0',
            height: '0',
            price_per_sqft: pricePerSqft,
            price: item.price || '' // Keep existing price, allow editing
          };
        }
        return item;
      });
      
      // Only update if there were changes
      const hasChanges = updatedItems.some((item, index) => {
        const original = editFormData.request_items[index];
        return item.width !== original.width ||
               item.height !== original.height ||
               item.price_per_sqft !== original.price_per_sqft ||
               item.price !== original.price;
      });
      
      if (hasChanges) {
        setEditFormData(prev => ({
          ...prev,
          request_items: updatedItems
        }));
      }
    }
  }, [requestTypes, editModalOpen]); // Only depend on requestTypes and editModalOpen


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

  // API call to fetch vendor shopboard requests
  // Not using useCallback to avoid dependency issues - will be recreated but that's okay
  const loadRequests = React.useCallback(async () => {
    if (!canRead) return;
    
    setError(null);
    setIsLoading(true);

    try {
      // Use current state values directly (not refs) since this function will be recreated when needed
      const { page, pageSize } = paginationModel;
      const currentFilters = filters;
      
      // Build query parameters
      const queryParams = new URLSearchParams({
        page: page.toString(),
        size: pageSize.toString()
      });
      
      // Add sales head filter if selected
      if (currentFilters.salesHead && currentFilters.salesHead.id) {
        queryParams.append('sales_head_id', currentFilters.salesHead.id.toString());
      }
      
      // Add dealer filter if selected
      if (currentFilters.dealer && currentFilters.dealer.id) {
        queryParams.append('dealer_id', currentFilters.dealer.id.toString());
      }
      
      // Add status filter if selected
      if (currentFilters.status && currentFilters.status.value) {
        queryParams.append('status', currentFilters.status.value.toString());
      }
      
      // Add date range filter if both start and end dates are provided
      if (currentFilters.startDate && currentFilters.endDate) {
        queryParams.append('start_date', currentFilters.startDate);
        queryParams.append('end_date', currentFilters.endDate);
      }

      // Always sort by created_at desc (matches backend default) and allow future extension
      const sortItem = (sortModel && sortModel[0]) || { field: 'created_at', sort: 'desc' };
      if (sortItem?.field) {
        queryParams.append('sort_field', sortItem.field);
        queryParams.append('sort_order', sortItem.sort || 'desc');
      }
      
      const apiUrl = `/api/shopboard-requests/vendor?${queryParams.toString()}`;
      
      const requestData = await get(apiUrl);
      
      // Handle the API response format: { success: true, data: [...], totalCount: number }
      if (requestData.success && requestData.data && Array.isArray(requestData.data)) {
        setRowsState({
          rows: requestData.data,
          rowCount: requestData.totalCount || requestData.data.length,
        });
      } else if (requestData.requests && Array.isArray(requestData.requests)) {
        // Fallback for different response format
        setRowsState({
          rows: requestData.requests,
          rowCount: requestData.totalCount || requestData.requests.length,
        });
      } else if (Array.isArray(requestData)) {
        // Fallback for direct array response
        setRowsState({
          rows: requestData,
          rowCount: requestData.length,
        });
      } else {
        setRowsState({
          rows: [],
          rowCount: 0,
        });
      }
      
    } catch (loadError) {
      setError(loadError.message || 'Failed to load requests');
      toast.error('Failed to load requests', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      console.error('Error loading requests:', loadError);
    } finally {
      setIsLoading(false);
    }
  }, [paginationModel, filters, sortModel, get, canRead]);

  // Fetch full request by ID. includeFiles: 'details' | 'invoice' loads only those file sets (vendor page has no manual approval).
  const fetchFullRequest = React.useCallback(async (id, includeFiles) => {
    const url = includeFiles ? `/api/shopboard-requests/${id}?includeFiles=${encodeURIComponent(includeFiles)}` : `/api/shopboard-requests/${id}`;
    const res = await get(url);
    if (res?.success && res?.data) return res.data;
    throw new Error('Failed to load request details');
  }, [get]);

  // Load data when component mounts, pagination changes, or filters change
  React.useEffect(() => {
    if (canRead) {
      loadRequests();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paginationModel, filters, sortModel]); // Watch pagination, filters, and sorting

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
      setSelectedInvoiceViewerRequest(full);
      setInvoiceViewerModalOpen(true);
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

  const handleShareInvoice = React.useCallback(async (requestData) => {
    setLoadingRequestDetails(true);
    try {
      const full = await fetchFullRequest(requestData.id, 'invoice');
      const { invoiceFiles, dealerAckFiles, sitePhotosPerItem } = loadInvoiceExistingFilesFromRequest(full);
      setSelectedInvoiceRequest(full);
      setInvoiceNumber(full.invoice_number || '');
      setExistingInvoiceFiles(invoiceFiles);
      setExistingDealerAcknowledgmentFiles(dealerAckFiles);
      setExistingSitePhotosPerItem(sitePhotosPerItem);
      setInvoiceFile(null);
      setDealerAcknowledgmentFile(null);
      setSitePhotosPerItem({});
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
  }, [fetchFullRequest]);

  const handleEditInvoiceAfterRejection = React.useCallback(async (requestData) => {
    setLoadingRequestDetails(true);
    try {
      const full = await fetchFullRequest(requestData.id, 'invoice');
      const { invoiceFiles, dealerAckFiles, sitePhotosPerItem } = loadInvoiceExistingFilesFromRequest(full);
      setSelectedInvoiceRequest(full);
      setInvoiceNumber(full.invoice_number || '');
      setExistingInvoiceFiles(invoiceFiles);
      setExistingDealerAcknowledgmentFiles(dealerAckFiles);
      setExistingSitePhotosPerItem(sitePhotosPerItem);
      setInvoiceFile(null);
      setDealerAcknowledgmentFile(null);
      setSitePhotosPerItem({});
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
  }, [fetchFullRequest]);

  // Handle viewing rejection comments for invoice rejected status
  const handleViewRejectionComments = React.useCallback(async (requestData) => {
    setSelectedRejectionRequest(requestData);
    setRejectionCommentsModalOpen(true);
    setLoadingRejectionComments(true);
    
    try {
      // Fetch comments for this request, filtered by vendor_rejection type
      const response = await get(`/api/shopboard-requests/${requestData.id}`);
      if (response.success && response.data && response.data.comments) {
        // Filter comments by vendor_rejection type
        const vendorRejectionComments = response.data.comments.filter(
          comment => comment.comment_type === 'vendor_rejection'
        );
        setRejectionComments(vendorRejectionComments);
      } else {
        setRejectionComments([]);
      }
    } catch (error) {
      console.error('Error fetching rejection comments:', error);
      toast.error('Failed to load rejection comments', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      setRejectionComments([]);
    } finally {
      setLoadingRejectionComments(false);
    }
  }, [get]);

  // Handle viewing request rejection comments (status = 'rejected')
  const handleViewRequestRejectionComments = React.useCallback(async (requestData) => {
    setSelectedRequestRejection(requestData);
    setRequestRejectionCommentsModalOpen(true);
    setLoadingRequestRejectionComments(true);
    try {
      const response = await get(`/api/comments/rejection/${requestData.id}`);
      if (response.success && response.data) {
        setRequestRejectionCommentsList(response.data);
      } else {
        setRequestRejectionCommentsList([]);
      }
    } catch (error) {
      console.error('Error fetching request rejection comments:', error);
      toast.error('Failed to load rejection comments', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      setRequestRejectionCommentsList([]);
    } finally {
      setLoadingRequestRejectionComments(false);
    }
  }, [get]);

  // Confirm invoice upload function
  const confirmInvoiceUpload = React.useCallback(async () => {
    if (!selectedInvoiceRequest) return;
    
    // Validate invoice number is provided
    if (!invoiceNumber || invoiceNumber.trim() === '') {
      toast.error('Invoice number is required', {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      return;
    }
    
    // Validate invoice file is provided (new file or existing files)
    const hasInvoiceFile = invoiceFile || (existingInvoiceFiles && existingInvoiceFiles.length > 0);
    if (!hasInvoiceFile) {
      toast.error('Invoice file is required', {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      return;
    }
    
    // Validate dealer acknowledgment form is provided (new file or existing files)
    const hasDealerAcknowledgment = dealerAcknowledgmentFile || (existingDealerAcknowledgmentFiles && existingDealerAcknowledgmentFiles.length > 0);
    if (!hasDealerAcknowledgment) {
      toast.error('Dealer acknowledgment form is required', {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      return;
    }
    
    // Validate status before proceeding
    // Check mapped status (approval) or raw DB statuses (CEO/manual/director approvals)
    const currentStatus = selectedInvoiceRequest.status;
    const isResubmission = currentStatus === SHOPBOARD_REQUEST_STATUS.INVOICE_REJECTED;
    const isInitialUpload = currentStatus === VENDOR_APPROVAL_STATUS ||
                           currentStatus === 'ceo_approval' ||
                           currentStatus === 'manual_approval' ||
                           currentStatus === SHOPBOARD_REQUEST_STATUS.DIRECTOR_APPROVAL ||
                           currentStatus === SHOPBOARD_REQUEST_STATUS.ADDITIONAL_DIRECTOR_APPROVAL;
    
    // Only allow upload if status is either invoice_rejected (resubmission) or approval (initial upload)
    if (!isResubmission && !isInitialUpload) {
      toast.error(`Cannot upload invoice. Request must be in 'Approved for work' or 'Invoice Rejected' status. Current status: ${getVendorStatusDisplayName(selectedInvoiceRequest.status)}`, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      
      // Create FormData for file uploads
      const formData = new FormData();

      // Don't send status field - let backend automatically set status to invoice_sent when invoice files are uploaded
      // The backend will handle status transition validation and set the status appropriately
      // EXCEPTION: For initial upload or resubmission, explicitly set status to ensure it transitions correctly
      // This covers cases where files might not be re-uploaded during resubmission
      if (isInitialUpload || isResubmission) {
        formData.append('status', SHOPBOARD_REQUEST_STATUS.INVOICE_SENT);
      }
      
      formData.append('updated_by', user.id);
      
      // Add invoice number if provided
      if (invoiceNumber && invoiceNumber.trim() !== '') {
        formData.append('invoice_number', invoiceNumber.trim());
      }
      
      // Add flag to indicate if this is a resubmission
      if (isResubmission) {
        formData.append('is_resubmission', 'true');
      }


      // Get existing invoice data or create empty structure
      let existingInvoiceData = {};
      if (selectedInvoiceRequest.invoice) {
        try {
          existingInvoiceData = typeof selectedInvoiceRequest.invoice === 'string' 
            ? JSON.parse(selectedInvoiceRequest.invoice) 
            : selectedInvoiceRequest.invoice;
        } catch (error) {
          console.error('Error parsing existing invoice data:', error);
          existingInvoiceData = {};
        }
      }

      // Add existing invoice data
      formData.append('existing_invoice', JSON.stringify(existingInvoiceData));

      // Add invoice files
      if (invoiceFile) {
        formData.append('invoice_file', invoiceFile);
      }

      // Add dealer acknowledgment file
      if (dealerAcknowledgmentFile) {
        formData.append('dealer_acknowledgment_file', dealerAcknowledgmentFile);
      }

      // Add per-item site photos files as site_photos_files[<item_id>][]
      Object.entries(sitePhotosPerItem).forEach(([itemId, files]) => {
        (files || []).forEach((file) => {
          formData.append(`site_photos_files[${itemId}][]`, file);
        });
      });

      // Make API call with FormData
      const response = await fetch(`${BASE_URL}/api/shopboard-requests/${selectedInvoiceRequest.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        // Try to parse error message from response
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (parseError) {
          // If JSON parsing fails, use default message
          console.error('Error parsing error response:', parseError);
        }
        throw new Error(errorMessage);
      }

      await response.json();

      toast.success(isResubmission ? 'Invoice resubmitted successfully!' : 'Invoice sent successfully!', {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      
      loadRequests();
    } catch (invoiceError) {
      // Show the error message from backend (which includes invoice number validation error)
      const errorMessage = invoiceError.message || 'Failed to send invoice';
      toast.error(errorMessage, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } finally {
      setIsLoading(false);
      setInvoiceModalOpen(false);
      setSelectedInvoiceRequest(null);
      setInvoiceFile(null);
      setDealerAcknowledgmentFile(null);
      setSitePhotosPerItem({});
      setExistingInvoiceFiles([]);
      setExistingDealerAcknowledgmentFiles([]);
      setExistingSitePhotosPerItem({});
      setInvoiceLoading(false);
      setInvoiceNumber('');
    }
  }, [selectedInvoiceRequest, invoiceFile, dealerAcknowledgmentFile, sitePhotosPerItem, invoiceNumber, user.id, token, loadRequests]);

  const handleInvoiceSubmit = React.useCallback(() => {
    if (!selectedInvoiceRequest) return;
    
    setInvoiceLoading(true);
    // Keep modal open so user sees the loading state during upload
    confirmInvoiceUpload();
  }, [selectedInvoiceRequest, confirmInvoiceUpload]);

  const handleEdit = React.useCallback(async (requestData) => {
    if (!canUpdate) return;
    setLoadingRequestDetails(true);
    try {
      // Edit modal: includeFiles=edit (site_photo, old_board_photo, vendor_quotation only; no survey_form)
      const full = await fetchFullRequest(requestData.id, 'edit');
      setEditingRequest(full);

      const processedItems = (full.requestItems || []).map(item => {
        const widthFt = parseFloat(item.width) || 0;
        const heightFt = parseFloat(item.height) || 0;
        const areaSqft = widthFt * heightFt;
        const price = parseFloat(item.price) || 0;
        const price_per_sqft = item.price_per_square_foot
          ? parseFloat(item.price_per_square_foot).toFixed(2)
          : (areaSqft > 0 ? (price / areaSqft).toFixed(2) : '');
        return {
          id: item.id,
          temp_id: item.temp_id,
          request_type_id: item.request_type_id,
          width: item.width,
          height: item.height,
          price: item.price,
          price_per_sqft: price_per_sqft,
          quantity: item.quantity != null && item.quantity !== '' ? String(item.quantity) : '1',
        };
      });

      const dealerIdToStore = full.dealer?.code || full.dealer_id;
      setEditFormData({
        dealer_id: dealerIdToStore,
        request_items: processedItems,
        warranty_status_id: full.warranty_status_id,
        reason_for_replacement: full.reason_for_replacement || '',
        last_installation_date: full.last_installation_date
          ? (() => {
              const date = new Date(full.last_installation_date);
              return isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
            })()
          : '',
        total_cost: full.total_cost || '',
      });
      setExistingSitePhotos(full.site_photo_attachement || []);
      setExistingOldBoardPhotos(full.old_board_photo_attachment || []);
      setSitePhotos([]);
      setOldBoardPhotos([]);
      setEditModalOpen(true);
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
  }, [canUpdate, fetchFullRequest]);

  const handleApprove = React.useCallback(
    async (requestData) => {
      if (!canApprove) return;

      let full;
      try {
        // Vendor list rows omit file attachments; load persisted files from API before validating
        full = await fetchFullRequest(requestData.id, 'edit');
      } catch {
        toast.error('Failed to load request for validation. Please try again.', {
          position: 'top-right',
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
        return;
      }

      const validationErrors = [];

      if (!full.warranty_status_id) {
        validationErrors.push('Warranty Status is required');
      }

      if (!full.reason_for_replacement || !String(full.reason_for_replacement).trim()) {
        validationErrors.push('Reason for Replacement is required');
      }

      if (!full.last_installation_date) {
        validationErrors.push('Last Installation Date is required');
      }

      if (!full.requestItems || full.requestItems.length === 0) {
        validationErrors.push('At least one request item is required');
      }

      const sitePhotos = full.site_photo_attachement;
      const oldBoardPhotos = full.old_board_photo_attachment;
      if (!Array.isArray(sitePhotos) || sitePhotos.length === 0) {
        validationErrors.push('At least one site photo is required (upload in Add Pricing before submitting quotation)');
      }
      if (!Array.isArray(oldBoardPhotos) || oldBoardPhotos.length === 0) {
        validationErrors.push('At least one old board photo is required (upload in Add Pricing before submitting quotation)');
      }

      if (validationErrors.length > 0) {
        toast.error(
          <div>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
              Please complete the following before submitting quotation:
            </Typography>
            <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>,
          {
            position: 'top-right',
            autoClose: 8000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          }
        );
        return;
      }

      setRequestToAction(requestData);
      setApproveDialogOpen(true);
    },
    [canApprove, fetchFullRequest]
  );

  const handleReject = React.useCallback((requestData) => {
    if (!canReject) return;
    setRequestToAction(requestData);
    setRejectDialogOpen(true);
  }, [canReject]);

  const handleViewComments = React.useCallback((requestData) => {
    if (!canRead) return;
    
    setRequestToAction(requestData);
    setCommentsDialogOpen(true);
    fetchRequestComments(requestData.id);
  }, [canRead]);

  const handleViewHistory = React.useCallback((requestData) => {
    if (!canRead) return;
    
    setRequestToAction(requestData);
    setHistoryDialogOpen(true);
    fetchRequestHistory(requestData.id);
  }, [canRead]);

  const handlePrintWorkOrder = React.useCallback((requestData) => {
    if (!canRead) return;
    WorkOrderPDFGenerator.generate(requestData);
  }, [canRead]);

  // Fetch comments for a specific request
  const fetchRequestComments = React.useCallback(async (requestId) => {
    setLoadingComments(true);
    try {
      const response = await get(`/api/shopboard-requests/${requestId}`);
      if (response.success && response.data && response.data.comments) {
        setRequestComments(response.data.comments);
      } else {
        setRequestComments([]);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast.error('Failed to load comments', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      setRequestComments([]);
    } finally {
      setLoadingComments(false);
    }
  }, [get]);

  // Fetch history for a specific request (vendor-specific API - already filtered for item_changes)
  const fetchRequestHistory = React.useCallback(async (requestId) => {
    setLoadingHistory(true);
    try {
      // Use vendor-specific API endpoint that filters item_changes on backend
      const response = await get(`/api/shopboard-logs/vendor/request/${requestId}`);
      if (response.success && response.data) {
        const sorted = [...response.data].sort((a, b) => {
          // CURRENT records always come first
          if (a.action === 'CURRENT' && b.action !== 'CURRENT') return -1;
          if (b.action === 'CURRENT' && a.action !== 'CURRENT') return 1;
          
          // For non-CURRENT records, sort by date (latest first)
          const da = a.changed_at ? new Date(a.changed_at).getTime() : 0;
          const db = b.changed_at ? new Date(b.changed_at).getTime() : 0;
          return db - da;
        });
        
        // Backend already filters for item_changes, so no need to filter again
        // Fetch dealer names for logs that have dealer_id
        const logsWithDealerNames = await Promise.all(
          sorted.map(async (log) => {
            if (log.main_changes?.dealer_id && !log.main_changes?.dealer_name) {
              try {
                // Fetch dealer by code
                const dealerResponse = await get(`/api/dealers/code/${log.main_changes.dealer_id}`);
                if (dealerResponse.success && dealerResponse.data) {
                  // Add dealer_name and dealer_code to main_changes
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

  // Confirm approve / resubmit quotation → quotation sent (same old flow)
  const confirmApprove = async () => {
    if (!requestToAction) return;
    
    setIsLoading(true);
    setApproveDialogOpen(false);

    const isResubmit =
      requestToAction.status === SHOPBOARD_REQUEST_STATUS.VENDOR_REJECTED ||
      requestToAction.status === 'vendor_rejected';
    
    try {
      await patch(`/api/shopboard-requests/${requestToAction.id}`, {
        status: SHOPBOARD_REQUEST_STATUS.QUOTATION_SENT,
        updated_by: user.id
      });

      toast.success(
        isResubmit
          ? `Request #${requestToAction.id} resubmitted successfully!`
          : `Request #${requestToAction.id} quotation sent successfully!`,
        {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        }
      );
      
      loadRequests();
    } catch (approveError) {
      toast.error(`Failed to approve request: ${approveError.message}`, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } finally {
      setIsLoading(false);
      setRequestToAction(null);
    }
  };

  // Confirm reject function
  const confirmReject = async () => {
    if (!requestToAction) return;
    
    setIsLoading(true);
    setRejectDialogOpen(false);
    
    try {
      const updateData = {
        status: SHOPBOARD_REQUEST_STATUS.RFQ_NOT_ACCEPTED,
        assigned_vm: 0,
        updated_by: user.id
      };

      // Add comment if provided
      if (rejectionComment && rejectionComment.trim()) {
        updateData.comment = rejectionComment.trim();
        updateData.comment_type = 'vendor';
      }

      const response = await patch(`/api/shopboard-requests/${requestToAction.id}`, updateData);

      toast.success(`Request #${requestToAction.id} rejected successfully!`, {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      
      loadRequests();
    } catch (rejectError) {
      toast.error(`Failed to reject request: ${rejectError.message}`, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } finally {
      setIsLoading(false);
      setRequestToAction(null);
      setRejectionComment(''); // Clear comment after rejection
    }
  };

  // Cancel functions
  const cancelApprove = () => {
    setApproveDialogOpen(false);
    setRequestToAction(null);
  };

  const cancelReject = () => {
    setRejectDialogOpen(false);
    setRequestToAction(null);
    setRejectionComment(''); // Clear comment when canceling
  };

  const cancelComments = () => {
    setCommentsDialogOpen(false);
    setRequestToAction(null);
    setRequestComments([]);
  };

  const cancelHistory = () => {
    setHistoryDialogOpen(false);
    setRequestToAction(null);
    setRequestHistory([]);
  };

  // Load vendors and dealers when history opens to resolve names in logs
  React.useEffect(() => {
    const loadForHistory = async () => {
      try {
        // Fetch vendors and dealers in parallel (lightweight)
        const [vendorsRes, dealersRes, warrantiesRes] = await Promise.all([
          get('/api/vendors'),
          get('/api/dealers'),
          get('/api/warranty-statuses')
        ]);
        if (vendorsRes?.success && Array.isArray(vendorsRes.data)) setVendors(vendorsRes.data);
        if (dealersRes?.success && Array.isArray(dealersRes.data)) setDealers(dealersRes.data);
        if (warrantiesRes?.success && Array.isArray(warrantiesRes.data)) setWarrantyStatusesHistory(warrantiesRes.data);
      } catch (e) {
        // silent fail; names will fallback
      }
    };
    if (historyDialogOpen) {
      loadForHistory();
    }
  }, [historyDialogOpen, get]);

  const resolveDealerName = React.useCallback((dealerId) => {
    if (!dealerId) return null;
    const d = dealers.find(x => String(x.id) === String(dealerId) || String(x.code) === String(dealerId));
    return d ? `${d.name} (${d.code})` : dealerId;
  }, [dealers]);

  const resolveVendorName = React.useCallback((vendorId) => {
    if (!vendorId) return null;
    const v = vendors.find(x => x.id === vendorId);
    return v?.name || null;
  }, [vendors]);

  const resolveWarrantyStatusName = React.useCallback((id) => {
    if (!id) return null;
    const ws = warrantyStatusesHistory.find(x => x.id === id);
    return ws?.name || null;
  }, [warrantyStatusesHistory]);

  // Generic renderer for main_changes entries
  const renderMainChanges = (log, prevLog) => {
    const mc = log.main_changes || {};
    const entries = Object.entries(mc);
    if (entries.length === 0) return null;
    return (
      <Box sx={{ mb: 2 }}>
        {entries.map(([key, value], idx) => {
          if (key === 'assigned_vm') return null; // hidden
          if (value === null || value === undefined) return null;
          if (Array.isArray(value) && value.length === 0) return null;

          // Attachments arrays
          if (key === 'survey_form_attachments' || key === 'old_board_photo_attachment' || key === 'site_photo_attachement') {
            const title = key === 'survey_form_attachments' ? 'Survey Forms' : (key === 'old_board_photo_attachment' ? 'Old Board Photos' : 'Site Photos');
            if (!Array.isArray(value) || value.length === 0) return null;
            return (
              <Box key={`${key}-${idx}`} sx={{ mb: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>{title}:</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {value.map((file, i) => {
                    const { url: u, fileName: fn } = getFileUrlAndName(file, i, `File ${i + 1}`);
                    const openUrl = u.startsWith('data:') || u.startsWith('http') ? u : (u.startsWith('/') ? `${BASE_URL}${u}` : `${BASE_URL}/${u}`);
                    return (
                      <Chip key={`${key}-${i}`} label={fn} size="small" onClick={() => openFileInNewTab(openUrl)} sx={{ cursor: 'pointer' }} />
                    );
                  })}
                </Box>
              </Box>
            );
          }

          // Special mappings
          if (key === 'vendor_code') {
            // Use vendor_name if already fetched and available in main_changes
            const vendorDisplay = mc.vendor_name || resolveVendorName(value) || value;
            return (
              <Typography key={`${key}-${idx}`} variant="body2" sx={{ color: '#333', mb: 0.5 }}>
                Vendor: {vendorDisplay}
              </Typography>
            );
          }
          if (key === 'vendor_name') {
            return null; // Skip this field as vendor_code already shows the name
          }
          if (key === 'dealer_id') {
            // Use dealer_name if already fetched and available in main_changes
            const dealerDisplay = mc.dealer_name || resolveDealerName(value) || value;
            return (
              <Typography key={`${key}-${idx}`} variant="body2" sx={{ color: '#333', mb: 0.5 }}>
                Dealer: {dealerDisplay}
              </Typography>
            );
          }
          if (key === 'dealer_name') {
            return null; // Skip this field as dealer_id already shows the name
          }
          if (key === 'warranty_status_id') {
            return (
              <Typography key={`${key}-${idx}`} variant="body2" sx={{ color: '#333', mb: 0.5 }}>
                Warranty Status: {resolveWarrantyStatusName(value) || value}
              </Typography>
            );
          }
          if (key === 'warranty_status_name') {
            return null; // Skip this field as it's redundant
          }
          if (key === 'last_installation_date') {
            return (
              <Typography key={`${key}-${idx}`} variant="body2" sx={{ color: '#333', mb: 0.5 }}>
                Last Installation: {new Date(value).toLocaleDateString()}
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
          if (key === 'dealer_type') {
            return (
              <Typography key={`${key}-${idx}`} variant="body2" sx={{ color: '#333', mb: 0.5 }}>
                Dealer Type: {value === 'new' ? 'New' : 'Old'}
              </Typography>
            );
          }
          if (key === 'reason_for_replacement') {
            return (
              <Typography key={`${key}-${idx}`} variant="body2" sx={{ color: '#333', mb: 0.5 }}>
                Reason: {String(value)}
              </Typography>
            );
          }
          // Display approvals array
          if (key === 'approvals') {
            if (!Array.isArray(value) || value.length === 0) return null;
            return (
              <Box key={`${key}-${idx}`} sx={{ mb: 1 }}>
                {value.map((message, msgIndex) => (
                  <Box key={`approval-${msgIndex}`} sx={{ mb: 1 }}>
                    <Typography variant="body2" sx={{ 
                      color: '#2e7d32', 
                      fontWeight: 'bold',
                      backgroundColor: '#e8f5e8',
                      p: 1,
                      borderRadius: 1,
                      border: '1px solid #c8e6c9',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1
                    }}>
                      ✅ {message}
                    </Typography>
                  </Box>
                ))}
              </Box>
            );
          }
          // Display approval_date
          if (key === 'approval_date') {
            return (
              <Typography key={`${key}-${idx}`} variant="body2" sx={{ 
                color: '#2e7d32',
                fontWeight: 'bold',
                mb: 0.5
              }}>
                Approved on: {new Date(value).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                }) + ' at ' + new Date(value).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                })}
              </Typography>
            );
          }
          if (key === 'approvals') {
            return (
              <Box key={`${key}-${idx}`} sx={{ mb: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>Approvals:</Typography>
                {value.map((message, msgIndex) => (
                  <Typography key={`approval-${msgIndex}`} variant="body2" sx={{ color: '#1976d2', mb: 0.5, fontWeight: 'bold' }}>
                    {message}
                  </Typography>
                ))}
              </Box>
            );
          }
          // Fallback for any other simple field
          return (
            <Typography key={`${key}-${idx}`} variant="body2" sx={{ color: '#333', mb: 0.5 }}>
              {key}: {String(value)}
            </Typography>
          );
        })}
      </Box>
    );
  };

  // History diff helpers: show only changed fields for CURRENT vs previous log
  const valuesEqual = (a, b) => {
    if (Array.isArray(a) || Array.isArray(b)) {
      try {
        return JSON.stringify(a || []) === JSON.stringify(b || []);
      } catch (e) {
        return false;
      }
    }
    // Normalize dates/strings
    if (a instanceof Date) a = a.toISOString();
    if (b instanceof Date) b = b.toISOString();
    return a === b;
  };

  const shouldShowField = (log, prevLog, key) => {
    if (!log || !log.main_changes) return false;
    if (log.action !== 'CURRENT' || !prevLog || !prevLog.main_changes) return true;
    return !valuesEqual(log.main_changes[key], prevLog.main_changes[key]);
  };

  // Edit form handlers
  const handleEditFormChange = (field, value) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleEditSubmit = async () => {
    if (!editingRequest) return;

    // Validation
    const validationErrors = [];

    // Validate Warranty Status
    if (!editFormData.warranty_status_id) {
      validationErrors.push('Warranty Status is required');
    }

    // Validate Reason for Replacement
    if (!editFormData.reason_for_replacement || !String(editFormData.reason_for_replacement).trim()) {
      validationErrors.push('Reason for Replacement is required');
    }

    // Validate Last Installation Date
    if (!editFormData.last_installation_date) {
      validationErrors.push('Last Installation Date is required');
    }

    // Validate Request Items
    const items = editFormData.request_items || [];
    if (items.length === 0) {
      validationErrors.push('At least one request item must be added');
    } else {
      items.forEach((item, index) => {
        if (!item.request_type_id) {
          validationErrors.push(`Item ${index + 1}: Request Type is required`);
        } else {
          // Find request type to check rules
          const selectedRequestType = requestTypes.find(rt => rt.id === item.request_type_id);
          const isFees = selectedRequestType?.request_type === 'fees';
          
          if (isFees) {
            if (!item.price || parseFloat(item.price) <= 0) {
              validationErrors.push(`Item ${index + 1}: Price must be greater than 0`);
            }
          } else {
            // For manual and fixed types, width and height are required
            if (!item.width || parseFloat(item.width) <= 0) {
              validationErrors.push(`Item ${index + 1}: Width must be greater than 0`);
            }
            if (!item.height || parseFloat(item.height) <= 0) {
              validationErrors.push(`Item ${index + 1}: Height must be greater than 0`);
            }
            // For manual types, price_per_sqft is also required (though it might be set)
            if (selectedRequestType?.request_type === 'manual') {
              if (!item.price_per_sqft || parseFloat(item.price_per_sqft) <= 0) {
                validationErrors.push(`Item ${index + 1}: Price per sqft must be greater than 0`);
              }
            }
          }
        }
      });
    }

    if (validationErrors.length > 0) {
      validationErrors.forEach(error => {
        toast.error(error, {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      });
      return;
    }
    
    setIsLoading(true);
    setEditModalOpen(false);
    
    try {
      // Create FormData for file uploads
      const formData = new FormData();

      // Add form data
      formData.append('dealer_id', editFormData.dealer_id);
      formData.append('request_items', JSON.stringify(editFormData.request_items || []));
      formData.append('warranty_status_id', editFormData.warranty_status_id ?? '');
      formData.append('reason_for_replacement', editFormData.reason_for_replacement || '');
      formData.append('last_installation_date', editFormData.last_installation_date || '');
      formData.append('total_cost', editFormData.total_cost || '');
      formData.append('updated_by', user.id);

      // Validate date field before sending
      if (editFormData.last_installation_date && String(editFormData.last_installation_date).trim() !== '') {
        const date = new Date(editFormData.last_installation_date);
        if (isNaN(date.getTime())) {
          toast.error('Invalid date format for Last Installation Date', {
            position: "top-right",
            autoClose: 5000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          });
          setIsLoading(false);
          setEditModalOpen(true); // Reopen modal to allow correction
          return;
        }
      }

      // Send existing files that weren't deleted (compact: fileName + mimeType only to avoid huge payload)
      const compactExisting = (arr) => arr.map(f => typeof f === 'object' && f && (f.url != null || f.fileName != null) ? { fileName: f.fileName || 'file', mimeType: f.mimeType } : f);
      formData.append('existing_site_photos', JSON.stringify(compactExisting(existingSitePhotos)));
      formData.append('existing_old_board_photos', JSON.stringify(compactExisting(existingOldBoardPhotos)));

      // Add new uploaded files to FormData (multiple files: same field name per file)
      sitePhotos.forEach((file) => {
        formData.append('site_photo_attachement', file);
      });
      oldBoardPhotos.forEach((file) => {
        formData.append('old_board_photo_attachment', file);
      });

      // Make API call with FormData
      const response = await fetch(`${BASE_URL}/api/shopboard-requests/${editingRequest.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      await response.json();

      toast.success(`Request #${editingRequest.id} updated successfully!`, {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      
      loadRequests();
    } catch (editError) {
      toast.error(`Failed to update request: ${editError.message}`, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } finally {
      setIsLoading(false);
      setEditingRequest(null);
      setEditFormData({});
      setSitePhotos([]);
      setOldBoardPhotos([]);
      setExistingSitePhotos([]);
      setExistingOldBoardPhotos([]);
    }
  };

  const cancelEdit = () => {
    setEditModalOpen(false);
    setEditingRequest(null);
    setEditFormData({});
    setSitePhotos([]);
    setOldBoardPhotos([]);
    setExistingSitePhotos([]);
    setExistingOldBoardPhotos([]);
  };

  const handleRefresh = React.useCallback(() => {
    if (!isLoading && canRead) {
      loadRequests();
    }
  }, [isLoading, loadRequests, canRead]);

  // Handle clear filters
  const handleClearFilters = () => {
    setSelectedSalesHead(null);
    setSelectedDealer(null);
    setSelectedStatus(null);
    setStartDate(null);
    setEndDate(null);
  };
  
  // Date range handlers
  const handleDateRangeClick = (event) => {
    setDateRangeAnchor(event.currentTarget);
  };

  const handleDateRangeClose = () => {
    setDateRangeAnchor(null);
  };

  const dateRangeOpen = Boolean(dateRangeAnchor);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleRowClick = React.useCallback(
    ({ row }) => {
      handleView(row);
    },
    [handleView],
  );


  // Column definitions for vendor shopboard requests (showing same fields as Area Head Requests)
  const columns = React.useMemo(
    () => [
      { 
        field: 'id', 
        headerName: 'Request ID',
        width: 100,
      },
      {
        field: 'dealer',
        headerName: 'Dealer',
        width: 200,
        renderCell: (params) => {
          const dealer = params.value;
          return dealer ? dealer.name : 'N/A';
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
      // {
      //   field: 'requestItems',
      //   headerName: 'Request Types',
      //   width: 200,
      //   renderCell: (params) => {
      //     const requestItems = params.value;
      //     if (!requestItems || !Array.isArray(requestItems)) return 'N/A';
      //     return requestItems.map(item => {
      //       const typeName = item.requestType ? item.requestType.name : 'Unknown';
      //       const dimensions = item.width && item.height ? ` (${item.width}x${item.height})` : '';
      //       return `${typeName}${dimensions}`;
      //     }).join(', ');
      //   },
      // },
      {
        field: 'status',
        headerName: 'Status',
        width: 120,
        renderCell: (params) => {
          const status = params.value;
          // Use vendor-specific display name and color
          const displayStatus = getVendorStatusDisplayName(status);
          const statusColor = getVendorStatusColor(status);
          
          return (
            <Chip 
              label={displayStatus} 
              variant="filled" 
              size="small"
              color={statusColor}
            />
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
          const isRfqStatus = row.status === SHOPBOARD_REQUEST_STATUS.RFQ;
          // Area Head chose "Allow resubmit" — vendor can edit & send quotation again
          const isVendorRejected =
            row.status === SHOPBOARD_REQUEST_STATUS.VENDOR_REJECTED ||
            row.status === 'vendor_rejected';
          const canVendorEditQuotation = isRfqStatus || isVendorRejected;
          
          const actions = [];
          
          // Show view action if user has read permission
          // For approval status (CEO/manual/director approvals map to 'approval' for vendors)
          if (canRead) {
            const isWorkOrder = row.status === VENDOR_APPROVAL_STATUS;
            actions.push(
              <GridActionsCellItem
                key="view"
                icon={<Tooltip title={isWorkOrder ? "Work Order" : "View Details"}>
                  {isWorkOrder ? <WorkOrderIcon /> : <ViewIcon />}
                </Tooltip>}
                label={isWorkOrder ? "Work Order" : "View Details"}
                onClick={() => handleViewDetails(row)}
                color="primary"
              />
            );
          }
          
          // Show edit for Rfq and vendor_rejected (allow resubmit)
          if (canUpdate && canVendorEditQuotation) {
            actions.push(
              <GridActionsCellItem
                key="edit"
                icon={<Tooltip title={isVendorRejected ? 'Edit & Resubmit' : 'Edit'}><EditIcon /></Tooltip>}
                label={isVendorRejected ? 'Edit & Resubmit' : 'Add Pricing'}
                onClick={() => handleEdit(row)}
                color="info"
              />
            );
          }
          
          // Show view comments for Rfq / vendor_rejected
          if (canVendorEditQuotation && canRead) {
            actions.push(
              <GridActionsCellItem
                key="viewComments"
                icon={<Tooltip title="View Comments"><CommentIcon /></Tooltip>}
                label="View Area Head Comments"
                onClick={() => handleViewComments(row)}
                color="info"
              />
            );
          }
          
          // Show history action for all requests
          if (canRead) {
            actions.push(
              <GridActionsCellItem
                key="viewHistory"
                icon={<Tooltip title="View History"><HistoryIcon /></Tooltip>}
                label="View History"
                onClick={() => handleViewHistory(row)}
                color="default"
              />
            );
          }
          
          // Submit quotation for Rfq and after vendor_rejected resubmit
          if (canVendorEditQuotation) {
            if (canApprove) {
              actions.push(
                <GridActionsCellItem
                  key="approve"
                  icon={<Tooltip title="Send Quotation"><ApproveIcon /></Tooltip>}
                  label="Submit Quotation"
                  onClick={() => handleApprove(row)}
                  color="success"
                />
              );
            }
          }
          
          // Share invoice / work order when status is mapped 'approval' (approved for work)
          if (row.status === VENDOR_APPROVAL_STATUS && canRead) {
            actions.push(
              <GridActionsCellItem
                key="shareInvoice"
                icon={<Tooltip title="Share Invoice"><InvoiceIcon /></Tooltip>}
                label="Share Invoice"
                onClick={() => handleShareInvoice(row)}
                color="primary"
              />
            );
            // Show print work order button for approval status
            actions.push(
              <GridActionsCellItem
                key="printWorkOrder"
                icon={<Tooltip title="Print Work Order"><PrintIcon /></Tooltip>}
                label="Print Work Order"
                onClick={() => handlePrintWorkOrder(row)}
                color="secondary"
              />
            );
          }
          
          // Show rejection comments and edit invoice button for invoice rejected status
          if (row.status === SHOPBOARD_REQUEST_STATUS.INVOICE_REJECTED && canRead) {
            actions.push(
              <GridActionsCellItem
                key="viewRejectionComments"
                icon={<Tooltip title="View Rejection Comments"><CommentIcon sx={{ color: '#d32f2f' }} /></Tooltip>}
                label="View Rejection Comments"
                onClick={() => handleViewRejectionComments(row)}
                color="error"
              />
            );
            actions.push(
              <GridActionsCellItem
                key="editInvoice"
                icon={<Tooltip title="Edit Invoice"><InvoiceIcon sx={{ color: '#1976d2' }} /></Tooltip>}
                label="Edit Invoice"
                onClick={() => handleEditInvoiceAfterRejection(row)}
                color="primary"
              />
            );
          }
          
          // Show view rejection comments for rejected / vendor_rejected (allow resubmit)
          if (
            (row.status === SHOPBOARD_REQUEST_STATUS.REJECTED ||
              row.status === SHOPBOARD_REQUEST_STATUS.VENDOR_REJECTED ||
              row.status === 'vendor_rejected') &&
            canRead
          ) {
            actions.push(
              <GridActionsCellItem
                key="viewRequestRejectionComments"
                icon={<Tooltip title="View Rejection Comments"><CommentIcon sx={{ color: '#d32f2f' }} /></Tooltip>}
                label="View Rejection Comments"
                onClick={() => handleViewRequestRejectionComments(row)}
                color="error"
              />
            );
          }

          // Show invoice viewer if invoice files exist (invoice_sent, finance_rejected, Submitted for Payment, or payment successful)
          if (canRead && isVendorInvoiceDocumentsStatus(row.status) && row.has_invoice_files) {
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
          
          return actions;
        },
      },
    ],
    [canApprove, canUpdate, canRead, handleViewDetails, handleEdit, handleApprove, handleViewComments, handleViewHistory, handleShareInvoice, handleViewRejectionComments, handleEditInvoiceAfterRejection, handleViewInvoice, handlePrintWorkOrder, handleViewRequestRejectionComments],
  );

  const pageTitle = 'Vendor Requests';

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

      {/* Vendor Request Filters - Show for everyone */}
      <Box sx={{ 
          mb: 3, 
          p: 3, 
          backgroundColor: '#ffffff', 
          borderRadius: 3, 
          border: '1px solid #e0e7ff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}>
          {/* Filter Header */}
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            mb: 2.5,
            pb: 2,
            borderBottom: '2px solid #f0f4ff'
          }}>
            <Typography variant="h6" sx={{ 
              fontWeight: 600, 
              color: '#1a237e',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              fontSize: '1.1rem'
            }}>
              <FilterListIcon sx={{ fontSize: '1.3rem' }} />
              Filters
            </Typography>
            {(selectedSalesHead || selectedDealer || selectedStatus || startDate || endDate) && (
              <Button
                size="small"
                onClick={handleClearFilters}
                startIcon={<ClearIcon />}
                sx={{ 
                  textTransform: 'none',
                  color: '#666',
                  '&:hover': {
                    backgroundColor: '#f5f5f5'
                  }
                }}
              >
                Clear All
              </Button>
            )}
          </Box>

          {/* Filter Grid */}
          <Grid container spacing={2.5}>
            {/* Sales Head Filter */}
            <Grid item xs={12} sm={6} md={4}>
              <Autocomplete
                size="small"
                options={salesHeads}
                getOptionLabel={(option) => {
                  if (!option) return '';
                  const name = option.name || option.username || '';
                  const username = option.username || '';
                  return username && name !== username ? `${name} (${username})` : name || username || 'Unknown';
                }}
                filterOptions={(options, { inputValue }) => {
                  const searchValue = inputValue.toLowerCase().trim();
                  if (!searchValue) return options;
                  
                  return options.filter(option => {
                    const name = (option.name || '').toLowerCase();
                    const username = (option.username || '').toLowerCase();
                    const email = (option.email || '').toLowerCase();
                    return name.includes(searchValue) || username.includes(searchValue) || email.includes(searchValue);
                  });
                }}
                value={selectedSalesHead}
                onChange={(event, newValue) => {
                  setSelectedSalesHead(newValue);
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Sales Head"
                    placeholder="Select sales head..."
                    variant="outlined"
                    fullWidth
                    disabled={isLoading}
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <>
                          <SalesHeadIcon sx={{ mr: 1, color: 'action.active', fontSize: '1.2rem' }} />
                          {params.InputProps.startAdornment}
                        </>
                      ),
                    }}
                    sx={{
                      minWidth: '280px',
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#fafbff',
                        '&:hover': {
                          backgroundColor: '#f5f7ff',
                        },
                        '&.Mui-focused': {
                          backgroundColor: '#ffffff',
                        }
                      }
                    }}
                  />
                )}
                isOptionEqualToValue={(option, value) => option.id === value?.id}
                noOptionsText="No sales heads found"
                componentsProps={{
                  popper: {
                    style: { zIndex: 1300 },
                    placement: 'bottom-start'
                  }
                }}
              />
            </Grid>

            {/* Dealer Filter */}
            <Grid item xs={12} sm={6} md={4}>
              <Autocomplete
                size="small"
                options={filterDealers}
                getOptionLabel={(option) => {
                  if (!option) return '';
                  const name = option.name || '';
                  const code = option.code || '';
                  return code && name !== code ? `${name} (${code})` : name || code || 'Unknown';
                }}
                filterOptions={(options, { inputValue }) => {
                  const searchValue = inputValue.toLowerCase().trim();
                  if (!searchValue) return options;
                  
                  return options.filter(option => {
                    const name = (option.name || '').toLowerCase();
                    const code = (option.code || '').toLowerCase();
                    const city = (option.city || '').toLowerCase();
                    return name.includes(searchValue) || code.includes(searchValue) || city.includes(searchValue);
                  });
                }}
                value={selectedDealer}
                onChange={(event, newValue) => {
                  setSelectedDealer(newValue);
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Dealer"
                    placeholder={filterDealers.length === 0 ? "No dealers available" : "Select dealer..."}
                    variant="outlined"
                    fullWidth
                    disabled={loadingDealers || filterDealers.length === 0}
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <>
                          <DealerIcon sx={{ mr: 1, color: 'action.active', fontSize: '1.2rem' }} />
                          {params.InputProps.startAdornment}
                        </>
                      ),
                    }}
                    sx={{
                      minWidth: '280px',
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#fafbff',
                        '&:hover': {
                          backgroundColor: '#f5f7ff',
                        },
                        '&.Mui-focused': {
                          backgroundColor: '#ffffff',
                        }
                      }
                    }}
                  />
                )}
                isOptionEqualToValue={(option, value) => option.id === value?.id}
                noOptionsText={filterDealers.length === 0 ? "No dealers have requests assigned to you" : "No dealers found"}
                loading={loadingDealers}
                componentsProps={{
                  popper: {
                    style: { zIndex: 1300 },
                    placement: 'bottom-start'
                  }
                }}
              />
            </Grid>

            {/* Status Filter */}
            <Grid item xs={12} sm={6} md={4}>
              <Autocomplete
                size="small"
                options={statusOptions}
                getOptionLabel={(option) => {
                  if (!option) return '';
                  return option.displayName || option.value || 'Unknown';
                }}
                filterOptions={(options, { inputValue }) => {
                  const searchValue = inputValue.toLowerCase().trim();
                  if (!searchValue) return options;
                  
                  return options.filter(option => {
                    const displayName = (option.displayName || '').toLowerCase();
                    const value = (option.value || '').toLowerCase();
                    return displayName.includes(searchValue) || value.includes(searchValue);
                  });
                }}
                value={selectedStatus}
                onChange={(event, newValue) => {
                  setSelectedStatus(newValue);
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Status"
                    placeholder={statusOptions.length === 0 ? "No statuses available" : "Select status..."}
                    variant="outlined"
                    fullWidth
                    disabled={loadingStatusOptions || statusOptions.length === 0}
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <>
                          <StatusIcon sx={{ mr: 1, color: 'action.active', fontSize: '1.2rem' }} />
                          {params.InputProps.startAdornment}
                        </>
                      ),
                    }}
                    sx={{
                      minWidth: '280px',
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#fafbff',
                        '&:hover': {
                          backgroundColor: '#f5f7ff',
                        },
                        '&.Mui-focused': {
                          backgroundColor: '#ffffff',
                        }
                      }
                    }}
                  />
                )}
                isOptionEqualToValue={(option, value) => option.value === value?.value}
                noOptionsText={statusOptions.length === 0 ? "No statuses available" : "No statuses found"}
                loading={loadingStatusOptions}
                componentsProps={{
                  popper: {
                    style: { zIndex: 1300 },
                    placement: 'bottom-start'
                  }
                }}
              />
            </Grid>

            {/* Date Range Filter */}
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                size="small"
                label="Date Range (Created At)"
                placeholder="Select date range"
                value={startDate && endDate ? `${formatDate(startDate)} - ${formatDate(endDate)}` : startDate ? `${formatDate(startDate)} - ...` : endDate ? `... - ${formatDate(endDate)}` : ''}
                onClick={handleDateRangeClick}
                variant="outlined"
                fullWidth
                disabled={isLoading}
                InputProps={{
                  startAdornment: <DateIcon sx={{ mr: 1, color: 'action.active', fontSize: '1.2rem' }} />,
                  readOnly: true,
                  endAdornment: (startDate || endDate) && (
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setStartDate(null);
                        setEndDate(null);
                      }}
                      sx={{ mr: 0.5 }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  ),
                }}
                sx={{
                  cursor: 'pointer',
                  minWidth: '280px',
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#fafbff',
                    '&:hover': {
                      backgroundColor: '#f5f7ff',
                    },
                    '&.Mui-focused': {
                      backgroundColor: '#ffffff',
                    }
                  }
                }}
                helperText={startDate && endDate ? 'Both dates selected - filter will be applied' : (startDate || endDate) ? 'Select both dates to apply filter' : 'Select start and end date'}
              />
              <Popover
                open={dateRangeOpen}
                anchorEl={dateRangeAnchor}
                onClose={handleDateRangeClose}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'left',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'left',
                }}
              >
                <Paper sx={{ p: 2, minWidth: 300 }}>
                  <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Select Date Range
                    </Typography>
                    <IconButton size="small" onClick={handleDateRangeClose}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField
                      size="small"
                      label="Start Date"
                      type="date"
                      value={startDate || ''}
                      onChange={(e) => setStartDate(e.target.value || null)}
                      variant="outlined"
                      fullWidth
                      InputLabelProps={{
                        shrink: true,
                      }}
                    />
                    <TextField
                      size="small"
                      label="End Date"
                      type="date"
                      value={endDate || ''}
                      onChange={(e) => setEndDate(e.target.value || null)}
                      variant="outlined"
                      fullWidth
                      InputLabelProps={{
                        shrink: true,
                      }}
                      inputProps={{
                        min: startDate || undefined
                      }}
                    />
                    <Button
                      variant="contained"
                      onClick={handleDateRangeClose}
                      fullWidth
                      sx={{ mt: 1 }}
                    >
                      Apply
                    </Button>
                  </Box>
                </Paper>
              </Popover>
            </Grid>

            {/* Filtered Results Count */}
            {(selectedSalesHead || selectedDealer || selectedStatus || (startDate && endDate)) && (
              <Grid item xs={12} sm={6} md={4}>
                <Box 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    height: '100%',
                    minHeight: '40px',
                    px: 2,
                    py: 1,
                    backgroundColor: '#e3f2fd',
                    borderRadius: 1,
                    border: '1px solid #90caf9'
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#1976d2' }}>
                    {rowsState.rowCount} result{rowsState.rowCount !== 1 ? 's' : ''} found
                  </Typography>
                </Box>
              </Grid>
            )}
          </Grid>

          {/* Active Filters Display */}
          {(selectedSalesHead || selectedDealer || selectedStatus || startDate || endDate) && (
            <Box sx={{ 
              mt: 3, 
              pt: 2.5, 
              borderTop: '1px solid #e0e7ff',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1.5,
              alignItems: 'center'
            }}>
              <Typography variant="caption" sx={{ 
                color: '#666', 
                fontWeight: 500,
                mr: 1,
                fontSize: '0.85rem'
              }}>
                Active Filters:
              </Typography>
              {selectedSalesHead && (
                <Chip
                  label={`Sales Head: ${selectedSalesHead.name || selectedSalesHead.username || 'Unknown'}`}
                  onDelete={() => setSelectedSalesHead(null)}
                  color="error"
                  variant="filled"
                  size="small"
                  sx={{
                    fontWeight: 500,
                    '& .MuiChip-deleteIcon': {
                      fontSize: '1rem'
                    }
                  }}
                />
              )}
              {selectedDealer && (
                <Chip
                  label={`Dealer: ${selectedDealer.name || selectedDealer.code || 'Unknown'}`}
                  onDelete={() => setSelectedDealer(null)}
                  color="error"
                  variant="filled"
                  size="small"
                  sx={{
                    fontWeight: 500,
                    '& .MuiChip-deleteIcon': {
                      fontSize: '1rem'
                    }
                  }}
                />
              )}
              {selectedStatus && (
                <Chip
                  label={`Status: ${selectedStatus.displayName || selectedStatus.value || 'Unknown'}`}
                  onDelete={() => setSelectedStatus(null)}
                  color="error"
                  variant="filled"
                  size="small"
                  sx={{
                    fontWeight: 500,
                    '& .MuiChip-deleteIcon': {
                      fontSize: '1rem'
                    }
                  }}
                />
              )}
              {(startDate || endDate) && (
                <Chip
                  label={`Date: ${startDate ? formatDate(startDate) : '...'} - ${endDate ? formatDate(endDate) : '...'}`}
                  onDelete={() => {
                    setStartDate(null);
                    setEndDate(null);
                  }}
                  color="info"
                  variant="filled"
                  size="small"
                  sx={{
                    fontWeight: 500,
                    '& .MuiChip-deleteIcon': {
                      fontSize: '1rem'
                    }
                  }}
                />
              )}
          </Box>
        )}
      </Box>

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
        onView={null} // Disable default view action
        onEdit={null} // Disable default edit action
        onDelete={null} // Disable default delete action
        onRefresh={canRead ? handleRefresh : null}
        
        // Row interaction
        onRowClick={canRead ? handleRowClick : null}
      getRowClassName={(params) => {
        const status = params.row?.status;
        if (status && String(status).toLowerCase().trim() === 'rfq') {
          return 'not-decided-row';
        }
        return '';
      }}
        
        // Configuration
        pageSizeOptions={[5, 10, 25, 50]}
        showToolbar={true}
        hideCreateButton={true} // Hide create button for this view
        disableColumnFilter={true}
        disableColumnMenu={true}
        slots={{
          toolbar: CustomToolbar
        }}
      sx={{
        // Reuse the "not decided" highlight style for RFQ rows
        '& .not-decided-row': {
          backgroundColor: '#f0f4ff !important',
          borderLeft: '4px solid #1a237e',
          boxShadow: '0 1px 3px rgba(26, 35, 126, 0.08)',
          fontWeight: 'bold !important', // Make all text bold in the row
          '&:hover': {
            backgroundColor: '#e3f2fd !important',
            boxShadow: '0 2px 6px rgba(26, 35, 126, 0.12)',
          },
          '& .MuiDataGrid-cell': {
            borderBottom: '1px solid rgba(224, 231, 255, 0.5)',
            fontWeight: 'bold !important', // Make all text bold in cells
            '& *': {
              fontWeight: 'bold !important', // Make all nested elements bold
            },
          },
        },
      }}
      />

      {/* View Request Details Modal - Detailed View */}
      <Dialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        aria-labelledby="view-dialog-title"
        PaperProps={{
          sx: {
            backgroundColor: '#ffffff',
            minWidth: '600px',
            maxWidth: '800px',
            maxHeight: '90vh',
            overflow: 'auto',
          }
        }}
      >
        <DialogTitle 
          id="view-dialog-title"
          sx={{ 
            color: 'info.main',
            fontWeight: 'bold',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
            {selectedRequest?.status === VENDOR_APPROVAL_STATUS 
              ? `Work Order #${selectedRequest?.id}`
              : `Request Details #${selectedRequest?.id}`}
            <ManualSurveyHighlight request={selectedRequest} compact />
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedRequest && (() => {
            // Check if there's a parent dealer (dealer.id !== dealer_relation.parent.id)
            const hasParent = selectedRequest?.dealer_relation?.parent && 
                              selectedRequest?.dealer?.id && 
                              selectedRequest.dealer.id !== selectedRequest.dealer_relation.parent.id;
            const parent = hasParent ? selectedRequest.dealer_relation.parent : null;
            
            return (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
                <ManualSurveyHighlight request={selectedRequest} />
                {/* Parent Dealer Information - Only show if parent exists */}
                {hasParent && parent && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                      Parent Dealer Information
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <TextField
                        label="Parent Dealer Code"
                        value={parent.code || 'N/A'}
                        variant="outlined"
                        fullWidth
                        disabled
                        helperText="Read-only"
                      />
                      <TextField
                        label="Parent Dealer Name"
                        value={parent.name || 'N/A'}
                        variant="outlined"
                        fullWidth
                        disabled
                        helperText="Read-only"
                      />
                      <TextField
                        label="Parent Dealer Phone"
                        value={parent.phone || 'N/A'}
                        variant="outlined"
                        fullWidth
                        disabled
                        helperText="Read-only"
                      />
                    </Box>
                  </Box>
                )}
                
                {/* Current Dealer Information */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    Dealer Information
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                      label="Dealer Name"
                      value={selectedRequest.dealer?.name || 'N/A'}
                      variant="outlined"
                      fullWidth
                      disabled
                      helperText="Read-only"
                    />
                    <TextField
                      label="Dealer Code"
                      value={selectedRequest.dealer?.code || 'N/A'}
                      variant="outlined"
                      fullWidth
                      disabled
                      helperText="Read-only"
                    />
                      <TextField
                        label="Phone"
                        value={selectedRequest.dealer?.phone || 'N/A'}
                        variant="outlined"
                        fullWidth
                        disabled
                        helperText="Read-only"
                      />
                  </Box>
                  <TextField
                    label="Address"
                    value={selectedRequest.dealer?.city || 'N/A'}
                    variant="outlined"
                    fullWidth
                    disabled
                    helperText="Read-only"
                  />
                <TextField
                  label="Dealer Type"
                  value={(() => {
                    const type = selectedRequest.dealer_type;
                    if (!type) return 'Old';
                    return type === 'new' ? 'New' : 'Old';
                  })()}
                  variant="outlined"
                  fullWidth
                  disabled
                  helperText="Read-only"
                />
                </Box>

                {/* Survey Date */}
                <TextField
                  label="Survey Date"
                  value={(() => {
                    const today = new Date();
                    return today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                  })()}
                  variant="outlined"
                  fullWidth
                  disabled
                  helperText="Read-only"
                />

                {/* Survey Form Attachments */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    Survey Form Attachments
                  </Typography>
                  {selectedRequest.survey_form_attachments && 
                   Array.isArray(selectedRequest.survey_form_attachments) && 
                   selectedRequest.survey_form_attachments.length > 0 ? (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {selectedRequest.survey_form_attachments.map((file, index) => {
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
                            sx={{ cursor: 'pointer', '&:hover': { backgroundColor: '#e3f2fd', transform: 'scale(1.05)' } }}
                          />
                        );
                      })}
                    </Box>
                  ) : (
                    <Typography variant="body2" sx={{ color: '#666', fontStyle: 'italic' }}>
                      No survey form attachments available
                    </Typography>
                  )}
                </Box>
              </Box>
            );
          })()}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button 
            onClick={() => setModalOpen(false)}
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

      {/* Approve Confirmation Dialog */}
      <Dialog
        open={approveDialogOpen}
        onClose={cancelApprove}
        aria-labelledby="approve-dialog-title"
        PaperProps={{
          sx: {
            backgroundColor: '#ffffff',
            minWidth: '400px',
          }
        }}
      >
        <DialogTitle 
          id="approve-dialog-title"
          sx={{ 
            color: 'success.main',
            fontWeight: 'bold',
          }}
        >
          {(requestToAction?.status === SHOPBOARD_REQUEST_STATUS.VENDOR_REJECTED ||
            requestToAction?.status === 'vendor_rejected')
            ? 'Resubmit Quotation'
            : 'Submit Quotation'}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#333', mb: 2 }}>
            {(requestToAction?.status === SHOPBOARD_REQUEST_STATUS.VENDOR_REJECTED ||
              requestToAction?.status === 'vendor_rejected')
              ? <>Resubmit quotation for request <strong>#{requestToAction?.id}</strong>?</>
              : <>Are you sure you want to submit quotation for request <strong>#{requestToAction?.id}</strong>?</>}
          </Typography>
          <Typography variant="body2" sx={{ color: '#666' }}>
            This action will mark the request as quotation sent.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button 
            onClick={cancelApprove}
            variant="outlined"
            sx={{ 
              color: '#666',
              borderColor: '#ddd',
              '&:hover': {
                borderColor: '#999',
                backgroundColor: '#f5f5f5',
              }
            }}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={confirmApprove}
            variant="contained"
            color="success"
            disabled={isLoading}
          >
            {isLoading ? 'Submitting...' : 'Submit Quotation'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Confirmation Dialog */}
      <Dialog
        open={rejectDialogOpen}
        onClose={cancelReject}
        aria-labelledby="reject-dialog-title"
        PaperProps={{
          sx: {
            backgroundColor: '#ffffff',
            minWidth: '400px',
          }
        }}
      >
        <DialogTitle 
          id="reject-dialog-title"
          sx={{ 
            color: 'error.main',
            fontWeight: 'bold',
          }}
        >
          Request Review
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#333', mb: 2 }}>
            Are you sure you want to reject request <strong>#{requestToAction?.id}</strong>?
          </Typography>
          <Typography variant="body2" sx={{ color: '#666', mb: 2 }}>
            This action will mark the request as RFQ not accepted.
          </Typography>
          
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Rejection Comment (Optional)"
            placeholder="Please provide a reason for rejection..."
            value={rejectionComment}
            onChange={(e) => setRejectionComment(e.target.value)}
            variant="outlined"
            sx={{ mt: 2 }}
            helperText="Adding a comment helps provide context for the rejection"
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button 
            onClick={cancelReject}
            variant="outlined"
            sx={{ 
              color: '#666',
              borderColor: '#ddd',
              '&:hover': {
                borderColor: '#999',
                backgroundColor: '#f5f5f5',
              }
            }}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={confirmReject}
            variant="contained"
            color="error"
            disabled={isLoading}
          >
            {isLoading ? 'Rejecting...' : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Request Modal */}
      <Dialog
        open={editModalOpen}
        onClose={cancelEdit}
        aria-labelledby="edit-dialog-title"
        PaperProps={{
          sx: {
            backgroundColor: '#ffffff',
            minWidth: '720px',
            maxWidth: '960px',
            maxHeight: '90vh',
            overflow: 'auto',
            borderRadius: 2,
            boxShadow: 6,
          }
        }}
      >
        <DialogTitle 
          id="edit-dialog-title"
          sx={{ 
            color: 'info.main',
            fontWeight: 'bold',
            borderBottom: '1px solid #eaeaea',
            mb: 1,
          }}
        >
          Add Pricing for Request #{editingRequest?.id}
        </DialogTitle>
        <DialogContent>
          {loadingDropdowns ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <Typography>Loading form data...</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
              {/* Dealer Selection */}
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                  Dealer
                </Typography>
                <Autocomplete
                  options={dealers}
                  getOptionLabel={(option) => option.name || ''}
                  value={dealers.find(d => String(d.id) === String(editFormData.dealer_id) || String(d.code) === String(editFormData.dealer_id)) || null}
                  onChange={(event, newValue) => {
                    handleEditFormChange('dealer_id', newValue?.id || '');
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Dealer *"
                      variant="outlined"
                      fullWidth
                      required
                      helperText="Dealer cannot be changed after request creation"
                    />
                  )}
                  disabled={true}
                  sx={{
                    '& .MuiAutocomplete-input': {
                      cursor: 'not-allowed'
                    }
                  }}
                />
              </Paper>

              {/* Request Items - All Fields Editable (feet inputs, sqm area, per-sqm pricing) */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  Request Types & Dimensions
                </Typography>
                {requestTypes.length === 0 ? (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    No allowed request types found for this vendor. Please contact administrator to add request types for this vendor.
                  </Alert>
                ) : null}
                {editFormData.request_items?.map((item, index) => {
                  // Filter options: show only is_allowed=true OR the currently selected item (even if is_allowed=false)
                  const filteredOptions = requestTypes.filter(rt => 
                    rt.is_allowed === true || rt.id === item.request_type_id
                  );
                  
                  return (
                  <Paper key={index} variant="outlined" sx={{ p: 2, mb: 1.5, borderRadius: 2, backgroundColor: '#fafafa' }}>
                    <Autocomplete
                      options={filteredOptions}
                      getOptionLabel={(option) => option.name || ''}
                      value={requestTypes.find(rt => rt.id === item.request_type_id) || null}
                      onChange={(event, newValue) => {
                        const newItems = [...editFormData.request_items];
                        const selectedRequestType = requestTypes.find(rt => rt.id === newValue?.id);
                        const isManual = selectedRequestType?.request_type === 'manual';
                        const isFees = selectedRequestType?.request_type === 'fees';
                        
                        if (isManual) {
                          const pricePerSqft = selectedRequestType?.price || '';
                          const nextItem = {
                            ...newItems[index],
                            request_type_id: newValue?.id || '',
                            price_per_sqft: pricePerSqft,
                            quantity: isEnableQuantityFlag(selectedRequestType?.enable_quantity) ? (newItems[index].quantity || '1') : newItems[index].quantity,
                          };
                          nextItem.price = calcFixedOrManualTotal(nextItem, selectedRequestType);
                          newItems[index] = nextItem;
                        } else if (isFees) {
                          const pricePerSqft = selectedRequestType?.price || '';
                          newItems[index] = { 
                            ...newItems[index], 
                            request_type_id: newValue?.id || '',
                            width: '0',
                            height: '0',
                            price_per_sqft: pricePerSqft,
                            price: newItems[index].price || '',
                            quantity: isEnableQuantityFlag(selectedRequestType?.enable_quantity) ? (newItems[index].quantity || '1') : newItems[index].quantity,
                          };
                        } else {
                          const pricePerSqft = selectedRequestType?.price || '';
                          const nextItem = {
                            ...newItems[index],
                            request_type_id: newValue?.id || '',
                            price_per_sqft: pricePerSqft,
                            quantity: isEnableQuantityFlag(selectedRequestType?.enable_quantity) ? (newItems[index].quantity || '1') : newItems[index].quantity,
                          };
                          nextItem.price = calcFixedOrManualTotal(nextItem, selectedRequestType);
                          newItems[index] = nextItem;
                        }
                        handleEditFormChange('request_items', newItems);
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Request Type *"
                          variant="outlined"
                          fullWidth
                          required
                        />
                      )}
                      disabled={isLoading || filteredOptions.length === 0}
                      sx={{ mb: 1.5 }}
                    />
                    
                    <TextField
                      label="Width (ft)"
                      type="number"
                      value={(() => {
                        const selectedRequestType = requestTypes.find(rt => rt.id === item.request_type_id);
                        const isFees = selectedRequestType?.request_type === 'fees';
                        if (isFees) return '0';
                        return item.width !== undefined && item.width !== null && item.width !== '' ? String(item.width) : '';
                      })()}
                      onChange={(e) => {
                        const newItems = [...editFormData.request_items];
                        const selectedRequestType = requestTypes.find(rt => rt.id === newItems[index].request_type_id);
                        const isFees = selectedRequestType?.request_type === 'fees';
                        
                        // Don't allow editing for fees type
                        if (isFees) return;
                        
                        newItems[index] = { ...newItems[index], width: e.target.value };
                        newItems[index].price = calcFixedOrManualTotal(newItems[index], selectedRequestType);
                        handleEditFormChange('request_items', newItems);
                      }}
                      variant="outlined"
                      disabled={isLoading || (() => {
                        const selectedRequestType = requestTypes.find(rt => rt.id === item.request_type_id);
                        return selectedRequestType?.request_type === 'fees';
                      })()}
                      sx={{ mr: 1.5, minWidth: 140 }}
                      inputProps={{ step: '0.01', min: '0' }}
                    />
                    <TextField
                      label="Height (ft)"
                      type="number"
                      value={(() => {
                        const selectedRequestType = requestTypes.find(rt => rt.id === item.request_type_id);
                        const isFees = selectedRequestType?.request_type === 'fees';
                        if (isFees) return '0';
                        return item.height !== undefined && item.height !== null && item.height !== '' ? String(item.height) : '';
                      })()}
                      onChange={(e) => {
                        const newItems = [...editFormData.request_items];
                        const selectedRequestType = requestTypes.find(rt => rt.id === newItems[index].request_type_id);
                        const isFees = selectedRequestType?.request_type === 'fees';
                        
                        // Don't allow editing for fees type
                        if (isFees) return;
                        
                        newItems[index] = { ...newItems[index], height: e.target.value };
                        newItems[index].price = calcFixedOrManualTotal(newItems[index], selectedRequestType);
                        handleEditFormChange('request_items', newItems);
                      }}
                      variant="outlined"
                      disabled={isLoading || (() => {
                        const selectedRequestType = requestTypes.find(rt => rt.id === item.request_type_id);
                        return selectedRequestType?.request_type === 'fees';
                      })()}
                      sx={{ mr: 1.5, minWidth: 140 }}
                      inputProps={{ step: '0.01', min: '0' }}
                    />
                    <TextField
                      label="Total Area (sqft)"
                      type="number"
                      value={(() => {
                        const widthFt = parseFloat(item.width) || 0;
                        const heightFt = parseFloat(item.height) || 0;
                        const areaSqft = widthFt * heightFt;
                        return areaSqft.toFixed(2);
                      })()}
                      variant="outlined"
                      disabled
                      sx={{ mr: 1.5, minWidth: 160 }}
                      helperText="Auto"
                    />
                    <TextField
                      label="Price Per (sqft)"
                      type="number"
                      value={item.price_per_sqft !== undefined && item.price_per_sqft !== null && item.price_per_sqft !== '' ? String(item.price_per_sqft) : ''}
                      onChange={(e) => {
                        const newItems = [...editFormData.request_items];
                        const selectedRequestType = requestTypes.find(rt => rt.id === newItems[index].request_type_id);
                        const isManual = selectedRequestType?.request_type === 'manual';
                        const isFees = selectedRequestType?.request_type === 'fees';
                        
                        // Only allow editing for manual types (not fees or fixed)
                        if (isManual && !isFees) {
                          newItems[index] = { ...newItems[index], price_per_sqft: e.target.value };
                          newItems[index].price = calcFixedOrManualTotal(newItems[index], selectedRequestType);
                          handleEditFormChange('request_items', newItems);
                        }
                      }}
                      variant="outlined"
                      disabled={isLoading || (() => {
                        const selectedRequestType = requestTypes.find(rt => rt.id === item.request_type_id);
                        return selectedRequestType?.request_type === 'fixed' || selectedRequestType?.request_type === 'fees';
                      })()}
                      sx={{ mr: 1.5, minWidth: 180 }}
                      InputProps={{ startAdornment: <InputAdornment position="start">₨</InputAdornment> }}
                      helperText={(() => {
                        const selectedRequestType = requestTypes.find(rt => rt.id === item.request_type_id);
                        if (selectedRequestType?.request_type === 'manual') return 'Editable for manual type';
                        if (selectedRequestType?.request_type === 'fees') return 'Read-only for fees type';
                        return 'From vendor pricing (read-only)';
                      })()}
                      inputProps={{ step: '0.01', min: '0' }}
                    />

                    {isEnableQuantityFlag(requestTypes.find(rt => rt.id === item.request_type_id)?.enable_quantity) && (
                      <TextField
                        label="Quantity"
                        type="number"
                        value={item.quantity !== undefined && item.quantity !== null && item.quantity !== '' ? String(item.quantity) : '1'}
                        onChange={(e) => {
                          const newItems = [...editFormData.request_items];
                          const selectedRequestType = requestTypes.find(rt => rt.id === newItems[index].request_type_id);
                          const isFees = selectedRequestType?.request_type === 'fees';
                          const oldQty = getQtyMultiplier(newItems[index], selectedRequestType);
                          newItems[index] = { ...newItems[index], quantity: e.target.value };
                          if (isFees) {
                            const newQty = getQtyMultiplier(newItems[index], selectedRequestType);
                            const currentPrice = parseFloat(newItems[index].price) || 0;
                            const unit = oldQty > 0 ? currentPrice / oldQty : currentPrice;
                            newItems[index].price = Number((unit * newQty).toFixed(2));
                          } else {
                            newItems[index].price = calcFixedOrManualTotal(newItems[index], selectedRequestType);
                          }
                          handleEditFormChange('request_items', newItems);
                        }}
                        variant="outlined"
                        disabled={isLoading}
                        sx={{ mr: 1.5, minWidth: 120 }}
                        helperText="Optional, default 1"
                        inputProps={{ step: '1', min: '1' }}
                      />
                    )}
                    
                    {/* Total Cost Field - Calculated for manual and fixed, editable for fees */}
                    <TextField
                      label="Total Cost Per Item"
                      type="number"
                      value={(() => {
                        const selectedRequestType = requestTypes.find(rt => rt.id === item.request_type_id);
                        const isFees = selectedRequestType?.request_type === 'fees';
                        
                        // For fees type: use the price directly (editable)
                        if (isFees) {
                          return item.price !== undefined && item.price !== null && item.price !== '' ? String(item.price) : '';
                        }
                        
                        const total = calcFixedOrManualTotal(item, selectedRequestType);
                        return total === '' ? '0.00' : Number(total).toFixed(2);
                      })()}
                      onChange={(e) => {
                        const newItems = [...editFormData.request_items];
                        const selectedRequestType = requestTypes.find(rt => rt.id === newItems[index].request_type_id);
                        const isFees = selectedRequestType?.request_type === 'fees';
                        
                        // Only allow editing for fees type
                        if (isFees) {
                          newItems[index] = { ...newItems[index], price: e.target.value };
                          handleEditFormChange('request_items', newItems);
                        }
                      }}
                      variant="outlined"
                      disabled={isLoading || (() => {
                        const selectedRequestType = requestTypes.find(rt => rt.id === item.request_type_id);
                        return selectedRequestType?.request_type !== 'fees';
                      })()}
                      sx={{ minWidth: 180 }}
                      InputProps={{ startAdornment: <InputAdornment position="start">₨</InputAdornment> }}
                      helperText={(() => {
                        const selectedRequestType = requestTypes.find(rt => rt.id === item.request_type_id);
                        if (selectedRequestType?.request_type === 'fees') return 'Editable for fees type';
                        return isEnableQuantityFlag(selectedRequestType?.enable_quantity)
                          ? 'Area × price per ft² × quantity'
                          : 'Area × price per ft²';
                      })()}
                      inputProps={{ step: '0.01', min: '0' }}
                    />
                    
                    <IconButton
                      onClick={() => {
                        // Remove item by ID or temp_id, not by index
                        const itemToRemove = editFormData.request_items[index];
                        const itemIdentifier = itemToRemove.id || itemToRemove.temp_id;
                        const newItems = editFormData.request_items.filter(item => 
                          (item.id || item.temp_id) !== itemIdentifier
                        );
                        handleEditFormChange('request_items', newItems);
                      }}
                      color="error"
                      disabled={isLoading || editFormData.request_items.length <= 1}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Paper>
                  );
                })}
                <Button
                  variant="outlined"
                  onClick={() => {
                    const newItems = [...(editFormData.request_items || []), { 
                      temp_id: `temp_${Date.now()}_${Math.random()}`, // Unique temporary ID for new items
                      request_type_id: '', 
                      width: '', 
                      height: '', 
                      price: '', 
                      price_per_sqft: '',
                      quantity: '1',
                    }];
                    handleEditFormChange('request_items', newItems);
                  }}
                  disabled={isLoading || requestTypes.length === 0}
                  startIcon={<AddIcon />}
                >
                  Add Request Type
                </Button>
                {requestTypes.length === 0 && (
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', mt: 1 }}>
                    Cannot add request types - no allowed request types available for this vendor
                  </Typography>
                )}
                {/* Overall Total Cost (below items) */}
                <Box sx={{ mt: 1.5, p: 2, borderRadius: 2, backgroundColor: '#f0f7ff', border: '1px solid #d0e6ff' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                      Total Cost (All Items)
                    </Typography>
                    <TextField
                      type="number"
                      value={(() => {
                        if (!editFormData.request_items || !Array.isArray(editFormData.request_items)) return '0.00';
                        const total = editFormData.request_items.reduce((sum, it) => {
                          const selectedRequestType = requestTypes.find(rt => rt.id === it.request_type_id);
                          const isFees = selectedRequestType?.request_type === 'fees';
                          
                          // For fees type: use price directly
                          if (isFees) {
                            const price = parseFloat(it.price) || 0;
                            return sum + (isNaN(price) ? 0 : price);
                          }
                          
                          const itemTotal = calcFixedOrManualTotal(it, selectedRequestType);
                          return sum + (itemTotal === '' ? 0 : itemTotal);
                        }, 0);
                        return total.toFixed(2);
                      })()}
                      disabled
                      InputProps={{ startAdornment: <InputAdornment position="start">₨</InputAdornment> }}
                      sx={{ minWidth: 220 }}
                    />
                  </Box>
                </Box>
              </Box>

              {/* Warranty Status */}
              <Autocomplete
                options={warrantyStatuses}
                getOptionLabel={(option) => option.name || ''}
                value={warrantyStatuses.find(ws => ws.id === editFormData.warranty_status_id) || null}
                onChange={(event, newValue) => {
                  handleEditFormChange('warranty_status_id', newValue?.id || '');
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Warranty Status"
                    variant="outlined"
                    fullWidth
                    required
                  />
                )}
                disabled={isLoading}
              />

              {/* Reason for Replacement */}
              <TextField
                label="Reason for Replacement"
                multiline
                rows={3}
                value={editFormData.reason_for_replacement}
                onChange={(e) => handleEditFormChange('reason_for_replacement', e.target.value)}
                variant="outlined"
                fullWidth
                disabled={isLoading}
              />

              {/* Last Installation Date */}
              <TextField
                label="Last Installation Date"
                type="date"
                value={editFormData.last_installation_date}
                onChange={(e) => handleEditFormChange('last_installation_date', e.target.value)}
                variant="outlined"
                fullWidth
                InputLabelProps={{
                  shrink: true,
                }}
                disabled={isLoading || (editingRequest?.last_installation_date && String(editingRequest.last_installation_date).trim() !== '')}
                helperText={editingRequest?.last_installation_date && String(editingRequest.last_installation_date).trim() !== '' 
                  ? 'Last installation date cannot be changed once set' 
                  : ''}
              />

              

              {/* Site Photos Upload */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                  Upload Site Photos
                </Typography>
                <input
                  type="file"
                  id="site_photo_attachement"
                  name="site_photo_attachement"
                  multiple
                  accept="image/*,application/pdf"
                  onChange={(e) => {
                    const newFiles = e.target.files ? Array.from(e.target.files) : [];
                    setSitePhotos(prev => [...prev, ...newFiles]);
                    e.target.value = '';
                  }}
                  style={{ display: 'none' }}
                />
                <label htmlFor="site_photo_attachement">
                  <Button
                    variant="outlined"
                    component="span"
                    startIcon={<AddIcon />}
                    disabled={isLoading}
                    sx={{ 
                      border: '2px dashed #ccc',
                      '&:hover': {
                        border: '2px dashed #1976d2',
                        backgroundColor: '#f5f5f5'
                      }
                    }}
                  >
                    Select Site Photos (PDF, Images)
                  </Button>
                </label>
                
                {/* Existing Files */}
                {existingSitePhotos.length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="body2" sx={{ color: '#666', mb: 1, fontWeight: 'bold' }}>
                      Existing files: {existingSitePhotos.length}
                    </Typography>
                    {existingSitePhotos.map((file, index) => {
                      const { url, fileName } = getFileUrlAndName(file, index, `Site Photo ${index + 1}`);
                      const fileUrl = url.startsWith('data:') || url.startsWith('http') ? url : (url.startsWith('/') ? `${BASE_URL}${url}` : `${BASE_URL}/uploads/site_photos/${url}`);
                      return (
                        <Chip
                          key={`existing-${index}`}
                          label={fileName}
                          size="small"
                          color="primary"
                          variant="outlined"
                          onClick={() => openFileInNewTab(fileUrl)}
                          onDelete={() => {
                            const newFiles = existingSitePhotos.filter((_, i) => i !== index);
                            setExistingSitePhotos(newFiles);
                          }}
                          sx={{ 
                            mr: 1, 
                            mb: 1,
                            cursor: 'pointer',
                            '&:hover': {
                              backgroundColor: '#e3f2fd',
                              transform: 'scale(1.05)'
                            }
                          }}
                        />
                      );
                    })}
                  </Box>
                )}
                
                {/* New Files */}
                {sitePhotos.length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="body2" sx={{ color: '#666', mb: 1, fontWeight: 'bold' }}>
                      New files: {sitePhotos.length}
                    </Typography>
                    {sitePhotos.map((file, index) => (
                      <Chip
                        key={`new-${index}`}
                        label={file.name}
                        size="small"
                        onDelete={() => {
                          const newFiles = sitePhotos.filter((_, i) => i !== index);
                          setSitePhotos(newFiles);
                        }}
                        sx={{ mr: 1, mb: 1 }}
                      />
                    ))}
                  </Box>
                )}
              </Box>

              {/* Old Board Photos Upload */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                  Old Board Photos
                </Typography>
                <input
                  type="file"
                  id="old_board_photo_attachment"
                  name="old_board_photo_attachment"
                  multiple
                  accept="image/*,application/pdf"
                  onChange={(e) => {
                    const newFiles = e.target.files ? Array.from(e.target.files) : [];
                    setOldBoardPhotos(prev => [...prev, ...newFiles]);
                    e.target.value = '';
                  }}
                  style={{ display: 'none' }}
                />
                <label htmlFor="old_board_photo_attachment">
                  <Button
                    variant="outlined"
                    component="span"
                    startIcon={<AddIcon />}
                    disabled={isLoading}
                    sx={{ 
                      border: '2px dashed #ccc',
                      '&:hover': {
                        border: '2px dashed #1976d2',
                        backgroundColor: '#f5f5f5'
                      }
                    }}
                  >
                    Select Old Board Photos (PDF, Images)
                  </Button>
                </label>
                
                {/* Existing Files */}
                {existingOldBoardPhotos.length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="body2" sx={{ color: '#666', mb: 1, fontWeight: 'bold' }}>
                      Existing files: {existingOldBoardPhotos.length}
                    </Typography>
                    {existingOldBoardPhotos.map((file, index) => {
                      const { url, fileName } = getFileUrlAndName(file, index, `Old Board Photo ${index + 1}`);
                      const fileUrl = url.startsWith('data:') || url.startsWith('http') ? url : (url.startsWith('/') ? `${BASE_URL}${url}` : `${BASE_URL}/uploads/old_board_photos/${url}`);
                      return (
                        <Chip
                          key={`existing-old-${index}`}
                          label={fileName}
                          size="small"
                          color="primary"
                          variant="outlined"
                          onClick={() => openFileInNewTab(fileUrl)}
                          onDelete={() => {
                            const newFiles = existingOldBoardPhotos.filter((_, i) => i !== index);
                            setExistingOldBoardPhotos(newFiles);
                          }}
                          sx={{ 
                            mr: 1, 
                            mb: 1,
                            cursor: 'pointer',
                            '&:hover': {
                              backgroundColor: '#e3f2fd',
                              transform: 'scale(1.05)'
                            }
                          }}
                        />
                      );
                    })}
                  </Box>
                )}
                
                {/* New Files */}
                {oldBoardPhotos.length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="body2" sx={{ color: '#666', mb: 1, fontWeight: 'bold' }}>
                      New files: {oldBoardPhotos.length}
                    </Typography>
                    {oldBoardPhotos.map((file, index) => (
                      <Chip
                        key={`new-old-${index}`}
                        label={file.name}
                        size="small"
                        onDelete={() => {
                          const newFiles = oldBoardPhotos.filter((_, i) => i !== index);
                          setOldBoardPhotos(newFiles);
                        }}
                        sx={{ mr: 1, mb: 1 }}
                      />
                    ))}
                  </Box>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button 
            onClick={cancelEdit}
            variant="outlined"
            sx={{ 
              color: '#666',
              borderColor: '#ddd',
              '&:hover': {
                borderColor: '#999',
                backgroundColor: '#f5f5f5',
              }
            }}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleEditSubmit}
            variant="contained"
            color="info"
            disabled={isLoading}
            sx={{
              minWidth: '120px'
            }}
          >
            {isLoading ? 'Updating...' : 'Update Request'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Comments Dialog */}
      <Dialog
        open={commentsDialogOpen}
        onClose={cancelComments}
        aria-labelledby="comments-dialog-title"
        PaperProps={{
          sx: {
            backgroundColor: '#ffffff',
            minWidth: '500px',
            maxWidth: '700px',
            maxHeight: '80vh',
            overflow: 'auto',
          }
        }}
      >
        <DialogTitle 
          id="comments-dialog-title"
          sx={{ 
            color: 'info.main',
            fontWeight: 'bold',
          }}
        >
          Area Head Comments - Request #{requestToAction?.id}
        </DialogTitle>
        <DialogContent>
          {loadingComments ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <Typography>Loading comments...</Typography>
            </Box>
          ) : requestComments.length === 0 ? (
            <Box sx={{ textAlign: 'center', p: 4 }}>
              <Typography variant="body1" sx={{ color: '#666' }}>
                No comments found for this request.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {requestComments.map((comment, index) => (
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
                      {comment.user ? comment.user.username : 'Unknown User'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#666' }}>
                      {comment.comment_type || 'General'}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ color: '#333', mb: 1 }}>
                    {comment.comment}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#666' }}>
                    {comment.created_at ? new Date(comment.created_at).toLocaleString() : 'Unknown Date'}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button 
            onClick={cancelComments}
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

      {/* View History Dialog */}
      <Dialog
        open={historyDialogOpen}
        onClose={cancelHistory}
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
          Request History - #{requestToAction?.id}
        </DialogTitle>
        <DialogContent>
          {loadingHistory ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <Typography>Loading history...</Typography>
            </Box>
          ) : requestHistory.length === 0 ? (
            <Box sx={{ textAlign: 'center', p: 4 }}>
              <Typography variant="body1" sx={{ color: '#666' }}>
                No item changes found for this request.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {requestHistory.map((log, index) => {
                // Compare each entry with the immediate previous (newer) one in time
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
                  
                  {/* Show changed fields */}
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                      Changes:
                    </Typography>
                    
                    {/* Main request changes */}
                    {renderMainChanges(log, prevLog)}
                    
                    {/* Request items changes */}
                    {log.item_changes && log.item_changes.length > 0 && (
                      <Box sx={{ mt: 1, p: 1, backgroundColor: '#f0f0f0', borderRadius: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                          Request items:
                        </Typography>
                        {log.item_changes.map((item, index) => (
                          <Box key={index} sx={{ mb: 1, p: 1, backgroundColor: '#ffffff', borderRadius: 0.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                              {item.action}: {item.request_type}
                            </Typography>
                            {/* Only show width if it exists and is not 0 */}
                            {item.width !== null && item.width !== undefined && parseFloat(item.width) > 0 && (
                              <Typography variant="body2" sx={{ color: '#333', mb: 0.5 }}>
                                Width: {item.width} ft
                              </Typography>
                            )}
                            {/* Only show height if it exists and is not 0 */}
                            {item.height !== null && item.height !== undefined && parseFloat(item.height) > 0 && (
                              <Typography variant="body2" sx={{ color: '#333', mb: 0.5 }}>
                                Height: {item.height} ft
                              </Typography>
                            )}
                            {/* Show price per sqft if available and greater than 0 */}
                            {item.price_per_sqft !== null && item.price_per_sqft !== undefined && parseFloat(item.price_per_sqft) > 0 && (
                              <Typography variant="body2" sx={{ color: '#333', mb: 0.5 }}>
                                Price per sqft: Rs {parseFloat(item.price_per_sqft).toFixed(2)}
                              </Typography>
                            )}
                            {item.quantity !== null && item.quantity !== undefined && parseInt(item.quantity, 10) > 0 && (
                              <Typography variant="body2" sx={{ color: '#333', mb: 0.5 }}>
                                Quantity: {item.quantity}
                              </Typography>
                            )}
                            {/* Always show total price if available */}
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
              );})}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button 
            onClick={cancelHistory}
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

      {/* Detailed View Modal */}
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
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
            {selectedDetailedRequest?.status === VENDOR_APPROVAL_STATUS 
              ? `Work Order - #${selectedDetailedRequest?.id}`
              : `Request Details - #${selectedDetailedRequest?.id}`}
            <ManualSurveyHighlight request={selectedDetailedRequest} compact />
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedDetailedRequest && (() => {
            // Check if there's a parent dealer (dealer.id !== dealer_relation.parent.id)
            const hasParent = selectedDetailedRequest?.dealer_relation?.parent && 
                              selectedDetailedRequest?.dealer?.id && 
                              selectedDetailedRequest.dealer.id !== selectedDetailedRequest.dealer_relation.parent.id;
            const parent = hasParent ? selectedDetailedRequest.dealer_relation.parent : null;
            
            return (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
                <ManualSurveyHighlight request={selectedDetailedRequest} />
                {/* Parent Dealer Information - Only show if parent exists */}
                {hasParent && parent && (
                  <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, backgroundColor: '#e3f2fd', border: '2px solid #bbdefb' }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: 'primary.main' }}>
                      👤 Parent Dealer Information
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                          Parent Dealer Code
                        </Typography>
                        <Typography variant="body1">
                          {parent.code || 'N/A'}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                          Parent Dealer Name
                        </Typography>
                        <Typography variant="body1">
                          {parent.name || 'N/A'}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                          Parent Dealer Phone
                        </Typography>
                        <Typography variant="body1">
                          {parent.phone || 'N/A'}
                        </Typography>
                      </Box>
                    </Box>
                  </Paper>
                )}
                
                {/* Current Dealer Information */}
                <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, backgroundColor: '#f8f9fa' }}>
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
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                        Dealer Type
                      </Typography>
                      <Typography variant="body1">
                        {selectedDetailedRequest.dealer_type === 'new' ? 'New' : 'Old'}
                      </Typography>
                    </Box>
                  </Box>
                </Paper>

                {/* Request Items */}
                <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, backgroundColor: '#f8f9fa' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: 'primary.main' }}>
                  📋 Request Items & Dimensions
                </Typography>
                {selectedDetailedRequest.requestItems && selectedDetailedRequest.requestItems.length > 0 ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {selectedDetailedRequest.requestItems.map((item, index) => (
                      <Paper key={index} variant="outlined" sx={{ p: 2, borderRadius: 2, backgroundColor: '#ffffff' }}>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr', gap: 2, alignItems: 'center' }}>
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
                                return ppsf ? `₨${ppsf.toFixed(2)}` : 'N/A';
                              })()}
                            </Typography>
                          </Box>
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                              Quantity
                            </Typography>
                            <Typography variant="body2">
                              {item.quantity != null && item.quantity !== '' ? item.quantity : '1'}
                            </Typography>
                          </Box>
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                              Total Cost
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                              {item.price ? `₨${parseFloat(item.price).toFixed(2)}` : 'N/A'}
                            </Typography>
                          </Box>
                        </Box>
                      </Paper>
                    ))}
                    <Box sx={{ mt: 2, p: 2, backgroundColor: '#e3f2fd', borderRadius: 2, border: '1px solid #bbdefb' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                          Total Cost (All Items)
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                          ₨{(() => {
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
              </Paper>

              {/* Survey Details — shown only when survey data is available */}
              {(
                (selectedDetailedRequest.surveyRequestItems &&
                  selectedDetailedRequest.surveyRequestItems.length > 0) ||
                (selectedDetailedRequest.surveyComments &&
                  selectedDetailedRequest.surveyComments.length > 0)
              ) && (
                <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, backgroundColor: '#f8f9fa' }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: 'primary.main' }}>
                    📝 Survey Details
                  </Typography>

                  {selectedDetailedRequest.surveyRequestItems?.length > 0 && (
                    <Box sx={{ mb: selectedDetailedRequest.surveyComments?.length > 0 ? 3 : 0 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                        Suggested Request Items
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {selectedDetailedRequest.surveyRequestItems.map((item) => (
                          <Chip
                            key={item.id}
                            label={item.requestType?.name || `Request Type #${item.request_item_id}`}
                            color="primary"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    </Box>
                  )}

                  {selectedDetailedRequest.surveyComments?.length > 0 && (
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                        Survey Comments
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {selectedDetailedRequest.surveyComments.map((surveyComment) => (
                          <Paper
                            key={surveyComment.id}
                            variant="outlined"
                            sx={{ p: 2, borderRadius: 1, backgroundColor: '#ffffff' }}
                          >
                            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                              {surveyComment.comment}
                            </Typography>
                          </Paper>
                        ))}
                      </Box>
                    </Box>
                  )}
                </Paper>
              )}

              {/* Warranty & Installation Info */}
              <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, backgroundColor: '#f8f9fa' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: 'primary.main' }}>
                  🔧 Warranty & Installation Information
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                      Warranty Status
                    </Typography>
                    <Typography variant="body1">
                      {selectedDetailedRequest.warrantyStatus?.name || 'N/A'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                      Last Installation Date
                    </Typography>
                    <Typography variant="body1">
                      {selectedDetailedRequest.last_installation_date ? 
                        new Date(selectedDetailedRequest.last_installation_date).toLocaleDateString() : 'N/A'}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                    Reason for Replacement
                  </Typography>
                  <Typography variant="body1" sx={{ 
                    p: 2, 
                    backgroundColor: '#ffffff', 
                    borderRadius: 1, 
                    border: '1px solid #e0e0e0',
                    minHeight: '60px'
                  }}>
                    {selectedDetailedRequest.reason_for_replacement || 'No reason provided'}
                  </Typography>
                </Box>
              </Paper>

              {/* Attachments */}
              <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, backgroundColor: '#f8f9fa' }}>
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
                            sx={{ cursor: 'pointer', '&:hover': { backgroundColor: '#e3f2fd', transform: 'scale(1.05)' } }}
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
                            sx={{ cursor: 'pointer', '&:hover': { backgroundColor: '#f3e5f5', transform: 'scale(1.05)' } }}
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
                            sx={{ 
                              cursor: 'pointer',
                              '&:hover': { backgroundColor: '#e8f5e8', transform: 'scale(1.05)' }
                            }}
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
              </Paper>

              {/* Request Status & Vendor Info */}
              <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, backgroundColor: '#f8f9fa' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: 'primary.main' }}>
                  📊 Request Status & Vendor Information
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                      Current Status
                    </Typography>
                    <Chip 
                      label={getVendorStatusDisplayName(selectedDetailedRequest.status)} 
                      variant="filled" 
                      size="small"
                      color={getVendorStatusColor(selectedDetailedRequest.status)}
                    />
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                      Assigned Vendor
                    </Typography>
                    <Typography variant="body1">
                      {selectedDetailedRequest.vendor?.name || 'Not assigned'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                      Total Cost
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                      {selectedDetailedRequest.total_cost ? `₨${parseFloat(selectedDetailedRequest.total_cost).toFixed(2)}` : 'N/A'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                      Survey Date
                    </Typography>
                    <Typography variant="body1">
                      {selectedDetailedRequest.survey_date ? 
                        new Date(selectedDetailedRequest.survey_date).toLocaleDateString() : 
                        new Date().toLocaleDateString()}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                      Approval Date
                    </Typography>
                    <Typography variant="body1">
                      {selectedDetailedRequest.approval_date ? 
                        (() => {
                          try {
                            const date = new Date(selectedDetailedRequest.approval_date);
                            return date.toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            }) + ' ' + date.toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true
                            });
                          } catch (error) {
                            return 'N/A';
                          }
                        })() : 'N/A'}
                    </Typography>
                  </Box>
                </Box>
              </Paper>
              </Box>
            );
          })()}
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

      {/* Invoice Upload Modal */}
      <Dialog
        open={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        aria-labelledby="invoice-dialog-title"
        PaperProps={{
          sx: {
            backgroundColor: '#ffffff',
            minWidth: '400px',
          }
        }}
      >
        <DialogTitle 
          id="invoice-dialog-title"
          sx={{ 
            color: selectedInvoiceRequest?.status === SHOPBOARD_REQUEST_STATUS.INVOICE_REJECTED ? 'error.main' : 'primary.main',
            fontWeight: 'bold',
          }}
        >
          {selectedInvoiceRequest?.status === SHOPBOARD_REQUEST_STATUS.INVOICE_REJECTED 
            ? `Edit Invoice - Request #${selectedInvoiceRequest?.id}` 
            : `Share Invoice - Request #${selectedInvoiceRequest?.id}`}
        </DialogTitle>
        <DialogContent>
          {selectedInvoiceRequest?.status === SHOPBOARD_REQUEST_STATUS.INVOICE_REJECTED && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              This invoice was rejected. Please review the rejection comments and update the invoice accordingly.
            </Alert>
          )}
          <Typography sx={{ color: '#333', mb: 2 }}>
            Dealer: <strong>{selectedInvoiceRequest?.dealer?.name || 'N/A'}</strong>
          </Typography>
          <Typography sx={{ color: '#333', mb: 2 }}>
            Total Cost: <strong>{selectedInvoiceRequest?.total_cost ? `₨${parseFloat(selectedInvoiceRequest.total_cost).toFixed(2)}` : 'N/A'}</strong>
          </Typography>
          
          {/* Invoice Number */}
          <TextField
            label="Invoice Number"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            variant="outlined"
            fullWidth
            required
            sx={{ mb: 2 }}
            disabled={invoiceLoading}
            placeholder="Enter invoice number"
            helperText={(!invoiceNumber || invoiceNumber.trim() === '') ? (
              <Typography variant="caption" sx={{ color: 'error.main' }}>
                Invoice number is required
              </Typography>
            ) : ''}
          />
          
          <input
            type="file"
            id="invoice_file"
            name="invoice_file"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            onChange={(e) => setInvoiceFile(e.target.files[0] || null)}
            style={{ display: 'none' }}
          />
          
          <label htmlFor="invoice_file">
            <Button
              variant="outlined"
              component="span"
              startIcon={<InvoiceIcon />}
              disabled={invoiceLoading}
              fullWidth
              sx={{ 
                mt: 2
              }}
            >
              Select Invoice File *
            </Button>
          </label>
          
          {/* Show required message if no file selected */}
          {!invoiceFile && existingInvoiceFiles.length === 0 && (
            <Typography variant="caption" sx={{ color: 'error.main', mt: 0.5, display: 'block' }}>
              Invoice file is required
            </Typography>
          )}
          
          {/* Existing Invoice Files */}
          {existingInvoiceFiles.length > 0 && (
            <Box sx={{ mt: 1, mb: 2 }}>
              <Typography variant="body2" sx={{ color: '#666', mb: 1, fontWeight: 'bold' }}>
                Existing invoice files:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {existingInvoiceFiles.map((file, index) => {
                  const { url, fileName } = getFileUrlAndName(file, index, `Invoice ${index + 1}`);
                  const fileUrl = resolveAttachmentUrl(url);
                  return (
                    <Chip
                      key={`existing-invoice-${index}`}
                      label={fileName}
                      size="small"
                      color="primary"
                      variant="outlined"
                      onClick={() => openFileInNewTab(fileUrl)}
                      onDelete={() => {
                        const newFiles = existingInvoiceFiles.filter((_, i) => i !== index);
                        setExistingInvoiceFiles(newFiles);
                      }}
                      sx={{ 
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor: '#e3f2fd',
                        }
                      }}
                    />
                  );
                })}
              </Box>
            </Box>
          )}
          
          {/* New Invoice File */}
          {invoiceFile && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" sx={{ color: '#666', mb: 1, fontWeight: 'bold' }}>
                New file selected:
              </Typography>
              <Chip
                label={invoiceFile.name}
                size="small"
                onDelete={() => setInvoiceFile(null)}
                sx={{ mr: 1, mb: 1 }}
              />
            </Box>
          )}

          {/* Dealer Acknowledgment Form */}
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
              Dealer Acknowledgment Form *
            </Typography>
            <input
              type="file"
              id="dealer_acknowledgment_file"
              name="dealer_acknowledgment_file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={(e) => setDealerAcknowledgmentFile(e.target.files[0] || null)}
              style={{ display: 'none' }}
            />
            
            <label htmlFor="dealer_acknowledgment_file">
              <Button
                variant="outlined"
                component="span"
                startIcon={<AddIcon />}
                disabled={invoiceLoading}
                fullWidth
                sx={{ 
                  border: '2px dashed #ccc',
                  '&:hover': {
                    border: '2px dashed #1976d2',
                    backgroundColor: '#f5f5f5'
                  }
                }}
              >
                Select Dealer Acknowledgment Form (PDF, Images) *
              </Button>
            </label>
            
            {/* Show required message if no file selected */}
            {!dealerAcknowledgmentFile && existingDealerAcknowledgmentFiles.length === 0 && (
              <Typography variant="caption" sx={{ color: 'error.main', mt: 0.5, display: 'block' }}>
                Dealer acknowledgment form is required
              </Typography>
            )}
            
            {/* Existing Dealer Acknowledgment Files */}
            {existingDealerAcknowledgmentFiles.length > 0 && (
              <Box sx={{ mt: 1, mb: 1 }}>
                <Typography variant="body2" sx={{ color: '#666', mb: 1, fontWeight: 'bold' }}>
                  Existing acknowledgment files:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {existingDealerAcknowledgmentFiles.map((file, index) => {
                    const { url, fileName } = getFileUrlAndName(file, index, `Acknowledgment ${index + 1}`);
                    const fileUrl = resolveAttachmentUrl(url);
                    return (
                      <Chip
                        key={`existing-ack-${index}`}
                        label={fileName}
                        size="small"
                        color="secondary"
                        variant="outlined"
                        onClick={() => openFileInNewTab(fileUrl)}
                        onDelete={() => {
                          const newFiles = existingDealerAcknowledgmentFiles.filter((_, i) => i !== index);
                          setExistingDealerAcknowledgmentFiles(newFiles);
                        }}
                        sx={{ 
                          cursor: 'pointer',
                          '&:hover': {
                            backgroundColor: '#f3e5f5',
                          }
                        }}
                      />
                    );
                  })}
                </Box>
              </Box>
            )}
            
            {/* New Dealer Acknowledgment File */}
            {dealerAcknowledgmentFile && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2" sx={{ color: '#666', mb: 1, fontWeight: 'bold' }}>
                  New file selected:
                </Typography>
                <Chip
                  label={dealerAcknowledgmentFile.name}
                  size="small"
                  onDelete={() => setDealerAcknowledgmentFile(null)}
                  sx={{ mr: 1, mb: 1 }}
                />
              </Box>
            )}
          </Box>

          {/* Per-Item Site Photos */}
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
              Site Photos per Request Item *
            </Typography>
            {selectedInvoiceRequest?.requestItems && selectedInvoiceRequest.requestItems.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {selectedInvoiceRequest.requestItems.map((item, idx) => {
                  const hasSitePhotos = (
                    (sitePhotosPerItem[item.id] && sitePhotosPerItem[item.id].length > 0) ||
                    getExistingSitePhotosForItem(existingSitePhotosPerItem, item.id).length > 0
                  );
                  return (
                  <Paper 
                    key={item.id || idx} 
                    variant="outlined" 
                    sx={{ 
                      p: 2, 
                      borderRadius: 2
                    }}
                  >
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 2, alignItems: 'center', mb: 2 }}>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#666' }}>Request Type</Typography>
                        <Typography variant="body2">{item.requestType?.name || 'N/A'}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#666' }}>Width (ft)</Typography>
                        <Typography variant="body2">{item.width || 'N/A'}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#666' }}>Height (ft)</Typography>
                        <Typography variant="body2">{item.height || 'N/A'}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#666' }}>Price/ft²</Typography>
                        <Typography variant="body2">
                          {(() => {
                            const widthFt = parseFloat(item.width) || 0;
                            const heightFt = parseFloat(item.height) || 0;
                            const areaSqft = widthFt * heightFt;
                            const priceNum = parseFloat(item.price) || 0;
                            const ppsf = areaSqft > 0 ? priceNum / areaSqft : null;
                            return ppsf ? `₨${ppsf.toFixed(2)}` : 'N/A';
                          })()}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#666' }}>Total</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{item.price ? `₨${parseFloat(item.price).toFixed(2)}` : 'N/A'}</Typography>
                      </Box>
                    </Box>

                    <input
                      type="file"
                      id={`site_photos_files_${item.id}`}
                      name={`site_photos_files[${item.id}][]`}
                      multiple
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        setSitePhotosPerItem(prev => ({ ...prev, [item.id]: files }));
                      }}
                      style={{ display: 'none' }}
                    />
                    <label htmlFor={`site_photos_files_${item.id}`}>
                      <Button
                        variant="outlined"
                        component="span"
                        startIcon={<AddIcon />}
                        disabled={invoiceLoading}
                        sx={{ 
                          border: '2px dashed #ccc',
                          '&:hover': {
                            border: '2px dashed #1976d2',
                            backgroundColor: '#f5f5f5'
                          }
                        }}
                      >
                        Select Site Photos for this item *
                      </Button>
                    </label>
                    {!hasSitePhotos && (
                      <Typography variant="caption" sx={{ color: 'error.main', mt: 0.5, display: 'block' }}>
                        Site photos are required for this item
                      </Typography>
                    )}

                    {/* Existing Site Photos for this item */}
                    {getExistingSitePhotosForItem(existingSitePhotosPerItem, item.id).length > 0 && (
                      <Box sx={{ mt: 1, mb: 1 }}>
                        <Typography variant="body2" sx={{ color: '#666', mb: 1, fontWeight: 'bold' }}>
                          Existing site photos: {getExistingSitePhotosForItem(existingSitePhotosPerItem, item.id).length}
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          {getExistingSitePhotosForItem(existingSitePhotosPerItem, item.id).map((file, index) => {
                            const { url, fileName } = getFileUrlAndName(file, index, `Site Photo ${index + 1}`);
                            const fileUrl = resolveAttachmentUrl(url);
                            return (
                              <Chip
                                key={`existing-site-photo-${item.id}-${index}`}
                                label={fileName}
                                size="small"
                                color="success"
                                variant="outlined"
                                onClick={() => openFileInNewTab(fileUrl)}
                                onDelete={() => {
                                  setExistingSitePhotosPerItem(prev => {
                                    const key = String(item.id);
                                    const itemPhotos = [...getExistingSitePhotosForItem(prev, item.id)];
                                    itemPhotos.splice(index, 1);
                                    return { ...prev, [key]: itemPhotos };
                                  });
                                }}
                                sx={{ 
                                  cursor: 'pointer',
                                  '&:hover': {
                                    backgroundColor: '#e8f5e8',
                                  }
                                }}
                              />
                            );
                          })}
                        </Box>
                      </Box>
                    )}
                    
                    {/* New Site Photos for this item */}
                    {(sitePhotosPerItem[item.id] || []).length > 0 && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="body2" sx={{ color: '#666', mb: 1, fontWeight: 'bold' }}>
                          New files selected: {(sitePhotosPerItem[item.id] || []).length}
                        </Typography>
                        {(sitePhotosPerItem[item.id] || []).map((file, index) => (
                          <Chip
                            key={`site-photo-${item.id}-${index}`}
                            label={file.name}
                            size="small"
                            onDelete={() => {
                              setSitePhotosPerItem(prev => {
                                const list = [...(prev[item.id] || [])];
                                list.splice(index, 1);
                                return { ...prev, [item.id]: list };
                              });
                            }}
                            sx={{ mr: 1, mb: 1 }}
                          />
                        ))}
                      </Box>
                    )}
                  </Paper>
                  );
                })}
              </Box>
            ) : (
              <Typography variant="body2" sx={{ color: '#666', fontStyle: 'italic' }}>
                No request items available
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button 
            onClick={() => {
              setInvoiceModalOpen(false);
              setSelectedInvoiceRequest(null);
              setInvoiceFile(null);
              setDealerAcknowledgmentFile(null);
              setSitePhotosPerItem({});
              setExistingInvoiceFiles([]);
              setExistingDealerAcknowledgmentFiles([]);
              setExistingSitePhotosPerItem({});
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
            disabled={invoiceLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleInvoiceSubmit}
            variant="contained"
            color={selectedInvoiceRequest?.status === SHOPBOARD_REQUEST_STATUS.INVOICE_REJECTED ? 'error' : 'primary'}
            disabled={invoiceLoading || (
              // Invoice number is required
              !invoiceNumber || invoiceNumber.trim() === '' ||
              // Invoice file is required (new file or existing files)
              (!invoiceFile && (existingInvoiceFiles.length === 0)) ||
              // Dealer acknowledgment is required (new file or existing files)
              (!dealerAcknowledgmentFile && (existingDealerAcknowledgmentFiles.length === 0)) ||
              // Site photos are required for all request items
              (selectedInvoiceRequest?.requestItems && selectedInvoiceRequest.requestItems.length > 0 && 
                selectedInvoiceRequest.requestItems.some(item => {
                  const hasSitePhotos = (
                    (sitePhotosPerItem[item.id] && sitePhotosPerItem[item.id].length > 0) ||
                    getExistingSitePhotosForItem(existingSitePhotosPerItem, item.id).length > 0
                  );
                  return !hasSitePhotos;
                }))
            )}
          >
            {invoiceLoading 
              ? 'Uploading...' 
              : selectedInvoiceRequest?.status === SHOPBOARD_REQUEST_STATUS.INVOICE_REJECTED 
                ? 'Resubmit Invoice' 
                : 'Upload Invoice'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rejection Comments Modal */}
      <Dialog
        open={rejectionCommentsModalOpen}
        onClose={() => {
          setRejectionCommentsModalOpen(false);
          setSelectedRejectionRequest(null);
          setRejectionComments([]);
        }}
        aria-labelledby="rejection-comments-dialog-title"
        PaperProps={{
          sx: {
            backgroundColor: '#ffffff',
            minWidth: '500px',
            maxWidth: '700px',
            maxHeight: '80vh',
            overflow: 'auto',
          }
        }}
      >
        <DialogTitle 
          id="rejection-comments-dialog-title"
          sx={{ 
            color: 'error.main',
            fontWeight: 'bold',
          }}
        >
          Invoice Rejection Comments - Request #{selectedRejectionRequest?.id}
        </DialogTitle>
        <DialogContent>
          {loadingRejectionComments ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <Typography>Loading rejection comments...</Typography>
            </Box>
          ) : rejectionComments.length === 0 ? (
            <Box sx={{ textAlign: 'center', p: 4 }}>
              <Typography variant="body1" sx={{ color: '#666' }}>
                No rejection comments found for this request.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {rejectionComments.map((comment, index) => (
                <Box 
                  key={index} 
                  sx={{ 
                    p: 2, 
                    border: '1px solid #ffcdd2', 
                    borderRadius: 1, 
                    backgroundColor: '#ffebee' 
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                      {comment.user ? comment.user.username : 'Unknown User'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#666' }}>
                      {comment.created_at ? new Date(comment.created_at).toLocaleString() : 'Unknown Date'}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ color: '#333', mb: 1 }}>
                    {comment.comment}
                  </Typography>
                  <Chip 
                    label="Vendor Rejection" 
                    size="small" 
                    color="error" 
                    variant="outlined"
                  />
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button 
            onClick={() => {
              setRejectionCommentsModalOpen(false);
              setSelectedRejectionRequest(null);
              setRejectionComments([]);
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
          {selectedRejectionRequest && (
            <Button 
              onClick={() => {
                setRejectionCommentsModalOpen(false);
                handleEditInvoiceAfterRejection(selectedRejectionRequest);
              }}
              variant="contained"
              color="primary"
              sx={{ 
                minWidth: '140px'
              }}
            >
              Edit Invoice
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Request Rejection Comments Dialog */}
      <Dialog
        open={requestRejectionCommentsModalOpen}
        onClose={() => {
          setRequestRejectionCommentsModalOpen(false);
          setSelectedRequestRejection(null);
          setRequestRejectionCommentsList([]);
        }}
        aria-labelledby="request-rejection-comments-dialog-title"
        PaperProps={{
          sx: {
            backgroundColor: '#ffffff',
            minWidth: '500px',
            maxWidth: '700px',
            maxHeight: '80vh',
            overflow: 'auto',
          }
        }}
      >
        <DialogTitle
          id="request-rejection-comments-dialog-title"
          sx={{ color: 'error.main', fontWeight: 'bold' }}
        >
          Rejection Comments — Request #{selectedRequestRejection?.id}
        </DialogTitle>
        <DialogContent>
          {loadingRequestRejectionComments ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <Typography>Loading rejection comments...</Typography>
            </Box>
          ) : requestRejectionCommentsList.length === 0 ? (
            <Box sx={{ textAlign: 'center', p: 4 }}>
              <Typography variant="body1" sx={{ color: '#666' }}>
                No rejection comments found for this request.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {requestRejectionCommentsList.map((comment, index) => (
                <Box
                  key={index}
                  sx={{
                    p: 2,
                    border: '1px solid #ffcdd2',
                    borderRadius: 1,
                    backgroundColor: '#fff8f8'
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#b71c1c' }}>
                      {comment.user ? comment.user.username : 'Unknown User'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#666' }}>
                      {comment.created_at ? new Date(comment.created_at).toLocaleString() : 'Unknown Date'}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ color: '#333' }}>
                    {comment.comment}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => {
              setRequestRejectionCommentsModalOpen(false);
              setSelectedRequestRejection(null);
              setRequestRejectionCommentsList([]);
            }}
            variant="outlined"
            sx={{
              color: '#666',
              borderColor: '#ddd',
              '&:hover': { borderColor: '#999', backgroundColor: '#f5f5f5' }
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Invoice Viewer Modal */}
      <InvoiceViewer
        open={invoiceViewerModalOpen}
        onClose={() => setInvoiceViewerModalOpen(false)}
        invoiceData={selectedInvoiceViewerRequest?.invoice}
        requestId={selectedInvoiceViewerRequest?.id}
        requestItems={selectedInvoiceViewerRequest?.requestItems}
        invoiceNumber={selectedInvoiceViewerRequest?.invoice_number}
        invoiceDate={selectedInvoiceViewerRequest?.invoice_date}
        invoice_files_data={selectedInvoiceViewerRequest?.invoice_files_data}
        dealer_acknowledgment_files_data={selectedInvoiceViewerRequest?.dealer_acknowledgment_files_data}
        invoice_site_photos_by_item_data={selectedInvoiceViewerRequest?.invoice_site_photos_by_item_data}
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
