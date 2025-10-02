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
} from '@mui/icons-material';
import { GridActionsCellItem } from '@mui/x-data-grid';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from '../auth/AuthContext';
import ReusableDataTable from '../components/ReusableData';
import PageContainer from '../components/PageContainer';
import DynamicModal from '../components/DynamicModel';
import { BASE_URL } from "../constants/Constants";
import { useApi } from '../hooks/useApi';

const INITIAL_PAGE_SIZE = 10;

export default function VendorRequests() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const { user, hasPermission, token } = useAuth();
  
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
  
  // Modal state for viewing request details
  const [modalOpen, setModalOpen] = React.useState(false);
  const [selectedRequest, setSelectedRequest] = React.useState(null);
  
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

  // Load dropdown data for edit form
  const loadDropdownData = React.useCallback(async () => {
    setLoadingDropdowns(true);
    try {
      const [dealersRes, requestTypesRes, warrantyStatusesRes] = await Promise.all([
        get('/api/dealers'),
        get('/api/request-types'),
        get('/api/warranty-statuses')
      ]);

      if (dealersRes.success) setDealers(dealersRes.data);
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
    if (editModalOpen) {
      loadDropdownData();
    }
  }, [editModalOpen, loadDropdownData]);

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
  const loadRequests = React.useCallback(async () => {
    if (!canRead) return;
    
    setError(null);
    setIsLoading(true);

    try {
      const { page, pageSize } = paginationModel;
      
      const apiUrl = `/api/shopboard-requests/vendor?page=${page}&size=${pageSize}`;
      
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
    
    setEditFormData({
      dealer_id: requestData.dealer_id,
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
        setRequestHistory(sorted);
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
        status: 'quotation sent',
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

  // Confirm reject function
  const confirmReject = async () => {
    if (!requestToAction) return;
    
    setIsLoading(true);
    setRejectDialogOpen(false);
    
    try {
      const updateData = {
        status: 'rfq not accepted',
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
    const d = dealers.find(x => x.id === dealerId);
    return d?.name || null;
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
        <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
          Main Request Changes:
        </Typography>
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

          // Special mappings
          if (key === 'vendor_id') {
            return (
              <Typography key={`${key}-${idx}`} variant="body2" sx={{ color: '#333', mb: 0.5 }}>
                Vendor: {resolveVendorName(value) || value}
              </Typography>
            );
          }
          if (key === 'dealer_id') {
            return (
              <Typography key={`${key}-${idx}`} variant="body2" sx={{ color: '#333', mb: 0.5 }}>
                Dealer: {resolveDealerName(value) || value}
              </Typography>
            );
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

      // Send existing files that weren't deleted (so backend knows what to keep)
      formData.append('existing_site_photos', JSON.stringify(existingSitePhotos));
      formData.append('existing_old_board_photos', JSON.stringify(existingOldBoardPhotos));

      // Add new uploaded files to FormData
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
          const displayStatus = status || 'Not Decided';
          const getStatusColor = (status) => {
            switch (status) {
              case 'processing': return 'success';
              case 'review requested': return 'error';
              case 'rfq not accepted': return 'error';
              case 'Rfq': return 'info';
              case 'quotation sent': return 'secondary';
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
      {
        field: 'actions',
        type: 'actions',
        headerName: 'Actions',
        width: 200,
        getActions: (params) => {
          const row = params.row;
          const isRfqStatus = row.status === 'Rfq';
          
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
          
          // Show edit action for Rfq status
          if (canUpdate && isRfqStatus) {
            actions.push(
              <GridActionsCellItem
                key="edit"
                icon={<Tooltip title="Edit"><EditIcon /></Tooltip>}
                label="Add Pricing"
                onClick={() => handleEdit(row)}
                color="info"
              />
            );
          }
          
          // Show view comments for Rfq status
          if (isRfqStatus && canRead) {
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
          
          // Show approve/reject only for Rfq status
          if (isRfqStatus) {
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
          
          return actions;
        },
      },
    ],
    [canApprove, canReject, canUpdate, canRead, handleView, handleEdit, handleApprove, handleReject, handleViewComments, handleViewHistory],
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
          Request Details #{selectedRequest?.id}
        </DialogTitle>
        <DialogContent>
          {selectedRequest && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
              {/* Dealer Information */}
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

              {/* Files (match Area Head view modal): Survey Form Attachments */}

              {/* Survey Form Attachments */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  Survey Form Attachments
                </Typography>
                {selectedRequest.survey_form_attachments && 
                 Array.isArray(selectedRequest.survey_form_attachments) && 
                 selectedRequest.survey_form_attachments.length > 0 ? (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {selectedRequest.survey_form_attachments.map((file, index) => (
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
                            backgroundColor: '#e3f2fd',
                            transform: 'scale(1.05)'
                          }
                        }}
                      />
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" sx={{ color: '#666', fontStyle: 'italic' }}>
                    No survey form attachments available
                  </Typography>
                )}
              </Box>
            </Box>
          )}
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
          Submit Quotation
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#333', mb: 2 }}>
            Are you sure you want to submit quotation for request <strong>#{requestToAction?.id}</strong>?
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
                  value={dealers.find(d => d.id === editFormData.dealer_id) || null}
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
                      sx={{ mr: 1.5, minWidth: 140 }}
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
                      sx={{ mr: 1.5, minWidth: 140 }}
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
                      sx={{ mr: 1.5, minWidth: 160 }}
                      helperText="Auto"
                    />
                    <TextField
                      label="Price per ft² *"
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
                      sx={{ mr: 1.5, minWidth: 180 }}
                      inputProps={{
                        step: "0.01",
                        min: "0"
                      }}
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
                  </Paper>
                ))}
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
                disabled={isLoading}
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
            disabled={isLoading}
            sx={{
              minWidth: '120px'
            }}
          >
            {isLoading ? 'Updating...' : 'Update Pricing'}
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
                No history found for this request.
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
