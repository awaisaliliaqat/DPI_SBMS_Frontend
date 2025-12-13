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

const PaymentSummaryModal = ({
  open,
  onClose,
  paymentSummaryData,
  onProcessPayment,
  isLoading = false,
}) => {
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
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          onClick={onProcessPayment}
          variant="contained"
          color="success"
          disabled={isLoading}
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

