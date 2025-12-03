import * as React from 'react';
import {
  Box,
  Autocomplete,
  TextField,
  Grid,
  Chip,
  CircularProgress,
} from '@mui/material';
import { STATUS_OPTIONS, getStatusDisplayName } from '../constants/ShopboardRequestStatus';
import { useApi } from '../hooks/useApi';

const ShopboardRequestFilters = ({ 
  onFilterChange,
  loading = false 
}) => {
  const [selectedVendor, setSelectedVendor] = React.useState(null);
  const [selectedStatus, setSelectedStatus] = React.useState(null);
  const [vendors, setVendors] = React.useState([]);
  const [loadingVendors, setLoadingVendors] = React.useState(false);
  const { get } = useApi();

  // Fetch vendors from API
  React.useEffect(() => {
    const fetchVendors = async () => {
      setLoadingVendors(true);
      try {
        const response = await get('/api/users/vendors');
        if (response.success && Array.isArray(response.data)) {
          // Transform vendors to include user_id for filtering
          const transformedVendors = response.data.map(vendor => ({
            id: vendor.user_id, // Use user_id for filtering (matches vendor_code in shopboard_requests)
            name: vendor.name || 'Unknown Vendor',
            user_id: vendor.user_id
          }));
          setVendors(transformedVendors);
        }
      } catch (error) {
        console.error('Error fetching vendors:', error);
        setVendors([]);
      } finally {
        setLoadingVendors(false);
      }
    };

    fetchVendors();
  }, [get]);

  // Get statuses from constants
  const statuses = React.useMemo(() => {
    return STATUS_OPTIONS.map(status => ({
      value: status.value,
      label: status.label
    })).sort((a, b) => a.label.localeCompare(b.label));
  }, []);

  // Apply filters when selections change
  React.useEffect(() => {
    if (onFilterChange) {
      onFilterChange({
        vendor: selectedVendor,
        status: selectedStatus
      });
    }
  }, [selectedVendor, selectedStatus, onFilterChange]);

  const handleClearFilters = () => {
    setSelectedVendor(null);
    setSelectedStatus(null);
  };

  const hasActiveFilters = selectedVendor !== null || selectedStatus !== null;

  return (
    <Box sx={{ mb: 2 }}>
      <Grid container spacing={2} alignItems="center">
        {/* Vendor Name Filter */}
        <Grid item xs={12} sm={6} md={5}>
          <Autocomplete
            size="small"
            options={vendors}
            getOptionLabel={(option) => option.name || ''}
            value={selectedVendor}
            onChange={(event, newValue) => {
              setSelectedVendor(newValue);
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Vendor"
                placeholder="Search vendor..."
                variant="outlined"
                fullWidth
                disabled={loading}
              />
            )}
            isOptionEqualToValue={(option, value) => option.id === value?.id}
            noOptionsText="No vendors found"
            loading={loadingVendors}
            componentsProps={{
              popper: {
                style: { zIndex: 1300 },
                placement: 'bottom-start'
              }
            }}
          />
        </Grid>

        {/* Status Filter */}
        <Grid item xs={12} sm={6} md={5}>
          <Autocomplete
            size="small"
            options={statuses}
            getOptionLabel={(option) => option.label || ''}
            value={selectedStatus}
            onChange={(event, newValue) => {
              setSelectedStatus(newValue);
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Status"
                placeholder="Select status..."
                variant="outlined"
                fullWidth
                disabled={loading}
              />
            )}
            isOptionEqualToValue={(option, value) => option.value === value?.value}
            noOptionsText="No statuses found"
            loading={false}
            componentsProps={{
              popper: {
                style: { zIndex: 1301 },
                placement: 'bottom-start'
              }
            }}
          />
        </Grid>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <Grid item xs={12} sm={12} md={2}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
              {selectedVendor && (
                <Chip
                  label={`Vendor: ${selectedVendor.name}`}
                  onDelete={() => setSelectedVendor(null)}
                  color="primary"
                  variant="outlined"
                  size="small"
                />
              )}
              {selectedStatus && (
                <Chip
                  label={`Status: ${selectedStatus.label}`}
                  onDelete={() => setSelectedStatus(null)}
                  color="secondary"
                  variant="outlined"
                  size="small"
                />
              )}
              {(selectedVendor || selectedStatus) && (
                <Chip
                  label="Clear All"
                  onClick={handleClearFilters}
                  color="default"
                  variant="outlined"
                  size="small"
                  sx={{ 
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: '#f5f5f5',
                    }
                  }}
                />
              )}
            </Box>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default ShopboardRequestFilters;

