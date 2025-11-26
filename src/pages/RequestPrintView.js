import * as React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Box, Typography, CircularProgress, Alert, Button } from '@mui/material';
import { BASE_URL } from '../constants/Constants';

export default function RequestPrintView() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [requestData, setRequestData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    // Strict validation: No token = immediate error, no API call
    if (!token || token.trim() === '') {
      setError('Access denied: View token is required. Please use the link from your email.');
      setLoading(false);
      return;
    }

    // Validate ID exists
    if (!id || id.trim() === '') {
      setError('Invalid request ID');
      setLoading(false);
      return;
    }

    const fetchRequest = async () => {
      try {
        const response = await fetch(`${BASE_URL}/api/shopboard-requests/view/${id}?token=${encodeURIComponent(token)}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const result = await response.json();

        // Strict validation: Only proceed if response is successful
        if (!response.ok || !result.success) {
          // Handle different error statuses
          if (response.status === 401 || response.status === 403) {
            throw new Error('Access denied: Invalid or expired token. Please use a valid link from your email.');
          } else if (response.status === 404) {
            throw new Error('Request not found. The request may have been deleted or the link is invalid.');
          } else {
            throw new Error(result.message || 'Failed to load request. Please verify your access token.');
          }
        }

        // Only set data if we have valid response
        if (result.data) {
          setRequestData(result.data);
        } else {
          throw new Error('Invalid response: No data received');
        }
      } catch (err) {
        console.error('Error fetching request:', err);
        // Set specific error message
        setError(err.message || 'Access denied: Failed to load request details. Please verify your token is valid.');
      } finally {
        setLoading(false);
      }
    };

    fetchRequest();
  }, [id, token]);

  const cleanText = (text) => {
    if (!text) return 'N/A';
    return String(text).replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '').trim();
  };

  const formatPhone = (phone) => {
    if (!phone) return 'N/A';
    const phoneStr = String(phone).replace(/\D/g, '');
    if (phoneStr.startsWith('92')) {
      return `+92 ${phoneStr.slice(2, 5)} ${phoneStr.slice(5)}`;
    }
    return phoneStr;
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-GB');
  };

  // Show loading only if we have a token (don't show loading if token is missing)
  if (loading && token) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
        <Typography variant="body2" sx={{ ml: 2 }}>
          Validating access token...
        </Typography>
      </Box>
    );
  }
  
  // If loading is false but no token, show error immediately
  if (!loading && !token) {
    return (
      <Box 
        sx={{ 
          p: 4, 
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#f5f5f5'
        }}
      >
        <Alert severity="error" sx={{ mb: 2, maxWidth: '600px' }}>
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 'bold' }}>
            Access Denied
          </Typography>
          <Typography variant="body1">
            View token is required. Please use the link from your email.
          </Typography>
          <Typography variant="body2" sx={{ mt: 2, color: '#666' }}>
            This page requires a valid access token. Direct access is not allowed.
          </Typography>
        </Alert>
        <Button
          variant="outlined"
          onClick={() => window.location.href = '/'}
          sx={{ mt: 2 }}
        >
          Return to Home
        </Button>
      </Box>
    );
  }

  // Show error immediately if token is invalid or missing - no content shown
  if (error) {
    return (
      <Box 
        sx={{ 
          p: 4, 
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#f5f5f5'
        }}
      >
        <Alert severity="error" sx={{ mb: 2, maxWidth: '600px' }}>
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 'bold' }}>
            Access Denied
          </Typography>
          <Typography variant="body1">
            {error}
          </Typography>
          <Typography variant="body2" sx={{ mt: 2, color: '#666' }}>
            This page requires a valid access token. Please use the link provided in your email.
          </Typography>
        </Alert>
        <Button
          variant="outlined"
          onClick={() => window.location.href = '/'}
          sx={{ mt: 2 }}
        >
          Return to Home
        </Button>
      </Box>
    );
  }

  // Strict security: Don't show ANY content if data is not loaded yet or if there's no data
  // This ensures only verified tokens can see the content
  if (!requestData) {
    // If we have an error, it's already handled above
    // If we're still loading with a token, show loading
    if (loading && token) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
          <CircularProgress />
          <Typography variant="body2" sx={{ ml: 2 }}>
            Validating access token...
          </Typography>
        </Box>
      );
    }
    // If no token and not loading, show error (handled above)
    // If loading is false but no data and no error, something went wrong
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Alert severity="error" sx={{ maxWidth: '600px' }}>
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 'bold' }}>
            Access Denied
          </Typography>
          <Typography variant="body1">
            Unable to load request details. Please verify your access token is valid.
          </Typography>
        </Alert>
      </Box>
    );
  }

  const totalCost = (requestData.requestItems || []).reduce((sum, item) => {
    return sum + (parseFloat(item.price) || 0);
  }, 0);

  return (
    <Box
      sx={{
        fontFamily: 'Arial, sans-serif',
        lineHeight: 1.3,
        color: '#333',
        background: 'white',
        width: '210mm',
        margin: '0 auto',
        padding: '15px',
        '@media print': {
          margin: 0,
          padding: '15px',
          width: '210mm',
          height: '297mm',
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          textAlign: 'center',
          mb: 2,
          pb: 1,
          borderBottom: '2px solid #2c3e50',
        }}
      >
        <Typography variant="h4" sx={{ fontSize: '24px', color: '#2c3e50', mb: 0.5, letterSpacing: '1.5px' }}>
          DIAMOND PAINTS
        </Typography>
        <Typography variant="h6" sx={{ fontSize: '14px', color: '#7f8c8d', fontWeight: 'normal' }}>
          Request Details Report
        </Typography>
      </Box>

      {/* Dealer Information */}
      <Box sx={{ mb: 1.5 }}>
        <Typography
          variant="subtitle2"
          sx={{
            fontSize: '12px',
            fontWeight: 'bold',
            color: '#2c3e50',
            textTransform: 'uppercase',
            pb: 0.5,
            mb: 1,
            borderBottom: '1.5px solid #3498db',
            letterSpacing: '0.3px',
          }}
        >
          Dealer Information
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 1 }}>
          <Box>
            <Typography variant="caption" sx={{ fontSize: '9.5px', fontWeight: 'bold', color: '#555', mb: 0.25 }}>
              Dealer Name:
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '10.5px', color: '#333', pb: 0.25, borderBottom: '0.5px solid #ddd' }}>
              {cleanText(requestData.dealer?.name || 'N/A')}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ fontSize: '9.5px', fontWeight: 'bold', color: '#555', mb: 0.25 }}>
              Dealer Code:
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '10.5px', color: '#333', pb: 0.25, borderBottom: '0.5px solid #ddd' }}>
              {cleanText(requestData.dealer?.code || 'N/A')}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ fontSize: '9.5px', fontWeight: 'bold', color: '#555', mb: 0.25 }}>
              Phone:
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '10.5px', color: '#333', pb: 0.25, borderBottom: '0.5px solid #ddd' }}>
              {formatPhone(requestData.dealer?.phone)}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ fontSize: '9.5px', fontWeight: 'bold', color: '#555', mb: 0.25 }}>
              Dealer Type:
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '10.5px', color: '#333', pb: 0.25, borderBottom: '0.5px solid #ddd' }}>
              {requestData.dealer_type === 'new' ? 'New Dealer' : 'Existing Dealer'}
            </Typography>
          </Box>
          <Box sx={{ gridColumn: '1 / -1' }}>
            <Typography variant="caption" sx={{ fontSize: '9.5px', fontWeight: 'bold', color: '#555', mb: 0.25 }}>
              Address:
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '10.5px', color: '#333', pb: 0.25, borderBottom: '0.5px solid #ddd' }}>
              {cleanText(requestData.dealer?.city || requestData.dealer?.address || 'N/A')}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Request Items */}
      <Box sx={{ mb: 1.5 }}>
        <Typography
          variant="subtitle2"
          sx={{
            fontSize: '12px',
            fontWeight: 'bold',
            color: '#2c3e50',
            textTransform: 'uppercase',
            pb: 0.5,
            mb: 1,
            borderBottom: '1.5px solid #3498db',
            letterSpacing: '0.3px',
          }}
        >
          Request Items & Dimensions
        </Typography>
        {/* Table for request items - one row per item */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '10.5px',
            marginBottom: '10px',
          }}
        >
          <thead
            style={{
              backgroundColor: '#f8f9fa',
            }}
          >
            <tr
              style={{
                borderBottom: '1.5px solid #dee2e6',
              }}
            >
              <th
                style={{
                  padding: '8px 6px',
                  textAlign: 'left',
                  fontWeight: 'bold',
                  color: '#2c3e50',
                  fontSize: '10px',
                  borderRight: '1px solid #dee2e6',
                }}
              >
                Request Type
              </th>
              <th
                style={{
                  padding: '8px 6px',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  color: '#2c3e50',
                  fontSize: '10px',
                  borderRight: '1px solid #dee2e6',
                }}
              >
                Width (ft)
              </th>
              <th
                style={{
                  padding: '8px 6px',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  color: '#2c3e50',
                  fontSize: '10px',
                  borderRight: '1px solid #dee2e6',
                }}
              >
                Height (ft)
              </th>
              <th
                style={{
                  padding: '8px 6px',
                  textAlign: 'right',
                  fontWeight: 'bold',
                  color: '#2c3e50',
                  fontSize: '10px',
                  borderRight: '1px solid #dee2e6',
                }}
              >
                Price per ft²
              </th>
              <th
                style={{
                  padding: '8px 6px',
                  textAlign: 'right',
                  fontWeight: 'bold',
                  color: '#2c3e50',
                  fontSize: '10px',
                }}
              >
                Total Price
              </th>
            </tr>
          </thead>
          <tbody>
            {(requestData.requestItems || []).map((item, index) => (
              <tr
                key={index}
                style={{
                  borderBottom: '1px solid #e9ecef',
                  backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa',
                }}
              >
                <td
                  style={{
                    padding: '8px 6px',
                    borderRight: '1px solid #e9ecef',
                    color: '#333',
                  }}
                >
                  {cleanText(item.requestType?.name || 'N/A')}
                </td>
                <td
                  style={{
                    padding: '8px 6px',
                    textAlign: 'center',
                    borderRight: '1px solid #e9ecef',
                    color: '#333',
                  }}
                >
                  {cleanText(item.width || 'N/A')}
                </td>
                <td
                  style={{
                    padding: '8px 6px',
                    textAlign: 'center',
                    borderRight: '1px solid #e9ecef',
                    color: '#333',
                  }}
                >
                  {cleanText(item.height || 'N/A')}
                </td>
                <td
                  style={{
                    padding: '8px 6px',
                    textAlign: 'right',
                    borderRight: '1px solid #e9ecef',
                    color: '#333',
                  }}
                >
                  {item.price_per_square_foot ? `Rs. ${parseFloat(item.price_per_square_foot).toFixed(2)}` : 'N/A'}
                </td>
                <td
                  style={{
                    padding: '8px 6px',
                    textAlign: 'right',
                    color: '#333',
                    fontWeight: '600',
                  }}
                >
                  {item.price ? `Rs. ${parseFloat(item.price).toFixed(2)}` : 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Box
          sx={{
            background: '#3498db',
            color: 'white',
            p: 1,
            borderRadius: '3px',
            mt: 1.25,
            textAlign: 'center',
          }}
        >
          <Typography variant="caption" sx={{ fontSize: '10px', opacity: 0.9, display: 'block', mb: 0.375 }}>
            Total Cost (All Items)
          </Typography>
          <Typography variant="h6" sx={{ fontSize: '18px', fontWeight: 'bold' }}>
            Rs. {totalCost.toFixed(2)}
          </Typography>
        </Box>
      </Box>

      {/* Warranty & Installation */}
      <Box sx={{ mb: 1.5 }}>
        <Typography
          variant="subtitle2"
          sx={{
            fontSize: '12px',
            fontWeight: 'bold',
            color: '#2c3e50',
            textTransform: 'uppercase',
            pb: 0.5,
            mb: 1,
            borderBottom: '1.5px solid #3498db',
            letterSpacing: '0.3px',
          }}
        >
          Warranty & Installation Information
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 1 }}>
          <Box>
            <Typography variant="caption" sx={{ fontSize: '9.5px', fontWeight: 'bold', color: '#555', mb: 0.25 }}>
              Warranty Status:
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '10.5px', color: '#333', pb: 0.25, borderBottom: '0.5px solid #ddd' }}>
              {cleanText(requestData.warrantyStatus?.name || 'N/A')}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ fontSize: '9.5px', fontWeight: 'bold', color: '#555', mb: 0.25 }}>
              Last Installation Date:
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '10.5px', color: '#333', pb: 0.25, borderBottom: '0.5px solid #ddd' }}>
              {formatDate(requestData.last_installation_date)}
            </Typography>
          </Box>
        </Box>
        <Box
          sx={{
            background: '#f8f9fa',
            p: 1,
            borderRadius: '3px',
            mt: 0.75,
          }}
        >
          <Typography variant="caption" sx={{ fontSize: '9.5px', fontWeight: 'bold', color: '#555', mb: 0.375, display: 'block' }}>
            Reason for Replacement:
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '10px', color: '#333', lineHeight: 1.4 }}>
            {cleanText(requestData.reason_for_replacement || 'No reason provided')}
          </Typography>
        </Box>
      </Box>

      {/* Request Status & Vendor */}
      <Box>
        <Typography
          variant="subtitle2"
          sx={{
            fontSize: '12px',
            fontWeight: 'bold',
            color: '#2c3e50',
            textTransform: 'uppercase',
            pb: 0.5,
            mb: 1,
            borderBottom: '1.5px solid #3498db',
            letterSpacing: '0.3px',
          }}
        >
          Request Status & Vendor Information
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Box>
            <Typography variant="caption" sx={{ fontSize: '9.5px', fontWeight: 'bold', color: '#555', mb: 0.25 }}>
              Assigned Vendor:
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '10.5px', color: '#333', pb: 0.25, borderBottom: '0.5px solid #ddd' }}>
              {cleanText(requestData.vendor?.card_name || requestData.vendor_name || requestData.vendor?.name || 'Not assigned')}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ fontSize: '9.5px', fontWeight: 'bold', color: '#555', mb: 0.25 }}>
              Survey Date:
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '10.5px', color: '#333', pb: 0.25, borderBottom: '0.5px solid #ddd' }}>
              {formatDate(requestData.survey_date) || formatDate(new Date())}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Note: Footer/ending sign removed as per requirement */}
    </Box>
  );
}

