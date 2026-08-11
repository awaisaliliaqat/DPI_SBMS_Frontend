import * as React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
} from '@mui/material';
import AttachmentFilesDisplay from './AttachmentFilesDisplay';

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

  const hasInvoiceData =
    hasDataFiles(invoice_files_data) ||
    hasDataFiles(dealer_acknowledgment_files_data) ||
    hasDataMap(invoice_site_photos_by_item_data) ||
    (invoice &&
      ((invoice.invoice_files && invoice.invoice_files.length > 0) ||
        (invoice.dealer_acknowledgment_files && invoice.dealer_acknowledgment_files.length > 0) ||
        (invoice.site_photos && invoice.site_photos.length > 0) ||
        (invoice.site_photos_by_item && Object.keys(invoice.site_photos_by_item).length > 0)));

  const renderFileSection = (title, files, chipColor = 'primary') => {
    if (!files || files.length === 0) return null;

    return (
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1, color: '#333' }}>
          {title} ({files.length})
        </Typography>
        <AttachmentFilesDisplay
          files={files}
          fallbackLabel={title}
          chipColor={chipColor}
          emptyText={`No ${title.toLowerCase()} available`}
        />
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
                  Item #{idKey}: {typeName} — {width}×{height} ft {ppsf ? `(₨${ppsf.toFixed(2)}/ft²)` : ''}{' '}
                  {price ? `— Total ₨${price.toFixed(2)}` : ''}
                </Typography>
                <AttachmentFilesDisplay
                  files={files}
                  fallbackLabel="Photo"
                  chipColor="success"
                  emptyText="No photos"
                />
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
        },
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
                    day: 'numeric',
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
            {renderFileSection(
              'Invoice Files',
              hasDataFiles(invoice_files_data) ? invoice_files_data : invoice?.invoice_files || [],
              'primary'
            )}

            {renderFileSection(
              'Dealer Acknowledgment Forms',
              hasDataFiles(dealer_acknowledgment_files_data)
                ? dealer_acknowledgment_files_data
                : invoice?.dealer_acknowledgment_files || [],
              'secondary'
            )}

            {renderFileSection('Site Photos', invoice?.site_photos || [], 'success')}

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
            },
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default InvoiceViewer;
