/**
 * Shopboard Request Status Constants
 * 
 * This file contains the status enum values and their display names
 * for shopboard requests. The status values match the ENUM defined in
 * the ShopboardRequest model (digital_backend/src/models/ShopboardRequest.js)
 */

// Status enum values (matching the database ENUM)
export const SHOPBOARD_REQUEST_STATUS = {
  NOT_DECIDED: 'not decided',
  PROCESSING: 'processing',
  REVIEW_REQUESTED: 'review requested',
  RFQ: 'Rfq',
  QUOTATION_SENT: 'quotation sent',
  RFQ_NOT_ACCEPTED: 'rfq not accepted',
  UNDER_REVIEW: 'under_review',
  CEO_PENDING: 'ceo_pending',
  CEO_APPROVAL: 'ceo_approval',
  COMPLETED: 'completed',
  INVOICE_SENT: 'invoice_sent',
  PAYMENT_RELEASED: 'payment_released',
  SUBMITTED_FOR_PAYMENT: 'Submitted for Payment',
  INVOICE_REJECTED: 'invoice rejected',
  PAYMENT_SUCCESSFUL: 'payment successful',
  // REJECTED: 'rejected',
  MANUAL_APPROVAL: 'manual_approval',
};

// Display names mapping for each status
export const SHOPBOARD_REQUEST_STATUS_DISPLAY = {
  [SHOPBOARD_REQUEST_STATUS.NOT_DECIDED]: 'Not Decided',
  [SHOPBOARD_REQUEST_STATUS.PROCESSING]: 'Processing',
  [SHOPBOARD_REQUEST_STATUS.REVIEW_REQUESTED]: 'Review Requested',
  [SHOPBOARD_REQUEST_STATUS.RFQ]: 'RFQ',
  [SHOPBOARD_REQUEST_STATUS.QUOTATION_SENT]: 'Quotation Sent',
  [SHOPBOARD_REQUEST_STATUS.RFQ_NOT_ACCEPTED]: 'RFQ Not Accepted',
  [SHOPBOARD_REQUEST_STATUS.UNDER_REVIEW]: 'Under Review',
  [SHOPBOARD_REQUEST_STATUS.CEO_PENDING]: 'CEO Pending',
  [SHOPBOARD_REQUEST_STATUS.CEO_APPROVAL]: 'CEO Approval',
  [SHOPBOARD_REQUEST_STATUS.COMPLETED]: 'Completed',
  [SHOPBOARD_REQUEST_STATUS.INVOICE_SENT]: 'Invoice Sent',
  [SHOPBOARD_REQUEST_STATUS.PAYMENT_RELEASED]: 'Payment Released',
  [SHOPBOARD_REQUEST_STATUS.SUBMITTED_FOR_PAYMENT]: 'Submitted for Payment',
  [SHOPBOARD_REQUEST_STATUS.INVOICE_REJECTED]: 'Invoice Rejected',
  [SHOPBOARD_REQUEST_STATUS.PAYMENT_SUCCESSFUL]: 'Payment Successful',
  [SHOPBOARD_REQUEST_STATUS.REJECTED]: 'Rejected',
  [SHOPBOARD_REQUEST_STATUS.MANUAL_APPROVAL]: 'Manual Approval',
};

// Helper function to get display name for a status
export const getStatusDisplayName = (status) => {
  if (!status) return 'Not Decided';
  return SHOPBOARD_REQUEST_STATUS_DISPLAY[status] || status;
};

// Helper function to get status color (for Material-UI Chip component)
export const getStatusColor = (status) => {
  if (!status) return 'warning';
  
  switch (status) {
    case SHOPBOARD_REQUEST_STATUS.PROCESSING:
      return 'success';
    case SHOPBOARD_REQUEST_STATUS.REVIEW_REQUESTED:
    case SHOPBOARD_REQUEST_STATUS.RFQ_NOT_ACCEPTED:
    case SHOPBOARD_REQUEST_STATUS.INVOICE_REJECTED:
    case SHOPBOARD_REQUEST_STATUS.REJECTED:
      return 'error';
    case SHOPBOARD_REQUEST_STATUS.RFQ:
      return 'info';
    case SHOPBOARD_REQUEST_STATUS.QUOTATION_SENT:
      return 'secondary';
    case SHOPBOARD_REQUEST_STATUS.INVOICE_SENT:
    case SHOPBOARD_REQUEST_STATUS.UNDER_REVIEW:
      return 'primary';
    case SHOPBOARD_REQUEST_STATUS.SUBMITTED_FOR_PAYMENT:
      return 'info';
    case SHOPBOARD_REQUEST_STATUS.PAYMENT_RELEASED:
    case SHOPBOARD_REQUEST_STATUS.PAYMENT_SUCCESSFUL:
    case SHOPBOARD_REQUEST_STATUS.COMPLETED:
      return 'success';
    case SHOPBOARD_REQUEST_STATUS.NOT_DECIDED:
    case SHOPBOARD_REQUEST_STATUS.MANUAL_APPROVAL:
      return 'warning';
    case SHOPBOARD_REQUEST_STATUS.CEO_PENDING:
      return 'warning';
    case SHOPBOARD_REQUEST_STATUS.CEO_APPROVAL:
      return 'success'; // Will be styled as light green in the component
    default:
      return 'default';
  }
};

// Array of all status values
export const ALL_STATUSES = Object.values(SHOPBOARD_REQUEST_STATUS);

// Array of status objects with value and display name
export const STATUS_OPTIONS = ALL_STATUSES.map(status => ({
  value: status,
  label: getStatusDisplayName(status),
}));

