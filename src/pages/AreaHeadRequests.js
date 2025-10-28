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
} from '@mui/material';
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
  History as HistoryIcon,
  Visibility as VisibilityIcon,
  Print as PrintIcon,
  Gavel as ManualApprovalIcon,
  Payment as PaymentIcon,
  Receipt as InvoiceIcon,
} from '@mui/icons-material';
import { GridActionsCellItem } from '@mui/x-data-grid';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from '../auth/AuthContext';
import ReusableDataTable from '../components/ReusableData';
import PageContainer from '../components/PageContainer';
import DynamicModal from '../components/DynamicModel';
import InvoiceViewer from '../components/InvoiceViewer';
import { BASE_URL } from "../constants/Constants";
import { useApi } from '../hooks/useApi';
import jsPDF from 'jspdf';

const INITIAL_PAGE_SIZE = 10;

export default function AreaHeadRequests() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const { user, hasPermission, token } = useAuth();
  
  // Check user permissions - using web permissions for shopboardRequest
  const canRead = user?.permissions?.shopboardRequest?.includes('read') || false;
  const canUpdate = user?.permissions?.shopboardRequest?.includes('update') || false;
  const canApprove = canUpdate; // Approve is an update operation
  const canReject = canUpdate; // Reject is an update operation
  const canAssign = canUpdate; // Assign is an update operation
  const canApprovalAction = user?.permissions?.shopboardRequest?.includes('approvals') || false;
  const canAddComment = user?.permissions?.shopboardRequest?.includes('add_comment') || false;
  const canPrint = user?.permissions?.shopboardRequest?.includes('print') || false;
  const canManualApproval = user?.permissions?.shopboardRequest?.includes('manual_approval') || false;

  const { get, post, put, patch, del } = useApi();

  const [rowsState, setRowsState] = React.useState({
    rows: [],
    rowCount: 0,
  });

  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  
  // Modal state for viewing request details
  const [modalOpen, setModalOpen] = React.useState(false);
  const [selectedRequest, setSelectedRequest] = React.useState(null);
  
  // Modal state for detailed view
  const [detailedViewModalOpen, setDetailedViewModalOpen] = React.useState(false);
  const [selectedDetailedRequest, setSelectedDetailedRequest] = React.useState(null);
  
  // Edit modal state
  const [editModalOpen, setEditModalOpen] = React.useState(false);
  const [editingRequest, setEditingRequest] = React.useState(null);
  const [editFormData, setEditFormData] = React.useState({});

  // Manual approval modal state
  const [manualApprovalModalOpen, setManualApprovalModalOpen] = React.useState(false);
  const [manualApprovalReason, setManualApprovalReason] = React.useState('');
  const [manualApprovalFile, setManualApprovalFile] = React.useState(null);
  const [manualApprovalLoading, setManualApprovalLoading] = React.useState(false);

  // Selection state for manual approval
  const [selectedRequests, setSelectedRequests] = React.useState([]);
  const [showSelectionColumn, setShowSelectionColumn] = React.useState(false);

  // Invoice viewer modal state
  const [invoiceModalOpen, setInvoiceModalOpen] = React.useState(false);
  const [selectedInvoiceRequest, setSelectedInvoiceRequest] = React.useState(null);
  
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
      const response = await get('/api/sap-users');
      
      if (response.success && Array.isArray(response.data)) {
        // Transform SAP users to vendor format for compatibility
        let vendorData = response.data.map(user => ({
          id: user.id,
          name: user.card_name || user.username,
          username: user.username,
          card_name: user.card_name,
          contact_person: user.contact_person,
          cellular: user.cellular,
          phone: user.phone,
          address: user.address,
          region: user.region,
          is_sap: user.is_sap
        }));

        // Filter vendors by dealer district if provided
        if (dealerDistrict) {
          const dealerDistrictLower = dealerDistrict.toLowerCase();
          vendorData = vendorData.filter(vendor => {
            const vendorRegionLower = vendor.region?.name?.toLowerCase() || '';
            return vendorRegionLower.includes(dealerDistrictLower) || 
                   dealerDistrictLower.includes(vendorRegionLower);
          });
          console.log(`Filtered vendors for district "${dealerDistrict}":`, vendorData.length, 'vendors');
        }
        
        setVendors(vendorData);
        console.log('SAP vendors loaded from users table:', vendorData.length, 'vendors');
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

  // Load dropdown data for edit form
  const loadDropdownData = React.useCallback(async (dealerCode = null) => {
    setLoadingDropdowns(true);
    try {
      // If we have a dealer code, fetch that specific dealer
      // Otherwise, fetch the first page of dealers
      const dealerPromise = dealerCode 
        ? get(`/api/dealers/code/${dealerCode}`)
        : get('/api/dealers');
      
      const [dealersRes, requestTypesRes, warrantyStatusesRes] = await Promise.all([
        dealerPromise,
        get('/api/request-types'),
        get('/api/warranty-statuses')
      ]);

      // Handle dealer response - could be single dealer or list
      if (dealersRes.success) {
        if (Array.isArray(dealersRes.data)) {
          setDealers(dealersRes.data);
        } else {
          // Single dealer returned - put it in an array
          setDealers([dealersRes.data]);
        }
      }
      if (requestTypesRes.success) setRequestTypes(requestTypesRes.data);
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

  // Load dropdown data when edit modal opens
  React.useEffect(() => {
    if (editModalOpen && editingRequest) {
      // Pass the dealer code to load that specific dealer
      const dealerCode = editingRequest.dealer?.code || editFormData.dealer_id;
      loadDropdownData(dealerCode);
    }
  }, [editModalOpen, editingRequest, editFormData.dealer_id, loadDropdownData]);

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
      
      const apiUrl = `/api/shopboard-requests?page=${page}&size=${pageSize}`;
      
      const requestData = await get(apiUrl);
      
      // Handle the API response format: { success: true, data: [...], totalCount: number }
      let requestsData = [];
      if (requestData.success && requestData.data && Array.isArray(requestData.data)) {
        requestsData = requestData.data;
        setRowsState({
          rows: requestData.data,
          rowCount: requestData.totalCount || requestData.data.length,
        });
      } else if (requestData.requests && Array.isArray(requestData.requests)) {
        // Fallback for different response format
        requestsData = requestData.requests;
        setRowsState({
          rows: requestData.requests,
          rowCount: requestData.totalCount || requestData.requests.length,
        });
      } else if (Array.isArray(requestData)) {
        // Fallback for direct array response
        requestsData = requestData;
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

      // Check if any request has ceo_pending status to show selection column
      const hasCeoPending = requestsData.some(request => request.status === 'ceo_pending');
      setShowSelectionColumn(hasCeoPending);
      
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
  }, [paginationModel, get, canRead]);

  // Load data when component mounts or pagination changes
  React.useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Action handlers
  const handleView = React.useCallback((requestData) => {
    if (!canRead) return;
    
    setSelectedRequest(requestData);
    setModalOpen(true);
  }, [canRead]);

  const handleViewDetails = React.useCallback((requestData) => {
    setSelectedDetailedRequest(requestData);
    setDetailedViewModalOpen(true);
  }, []);

  const handleEdit = React.useCallback((requestData) => {
    if (!canUpdate) return;
    
    setEditingRequest(requestData);
    
    // Process request items to calculate price_per_sqft from existing data
    const processedItems = (requestData.requestItems || []).map(item => {
      const widthFt = parseFloat(item.width) || 0;
      const heightFt = parseFloat(item.height) || 0;
      const areaSqft = widthFt * heightFt;
      const price = parseFloat(item.price) || 0;
      
      // Calculate price per sqft from existing data
      const price_per_sqft = areaSqft > 0 ? (price / areaSqft).toFixed(2) : '';
      
      return {
        id: item.id, // Include the item ID to preserve it
        request_type_id: item.request_type_id,
        width: item.width,
        height: item.height,
        price: item.price,
        price_per_sqft: price_per_sqft
      };
    });
    
    // Store the dealer_id - it could be the dealer's code from SAP B1
    // We'll use the dealer object's code if available, otherwise fall back to dealer_id
    const dealerIdToStore = requestData.dealer?.code || requestData.dealer_id;
    
    setEditFormData({
      dealer_id: dealerIdToStore,
      request_items: processedItems,
      warranty_status_id: requestData.warranty_status_id,
      reason_for_replacement: requestData.reason_for_replacement || '',
      last_installation_date: requestData.last_installation_date ? 
        (() => {
          const date = new Date(requestData.last_installation_date);
          return isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
        })() : '',
      total_cost: requestData.total_cost || '',
    });
    
    // Load existing files
    setExistingSitePhotos(requestData.site_photo_attachement || []);
    setExistingOldBoardPhotos(requestData.old_board_photo_attachment || []);
    
    // Clear new file selections
    setSitePhotos([]);
    setOldBoardPhotos([]);
    
    setEditModalOpen(true);
  }, [canUpdate]);

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

  const handleViewAndSendMessages = React.useCallback((requestData) => {
    if (!canAddComment) return;
    
    setRequestToAction(requestData);
    setMarketingCommentsDialogOpen(true);
    fetchMarketingComments(requestData.id);
  }, [canAddComment]);

  const handlePrint = React.useCallback((requestData) => {
    if (!canPrint) return;
    
    generatePDF(requestData);
  }, [canPrint]);

  const handleManualApproval = React.useCallback((requestData) => {
    if (!canManualApproval) return;
    
    setSelectedRequest(requestData);
    setManualApprovalModalOpen(true);
  }, [canManualApproval]);

  const handleApproveForPayment = React.useCallback((requestData) => {
    // For now, just show a message in tooltip - no actual functionality
    toast.success('Approved for payment!', {
      position: "top-right",
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
    });
  }, []);

  const handleViewInvoice = React.useCallback((requestData) => {
    if (!canRead) return;
    
    setSelectedInvoiceRequest(requestData);
    setInvoiceModalOpen(true);
  }, [canRead]);

  const handleManualApprovalSubmit = React.useCallback(async () => {
    if (!selectedRequest) return;
    
    setManualApprovalLoading(true);
    try {
      // Prepare the manual approval form data
      const manualApprovalForm = manualApprovalFile ? {
        filename: manualApprovalFile.name,
        size: manualApprovalFile.size,
        type: manualApprovalFile.type,
        uploadedAt: new Date().toISOString()
      } : null;

      // Call the manual approval API
      const response = await post(`/api/shopboard-requests/${selectedRequest.id}/approvals/manual-approve`, {
        request_id: selectedRequest.id,
        manual_approval_reason: manualApprovalReason,
        manual_approval_form: manualApprovalForm
      });

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
  }, [selectedRequest, manualApprovalReason, manualApprovalFile, post, loadRequests]);

  // Bulk send to CEO handler (no API yet)
  const handleBulkSendToCEO = React.useCallback(() => {
    if (!selectedRequests || selectedRequests.length === 0) return;
    console.log('Send to CEO for approval for selected requests:', selectedRequests);
    toast.info(`Send to CEO for ${selectedRequests.length} selected request(s)`, {
      position: "top-right",
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
    });
  }, [selectedRequests]);

  // Selection handlers with event propagation prevention
  const handleSelectRequest = React.useCallback((requestId, event) => {
    // Prevent event propagation to avoid triggering row click
    if (event) {
      event.stopPropagation();
    }
    
    setSelectedRequests(prev => {
      if (prev.includes(requestId)) {
        return prev.filter(id => id !== requestId);
      } else {
        return [...prev, requestId];
      }
    });
  }, []);

  const handleSelectAll = React.useCallback((event) => {
    // Prevent event propagation to avoid triggering row click
    if (event) {
      event.stopPropagation();
    }
    
    const ceoPendingRequests = rowsState.rows
      .filter(row => row.status === 'ceo_pending')
      .map(row => row.id);
    
    if (selectedRequests.length === ceoPendingRequests.length) {
      setSelectedRequests([]);
    } else {
      setSelectedRequests(ceoPendingRequests);
    }
  }, [rowsState.rows, selectedRequests.length]);

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
    
    setIsLoading(true);
    setRejectDialogOpen(false);
    
    try {
      const updateData = {
        status: 'review requested',
        updated_by: user.id
      };

      // Add comment if provided
      if (rejectionComment && rejectionComment.trim()) {
        updateData.comment = rejectionComment.trim();
        updateData.comment_type = 'areahead';
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

  // Confirm add comment function
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
        <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
          Main Request Changes:
        </Typography>
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
                  {value.map((file, i) => (
                    <Chip key={`${key}-${i}`} label={String(file).split('/').pop()} size="small" onClick={() => {
                      const p = String(file);
                      const url = p.startsWith('/') ? `${BASE_URL}${p}` : `${BASE_URL}/${p}`;
                      window.open(url, '_blank');
                    }} />
                  ))}
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
                  Total Cost: ${num.toFixed(2)}
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
                <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>Approvals:</Typography>
                {value.map((message, msgIndex) => {
                  // Check if it's "Approval needed from" message
                  if (message.includes('Approval needed from:')) {
                    const usernames = message.replace('Approval needed from: ', '').split(', ');
                    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
                    
                    return (
                      <Box key={`approval-${msgIndex}`} sx={{ mb: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5, color: '#1976d2' }}>
                          Approval sequence:
                        </Typography>
                        <Box sx={{ 
                          display: 'flex', 
                          flexWrap: 'wrap', 
                          gap: 1, 
                          alignItems: 'center',
                          p: 1,
                          backgroundColor: '#f0f7ff',
                          borderRadius: 1,
                          border: '1px solid #d0e6ff'
                        }}>
                          {usernames.map((username, userIndex) => (
                            <Box key={userIndex} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Typography variant="body2" sx={{ fontSize: '1.1rem' }}>
                                {emojis[userIndex] || `${userIndex + 1}.`}
                              </Typography>
                              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
                                {username.trim()}
                              </Typography>
                              {userIndex < usernames.length - 1 && (
                                <Typography variant="body2" sx={{ color: '#666', mx: 0.5 }}>
                                  →
                                </Typography>
                              )}
                            </Box>
                          ))}
                        </Box>
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
  const shouldShowField = (log, prevLog, key) => {
    if (!log || !log.main_changes) return false;
    if (log.action !== 'CURRENT' || !prevLog || !prevLog.main_changes) return true;
    return !valuesEqual(log.main_changes[key], prevLog.main_changes[key]);
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
    
    setIsLoading(true);
    setEditModalOpen(false);
    
    try {
      // Create FormData for file uploads
      const formData = new FormData();
      
      // Add form data
      formData.append('dealer_id', editFormData.dealer_id);
      formData.append('request_items', JSON.stringify(editFormData.request_items || []));
      formData.append('warranty_status_id', editFormData.warranty_status_id);
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

      // Send existing files that weren't deleted (so backend knows what to keep)
      formData.append('existing_site_photos', JSON.stringify(existingSitePhotos));
      formData.append('existing_old_board_photos', JSON.stringify(existingOldBoardPhotos));

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
                <div class="field">
                    <div class="field-label">Survey Date:</div>
                    <div class="field-value" id="survey-date">-</div>
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

            // Populate vendor information
            document.getElementById('assigned-vendor').textContent = cleanText(data.vendor?.name || data.vendorName || 'Not assigned');
            
            const surveyDate = data.survey_date || data.surveyDate;
            document.getElementById('survey-date').textContent = formatDate(surveyDate) || new Date().toLocaleDateString('en-GB');

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
  const getRequestFields = () => [
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
      name: 'survey_date',
      label: 'Survey Date',
      type: 'text',
      readOnly: true,
      valueFormatter: () => {
        const today = new Date();
        return today.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
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
    },
  ];

  // Column definitions for shopboard requests (showing only 4 key fields)
  const columns = React.useMemo(
    () => {
      const baseColumns = [
        // Selection column - only show if user has permission AND there are ceo_pending requests
        ...(canManualApproval && showSelectionColumn ? [{
          field: 'select',
          headerName: 'Select',
          width: 80,
          sortable: false,
          filterable: false,
          disableColumnMenu: true,
          renderHeader: () => (
            <Checkbox
              checked={selectedRequests.length > 0 && selectedRequests.length === rowsState.rows.filter(row => row.status === 'ceo_pending').length}
              indeterminate={selectedRequests.length > 0 && selectedRequests.length < rowsState.rows.filter(row => row.status === 'ceo_pending').length}
              onChange={handleSelectAll}
              color="primary"
              onClick={(e) => e.stopPropagation()}
            />
          ),
          renderCell: (params) => {
            const isCeoPending = params.row.status === 'ceo_pending';
            const isSelected = selectedRequests.includes(params.row.id);
            
            return (
              <Checkbox
                checked={isSelected}
                onChange={(e) => handleSelectRequest(params.row.id, e)}
                disabled={!isCeoPending}
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
      },
      {
        field: 'dealer_name',
        headerName: 'Dealer Name',
        width: 200,
        renderCell: (params) => {
          const dealer = params.row.dealer;
          return dealer ? dealer.name : 'N/A';
        },
      },
      {
        field: 'dealer_code',
        headerName: 'Dealer Code',
        width: 150,
        renderCell: (params) => {
          const dealer = params.row.dealer;
          return dealer ? dealer.code : 'N/A';
        },
      },
      {
        field: 'status',
        headerName: 'Status',
        width: 120,
        renderCell: (params) => {
          const status = params.value;
          let displayStatus = status || 'Not Decided';
          
          // Display "quotation sent" as "quotation received" on Area Head page
          if (status === 'quotation sent') {
            displayStatus = 'quotation received';
          }
          
          // Display "invoice_sent" as "Invoice Received" on Area Head page
          if (status === 'invoice_sent') {
            displayStatus = 'Invoice Received';
          }
          
          const getStatusColor = (status) => {
            switch (status) {
              case 'processing': return 'success';
              case 'review requested': return 'error';
              case 'rfq not accepted': return 'error';
              case 'Rfq': return 'info';
              case 'quotation sent': return 'secondary';
              case 'invoice_sent': return 'primary';
              case 'payment_released': return 'success';
              case 'not decided': return 'warning';
              case null:
              case undefined:
              case '': return 'warning';
              default: return 'default';
            }
          };
          return (
            <Chip 
              label={displayStatus} 
              variant="filled" 
              size="small"
              color={getStatusColor(status)}
            />
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
        width: 200,
        getActions: (params) => {
          const row = params.row;
          const isNotDecided = row.status === 'not decided' || row.status === 'rfq not accepted' || row.status === null || row.status === undefined || row.status === '';
          const isProcessing = row.status === 'processing';
          const isReviewRequested = row.status === 'review requested';
          const isRfqStatus = row.status === 'Rfq';
          const isRfqNotAccepted = row.status === 'rfq not accepted';
          const isQuotationReceived = row.status === 'quotation sent';
          
          const actions = [];
          
          // Always show request view action with tooltip
          actions.push(
            <GridActionsCellItem
              key="view"
              icon={<Tooltip title="Request"><RequestIcon /></Tooltip>}
              label="Request"
              onClick={() => handleView(row)}
              color="primary"
            />
          );
          
          // Show detailed view for all statuses except "not decided" and "Rfq"
          if (row.status !== 'not decided' && row.status !== 'Rfq' && row.status !== null && row.status !== undefined && row.status !== '') {
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
          
          // Show combined view & send messages for ceo_pending status with add_comment permission
          if (row.status === 'ceo_pending' && canAddComment) {
            actions.push(
              <GridActionsCellItem
                key="viewAndSendMessages"
                icon={<Tooltip title="View & Send Messages"><CommentIcon /></Tooltip>}
                label="View & Send Messages"
                onClick={() => handleViewAndSendMessages(row)}
                color="info"
              />
            );
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

          // Show approve for payment button for invoice_sent status
          if (row.status === 'invoice_sent') {
            actions.push(
              <GridActionsCellItem
                key="approveForPayment"
                icon={<Tooltip title="Approve for payment"><PaymentIcon /></Tooltip>}
                label="Approve for Payment"
                onClick={() => handleApproveForPayment(row)}
                color="success"
              />
            );
          }

          // Show invoice viewer if invoice data exists
          if (canRead && row.invoice) {
            try {
              const invoiceData = typeof row.invoice === 'string' ? JSON.parse(row.invoice) : row.invoice;
              const hasInvoiceData = invoiceData && (
                (invoiceData.invoice_files && invoiceData.invoice_files.length > 0) ||
                (invoiceData.dealer_acknowledgment_files && invoiceData.dealer_acknowledgment_files.length > 0) ||
                (invoiceData.site_photos && invoiceData.site_photos.length > 0)
              );
              
              if (hasInvoiceData) {
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
            } catch (error) {
              console.error('Error parsing invoice data:', error);
            }
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
    [canApprove, canReject, canAssign, canUpdate, canRead, canAddComment, canPrint, canManualApproval, showSelectionColumn, selectedRequests, rowsState.rows, handleView, handleViewDetails, handleEdit, handleApprove, handleReject, handleAssign, handleReviewAgain, handleViewComments, handleSendToCEO, handleViewHistory, handleAddComment, handleViewMarketingComments, handleViewAndSendMessages, handlePrint, handleManualApproval, handleApproveForPayment, handleViewInvoice, handleSelectAll, handleSelectRequest],
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

      {/* Top toolbar actions (above table) */}
      {canManualApproval && showSelectionColumn && selectedRequests.length > 0 && (
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-start' }}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleBulkSendToCEO}
            sx={{ fontWeight: 'bold', textTransform: 'none' }}
          >
            Send to CEO for Approval
          </Button>
        </Box>
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
        onView={null} // Disable default view action
        onEdit={null} // Disable default edit action
        onDelete={null} // Disable default delete action
        onRefresh={canRead ? handleRefresh : null}
        
        // Row interaction
        onRowClick={canRead ? handleRowClick : null}
        
        // Configuration
        pageSizeOptions={[5, 10, 25, 50]}
        showToolbar={true}
        hideCreateButton={true} // Hide create button for this view
      />

      {/* View Request Details Modal */}
      <DynamicModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        mode="view"
        title="Request Details"
        initialData={selectedRequest || {}}
        fields={getRequestFields()}
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
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {selectedRequest.survey_form_attachments.map((file, index) => (
                  <Box 
                    key={index}
                    sx={{
                      p: 2,
                      border: '1px solid #e0e0e0',
                      borderRadius: 1,
                      backgroundColor: '#f9f9f9',
                      '&:hover': {
                        backgroundColor: '#f0f0f0',
                      }
                    }}
                  >
                    <a 
                      href={file.startsWith('/uploads/') ? `${BASE_URL}${file}` : `${BASE_URL}/uploads/survey_forms/${file}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ 
                        color: '#1976d2', 
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontWeight: '500'
                      }}
                    >
                      <span style={{ fontSize: '18px' }}>📎</span>
                      <span>{file}</span>
                    </a>
                  </Box>
                ))}
              </Box>
            </Box>
          ) : null
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
          Request Review
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#333', mb: 2 }}>
            Are you sure you want to reject request <strong>#{requestToAction?.id}</strong>?
          </Typography>
          <Typography variant="body2" sx={{ color: '#666', mb: 2 }}>
            This action will mark the request as review requested.
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
            {isLoading ? 'Rejecting...' : 'Request Review'}
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
                {editFormData.request_items?.map((item, index) => (
                  <Paper key={index} variant="outlined" sx={{ p: 2, mb: 1.5, borderRadius: 2, backgroundColor: '#fafafa' }}>
                    <Autocomplete
                      options={requestTypes}
                      getOptionLabel={(option) => option.name || ''}
                      value={requestTypes.find(rt => rt.id === item.request_type_id) || null}
                      onChange={(event, newValue) => {
                        const newItems = [...editFormData.request_items];
                        newItems[index] = { ...newItems[index], request_type_id: newValue?.id || '' };
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
                      disabled={isLoading}
                      sx={{ mb: 1.5 }}
                    />
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      <TextField
                        label="Width (ft)"
                        type="number"
                        value={item.width || ''}
                        onChange={(e) => {
                          const newItems = [...editFormData.request_items];
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
                        disabled={isLoading}
                        sx={{ flex: 1, minWidth: 140 }}
                        inputProps={{ step: '0.01', min: '0' }}
                      />
                      <TextField
                        label="Height (ft)"
                        type="number"
                        value={item.height || ''}
                        onChange={(e) => {
                          const newItems = [...editFormData.request_items];
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
                        disabled={isLoading}
                        sx={{ flex: 1, minWidth: 140 }}
                        inputProps={{ step: '0.01', min: '0' }}
                      />
                      <TextField
                        label="Area (ft²)"
                        type="number"
                        value={(() => {
                          const widthFt = parseFloat(item.width) || 0;
                          const heightFt = parseFloat(item.height) || 0;
                          const areaSqft = widthFt * heightFt;
                          return areaSqft > 0 ? areaSqft.toFixed(2) : '';
                        })()}
                        variant="outlined"
                        disabled
                        sx={{ flex: 1, minWidth: 160 }}
                        helperText="Auto"
                      />
                      <TextField
                        label="Price per ft²"
                        type="number"
                        value={item.price_per_sqft || ''}
                        onChange={(e) => {
                          const newItems = [...editFormData.request_items];
                          newItems[index] = { ...newItems[index], price_per_sqft: e.target.value };
                          const widthFt = parseFloat(newItems[index].width) || 0;
                          const heightFt = parseFloat(newItems[index].height) || 0;
                          const areaSqft = widthFt * heightFt;
                          const pricePerSqft = parseFloat(e.target.value) || 0;
                          const total = areaSqft * pricePerSqft;
                          newItems[index].price = isNaN(total) ? '' : Number(total.toFixed(2));
                          handleEditFormChange('request_items', newItems);
                        }}
                        variant="outlined"
                        disabled={isLoading}
                        sx={{ flex: 1, minWidth: 180 }}
                        inputProps={{ step: '0.01', min: '0' }}
                        InputProps={{ startAdornment: <InputAdornment position="start">₨</InputAdornment> }}
                        helperText="per square foot"
                      />
                      <TextField
                        label="Total Cost"
                        type="number"
                        value={(() => {
                          const widthFt = parseFloat(item.width) || 0;
                          const heightFt = parseFloat(item.height) || 0;
                          const areaSqft = widthFt * heightFt;
                          const pricePerSqft = parseFloat(item.price_per_sqft) || 0;
                          const total = areaSqft * pricePerSqft;
                          return total > 0 ? total.toFixed(2) : '';
                        })()}
                        variant="outlined"
                        disabled
                        sx={{ minWidth: 180 }}
                        InputProps={{ startAdornment: <InputAdornment position="start">₨</InputAdornment> }}
                        helperText="Area × price"
                      />
                      <IconButton
                        onClick={() => {
                          const newItems = editFormData.request_items.filter((_, i) => i !== index);
                          handleEditFormChange('request_items', newItems);
                        }}
                        color="error"
                        disabled={isLoading || editFormData.request_items.length <= 1}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </Paper>
                ))}
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      const newItems = [...(editFormData.request_items || []), { request_type_id: '', width: '', height: '', price: '', price_per_sqft: '' }];
                      handleEditFormChange('request_items', newItems);
                    }}
                    disabled={isLoading}
                    startIcon={<AddIcon />}
                  >
                    Add Request Type
                  </Button>
                </Box>
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
                disabled={isLoading}
              />

              {/* Total Cost - Auto Calculated */}
              <TextField
                label="Total Cost (Auto Calculated)"
                type="number"
                value={(() => {
                  if (!editFormData.request_items || !Array.isArray(editFormData.request_items)) return '0.00';
                  const total = editFormData.request_items.reduce((sum, item) => {
                    const price = parseFloat(item.price) || 0;
                    return sum + price;
                  }, 0);
                  return total.toFixed(2);
                })()}
                variant="outlined"
                fullWidth
                disabled={true}
                helperText="Automatically calculated from request item prices"
                sx={{
                  '& .MuiInputBase-input': {
                    color: '#1976d2',
                    fontWeight: 'bold'
                  }
                }}
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
                  onChange={(e) => setSitePhotos(Array.from(e.target.files))}
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
                    {existingSitePhotos.map((file, index) => (
                      <Chip
                        key={`existing-${index}`}
                        label={file.split('/').pop()}
                        size="small"
                        color="primary"
                        variant="outlined"
                        onClick={() => {
                          const fileUrl = file.startsWith('/uploads/') ? `${BASE_URL}${file}` : `${BASE_URL}/uploads/site_photos/${file}`;
                          window.open(fileUrl, '_blank');
                        }}
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
                    ))}
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
                  onChange={(e) => setOldBoardPhotos(Array.from(e.target.files))}
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
                    {existingOldBoardPhotos.map((file, index) => (
                      <Chip
                        key={`existing-old-${index}`}
                        label={file.split('/').pop()}
                        size="small"
                        color="primary"
                        variant="outlined"
                        onClick={() => {
                          const fileUrl = file.startsWith('/uploads/') ? `${BASE_URL}${file}` : `${BASE_URL}/uploads/old_board_photos/${file}`;
                          window.open(fileUrl, '_blank');
                        }}
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
                    ))}
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
                      {log.changed_by ? log.changed_by.username : 'Unknown User'}
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
                          Request Item Changes:
                        </Typography>
                        {log.item_changes.map((item, index) => (
                          <Box key={index} sx={{ mb: 1, p: 1, backgroundColor: '#ffffff', borderRadius: 0.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                              {item.action}: {item.request_type}
                            </Typography>
                            {item.width && (
                              <Typography variant="body2" sx={{ color: '#333', mb: 0.5 }}>
                                Width: {item.width} ft
                              </Typography>
                            )}
                            {item.height && (
                              <Typography variant="body2" sx={{ color: '#333', mb: 0.5 }}>
                                Height: {item.height} ft
                              </Typography>
                            )}
                            {item.price && (
                              <Typography variant="body2" sx={{ color: '#333', mb: 0.5 }}>
                                Price: ${parseFloat(item.price).toFixed(2)}
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

      {/* Add Comment Dialog */}
      <Dialog
        open={addCommentDialogOpen}
        onClose={cancelAddComment}
        aria-labelledby="add-comment-dialog-title"
        PaperProps={{
          sx: {
            backgroundColor: '#ffffff',
            minWidth: '500px',
            maxWidth: '700px',
          }
        }}
      >
        <DialogTitle 
          id="add-comment-dialog-title"
          sx={{ 
            color: 'secondary.main',
            fontWeight: 'bold',
          }}
        >
          Add Comment - Request #{requestToAction?.id}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#333', mb: 2 }}>
            Add a comment for request <strong>#{requestToAction?.id}</strong>:
          </Typography>
          
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Comment"
            placeholder="Enter your comment here..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            variant="outlined"
            disabled={isLoading}
            sx={{ mt: 2 }}
            helperText="This comment will be associated with the request"
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button 
            onClick={cancelAddComment}
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
            onClick={confirmAddComment}
            variant="contained"
            color="secondary"
            disabled={isLoading || !newComment.trim()}
            sx={{
              minWidth: '120px'
            }}
          >
            {isLoading ? 'Adding...' : 'Add Comment'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Marketing Comments Dialog */}
      <Dialog
        open={marketingCommentsDialogOpen}
        onClose={cancelMarketingComments}
        aria-labelledby="marketing-comments-dialog-title"
        PaperProps={{
          sx: {
            backgroundColor: '#ffffff',
            minWidth: '700px',
            maxWidth: '900px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
          }
        }}
      >
        <DialogTitle 
          id="marketing-comments-dialog-title"
          sx={{ 
            color: 'info.main',
            fontWeight: 'bold',
          }}
        >
          View & Send Messages - Request #{requestToAction?.id}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {/* Messages Section */}
          <Box sx={{ flex: 1, overflow: 'auto', mb: 2 }}>
            {loadingMarketingComments ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <Typography>Loading messages...</Typography>
              </Box>
            ) : marketingComments.length === 0 ? (
              <Box sx={{ textAlign: 'center', p: 4 }}>
                <Typography variant="body1" sx={{ color: '#666' }}>
                  No messages found for this request.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {marketingComments.map((comment, index) => (
                  <Box 
                    key={index} 
                    sx={{ 
                      p: 2, 
                      border: '1px solid #e0e0e0', 
                      borderRadius: 2, 
                      backgroundColor: '#f9f9f9',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
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
                      label={comment.comment_type || 'Unknown'} 
                      size="small" 
                      color={
                        comment.comment_type === 'Area Head' ? 'primary' : 
                        comment.comment_type === 'Vendor Manager' ? 'secondary' : 
                        comment.comment_type === 'Auditor' ? 'warning' : 
                        comment.comment_type === 'Super Admin' ? 'error' :
                        comment.comment_type === 'CEO' ? 'success' :
                        'info'
                      } 
                      variant="outlined"
                    />
                  </Box>
                ))}
              </Box>
            )}
          </Box>
          
          {/* Send Message Section - Always Visible */}
          {canAddComment && (
            <Box sx={{ 
              p: 3, 
              border: '2px solid #e3f2fd', 
              borderRadius: 2, 
              backgroundColor: '#f8f9ff',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              flexShrink: 0
            }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: 'info.main' }}>
                💬 Send New Message
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Your Message"
                placeholder="Type your message here..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                variant="outlined"
                disabled={isLoading}
                sx={{ 
                  mb: 2,
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#ffffff',
                    borderRadius: 2
                  }
                }}
                helperText="This message will be sent to the conversation"
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                <Button 
                  onClick={() => setNewComment('')}
                  variant="outlined"
                  disabled={isLoading || !newComment.trim()}
                  sx={{ borderRadius: 2 }}
                >
                  Clear
                </Button>
                <Button 
                  onClick={confirmAddComment}
                  variant="contained"
                  color="info"
                  disabled={isLoading || !newComment.trim()}
                  sx={{ 
                    borderRadius: 2,
                    px: 3,
                    fontWeight: 'bold'
                  }}
                >
                  {isLoading ? 'Sending...' : '📤 Send Message'}
                </Button>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 2, backgroundColor: '#f8f9fa', borderTop: '1px solid #e0e0e0' }}>
          <Button 
            onClick={cancelMarketingComments}
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
                              Price per ft²
                            </Typography>
                            <Typography variant="body2">
                              {item.price_per_sqft ? `₨${parseFloat(item.price_per_sqft).toFixed(2)}` : 'N/A'}
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
                      {selectedDetailedRequest.site_photo_attachement.map((file, index) => (
                        <Chip
                          key={`site-${index}`}
                          label={file.split('/').pop()}
                          size="small"
                          color="primary"
                          variant="outlined"
                          onClick={() => {
                            const fileUrl = file.startsWith('/uploads/') ? `${BASE_URL}${file}` : `${BASE_URL}/uploads/site_photos/${file}`;
                            window.open(fileUrl, '_blank');
                          }}
                          sx={{ 
                            cursor: 'pointer',
                            '&:hover': {
                              backgroundColor: '#e3f2fd',
                              transform: 'scale(1.05)'
                            }
                          }}
                        />
                      ))}
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
                      {selectedDetailedRequest.old_board_photo_attachment.map((file, index) => (
                        <Chip
                          key={`old-${index}`}
                          label={file.split('/').pop()}
                          size="small"
                          color="secondary"
                          variant="outlined"
                          onClick={() => {
                            const fileUrl = file.startsWith('/uploads/') ? `${BASE_URL}${file}` : `${BASE_URL}/uploads/old_board_photos/${file}`;
                            window.open(fileUrl, '_blank');
                          }}
                          sx={{ 
                            cursor: 'pointer',
                            '&:hover': {
                              backgroundColor: '#f3e5f5',
                              transform: 'scale(1.05)'
                            }
                          }}
                        />
                      ))}
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
                      {selectedDetailedRequest.survey_form_attachments.map((file, index) => (
                        <Chip
                          key={`survey-${index}`}
                          label={file.split('/').pop()}
                          size="small"
                          color="success"
                          variant="outlined"
                          onClick={() => {
                            const fileUrl = file.startsWith('/uploads/') ? `${BASE_URL}${file}` : `${BASE_URL}/uploads/survey_forms/${file}`;
                            window.open(fileUrl, '_blank');
                          }}
                          sx={{ 
                            cursor: 'pointer',
                            '&:hover': {
                              backgroundColor: '#e8f5e8',
                              transform: 'scale(1.05)'
                            }
                          }}
                        />
                      ))}
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
            label="Reason for Manual Approval (Optional)"
            value={manualApprovalReason}
            onChange={(e) => setManualApprovalReason(e.target.value)}
            placeholder="Enter the reason for manual approval..."
            sx={{ mb: 3 }}
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
            disabled={manualApprovalLoading}
            sx={{
              minWidth: '120px',
              fontWeight: 'bold'
            }}
          >
            {manualApprovalLoading ? 'Approving...' : 'Approve'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Invoice Viewer Modal */}
      <InvoiceViewer
        open={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        invoiceData={selectedInvoiceRequest?.invoice}
        requestId={selectedInvoiceRequest?.id}
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
