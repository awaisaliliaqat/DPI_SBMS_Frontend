import * as React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Autocomplete,
  TextField,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useApi } from '../hooks/useApi';
import { toast } from 'react-toastify';

const VendorAssignmentModal = ({ 
  open, 
  onClose, 
  onAssign, 
  dealerData,
  loading = false 
}) => {
  const { get } = useApi();
  const [vendors, setVendors] = React.useState([]);
  const [loadingVendors, setLoadingVendors] = React.useState(false);
  const [selectedVendor, setSelectedVendor] = React.useState(null);
  const [error, setError] = React.useState(null);

  // Load vendors from users table (SAP users)
  const loadVendors = React.useCallback(async () => {
    if (!open) return;
    
    setLoadingVendors(true);
    setError(null);
    
    try {
      const response = await get('/api/sap-users');
      if (response?.success && Array.isArray(response.data)) {
        setVendors(response.data);
        console.log('SAP vendors loaded:', response.data.length, 'vendors');
      } else {
        setVendors([]);
        setError('Failed to load vendors');
      }
    } catch (e) {
      console.error('Error loading vendors:', e);
      setError('Failed to load vendors');
      setVendors([]);
    } finally {
      setLoadingVendors(false);
    }
  }, [get, open]);

  // Load vendors when modal opens
  React.useEffect(() => {
    if (open) {
      loadVendors();
      setSelectedVendor(null);
    }
  }, [open, loadVendors]);

  const handleAssign = () => {
    if (!selectedVendor) {
      toast.error('Please select a vendor');
      return;
    }

    onAssign(selectedVendor);
  };

  const handleClose = () => {
    setSelectedVendor(null);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      aria-labelledby="vendor-assignment-dialog-title"
      PaperProps={{
        sx: {
          backgroundColor: '#ffffff',
          minWidth: '600px',
          maxWidth: '800px'
        }
      }}
    >
      <DialogTitle id="vendor-assignment-dialog-title" sx={{ fontWeight: 'bold' }}>
        Assign Vendor to Request
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {/* Dealer Information */}
          {dealerData && (
            <Box sx={{ p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
              <Typography variant="h6" gutterBottom>
                Dealer Information
              </Typography>
              <Typography variant="body2">
                <strong>Name:</strong> {dealerData.name}
              </Typography>
              <Typography variant="body2">
                <strong>Code:</strong> {dealerData.code}
              </Typography>
              <Typography variant="body2">
                <strong>City:</strong> {dealerData.city}
              </Typography>
              <Typography variant="body2">
                <strong>District:</strong> {dealerData.district}
              </Typography>
            </Box>
          )}

          {/* Error Message */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Vendor Selection */}
          <Autocomplete
            options={vendors}
            getOptionLabel={(option) => 
              `${option.card_name || option.username} (${option.region?.name || 'No Region'})`
            }
            isOptionEqualToValue={(option, value) => option.id === value.id}
            value={selectedVendor}
            onChange={(event, newValue) => {
              setSelectedVendor(newValue);
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label={`Select Vendor (${vendors.length} available)`}
                variant="outlined"
                required
                helperText="Choose a vendor to assign to this request"
              />
            )}
            loading={loadingVendors}
            loadingText="Loading vendors..."
            noOptionsText="No vendors available"
            disabled={loadingVendors}
          />

          {/* Selected Vendor Details */}
          {selectedVendor && (
            <Box sx={{ p: 2, backgroundColor: '#e3f2fd', borderRadius: 1 }}>
              <Typography variant="h6" gutterBottom>
                Selected Vendor Details
              </Typography>
              <Typography variant="body2">
                <strong>Vendor Code:</strong> {selectedVendor.username}
              </Typography>
              <Typography variant="body2">
                <strong>Vendor Name:</strong> {selectedVendor.card_name}
              </Typography>
              <Typography variant="body2">
                <strong>Region:</strong> {selectedVendor.region?.name || 'No Region'}
              </Typography>
              {selectedVendor.contact_person && (
                <Typography variant="body2">
                  <strong>Contact Person:</strong> {selectedVendor.contact_person}
                </Typography>
              )}
              {selectedVendor.cellular && (
                <Typography variant="body2">
                  <strong>Cellular:</strong> {selectedVendor.cellular}
                </Typography>
              )}
              {selectedVendor.phone && (
                <Typography variant="body2">
                  <strong>Phone:</strong> {selectedVendor.phone}
                </Typography>
              )}
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button 
          onClick={handleClose} 
          variant="outlined"
          disabled={loading}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleAssign} 
          variant="contained"
          disabled={!selectedVendor || loading}
          sx={{
            backgroundColor: '#1976d2',
            '&:hover': {
              backgroundColor: '#1565c0',
            }
          }}
        >
          {loading ? 'Assigning...' : 'Assign Vendor'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default VendorAssignmentModal;

