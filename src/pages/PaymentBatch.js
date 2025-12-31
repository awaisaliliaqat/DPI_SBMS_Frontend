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
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { GridActionsCellItem } from '@mui/x-data-grid';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from '../auth/AuthContext';
import { useApi } from '../hooks/useApi';
import ReusableDataTable from '../components/ReusableData';
import PageContainer from '../components/PageContainer';

const INITIAL_PAGE_SIZE = 10;

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
    if (request.vendor && request.vendor.card_name) {
      return request.vendor.card_name;
    }
    if (request.vendor_name) {
      return request.vendor_name;
    }
    if (request.vendor_code) {
      return 'Not Assigned';
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
              color="success"
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
        width: 100,
        align: 'left',
        headerAlign: 'left',
        getActions: (params) => {
          const row = params.row;
          const actions = [];
          
          // View action only - no delete option as payment processing is irreversible
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
          
          return actions;
        },
      },
    ],
    [canRead, handleView],
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
            minWidth: '600px',
            maxWidth: '900px',
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
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {batchDetails.items && batchDetails.items.length > 0 ? (
                      batchDetails.items.map((item) => {
                        const request = item.request;
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
                              {request ? getVendorName(request) : 'N/A'}
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
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
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
        <DialogActions sx={{ padding: '16px 24px 20px 24px', gap: 1 }}>
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

