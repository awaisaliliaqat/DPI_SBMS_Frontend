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
  Divider,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import AttachmentFilesDisplay from './AttachmentFilesDisplay';
import ManualSurveyHighlight from './ManualSurveyHighlight';

const RequestDetailsWithInvoiceModal = ({
  open,
  onClose,
  requestData,
  getVendorName
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

  const invoice = requestData?.invoice ? parseInvoiceData(requestData.invoice) : null;

  const hasDataFiles = (arr) => Array.isArray(arr) && arr.length > 0;
  const hasDataMap = (obj) => obj && typeof obj === 'object' && Object.keys(obj).length > 0;

  // Prefer DB-backed _data; fall back to legacy invoice JSON
  const hasInvoiceData =
    hasDataFiles(requestData?.invoice_files_data) ||
    hasDataFiles(requestData?.dealer_acknowledgment_files_data) ||
    hasDataMap(requestData?.invoice_site_photos_by_item_data) ||
    (invoice &&
      ((invoice.invoice_files && invoice.invoice_files.length > 0) ||
        (invoice.dealer_acknowledgment_files && invoice.dealer_acknowledgment_files.length > 0) ||
        (invoice.site_photos && invoice.site_photos.length > 0) ||
        (invoice.site_photos_by_item && Object.keys(invoice.site_photos_by_item).length > 0)));

  const renderFileSection = (title, files, color = 'primary') => {
    if (!files || files.length === 0) return null;

    return (
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1, color: '#333' }}>
          {title} ({files.length})
        </Typography>
        <AttachmentFilesDisplay
          files={files}
          fallbackLabel={title}
          chipColor={color}
          emptyText={`No ${title.toLowerCase()} available`}
        />
      </Box>
    );
  };

  const renderPerItemSitePhotos = () => {
    const map = requestData?.invoice_site_photos_by_item_data ?? invoice?.site_photos_by_item;
    if (!map || !requestData?.requestItems || requestData.requestItems.length === 0) return null;

    const byId = new Map();
    requestData.requestItems.forEach((it) => {
      byId.set(String(it.id), it);
    });

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

  if (!requestData) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="request-details-invoice-dialog-title"
      PaperProps={{
        sx: {
          backgroundColor: '#ffffff',
          minWidth: '800px',
          maxWidth: '1200px',
          maxHeight: '90vh',
          overflow: 'auto',
          borderRadius: 2,
          boxShadow: 6,
        }
      }}
    >
      <DialogTitle 
        id="request-details-invoice-dialog-title"
        sx={{ 
          color: 'info.main',
          fontWeight: 'bold',
          borderBottom: '1px solid #eaeaea',
          mb: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
          Request Details & Invoice - #{requestData.id}
          <ManualSurveyHighlight request={requestData} compact />
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
          <ManualSurveyHighlight request={requestData} />
          {/* Request Details Section */}
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: 'primary.main' }}>
              Request Details
            </Typography>

            {/* Dealer Information */}
            <Paper variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2, backgroundColor: '#f8f9fa' }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: 'primary.main' }}>
                🏢 Dealer Information
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                    Dealer Name
                  </Typography>
                  <Typography variant="body1">
                    {requestData.dealer?.name || 'N/A'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                    Dealer Code
                  </Typography>
                  <Typography variant="body1">
                    {requestData.dealer?.code || 'N/A'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                    Phone
                  </Typography>
                  <Typography variant="body1">
                    {requestData.dealer?.phone || 'N/A'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                    Address
                  </Typography>
                  <Typography variant="body1">
                    {requestData.dealer?.city || 'N/A'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                    Dealer Type
                  </Typography>
                  <Typography variant="body1">
                    {requestData.dealer_type === 'new' ? 'New' : 'Old'}
                  </Typography>
                </Box>
              </Box>
            </Paper>

            {/* Request Items */}
            <Paper variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2, backgroundColor: '#f8f9fa' }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: 'primary.main' }}>
                📋 Request Items & Dimensions
              </Typography>
              {requestData.requestItems && requestData.requestItems.length > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {requestData.requestItems.map((item, index) => (
                    <Paper key={index} variant="outlined" sx={{ p: 2, borderRadius: 2, backgroundColor: '#ffffff' }}>
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 2, alignItems: 'center' }}>
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                            Request Type
                          </Typography>
                          <Typography variant="body2">
                            {item.requestType?.name || 'N/A'}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                            Width (ft)
                          </Typography>
                          <Typography variant="body2">
                            {item.width || 'N/A'}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                            Height (ft)
                          </Typography>
                          <Typography variant="body2">
                            {item.height || 'N/A'}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                            Price per (sqft)
                          </Typography>
                          <Typography variant="body2">
                            {item.price_per_square_foot ? `₨${parseFloat(item.price_per_square_foot).toFixed(2)}` : 'N/A'}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                            Total Cost
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                            {item.price ? `₨${parseFloat(item.price).toFixed(2)}` : 'N/A'}
                          </Typography>
                        </Box>
                      </Box>
                    </Paper>
                  ))}
                  <Box sx={{ mt: 2, p: 2, backgroundColor: '#e3f2fd', borderRadius: 2, border: '1px solid #bbdefb' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                        Total Cost (All Items)
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                        ₨{(() => {
                          if (!requestData.requestItems || !Array.isArray(requestData.requestItems)) return '0.00';
                          const total = requestData.requestItems.reduce((sum, item) => {
                            const price = parseFloat(item.price) || 0;
                            return sum + price;
                          }, 0);
                          return total.toFixed(2);
                        })()}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              ) : (
                <Typography variant="body1" sx={{ color: '#666', fontStyle: 'italic' }}>
                  No request items found
                </Typography>
              )}
            </Paper>

            {/* Warranty & Installation Info */}
            <Paper variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2, backgroundColor: '#f8f9fa' }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: 'primary.main' }}>
                🔧 Warranty & Installation Information
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                    Warranty Status
                  </Typography>
                  <Typography variant="body1">
                    {requestData.warrantyStatus?.name || 'N/A'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                    Last Installation Date
                  </Typography>
                  <Typography variant="body1">
                    {requestData.last_installation_date ? 
                      new Date(requestData.last_installation_date).toLocaleDateString() : 'N/A'}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                  Reason for Replacement
                </Typography>
                <Typography variant="body1" sx={{ 
                  p: 2, 
                  backgroundColor: '#ffffff', 
                  borderRadius: 1, 
                  border: '1px solid #e0e0e0',
                  minHeight: '60px'
                }}>
                  {requestData.reason_for_replacement || 'No reason provided'}
                </Typography>
              </Box>
            </Paper>

            {/* Request Status & Vendor Info */}
            <Paper variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2, backgroundColor: '#f8f9fa' }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: 'primary.main' }}>
                📊 Request Status & Vendor Information
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                    Current Status
                  </Typography>
                  <Chip 
                    label={requestData.status || 'Not Decided'} 
                    variant="filled" 
                    size="small"
                    color="info"
                  />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                    Assigned Vendor
                  </Typography>
                  <Typography variant="body1">
                    {getVendorName ? getVendorName(requestData) : 'Not assigned'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                    Total Cost
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                    {requestData.total_cost ? `₨${parseFloat(requestData.total_cost).toFixed(2)}` : 'N/A'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666', mb: 0.5 }}>
                    Approval Date
                  </Typography>
                  <Typography variant="body1">
                    {requestData.approval_date ? 
                      (() => {
                        try {
                          const date = new Date(requestData.approval_date);
                          return date.toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          }) + ' ' + date.toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                          });
                        } catch (error) {
                          return 'N/A';
                        }
                      })() : 'N/A'}
                  </Typography>
                </Box>
              </Box>
              
              {/* Approval Status - Prominent Display */}
              <Box sx={{ 
                mt: 3, 
                p: 2.5, 
                borderRadius: 2,
                background: requestData.is_manual 
                  ? 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)'
                  : 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
                border: `2px solid ${requestData.is_manual ? '#ff9800' : '#1976d2'}`,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                display: 'flex',
                alignItems: 'center',
                gap: 2
              }}>
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  backgroundColor: requestData.is_manual ? '#ff9800' : '#1976d2',
                  color: '#ffffff',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                }}>
                  {requestData.is_manual ? (
                    <PersonIcon sx={{ fontSize: 28 }} />
                  ) : (
                    <CheckCircleIcon sx={{ fontSize: 28 }} />
                  )}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" sx={{ 
                    color: '#666', 
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    mb: 0.5,
                    display: 'block'
                  }}>
                    Approval Status
                  </Typography>
                  <Typography variant="h6" sx={{ 
                    fontWeight: 'bold',
                    color: requestData.is_manual ? '#e65100' : '#0d47a1',
                    m: 0,
                    lineHeight: 1.2
                  }}>
                    {requestData.is_manual ? 'Manual Approval by Manager' : 'Approved by CEO'}
                  </Typography>
                </Box>
              </Box>
            </Paper>

            {/* Attachments Section */}
            <Paper variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2, backgroundColor: '#f8f9fa' }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: 'primary.main' }}>
                📎 Attachments
              </Typography>
              
              {/* Site Photos — images inline; PDF/other open in new tab */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Site Photos
                </Typography>
                <AttachmentFilesDisplay
                  files={requestData.site_photo_attachement}
                  uploadFolder="site_photos"
                  fallbackLabel="Site Photo"
                  chipColor="primary"
                  emptyText="No site photos uploaded"
                />
              </Box>

              {/* Old Board Photos */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Old Board Photos
                </Typography>
                <AttachmentFilesDisplay
                  files={requestData.old_board_photo_attachment}
                  uploadFolder="old_board_photos"
                  fallbackLabel="Old Board Photo"
                  chipColor="secondary"
                  emptyText="No old board photos uploaded"
                />
              </Box>

              {/* Survey Forms */}
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Survey Forms
                </Typography>
                <AttachmentFilesDisplay
                  files={requestData.survey_form_attachments}
                  uploadFolder="survey_forms"
                  fallbackLabel="Survey Form"
                  chipColor="success"
                  emptyText="No survey forms uploaded"
                />
              </Box>
            </Paper>
          </Box>

          {/* Divider between Request Details and Invoice Documents */}
          {hasInvoiceData && (
            <>
              <Divider sx={{ my: 2 }} />
              
              {/* Invoice Documents Section */}
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: 'primary.main' }}>
                  Invoice Documents
                </Typography>

                {/* Invoice Number and Date Display */}
                {(requestData.invoice_number || requestData.invoice_date) && (
                  <Box sx={{ mb: 2, p: 1.5, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                    {requestData.invoice_number && (
                      <Box sx={{ mb: requestData.invoice_date ? 1 : 0 }}>
                        <Typography variant="body2" sx={{ color: '#666', mb: 0.5 }}>
                          Invoice Number
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 'bold', color: '#333' }}>
                          {requestData.invoice_number}
                        </Typography>
                      </Box>
                    )}
                    {requestData.invoice_date && (
                      <Box>
                        <Typography variant="body2" sx={{ color: '#666', mb: 0.5 }}>
                          Invoice Date
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 'bold', color: '#333' }}>
                          {new Date(requestData.invoice_date).toLocaleDateString('en-US', {
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
                    {/* Invoice Files: prefer DB _data, fallback to legacy invoice JSON */}
                    {renderFileSection(
                      'Invoice Files',
                      hasDataFiles(requestData?.invoice_files_data) ? requestData.invoice_files_data : (invoice?.invoice_files || []),
                      'primary'
                    )}

                    {renderFileSection(
                      'Dealer Acknowledgment Forms',
                      hasDataFiles(requestData?.dealer_acknowledgment_files_data) ? requestData.dealer_acknowledgment_files_data : (invoice?.dealer_acknowledgment_files || []),
                      'secondary'
                    )}

                    {renderFileSection(
                      'Site Photos',
                      invoice?.site_photos || [],
                      'success'
                    )}

                    {/* Per-Item Site Photos */}
                    {renderPerItemSitePhotos()}
                  </Box>
                )}
              </Box>
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 3, gap: 2, backgroundColor: '#f8f9fa', borderTop: '1px solid #e0e0e0' }}>
        <Button 
          onClick={onClose}
          variant="outlined"
          sx={{ 
            color: '#666',
            borderColor: '#ddd',
            borderRadius: 2,
            px: 3,
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

export default RequestDetailsWithInvoiceModal;

