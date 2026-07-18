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
  Checkbox,
  Badge,
  CircularProgress,
  Avatar,
  Backdrop,
} from '@mui/material';
import CommentsDialog from '../components/CommentsDialog';
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Assignment as AssignIcon,
  Description as RequestIcon,
  Refresh as ReviewAgainIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Comment as CommentIcon,
  Send as SendToCEOIcon,
  SupervisorAccount as SendToDirectorsIcon,
  GroupAdd as SendToAdditionalDirectorsIcon,
  History as HistoryIcon,
  Visibility as VisibilityIcon,
  Print as PrintIcon,
  Gavel as ManualApprovalIcon,
  Payment as PaymentIcon,
  Receipt as InvoiceIcon,
  ReceiptLong as ReceiptLongIcon,
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
import RejectInvoiceModal from '../components/RejectInvoiceModal';
import PaymentSummaryModal from '../components/PaymentSummaryModal';
import RequestDetailsWithInvoiceModal from '../components/RequestDetailsWithInvoiceModal';
import ShopboardRequestFilters from '../components/ShopboardRequestFilters';
import OldPurchasesModal from '../components/OldPurchasesModal';
import { BASE_URL, BASENAME } from "../constants/Constants";
import { 
  SHOPBOARD_REQUEST_STATUS, 
  getStatusDisplayName, 
  getStatusColor as getStatusColorHelper 
} from "../constants/ShopboardRequestStatus";
import { useApi } from '../hooks/useApi';
import jsPDF from 'jspdf';

const INITIAL_PAGE_SIZE = 10;

// Normalize file item from API: either { url, fileName, mimeType } (new) or legacy string (path/data URL)
function getFileUrlAndName(item, index, fallbackLabel) {
  if (item == null) return { url: '', fileName: fallbackLabel };
  if (typeof item === 'object' && item.url != null) {
    return { url: item.url, fileName: item.fileName || fallbackLabel };
  }
  const str = typeof item === 'string' ? item : '';
  const fileName = str.startsWith('data:') ? fallbackLabel : str.split('/').pop() || fallbackLabel;
  return { url: str, fileName };
}

// Open file in new tab. For data URLs use blob URL so the image/PDF actually loads (window.open(longDataUrl) often fails).
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

/** Matches Created By column: username, then card name if username empty */
function getShopboardCreatedByDisplay(row) {
  const c = row?.creator;
  if (!c) return 'N/A';
  const u = c.username != null && String(c.username).trim() !== '' ? String(c.username).trim() : '';
  if (u) return u;
  const card = c.card_name != null && String(c.card_name).trim() !== '' ? String(c.card_name).trim() : '';
  return card || 'N/A';
}

/** Sales head must have a real director user id (avoids Number(null) === 0) */
function shopboardRowHasAssignedDirector(row) {
  const c = row?.creator;
  if (!c) return false;
  if (c.director_id == null || c.director_id === '') return false;
  const n = Number(c.director_id);
  return Number.isFinite(n) && n > 0;
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

export default function AreaHeadRequests() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const { user, hasPermission, token } = useAuth();
  
  // Check user permissions - using web permissions for shopboardRequest
  const hasReadPermission = user?.permissions?.shopboardRequest?.includes('read') || false;
  const hasReadApprovedRequestPermission = user?.permissions?.shopboardRequest?.includes('read_approved_request') || false;
  // User can read if they have either full read or read_approved_request permission
  const canRead = hasReadPermission || hasReadApprovedRequestPermission;
  // Check if user only has read_approved_request (not full read)
  const onlyReadApprovedRequest = hasReadApprovedRequestPermission && !hasReadPermission;
  const canUpdate = user?.permissions?.shopboardRequest?.includes('update') || false;
  const canApprove = canUpdate; // Approve is an update operation
  const canReject = canUpdate; // Reject is an update operation
  const canAssign = canUpdate; // Assign is an update operation
  const canApprovalAction = user?.permissions?.shopboardRequest?.includes('approvals') || false;
  const canAddComment = user?.permissions?.shopboardRequest?.includes('add_comment') || false;
  const canPrint = user?.permissions?.shopboardRequest?.includes('print') || false;
  const canManualApproval = user?.permissions?.shopboardRequest?.includes('manual_approval') || false;
  const canPaymentRelease = user?.permissions?.shopboardRequest?.includes('payment_release') || false;

  const { get, post, put, patch, del, upload } = useApi();

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
  // Backend should include vendor information in the shopboard request response
  const getVendorName = React.useCallback((row) => {
    // Check if vendor object exists in the response (backend should include this)
    if (row.vendor && row.vendor.card_name) {
      return row.vendor.card_name;
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
  
  // Combined modal state for request details with invoice (for read_approved_request users)
  const [combinedModalOpen, setCombinedModalOpen] = React.useState(false);
  const [selectedCombinedRequest, setSelectedCombinedRequest] = React.useState(null);
  
  // Edit modal state
  const [editModalOpen, setEditModalOpen] = React.useState(false);
  const [editingRequest, setEditingRequest] = React.useState(null);
  const [editFormData, setEditFormData] = React.useState({});
  const [budgetWarning, setBudgetWarning] = React.useState(null);
  const [checkingBudget, setCheckingBudget] = React.useState(false);
  // Store current month budget data (fetched once on page load)
  const [currentMonthBudget, setCurrentMonthBudget] = React.useState(null);

  // Manual approval modal state
  const [manualApprovalModalOpen, setManualApprovalModalOpen] = React.useState(false);
  const [manualApprovalReason, setManualApprovalReason] = React.useState('');
  const [manualApprovalFile, setManualApprovalFile] = React.useState(null);
  const [manualApprovalLoading, setManualApprovalLoading] = React.useState(false);
  
  // View manual approval modal state
  const [viewManualApprovalModalOpen, setViewManualApprovalModalOpen] = React.useState(false);
  const [selectedManualApprovalRequest, setSelectedManualApprovalRequest] = React.useState(null);

  // Selection state for manual approval
  const [selectedRequests, setSelectedRequests] = React.useState([]);
  const [showSelectionColumn, setShowSelectionColumn] = React.useState(false);

  // Loading full request details (when opening details/invoice/manual approval/edit)
  const [loadingRequestDetails, setLoadingRequestDetails] = React.useState(false);

  // Invoice viewer modal state
  const [invoiceModalOpen, setInvoiceModalOpen] = React.useState(false);
  const [selectedInvoiceRequest, setSelectedInvoiceRequest] = React.useState(null);
  // Reject invoice modal state
  const [rejectInvoiceModalOpen, setRejectInvoiceModalOpen] = React.useState(false);
  const [rejectInvoiceTarget, setRejectInvoiceTarget] = React.useState(null);
  
  // Payment summary modal state
  const [paymentSummaryModalOpen, setPaymentSummaryModalOpen] = React.useState(false);
  const [paymentSummaryData, setPaymentSummaryData] = React.useState(null);
  
  // Old purchases modal state
  const [oldPurchasesModalOpen, setOldPurchasesModalOpen] = React.useState(false);
  const [selectedDealerForOldPurchases, setSelectedDealerForOldPurchases] = React.useState(null);
  
  // File upload state for edit modal
  const [sitePhotos, setSitePhotos] = React.useState([]);
  const [oldBoardPhotos, setOldBoardPhotos] = React.useState([]);
  const [existingSitePhotos, setExistingSitePhotos] = React.useState([]);
  const [existingOldBoardPhotos, setExistingOldBoardPhotos] = React.useState([]);

  // Action confirmation dialogs
  const [approveDialogOpen, setApproveDialogOpen] = React.useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = React.useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = React.useState(false);
  const [reviewAgainDialogOpen, setReviewAgainDialogOpen] = React.useState(false);
  const [commentsDialogOpen, setCommentsDialogOpen] = React.useState(false);
  const [sendToCEODialogOpen, setSendToCEODialogOpen] = React.useState(false);
  const [addCommentDialogOpen, setAddCommentDialogOpen] = React.useState(false);
  const [requestToAction, setRequestToAction] = React.useState(null);
  
  // Comment state for rejection
  const [rejectionComment, setRejectionComment] = React.useState('');
  
  // Comment state for adding comments
  const [newComment, setNewComment] = React.useState('');
  
  // Comments state for viewing vendor rejection comments
  const [requestComments, setRequestComments] = React.useState([]);
  const [loadingComments, setLoadingComments] = React.useState(false);

  // Rejection comments state
  const [rejectionCommentsDialogOpen, setRejectionCommentsDialogOpen] = React.useState(false);
  const [rejectionCommentsList, setRejectionCommentsList] = React.useState([]);
  const [loadingRejectionComments, setLoadingRejectionComments] = React.useState(false);
  
  // Marketing comments state for ceo_pending requests
  const [marketingComments, setMarketingComments] = React.useState([]);
  const [loadingMarketingComments, setLoadingMarketingComments] = React.useState(false);
  const [marketingCommentsDialogOpen, setMarketingCommentsDialogOpen] = React.useState(false);
  
  // History state for viewing request history
  const [historyDialogOpen, setHistoryDialogOpen] = React.useState(false);
  const [requestHistory, setRequestHistory] = React.useState([]);
  const [loadingHistory, setLoadingHistory] = React.useState(false);
  // For history enrichment (reuse existing dealers state below)
  const [vendorsLookup, setVendorsLookup] = React.useState([]);
  const [warrantyStatusesHistory, setWarrantyStatusesHistory] = React.useState([]);

  // Vendors state for assign dialog
  const [vendors, setVendors] = React.useState([]);
  const [loadingVendors, setLoadingVendors] = React.useState(false);
  const [vendorsError, setVendorsError] = React.useState(null);
  const [selectedVendor, setSelectedVendor] = React.useState(null);
  const [vendorComment, setVendorComment] = React.useState('');
  
  // Dropdown options for edit form
  const [dealers, setDealers] = React.useState([]);
  const [requestTypes, setRequestTypes] = React.useState([]);
  const [warrantyStatuses, setWarrantyStatuses] = React.useState([]);
  const [loadingDropdowns, setLoadingDropdowns] = React.useState(false);

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
  }, [canRead, navigate]);

  // API call to fetch vendors from users table (SAP users) filtered by dealer district
  const fetchVendors = React.useCallback(async (dealerDistrict = null) => {
    setLoadingVendors(true);
    setVendorsError(null);
    
    try {
      // Build API URL with district filter if provided
      let apiUrl = '/api/sap-users';
      if (dealerDistrict) {
        apiUrl += `?district=${encodeURIComponent(dealerDistrict)}`;
      }
      
      const response = await get(apiUrl);
      
      if (response.success && Array.isArray(response.data)) {
        // Transform SAP users to vendor format for compatibility
        // Note: regions is now an array (many-to-many relationship)
        let vendorData = response.data.map(user => ({
          id: user.id,
          name: user.card_name || user.username,
          username: user.username,
          card_name: user.card_name,
          contact_person: user.contact_person,
          cellular: user.cellular,
          phone: user.phone,
          address: user.address,
          region: user.regions && user.regions.length > 0 ? user.regions[0] : null, // Use first region for backward compatibility
          regions: user.regions || [], // Include all regions
          is_sap: user.is_sap
        }));
        
        setVendors(vendorData);
        console.log(`SAP vendors loaded for district "${dealerDistrict || 'all'}":`, vendorData.length, 'vendors');
      } else {
        throw new Error('Invalid vendors data format');
      }
    } catch (error) {
      setVendorsError(error.message || 'Failed to load vendors');
      toast.error('Failed to load vendors', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      console.error('Error loading vendors:', error);
    } finally {
      setLoadingVendors(false);
    }
  }, [get]);

  // Load vendors when assign dialog opens
  React.useEffect(() => {
    if (assignDialogOpen && requestToAction?.dealer?.district) {
      fetchVendors(requestToAction.dealer.district);
    }
  }, [assignDialogOpen, fetchVendors, requestToAction]);

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

  // Fetch current month budget data once on page load
  const fetchCurrentMonthBudget = React.useCallback(async () => {
    try {
      const response = await get('/api/budget-management/current-month');
      if (response?.success && response.data) {
        setCurrentMonthBudget(response.data);
      } else {
        setCurrentMonthBudget(null);
      }
    } catch (error) {
      console.error('Error fetching current month budget:', error);
      setCurrentMonthBudget(null);
    }
  }, [get]);

  // Calculate total cost from request items
  const calculateTotalCost = React.useCallback((requestItems, requestTypes) => {
    if (!requestItems || !Array.isArray(requestItems)) return 0;
    
    const total = requestItems.reduce((sum, it) => {
      const selectedRequestType = requestTypes.find(rt => rt.id === it.request_type_id);
      const isFees = selectedRequestType?.request_type === 'fees';
      
      // For fees type: use price directly
      if (isFees) {
        const price = parseFloat(it.price) || 0;
        return sum + (isNaN(price) ? 0 : price);
      }
      
      // For manual and fixed: calculate area × price_per_sqft
      const widthFt = parseFloat(it.width) || 0;
      const heightFt = parseFloat(it.height) || 0;
      const areaSqft = widthFt * heightFt;
      const pricePerSqft = parseFloat(it.price_per_sqft) || 0;
      const itemTotal = areaSqft * pricePerSqft;
      return sum + (isNaN(itemTotal) ? 0 : itemTotal);
    }, 0);
    
    return total;
  }, []);

  // Check budget status for a request (uses current month budget data)
  const checkBudgetStatus = React.useCallback((requestId, requestTotalCost) => {
    if (!requestId || !currentMonthBudget || !currentMonthBudget.hasBudget) {
      setBudgetWarning(null);
      return;
    }

    // Calculate if this request would exceed budget
    const totalWithRequest = currentMonthBudget.utilizedBudget + requestTotalCost;
    const epsilon = 0.01;
    const wouldExceed = (totalWithRequest - currentMonthBudget.availableBudget) > epsilon;

    if (wouldExceed) {
      const message = `⚠️ Budget Exceeded for ${currentMonthBudget.month}/${currentMonthBudget.year}\n\nAvailable Budget (including carry forward): Rs ${currentMonthBudget.availableBudget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nUtilized Budget: Rs ${currentMonthBudget.utilizedBudget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nRequest Cost: Rs ${requestTotalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\nTotal after adding this request: Rs ${totalWithRequest.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      setBudgetWarning(message);
    } else {
      setBudgetWarning(null);
    }
  }, [currentMonthBudget]);

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

      // Check budget status only if approval_date is null
      if (!editingRequest.approval_date && editingRequest.total_cost) {
        const requestTotalCost = parseFloat(editingRequest.total_cost) || 0;
        checkBudgetStatus(editingRequest.id, requestTotalCost);
      } else {
        setBudgetWarning(null);
      }
    }
  }, [editModalOpen, editingRequest, checkBudgetStatus, loadDropdownData, loadAllowedRequestTypes]);

  // Recalculate budget warning when editFormData.request_items or requestTypes change
  React.useEffect(() => {
    if (editModalOpen && editingRequest && !editingRequest.approval_date && editFormData.request_items && requestTypes.length > 0) {
      const calculatedTotalCost = calculateTotalCost(editFormData.request_items, requestTypes);
      checkBudgetStatus(editingRequest.id, calculatedTotalCost);
    } else if (editModalOpen && editingRequest && editingRequest.approval_date) {
      // Clear warning if approval_date exists
      setBudgetWarning(null);
    }
  }, [editModalOpen, editingRequest, editFormData.request_items, requestTypes, calculateTotalCost, checkBudgetStatus]);


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

  // API call to fetch shopboard requests
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
      
      // Add status filter if selected
      if (filters.status && filters.status.value) {
        queryParams.append('status', filters.status.value);
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
        queryParams.append('sales_head_code', filters.salesHead.sh_codes[0]);
      }
      
      const apiUrl = `/api/shopboard-requests?${queryParams.toString()}`;
      
      const requestData = await get(apiUrl);
      
      // Handle the API response format: { success: true, data: [...], totalCount: number }
      let requestsData = [];
      if (requestData.success && requestData.data && Array.isArray(requestData.data)) {
        requestsData = requestData.data;
      } else if (requestData.requests && Array.isArray(requestData.requests)) {
        // Fallback for different response format
        requestsData = requestData.requests;
      } else if (Array.isArray(requestData)) {
        // Fallback for direct array response
        requestsData = requestData;
      }

      // Filter requests if user has read_approved_request permission
      // They should ONLY see "Submitted for Payment" status requests
      if (hasReadApprovedRequestPermission) {
        // Only show requests with "Submitted for Payment" status
        requestsData = requestsData.filter(request => {
          const status = request.status;
          if (!status) return false;
          // Check if status is "Submitted for Payment" (case-insensitive)
          const statusLower = String(status).toLowerCase().trim();
          return statusLower === 'submitted for payment';
        });
      }

      // Update state with filtered data
      // Use totalCount from API response if available, otherwise use data length
      const totalCount = requestData.totalCount || requestData.count || requestsData.length;
      
      setRowsState({
        rows: requestsData,
        rowCount: totalCount,
      });

      // Check if any request has selectable status based on user permissions
      let shouldShowSelection = false;
      if (canManualApproval) {
        // Show selection column if there are:
        // - ceo_pending requests (where email not sent)
        // - invoice_sent requests (always)
        const hasCeoPending = requestsData.some(request => request.status === 'ceo_pending' && request.is_email !== true);
        const hasInvoiceSent = requestsData.some(request => request.status === 'invoice_sent');
        shouldShowSelection = hasCeoPending || hasInvoiceSent;
      }
      if (canPaymentRelease) {
        const hasSubmittedForPayment = requestsData.some(request => request.status === SHOPBOARD_REQUEST_STATUS.SUBMITTED_FOR_PAYMENT);
        shouldShowSelection = shouldShowSelection || hasSubmittedForPayment;
      }
      setShowSelectionColumn(shouldShowSelection);

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
  }, [paginationModel, get, canRead, onlyReadApprovedRequest, filters]);

  // Fetch full request by ID. includeFiles: 'details' | 'invoice' | 'manual_approval' loads only those file sets.
  const fetchFullRequest = React.useCallback(async (id, includeFiles) => {
    const url = includeFiles ? `/api/shopboard-requests/${id}?includeFiles=${encodeURIComponent(includeFiles)}` : `/api/shopboard-requests/${id}`;
    const res = await get(url);
    if (res?.success && res?.data) return res.data;
    throw new Error('Failed to load request details');
  }, [get]);

  // Load data when component mounts or pagination changes
  React.useEffect(() => {
    loadRequests();
    // Fetch current month budget data once on page load
    fetchCurrentMonthBudget();
  }, [loadRequests, fetchCurrentMonthBudget]);

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
      const includeFiles = hasReadApprovedRequestPermission ? 'details,invoice' : 'details';
      const full = await fetchFullRequest(requestData.id, includeFiles);
      if (hasReadApprovedRequestPermission) {
        setSelectedCombinedRequest(full);
        setCombinedModalOpen(true);
      } else {
        setSelectedDetailedRequest(full);
        setDetailedViewModalOpen(true);
      }
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
  }, [hasReadApprovedRequestPermission, fetchFullRequest]);

  const handleEdit = React.useCallback(async (requestData) => {
    if (!canUpdate) return;
    setLoadingRequestDetails(true);
    try {
      // Edit modal: includeFiles=edit (site_photo, old_board_photo, vendor_quotation only; no survey_form)
      const full = await fetchFullRequest(requestData.id, 'edit');
      setEditingRequest(full);

      const processedItems = (full.requestItems || []).map(item => {
        return {
          id: item.id,
          temp_id: item.temp_id,
          request_type_id: item.request_type_id,
          width: item.width !== null && item.width !== undefined ? String(item.width) : '',
          height: item.height !== null && item.height !== undefined ? String(item.height) : '',
          price: item.price,
          price_per_sqft: item.price_per_square_foot !== null && item.price_per_square_foot !== undefined
            ? String(item.price_per_square_foot)
            : ''
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

  const handleApprove = React.useCallback((requestData) => {
    if (!canApprove) return;
    setRequestToAction(requestData);
    setApproveDialogOpen(true);
  }, [canApprove]);

  const handleReject = React.useCallback((requestData) => {
    if (!canReject) return;
    setRequestToAction(requestData);
    setRejectDialogOpen(true);
  }, [canReject]);

  const handleAssign = React.useCallback((requestData) => {
    if (!canAssign) return;
    
    // Allow assignment for both processing and not decided requests
    if (requestData.status !== 'processing' && requestData.status !== 'not decided') {
      toast.error('Only processing or not decided requests can be assigned to vendors', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      return;
    }
    
    setRequestToAction(requestData);
    setAssignDialogOpen(true);
  }, [canAssign]);

  const handleReviewAgain = React.useCallback((requestData) => {
    if (!canUpdate) return; // Review again requires update permission
    
    // Only allow review again for review requested status
    if (requestData.status !== 'review requested') {
      toast.error('Only review requested status can be reviewed again', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      return;
    }
    
    setRequestToAction(requestData);
    setReviewAgainDialogOpen(true);
  }, [canUpdate]);

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

  const handleSendToCEO = React.useCallback((requestData) => {
    if (!canUpdate) return;
    
    setRequestToAction(requestData);
    setSendToCEODialogOpen(true);
  }, [canUpdate]);

  const handleAddComment = React.useCallback((requestData) => {
    if (!canAddComment) return;
    
    setRequestToAction(requestData);
    setNewComment(''); // Clear previous comment
    setAddCommentDialogOpen(true);
  }, [canAddComment]);

  const handleViewMarketingComments = React.useCallback((requestData) => {
    if (!canRead) return;
    
    setRequestToAction(requestData);
    setMarketingCommentsDialogOpen(true);
    fetchMarketingComments(requestData.id);
  }, [canRead]);

  const handleViewAndSendMessages = React.useCallback(async (requestData) => {
    if (!canAddComment) return;
    
    setRequestToAction(requestData);
    setMarketingCommentsDialogOpen(true);
    
    // Mark comments as read when opening the dialog
    try {
      await post(`/api/comments/mark-read/${requestData.id}`);
      // Refresh requests to update unread count
      loadRequests();
    } catch (error) {
      console.error('Error marking comments as read:', error);
      // Continue even if marking as read fails
    }
    
    fetchMarketingComments(requestData.id);
  }, [canAddComment, post, loadRequests]);

  const handlePrint = React.useCallback((requestData) => {
    if (!canPrint) return;
    
    generatePDF(requestData);
  }, [canPrint]);

  const handleManualApproval = React.useCallback(async (requestData) => {
    if (!canManualApproval) return;
    setLoadingRequestDetails(true);
    try {
      const full = await fetchFullRequest(requestData.id, 'manual_approval');
      setSelectedRequest(full);
      setManualApprovalModalOpen(true);
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
  }, [canManualApproval, fetchFullRequest]);

  const handleViewManualApproval = React.useCallback(async (requestData) => {
    if (!canRead) return;
    setLoadingRequestDetails(true);
    try {
      const full = await fetchFullRequest(requestData.id, 'manual_approval');
      setSelectedManualApprovalRequest(full);
      setViewManualApprovalModalOpen(true);
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

  const handleViewInvoice = React.useCallback(async (requestData) => {
    if (!canRead) return;
    setLoadingRequestDetails(true);
    try {
      const includeFiles = hasReadApprovedRequestPermission ? 'details,invoice' : 'invoice';
      const full = await fetchFullRequest(requestData.id, includeFiles);
      if (hasReadApprovedRequestPermission) {
        setSelectedCombinedRequest(full);
        setCombinedModalOpen(true);
      } else {
        setSelectedInvoiceRequest(full);
        setInvoiceModalOpen(true);
      }
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
  }, [canRead, hasReadApprovedRequestPermission, fetchFullRequest]);

  const handleOpenRejectInvoice = React.useCallback((requestData) => {
    if (!canApprovalAction) return;
    setRejectInvoiceTarget(requestData);
    setRejectInvoiceModalOpen(true);
  }, [canApprovalAction]);

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

  // Open payment summary modal for selected "Submitted for Payment" requests
  const handleOpenPaymentSummary = React.useCallback(() => {
    if (!canPaymentRelease || !selectedRequests || selectedRequests.length === 0) return;
    
    const selectedRequestObjects = filteredRows.filter(row => selectedRequests.includes(row.id));
    const submittedForPaymentRequests = selectedRequestObjects.filter(
      req => req.status === SHOPBOARD_REQUEST_STATUS.SUBMITTED_FOR_PAYMENT
    );
    
    if (submittedForPaymentRequests.length === 0) {
      toast.warning('Please select requests with "Submitted for Payment" status', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      return;
    }
    
    // Calculate total and prepare individual invoice data
    const totalAmount = submittedForPaymentRequests.reduce((sum, req) => {
      const cost = parseFloat(req.total_cost) || 0;
      return sum + cost;
    }, 0);
    
    const invoiceDetails = submittedForPaymentRequests.map(req => ({
      id: req.id,
      dealerName: req.dealer?.name || 'N/A',
      dealerCode: req.dealer?.code || 'N/A',
      vendorName: getVendorName(req),
      totalCost: parseFloat(req.total_cost) || 0,
      created_at: req.created_at,
      invoiceNumber: req.invoice_number || null,
      invoiceDate: req.invoice_date || null,
    }));
    
    setPaymentSummaryData({
      totalAmount,
      invoiceDetails,
      requestIds: submittedForPaymentRequests.map(req => req.id),
      fullRequestsData: submittedForPaymentRequests, // Include full request data for Excel generation
    });
    setPaymentSummaryModalOpen(true);
  }, [canPaymentRelease, selectedRequests, filteredRows, getVendorName]);

  const handleConfirmRejectInvoice = React.useCallback(async (comment) => {
    if (!rejectInvoiceTarget) return;
    
    setIsLoading(true);
    try {
      const response = await post(`/api/shopboard-requests/${rejectInvoiceTarget.id}/reject-invoice`, {
        comment: comment || ''
      });

      if (response.success) {
        toast.success(`Invoice rejected successfully for request #${rejectInvoiceTarget.id}!`, {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
        
        setRejectInvoiceModalOpen(false);
        setRejectInvoiceTarget(null);
        loadRequests();
      } else {
        throw new Error(response.message || 'Failed to reject invoice');
      }
    } catch (error) {
      console.error('Error rejecting invoice:', error);
      toast.error(`Failed to reject invoice: ${error.message}`, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } finally {
      setIsLoading(false);
    }
  }, [rejectInvoiceTarget, post, loadRequests]);

  const handleManualApprovalSubmit = React.useCallback(async () => {
    if (!selectedRequest) return;
    
    // Validate manual approval reason is provided
    if (!manualApprovalReason || manualApprovalReason.trim() === '') {
      toast.error('Manual approval reason is required', {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      return;
    }
    
    setManualApprovalLoading(true);
    try {
      // Create FormData for file upload
      const formData = new FormData();
      
      // Add request data
      formData.append('request_id', selectedRequest.id);
      formData.append('manual_approval_reason', manualApprovalReason);
      
      // Add file if provided
      if (manualApprovalFile) {
        formData.append('manual_approval_file', manualApprovalFile);
      }

      // Call the manual approval API with FormData
      const response = await upload(`/api/shopboard-requests/${selectedRequest.id}/approvals/manual-approve`, formData);

      if (response.success) {
        toast.success('Manual approval submitted successfully!', {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
        
        // Close modal and reset form
        setManualApprovalModalOpen(false);
        setManualApprovalReason('');
        setManualApprovalFile(null);
        setSelectedRequest(null);
        
        // Refresh the data
        loadRequests();
      } else {
        throw new Error(response.message || 'Manual approval failed');
      }
    } catch (error) {
      console.error('Error submitting manual approval:', error);
      toast.error('Failed to submit manual approval. Please try again.', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } finally {
      setManualApprovalLoading(false);
    }
  }, [selectedRequest, manualApprovalReason, manualApprovalFile, upload, loadRequests]);

  // Bulk send to CEO handler
  const handleBulkSendToCEO = React.useCallback(async () => {
    if (!selectedRequests || selectedRequests.length === 0) return;
    
    // Get selected request objects
    const selectedRequestObjects = filteredRows.filter(row => selectedRequests.includes(row.id));
    
    // Filter to only ceo_pending status requests (as per button logic) and exclude requests where email already sent
    const ceoPendingRequests = selectedRequestObjects.filter(req => 
      req.status === 'ceo_pending' && req.is_email !== true
    );
    
    if (ceoPendingRequests.length === 0) {
      const hasEmailSent = selectedRequestObjects.some(req => req.is_email === true);
      if (hasEmailSent) {
        toast.warning('Cannot send email for requests that have already been sent. Please deselect those requests.', {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      } else {
        toast.warning('Please select requests with "CEO Pending" status to send for approval', {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      }
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Generate view tokens and reject tokens for each request
      const requestsWithTokens = await Promise.all(
        ceoPendingRequests.map(async (request) => {
          try {
            const [viewTokenResponse, rejectTokenResponse] = await Promise.all([
              get(`/api/shopboard-requests/${request.id}/generate-view-token`),
              get(`/api/shopboard-requests/${request.id}/generate-reject-token`)
            ]);
            return {
              ...request,
              viewToken: viewTokenResponse.success ? viewTokenResponse.data.token : null,
              rejectToken: rejectTokenResponse.success ? rejectTokenResponse.data.token : null
            };
          } catch (error) {
            console.error(`Error generating tokens for request ${request.id}:`, error);
            return {
              ...request,
              viewToken: null,
              rejectToken: null
            };
          }
        })
      );
      
      // Transform requests to email template format
      const emailRequests = requestsWithTokens.map(request => ({
        id: request.id,
        dealerName: request.dealer?.name || 'N/A',
        dealerRegion: request.dealer?.district || 'N/A',
        vendorName: request.vendor?.card_name || request.vendor_name || 'N/A',
        totalCost: request.total_cost || 0,
        viewToken: request.viewToken, // Include token for URL generation
        rejectToken: request.rejectToken, // Include reject token for URL generation
        requestItems: (request.requestItems || []).map(item => ({
          requestType: {
            name: `${item.requestType?.name || 'N/A'}(${item.width || 'N/A'} x ${item.height || 'N/A'})`
          },
          width: item.width,
          height: item.height
        }))
      }));
      
      // Prepare email template data
      // Include BASENAME (/ShopBoard) in baseUrl for correct routing on Tomcat
      const baseUrlWithPath = (window.location.origin || 'http://localhost:3000') + BASENAME;
      const templateData = {
        ceoName: 'CEO Name',
        senderName: 'Marketing Team',
        senderDesignation: 'Marketing Manager',
        department: 'Marketing Department',
        baseUrl: baseUrlWithPath,
        backendUrl: BASE_URL, // Backend API URL for reject endpoint
        requests: emailRequests
      };
      
      // Send email via queue system
      // Default recipient: ahmadraza46789@gmail.com (CEO email)
      const emailResponse = await post('/api/email/shopboard-approval', {
        to: 'ahmadraza46789@gmail.com', // Default CEO email recipient
        subject: 'Shop Board Request - Approval Required',
        templateData: templateData
      });
      
      if (emailResponse.success) {
        toast.success(`Email queued successfully! ${ceoPendingRequests.length} request(s) will be sent to CEO shortly.`, {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
        
        // Clear selection and refresh data
        setSelectedRequests([]);
        loadRequests();
      } else {
        throw new Error(emailResponse.message || 'Failed to send email');
      }
    } catch (error) {
      console.error('Error sending email to CEO:', error);
      toast.error(`Failed to send email: ${error.message}`, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedRequests, filteredRows, post, loadRequests, get]);

  // Bulk notify directors (same tab permission as Send to CEO for Approval: manual_approval)
  const handleBulkSendToDirectors = React.useCallback(async () => {
    if (!canManualApproval) return;
    if (!selectedRequests || selectedRequests.length === 0) return;

    const selectedRequestObjects = filteredRows.filter((row) => selectedRequests.includes(row.id));
    const ceoPendingOnly = selectedRequestObjects.filter((req) => req.status === 'ceo_pending');

    if (ceoPendingOnly.length === 0) {
      toast.warning('Please select one or more requests with "CEO Pending" status.', {
        position: 'top-right',
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      return;
    }

    if (ceoPendingOnly.length !== selectedRequestObjects.length) {
      toast.warning('Send to Directors only applies to CEO Pending requests. Deselect other statuses.', {
        position: 'top-right',
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      return;
    }

    const missingDirector = ceoPendingOnly.filter((req) => !shopboardRowHasAssignedDirector(req));
    if (missingDirector.length > 0) {
      const lines = missingDirector.map(
        (r) => `Request #${r.id} — Created by: ${getShopboardCreatedByDisplay(r)} (no director assigned)`
      );
      const maxLines = 25;
      const shown = lines.slice(0, maxLines);
      const overflow = lines.length > maxLines ? `\n… and ${lines.length - maxLines} more` : '';
      toast.warning(
        `Assign a director in Sales Head Management for these sales heads first.\n\n${shown.join('\n')}${overflow}`,
        {
          position: 'top-right',
          autoClose: 10000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          style: { whiteSpace: 'pre-line' },
        }
      );
      return;
    }

    const baseUrlWithPath = (window.location.origin || 'http://localhost:3000') + BASENAME;

    setIsLoading(true);
    try {
      const byDirectorId = new Map();
      for (const req of ceoPendingOnly) {
        const did = Number(req.creator.director_id);
        if (!byDirectorId.has(did)) byDirectorId.set(did, []);
        byDirectorId.get(did).push(req);
      }

      const groups = await Promise.all(
        [...byDirectorId.entries()].map(async ([directorId, reqs]) => {
          const requestsWithTokens = await Promise.all(
            reqs.map(async (request) => {
              try {
                const [viewTokenResponse, rejectTokenResponse] = await Promise.all([
                  get(`/api/shopboard-requests/${request.id}/generate-view-token`),
                  get(`/api/shopboard-requests/${request.id}/generate-reject-token`),
                ]);
                return {
                  ...request,
                  viewToken: viewTokenResponse.success ? viewTokenResponse.data.token : null,
                  rejectToken: rejectTokenResponse.success ? rejectTokenResponse.data.token : null,
                };
              } catch (err) {
                console.error(`Error generating tokens for request ${request.id}:`, err);
                return { ...request, viewToken: null, rejectToken: null };
              }
            })
          );

          const emailRequests = requestsWithTokens.map((request) => ({
            id: request.id,
            dealerName: request.dealer?.name || 'N/A',
            dealerRegion: request.dealer?.district || 'N/A',
            vendorName: request.vendor?.card_name || request.vendor_name || 'N/A',
            totalCost: request.total_cost || 0,
            viewToken: request.viewToken,
            rejectToken: request.rejectToken,
            requestItems: (request.requestItems || []).map((item) => ({
              requestType: {
                name: `${item.requestType?.name || 'N/A'}(${item.width || 'N/A'} x ${item.height || 'N/A'})`,
              },
              width: item.width,
              height: item.height,
            })),
          }));

          return {
            directorId,
            baseUrl: baseUrlWithPath,
            backendUrl: BASE_URL,
            requests: emailRequests,
          };
        })
      );

      const response = await post('/api/shopboard-requests/send-to-directors', { groups });

      if (response.success) {
        toast.success(
          response.message ||
            `Director notification queued for ${ceoPendingOnly.length} request(s).`,
          {
            position: 'top-right',
            autoClose: 4000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          }
        );
        setSelectedRequests([]);
        loadRequests();
      } else {
        throw new Error(response.message || 'Failed to notify directors');
      }
    } catch (error) {
      let displayMessage = error.message || 'Failed to notify directors';
      try {
        const parsed = JSON.parse(error.message);
        if (parsed && typeof parsed === 'object') {
          if (parsed.message) displayMessage = parsed.message;
          if (Array.isArray(parsed.issues) && parsed.issues.length > 0) {
            const rowById = new Map(ceoPendingOnly.map((r) => [r.id, r]));
            const createdBySuffix = (requestId) => {
              const row = requestId != null ? rowById.get(requestId) : null;
              const label = row ? getShopboardCreatedByDisplay(row) : null;
              return label && label !== 'N/A' ? ` — Created by: ${label}` : '';
            };
            const lines = parsed.issues.map((i) => {
              const reqPart = i.requestId != null ? `Request #${i.requestId}: ` : '';
              const cb = createdBySuffix(i.requestId);
              const createdByLabel =
                i.requestId != null && rowById.has(i.requestId)
                  ? getShopboardCreatedByDisplay(rowById.get(i.requestId))
                  : i.salesHeadName || (i.salesHeadId != null ? `Sales head #${i.salesHeadId}` : null);
              if (i.issue === 'no_creator') {
                return `${reqPart}No sales head (created_by) on this request`;
              }
              if (i.issue === 'director_mismatch') {
                return `${reqPart}${i.detail || 'Director grouping does not match server data'}${cb}`;
              }
              if (i.issue === 'director_not_found') {
                return `${reqPart}${i.detail || 'Director not found'}${cb}`;
              }
              if (i.issue === 'no_director_email') {
                const who = createdByLabel && createdByLabel !== 'N/A' ? `Created by: ${createdByLabel}` : 'Sales head';
                return `${reqPart}${who} — we do not find any email against the assigned director (${i.directorName || 'director'}). Assign an email in Sales Head Management.`;
              }
              if (i.issue === 'no_director_assigned') {
                const who = createdByLabel && createdByLabel !== 'N/A' ? `Created by: ${createdByLabel}` : 'Sales head';
                return `${reqPart}${who} — no director assigned. Assign a director on the Sales Head Management page.`;
              }
              const name = i.salesHeadName || (i.salesHeadId != null ? `Sales head #${i.salesHeadId}` : 'Request');
              return `${reqPart}${name}${i.detail ? ` — ${i.detail}` : ''}${cb}`;
            });
            const unique = [...new Set(lines)];
            if (unique.length) {
              displayMessage = `${displayMessage}\n\n${unique.join('\n')}`;
            }
          }
        }
      } catch {
        /* keep displayMessage */
      }
      toast.error(displayMessage, {
        position: 'top-right',
        autoClose: 12000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        style: { whiteSpace: 'pre-line' },
      });
    } finally {
      setIsLoading(false);
    }
  }, [canManualApproval, selectedRequests, filteredRows, post, loadRequests, get]);

  // Notify all users with user_type "additional_director" (same selection rules as Send to Directors: CEO Pending only)
  const handleBulkSendToAdditionalDirectors = React.useCallback(async () => {
    if (!canManualApproval) return;
    if (!selectedRequests || selectedRequests.length === 0) return;

    const selectedRequestObjects = filteredRows.filter((row) => selectedRequests.includes(row.id));
    const ceoPendingOnly = selectedRequestObjects.filter((req) => req.status === 'ceo_pending');

    if (ceoPendingOnly.length === 0) {
      toast.warning('Please select one or more requests with "CEO Pending" status.', {
        position: 'top-right',
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      return;
    }

    if (ceoPendingOnly.length !== selectedRequestObjects.length) {
      toast.warning(
        'Send to Additional Director only applies to CEO Pending requests. Deselect other statuses.',
        {
          position: 'top-right',
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        }
      );
      return;
    }

    const baseUrlWithPath = (window.location.origin || 'http://localhost:3000') + BASENAME;

    setIsLoading(true);
    try {
      const requestsWithTokens = await Promise.all(
        ceoPendingOnly.map(async (request) => {
          try {
            const [viewTokenResponse, rejectTokenResponse] = await Promise.all([
              get(`/api/shopboard-requests/${request.id}/generate-view-token`),
              get(`/api/shopboard-requests/${request.id}/generate-reject-token`),
            ]);
            return {
              ...request,
              viewToken: viewTokenResponse.success ? viewTokenResponse.data.token : null,
              rejectToken: rejectTokenResponse.success ? rejectTokenResponse.data.token : null,
            };
          } catch (err) {
            console.error(`Error generating tokens for request ${request.id}:`, err);
            return { ...request, viewToken: null, rejectToken: null };
          }
        })
      );

      const emailRequests = requestsWithTokens.map((request) => ({
        id: request.id,
        dealerName: request.dealer?.name || 'N/A',
        dealerRegion: request.dealer?.district || 'N/A',
        vendorName: request.vendor?.card_name || request.vendor_name || 'N/A',
        totalCost: request.total_cost || 0,
        viewToken: request.viewToken,
        rejectToken: request.rejectToken,
        requestItems: (request.requestItems || []).map((item) => ({
          requestType: {
            name: `${item.requestType?.name || 'N/A'}(${item.width || 'N/A'} x ${item.height || 'N/A'})`,
          },
          width: item.width,
          height: item.height,
        })),
      }));

      const response = await post('/api/shopboard-requests/send-to-additional-directors', {
        baseUrl: baseUrlWithPath,
        backendUrl: BASE_URL,
        requests: emailRequests,
      });

      if (response.success) {
        toast.success(
          response.message ||
            `Additional director notification queued for ${ceoPendingOnly.length} request(s).`,
          {
            position: 'top-right',
            autoClose: 4000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          }
        );
        setSelectedRequests([]);
        loadRequests();
      } else {
        throw new Error(response.message || 'Failed to notify additional directors');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to notify additional directors', {
        position: 'top-right',
        autoClose: 8000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        style: { whiteSpace: 'pre-line' },
      });
    } finally {
      setIsLoading(false);
    }
  }, [canManualApproval, selectedRequests, filteredRows, post, loadRequests, get]);

  // Bulk release payment handler (for invoice_sent -> Submitted for Payment)
  const handleBulkReleasePayment = React.useCallback(async () => {
    if (!selectedRequests || selectedRequests.length === 0) return;
    
    setIsLoading(true);
    const selectedRequestObjects = filteredRows.filter(row => selectedRequests.includes(row.id));
    
    // Filter to only invoice_sent status requests
    const invoiceSentRequests = selectedRequestObjects.filter(req => req.status === 'invoice_sent');
    
    if (invoiceSentRequests.length === 0) {
      toast.warning('Please select requests with "Invoice Received" status to release payment', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      setIsLoading(false);
      return;
    }
    
    try {
      // Make one API call to bulk release payment for all requests
      const requestIds = invoiceSentRequests.map(req => req.id);
      
      const response = await post('/api/shopboard-requests/bulk-release-payment', {
        requestIds: requestIds
      });
      
      if (response.success) {
        toast.success(`Payment released for ${response.data.updatedCount} request(s) successfully! Email notification sent.`, {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
        
        // Clear selection and refresh data
        setSelectedRequests([]);
        loadRequests();
      } else {
        throw new Error(response.message || 'Failed to release payment');
      }
    } catch (error) {
      console.error('Error releasing payment:', error);
      toast.error(`Failed to release payment: ${error.message}`, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedRequests, filteredRows, post, loadRequests]);

  // Process payment (update status to payment_successful) - called from payment summary modal
  const handleProcessPayment = React.useCallback(async () => {
    if (!paymentSummaryData || !paymentSummaryData.requestIds || paymentSummaryData.requestIds.length === 0) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Use batch payment API endpoint
      const paymentDate = new Date().toISOString();
      const response = await post('/api/shopboard-requests/batch-payment', {
        requestIds: paymentSummaryData.requestIds,
        payment_date: paymentDate
      });
      
      if (response.success) {
        toast.success(`Batch payment processed successfully! Batch: ${response.data.batch.batch_number}`, {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
        
        // Close modal, clear selection and refresh data
        setPaymentSummaryModalOpen(false);
        setPaymentSummaryData(null);
        setSelectedRequests([]);
        loadRequests();
      } else {
        throw new Error(response.message || 'Failed to process batch payment');
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error(`Failed to process payment: ${error.message}`, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } finally {
      setIsLoading(false);
    }
  }, [paymentSummaryData, post, loadRequests]);

  // Selection handlers with event propagation prevention
  const handleSelectRequest = React.useCallback((requestId, event) => {
    // Prevent event propagation to avoid triggering row click
    if (event) {
      event.stopPropagation();
    }
    
    // Get the request being selected/deselected
    const request = filteredRows.find(row => row.id === requestId);
    if (!request) return;
    
    setSelectedRequests(prev => {
      if (prev.includes(requestId)) {
        // Deselecting - always allow
        return prev.filter(id => id !== requestId);
      } else {
        // Check if email has already been sent - prevent selection only for ceo_pending if is_email === true
        if (request.status === 'ceo_pending' && request.is_email === true) {
          toast.warning('Email has already been sent for this request. Cannot select again.', {
            position: "top-right",
            autoClose: 3000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          });
          return prev; // Don't add request with email already sent
        }
        
        // Selecting - check if this request is selectable based on user permissions
        let isSelectable = false;
        if (canManualApproval) {
          // Users with manual_approval can select ceo_pending (if email not sent) and invoice_sent (always)
          if (request.status === 'ceo_pending') {
            isSelectable = request.is_email !== true;
          } else if (request.status === 'invoice_sent') {
            isSelectable = true; // invoice_sent can always be selected regardless of is_email
          }
        }
        if (canPaymentRelease) {
          // Users with payment_release can select Submitted for Payment
          if (request.status === SHOPBOARD_REQUEST_STATUS.SUBMITTED_FOR_PAYMENT) {
            isSelectable = true;
          }
        }
        
        if (!isSelectable) {
          return prev; // Don't add non-selectable request
        }
        
        // Check for mixed selection - don't allow mixing different status groups
        if (prev.length > 0) {
          // Get the status of already selected requests
          const selectedRequestIds = prev;
          const selectedRequests = filteredRows.filter(row => selectedRequestIds.includes(row.id));
          const existingStatus = selectedRequests[0]?.status;
          
          // Define status groups based on permissions
          const manualApprovalStatuses = ['ceo_pending', 'invoice_sent'];
          const paymentReleaseStatus = SHOPBOARD_REQUEST_STATUS.SUBMITTED_FOR_PAYMENT;
          
          // Don't allow mixing manual approval statuses with payment release status
          const existingIsManualApproval = manualApprovalStatuses.includes(existingStatus);
          const existingIsPaymentRelease = existingStatus === paymentReleaseStatus;
          const newIsManualApproval = manualApprovalStatuses.includes(request.status);
          const newIsPaymentRelease = request.status === paymentReleaseStatus;
          
          if ((existingIsManualApproval && newIsPaymentRelease) || 
              (existingIsPaymentRelease && newIsManualApproval)) {
            toast.warning('Cannot select requests with different statuses. Please deselect current selection first.', {
              position: "top-right",
              autoClose: 5000,
              hideProgressBar: false,
              closeOnClick: true,
              pauseOnHover: true,
              draggable: true,
            });
            return prev; // Don't add the new selection
          }
        }
        
        return [...prev, requestId];
      }
    });
  }, [filteredRows, canManualApproval, canPaymentRelease]);

  const handleSelectAll = React.useCallback((event) => {
    // Prevent event propagation to avoid triggering row click
    if (event) {
      event.stopPropagation();
    }
    
    // Determine selectable rows based on user permissions
    let selectableRequests = [];
    if (canManualApproval) {
      // Users with manual_approval can select:
      // - ceo_pending (only if email not sent, i.e., is_email !== true)
      // - invoice_sent (always, regardless of is_email)
      const ceoPendingRows = filteredRows
        .filter(row => row.status === 'ceo_pending' && row.is_email !== true)
        .map(row => row.id);
      const invoiceSentRows = filteredRows
        .filter(row => row.status === 'invoice_sent')
        .map(row => row.id);
      selectableRequests = [...selectableRequests, ...ceoPendingRows, ...invoiceSentRows];
    }
    if (canPaymentRelease) {
      // Users with payment_release can select Submitted for Payment
      const paymentRows = filteredRows
        .filter(row => row.status === SHOPBOARD_REQUEST_STATUS.SUBMITTED_FOR_PAYMENT)
        .map(row => row.id);
      selectableRequests = [...selectableRequests, ...paymentRows];
    }
    
    if (selectedRequests.length === selectableRequests.length) {
      setSelectedRequests([]);
    } else {
      setSelectedRequests(selectableRequests);
    }
  }, [filteredRows, selectedRequests.length, canManualApproval, canPaymentRelease]);

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

  // Fetch rejection comments for a specific request
  const fetchRejectionComments = React.useCallback(async (requestId) => {
    setLoadingRejectionComments(true);
    try {
      const response = await get(`/api/comments/rejection/${requestId}`);
      if (response.success && response.data) {
        setRejectionCommentsList(response.data);
      } else {
        setRejectionCommentsList([]);
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
      setRejectionCommentsList([]);
    } finally {
      setLoadingRejectionComments(false);
    }
  }, [get]);

  const handleViewRejectionComments = React.useCallback((requestData) => {
    if (!canRead) return;
    setRequestToAction(requestData);
    setRejectionCommentsDialogOpen(true);
    fetchRejectionComments(requestData.id);
  }, [canRead, fetchRejectionComments]);

  const cancelRejectionComments = () => {
    setRejectionCommentsDialogOpen(false);
    setRequestToAction(null);
    setRejectionCommentsList([]);
  };

  // Fetch marketing comments for a specific request
  const fetchMarketingComments = React.useCallback(async (requestId) => {
    setLoadingMarketingComments(true);
    try {
      const response = await get(`/api/comments/marketing/${requestId}`);
      if (response.success && response.data) {
        setMarketingComments(response.data);
      } else {
        setMarketingComments([]);
      }
    } catch (error) {
      console.error('Error fetching marketing comments:', error);
      toast.error('Failed to load marketing comments', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      setMarketingComments([]);
    } finally {
      setLoadingMarketingComments(false);
    }
  }, [get]);

  // Fetch history for a specific request
  const fetchRequestHistory = React.useCallback(async (requestId) => {
    setLoadingHistory(true);
    try {
      const response = await get(`/api/shopboard-logs/request/${requestId}`);
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

  // Confirm approve function
  const confirmApprove = async () => {
    if (!requestToAction) return;
    
    setIsLoading(true);
    setApproveDialogOpen(false);
    
    try {
      const response = await patch(`/api/shopboard-requests/${requestToAction.id}`, {
        status: 'processing',
        updated_by: user.id
      });

      toast.success(`Request #${requestToAction.id} approved successfully!`, {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      
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

  // Approve under_review by current user (Approvals permission)
  const confirmApprovalForUnderReview = async (reqRow) => {
    const target = reqRow || requestToAction;
    if (!target) return;

    setIsLoading(true);
    setApproveDialogOpen(false);

    try {
      await post(`/api/shopboard-requests/${target.id}/approvals/approve`, {
        request_id: target.id
      });

      toast.success(`Your approval for request #${target.id} has been recorded!`, {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });

      loadRequests();
    } catch (approveError) {
      toast.error(`Failed to approve: ${approveError.message}`, {
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

    if (!rejectionComment || !rejectionComment.trim()) {
      toast.error('A rejection comment is required.', {
        position: "top-right",
        autoClose: 4000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      return;
    }
    
    setIsLoading(true);
    setRejectDialogOpen(false);
    
    try {
      const updateData = {
        status: 'rejected',
        updated_by: user.id,
        comment: rejectionComment.trim(),
        comment_type: 'rejection',
      };

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

  // Confirm assign function
  const confirmAssign = async () => {
    if (!requestToAction || !selectedVendor) return;
    
    setIsLoading(true);
    setAssignDialogOpen(false);
    
    try {
      const updateData = {
        vendor_id: selectedVendor.id, // This is now the SAP CardCode
        status: 'Rfq',
        assigned_vm: 1,
        updated_by: user.id
      };

      // Add vendor comment if provided
      if (vendorComment && vendorComment.trim()) {
        updateData.comment = vendorComment.trim();
        updateData.comment_type = 'vendor';
      }

      const response = await patch(`/api/shopboard-requests/${requestToAction.id}`, updateData);

      toast.success(`Request #${requestToAction.id} assigned to ${selectedVendor.name} successfully!`, {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      
      loadRequests();
    } catch (assignError) {
      toast.error(`Failed to assign request: ${assignError.message}`, {
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
      setSelectedVendor(null);
      setVendorComment(''); // Clear vendor comment after assignment
    }
  };

  // Confirm review again function
  const confirmReviewAgain = async () => {
    if (!requestToAction) return;
    
    setIsLoading(true);
    setReviewAgainDialogOpen(false);
    
    try {
      const response = await patch(`/api/shopboard-requests/${requestToAction.id}`, {
        status: 'not decided',
        updated_by: user.id
      });

      toast.success(`Request #${requestToAction.id} marked for review again!`, {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      
      loadRequests();
    } catch (reviewError) {
      toast.error(`Failed to mark request for review: ${reviewError.message}`, {
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

  // Confirm send to CEO function
  const confirmSendToCEO = async () => {
    if (!requestToAction) return;
    
    setIsLoading(true);
    setSendToCEODialogOpen(false);
    
    try {
      const response = await patch(`/api/shopboard-requests/${requestToAction.id}`, {
        status: 'under_review',
        updated_by: user.id
      });

      toast.success(`Request #${requestToAction.id} sent to Marketing Head successfully!`, {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      
      loadRequests();
    } catch (sendError) {
      toast.error(`Failed to send request to Marketing Head: ${sendError.message}`, {
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

  // Confirm add comment function (for Add Comment Dialog)
  const confirmAddComment = async () => {
    if (!requestToAction || !newComment.trim()) return;
    
    setIsLoading(true);
    setAddCommentDialogOpen(false);
    
    try {
      const response = await post(`/api/comments/add`, {
        shopboard_request_id: requestToAction.id,
        comment: newComment.trim(),
        comment_type: 'marketing'
      });

      toast.success(`Message sent to request #${requestToAction.id} successfully!`, {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      
      // Refresh the comments in the dialog
      fetchMarketingComments(requestToAction.id);
      setNewComment(''); // Clear the input field
    } catch (commentError) {
      toast.error(`Failed to send message: ${commentError.message}`, {
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
      setNewComment('');
    }
  };

  // Send message from Messages Dialog (keeps dialog open)
  const handleSendMessageFromDialog = async () => {
    if (!requestToAction || !newComment.trim()) return;
    
    setIsLoading(true);
    
    try {
      const response = await post(`/api/comments/add`, {
        shopboard_request_id: requestToAction.id,
        comment: newComment.trim(),
        comment_type: 'marketing'
      });

      toast.success(`Message sent successfully!`, {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      
      // Refresh the comments in the dialog
      fetchMarketingComments(requestToAction.id);
      setNewComment(''); // Clear the input field
    } catch (commentError) {
      toast.error(`Failed to send message: ${commentError.message}`, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } finally {
      setIsLoading(false);
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

  const cancelAssign = () => {
    setAssignDialogOpen(false);
    setRequestToAction(null);
    setSelectedVendor(null);
    setVendorComment(''); // Clear vendor comment when canceling
  };

  const cancelReviewAgain = () => {
    setReviewAgainDialogOpen(false);
    setRequestToAction(null);
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

  // Preload dealers/vendors when opening history
  React.useEffect(() => {
    const load = async () => {
      try {
        const [dealersRes, vendorsRes, warrantiesRes] = await Promise.all([
          get('/api/dealers'),
          get('/api/vendors'),
          get('/api/warranty-statuses')
        ]);
        if (dealersRes?.success && Array.isArray(dealersRes.data)) setDealers(dealersRes.data);
        if (vendorsRes?.success && Array.isArray(vendorsRes.data)) setVendorsLookup(vendorsRes.data);
        if (warrantiesRes?.success && Array.isArray(warrantiesRes.data)) setWarrantyStatusesHistory(warrantiesRes.data);
      } catch (e) {}
    };
    if (historyDialogOpen) load();
  }, [historyDialogOpen, get]);

  const resolveDealerName = React.useCallback((dealerId) => {
    if (!dealerId) return null;
    const d = dealers.find(x => String(x.id) === String(dealerId) || String(x.code) === String(dealerId));
    return d ? `${d.name} (${d.code})` : dealerId;
  }, [dealers]);

  const resolveVendorName = React.useCallback((vendorId) => {
    if (!vendorId) return null;
    const v = vendorsLookup.find(x => x.id === vendorId);
    return v?.name || null;
  }, [vendorsLookup]);

  const resolveWarrantyStatusName = React.useCallback((id) => {
    if (!id) return null;
    const ws = warrantyStatusesHistory.find(x => x.id === id);
    return ws?.name || null;
  }, [warrantyStatusesHistory]);

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
                  );})}
                </Box>
              </Box>
            );
          }

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
          if (key === 'approvals') {
            return (
              <Box key={`${key}-${idx}`} sx={{ mb: 1 }}>
                {value.map((message, msgIndex) => {
                  // Check if it's "Approval needed from" message
                  if (message.includes('Approval needed from:')) {
                    const usernames = message.replace('Approval needed from: ', '').split(', ');
                    
                    return (
                      <Box key={`approval-${msgIndex}`}>
                        {usernames.map((username, userIndex) => (
                          <Typography key={userIndex} variant="body2" sx={{ color: '#333', mb: 0.5 }}>
                            Approval needed from {username.trim()}
                          </Typography>
                        ))}
                      </Box>
                    );
                  }
                  
                  // For "Approved by" messages, display simply without numbering
                  if (message.includes('Approved by:')) {
                    return (
                      <Box key={`approval-${msgIndex}`} sx={{ mb: 1 }}>
                        <Typography variant="body2" sx={{ 
                          color: '#2e7d32', 
                          fontWeight: 'bold',
                          backgroundColor: '#e8f5e8',
                          p: 1,
                          borderRadius: 1,
                          border: '1px solid #c8e6c9'
                        }}>
                          ✅ {message}
                        </Typography>
                      </Box>
                    );
                  }
                  
                  // For "Rejected by" messages
                  if (message.includes('Rejected by:')) {
                    return (
                      <Box key={`approval-${msgIndex}`} sx={{ mb: 1 }}>
                        <Typography variant="body2" sx={{ 
                          color: '#d32f2f', 
                          fontWeight: 'bold',
                          backgroundColor: '#ffebee',
                          p: 1,
                          borderRadius: 1,
                          border: '1px solid #ffcdd2'
                        }}>
                          ❌ {message}
                        </Typography>
                      </Box>
                    );
                  }
                  
                  // Default display for other approval messages
                  return (
                    <Typography key={`approval-${msgIndex}`} variant="body2" sx={{ color: '#1976d2', mb: 0.5, fontWeight: 'bold' }}>
                      {message}
                    </Typography>
                  );
                })}
              </Box>
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

  // History diff helpers: show only changed fields for CURRENT vs previous log
  const valuesEqual = (a, b) => {
    if (Array.isArray(a) || Array.isArray(b)) {
      try { return JSON.stringify(a || []) === JSON.stringify(b || []); } catch (e) { return false; }
    }
    if (a instanceof Date) a = a.toISOString();
    if (b instanceof Date) b = b.toISOString();
    return a === b;
  };

  const cancelSendToCEO = () => {
    setSendToCEODialogOpen(false);
    setRequestToAction(null);
  };

  const cancelAddComment = () => {
    setAddCommentDialogOpen(false);
    setRequestToAction(null);
    setNewComment('');
  };

  const cancelMarketingComments = () => {
    setMarketingCommentsDialogOpen(false);
    setRequestToAction(null);
    setMarketingComments([]);
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
      // Only append warranty_status_id if it's a valid number, otherwise send empty string (backend will normalize to null)
      const warrantyStatusId = editFormData.warranty_status_id;
      if (warrantyStatusId !== null && warrantyStatusId !== undefined && warrantyStatusId !== '') {
        formData.append('warranty_status_id', warrantyStatusId);
      } else {
        formData.append('warranty_status_id', '');
      }
      formData.append('reason_for_replacement', editFormData.reason_for_replacement || '');
      formData.append('last_installation_date', editFormData.last_installation_date || '');
      formData.append('total_cost', editFormData.total_cost || '');
      formData.append('updated_by', user.id);

      // Validate date field before sending
      if (editFormData.last_installation_date && editFormData.last_installation_date.trim() !== '') {
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

      // Add new uploaded files to FormData
      sitePhotos.forEach((file, index) => {
        formData.append('site_photo_attachement', file);
      });
      
      oldBoardPhotos.forEach((file, index) => {
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

      const result = await response.json();

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
    setBudgetWarning(null);
  };

  const handleRefresh = React.useCallback(() => {
    if (!isLoading && canRead) {
      loadRequests();
    }
  }, [isLoading, loadRequests, canRead]);

//   const generatePDF = React.useCallback((requestData) => {
//     try {
//       // Open the template in a new window
//       const templateWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
      
//       if (!templateWindow) {
//         toast.error('Please allow popups for this site to generate the PDF.', {
//           position: "top-right",
//           autoClose: 5000,
//           hideProgressBar: false,
//           closeOnClick: true,
//           pauseOnHover: true,
//           draggable: true,
//         });
//         return;
//       }

//       // Embedded template HTML
//       const templateHtml = `<!DOCTYPE html>
// <html lang="en">
// <head>
//     <meta charset="UTF-8">
//     <meta name="viewport" content="width=device-width, initial-scale=1.0">
//     <title>Request Details Report</title>
//     <style>
//         * {
//             margin: 0;
//             padding: 0;
//             box-sizing: border-box;
//         }

//         @media print {
//             body {
//                 margin: 0;
//                 padding: 20px;
//             }
//             .no-print {
//                 display: none;
//             }
//             @page {
//                 margin: 15mm;
//             }
//         }

//         body {
//             font-family: 'Arial', sans-serif;
//             line-height: 1.4;
//             color: #333;
//             background: #f5f5f5;
//             padding: 20px;
//         }

//         .container {
//             max-width: 210mm;
//             margin: 0 auto;
//             background: white;
//             padding: 30px;
//             box-shadow: 0 0 10px rgba(0,0,0,0.1);
//         }

//         .header {
//             text-align: center;
//             margin-bottom: 30px;
//             padding-bottom: 15px;
//             border-bottom: 3px solid #2c3e50;
//         }

//         .header h1 {
//             font-size: 28px;
//             color: #2c3e50;
//             margin-bottom: 5px;
//             letter-spacing: 2px;
//         }

//         .header h2 {
//             font-size: 16px;
//             color: #7f8c8d;
//             font-weight: normal;
//         }

//         .section {
//             margin-bottom: 25px;
//         }

//         .section-title {
//             font-size: 14px;
//             font-weight: bold;
//             color: #2c3e50;
//             text-transform: uppercase;
//             padding-bottom: 8px;
//             margin-bottom: 15px;
//             border-bottom: 2px solid #3498db;
//             letter-spacing: 0.5px;
//         }

//         .fields-row {
//             display: grid;
//             grid-template-columns: 1fr 1fr;
//             gap: 20px;
//             margin-bottom: 15px;
//         }

//         .field {
//             margin-bottom: 12px;
//         }

//         .field-label {
//             font-size: 10px;
//             font-weight: bold;
//             color: #555;
//             margin-bottom: 3px;
//         }

//         .field-value {
//             font-size: 11px;
//             color: #333;
//             padding-bottom: 4px;
//             border-bottom: 1px solid #ddd;
//             min-height: 16px;
//         }

//         .item-card {
//             background: #f8f9fa;
//             padding: 15px;
//             margin-bottom: 15px;
//             border-radius: 5px;
//             border-left: 4px solid #3498db;
//         }

//         .item-header {
//             font-size: 12px;
//             font-weight: bold;
//             color: #2c3e50;
//             margin-bottom: 12px;
//         }

//         .full-width {
//             grid-column: 1 / -1;
//         }

//         .reason-box {
//             background: #f8f9fa;
//             padding: 12px;
//             border-radius: 5px;
//             margin-top: 10px;
//         }

//         .reason-label {
//             font-size: 10px;
//             font-weight: bold;
//             color: #555;
//             margin-bottom: 5px;
//         }

//         .reason-text {
//             font-size: 11px;
//             color: #333;
//             line-height: 1.5;
//         }

//         .total-box {
//             background: #3498db;
//             color: white;
//             padding: 15px;
//             border-radius: 5px;
//             margin: 20px 0;
//             text-align: center;
//         }

//         .total-label {
//             font-size: 11px;
//             margin-bottom: 5px;
//             opacity: 0.9;
//         }

//         .total-amount {
//             font-size: 20px;
//             font-weight: bold;
//         }

//         .footer {
//             margin-top: 40px;
//             padding-top: 15px;
//             border-top: 1px solid #ddd;
//             display: flex;
//             justify-content: space-between;
//             font-size: 9px;
//             color: #7f8c8d;
//         }

//         .print-button {
//             position: fixed;
//             top: 20px;
//             right: 20px;
//             background: #3498db;
//             color: white;
//             border: none;
//             padding: 12px 24px;
//             border-radius: 5px;
//             cursor: pointer;
//             font-size: 14px;
//             font-weight: bold;
//             box-shadow: 0 2px 5px rgba(0,0,0,0.2);
//             transition: background 0.3s;
//         }

//         .print-button:hover {
//             background: #2980b9;
//         }

//         .status-badge {
//             display: inline-block;
//             padding: 4px 10px;
//             border-radius: 3px;
//             font-size: 10px;
//             font-weight: bold;
//         }

//         .status-pending {
//             background: #fff3cd;
//             color: #856404;
//         }

//         .status-approved {
//             background: #d4edda;
//             color: #155724;
//         }

//         .status-rejected {
//             background: #f8d7da;
//             color: #721c24;
//         }

//         .status-ceo-pending {
//             background: #d1ecf1;
//             color: #0c5460;
//         }
//     </style>
// </head>
// <body>
//     <button class="print-button no-print" onclick="window.print()">Print / Save as PDF</button>

//     <div class="container">
//         <!-- Header -->
//         <div class="header">
//             <h1>DIAMOND PAINTS</h1>
//             <h2>Request Details Report</h2>
//         </div>

//         <!-- Dealer Information -->
//         <div class="section">
//             <div class="section-title">Dealer Information</div>
//             <div class="fields-row">
//                 <div class="field">
//                     <div class="field-label">Dealer Name:</div>
//                     <div class="field-value" id="dealer-name">-</div>
//                 </div>
//                 <div class="field">
//                     <div class="field-label">Dealer Code:</div>
//                     <div class="field-value" id="dealer-code">-</div>
//                 </div>
//             </div>
//             <div class="fields-row">
//                 <div class="field">
//                     <div class="field-label">Phone:</div>
//                     <div class="field-value" id="dealer-phone">-</div>
//                 </div>
//                 <div class="field">
//                     <div class="field-label">Dealer Type:</div>
//                     <div class="field-value" id="dealer-type">-</div>
//                 </div>
//             </div>
//             <div class="fields-row">
//                 <div class="field full-width">
//                     <div class="field-label">Address:</div>
//                     <div class="field-value" id="dealer-address">-</div>
//                 </div>
//             </div>
//         </div>

//         <!-- Request Items -->
//         <div class="section">
//             <div class="section-title">Request Items & Dimensions</div>
//             <div id="request-items">
//                 <!-- Items will be populated here -->
//             </div>
//             <div class="total-box">
//                 <div class="total-label">Total Cost (All Items)</div>
//                 <div class="total-amount" id="total-cost">Rs. 0.00</div>
//             </div>
//         </div>

//         <!-- Warranty & Installation -->
//         <div class="section">
//             <div class="section-title">Warranty & Installation Information</div>
//             <div class="fields-row">
//                 <div class="field">
//                     <div class="field-label">Warranty Status:</div>
//                     <div class="field-value" id="warranty-status">-</div>
//                 </div>
//                 <div class="field">
//                     <div class="field-label">Last Installation Date:</div>
//                     <div class="field-value" id="last-installation-date">-</div>
//                 </div>
//             </div>
//             <div class="reason-box">
//                 <div class="reason-label">Reason for Replacement:</div>
//                 <div class="reason-text" id="replacement-reason">No reason provided</div>
//             </div>
//         </div>

//         <!-- Request Status & Vendor -->
//         <div class="section">
//             <div class="section-title">Request Status & Vendor Information</div>
//             <div class="fields-row">
//                 <div class="field">
//                     <div class="field-label">Assigned Vendor:</div>
//                     <div class="field-value" id="assigned-vendor">-</div>
//                 </div>
//                 <div class="field">
//                     <div class="field-label">Survey Date:</div>
//                     <div class="field-value" id="survey-date">-</div>
//                 </div>
//             </div>
//         </div>

//         <!-- Footer -->
//         <div class="footer">
//             <div>Generated on: <span id="generation-date">-</span></div>
//             <div>Diamond Paints - Request Details Report</div>
//         </div>
//     </div>

//     <script>
//         // Function to populate the template with data
//         function populateTemplate(data) {
//             // Helper functions
//             const cleanText = (text) => {
//                 if (!text) return 'N/A';
//                 return String(text).replace(/[^\\x20-\\x7E\\u00A0-\\u00FF]/g, '').trim();
//             };

//             const formatStatus = (status) => {
//                 if (!status) return 'Not Decided';
//                 const statusMap = {
//                     'pending': 'Pending',
//                     'ceo_pending': 'CEO Pending',
//                     'approved': 'Approved',
//                     'rejected': 'Rejected',
//                     'completed': 'Completed',
//                     'in_progress': 'In Progress'
//                 };
//                 return statusMap[status] || status.replace(/_/g, ' ').replace(/\\b\\w/g, l => l.toUpperCase());
//             };

//             const formatPhone = (phone) => {
//                 if (!phone) return 'N/A';
//                 const phoneStr = String(phone).replace(/\\D/g, '');
//                 if (phoneStr.startsWith('92')) {
//                     return \`+92 \${phoneStr.slice(2, 5)} \${phoneStr.slice(5)}\`;
//                 }
//                 return phoneStr;
//             };

//             const formatDate = (date) => {
//                 if (!date) return 'N/A';
//                 return new Date(date).toLocaleDateString('en-GB');
//             };

//             const getStatusBadge = (status) => {
//                 const statusClass = status === 'ceo_pending' ? 'status-ceo-pending' : 
//                                   status === 'approved' ? 'status-approved' :
//                                   status === 'rejected' ? 'status-rejected' : 'status-pending';
//                 return \`<span class="status-badge \${statusClass}">\${formatStatus(status)}</span>\`;
//             };

//             // Populate dealer information
//             document.getElementById('dealer-name').textContent = cleanText(data.dealer?.name || data.dealerName || 'N/A');
//             document.getElementById('dealer-code').textContent = cleanText(data.dealer?.code || data.dealerCode || 'N/A');
//             document.getElementById('dealer-phone').textContent = formatPhone(data.dealer?.phone || data.dealerPhone);
//             document.getElementById('dealer-address').textContent = cleanText(
//                 data.dealer?.address || data.dealerAddress || 
//                 \`\${data.dealer?.city || ''} \${data.dealer?.area || ''}\`.trim() || 'N/A'
//             );
//             document.getElementById('dealer-type').textContent = data.dealer_type === 'new' ? 'New Dealer' : 'Existing Dealer';

//             // Populate request items
//             const itemsContainer = document.getElementById('request-items');
//             const items = data.requestItems || data.request_items || [];
//             let totalCost = 0;

//             if (items.length > 0) {
//                 items.forEach((item, index) => {
//                     const totalArea = (parseFloat(item.width) || 0) * (parseFloat(item.height) || 0);
//                     const itemCost = parseFloat(item.price) || 0;
//                     totalCost += itemCost;

//                     const itemDiv = document.createElement('div');
//                     itemDiv.className = 'item-card';
//                     itemDiv.innerHTML = \`
//                         <div class="item-header">Item \${index + 1}:</div>
//                         <div class="fields-row">
//                             <div class="field">
//                                 <div class="field-label">Request Type:</div>
//                                 <div class="field-value">\${cleanText(item.requestType?.name || item.request_type || 'N/A')}</div>
//                             </div>
//                             <div class="field">
//                                 <div class="field-label">Width (ft):</div>
//                                 <div class="field-value">\${cleanText(item.width || 'N/A')}</div>
//                             </div>
//                         </div>
//                         <div class="fields-row">
//                             <div class="field">
//                                 <div class="field-label">Height (ft):</div>
//                                 <div class="field-value">\${cleanText(item.height || 'N/A')}</div>
//                             </div>
//                             <div class="field">
//                                 <div class="field-label">Price per ft²:</div>
//                                 <div class="field-value">\${item.price_per_sqft || item.pricePerSqft ? \`Rs. \${parseFloat(item.price_per_sqft || item.pricePerSqft).toFixed(2)}\` : 'N/A'}</div>
//                             </div>
//                         </div>
//                         <div class="fields-row">
//                             <div class="field">
//                                 <div class="field-label">Total Area (ft²):</div>
//                                 <div class="field-value">\${totalArea > 0 ? totalArea.toFixed(2) : 'N/A'}</div>
//                             </div>
//                             <div class="field">
//                                 <div class="field-label">Total Cost:</div>
//                                 <div class="field-value">\${item.price ? \`Rs. \${parseFloat(item.price).toFixed(2)}\` : 'N/A'}</div>
//                             </div>
//                         </div>
//                     \`;
//                     itemsContainer.appendChild(itemDiv);
//                 });
//             } else {
//                 itemsContainer.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">No request items found</div>';
//             }

//             // Update total cost
//             document.getElementById('total-cost').textContent = \`Rs. \${totalCost.toFixed(2)}\`;

//             // Populate warranty information
//             document.getElementById('warranty-status').textContent = cleanText(data.warrantyStatus?.name || data.warranty_status || 'N/A');
//             document.getElementById('last-installation-date').textContent = formatDate(data.last_installation_date || data.lastInstallationDate);
//             document.getElementById('replacement-reason').textContent = cleanText(data.reason_for_replacement || data.reasonForReplacement || 'No reason provided');

//             // Populate vendor information
//             document.getElementById('assigned-vendor').textContent = cleanText(data.vendor?.name || data.vendorName || 'Not assigned');
            
//             const surveyDate = data.survey_date || data.surveyDate;
//             document.getElementById('survey-date').textContent = formatDate(surveyDate) || new Date().toLocaleDateString('en-GB');

//             // Update generation date
//             document.getElementById('generation-date').textContent = new Date().toLocaleDateString('en-GB');
//         }

//         // Export function for use in React component
//         window.populateRequestTemplate = populateTemplate;
//     </script>
// </body>
// </html>`;

//       // Write the template to the new window
//       templateWindow.document.write(templateHtml);
//       templateWindow.document.close();
      
//       // Wait for the template to load, then populate it with data
//       templateWindow.onload = () => {
//         if (templateWindow.populateRequestTemplate) {
//           templateWindow.populateRequestTemplate(requestData);
//         } else {
//           // Fallback: populate manually if the function isn't available
//           setTimeout(() => {
//             if (templateWindow.populateRequestTemplate) {
//               templateWindow.populateRequestTemplate(requestData);
//             }
//           }, 100);
//         }
//       };

//       toast.success('PDF template opened in new window. Use the Print button to save as PDF.', {
//         position: "top-right",
//         autoClose: 3000,
//         hideProgressBar: false,
//         closeOnClick: true,
//         pauseOnHover: true,
//         draggable: true,
//       });
  
//     } catch (error) {
//       console.error('Error generating PDF:', error);
//       toast.error('Failed to generate PDF. Please try again.', {
//         position: "top-right",
//         autoClose: 5000,
//         hideProgressBar: false,
//         closeOnClick: true,
//         pauseOnHover: true,
//         draggable: true,
//       });
//     }
//   }, []);

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

    // Embedded template HTML with auto-print
    const templateHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Request Details Report - ${requestData.id}</title>
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

        .item-card {
            background: #f8f9fa;
            padding: 8px;
            margin-bottom: 8px;
            border-radius: 3px;
            border-left: 3px solid #3498db;
        }

        .item-header {
            font-size: 11px;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 6px;
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

        .status-pending {
            background: #fff3cd;
            color: #856404;
        }

        .status-approved {
            background: #d4edda;
            color: #155724;
        }

        .status-rejected {
            background: #f8d7da;
            color: #721c24;
        }

        .status-ceo-pending {
            background: #d1ecf1;
            color: #0c5460;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <h1>DIAMOND PAINTS</h1>
            <h2>Request Details Report</h2>
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
            <div id="request-items">
                <!-- Items will be populated here -->
            </div>
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

        <!-- Request Status & Vendor -->
        <div class="section">
            <div class="section-title">Request Status & Vendor Information</div>
            <div class="fields-row">
                <div class="field">
                    <div class="field-label">Assigned Vendor:</div>
                    <div class="field-value" id="assigned-vendor">-</div>
                </div>
            </div>
        </div>

        <!-- Footer -->
        <div class="footer">
            <div>Generated on: <span id="generation-date">-</span></div>
            <div>Diamond Paints - Request Details Report</div>
        </div>
    </div>

    <script>
        function populateTemplate(data) {
            const cleanText = (text) => {
                if (!text) return 'N/A';
                return String(text).replace(/[^\\x20-\\x7E\\u00A0-\\u00FF]/g, '').trim();
            };

            const formatStatus = (status) => {
                if (!status) return 'Not Decided';
                const statusMap = {
                    'pending': 'Pending',
                    'ceo_pending': 'CEO Pending',
                    'approved': 'Approved',
                    'rejected': 'Rejected',
                    'completed': 'Completed',
                    'in_progress': 'In Progress'
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
            document.getElementById('dealer-name').textContent = cleanText(data.dealer?.name || data.dealerName || 'N/A');
            document.getElementById('dealer-code').textContent = cleanText(data.dealer?.code || data.dealerCode || 'N/A');
            document.getElementById('dealer-phone').textContent = formatPhone(data.dealer?.phone || data.dealerPhone);
            document.getElementById('dealer-address').textContent = cleanText(
                data.dealer?.address || data.dealerAddress || 
                \`\${data.dealer?.city || ''} \${data.dealer?.area || ''}\`.trim() || 'N/A'
            );
            document.getElementById('dealer-type').textContent = data.dealer_type === 'new' ? 'New Dealer' : 'Existing Dealer';

            // Populate request items
            const itemsContainer = document.getElementById('request-items');
            const items = data.requestItems || data.request_items || [];
            let totalCost = 0;

            if (items.length > 0) {
                items.forEach((item, index) => {
                    const totalArea = (parseFloat(item.width) || 0) * (parseFloat(item.height) || 0);
                    const itemCost = parseFloat(item.price) || 0;
                    totalCost += itemCost;

                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'item-card';
                    itemDiv.innerHTML = \`
                        <div class="item-header">Item \${index + 1}:</div>
                        <div class="fields-row">
                            <div class="field">
                                <div class="field-label">Request Type:</div>
                                <div class="field-value">\${cleanText(item.requestType?.name || item.request_type || 'N/A')}</div>
                            </div>
                            <div class="field">
                                <div class="field-label">Width (ft):</div>
                                <div class="field-value">\${cleanText(item.width || 'N/A')}</div>
                            </div>
                        </div>
                        <div class="fields-row">
                            <div class="field">
                                <div class="field-label">Height (ft):</div>
                                <div class="field-value">\${cleanText(item.height || 'N/A')}</div>
                            </div>
                            <div class="field">
                                <div class="field-label">Price per ft²:</div>
                                <div class="field-value">\${item.price_per_sqft || item.pricePerSqft ? \`Rs. \${parseFloat(item.price_per_sqft || item.pricePerSqft).toFixed(2)}\` : 'N/A'}</div>
                            </div>
                        </div>
                        <div class="fields-row">
                            <div class="field">
                                <div class="field-label">Total Area (ft²):</div>
                                <div class="field-value">\${totalArea > 0 ? totalArea.toFixed(2) : 'N/A'}</div>
                            </div>
                            <div class="field">
                                <div class="field-label">Total Cost:</div>
                                <div class="field-value">\${item.price ? \`Rs. \${parseFloat(item.price).toFixed(2)}\` : 'N/A'}</div>
                            </div>
                        </div>
                    \`;
                    itemsContainer.appendChild(itemDiv);
                });
            } else {
                itemsContainer.innerHTML = '<div style="text-align: center; color: #666; padding: 10px; font-size: 9px;">No request items found</div>';
            }

            document.getElementById('total-cost').textContent = \`Rs. \${totalCost.toFixed(2)}\`;

            // Populate warranty information
            document.getElementById('warranty-status').textContent = cleanText(data.warrantyStatus?.name || data.warranty_status || 'N/A');
            document.getElementById('last-installation-date').textContent = formatDate(data.last_installation_date || data.lastInstallationDate);
            document.getElementById('replacement-reason').textContent = cleanText(data.reason_for_replacement || data.reasonForReplacement || 'No reason provided');

            // Populate vendor information (match getVendorName: vendor.card_name, vendor_name)
            const assignedVendor = data.vendor?.card_name || data.vendor_name || data.vendorName || data.vendor?.name;
            document.getElementById('assigned-vendor').textContent = cleanText(assignedVendor || 'Not assigned');

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
      // Hide row click for users with read_approved_request permission
      if (hasReadApprovedRequestPermission) {
        return;
      }
      handleView(row);
    },
    [handleView, hasReadApprovedRequestPermission],
  );


  // Get fields for view modal
  const getRequestFields = (requestData = null) => {
    const fields = [];
    
    // Check if there's a parent dealer (dealer.id !== dealer_relation.parent.id)
    const hasParent = requestData?.dealer_relation?.parent && 
                      requestData?.dealer?.id && 
                      requestData.dealer.id !== requestData.dealer_relation.parent.id;
    
    // Add parent dealer fields if parent exists
    if (hasParent) {
      fields.push(
        {
          name: 'parent_dealer_code',
          label: 'Parent Dealer Code',
          type: 'text',
          readOnly: true,
        },
        {
          name: 'parent_dealer_name',
          label: 'Parent Dealer Name',
          type: 'text',
          readOnly: true,
        },
        {
          name: 'parent_dealer_phone',
          label: 'Parent Dealer Phone',
          type: 'text',
          readOnly: true,
        }
      );
    }
    
    // Add current dealer fields
    fields.push(
      {
        name: 'dealer',
        label: 'Dealer Name',
        type: 'text',
        readOnly: true,
        valueFormatter: (value) => {
          if (!value) return 'N/A';
          if (typeof value === 'string') return value;
          return value.name || 'N/A';
        },
      },
      {
        name: 'dealer',
        label: 'Dealer Code',
        type: 'text',
        readOnly: true,
        valueFormatter: (value) => {
          if (!value) return 'N/A';
          if (typeof value === 'string') return value;
          return value.code || 'N/A';
        },
      },
      {
        name: 'dealer',
        label: 'Phone',
        type: 'text',
        readOnly: true,
        valueFormatter: (value) => {
          if (!value) return 'N/A';
          if (typeof value === 'string') return 'N/A';
          return value.phone || 'N/A';
        },
      },
      {
        name: 'dealer',
        label: 'Address',
        type: 'text',
        readOnly: true,
        valueFormatter: (value) => {
          if (!value) return 'N/A';
          if (typeof value === 'string') return value;
          return value.city || 'N/A';
        },
      },
      {
        name: 'dealer_type',
        label: 'Dealer Type',
        type: 'text',
        readOnly: true,
        valueFormatter: (value) => {
          if (!value) return 'Old';
          return value === 'new' ? 'New' : 'Old';
        },
      },
      {
        name: 'survey_form_attachments',
        label: 'Survey Form Attachments',
        type: 'text',
        readOnly: true,
        valueFormatter: (value) => {
          if (!value || !Array.isArray(value) || value.length === 0) return 'No attachments';
          return `${value.length} file(s) attached`;
        },
      }
    );
    
    return fields;
  };

  // Handle filter changes
  const handleFilterChange = React.useCallback((newFilters) => {
    setFilters(newFilters);
  }, []);

  // Column definitions for shopboard requests (showing only 4 key fields)
  const columns = React.useMemo(
    () => {
      const baseColumns = [
        // Selection column - only show if user has permission (canManualApproval OR canPaymentRelease) AND there are selectable requests
        ...((canManualApproval || canPaymentRelease) && showSelectionColumn ? [{
          field: 'select',
          headerName: 'Select',
          width: 80,
          sortable: false,
          filterable: false,
          disableColumnMenu: true,
          renderHeader: () => {
            // Determine selectable rows based on user permissions
            let selectableRows = [];
            if (canManualApproval) {
              // Users with manual_approval can select:
              // - ceo_pending (only if email not sent, i.e., is_email !== true)
              // - invoice_sent (always, regardless of is_email)
              const ceoPendingRows = filteredRows.filter(row => 
                row.status === 'ceo_pending' && row.is_email !== true
              );
              const invoiceSentRows = filteredRows.filter(row => 
                row.status === 'invoice_sent'
              );
              selectableRows = [...ceoPendingRows, ...invoiceSentRows];
            }
            if (canPaymentRelease) {
              // Users with payment_release can select Submitted for Payment
              const submittedForPaymentRows = filteredRows.filter(row => 
                row.status === SHOPBOARD_REQUEST_STATUS.SUBMITTED_FOR_PAYMENT
              );
              selectableRows = [...selectableRows, ...submittedForPaymentRows];
            }
            return (
              <Checkbox
                checked={selectedRequests.length > 0 && selectedRequests.length === selectableRows.length}
                indeterminate={selectedRequests.length > 0 && selectedRequests.length < selectableRows.length}
                onChange={handleSelectAll}
                color="primary"
                onClick={(e) => e.stopPropagation()}
              />
            );
          },
          renderCell: (params) => {
            // Determine if row is selectable based on user permissions
            let isSelectable = false;
            if (canManualApproval) {
              // Users with manual_approval can select:
              // - ceo_pending (only if email not sent, i.e., is_email !== true)
              // - invoice_sent (always, regardless of is_email)
              if (params.row.status === 'ceo_pending') {
                isSelectable = params.row.is_email !== true;
              } else if (params.row.status === 'invoice_sent') {
                isSelectable = true; // invoice_sent can always be selected
              }
            }
            if (canPaymentRelease) {
              // Users with payment_release can select Submitted for Payment
              if (params.row.status === SHOPBOARD_REQUEST_STATUS.SUBMITTED_FOR_PAYMENT) {
                isSelectable = true;
              }
            }
            const isSelected = selectedRequests.includes(params.row.id);
            
            return (
              <Checkbox
                checked={isSelected}
                onChange={(e) => handleSelectRequest(params.row.id, e)}
                disabled={!isSelectable}
                color="primary"
                onClick={(e) => e.stopPropagation()}
              />
            );
          }
        }] : []),
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
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
              <Typography variant="body2">
                {getShopboardCreatedByDisplay(params.row)}
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
          let displayStatus = getStatusDisplayName(status);
          
          // Display "quotation sent" as "quotation received" on Area Head page
          if (status === SHOPBOARD_REQUEST_STATUS.QUOTATION_SENT) {
            displayStatus = 'Quotation Received';
          }
          
          // Display "invoice_sent" as "Invoice Received" on Area Head page
          if (status === SHOPBOARD_REQUEST_STATUS.INVOICE_SENT) {
            displayStatus = 'Invoice Received';
          }
          
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
      // {
      //   field: 'total_cost',
      //   headerName: 'Total Cost',
      //   width: 120,
      //   renderCell: (params) => {
      //     const totalCost = params.value;
      //     if (!totalCost || totalCost === 0) return 'N/A';
      //     return `$${parseFloat(totalCost).toFixed(2)}`;
      //   },
      // },
      // {
      //   field: 'request_items',
      //   headerName: 'Item Prices',
      //   width: 200,
      //   renderCell: (params) => {
      //     const requestItems = params.value;
      //     if (!requestItems || !Array.isArray(requestItems) || requestItems.length === 0) {
      //       return 'No items';
      //     }
          
      //     const itemsWithPrices = requestItems.filter(item => item.price && item.price > 0);
      //     if (itemsWithPrices.length === 0) {
      //       return 'No prices set';
      //     }
          
      //     return (
      //       <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      //         {itemsWithPrices.map((item, index) => (
      //           <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      //             <Typography variant="caption" sx={{ fontWeight: 'bold', minWidth: '60px' }}>
      //               ${parseFloat(item.price).toFixed(2)}
      //             </Typography>
      //             <Typography variant="caption" sx={{ color: '#666', fontSize: '0.7rem' }}>
      //               {item.width}×{item.height}cm
      //             </Typography>
      //           </Box>
      //         ))}
      //       </Box>
      //     );
      //   },
      // },
      {
        field: 'actions',
        type: 'actions',
        headerName: 'Actions',
        width: 400,
        minWidth: 350,
        maxWidth: 600,
        resizable: true,
        getActions: (params) => {
          const row = params.row;
          const isNotDecided = row.status === 'not decided' || row.status === 'rfq not accepted' || row.status === null || row.status === undefined || row.status === '';
          const isProcessing = row.status === 'processing';
          const isReviewRequested = row.status === 'review requested';
          const isRfqStatus = row.status === 'Rfq';
          const isRfqNotAccepted = row.status === 'rfq not accepted';
          const isQuotationReceived = row.status === 'quotation sent';
          const isInvoiceSent = row.status === 'invoice_sent';
          const isUnderReview = row.status === 'under_review';
          const isCeoPending = row.status === 'ceo_pending';
          const isRejectableByUpdate = row.status === 'not decided' || row.status === 'Rfq' || row.status === 'quotation sent';
          const isRejectableByManualApproval = row.status === 'under_review' || row.status === 'ceo_pending';
          const isRejectableStatus = isRejectableByUpdate || isRejectableByManualApproval;
          
          const actions = [];
          
          // Show request view action with tooltip
          // Hide for users with read_approved_request permission
          if (!hasReadApprovedRequestPermission) {
            actions.push(
              <GridActionsCellItem
                key="view"
                icon={<Tooltip title="Request"><RequestIcon /></Tooltip>}
                label="Request"
                onClick={() => handleView(row)}
                color="primary"
              />
            );
          }
          
          // Show detailed view for all statuses except "not decided" and "Rfq"
          // Hide for users with read_approved_request permission (they will use combined modal)
          if (row.status !== 'not decided' && row.status !== 'Rfq' && row.status !== null && row.status !== undefined && row.status !== '' && !hasReadApprovedRequestPermission) {
            actions.push(
              <GridActionsCellItem
                key="viewDetails"
                icon={<Tooltip title="View Details"><VisibilityIcon /></Tooltip>}
                label="View Details"
                onClick={() => handleViewDetails(row)}
                color="info"
              />
            );
          }
          
          // Show combined view for users with read_approved_request permission
          if (hasReadApprovedRequestPermission && row.status === 'Submitted for Payment') {
            actions.push(
              <GridActionsCellItem
                key="viewDetailsAndInvoice"
                icon={<Tooltip title="View Details & Invoice"><VisibilityIcon /></Tooltip>}
                label="View Details & Invoice"
                onClick={() => handleViewDetails(row)}
                color="info"
              />
            );
          }
          
          // Compute whether current user is part of active approvals for this row
          const isUserInActiveApprovals = Array.isArray(row.activeApprovals)
            ? row.activeApprovals.some(ap => String(ap.user_id) === String(user?.id))
            : false;

          // Show edit action for quotation sent OR (under_review and user is an active approver)
          if (canUpdate && (row.status === 'quotation sent' || (row.status === 'under_review' && isUserInActiveApprovals))) {
            actions.push(
              <GridActionsCellItem
                key="edit"
                icon={<Tooltip title="Edit"><EditIcon /></Tooltip>}
                label="Edit Request"
                onClick={() => handleEdit(row)}
                color="info"
              />
            );
          }
          // Show Approve action only if status is under_review AND current user is in activeApprovals
          if (row.status === 'under_review' && isUserInActiveApprovals) {
            actions.push(
              <GridActionsCellItem
                key="approveUnderReview"
                icon={<Tooltip title="Approve"><ApproveIcon /></Tooltip>}
                label="Approve"
                onClick={() => confirmApprovalForUnderReview(row)}
                color="success"
              />
            );
          }
          
          // Show reject action:
          // - 'not decided', 'Rfq', 'quotation sent' → update permission only
          // - 'under_review', 'ceo_pending' → update + manual_approval permission
          if ((isRejectableByUpdate && canReject) || (isRejectableByManualApproval && canReject && canManualApproval)) {
            actions.push(
              <GridActionsCellItem
                key="reject"
                icon={
                  <Tooltip title="Reject Request">
                    <RejectIcon sx={{ color: '#d32f2f' }} />
                  </Tooltip>
                }
                label="Reject Request"
                onClick={() => handleReject(row)}
                color="error"
              />
            );
          }

          // Show view rejection comments icon when request is rejected
          if (row.status === 'rejected' && canRead) {
            actions.push(
              <GridActionsCellItem
                key="viewRejectionComments"
                icon={
                  <Tooltip title="View Rejection Comments">
                    <CommentIcon sx={{ color: '#d32f2f' }} />
                  </Tooltip>
                }
                label="View Rejection Comments"
                onClick={() => handleViewRejectionComments(row)}
                color="error"
              />
            );
          }

          // Show approve/reject only for not decided requests - COMMENTED OUT
          // if (isNotDecided) {
          //   if (canApprove) {
          //     actions.push(
          //       <GridActionsCellItem
          //         key="approve"
          //         icon={<ApproveIcon />}
          //         label="Approve"
          //         onClick={() => handleApprove(row)}
          //         color="success"
          //       />
          //     );
          //   }
          //   
          //   if (canReject) {
          //     actions.push(
          //     <GridActionsCellItem
          //       key="reject"
          //       icon={<ReviewAgainIcon />}
          //       label="Reject"
          //       onClick={() => handleReject(row)}
          //       color="error"
          //     />
          //     );
          //   }
          // }
          
          // Show assign for both processing and not decided requests
          if ((isProcessing || isNotDecided) && canAssign) {
            actions.push(
              <GridActionsCellItem
                key="assign"
                icon={<Tooltip title="Assign to Vendors"><AssignIcon /></Tooltip>}
                label="Request for Quotation"
                onClick={() => handleAssign(row)}
                color="secondary"
              />
            );
          }
          
          // Show review again only for review requested status - COMMENTED OUT
          // if (isReviewRequested && canUpdate) {
          //   actions.push(
          //     <GridActionsCellItem
          //       key="reviewAgain"
          //       icon={<ReviewAgainIcon />}
          //       label="Review Again"
          //       onClick={() => handleReviewAgain(row)}
          //       color="warning"
          //     />
          //   );
          // }
          
          // Show view comments for rfq not accepted status
          if (isRfqNotAccepted && canRead) {
            actions.push(
              <GridActionsCellItem
                key="viewComments"
                icon={<CommentIcon />}
                label="View Rejection Comments"
                onClick={() => handleViewComments(row)}
                color="info"
              />
            );
          }

          // Show send to CEO for quotation received status
          if (isQuotationReceived && canUpdate) {
            actions.push(
              <GridActionsCellItem
                key="sendToCEO"
                icon={<Tooltip title="Send Request to Marketing Head"><SendToCEOIcon /></Tooltip>}
                label="Send Request to Marketing Head"
                onClick={() => handleSendToCEO(row)}
                color="success"
              />
            );
          }

          // Show Reject Invoice for invoice_sent when user has approvals permission
          if (isInvoiceSent && canApprovalAction) {
            actions.push(
              <GridActionsCellItem
                key="rejectInvoice"
                icon={
                  <Tooltip title="Reject Invoice">
                    <ReceiptLongIcon sx={{ color: '#d32f2f' }} />
                  </Tooltip>
                }
                label="Reject Invoice"
                onClick={() => handleOpenRejectInvoice(row)}
                color="error"
              />
            );
          }
          
          // Show combined view & send messages for requests with add_comment permission
          // Exclude statuses: not decided, Rfq, quotation sent, under_review, and null/undefined/empty
          if (canAddComment) {
            const excludedStatuses = ['not decided', 'Rfq', 'quotation sent', 'under_review', 'rejected', 'manual_approval', 'ceo_pending','invoice_sent',  'invoice rejected'];
            const status = row.status;
            const isExcludedStatus = !status || excludedStatuses.includes(status);
            
            if (!isExcludedStatus) {
              // Show badge if there are unread comments
              const unreadCount = row.unread_comment_count || 0;
              const hasUnread = row.has_unread_comments || false;
              
              actions.push(
                <GridActionsCellItem
                  key="viewAndSendMessages"
                  icon={
                    <Tooltip 
                      title={hasUnread ? `${unreadCount} unread message${unreadCount > 1 ? 's' : ''}` : "View & Send Messages"}
                      arrow
                      placement="top"
                    >
                      <Badge 
                        badgeContent={unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : 0} 
                        color="error"
                        invisible={!hasUnread}
                        overlap="circular"
                        anchorOrigin={{
                          vertical: 'top',
                          horizontal: 'right',
                        }}
                        sx={{
                          '& .MuiBadge-badge': {
                            fontWeight: 'bold',
                            fontSize: { xs: '0.65rem', sm: '0.7rem' },
                            minWidth: { xs: '18px', sm: '20px' },
                            height: { xs: '18px', sm: '20px' },
                            padding: { xs: '0 4px', sm: '0 6px' },
                            backgroundColor: '#f44336',
                            color: '#ffffff',
                            boxShadow: '0 2px 8px rgba(244, 67, 54, 0.4)',
                            border: '2px solid #ffffff',
                            animation: hasUnread ? 'pulse 2s infinite' : 'none',
                            '@keyframes pulse': {
                              '0%': {
                                transform: 'scale(1)',
                                boxShadow: '0 2px 8px rgba(244, 67, 54, 0.4)',
                              },
                              '50%': {
                                transform: 'scale(1.1)',
                                boxShadow: '0 4px 12px rgba(244, 67, 54, 0.6)',
                              },
                              '100%': {
                                transform: 'scale(1)',
                                boxShadow: '0 2px 8px rgba(244, 67, 54, 0.4)',
                              },
                            }
                          }
                        }}
                      >
                        <Box
                          sx={{
                            position: 'relative',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: { xs: '36px', sm: '40px' },
                            height: { xs: '36px', sm: '40px' },
                            borderRadius: '50%',
                            backgroundColor: hasUnread ? '#e3f2fd' : 'transparent',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                              backgroundColor: '#e3f2fd',
                              transform: 'scale(1.1)',
                            }
                          }}
                        >
                          <CommentIcon sx={{ 
                            color: hasUnread ? '#1976d2' : '#666',
                            fontSize: { xs: '1.25rem', sm: '1.5rem' },
                            fontWeight: hasUnread ? 'bold' : 'normal',
                            transition: 'all 0.3s ease',
                          }} />
                        </Box>
                      </Badge>
                    </Tooltip>
                  }
                  label="View & Send Messages"
                  onClick={() => handleViewAndSendMessages(row)}
                  color="info"
                />
              );
            }
          }

          // Show print button for ceo_pending status with print permission
          if (row.status === 'ceo_pending' && canPrint) {
            actions.push(
              <GridActionsCellItem
                key="print"
                icon={<Tooltip title="Print PDF"><PrintIcon /></Tooltip>}
                label="Print PDF"
                onClick={() => handlePrint(row)}
                color="secondary"
              />
            );
          }

          // Show manual approval button for ceo_pending status with manual_approval permission
          if (row.status === 'ceo_pending' && canManualApproval) {
            actions.push(
              <GridActionsCellItem
                key="manualApproval"
                icon={<Tooltip title="Manual Approval"><ManualApprovalIcon /></Tooltip>}
                label="Manual Approval"
                onClick={() => handleManualApproval(row)}
                color="warning"
              />
            );
          }
          
          // Show View Manual Approval button if manual approval data exists (reason or file in DB)
          if (canRead && (row.manual_approval_reason || row.has_manual_approval_file)) {
            actions.push(
              <GridActionsCellItem
                key="viewManualApproval"
                icon={<Tooltip title="View Manual Approval"><ManualApprovalIcon sx={{ color: '#ff9800' }} /></Tooltip>}
                label="View Manual Approval"
                onClick={() => handleViewManualApproval(row)}
                color="warning"
              />
            );
          }


          // Show invoice viewer if invoice files exist; hide for read_approved_request (they use combined modal)
          if (canRead && row.has_invoice_files && !hasReadApprovedRequestPermission) {
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

          // Payment proof icon removed - now using row selection for bulk payment processing

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
          
          return actions;
        },
      },
    ];

    return baseColumns;
    },
    [canApprove, canReject, canAssign, canUpdate, canRead, canAddComment, canPrint, canManualApproval, canPaymentRelease, showSelectionColumn, selectedRequests, filteredRows, handleView, handleViewDetails, handleEdit, handleApprove, handleReject, handleAssign, handleReviewAgain, handleViewComments, handleViewRejectionComments, handleSendToCEO, handleViewHistory, handleAddComment, handleViewMarketingComments, handleViewAndSendMessages, handlePrint, handleManualApproval, handleViewManualApproval, handleViewInvoice, handleViewOldPurchases, handleSelectAll, handleSelectRequest, handleBulkReleasePayment, getVendorName],
  );

  const pageTitle = 'Area Head Requests';

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

      {/* Search Filters */}
      <ShopboardRequestFilters
        onFilterChange={handleFilterChange}
        loading={isLoading}
        filteredCount={rowsState.rowCount}
        showFilteredCount={!!(filters.vendor || filters.status || filters.region || filters.parentDealer || filters.childDealer || filters.salesHead || filters.startDate || filters.endDate)}
      />

      {/* Top toolbar actions (above table) */}
      {(canManualApproval || canPaymentRelease) && showSelectionColumn && selectedRequests.length > 0 && (
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-start', gap: 2 }}>
          {/* Determine button states based on selected request statuses */}
          {(() => {
            const selectedRequestObjects = filteredRows.filter(row => selectedRequests.includes(row.id));
            const hasCeoPending = selectedRequestObjects.some(req => req.status === 'ceo_pending');
            const hasInvoiceSent = selectedRequestObjects.some(req => req.status === 'invoice_sent');
            const hasSubmittedForPayment = selectedRequestObjects.some(req => req.status === SHOPBOARD_REQUEST_STATUS.SUBMITTED_FOR_PAYMENT);
            const hasMixedSelection = (hasCeoPending && hasInvoiceSent) || 
                                     (hasCeoPending && hasSubmittedForPayment) || 
                                     (hasInvoiceSent && hasSubmittedForPayment);
            
            return (
              <>
                {canManualApproval && (
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleBulkSendToCEO}
                    disabled={hasMixedSelection || hasInvoiceSent || hasSubmittedForPayment || selectedRequestObjects.some(req => req.is_email === true)}
                    sx={{ fontWeight: 'bold', textTransform: 'none' }}
                  >
                    Send to CEO for Approval
                  </Button>
                )}
                {canManualApproval && (
                  <Button
                    variant="contained"
                    color="secondary"
                    onClick={handleBulkSendToDirectors}
                    disabled={
                      hasMixedSelection ||
                      hasInvoiceSent ||
                      hasSubmittedForPayment ||
                      selectedRequestObjects.length === 0 ||
                      selectedRequestObjects.some((req) => req.status !== 'ceo_pending')
                    }
                    startIcon={<SendToDirectorsIcon />}
                    sx={{ fontWeight: 'bold', textTransform: 'none' }}
                  >
                    Send to Directors
                  </Button>
                )}
                {canManualApproval && (
                  <Button
                    variant="contained"
                    color="info"
                    onClick={handleBulkSendToAdditionalDirectors}
                    disabled={
                      hasMixedSelection ||
                      hasInvoiceSent ||
                      hasSubmittedForPayment ||
                      selectedRequestObjects.length === 0 ||
                      selectedRequestObjects.some((req) => req.status !== 'ceo_pending')
                    }
                    startIcon={<SendToAdditionalDirectorsIcon />}
                    sx={{ fontWeight: 'bold', textTransform: 'none' }}
                  >
                    Send to Additional Director
                  </Button>
                )}
                {canManualApproval && (
                  <Button
                    variant="contained"
                    color="success"
                    onClick={handleBulkReleasePayment}
                    disabled={hasMixedSelection || hasCeoPending || hasSubmittedForPayment || isLoading || selectedRequestObjects.filter(req => req.status === 'invoice_sent').length === 0}
                    sx={{ fontWeight: 'bold', textTransform: 'none' }}
                  >
                    {isLoading ? 'Processing...' : 'Release Payment'}
                  </Button>
                )}
                {canPaymentRelease && (
                  <Button
                    variant="contained"
                    color="success"
                    onClick={handleOpenPaymentSummary}
                    disabled={hasMixedSelection || hasCeoPending || hasInvoiceSent || isLoading || selectedRequestObjects.filter(req => req.status === SHOPBOARD_REQUEST_STATUS.SUBMITTED_FOR_PAYMENT).length === 0}
                    sx={{ fontWeight: 'bold', textTransform: 'none' }}
                    startIcon={<PaymentIcon />}
                  >
                    Process Payment
                  </Button>
                )}
              </>
            );
          })()}
        </Box>
      )}

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
        onView={null} // Disable default view action
        onEdit={null} // Disable default edit action
        onDelete={null} // Disable default delete action
        onRefresh={null}
        
        // Row interaction
        onRowClick={canRead ? handleRowClick : null}
        
        // Row styling - for manual_approval users highlight "under_review", for others highlight "not decided"
        getRowClassName={(params) => {
          const status = params.row.status;
          const normalized = status != null ? String(status).toLowerCase().trim() : '';
          if (canManualApproval) {
            if (normalized === SHOPBOARD_REQUEST_STATUS.UNDER_REVIEW) {
              return 'not-decided-row';
            }
          } else {
            if (normalized === SHOPBOARD_REQUEST_STATUS.NOT_DECIDED) {
              return 'not-decided-row';
            }
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
          // Explicit normal font weight for all rows so only "not decided" rows appear bold.
          // (If system theme or OS "Bold Text" is on, all text may still look bold - that's outside our control.)
          '& .MuiDataGrid-row': {
            fontWeight: 400,
          },
          '& .MuiDataGrid-cell': {
            fontWeight: 400,
          },
          '& .MuiDataGrid-cell *': {
            fontWeight: 400,
          },
          // Custom styling for "not decided" rows - Professional blue theme matching Filters section
          '& .not-decided-row': {
            backgroundColor: '#f0f4ff !important', // Very light blue background (matches Filters border)
            borderLeft: '4px solid #1a237e', // Dark blue left border accent (matches Filters text color)
            boxShadow: '0 1px 3px rgba(26, 35, 126, 0.08)', // Subtle professional shadow
            fontWeight: 'bold !important', // Make all text bold in the row
            '&:hover': {
              backgroundColor: '#e3f2fd !important', // Light blue on hover (matches primary theme)
              boxShadow: '0 2px 6px rgba(26, 35, 126, 0.12)',
            },
            '& .MuiDataGrid-cell': {
              borderBottom: '1px solid rgba(224, 231, 255, 0.5)', // Subtle light blue bottom border (matches Filters border)
              fontWeight: 'bold !important', // Make all text bold in cells
              '& *': {
                fontWeight: 'bold !important', // Make all nested elements bold
              },
            },
          },
        }}
      />

      {/* View Request Details Modal */}
      <DynamicModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        mode="view"
        title="Request Details"
        initialData={(() => {
          const data = selectedRequest || {};
          // Check if there's a parent dealer and add parent fields to initialData
          const hasParent = data?.dealer_relation?.parent && 
                            data?.dealer?.id && 
                            data.dealer.id !== data.dealer_relation.parent.id;
          
          if (hasParent && data.dealer_relation.parent) {
            const parent = data.dealer_relation.parent;
            return {
              ...data,
              parent_dealer_code: parent.code || 'N/A',
              parent_dealer_name: parent.name || 'N/A',
              parent_dealer_phone: parent.phone || 'N/A',
            };
          }
          return data;
        })()}
        fields={getRequestFields(selectedRequest)}
        onSubmit={() => setModalOpen(false)}
        loading={false}
        hideSubmitButton={true}
        customContent={
          (() => {
            const hasSurveyItems =
              Array.isArray(selectedRequest?.surveyRequestItems) &&
              selectedRequest.surveyRequestItems.length > 0;
            const hasSurveyComments =
              Array.isArray(selectedRequest?.surveyComments) &&
              selectedRequest.surveyComments.length > 0;
            const hasSurveyAttachments =
              Array.isArray(selectedRequest?.survey_form_attachments) &&
              selectedRequest.survey_form_attachments.length > 0;

            if (!hasSurveyItems && !hasSurveyComments && !hasSurveyAttachments) {
              return null;
            }

            return (
              <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {(hasSurveyItems || hasSurveyComments) && (
                  <Box>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#1976d2' }}>
                      Survey Details
                    </Typography>

                    {hasSurveyItems && (
                      <Box sx={{ mb: hasSurveyComments ? 2 : 0 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 1 }}>
                          Suggested Request Items
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          {selectedRequest.surveyRequestItems.map((item) => (
                            <Chip
                              key={item.id}
                              label={item.requestType?.name || `Request Type #${item.request_item_id}`}
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                          ))}
                        </Box>
                      </Box>
                    )}

                    {hasSurveyComments && (
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 1 }}>
                          Survey Comments
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {selectedRequest.surveyComments.map((surveyComment) => (
                            <Box
                              key={surveyComment.id}
                              sx={{
                                p: 1.5,
                                backgroundColor: '#f8f9fa',
                                borderRadius: 1,
                                border: '1px solid #e0e0e0',
                              }}
                            >
                              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                {surveyComment.comment}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      </Box>
                    )}
                  </Box>
                )}

                {hasSurveyAttachments && (
                  <Box>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#1976d2' }}>
                      Survey Form Attachments
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {selectedRequest.survey_form_attachments.map((file, index) => {
                        const { url, fileName } = getFileUrlAndName(file, index, `Survey Form ${index + 1}`);
                        const fileUrl = url.startsWith('data:') || url.startsWith('http') ? url : (url.startsWith('/') ? `${BASE_URL}${url}` : `${BASE_URL}/uploads/survey_forms/${url}`);
                        return (
                          <Chip
                            key={index}
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
                  </Box>
                )}
              </Box>
            );
          })()
        }
      />

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
          Confirm Approval
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#333', mb: 2 }}>
            Are you sure you want to approve request <strong>#{requestToAction?.id}</strong>?
          </Typography>
          <Typography variant="body2" sx={{ color: '#666' }}>
            This action will mark the request as processing.
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
            {isLoading ? 'Approving...' : 'Approve'}
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
          Reject Request
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#333', mb: 2 }}>
            Are you sure you want to reject request <strong>#{requestToAction?.id}</strong>?
          </Typography>
          <Typography variant="body2" sx={{ color: '#666', mb: 2 }}>
            This action will permanently reject this request.
          </Typography>
          
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Rejection Comment *"
            placeholder="Please provide a reason for rejection..."
            value={rejectionComment}
            onChange={(e) => setRejectionComment(e.target.value)}
            variant="outlined"
            required
            error={rejectionComment !== undefined && rejectionComment.trim() === ''}
            sx={{ mt: 2 }}
            helperText="A comment is required to reject this request"
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

      {/* Review Again Confirmation Dialog */}
      <Dialog
        open={reviewAgainDialogOpen}
        onClose={cancelReviewAgain}
        aria-labelledby="review-again-dialog-title"
        PaperProps={{
          sx: {
            backgroundColor: '#ffffff',
            minWidth: '400px',
          }
        }}
      >
        <DialogTitle 
          id="review-again-dialog-title"
          sx={{ 
            color: 'warning.main',
            fontWeight: 'bold',
          }}
        >
          Review Request Again
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#333', mb: 2 }}>
            Are you sure you want to mark request <strong>#{requestToAction?.id}</strong> for review again?
          </Typography>
          <Typography variant="body2" sx={{ color: '#666' }}>
            This will change the status back to "Not Decided" so it can be processed or marked for review again.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button 
            onClick={cancelReviewAgain}
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
            onClick={confirmReviewAgain}
            variant="contained"
            color="warning"
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : 'Review Again'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Assign to Vendor Dialog */}
      <Dialog
        open={assignDialogOpen}
        onClose={cancelAssign}
        aria-labelledby="assign-dialog-title"
        PaperProps={{
          sx: {
            backgroundColor: '#ffffff',
            minWidth: '500px',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'auto',
          }
        }}
      >
        <DialogTitle 
          id="assign-dialog-title"
          sx={{ 
            color: 'secondary.main',
            fontWeight: 'bold',
          }}
        >
          Assign to Vendor
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#333', mb: 2 }}>
            Select a vendor to assign for processing request <strong>#{requestToAction?.id}</strong>:
          </Typography>
          <Typography variant="body2" sx={{ color: '#666', mb: 1 }}>
            Choose from available SAP vendors to assign this request for quotation.
          </Typography>
          {requestToAction?.dealer?.district && (
            <Typography variant="body2" sx={{ color: '#1976d2', mb: 2, fontStyle: 'italic' }}>
              Showing vendors from <strong>{requestToAction.dealer.district}</strong> region only.
            </Typography>
          )}
          
          {loadingVendors ? (
            <Typography>Loading vendors...</Typography>
          ) : vendorsError ? (
            <Alert severity="error">{vendorsError}</Alert>
          ) : vendors.length === 0 ? (
            <Box sx={{ 
              textAlign: 'center', 
              py: 4, 
              px: 2,
              backgroundColor: '#f5f5f5',
              borderRadius: 2,
              border: '1px solid #e0e0e0'
            }}>
              <Typography variant="h6" sx={{ color: '#666', mb: 1 }}>
                No vendors available for this region
              </Typography>
              <Typography variant="body2" sx={{ color: '#999' }}>
                There are no SAP vendors assigned to <strong>{requestToAction?.dealer?.district}</strong> region.
              </Typography>
              <Typography variant="body2" sx={{ color: '#999', mt: 1 }}>
                Please contact the administrator to assign vendors to this region.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Vendor Search Autocomplete */}
              <Autocomplete
                options={vendors}
                getOptionLabel={(option) => option.name || ''}
                value={selectedVendor}
                onChange={(event, newValue) => {
                  setSelectedVendor(newValue);
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Search and Select Vendor"
                    placeholder="Type to search vendors..."
                    variant="outlined"
                    fullWidth
                  />
                )}
                renderOption={(props, option) => (
                  <Box 
                    component="li" 
                    {...props} 
                    sx={{ 
                      py: 1.5,
                      px: 2,
                      margin: '2px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'transparent',
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        backgroundColor: '#e3f2fd',
                        transform: 'translateY(-1px)',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                      },
                      '&.Mui-focused': {
                        backgroundColor: '#bbdefb',
                      }
                    }}
                  >
                    <Box>
                      <Typography variant="subtitle1" sx={{ 
                        fontWeight: 'bold', 
                        fontSize: '0.9rem',
                        color: '#1976d2',
                        mb: 0.5
                      }}>
                        {option.card_name || option.name}
                      </Typography>
                      <Typography variant="body2" sx={{ 
                        color: '#666', 
                        fontSize: '0.8rem',
                        mb: 0.25
                      }}>
                        Code: {option.username}
                      </Typography>
                      {option.region?.name && (
                        <Typography variant="body2" sx={{ 
                          color: '#666', 
                          fontSize: '0.8rem',
                          mb: 0.25
                        }}>
                          Region: {option.region.name}
                        </Typography>
                      )}
                      {option.contact_person && (
                        <Typography variant="body2" sx={{ 
                          color: '#666', 
                          fontSize: '0.8rem',
                          mb: 0.25
                        }}>
                          Contact: {option.contact_person}
                        </Typography>
                      )}
                      {(option.phone || option.cellular) && (
                        <Typography variant="body2" sx={{ 
                          color: '#666', 
                          fontSize: '0.8rem'
                        }}>
                          Phone: {option.phone || option.cellular}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                )}
                isOptionEqualToValue={(option, value) => option.id === value?.id}
                noOptionsText="No vendors found"
                loading={loadingVendors}
                disabled={isLoading}
                ListboxProps={{
                  style: {
                    maxHeight: '200px', // Limit dropdown height
                    maxWidth: '100%',   // Ensure it doesn't exceed container width
                  }
                }}
                PaperComponent={({ children, ...other }) => (
                  <Box
                    {...other}
                    sx={{
                      maxHeight: '200px',
                      maxWidth: '100%',
                      backgroundColor: '#f8f9fa',
                      border: '1px solid #e9ecef',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                      '& .MuiAutocomplete-listbox': {
                        maxHeight: '200px',
                        padding: '4px 0',
                        backgroundColor: 'transparent',
                      }
                    }}
                  >
                    {children}
                  </Box>
                )}
                sx={{
                  '& .MuiAutocomplete-popper': {
                    maxHeight: '200px',
                    maxWidth: '100%',
                    '& .MuiPaper-root': {
                      backgroundColor: '#f8f9fa',
                      border: '1px solid #e9ecef',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                    }
                  },
                  '& .MuiAutocomplete-listbox': {
                    maxHeight: '200px',
                    padding: '8px 0',
                    backgroundColor: 'transparent',
                  },
                  '& .MuiAutocomplete-noOptions': {
                    color: '#666',
                    padding: '16px',
                    textAlign: 'center',
                    backgroundColor: '#f8f9fa',
                  }
                }}
              />

              {/* Selected Vendor Display */}
              {selectedVendor && (
                <Box sx={{ 
                  p: 2, 
                  border: '1px solid #e0e0e0', 
                  borderRadius: 1, 
                  backgroundColor: '#f9f9f9' 
                }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Selected Vendor:
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                    {selectedVendor.card_name || selectedVendor.name}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#666' }}>
                    Code: {selectedVendor.username}
                  </Typography>
                  {selectedVendor.region?.name && (
                    <Typography variant="body2" sx={{ color: '#666' }}>
                      Region: {selectedVendor.region.name}
                    </Typography>
                  )}
                  {selectedVendor.contact_person && (
                    <Typography variant="body2" sx={{ color: '#666' }}>
                      Contact: {selectedVendor.contact_person}
                    </Typography>
                  )}
                  {(selectedVendor.phone || selectedVendor.cellular) && (
                    <Typography variant="body2" sx={{ color: '#666' }}>
                      Phone: {selectedVendor.phone || selectedVendor.cellular}
                    </Typography>
                  )}
                </Box>
              )}

              {/* Vendor Comment Field */}
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Vendor Comment (Optional)"
                placeholder="Add any specific instructions or notes for the vendor..."
                value={vendorComment}
                onChange={(e) => setVendorComment(e.target.value)}
                variant="outlined"
                helperText="This comment will be associated with the vendor assignment"
                disabled={isLoading}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button 
            onClick={cancelAssign}
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
            onClick={confirmAssign}
            variant="contained"
            color="secondary"
            disabled={isLoading || !selectedVendor || vendors.length === 0}
            sx={{
              minWidth: '180px',
              '&:disabled': {
                backgroundColor: '#e0e0e0',
                color: '#999',
              }
            }}
          >
            {isLoading ? 'Processing...' : vendors.length === 0 ? 'No Vendors Available' : 'Request for Quotation'}
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
          Edit Request #{editingRequest?.id}
        </DialogTitle>
        <DialogContent>
          {loadingDropdowns ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <Typography>Loading form data...</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              {/* Budget Warning - Only show if approval_date is null */}
              {!editingRequest?.approval_date && budgetWarning && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontWeight: 600,
                      whiteSpace: 'pre-line' // Preserve line breaks
                    }}
                  >
                    {budgetWarning}
                  </Typography>
                </Alert>
              )}
              
              {/* Dealer Selection - Read Only */}
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

              {/* Request Items */}
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                  Request Types & Dimensions
                </Typography>
                <Divider sx={{ mb: 2 }} />
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
                          // For manual type: set price_per_sqft from API, keep existing width/height, calculate price
                          const pricePerSqft = selectedRequestType?.price || '';
                          const widthFt = parseFloat(newItems[index].width) || 0;
                          const heightFt = parseFloat(newItems[index].height) || 0;
                          const areaSqft = widthFt * heightFt;
                          const pricePerSqftNum = parseFloat(pricePerSqft) || 0;
                          const total = areaSqft * pricePerSqftNum;
                          
                          newItems[index] = { 
                            ...newItems[index], 
                            request_type_id: newValue?.id || '',
                            price_per_sqft: pricePerSqft,
                            price: isNaN(total) ? '' : Number(total.toFixed(2))
                          };
                        } else if (isFees) {
                          // For fees type: set width/height to 0, price_per_sqft from API, keep existing price (editable)
                          const pricePerSqft = selectedRequestType?.price || '';
                          newItems[index] = { 
                            ...newItems[index], 
                            request_type_id: newValue?.id || '',
                            width: '0',
                            height: '0',
                            price_per_sqft: pricePerSqft,
                            price: newItems[index].price || '' // Keep existing price, allow editing
                          };
                        } else {
                          // For fixed type: use existing behavior
                          const pricePerSqft = selectedRequestType?.price || '';
                          newItems[index] = { 
                            ...newItems[index], 
                            request_type_id: newValue?.id || '',
                            price_per_sqft: pricePerSqft,
                            // Recalculate price if width and height are already set
                            price: (() => {
                              const widthFt = parseFloat(newItems[index].width) || 0;
                              const heightFt = parseFloat(newItems[index].height) || 0;
                              const areaSqft = widthFt * heightFt;
                              const pricePerSqftNum = parseFloat(pricePerSqft) || 0;
                              const total = areaSqft * pricePerSqftNum;
                              return isNaN(total) ? '' : Number(total.toFixed(2));
                            })()
                          };
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
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
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
                          const widthFt = parseFloat(newItems[index].width) || 0;
                          const heightFt = parseFloat(newItems[index].height) || 0;
                          const areaSqft = widthFt * heightFt;
                          const pricePerSqft = parseFloat(newItems[index].price_per_sqft) || 0;
                          const total = areaSqft * pricePerSqft;
                          newItems[index].price = isNaN(total) ? '' : Number(total.toFixed(2));
                          handleEditFormChange('request_items', newItems);
                        }}
                        variant="outlined"
                        disabled={isLoading || (() => {
                          const selectedRequestType = requestTypes.find(rt => rt.id === item.request_type_id);
                          return selectedRequestType?.request_type === 'fees';
                        })()}
                        sx={{ flex: 1, minWidth: 140 }}
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
                          const widthFt = parseFloat(newItems[index].width) || 0;
                          const heightFt = parseFloat(newItems[index].height) || 0;
                          const areaSqft = widthFt * heightFt;
                          const pricePerSqft = parseFloat(newItems[index].price_per_sqft) || 0;
                          const total = areaSqft * pricePerSqft;
                          newItems[index].price = isNaN(total) ? '' : Number(total.toFixed(2));
                          handleEditFormChange('request_items', newItems);
                        }}
                        variant="outlined"
                        disabled={isLoading || (() => {
                          const selectedRequestType = requestTypes.find(rt => rt.id === item.request_type_id);
                          return selectedRequestType?.request_type === 'fees';
                        })()}
                        sx={{ flex: 1, minWidth: 140 }}
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
                        sx={{ flex: 1, minWidth: 160 }}
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
                            const widthFt = parseFloat(newItems[index].width) || 0;
                            const heightFt = parseFloat(newItems[index].height) || 0;
                            const areaSqft = widthFt * heightFt;
                            const pricePerSqft = parseFloat(e.target.value) || 0;
                            const total = areaSqft * pricePerSqft;
                            newItems[index].price = isNaN(total) ? '' : Number(total.toFixed(2));
                            handleEditFormChange('request_items', newItems);
                          }
                        }}
                        variant="outlined"
                        disabled={isLoading || (() => {
                          const selectedRequestType = requestTypes.find(rt => rt.id === item.request_type_id);
                          return selectedRequestType?.request_type === 'fixed' || selectedRequestType?.request_type === 'fees';
                        })()}
                        sx={{ flex: 1, minWidth: 180 }}
                        inputProps={{ step: '0.01', min: '0' }}
                        InputProps={{ startAdornment: <InputAdornment position="start">₨</InputAdornment> }}
                        helperText={(() => {
                          const selectedRequestType = requestTypes.find(rt => rt.id === item.request_type_id);
                          if (selectedRequestType?.request_type === 'manual') return 'Editable for manual type';
                          if (selectedRequestType?.request_type === 'fees') return 'Read-only for fees type';
                          return 'per square foot';
                        })()}
                      />
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
                          
                          // For manual and fixed: calculate from area × price per sqft
                          const widthFt = parseFloat(item.width) || 0;
                          const heightFt = parseFloat(item.height) || 0;
                          const areaSqft = widthFt * heightFt;
                          const pricePerSqft = parseFloat(item.price_per_sqft) || 0;
                          const total = areaSqft * pricePerSqft;
                          return isNaN(total) ? '0.00' : total.toFixed(2);
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
                          return 'Area × price per ft²';
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
                    </Box>
                  </Paper>
                  );
                })}
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      const newItems = [...(editFormData.request_items || []), { 
                        temp_id: `temp_${Date.now()}_${Math.random()}`, // Unique temporary ID for new items
                        request_type_id: '', 
                        width: '', 
                        height: '', 
                        price: '', 
                        price_per_sqft: '' 
                      }];
                      handleEditFormChange('request_items', newItems);
                    }}
                    disabled={isLoading || requestTypes.length === 0}
                    startIcon={<AddIcon />}
                  >
                    Add Request Type
                  </Button>
                </Box>
                {requestTypes.length === 0 && (
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', mt: 1 }}>
                    Cannot add request types - no allowed request types available for this vendor
                  </Typography>
                )}
                <Box sx={{ mt: 2, p: 2, borderRadius: 2, backgroundColor: '#f0f7ff', border: '1px solid #d0e6ff' }}>
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
                          
                          // For manual and fixed: calculate area × price_per_sqft
                          const widthFt = parseFloat(it.width) || 0;
                          const heightFt = parseFloat(it.height) || 0;
                          const areaSqft = widthFt * heightFt;
                          const pricePerSqft = parseFloat(it.price_per_sqft) || 0;
                          const itemTotal = areaSqft * pricePerSqft;
                          return sum + (isNaN(itemTotal) ? 0 : itemTotal);
                        }, 0);
                        return total.toFixed(2);
                      })()}
                      disabled
                      InputProps={{ startAdornment: <InputAdornment position="start">₨</InputAdornment> }}
                      sx={{ minWidth: 220 }}
                    />
                  </Box>
                </Box>
              </Paper>


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
                    label="Warranty Status *"
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
                    );})}
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
                    );})}
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
            disabled={isLoading || loadingDropdowns}
            sx={{
              minWidth: '120px'
            }}
          >
            {isLoading ? 'Updating...' : 'Update Request'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Send to CEO Confirmation Dialog */}
      <Dialog
        open={sendToCEODialogOpen}
        onClose={cancelSendToCEO}
        aria-labelledby="send-to-ceo-dialog-title"
        PaperProps={{
          sx: {
            backgroundColor: '#ffffff',
            minWidth: '400px',
          }
        }}
      >
        <DialogTitle 
          id="send-to-ceo-dialog-title"
          sx={{ 
            color: 'success.main',
            fontWeight: 'bold',
          }}
        >
          Send Request to Marketing Head
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#333', mb: 2 }}>
            Are you sure you want to send request <strong>#{requestToAction?.id}</strong> to Marketing Head?
          </Typography>
          <Typography variant="body2" sx={{ color: '#666' }}>
            This action will mark the request as completed and send it to Marketing Head for final approval.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button 
            onClick={cancelSendToCEO}
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
            onClick={confirmSendToCEO}
            variant="contained"
            color="success"
            disabled={isLoading}
          >
            {isLoading ? 'Sending...' : 'Send to Marketing Head'}
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
          Vendor Rejection Comments - Request #{requestToAction?.id}
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

      {/* View Rejection Comments Dialog */}
      <Dialog
        open={rejectionCommentsDialogOpen}
        onClose={cancelRejectionComments}
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
          sx={{ color: 'error.main', fontWeight: 'bold' }}
        >
          Rejection Comments — Request #{requestToAction?.id}
        </DialogTitle>
        <DialogContent>
          {loadingRejectionComments ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <Typography>Loading rejection comments...</Typography>
            </Box>
          ) : rejectionCommentsList.length === 0 ? (
            <Box sx={{ textAlign: 'center', p: 4 }}>
              <Typography variant="body1" sx={{ color: '#666' }}>
                No rejection comments found for this request.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {rejectionCommentsList.map((comment, index) => (
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
            onClick={cancelRejectionComments}
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

      {/* View History Dialog */}
      <Dialog
        open={historyDialogOpen}
        onClose={cancelHistory}
        aria-labelledby="history-dialog-title"
        sx={{
          zIndex: 1400, // Higher z-index to appear above table
        }}
        PaperProps={{
          sx: {
            backgroundColor: '#ffffff',
            minWidth: '600px',
            maxWidth: '900px',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
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
        <DialogContent
          sx={{
            overflowY: 'auto',
            flex: '1 1 auto',
            minHeight: 0,
          }}
        >
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
                // Compare each entry with the immediate previous (newer) entry
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
                            {/* Only show width if it exists and is greater than 0 */}
                            {item.width !== null && item.width !== undefined && parseFloat(item.width) > 0 && (
                              <Typography variant="body2" sx={{ color: '#333', mb: 0.5 }}>
                                Width: {item.width} ft
                              </Typography>
                            )}
                            {/* Only show height if it exists and is greater than 0 */}
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

      {/* Comments Dialog Component */}
      <CommentsDialog
        // Add Comment Dialog Props
        addCommentDialogOpen={addCommentDialogOpen}
        onCloseAddComment={cancelAddComment}
        onConfirmAddComment={confirmAddComment}
        newComment={newComment}
        onCommentChange={setNewComment}
        isLoading={isLoading}
        requestId={requestToAction?.id}
        
        // Messages Dialog Props
        messagesDialogOpen={marketingCommentsDialogOpen}
        onCloseMessages={cancelMarketingComments}
        messages={marketingComments}
        loadingMessages={loadingMarketingComments}
        canAddComment={canAddComment}
        currentUser={user}
        onSendMessage={handleSendMessageFromDialog}
        onClearMessage={() => setNewComment('')}
      />

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
          Request Details - #{selectedDetailedRequest?.id}
        </DialogTitle>
        <DialogContent>
          {selectedDetailedRequest && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
              {/* Dealer Information */}
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
                              Price per (sqft)
                            </Typography>
                            <Typography variant="body2">
                              {item.price_per_square_foot ? `₨${parseFloat(item.price_per_square_foot).toFixed(2)}` : 'N/A'}
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
                      label={
                        selectedDetailedRequest.status === 'invoice_sent' ? 'Invoice Received' :
                        selectedDetailedRequest.status || 'Not Decided'
                      } 
                      variant="filled" 
                      size="small"
                      color={
                        selectedDetailedRequest.status === 'processing' ? 'success' :
                        selectedDetailedRequest.status === 'review requested' ? 'error' :
                        selectedDetailedRequest.status === 'rfq not accepted' ? 'error' :
                        selectedDetailedRequest.status === 'Rfq' ? 'info' :
                        selectedDetailedRequest.status === 'quotation sent' ? 'secondary' :
                        selectedDetailedRequest.status === 'invoice_sent' ? 'primary' :
                        selectedDetailedRequest.status === 'payment_released' ? 'success' :
                        selectedDetailedRequest.status === 'ceo_pending' ? 'warning' :
                        selectedDetailedRequest.status === 'under_review' ? 'info' :
                        'default'
                      }
                    />
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                      Assigned Vendor
                    </Typography>
                    <Typography variant="body1">
                      {getVendorName(selectedDetailedRequest) || 'Not assigned'}
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

      {/* Manual Approval Modal */}
      <Dialog
        open={manualApprovalModalOpen}
        onClose={() => setManualApprovalModalOpen(false)}
        aria-labelledby="manual-approval-dialog-title"
        PaperProps={{
          sx: {
            backgroundColor: '#ffffff',
            minWidth: '500px',
            maxWidth: '600px',
            borderRadius: 2,
            boxShadow: 6,
          }
        }}
      >
        <DialogTitle 
          id="manual-approval-dialog-title"
          sx={{ 
            color: 'success.main',
            fontWeight: 'bold',
            borderBottom: '1px solid #eaeaea',
            padding: '20px 24px 16px 24px'
          }}
        >
          Manual Approval
        </DialogTitle>
        
        <DialogContent sx={{ padding: '20px 24px' }}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Request ID: {selectedRequest?.id}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Dealer: {selectedRequest?.dealer?.name || selectedRequest?.dealerName || 'N/A'}
            </Typography>
          </Box>

          <TextField
            fullWidth
            multiline
            rows={4}
            label="Reason for Manual Approval *"
            value={manualApprovalReason}
            onChange={(e) => setManualApprovalReason(e.target.value)}
            placeholder="Enter the reason for manual approval..."
            sx={{ mb: 3 }}
            required
            error={!manualApprovalReason || manualApprovalReason.trim() === ''}
            helperText={(!manualApprovalReason || manualApprovalReason.trim() === '') ? 'Reason for manual approval is required' : ''}
          />

          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium' }}>
              Upload File (Optional)
            </Typography>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={(e) => setManualApprovalFile(e.target.files[0] || null)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
            {manualApprovalFile && (
              <Typography variant="caption" color="success.main" sx={{ mt: 1, display: 'block' }}>
                File selected: {manualApprovalFile.name}
              </Typography>
            )}
          </Box>
        </DialogContent>
        
        <DialogActions sx={{ padding: '16px 24px 20px 24px', gap: 1 }}>
          <Button
            onClick={() => setManualApprovalModalOpen(false)}
            variant="outlined"
            color="secondary"
            disabled={manualApprovalLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleManualApprovalSubmit}
            variant="contained"
            color="success"
            disabled={manualApprovalLoading || !manualApprovalReason || manualApprovalReason.trim() === ''}
            sx={{
              minWidth: '120px',
              fontWeight: 'bold'
            }}
          >
            {manualApprovalLoading ? 'Approving...' : 'Approve'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* View Manual Approval Modal */}
      <Dialog
        open={viewManualApprovalModalOpen}
        onClose={() => {
          setViewManualApprovalModalOpen(false);
          setSelectedManualApprovalRequest(null);
        }}
        aria-labelledby="view-manual-approval-dialog-title"
        PaperProps={{
          sx: {
            backgroundColor: '#ffffff',
            minWidth: '600px',
            maxWidth: '800px',
            borderRadius: 2,
            boxShadow: 6,
          }
        }}
      >
        <DialogTitle 
          id="view-manual-approval-dialog-title"
          sx={{ 
            color: '#ff9800',
            fontWeight: 'bold',
            borderBottom: '1px solid #eaeaea',
            padding: '20px 24px 16px 24px'
          }}
        >
          Manual Approval Details
        </DialogTitle>
        
        <DialogContent sx={{ padding: '20px 24px' }}>
          {selectedManualApprovalRequest && (
            <Box>
              {/* Manual Approval Reason */}
              <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: '#ff9800' }}>
                  Manual Approval Comments
                </Typography>
                <Typography 
                  variant="body1" 
                  sx={{ 
                    p: 2, 
                    backgroundColor: '#f5f5f5', 
                    borderRadius: 1,
                    minHeight: '80px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}
                >
                  {selectedManualApprovalRequest.manual_approval_reason || 'No comments provided'}
                </Typography>
              </Paper>

              {/* Manual Approval File from DB (manual_approval_files) */}
              {selectedManualApprovalRequest.manual_approval_files?.length > 0 && (
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: '#ff9800' }}>
                    Uploaded File
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {selectedManualApprovalRequest.manual_approval_files.map((file, idx) => (
                      <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#666' }}>
                          File:
                        </Typography>
                        <Typography variant="body2">{file.fileName || 'N/A'}</Typography>
                        <Button
                          variant="contained"
                          color="primary"
                          size="small"
                          startIcon={<VisibilityIcon />}
                          onClick={() => openFileInNewTab(file.url)}
                          sx={{ ml: 1 }}
                        >
                          View File
                        </Button>
                      </Box>
                    ))}
                  </Box>
                </Paper>
              )}
            </Box>
          )}
        </DialogContent>
        
        <DialogActions sx={{ padding: '16px 24px 20px 24px', gap: 1 }}>
          <Button
            onClick={() => {
              setViewManualApprovalModalOpen(false);
              setSelectedManualApprovalRequest(null);
            }}
            variant="contained"
            color="primary"
            sx={{
              minWidth: '120px'
            }}
          >
            Close
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

      {/* Combined Request Details & Invoice Modal (for read_approved_request users) */}
      <RequestDetailsWithInvoiceModal
        open={combinedModalOpen}
        onClose={() => {
          setCombinedModalOpen(false);
          setSelectedCombinedRequest(null);
        }}
        requestData={selectedCombinedRequest}
        getVendorName={getVendorName}
      />

      {/* Reject Invoice Modal */}
      <RejectInvoiceModal
        open={rejectInvoiceModalOpen}
        onClose={() => { setRejectInvoiceModalOpen(false); setRejectInvoiceTarget(null); }}
        onReject={handleConfirmRejectInvoice}
        request={rejectInvoiceTarget}
        submitting={isLoading}
      />

      {/* Payment Summary Modal */}
      <PaymentSummaryModal
        open={paymentSummaryModalOpen}
        onClose={() => {
          setPaymentSummaryModalOpen(false);
          setPaymentSummaryData(null);
        }}
        paymentSummaryData={paymentSummaryData}
        onProcessPayment={handleProcessPayment}
        isLoading={isLoading}
      />

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
