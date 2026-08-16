const escapeHtml = (value) => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const formatMoney = (value) =>
  Number(value || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (value) => {
  if (!value) return 'N/A';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 'N/A' : d.toLocaleString('en-GB');
};

const describeItems = (items) =>
  (items || [])
    .map((item) => {
      const name = item.request_type_name || 'N/A';
      const qty = item.quantity && item.quantity > 1 ? ` x${item.quantity}` : '';
      return `${name} (${item.width || '-'} x ${item.height || '-'})${qty}`;
    })
    .join(', ');

/**
 * Printable manual approval form for a whole batch.
 * Rendered into a hidden iframe and sent to the browser print dialog, so the
 * user can save it as a PDF, sign it, and upload it back against the batch.
 */
export function buildManualApprovalBatchFormHtml(batch) {
  const requests = batch?.requests || [];

  const rows = requests
    .map(
      (request, index) => `
        <tr>
          <td class="num">${index + 1}</td>
          <td class="num">${escapeHtml(request.id)}</td>
          <td>${escapeHtml(request.dealer_name)}<div class="muted">${escapeHtml(request.dealer_code)}</div></td>
          <td>${escapeHtml(request.vendor_name)}</td>
          <td>${escapeHtml(request.created_by_name)}</td>
          <td class="items">${escapeHtml(describeItems(request.requestItems) || 'N/A')}</td>
          <td class="amount">${formatMoney(request.amount != null ? request.amount : request.total_cost)}</td>
        </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Manual Approval Form - ${escapeHtml(batch?.batch_number || '')}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  @page { size: A4; margin: 12mm; }

  body {
    font-family: Arial, Helvetica, sans-serif;
    color: #333;
    background: #fff;
    font-size: 11px;
    line-height: 1.35;
  }

  /* A4 height (297mm) minus the 12mm top and bottom page margins, so the
     signature block is pushed to the bottom of the sheet on a short batch. */
  .sheet {
    display: flex;
    flex-direction: column;
    min-height: 273mm;
  }
  .sheet-content { flex: 1 0 auto; }
  .sheet-bottom {
    margin-top: auto;
    padding-top: 12px;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .header {
    text-align: center;
    padding-bottom: 8px;
    margin-bottom: 14px;
    border-bottom: 2px solid #2c3e50;
  }
  .header h1 { font-size: 22px; color: #2c3e50; letter-spacing: 1.5px; }
  .header h2 { font-size: 13px; color: #7f8c8d; font-weight: normal; margin-top: 2px; }

  .meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 20px;
    margin-bottom: 14px;
  }
  .meta div { font-size: 11px; }
  .meta strong { color: #555; }

  .section-title {
    font-size: 11px;
    font-weight: bold;
    color: #2c3e50;
    text-transform: uppercase;
    padding-bottom: 4px;
    margin-bottom: 8px;
    border-bottom: 1.5px solid #3498db;
    letter-spacing: 0.3px;
  }

  .reason-box {
    background: #f8f9fa;
    border-left: 3px solid #3498db;
    padding: 8px 10px;
    margin-bottom: 14px;
    font-size: 11px;
    white-space: pre-wrap;
    word-break: break-word;
  }

  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th, td {
    border: 0.5px solid #cfd8dc;
    padding: 5px 6px;
    vertical-align: top;
    text-align: left;
  }
  th {
    background: #eef3f7;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    color: #2c3e50;
  }
  td.num, th.num { width: 34px; text-align: center; }
  td.amount, th.amount { text-align: right; white-space: nowrap; }
  td.items { font-size: 10px; }
  .muted { color: #7f8c8d; font-size: 9.5px; }

  tfoot td {
    font-weight: bold;
    background: #f4f6f8;
  }

  .signatures {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 30px;
  }
  .sign-block { text-align: center; }
  .sign-line {
    margin-top: 42px;
    border-top: 1px solid #555;
    padding-top: 5px;
    font-size: 10px;
    color: #555;
  }

  .footer {
    margin-top: 18px;
    padding-top: 6px;
    border-top: 0.5px solid #ddd;
    display: flex;
    justify-content: space-between;
    font-size: 9px;
    color: #7f8c8d;
  }

  tr { page-break-inside: avoid; }
  thead { display: table-header-group; }
</style>
</head>
<body>
<div class="sheet">
  <div class="sheet-content">
  <div class="header">
    <h1>DIAMOND PAINTS</h1>
    <h2>Manual Approval Form</h2>
  </div>

  <div class="meta">
    <div><strong>Batch Number:</strong> ${escapeHtml(batch?.batch_number || 'N/A')}</div>
    <div><strong>Approval Date:</strong> ${escapeHtml(formatDate(batch?.approval_date))}</div>
    <div><strong>Approved By:</strong> ${escapeHtml(batch?.created_by_name || 'N/A')}</div>
    <div><strong>Total Requests:</strong> ${escapeHtml(batch?.total_requests ?? requests.length)}</div>
  </div>

  <div class="section-title">Reason for Manual Approval</div>
  <div class="reason-box">${escapeHtml(batch?.manual_approval_reason || 'N/A')}</div>

  <div class="section-title">Approved Requests</div>
  <table>
    <thead>
      <tr>
        <th class="num">#</th>
        <th class="num">Req ID</th>
        <th>Dealer Name</th>
        <th>Vendor Name</th>
        <th>Created By</th>
        <th>Request Items</th>
        <th class="amount">Total Amount</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="7">No requests in this batch</td></tr>'}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="6">Grand Total</td>
        <td class="amount">Rs. ${formatMoney(batch?.total_amount)}</td>
      </tr>
    </tfoot>
  </table>
  </div>

  <div class="sheet-bottom">
    <div class="signatures">
      <div class="sign-block"><div class="sign-line">Prepared By</div></div>
      <div class="sign-block"><div class="sign-line">Reviewed By</div></div>
      <div class="sign-block"><div class="sign-line">Approved By</div></div>
    </div>

    <div class="footer">
      <div>Generated on: ${escapeHtml(new Date().toLocaleString('en-GB'))}</div>
      <div>Diamond Paints - Manual Approval Form</div>
    </div>
  </div>
</div>
</body>
</html>`;
}

export default buildManualApprovalBatchFormHtml;
