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
  REJECTED: 'rejected',
  MANUAL_APPROVAL: 'manual_approval',
  DIRECTOR_APPROVAL: 'director_approval',
  ADDITIONAL_DIRECTOR_APPROVAL: 'additional_director_approval',
  SALES_HEAD_PENDING: 'sales_head_pending',
  DIRECTOR_PENDING: 'director_pending',
  ADDITIONAL_DIRECTOR_PENDING: 'additional_director_pending',
  SALES_HEAD_APPROVED: 'sales_head_approved',
  SALES_HEAD_REJECTED: 'sales_head_rejected',
  RFQ_REJECTED: 'rfq_rejected',
  VENDOR_REJECTED: 'vendor_rejected',
  VENDOR_RESUBMITTED: 'vendor_resubmitted',
  INVOICE_APPROVED: 'invoice_approved',
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
  [SHOPBOARD_REQUEST_STATUS.DIRECTOR_APPROVAL]: 'Director Approval',
  [SHOPBOARD_REQUEST_STATUS.ADDITIONAL_DIRECTOR_APPROVAL]: 'Additional Director Approval',
  [SHOPBOARD_REQUEST_STATUS.SALES_HEAD_PENDING]: 'Sales Head Pending',
  [SHOPBOARD_REQUEST_STATUS.DIRECTOR_PENDING]: 'Director Pending',
  [SHOPBOARD_REQUEST_STATUS.ADDITIONAL_DIRECTOR_PENDING]: 'Additional Director Pending',
  [SHOPBOARD_REQUEST_STATUS.SALES_HEAD_APPROVED]: 'Sales Head Approved',
  [SHOPBOARD_REQUEST_STATUS.SALES_HEAD_REJECTED]: 'Sales Head Rejected',
  [SHOPBOARD_REQUEST_STATUS.RFQ_REJECTED]: 'RFQ Rejected',
  [SHOPBOARD_REQUEST_STATUS.VENDOR_REJECTED]: 'Vendor Rejected',
  [SHOPBOARD_REQUEST_STATUS.VENDOR_RESUBMITTED]: 'Vendor Resubmitted',
  [SHOPBOARD_REQUEST_STATUS.INVOICE_APPROVED]: 'Executive verified',
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
    case SHOPBOARD_REQUEST_STATUS.RFQ_REJECTED:
    case SHOPBOARD_REQUEST_STATUS.VENDOR_REJECTED:
      return 'error';
    case SHOPBOARD_REQUEST_STATUS.RFQ:
    case SHOPBOARD_REQUEST_STATUS.VENDOR_RESUBMITTED:
      return 'info';
    case SHOPBOARD_REQUEST_STATUS.QUOTATION_SENT:
      return 'secondary';
    case SHOPBOARD_REQUEST_STATUS.INVOICE_SENT:
    case SHOPBOARD_REQUEST_STATUS.UNDER_REVIEW:
      return 'primary';
    case SHOPBOARD_REQUEST_STATUS.INVOICE_APPROVED:
      return 'success';
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
    case SHOPBOARD_REQUEST_STATUS.DIRECTOR_APPROVAL:
    case SHOPBOARD_REQUEST_STATUS.ADDITIONAL_DIRECTOR_APPROVAL:
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

