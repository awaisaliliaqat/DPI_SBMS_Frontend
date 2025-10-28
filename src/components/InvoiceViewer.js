import * as React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Alert,
} from '@mui/material';
import {
  Receipt as InvoiceIcon,
  Description as DocumentIcon,
  Photo as PhotoIcon,
} from '@mui/icons-material';
import { BASE_URL } from '../constants/Constants';

const InvoiceViewer = ({ open, onClose, invoiceData, requestId }) => {
  // Parse the invoice JSON data
  const parseInvoiceData = (data) => {
    if (!data) return null;
    
    try {
      // If it's already an object, return it
      if (typeof data === 'object') {
        return data;
      }
      // If it's a string, parse it
      if (typeof data === 'string') {
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      console.error('Error parsing invoice data:', error);
      return null;
    }
  };

  const invoice = parseInvoiceData(invoiceData);

  // Check if there's any invoice data to display
  const hasInvoiceData = invoice && (
    (invoice.invoice_files && invoice.invoice_files.length > 0) ||
    (invoice.dealer_acknowledgment_files && invoice.dealer_acknowledgment_files.length > 0) ||
    (invoice.site_photos && invoice.site_photos.length > 0)
  );

  const handleFileClick = (filePath) => {
    const fullUrl = filePath.startsWith('/') ? `${BASE_URL}${filePath}` : `${BASE_URL}/${filePath}`;
    window.open(fullUrl, '_blank');
  };

  const renderFileSection = (title, files, icon, color = 'primary') => {
    if (!files || files.length === 0) return null;

    return (
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1, color: '#333' }}>
          {title} ({files.length})
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {files.map((file, index) => (
            <Chip
              key={`${title}-${index}`}
              label={file.split('/').pop()}
              size="small"
              color={color}
              variant="outlined"
              onClick={() => handleFileClick(file)}
              sx={{ 
                cursor: 'pointer',
                '&:hover': {
                  backgroundColor: color === 'primary' ? '#e3f2fd' : 
                                 color === 'secondary' ? '#f3e5f5' : '#e8f5e8',
                }
              }}
            />
          ))}
        </Box>
      </Box>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="invoice-viewer-dialog-title"
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
        id="invoice-viewer-dialog-title"
        sx={{ 
          color: 'info.main',
          fontWeight: 'bold',
        }}
      >
        Invoice Documents - Request #{requestId}
      </DialogTitle>
      
      <DialogContent>
        {!hasInvoiceData ? (
          <Box sx={{ textAlign: 'center', p: 4 }}>
            <Typography variant="body1" sx={{ color: '#666' }}>
              No invoice documents available for this request.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Invoice Files */}
            {renderFileSection(
              'Invoice Files',
              invoice.invoice_files,
              <InvoiceIcon />,
              'primary'
            )}

            {/* Dealer Acknowledgment Files */}
            {renderFileSection(
              'Dealer Acknowledgment Forms',
              invoice.dealer_acknowledgment_files,
              <DocumentIcon />,
              'secondary'
            )}

            {/* Site Photos */}
            {renderFileSection(
              'Site Photos',
              invoice.site_photos,
              <PhotoIcon />,
              'success'
            )}
          </Box>
        )}
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
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default InvoiceViewer;
