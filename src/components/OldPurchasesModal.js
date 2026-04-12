import * as React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  Divider,
  Grid,
} from '@mui/material';
import {
  History as HistoryIcon,
  Store as DealerIcon,
  Business as VendorIcon,
  CalendarToday as DateIcon,
  Description as RequestIcon,
} from '@mui/icons-material';
import { useApi } from '../hooks/useApi';

export default function OldPurchasesModal({ open, onClose, dealerId, dealerName }) {
  const { get } = useApi();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [oldPurchases, setOldPurchases] = React.useState([]);

  // Fetch old purchases when modal opens
  React.useEffect(() => {
    if (open && dealerId) {
      fetchOldPurchases();
    } else {
      setOldPurchases([]);
      setError(null);
    }
  }, [open, dealerId]);

  const fetchOldPurchases = React.useCallback(async () => {
    if (!dealerId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await get(`/api/shopboard-requests/dealer/${dealerId}/old-purchases`);
      
      if (response.success && Array.isArray(response.data)) {
        setOldPurchases(response.data);
      } else {
        throw new Error(response.message || 'Failed to load old purchases');
      }
    } catch (err) {
      console.error('Error fetching old purchases:', err);
      setError(err.message || 'Failed to load old purchases');
      setOldPurchases([]);
    } finally {
      setLoading(false);
    }
  }, [dealerId, get]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      return 'N/A';
    }
  };

  const formatCurrency = (amount) => {
    if (!amount) return 'Rs 0.00';
    const num = parseFloat(amount);
    return isNaN(num) ? 'Rs 0.00' : `Rs ${num.toFixed(2).toLocaleString('en-US')}`;
  };

  // Calculate total of all purchases
  const totalPurchases = oldPurchases.reduce((sum, purchase) => {
    const cost = parseFloat(purchase.total_cost) || 0;
    return sum + cost;
  }, 0);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="old-purchases-dialog-title"
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: '#ffffff',
          minHeight: '500px',
          maxHeight: '90vh',
        }
      }}
    >
      <DialogTitle 
        id="old-purchases-dialog-title"
        sx={{ 
          backgroundColor: '#1a237e',
          color: '#ffffff',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          py: 2.5,
        }}
      >
        <HistoryIcon sx={{ fontSize: '1.8rem' }} />
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 0.5 }}>
            Old Purchases History
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9, fontSize: '0.9rem' }}>
            {dealerName || 'Dealer'} - Payment Successful Requests
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 3, pt: 4, overflow: 'auto', maxHeight: 'calc(90vh - 140px)' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
            <CircularProgress size={60} />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : oldPurchases.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <HistoryIcon sx={{ fontSize: '4rem', color: '#ccc', mb: 2 }} />
            <Typography variant="h6" sx={{ color: '#666', mb: 1 }}>
              No Old Purchases Found
            </Typography>
            <Typography variant="body2" sx={{ color: '#999' }}>
              This dealer has no payment successful requests yet.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
            {/* Summary Card */}
            <Paper 
              elevation={3}
              sx={{ 
                p: 3, 
                backgroundColor: '#e3f2fd',
                border: '2px solid #1976d2',
                borderRadius: 2,
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1976d2', mb: 0.5 }}>
                    Total Purchases
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#666' }}>
                    {oldPurchases.length} request{oldPurchases.length !== 1 ? 's' : ''} completed
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
                    {formatCurrency(totalPurchases)}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#666' }}>
                    Total Amount
                  </Typography>
                </Box>
              </Box>
            </Paper>

            {/* Purchase List */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              {oldPurchases.map((purchase, index) => (
                <Paper 
                  key={purchase.id} 
                  elevation={2}
                  sx={{ 
                    p: 3, 
                    borderRadius: 2,
                    border: '1px solid #e0e0e0',
                    backgroundColor: '#fafafa',
                    '&:hover': {
                      boxShadow: 4,
                      borderColor: '#1976d2',
                    },
                    transition: 'all 0.3s ease',
                  }}
                >
                  {/* Header */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, flexWrap: 'wrap', gap: 2 }}>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1976d2', mb: 0.5 }}>
                        Request #{purchase.id}
                      </Typography>
                      <Chip 
                        label="Payment Successful" 
                        color="success" 
                        size="small"
                        sx={{ fontWeight: 'bold' }}
                      />
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#2e7d32', mb: 0.5 }}>
                        {formatCurrency(purchase.total_cost)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#666' }}>
                        Total Cost
                      </Typography>
                    </Box>
                  </Box>

                  <Divider sx={{ mb: 2 }} />

                  {/* Details Grid */}
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    {/* Dealer Info */}
                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <DealerIcon sx={{ color: '#1976d2', fontSize: '1.2rem' }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666' }}>
                          Dealer
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ color: '#333', fontWeight: 500 }}>
                        {purchase.dealer?.name || 'N/A'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#666' }}>
                        Code: {purchase.dealer?.code || 'N/A'}
                      </Typography>
                    </Grid>

                    {/* Vendor Info */}
                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <VendorIcon sx={{ color: '#1976d2', fontSize: '1.2rem' }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666' }}>
                          Vendor
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ color: '#333', fontWeight: 500 }}>
                        {purchase.vendor?.card_name || purchase.vendor_name || 'N/A'}
                      </Typography>
                      {purchase.vendor?.username && (
                        <Typography variant="caption" sx={{ color: '#666' }}>
                          Code: {purchase.vendor.username}
                        </Typography>
                      )}
                    </Grid>

                    {/* Approval Date */}
                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <DateIcon sx={{ color: '#1976d2', fontSize: '1.2rem' }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666' }}>
                          Approval Date
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ color: '#333', fontWeight: 500 }}>
                        {formatDate(purchase.approval_date)}
                      </Typography>
                    </Grid>

                    {/* Created Date */}
                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <DateIcon sx={{ color: '#1976d2', fontSize: '1.2rem' }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666' }}>
                          Created Date
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ color: '#333', fontWeight: 500 }}>
                        {formatDate(purchase.created_at)}
                      </Typography>
                    </Grid>
                  </Grid>

                  {/* Request Items */}
                  {purchase.requestItems && purchase.requestItems.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                        <RequestIcon sx={{ color: '#1976d2', fontSize: '1.2rem' }} />
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#333' }}>
                          Request Items ({purchase.requestItems.length})
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {purchase.requestItems.map((item, itemIndex) => (
                          <Paper 
                            key={item.id || itemIndex}
                            variant="outlined"
                            sx={{ 
                              p: 2, 
                              backgroundColor: '#ffffff',
                              borderRadius: 1,
                              border: '1px solid #e0e0e0',
                            }}
                          >
                            <Grid container spacing={2} alignItems="center">
                              <Grid item xs={12} sm={4}>
                                <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1976d2', mb: 0.5 }}>
                                  Request Type
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#333' }}>
                                  {item.requestType?.name || 'N/A'}
                                </Typography>
                              </Grid>
                              <Grid item xs={6} sm={2}>
                                <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                                  Width (ft)
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#333' }}>
                                  {item.width || 'N/A'}
                                </Typography>
                              </Grid>
                              <Grid item xs={6} sm={2}>
                                <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                                  Height (ft)
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#333' }}>
                                  {item.height || 'N/A'}
                                </Typography>
                              </Grid>
                              <Grid item xs={6} sm={2}>
                                <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                                  Price
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#2e7d32', fontWeight: 'bold' }}>
                                  {formatCurrency(item.price)}
                                </Typography>
                              </Grid>
                              <Grid item xs={6} sm={2}>
                                <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                                  Area (sqft)
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#333' }}>
                                  {(() => {
                                    const width = parseFloat(item.width) || 0;
                                    const height = parseFloat(item.height) || 0;
                                    const area = width * height;
                                    return area > 0 ? area.toFixed(2) : 'N/A';
                                  })()}
                                </Typography>
                              </Grid>
                            </Grid>
                          </Paper>
                        ))}
                      </Box>
                    </Box>
                  )}
                </Paper>
              ))}
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, backgroundColor: '#f5f5f5', borderTop: '1px solid #e0e0e0' }}>
        <Button 
          onClick={onClose}
          variant="contained"
          sx={{ 
            minWidth: '120px',
            fontWeight: 'bold',
            textTransform: 'none',
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

