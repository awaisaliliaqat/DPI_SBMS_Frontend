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
} from '@mui/material';
import {
  Receipt as InvoiceIcon,
  Description as DocumentIcon,
  Photo as PhotoIcon,
} from '@mui/icons-material';
import { BASE_URL } from '../constants/Constants';

// Open file in new tab; for data URLs use blob URL so image/PDF loads reliably
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

const InvoiceViewer = ({
  open,
  onClose,
  invoiceData,
  requestId,
  requestItems,
  invoiceNumber,
  invoiceDate,
  invoice_files_data,
  dealer_acknowledgment_files_data,
  invoice_site_photos_by_item_data,
}) => {
  // Parse the invoice JSON data (legacy paths)
  const parseInvoiceData = (data) => {
    if (!data) return null;
    try {
      if (typeof data === 'object') return data;
      if (typeof data === 'string') return JSON.parse(data);
      return null;
    } catch (error) {
      console.error('Error parsing invoice data:', error);
      return null;
    }
  };

  const invoice = parseInvoiceData(invoiceData);

  const hasDataFiles = (arr) => Array.isArray(arr) && arr.length > 0;
  const hasDataMap = (obj) => obj && typeof obj === 'object' && Object.keys(obj).length > 0;

  // Prefer DB-backed _data; fall back to legacy invoice JSON
  const hasInvoiceData =
    hasDataFiles(invoice_files_data) ||
    hasDataFiles(dealer_acknowledgment_files_data) ||
    hasDataMap(invoice_site_photos_by_item_data) ||
    (invoice &&
      ((invoice.invoice_files && invoice.invoice_files.length > 0) ||
        (invoice.dealer_acknowledgment_files && invoice.dealer_acknowledgment_files.length > 0) ||
        (invoice.site_photos && invoice.site_photos.length > 0) ||
        (invoice.site_photos_by_item && Object.keys(invoice.site_photos_by_item).length > 0)));

  const handleFileClick = (filePath) => {
    const fullUrl = filePath.startsWith('/') ? `${BASE_URL}${filePath}` : `${BASE_URL}/${filePath}`;
    window.open(fullUrl, '_blank');
  };

  // Normalize file item: either { url, fileName } or legacy path string
  const getFileLabelAndOpen = (item) => {
    if (item == null) return { label: 'file', open: () => {} };
    if (typeof item === 'object' && item.url != null) {
      return {
        label: item.fileName || 'file',
        open: () => openFileInNewTab(item.url),
      };
    }
    const pathStr = String(item);
    return {
      label: pathStr.startsWith('data:') ? 'file' : pathStr.split('/').pop() || 'file',
      open: () => (pathStr.startsWith('data:') ? openFileInNewTab(pathStr) : handleFileClick(pathStr)),
    };
  };

  const renderFileSection = (title, files, icon, color = 'primary') => {
    if (!files || files.length === 0) return null;

    return (
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1, color: '#333' }}>
          {title} ({files.length})
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {files.map((file, index) => {
            const { label, open } = getFileLabelAndOpen(file);
            return (
              <Chip
                key={`${title}-${index}`}
                label={label}
                size="small"
                color={color}
                variant="outlined"
                onClick={open}
                sx={{
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor:
                      color === 'primary' ? '#e3f2fd' : color === 'secondary' ? '#f3e5f5' : '#e8f5e8',
                  },
                }}
              />
            );
          })}
        </Box>
      </Box>
    );
  };

  const renderPerItemSitePhotos = () => {
    const map = invoice_site_photos_by_item_data ?? invoice?.site_photos_by_item;
    if (!map || !requestItems || requestItems.length === 0) return null;

    const byId = new Map();
    requestItems.forEach((it) => byId.set(String(it.id), it));

    const itemIds = Object.keys(map);
    if (itemIds.length === 0) return null;

    return (
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1, color: '#333' }}>
          Site Photos (Per Item)
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {itemIds.map((idKey) => {
            const files = map[idKey] || [];
            if (!files.length) return null;
            const item = byId.get(String(idKey));
            const typeName = item?.requestType?.name || 'Request Item';
            const width = item?.width ?? 'N/A';
            const height = item?.height ?? 'N/A';
            const price = parseFloat(item?.price) || 0;
            const area = (parseFloat(item?.width) || 0) * (parseFloat(item?.height) || 0);
            const ppsf = area > 0 ? price / area : null;

            return (
              <Box key={idKey} sx={{ p: 1.5, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1976d2', mb: 1 }}>
                  Item #{idKey}: {typeName} — {width}×{height} ft {ppsf ? `(₨${ppsf.toFixed(2)}/ft²)` : ''} {price ? `— Total ₨${price.toFixed(2)}` : ''}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {files.map((file, index) => {
                    const { label, open } = getFileLabelAndOpen(file);
                    return (
                      <Chip
                        key={`item-${idKey}-photo-${index}`}
                        label={label}
                        size="small"
                        color="success"
                        variant="outlined"
                        onClick={open}
                        sx={{
                          cursor: 'pointer',
                          '&:hover': { backgroundColor: '#e8f5e8' },
                        }}
                      />
                    );
                  })}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="invoice-viewer-dialog-title"
      fullWidth
      maxWidth="md"
      PaperProps={{
        sx: {
          backgroundColor: '#ffffff',
          borderRadius: 2,
          maxHeight: '85vh',
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
        {/* Invoice Number and Date Display */}
        {(invoiceNumber || invoiceDate) && (
          <Box sx={{ mb: 2, p: 1.5, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
            {invoiceNumber && (
              <Box sx={{ mb: invoiceDate ? 1 : 0 }}>
                <Typography variant="body2" sx={{ color: '#666', mb: 0.5 }}>
                  Invoice Number
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 'bold', color: '#333' }}>
                  {invoiceNumber}
                </Typography>
              </Box>
            )}
            {invoiceDate && (
              <Box>
                <Typography variant="body2" sx={{ color: '#666', mb: 0.5 }}>
                  Invoice Date
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 'bold', color: '#333' }}>
                  {new Date(invoiceDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {!hasInvoiceData ? (
          <Box sx={{ textAlign: 'center', p: 4 }}>
            <Typography variant="body1" sx={{ color: '#666' }}>
              No invoice documents available for this request.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Invoice Files: prefer DB data, fallback to legacy invoice JSON */}
            {renderFileSection(
              'Invoice Files',
              hasDataFiles(invoice_files_data) ? invoice_files_data : (invoice?.invoice_files || []),
              <InvoiceIcon />,
              'primary'
            )}

            {/* Dealer Acknowledgment Files */}
            {renderFileSection(
              'Dealer Acknowledgment Forms',
              hasDataFiles(dealer_acknowledgment_files_data) ? dealer_acknowledgment_files_data : (invoice?.dealer_acknowledgment_files || []),
              <DocumentIcon />,
              'secondary'
            )}

            {/* Site Photos (legacy only; per-item has DB support) */}
            {renderFileSection(
              'Site Photos',
              invoice?.site_photos || [],
              <PhotoIcon />,
              'success'
            )}

            {/* Per-Item Site Photos */}
            {renderPerItemSitePhotos()}
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
