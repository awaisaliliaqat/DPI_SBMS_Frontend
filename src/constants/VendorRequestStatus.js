/**
 * Vendor Request Status Constants
 * 
 * This file contains vendor-specific status constants, display names, and color mappings
 * for shopboard requests from the vendor's perspective.
 * 
 * Note: The base status values match the database ENUM, but display names and colors
 * are customized for the vendor view.
 */

// Import base status constants (we use the same values from database)
import { SHOPBOARD_REQUEST_STATUS } from './ShopboardRequestStatus';

// Vendor-specific status constant for approval status (mapped from ceo_approval/manual_approval)
export const VENDOR_APPROVAL_STATUS = 'approval';

// Vendor-specific display names mapping
// Note: Status mapping is handled by the backend API:
// - ceo_approval/manual_approval -> approval (both represent "approved for work")
// - under_review/ceo_pending/payment_released/payment_successful are excluded from vendor view
// The backend returns the mapped status, so we just need to provide display names here
export const VENDOR_REQUEST_STATUS_DISPLAY = {
  [SHOPBOARD_REQUEST_STATUS.NOT_DECIDED]: 'Not Decided',
  [SHOPBOARD_REQUEST_STATUS.PROCESSING]: 'Processing',
  [SHOPBOARD_REQUEST_STATUS.REVIEW_REQUESTED]: 'Review Requested',
  [SHOPBOARD_REQUEST_STATUS.RFQ]: 'RFQ',
  [SHOPBOARD_REQUEST_STATUS.QUOTATION_SENT]: 'Quotation Sent',
  [SHOPBOARD_REQUEST_STATUS.RFQ_NOT_ACCEPTED]: 'RFQ Not Accepted',
  // Note: APPROVAL is the mapped status from ceo_approval/manual_approval
  [VENDOR_APPROVAL_STATUS]: 'Approved for work',
  [SHOPBOARD_REQUEST_STATUS.COMPLETED]: 'Completed',
  [SHOPBOARD_REQUEST_STATUS.INVOICE_SENT]: 'Invoice Sent',
  [SHOPBOARD_REQUEST_STATUS.SUBMITTED_FOR_PAYMENT]: 'Submitted for Payment',
  [SHOPBOARD_REQUEST_STATUS.INVOICE_REJECTED]: 'Invoice Rejected',
  [SHOPBOARD_REQUEST_STATUS.REJECTED]: 'Rejected',
};

/**
 * Get vendor-specific display name for a status
 * Note: Status mapping is handled by the backend API:
 * - ceo_approval/manual_approval -> approval (both represent "approved for work")
 * - under_review/ceo_pending/payment_released/payment_successful are excluded
 * @param {string} status - The status value from API (already mapped by backend)
 * @returns {string} Vendor-specific display name for the status
 */
export const getVendorStatusDisplayName = (status) => {
  if (!status) return 'Not Decided';
  
  // Status is already mapped by backend, just return the display name
  return VENDOR_REQUEST_STATUS_DISPLAY[status] || status;
};

/**
 * Get vendor-specific status color (for Material-UI Chip component)
 * Uses vendor-appropriate color scheme
 * Note: Status mapping is handled by the backend API:
 * - ceo_approval/manual_approval -> approval (both represent "approved for work")
 * - under_review/ceo_pending/payment_released/payment_successful are excluded
 * @param {string} status - The status value from API (already mapped by backend)
 * @returns {string} Material-UI color name
 */
export const getVendorStatusColor = (status) => {
  if (!status) return 'warning';
  
  // Status is already mapped by backend, just determine color
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
      return 'primary';
    case SHOPBOARD_REQUEST_STATUS.SUBMITTED_FOR_PAYMENT:
      return 'info';
    case SHOPBOARD_REQUEST_STATUS.COMPLETED:
      return 'success';
    case SHOPBOARD_REQUEST_STATUS.NOT_DECIDED:
      return 'warning';
    // Note: APPROVAL is the mapped status from ceo_approval/manual_approval
    case VENDOR_APPROVAL_STATUS:
      return 'success';
    default:
      return 'default';
  }
};

/**
 * Map status for vendor view
 * Note: Status mapping is now handled by the backend API:
 * - ceo_approval/manual_approval -> approval (both represent "approved for work")
 * - under_review/ceo_pending/payment_released/payment_successful are excluded
 * This function is kept for backward compatibility but just returns the status as-is
 * @param {string} status - The status value from API (already mapped by backend)
 * @returns {string} Status (already mapped by backend)
 */
export const mapStatusForVendor = (status) => {
  // Status is already mapped by backend, just return as-is
  return status;
};

// Re-export base status constants for convenience
export { SHOPBOARD_REQUEST_STATUS };

// Array of all status values
export const ALL_VENDOR_STATUSES = Object.values(SHOPBOARD_REQUEST_STATUS);

// Array of vendor status objects with value and display name
export const VENDOR_STATUS_OPTIONS = ALL_VENDOR_STATUSES.map(status => ({
  value: status,
  label: getVendorStatusDisplayName(status),
}));

