import * as React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Box, Typography, CircularProgress, Alert, Button, Card, CardMedia, CardActionArea, Dialog, DialogContent, IconButton, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import VisibilityIcon from '@mui/icons-material/Visibility';
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
    
    // If already a full URL, return as is
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    
    // Handle different path formats
    let path = String(url).trim();
    
    // If it's just a filename (no slashes), assume it's in uploads directory
    if (!path.includes('/') && !path.includes('\\')) {
      // Try to determine which subdirectory based on filename pattern
      if (path.includes('site_photo')) {
        path = `uploads/site_photos/${path}`;
      } else if (path.includes('old_board')) {
        path = `uploads/old_board_photos/${path}`;
      } else {
        path = `uploads/${path}`;
      }
    }
    
    // If path already starts with uploads/, ensure it has leading slash
    if (path.startsWith('uploads/') && !path.startsWith('/uploads/')) {
      path = `/${path}`;
    }
    
    // If path doesn't start with /uploads/, add it
    if (!path.startsWith('/uploads/')) {
      // Remove leading slash if present
      if (path.startsWith('/')) {
        path = path.slice(1);
      }
      // Add /uploads/ prefix if not already there
      if (!path.startsWith('uploads/')) {
        path = `uploads/${path}`;
      }
      path = `/${path}`;
    }
    
    // Ensure BASE_URL doesn't have trailing slash
    const baseUrl = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
    
    const fullUrl = `${baseUrl}${path}`;
    
    // Debug logging (remove in production)
    if (process.env.NODE_ENV === 'development') {
      console.log('Normalized URL:', { original: url, normalized: fullUrl });
    }
    
    return fullUrl;
  };

  // Process arrays - handle both string arrays and already processed arrays
  const processImageArray = (arr, type = 'unknown') => {
    if (!arr || !Array.isArray(arr)) {
      console.log(`[${type}] No array or empty:`, arr);
      return [];
    }
    const processed = arr
      .filter(item => item) // Remove null/undefined
      .map(item => {
        // If item is already a string, normalize it
        if (typeof item === 'string') {
          const normalized = normalizeUrl(item);
          console.log(`[${type}] Original:`, item, '→ Normalized:', normalized);
          return normalized;
        }
        // If it's an object with a path/url property, use that
        if (item && typeof item === 'object' && (item.path || item.url)) {
          const normalized = normalizeUrl(item.path || item.url);
          console.log(`[${type}] Object item:`, item, '→ Normalized:', normalized);
          return normalized;
        }
        console.warn(`[${type}] Unhandled item type:`, item);
        return '';
      })
      .filter(url => url); // Remove empty strings
    
    console.log(`[${type}] Final processed URLs (${processed.length} items):`, processed);
    return processed;
  };

  console.log('=== Image URL Processing ===');
  console.log('BASE_URL:', BASE_URL);
  console.log('Raw site_photo_attachement:', requestData.site_photo_attachement);
  console.log('Raw old_board_photo_attachment:', requestData.old_board_photo_attachment);
  
  const sitePhotos = processImageArray(requestData.site_photo_attachement, 'site_photos');
  const oldBoardPhotos = processImageArray(requestData.old_board_photo_attachment, 'old_board_photos');
  const surveyForms = processImageArray(requestData.survey_form_attachments, 'survey_forms');
  
  console.log('=== Final Image Arrays ===');
  console.log('Site Photos URLs:', sitePhotos);
  console.log('Old Board Photos URLs:', oldBoardPhotos);
  console.log('Survey Forms URLs:', surveyForms);

  // Helper to check if file is an image
  const isImageFile = (url) => {
    if (!url) return false;
    const lowerUrl = url.toLowerCase();
    return /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(lowerUrl);
  };

  // Helper to get file type label
  const getFileTypeLabel = (url) => {
    if (!url) return 'File';
    const lowerUrl = url.toLowerCase();
    if (/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(lowerUrl)) return 'Image';
    if (/\.(pdf)$/i.test(lowerUrl)) return 'PDF';
    if (/\.(doc|docx)$/i.test(lowerUrl)) return 'Document';
    return 'File';
  };

  const openGallery = (type, index = 0) => {
    let items = [];
    if (type === 'old') {
      items = oldBoardPhotos;
    } else if (type === 'survey') {
      items = surveyForms;
    } else {
      items = sitePhotos;
    }
    
    if (!items || items.length === 0) return;
    
    // Check if the clicked item is an image
    const clickedItem = items[index];
    if (clickedItem && !isImageFile(clickedItem)) {
      // If clicked item is not an image, open in new tab
      window.open(clickedItem, '_blank');
      return;
    }
    
    // Filter to only show images in gallery (non-images will open in new tab)
    const imageItems = items.filter(item => isImageFile(item));
    if (imageItems.length === 0) {
      // If no images, open first item in new tab
      if (items[0]) {
        window.open(items[0], '_blank');
      }
      return;
    }
    
    // Find the index in the filtered image array
    const imageIndex = imageItems.findIndex(item => item === items[index]);
    
    setGalleryType(type);
    setGalleryIndex(imageIndex >= 0 ? imageIndex : 0);
    setGalleryOpen(true);
  };

  const closeGallery = () => {
    setGalleryOpen(false);
  };

  const getCurrentGalleryItems = () => {
    if (galleryType === 'old') {
      return oldBoardPhotos.filter(item => isImageFile(item));
    } else if (galleryType === 'survey') {
      return surveyForms.filter(item => isImageFile(item));
    } else {
      return sitePhotos.filter(item => isImageFile(item));
    }
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
                const firstImageIndex = sitePhotos.findIndex(item => isImageFile(item));
                if (firstImageIndex >= 0) {
                  openGallery('site', firstImageIndex);
                } else {
                  // If no images, open first file in new tab
                  window.open(sitePhotos[0], '_blank');
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
                const firstImageIndex = surveyForms.findIndex(item => isImageFile(item));
                if (firstImageIndex >= 0) {
                  openGallery('survey', firstImageIndex);
                } else {
                  // If no images, open first file in new tab
                  window.open(surveyForms[0], '_blank');
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
                const firstImageIndex = oldBoardPhotos.findIndex(item => isImageFile(item));
                if (firstImageIndex >= 0) {
                  openGallery('old', firstImageIndex);
                } else {
                  // If no images, open first file in new tab
                  window.open(oldBoardPhotos[0], '_blank');
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

        {/* File List with Individual Links for Non-Images */}
        {(sitePhotos.length > 0 || surveyForms.length > 0 || oldBoardPhotos.length > 0) && (
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e0e0e0' }}>
            <Typography variant="caption" sx={{ fontSize: '10px', fontWeight: 'bold', color: '#666', mb: 0.5, display: 'block' }}>
              Individual Files (Click to open in new tab):
            </Typography>
            <Typography variant="caption" sx={{ fontSize: '9px', color: '#999', mb: 1, display: 'block', fontStyle: 'italic' }}>
              All files belong to: {requestData.dealer?.name || 'N/A'} ({requestData.dealer?.code || 'N/A'})
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {sitePhotos.map((file, idx) => (
                <Button
                  key={`site-file-${idx}`}
                  size="small"
                  variant="outlined"
                  onClick={() => window.open(file, '_blank')}
                  sx={{
                    justifyContent: 'flex-start',
                    textTransform: 'none',
                    fontSize: '11px',
                    py: 0.5,
                    px: 1,
                    borderColor: '#1976d2',
                    color: '#1976d2',
                    '&:hover': { borderColor: '#1565c0', backgroundColor: '#e3f2fd' },
                  }}
                >
                  📷 Site Photo {idx + 1} ({getFileTypeLabel(file)})
                </Button>
              ))}
              {surveyForms.map((file, idx) => (
                <Button
                  key={`survey-file-${idx}`}
                  size="small"
                  variant="outlined"
                  onClick={() => window.open(file, '_blank')}
                  sx={{
                    justifyContent: 'flex-start',
                    textTransform: 'none',
                    fontSize: '11px',
                    py: 0.5,
                    px: 1,
                    borderColor: '#2e7d32',
                    color: '#2e7d32',
                    '&:hover': { borderColor: '#1b5e20', backgroundColor: '#e8f5e9' },
                  }}
                >
                  📄 Survey Form {idx + 1} ({getFileTypeLabel(file)})
                </Button>
              ))}
              {oldBoardPhotos.map((file, idx) => (
                <Button
                  key={`old-file-${idx}`}
                  size="small"
                  variant="outlined"
                  onClick={() => window.open(file, '_blank')}
                  sx={{
                    justifyContent: 'flex-start',
                    textTransform: 'none',
                    fontSize: '11px',
                    py: 0.5,
                    px: 1,
                    borderColor: '#9c27b0',
                    color: '#9c27b0',
                    '&:hover': { borderColor: '#7b1fa2', backgroundColor: '#f3e5f5' },
                  }}
                >
                  🖼️ Old Board Photo {idx + 1} ({getFileTypeLabel(file)})
                </Button>
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

