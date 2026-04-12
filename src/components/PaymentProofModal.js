import * as React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  IconButton,
  Chip,
} from '@mui/material';
import { Close, Add, AttachFile } from '@mui/icons-material';

const PaymentProofModal = ({ open, onClose, request, submitting = false }) => {
  const [selectedFiles, setSelectedFiles] = React.useState([]);

  React.useEffect(() => {
    if (!open) {
      setSelectedFiles([]);
    }
  }, [open]);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdate = () => {
    // Currently just close the modal - will be implemented in next prompt
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="payment-proof-dialog-title"
      PaperProps={{
        sx: {
          backgroundColor: '#ffffff',
          minWidth: '500px',
          maxWidth: '700px',
          borderRadius: 2,
          boxShadow: 6,
        }
      }}
    >
      <DialogTitle 
        id="payment-proof-dialog-title"
        sx={{ 
          color: 'success.main',
          fontWeight: 'bold',
          borderBottom: '1px solid #eaeaea',
          mb: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AttachFile />
          <Typography variant="h6">Add Payment Proof</Typography>
        </Box>
        <IconButton 
          onClick={onClose} 
          size="small"
          sx={{ 
            color: '#666',
            '&:hover': {
              backgroundColor: '#f5f5f5',
            }
          }}
        >
          <Close />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ padding: '20px 24px' }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Request ID: <strong>{request?.id}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Dealer: <strong>{request?.dealer?.name || request?.dealerName || 'N/A'}</strong>
          </Typography>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2 }}>
            Upload Payment Proof Documents
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Please upload payment proof documents (PDF, Images, etc.)
          </Typography>
          
          <input
            type="file"
            id="payment-proof-upload"
            multiple
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <label htmlFor="payment-proof-upload">
            <Button
              variant="outlined"
              component="span"
              startIcon={<Add />}
              disabled={submitting}
              sx={{ 
                border: '2px dashed #ccc',
                '&:hover': {
                  border: '2px dashed #1976d2',
                  backgroundColor: '#f5f5f5'
                }
              }}
              fullWidth
            >
              Select Payment Proof Files
            </Button>
          </label>
        </Box>

        {selectedFiles.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
              Selected Files ({selectedFiles.length}):
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {selectedFiles.map((file, index) => (
                <Chip
                  key={index}
                  label={file.name}
                  size="small"
                  onDelete={() => handleRemoveFile(index)}
                  color="primary"
                  variant="outlined"
                  sx={{ 
                    '&:hover': {
                      backgroundColor: '#e3f2fd',
                    }
                  }}
                />
              ))}
            </Box>
          </Box>
        )}
      </DialogContent>
      
      <DialogActions sx={{ padding: '16px 24px 20px 24px', gap: 1 }}>
        <Button
          onClick={onClose}
          variant="outlined"
          color="secondary"
          disabled={submitting}
          sx={{ 
            borderRadius: 2,
            px: 3,
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleUpdate}
          variant="contained"
          color="success"
          disabled={submitting || selectedFiles.length === 0}
          sx={{
            minWidth: '120px',
            fontWeight: 'bold',
            borderRadius: 2,
            px: 3,
          }}
        >
          {submitting ? 'Uploading...' : 'Update'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PaymentProofModal;

