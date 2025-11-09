import * as React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  TextField,
  Box,
} from '@mui/material';

const RejectInvoiceModal = ({ open, onClose, onReject, request, submitting: externalSubmitting }) => {
  const [comment, setComment] = React.useState('');
  const [internalSubmitting, setInternalSubmitting] = React.useState(false);

  const submitting = externalSubmitting !== undefined ? externalSubmitting : internalSubmitting;

  React.useEffect(() => {
    if (!open) {
      setComment('');
      setInternalSubmitting(false);
    }
  }, [open]);

  const handleReject = async () => {
    if (externalSubmitting === undefined) {
      setInternalSubmitting(true);
    }
    try {
      await onReject?.(comment.trim());
    } finally {
      if (externalSubmitting === undefined) {
        setInternalSubmitting(false);
      }
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="reject-invoice-dialog-title"
      PaperProps={{
        sx: {
          backgroundColor: '#ffffff',
          minWidth: '480px',
          maxWidth: '640px',
        }
      }}
    >
      <DialogTitle 
        id="reject-invoice-dialog-title"
        sx={{ 
          color: 'error.main',
          fontWeight: 'bold',
        }}
      >
        Reject Invoice
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ color: '#333', mb: 2 }}>
          Are you sure you want to reject invoice for request <strong>#{request?.id}</strong>?
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Comment (Optional)"
            placeholder="Provide a reason for invoice rejection..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            variant="outlined"
            helperText="Adding a comment helps provide context for the rejection"
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button 
          onClick={onClose}
          variant="outlined"
          sx={{ 
            color: '#666',
            borderColor: '#ddd',
            '&:hover': {
              borderColor: '#999',
              backgroundColor: '#f5f5f5',
            }
          }}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleReject}
          variant="contained"
          color="error"
          disabled={submitting}
          sx={{ minWidth: '140px' }}
        >
          {submitting ? 'Rejecting...' : 'Reject Invoice'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RejectInvoiceModal;


