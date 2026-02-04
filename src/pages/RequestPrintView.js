import * as React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Box, Typography, CircularProgress, Alert, Button, Card, CardMedia, CardActionArea, Dialog, DialogContent, IconButton, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import VisibilityIcon from '@mui/icons-material/Visibility';
import GetAppIcon from '@mui/icons-material/GetApp';
import { BASE_URL } from '../constants/Constants';

export default function RequestPrintView() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [requestData, setRequestData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [galleryOpen, setGalleryOpen] = React.useState(false);
  const [galleryType, setGalleryType] = React.useState('site'); // 'site' | 'old'
  const [galleryIndex, setGalleryIndex] = React.useState(0);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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

  // Open file in new tab (must be before any early return - hooks rule)
  const openFileInNewTab = React.useCallback(async (url) => {
    if (!url) return;
    if (url.startsWith('data:')) {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      } catch (e) {
        console.error('Failed to open data URL:', e);
        window.open(url, '_blank');
      }
      return;
    }
    window.open(url, '_blank');
  }, []);

  // Download file (mobile-friendly: saves to device instead of opening in same tab)
  const downloadFile = React.useCallback(async (url, fileName) => {
    if (!url) return;
    const safeName = (fileName || 'document').replace(/[^\w.\-() ]/g, '_');
    const hasExtension = /\.[a-z0-9]+$/i.test(safeName);
    const ext = hasExtension ? '' : (url.toLowerCase().includes('pdf') || (url.startsWith('data:') && url.includes('pdf')) ? '.pdf' : '.bin');
    const downloadName = hasExtension ? safeName : `${safeName}${ext}`;
    if (url.startsWith('data:')) {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = downloadName;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      } catch (e) {
        console.error('Failed to download:', e);
        openFileInNewTab(url);
      }
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadName;
    a.rel = 'noopener';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [openFileInNewTab]);

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

  const normalizeUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) return url;
    let path = String(url).trim();
    if (!path.includes('/') && !path.includes('\\')) {
      if (path.includes('site_photo')) path = `uploads/site_photos/${path}`;
      else if (path.includes('old_board')) path = `uploads/old_board_photos/${path}`;
      else path = `uploads/${path}`;
    }
    if (!path.startsWith('/')) {
      if (path.startsWith('uploads/')) path = `/${path}`;
      else path = `/${path.startsWith('uploads/') ? path : 'uploads/' + path}`;
    }
    const baseUrl = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
    return `${baseUrl}${path}`;
  };

  // Normalize to array of { url, fileName } (API returns this from DB; legacy may be string or { path/url })
  const processFileArray = (arr, type = 'unknown') => {
    if (!arr || !Array.isArray(arr)) return [];
    return arr
      .filter(item => item)
      .map((item, idx) => {
        if (typeof item === 'string') {
          const url = item.startsWith('data:') ? item : normalizeUrl(item);
          const fileName = item.startsWith('data:') ? `File ${idx + 1}` : (item.split(/[/\\]/).pop() || `File ${idx + 1}`);
          return { url, fileName };
        }
        if (item && typeof item === 'object' && (item.url != null || item.path != null)) {
          const raw = item.url ?? item.path;
          const url = typeof raw === 'string' && !raw.startsWith('data:') && !raw.startsWith('http') ? normalizeUrl(raw) : raw;
          const fileName = item.fileName || (typeof raw === 'string' ? raw.split(/[/\\]/).pop() : null) || `File ${idx + 1}`;
          return { url, fileName };
        }
        return null;
      })
      .filter(Boolean);
  };

  const sitePhotos = processFileArray(requestData.site_photo_attachement, 'site_photos');
  const oldBoardPhotos = processFileArray(requestData.old_board_photo_attachment, 'old_board_photos');
  const surveyForms = processFileArray(requestData.survey_form_attachments, 'survey_forms');

  const isImageFile = (urlOrItem) => {
    const url = typeof urlOrItem === 'string' ? urlOrItem : (urlOrItem?.url || '');
    if (!url) return false;
    if (url.startsWith('data:')) {
      const m = url.match(/^data:([^;]+);/);
      return m && (m[1] || '').toLowerCase().startsWith('image/');
    }
    return /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(url.toLowerCase());
  };

  const getFileTypeLabel = (urlOrItem) => {
    const url = typeof urlOrItem === 'string' ? urlOrItem : (urlOrItem?.url || '');
    if (!url) return 'File';
    if (url.startsWith('data:')) {
      const m = url.match(/^data:([^/]+)\//);
      if (m && (m[1] || '').toLowerCase().startsWith('image')) return 'Image';
      if (m && (m[1] || '').toLowerCase().includes('pdf')) return 'PDF';
      return 'File';
    }
    const lower = url.toLowerCase();
    if (/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(lower)) return 'Image';
    if (/\.(pdf)$/i.test(lower)) return 'PDF';
    if (/\.(doc|docx)$/i.test(lower)) return 'Document';
    return 'File';
  };

  const openGallery = (type, index = 0) => {
    let items = [];
    if (type === 'old') items = oldBoardPhotos;
    else if (type === 'survey') items = surveyForms;
    else items = sitePhotos;
    if (!items || items.length === 0) return;
    const clicked = items[index];
    const clickedUrl = clicked?.url;
    if (clickedUrl && !isImageFile(clickedUrl)) {
      openFileInNewTab(clickedUrl);
      return;
    }
    const imageItems = items.filter(item => isImageFile(item.url));
    if (imageItems.length === 0) {
      if (items[0]?.url) openFileInNewTab(items[0].url);
      return;
    }
    const imageIndex = imageItems.findIndex(item => item === items[index]);
    setGalleryType(type);
    setGalleryIndex(imageIndex >= 0 ? imageIndex : 0);
    setGalleryOpen(true);
  };

  const closeGallery = () => setGalleryOpen(false);

  const getCurrentGalleryItems = () => {
    let items = [];
    if (galleryType === 'old') items = oldBoardPhotos;
    else if (galleryType === 'survey') items = surveyForms;
    else items = sitePhotos;
    return items.filter(item => isImageFile(item.url)).map(item => item.url);
  };

  const currentGalleryItems = getCurrentGalleryItems();
  
  const getGalleryTitle = () => {
    if (galleryType === 'old') return 'Old Board Photo';
    if (galleryType === 'survey') return 'Survey Form';
    return 'Site Photo';
  };

  const goPrev = () => {
    setGalleryIndex((prev) => (prev - 1 + currentGalleryItems.length) % currentGalleryItems.length);
  };

  const goNext = () => {
    setGalleryIndex((prev) => (prev + 1) % currentGalleryItems.length);
  };

  return (
    <>
    <Box
      sx={{
        fontFamily: 'Arial, sans-serif',
        lineHeight: 1.3,
        color: '#333',
        background: 'white',
        width: { xs: '100%', sm: '90%', md: '210mm' },
        maxWidth: { xs: '100%', md: '210mm' },
        margin: '0 auto',
        padding: { xs: '10px', sm: '15px' },
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
        <Typography variant="h4" sx={{ fontSize: { xs: '20px', sm: '24px' }, color: '#2c3e50', mb: 0.5, letterSpacing: '1.5px' }}>
          DIAMOND PAINTS
        </Typography>
        <Typography variant="h6" sx={{ fontSize: { xs: '12px', sm: '14px' }, color: '#7f8c8d', fontWeight: 'normal' }}>
          Request Details Report
        </Typography>
      </Box>

      {/* Dealer Information */}
      <Box sx={{ mb: 1.5 }}>
        <Typography
          variant="subtitle2"
          sx={{
            fontSize: { xs: '11px', sm: '12px' },
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
        {/* Table for dealer information - Horizontal layout */}
        <Box
          sx={{
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            mb: 1,
          }}
        >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: isMobile ? '9px' : '10.5px',
            marginBottom: '10px',
            minWidth: isMobile ? '600px' : 'auto',
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
                Dealer Name
              </th>
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
                Dealer Code
              </th>
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
                Phone
              </th>
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
                Dealer Type
              </th>
              <th
                style={{
                  padding: '8px 6px',
                  textAlign: 'left',
                  fontWeight: 'bold',
                  color: '#2c3e50',
                  fontSize: '10px',
                }}
              >
                Address
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              style={{
                borderBottom: '1px solid #e9ecef',
                backgroundColor: '#ffffff',
              }}
            >
              <td
                style={{
                  padding: '8px 6px',
                  borderRight: '1px solid #e9ecef',
                  color: '#333',
                }}
              >
                {cleanText(requestData.dealer?.name || 'N/A')}
              </td>
              <td
                style={{
                  padding: '8px 6px',
                  borderRight: '1px solid #e9ecef',
                  color: '#333',
                }}
              >
                {cleanText(requestData.dealer?.code || 'N/A')}
              </td>
              <td
                style={{
                  padding: '8px 6px',
                  borderRight: '1px solid #e9ecef',
                  color: '#333',
                }}
              >
                {formatPhone(requestData.dealer?.phone)}
              </td>
              <td
                style={{
                  padding: '8px 6px',
                  borderRight: '1px solid #e9ecef',
                  color: '#333',
                }}
              >
                {requestData.dealer_type === 'new' ? 'New Dealer' : 'Existing Dealer'}
              </td>
              <td
                style={{
                  padding: '8px 6px',
                  color: '#333',
                }}
              >
                {cleanText(requestData.dealer?.city || requestData.dealer?.address || 'N/A')}
              </td>
            </tr>
            {(() => {
              const hasParent = requestData?.dealer_relation?.parent && 
                                requestData?.dealer?.id && 
                                requestData.dealer.id !== requestData.dealer_relation.parent.id;
              if (hasParent && requestData.dealer_relation.parent) {
                const parent = requestData.dealer_relation.parent;
                return (
                  <tr
                    style={{
                      borderBottom: '1px solid #e9ecef',
                      backgroundColor: '#fff3e0',
                    }}
                  >
                    <td
                      colSpan={5}
                      style={{
                        padding: '6px 6px',
                        color: '#e65100',
                        fontWeight: 'bold',
                        fontSize: '10px',
                        borderBottom: '1px solid #ffcc80',
                      }}
                    >
                      Parent Dealer Information
                    </td>
                  </tr>
                );
              }
              return null;
            })()}
            {(() => {
              const hasParent = requestData?.dealer_relation?.parent && 
                                requestData?.dealer?.id && 
                                requestData.dealer.id !== requestData.dealer_relation.parent.id;
              if (hasParent && requestData.dealer_relation.parent) {
                const parent = requestData.dealer_relation.parent;
                return (
                  <tr
                    style={{
                      borderBottom: '1px solid #e9ecef',
                      backgroundColor: '#fff3e0',
                    }}
                  >
                    <td
                      style={{
                        padding: '8px 6px',
                        borderRight: '1px solid #e9ecef',
                        color: '#333',
                      }}
                    >
                      {cleanText(parent.name || 'N/A')}
                    </td>
                    <td
                      style={{
                        padding: '8px 6px',
                        borderRight: '1px solid #e9ecef',
                        color: '#333',
                      }}
                    >
                      {cleanText(parent.code || 'N/A')}
                    </td>
                    <td
                      style={{
                        padding: '8px 6px',
                        borderRight: '1px solid #e9ecef',
                        color: '#333',
                      }}
                    >
                      {formatPhone(parent.phone)}
                    </td>
                    <td
                      style={{
                        padding: '8px 6px',
                        borderRight: '1px solid #e9ecef',
                        color: '#333',
                      }}
                    >
                      -
                    </td>
                    <td
                      style={{
                        padding: '8px 6px',
                        color: '#333',
                      }}
                    >
                      {cleanText(parent.city || parent.address || 'N/A')}
                    </td>
                  </tr>
                );
              }
              return null;
            })()}
          </tbody>
        </table>
        </Box>
      </Box>

      {/* Request Items */}
      <Box sx={{ mb: 1.5 }}>
        <Typography
          variant="subtitle2"
          sx={{
            fontSize: { xs: '11px', sm: '12px' },
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
        <Box
          sx={{
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            mb: 1,
          }}
        >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: isMobile ? '9px' : '10.5px',
            marginBottom: '10px',
            minWidth: isMobile ? '600px' : 'auto',
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
        </Box>
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
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 2 }}>
          <Box>
            <Typography variant="caption" sx={{ fontSize: '9.5px', fontWeight: 'bold', color: '#555', mb: 0.25 }}>
              Assigned Vendor:
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '10.5px', color: '#333', pb: 0.25, borderBottom: '0.5px solid #ddd' }}>
              {cleanText(requestData.vendor?.card_name || requestData.vendor_name || requestData.vendor?.name || 'Not assigned')}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Attachments Section with View Buttons */}
      <Box sx={{ mt: 2 }}>
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
          Attachments
        </Typography>
        
        {/* Dealer Information for Attachments */}
        <Box
          sx={{
            mb: 2,
            p: 1.5,
            backgroundColor: '#f0f7ff',
            borderRadius: 1,
            border: '1px solid #b3d9ff',
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontSize: '10px',
              fontWeight: 'bold',
              color: '#1976d2',
              display: 'block',
              mb: 0.5,
            }}
          >
            📍 Attachments belong to:
          </Typography>
          <Typography
            variant="body2"
            sx={{
              fontSize: '11px',
              color: '#333',
              fontWeight: 600,
            }}
          >
            {(() => {
              const dealer = requestData.dealer;
              const dealerName = dealer?.name || 'N/A';
              const dealerCode = dealer?.code || 'N/A';
              return `${dealerName} (${dealerCode})`;
            })()}
          </Typography>
          {(() => {
            const hasParent = requestData?.dealer_relation?.parent && 
                              requestData?.dealer?.id && 
                              requestData.dealer.id !== requestData.dealer_relation.parent.id;
            if (hasParent && requestData.dealer_relation.parent) {
              const parent = requestData.dealer_relation.parent;
              return (
                <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid #d0e6ff' }}>
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: '10px',
                      fontWeight: 'bold',
                      color: '#7b1fa2',
                      display: 'block',
                      mb: 0.5,
                    }}
                  >
                    👤 Parent Dealer:
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      fontSize: '11px',
                      color: '#555',
                    }}
                  >
                    {parent.name || 'N/A'} ({parent.code || 'N/A'})
                  </Typography>
                </Box>
              );
            }
            return null;
          })()}
        </Box>
        
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 1.5,
            flexWrap: 'wrap',
          }}
        >
          {/* View Site Photos Button */}
          <Button
            variant="contained"
            startIcon={<VisibilityIcon />}
            onClick={() => {
              if (sitePhotos.length > 0) {
                const firstImageIndex = sitePhotos.findIndex(item => isImageFile(item.url));
                if (firstImageIndex >= 0) {
                  openGallery('site', firstImageIndex);
                } else {
                  openFileInNewTab(sitePhotos[0].url);
                }
              }
            }}
            disabled={sitePhotos.length === 0}
            sx={{
              flex: { xs: '1 1 100%', sm: '1 1 auto' },
              minWidth: { xs: '100%', sm: '140px' },
              py: 1.5,
              fontSize: '13px',
              fontWeight: 600,
              backgroundColor: '#1976d2',
              '&:hover': { backgroundColor: '#1565c0' },
              '&:disabled': { backgroundColor: '#e0e0e0', color: '#9e9e9e' },
            }}
          >
            View Site Photos ({sitePhotos.length})
          </Button>

          {/* View Survey Forms Button */}
          <Button
            variant="contained"
            startIcon={<VisibilityIcon />}
            onClick={() => {
              if (surveyForms.length > 0) {
                const firstImageIndex = surveyForms.findIndex(item => isImageFile(item.url));
                if (firstImageIndex >= 0) {
                  openGallery('survey', firstImageIndex);
                } else {
                  openFileInNewTab(surveyForms[0].url);
                }
              }
            }}
            disabled={surveyForms.length === 0}
            sx={{
              flex: { xs: '1 1 100%', sm: '1 1 auto' },
              minWidth: { xs: '100%', sm: '140px' },
              py: 1.5,
              fontSize: '13px',
              fontWeight: 600,
              backgroundColor: '#2e7d32',
              '&:hover': { backgroundColor: '#1b5e20' },
              '&:disabled': { backgroundColor: '#e0e0e0', color: '#9e9e9e' },
            }}
          >
            View Survey Forms ({surveyForms.length})
          </Button>

          {/* View Old Board Photos Button */}
          <Button
            variant="contained"
            startIcon={<VisibilityIcon />}
            onClick={() => {
              if (oldBoardPhotos.length > 0) {
                const firstImageIndex = oldBoardPhotos.findIndex(item => isImageFile(item.url));
                if (firstImageIndex >= 0) {
                  openGallery('old', firstImageIndex);
                } else {
                  openFileInNewTab(oldBoardPhotos[0].url);
                }
              }
            }}
            disabled={oldBoardPhotos.length === 0}
            sx={{
              flex: { xs: '1 1 100%', sm: '1 1 auto' },
              minWidth: { xs: '100%', sm: '140px' },
              py: 1.5,
              fontSize: '13px',
              fontWeight: 600,
              backgroundColor: '#9c27b0',
              '&:hover': { backgroundColor: '#7b1fa2' },
              '&:disabled': { backgroundColor: '#e0e0e0', color: '#9e9e9e' },
            }}
          >
            View Old Board Photos ({oldBoardPhotos.length})
          </Button>
        </Box>

        {/* File List with Individual Links – Open in new tab + Download (mobile-friendly) */}
        {(sitePhotos.length > 0 || surveyForms.length > 0 || oldBoardPhotos.length > 0) && (
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e0e0e0' }}>
            <Typography variant="caption" sx={{ fontSize: '10px', fontWeight: 'bold', color: '#666', mb: 0.5, display: 'block' }}>
              Individual files – tap to open in new tab or use ↓ to download:
            </Typography>
            <Typography variant="caption" sx={{ fontSize: '9px', color: '#999', mb: 1, display: 'block', fontStyle: 'italic' }}>
              All files belong to: {requestData.dealer?.name || 'N/A'} ({requestData.dealer?.code || 'N/A'})
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {sitePhotos.map((file, idx) => (
                <Box
                  key={`site-file-${idx}`}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    border: '1px solid #1976d2',
                    borderRadius: 1,
                    overflow: 'hidden',
                    '&:hover': { backgroundColor: '#e3f2fd' },
                  }}
                >
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => openFileInNewTab(file.url)}
                    sx={{
                      flex: 1,
                      justifyContent: 'flex-start',
                      textTransform: 'none',
                      fontSize: '11px',
                      py: 0.75,
                      px: 1,
                      color: '#1976d2',
                      minWidth: 0,
                    }}
                  >
                    📷 Site Photo {idx + 1} ({file.fileName || getFileTypeLabel(file.url)})
                  </Button>
                  <IconButton
                    size="small"
                    onClick={() => downloadFile(file.url, file.fileName || `site-photo-${idx + 1}`)}
                    sx={{ color: '#1976d2', mr: 0.25 }}
                    title="Download"
                    aria-label="Download file"
                  >
                    <GetAppIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
              {surveyForms.map((file, idx) => (
                <Box
                  key={`survey-file-${idx}`}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    border: '1px solid #2e7d32',
                    borderRadius: 1,
                    overflow: 'hidden',
                    '&:hover': { backgroundColor: '#e8f5e9' },
                  }}
                >
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => openFileInNewTab(file.url)}
                    sx={{
                      flex: 1,
                      justifyContent: 'flex-start',
                      textTransform: 'none',
                      fontSize: '11px',
                      py: 0.75,
                      px: 1,
                      color: '#2e7d32',
                      minWidth: 0,
                    }}
                  >
                    📄 Survey Form {idx + 1} ({file.fileName || getFileTypeLabel(file.url)})
                  </Button>
                  <IconButton
                    size="small"
                    onClick={() => downloadFile(file.url, file.fileName || `survey-form-${idx + 1}`)}
                    sx={{ color: '#2e7d32', mr: 0.25 }}
                    title="Download"
                    aria-label="Download file"
                  >
                    <GetAppIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
              {oldBoardPhotos.map((file, idx) => (
                <Box
                  key={`old-file-${idx}`}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    border: '1px solid #9c27b0',
                    borderRadius: 1,
                    overflow: 'hidden',
                    '&:hover': { backgroundColor: '#f3e5f5' },
                  }}
                >
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => openFileInNewTab(file.url)}
                    sx={{
                      flex: 1,
                      justifyContent: 'flex-start',
                      textTransform: 'none',
                      fontSize: '11px',
                      py: 0.75,
                      px: 1,
                      color: '#9c27b0',
                      minWidth: 0,
                    }}
                  >
                    🖼️ Old Board Photo {idx + 1} ({file.fileName || getFileTypeLabel(file.url)})
                  </Button>
                  <IconButton
                    size="small"
                    onClick={() => downloadFile(file.url, file.fileName || `old-board-${idx + 1}`)}
                    sx={{ color: '#9c27b0', mr: 0.25 }}
                    title="Download"
                    aria-label="Download file"
                  >
                    <GetAppIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Box>

      {/* Note: Footer/ending sign removed as per requirement */}
    </Box>

    {/* Image Gallery Modal */}
    <Dialog
      open={galleryOpen && currentGalleryItems.length > 0}
      onClose={closeGallery}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: { backgroundColor: '#0c0c0c', color: '#fff', position: 'relative' }
      }}
    >
      <DialogContent sx={{ p: 0, position: 'relative' }}>
        <IconButton
          onClick={closeGallery}
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            color: '#fff',
            zIndex: 2,
            background: 'rgba(0,0,0,0.35)',
            '&:hover': { background: 'rgba(0,0,0,0.5)' }
          }}
        >
          <CloseIcon />
        </IconButton>

        {currentGalleryItems.length > 1 && (
          <IconButton
            onClick={goPrev}
            sx={{
              position: 'absolute',
              top: '50%',
              left: 8,
              transform: 'translateY(-50%)',
              color: '#fff',
              zIndex: 2,
              background: 'rgba(0,0,0,0.35)',
              '&:hover': { background: 'rgba(0,0,0,0.5)' }
            }}
          >
            <ArrowBackIosNewIcon fontSize="small" />
          </IconButton>
        )}

        {currentGalleryItems.length > 1 && (
          <IconButton
            onClick={goNext}
            sx={{
              position: 'absolute',
              top: '50%',
              right: 8,
              transform: 'translateY(-50%)',
              color: '#fff',
              zIndex: 2,
              background: 'rgba(0,0,0,0.35)',
              '&:hover': { background: 'rgba(0,0,0,0.5)' }
            }}
          >
            <ArrowForwardIosIcon fontSize="small" />
          </IconButton>
        )}

        <Box
          sx={{
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            background: '#000',
            minHeight: '60vh',
          }}
        >
          {currentGalleryItems.length > 0 && (
            <img
              src={currentGalleryItems[galleryIndex]}
              alt="Attachment"
              style={{
                maxWidth: '100%',
                maxHeight: isMobile ? '70vh' : '80vh',
                objectFit: 'contain',
                backgroundColor: '#222',
              }}
              onError={(e) => {
                console.error('Failed to load gallery image:', currentGalleryItems[galleryIndex]);
                e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%25" height="100%25" fill="%23222222"/><text x="50%25" y="45%25" dominant-baseline="middle" text-anchor="middle" fill="%23aaaaaa" font-size="16" font-family="Arial">Image not available</text><text x="50%25" y="55%25" dominant-baseline="middle" text-anchor="middle" fill="%23666" font-size="12" font-family="Arial">Failed to load image</text></svg>';
              }}
              crossOrigin="anonymous"
            />
          )}
        </Box>

        <Box sx={{ p: 1.5, background: '#111', textAlign: 'center', color: '#ccc', fontSize: '13px' }}>
          {currentGalleryItems.length > 0 ? `${galleryIndex + 1} / ${currentGalleryItems.length}` : ''}
          <Box sx={{ mt: 0.5, fontWeight: 600 }}>
            {getGalleryTitle()}
          </Box>
          <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid #333', fontSize: '11px', color: '#aaa' }}>
            Dealer: {requestData.dealer?.name || 'N/A'} ({requestData.dealer?.code || 'N/A'})
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
    </>
  );
}

