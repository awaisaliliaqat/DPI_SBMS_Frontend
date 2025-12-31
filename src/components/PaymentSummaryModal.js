import * as React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import { Download as DownloadIcon } from '@mui/icons-material';
import { useApi } from '../hooks/useApi';

const PaymentSummaryModal = ({
  open,
  onClose,
  paymentSummaryData,
  onProcessPayment,
  isLoading = false,
}) => {
  const [downloading, setDownloading] = React.useState(false);
  const { request } = useApi();

  const handleDownload = React.useCallback(async () => {
    if (!paymentSummaryData || !paymentSummaryData.requestIds || paymentSummaryData.requestIds.length === 0) {
      return;
    }

    setDownloading(true);
    try {
      // Use the apiService which handles authentication properly
      // Make sure to pass data correctly
      const response = await request('/api/shopboard-requests/generate-payment-summary-excel', {
        method: 'POST',
        data: {
          requestIds: paymentSummaryData.requestIds || []
        },
        responseType: 'blob', // Important: tell apiService to expect a blob response
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Create download link
      const url = window.URL.createObjectURL(response);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Payment_Summary_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating Excel:', error);
      alert(`Failed to generate Excel file: ${error.message}`);
    } finally {
      setDownloading(false);
    }
  }, [paymentSummaryData, request]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="payment-summary-dialog-title"
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
        id="payment-summary-dialog-title"
        sx={{ 
          color: 'success.main',
          fontWeight: 'bold',
          borderBottom: '1px solid #eaeaea',
          padding: '20px 24px 16px 24px'
        }}
      >
        Payment Summary
      </DialogTitle>
      
      <DialogContent sx={{ padding: '20px 24px' }}>
        {paymentSummaryData && (
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
                Rs {paymentSummaryData.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, color: '#666' }}>
                {paymentSummaryData.invoiceDetails.length} invoice(s) selected
              </Typography>
            </Box>

            {/* Individual Invoice Details */}
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#1a237e' }}>
              Individual Invoice Details
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
                  {paymentSummaryData.invoiceDetails.map((invoice) => (
                    <TableRow 
                      key={invoice.id}
                      sx={{ 
                        '&:hover': { backgroundColor: '#f5f5f5' }
                      }}
                    >
                      <TableCell>#{invoice.id}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {invoice.dealerName}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#666' }}>
                          {invoice.dealerCode}
                        </Typography>
                      </TableCell>
                      <TableCell>{invoice.vendorName}</TableCell>
                      <TableCell>
                        {invoice.invoiceNumber || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {invoice.invoiceDate 
                          ? new Date(invoice.invoiceDate).toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric' 
                            })
                          : 'N/A'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, color: '#2e7d32' }}>
                        Rs {invoice.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Box>
        )}
      </DialogContent>
      
      <DialogActions sx={{ padding: '16px 24px 20px 24px', gap: 1 }}>
        <Button
          onClick={onClose}
          variant="outlined"
          color="secondary"
          disabled={isLoading || downloading}
        >
          Cancel
        </Button>
        <Button
          onClick={handleDownload}
          variant="outlined"
          color="primary"
          disabled={isLoading || downloading}
          startIcon={<DownloadIcon />}
          sx={{
            minWidth: '140px',
          }}
        >
          {downloading ? 'Downloading...' : 'Download Excel'}
        </Button>
        <Button
          onClick={onProcessPayment}
          variant="contained"
          color="success"
          disabled={isLoading || downloading}
          sx={{
            minWidth: '140px',
            fontWeight: 'bold'
          }}
        >
          {isLoading ? 'Processing...' : 'Payment Sent'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PaymentSummaryModal;

