import { toast } from 'react-toastify';

/**
 * Professional Work Order PDF Generator Component
 * Generates and prints a professional work order document
 * Uses the same format as AreaHeadRequests but adapted for work order purposes
 */
const WorkOrderPDFGenerator = {
  /**
   * Generate and print work order PDF
   * @param {Object} requestData - The shopboard request data
   */
  generate: (requestData) => {
    try {
      // Create a hidden iframe for PDF generation
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.top = '-10000px';
      iframe.style.left = '-10000px';
      iframe.style.width = '210mm';
      iframe.style.height = '297mm';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow.document;

      // Professional Work Order Template (using AreaHeadRequests format)
      const templateHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Work Order - ${requestData.id}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        @page {
            size: A4;
            margin: 10mm;
        }

        @media print {
            body {
                margin: 0;
                padding: 0;
                width: 210mm;
                height: 297mm;
            }
            .container {
                box-shadow: none;
                padding: 15px;
            }
        }

        body {
            font-family: 'Arial', sans-serif;
            line-height: 1.3;
            color: #333;
            background: white;
            width: 210mm;
            height: 297mm;
            margin: 0 auto;
            position: relative;
        }

        .container {
            width: 100%;
            min-height: calc(100% - 40px);
            background: white;
            padding: 15px;
            padding-bottom: 50px;
        }

        .header {
            text-align: center;
            margin-bottom: 15px;
            padding-bottom: 8px;
            border-bottom: 2px solid #2c3e50;
        }

        .header h1 {
            font-size: 24px;
            color: #2c3e50;
            margin-bottom: 3px;
            letter-spacing: 1.5px;
        }

        .header h2 {
            font-size: 14px;
            color: #7f8c8d;
            font-weight: normal;
        }

        .work-order-number {
            text-align: center;
            margin: 15px 0;
            padding: 10px;
            background: #f8f9fa;
            color: #2c3e50;
            border-radius: 4px;
            border-bottom: 1.5px solid #3498db;
        }

        .work-order-number h3 {
            font-size: 16px;
            font-weight: bold;
            margin: 0;
            color: #2c3e50;
        }

        .work-order-number p {
            font-size: 11px;
            margin: 3px 0 0 0;
            color: #2c3e50;
            opacity: 1;
        }

        .section {
            margin-bottom: 12px;
        }

        .section-title {
            font-size: 12px;
            font-weight: bold;
            color: #2c3e50;
            text-transform: uppercase;
            padding-bottom: 4px;
            margin-bottom: 8px;
            border-bottom: 1.5px solid #3498db;
            letter-spacing: 0.3px;
        }

        .fields-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 8px;
        }

        .field {
            margin-bottom: 6px;
        }

        .field-label {
            font-size: 9.5px;
            font-weight: bold;
            color: #555;
            margin-bottom: 2px;
        }

        .field-value {
            font-size: 10.5px;
            color: #333;
            padding-bottom: 2px;
            border-bottom: 0.5px solid #ddd;
            min-height: 14px;
        }

        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
            font-size: 10px;
        }

        .items-table thead {
            background: #f8f9fa;
        }

        .items-table th {
            padding: 8px 6px;
            text-align: left;
            font-size: 9.5px;
            font-weight: bold;
            color: #2c3e50;
            border: 1px solid #ddd;
        }

        .items-table td {
            padding: 6px;
            border: 1px solid #ddd;
            font-size: 10px;
            color: #333;
        }

        .items-table tbody tr:nth-child(even) {
            background: #f8f9fa;
        }

        .full-width {
            grid-column: 1 / -1;
        }

        .reason-box {
            background: #f8f9fa;
            padding: 8px;
            border-radius: 3px;
            margin-top: 6px;
            margin-left: 0;
            margin-right: 0;
            width: 100%;
        }

        .reason-label {
            font-size: 9.5px;
            font-weight: bold;
            color: #555;
            margin-bottom: 3px;
        }

        .reason-text {
            font-size: 10px;
            color: #333;
            line-height: 1.4;
        }

        .total-box {
            background: #3498db;
            color: white;
            padding: 8px;
            border-radius: 3px;
            margin: 10px 0;
            text-align: center;
        }

        .total-label {
            font-size: 10px;
            margin-bottom: 3px;
            opacity: 0.9;
        }

        .total-amount {
            font-size: 18px;
            font-weight: bold;
        }

        .footer {
            position: fixed;
            bottom: 10mm;
            left: 15px;
            right: 15px;
            padding-top: 8px;
            border-top: 0.5px solid #ddd;
            display: flex;
            justify-content: space-between;
            font-size: 9px;
            color: #7f8c8d;
            background: white;
        }

    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <h1>DIAMOND PAINTS</h1>
            <h2>Work Order</h2>
        </div>

        <!-- Work Order Number -->
        <div class="work-order-number">
            <h3>Work Order #<span id="wo-number">-</span></h3>
            <p>Approval Date: <span id="wo-date">-</span></p>
        </div>

        <!-- Dealer Information -->
        <div class="section">
            <div class="section-title">Dealer Information</div>
            <div class="fields-row">
                <div class="field">
                    <div class="field-label">Dealer Name:</div>
                    <div class="field-value" id="dealer-name">-</div>
                </div>
                <div class="field">
                    <div class="field-label">Dealer Code:</div>
                    <div class="field-value" id="dealer-code">-</div>
                </div>
            </div>
            <div class="fields-row">
                <div class="field">
                    <div class="field-label">Phone:</div>
                    <div class="field-value" id="dealer-phone">-</div>
                </div>
                <div class="field">
                    <div class="field-label">Dealer Type:</div>
                    <div class="field-value" id="dealer-type">-</div>
                </div>
            </div>
            <div class="fields-row">
                <div class="field full-width">
                    <div class="field-label">Address:</div>
                    <div class="field-value" id="dealer-address">-</div>
                </div>
            </div>
        </div>

        <!-- Work Order Items -->
        <div class="section">
            <div class="section-title">Work Order Items & Dimensions</div>
            <table class="items-table">
                <thead>
                    <tr>
                        <th>Item #</th>
                        <th>Request Type</th>
                        <th>Width (ft)</th>
                        <th>Height (ft)</th>
                        <th>Price per (sqft)</th>
                        <th>Total Area (sqft)</th>
                        <th>Total Cost</th>
                    </tr>
                </thead>
                <tbody id="request-items">
                    <!-- Items will be populated here -->
                </tbody>
            </table>
            <div class="total-box">
                <div class="total-label">Total Cost (All Items)</div>
                <div class="total-amount" id="total-cost">Rs. 0.00</div>
            </div>
        </div>

        <!-- Warranty & Installation -->
        <div class="section">
            <div class="section-title">Warranty & Installation Information</div>
            <div class="fields-row">
                <div class="field">
                    <div class="field-label">Warranty Status:</div>
                    <div class="field-value" id="warranty-status">-</div>
                </div>
                <div class="field">
                    <div class="field-label">Last Installation Date:</div>
                    <div class="field-value" id="last-installation-date">-</div>
                </div>
            </div>
            <div class="fields-row">
                <div class="field full-width">
                    <div class="field-label">Reason for Replacement:</div>
                    <div class="field-value" id="replacement-reason">No reason provided</div>
                </div>
            </div>
        </div>

        <!-- Footer -->
        <div class="footer">
            <div>Generated on: <span id="generation-date">-</span></div>
            <div>Diamond Paints - Work Order</div>
        </div>
    </div>

    <script>
        function populateWorkOrder(data) {
            const cleanText = (text) => {
                if (!text) return 'N/A';
                return String(text).replace(/[^\\x20-\\x7E\\u00A0-\\u00FF]/g, '').trim();
            };

            const formatPhone = (phone) => {
                if (!phone) return 'N/A';
                const phoneStr = String(phone).replace(/\\D/g, '');
                if (phoneStr.startsWith('92')) {
                    return \`+92 \${phoneStr.slice(2, 5)} \${phoneStr.slice(5)}\`;
                }
                return phoneStr;
            };

            const formatDate = (date) => {
                if (!date) return 'N/A';
                return new Date(date).toLocaleDateString('en-GB');
            };

            // Populate work order number and date
            document.getElementById('wo-number').textContent = data.id || 'N/A';
            document.getElementById('wo-date').textContent = formatDate(data.approval_date || data.created_at);

            // Populate dealer information
            document.getElementById('dealer-name').textContent = cleanText(data.dealer?.name || data.dealerName || 'N/A');
            document.getElementById('dealer-code').textContent = cleanText(data.dealer?.code || data.dealerCode || 'N/A');
            document.getElementById('dealer-phone').textContent = formatPhone(data.dealer?.phone || data.dealerPhone);
            document.getElementById('dealer-address').textContent = cleanText(
                data.dealer?.address || data.dealerAddress || 
                \`\${data.dealer?.city || ''} \${data.dealer?.area || ''}\`.trim() || 'N/A'
            );
            document.getElementById('dealer-type').textContent = data.dealer_type === 'new' ? 'New Dealer' : 'Existing Dealer';

            // Populate request items in table format
            const itemsTableBody = document.getElementById('request-items');
            const items = data.requestItems || data.request_items || [];
            let totalCost = 0;

            if (items.length > 0) {
                items.forEach((item, index) => {
                    const width = parseFloat(item.width) || 0;
                    const height = parseFloat(item.height) || 0;
                    const totalArea = width * height;
                    const pricePerSqft = parseFloat(item.price_per_square_foot || item.price_per_sqft || item.pricePerSqft) || 0;
                    const itemCost = parseFloat(item.price) || 0;
                    totalCost += itemCost;

                    const row = document.createElement('tr');
                    row.innerHTML = \`
                        <td>\${index + 1}</td>
                        <td>\${cleanText(item.requestType?.name || item.request_type || 'N/A')}</td>
                        <td>\${width > 0 ? width.toFixed(2) : 'N/A'}</td>
                        <td>\${height > 0 ? height.toFixed(2) : 'N/A'}</td>
                        <td>\${pricePerSqft > 0 ? \`Rs. \${pricePerSqft.toFixed(2)}\` : 'N/A'}</td>
                        <td>\${totalArea > 0 ? totalArea.toFixed(2) : 'N/A'}</td>
                        <td>\${itemCost > 0 ? \`Rs. \${itemCost.toFixed(2)}\` : 'N/A'}</td>
                    \`;
                    itemsTableBody.appendChild(row);
                });
            } else {
                itemsTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 10px; color: #666; font-size: 9px;">No request items found</td></tr>';
            }

            document.getElementById('total-cost').textContent = \`Rs. \${totalCost.toFixed(2)}\`;

            // Populate warranty information
            document.getElementById('warranty-status').textContent = cleanText(data.warrantyStatus?.name || data.warranty_status || 'N/A');
            document.getElementById('last-installation-date').textContent = formatDate(data.last_installation_date || data.lastInstallationDate);
            document.getElementById('replacement-reason').textContent = cleanText(data.reason_for_replacement || data.reasonForReplacement || 'No reason provided');

            // Update generation date
            document.getElementById('generation-date').textContent = new Date().toLocaleDateString('en-GB');

            // Auto-trigger print dialog after a short delay
            setTimeout(() => {
                window.print();
            }, 500);
        }

        window.populateWorkOrder = populateWorkOrder;
    </script>
</body>
</html>`;

      // Write the template to the iframe
      iframeDoc.open();
      iframeDoc.write(templateHtml);
      iframeDoc.close();

      // Wait for iframe to load, then populate and trigger print
      iframe.onload = () => {
        setTimeout(() => {
          if (iframe.contentWindow.populateWorkOrder) {
            iframe.contentWindow.populateWorkOrder(requestData);
            
            // Clean up iframe after print dialog is closed
            setTimeout(() => {
              document.body.removeChild(iframe);
            }, 1000);
          }
        }, 100);
      };

      toast.success('Work Order PDF generation initiated. Please use the print dialog to save as PDF.', {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
  
    } catch (error) {
      console.error('Error generating work order PDF:', error);
      toast.error('Failed to generate work order PDF. Please try again.', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    }
  }
};

export default WorkOrderPDFGenerator;
