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
  const [selectedRegion, setSelectedRegion] = React.useState(null);
  const [selectedParentDealer, setSelectedParentDealer] = React.useState(null);
  const [selectedChildDealer, setSelectedChildDealer] = React.useState(null);
  const [startDate, setStartDate] = React.useState(null);
  const [endDate, setEndDate] = React.useState(null);
  const [vendors, setVendors] = React.useState([]);
  const [regions, setRegions] = React.useState([]);
  const [parentDealers, setParentDealers] = React.useState([]);
  const [childDealers, setChildDealers] = React.useState([]);
  const [loadingVendors, setLoadingVendors] = React.useState(false);
  const [loadingRegions, setLoadingRegions] = React.useState(false);
  const [loadingParentDealers, setLoadingParentDealers] = React.useState(false);
  const [loadingChildDealers, setLoadingChildDealers] = React.useState(false);
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

  // Fetch regions from API
  React.useEffect(() => {
    const fetchRegions = async () => {
      setLoadingRegions(true);
      try {
        const response = await get('/api/regions');
        if (response.success && Array.isArray(response.data)) {
          setRegions(response.data);
        }
      } catch (error) {
        console.error('Error fetching regions:', error);
        setRegions([]);
      } finally {
        setLoadingRegions(false);
      }
    };

    fetchRegions();
  }, [get]);

  // Get statuses from constants
  const statuses = React.useMemo(() => {
    return STATUS_OPTIONS.map(status => ({
      value: status.value,
      label: status.label
    })).sort((a, b) => a.label.localeCompare(b.label));
  }, []);

  // Fetch parent dealers when region is selected
  React.useEffect(() => {
    if (selectedRegion) {
      const fetchParentDealers = async () => {
        setLoadingParentDealers(true);
        setParentDealers([]);
        setSelectedParentDealer(null);
        setSelectedChildDealer(null);
        setChildDealers([]);
        try {
          const response = await get(`/api/dealers/by-region/parents?region=${encodeURIComponent(selectedRegion.name)}`);
          if (response.success && Array.isArray(response.data)) {
            setParentDealers(response.data);
          }
        } catch (error) {
          console.error('Error fetching parent dealers:', error);
          setParentDealers([]);
        } finally {
          setLoadingParentDealers(false);
        }
      };

      fetchParentDealers();
    } else {
      // Clear parent and child dealers when region is cleared
      setParentDealers([]);
      setSelectedParentDealer(null);
      setChildDealers([]);
      setSelectedChildDealer(null);
    }
  }, [selectedRegion, get]);

  // Fetch child dealers when parent dealer is selected
  React.useEffect(() => {
    if (selectedParentDealer) {
      const fetchChildDealers = async () => {
        setLoadingChildDealers(true);
        setChildDealers([]);
        setSelectedChildDealer(null);
        try {
          const response = await get(`/api/dealers/by-region/children?parent_code=${encodeURIComponent(selectedParentDealer.code)}`);
          if (response.success && Array.isArray(response.data)) {
            setChildDealers(response.data);
          }
        } catch (error) {
          console.error('Error fetching child dealers:', error);
          setChildDealers([]);
        } finally {
          setLoadingChildDealers(false);
        }
      };

      fetchChildDealers();
    } else {
      // Clear child dealers when parent is cleared
      setChildDealers([]);
      setSelectedChildDealer(null);
    }
  }, [selectedParentDealer, get]);

  // Apply filters when selections change
  React.useEffect(() => {
    if (onFilterChange) {
      onFilterChange({
        vendor: selectedVendor,
        status: selectedStatus,
        region: selectedRegion,
        parentDealer: selectedParentDealer,
        childDealer: selectedChildDealer,
        startDate: startDate,
        endDate: endDate
      });
    }
  }, [selectedVendor, selectedStatus, selectedRegion, selectedParentDealer, selectedChildDealer, startDate, endDate, onFilterChange]);

  const handleClearFilters = () => {
    setSelectedVendor(null);
    setSelectedStatus(null);
    setSelectedRegion(null);
    setSelectedParentDealer(null);
    setSelectedChildDealer(null);
    setStartDate(null);
    setEndDate(null);
  };

  const hasActiveFilters = selectedVendor !== null || selectedStatus !== null || selectedRegion !== null || selectedParentDealer !== null || selectedChildDealer !== null || startDate !== null || endDate !== null;

  return (
    <Box sx={{ mb: 2, p: 2, backgroundColor: '#f8f9fa', borderRadius: 2, border: '1px solid #e0e0e0' }}>
      <Grid container spacing={2} alignItems="center">
        {/* Vendor Name Filter */}
        <Grid item xs={12} sm={6} md={3}>
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
        <Grid item xs={12} sm={6} md={3}>
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

        {/* Region Filter */}
        <Grid item xs={12} sm={6} md={3}>
          <Autocomplete
            size="small"
            options={regions}
            getOptionLabel={(option) => option.code ? `${option.name} (${option.code})` : option.name || ''}
            value={selectedRegion}
            onChange={(event, newValue) => {
              setSelectedRegion(newValue);
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Region"
                placeholder="Select region..."
                variant="outlined"
                fullWidth
                disabled={loading}
              />
            )}
            isOptionEqualToValue={(option, value) => option.id === value?.id}
            noOptionsText="No regions found"
            loading={loadingRegions}
            componentsProps={{
              popper: {
                style: { zIndex: 1302 },
                placement: 'bottom-start'
              }
            }}
          />
        </Grid>

        {/* Parent Dealer Filter - Only enabled when region is selected */}
        <Grid item xs={12} sm={6} md={3}>
          <Autocomplete
            size="small"
            options={parentDealers}
            getOptionLabel={(option) => option.name || option.code || ''}
            value={selectedParentDealer}
            onChange={(event, newValue) => {
              setSelectedParentDealer(newValue);
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Parent Dealer"
                placeholder={selectedRegion ? "Select parent dealer..." : "Select region first"}
                variant="outlined"
                fullWidth
                disabled={loading || !selectedRegion}
              />
            )}
            isOptionEqualToValue={(option, value) => option.code === value?.code}
            noOptionsText={selectedRegion ? "No parent dealers found" : "Select region first"}
            loading={loadingParentDealers}
            componentsProps={{
              popper: {
                style: { zIndex: 1303 },
                placement: 'bottom-start'
              }
            }}
          />
        </Grid>

        {/* Child Dealer Filter - Only enabled when parent dealer is selected */}
        <Grid item xs={12} sm={6} md={3}>
          <Autocomplete
            size="small"
            options={childDealers}
            getOptionLabel={(option) => option.name || option.code || ''}
            value={selectedChildDealer}
            onChange={(event, newValue) => {
              setSelectedChildDealer(newValue);
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Child Dealer"
                placeholder={selectedParentDealer ? "Select child dealer..." : "Select parent dealer first"}
                variant="outlined"
                fullWidth
                disabled={loading || !selectedParentDealer}
              />
            )}
            isOptionEqualToValue={(option, value) => option.code === value?.code}
            noOptionsText={selectedParentDealer ? "No child dealers found" : "Select parent dealer first"}
            loading={loadingChildDealers}
            componentsProps={{
              popper: {
                style: { zIndex: 1304 },
                placement: 'bottom-start'
              }
            }}
          />
        </Grid>

        {/* Start Date Filter */}
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            size="small"
            label="Start Date"
            type="date"
            value={startDate || ''}
            onChange={(e) => setStartDate(e.target.value || null)}
            variant="outlined"
            fullWidth
            disabled={loading}
            InputLabelProps={{
              shrink: true,
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#ffffff',
              }
            }}
          />
        </Grid>

        {/* End Date Filter */}
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            size="small"
            label="End Date"
            type="date"
            value={endDate || ''}
            onChange={(e) => setEndDate(e.target.value || null)}
            variant="outlined"
            fullWidth
            disabled={loading}
            InputLabelProps={{
              shrink: true,
            }}
            inputProps={{
              min: startDate || undefined
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#ffffff',
              }
            }}
          />
        </Grid>
      </Grid>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mt: 2 }}>
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
              {selectedRegion && (
                <Chip
                  label={`Region: ${selectedRegion.code ? `${selectedRegion.name} (${selectedRegion.code})` : selectedRegion.name}`}
                  onDelete={() => setSelectedRegion(null)}
                  color="info"
                  variant="outlined"
                  size="small"
                />
              )}
              {selectedParentDealer && (
                <Chip
                  label={`Parent: ${selectedParentDealer.name || selectedParentDealer.code}`}
                  onDelete={() => setSelectedParentDealer(null)}
                  color="warning"
                  variant="outlined"
                  size="small"
                />
              )}
              {selectedChildDealer && (
                <Chip
                  label={`Child: ${selectedChildDealer.name || selectedChildDealer.code}`}
                  onDelete={() => setSelectedChildDealer(null)}
                  color="success"
                  variant="outlined"
                  size="small"
                />
              )}
              {startDate && (
                <Chip
                  label={`From: ${new Date(startDate).toLocaleDateString()}`}
                  onDelete={() => setStartDate(null)}
                  color="info"
                  variant="outlined"
                  size="small"
                />
              )}
              {endDate && (
                <Chip
                  label={`To: ${new Date(endDate).toLocaleDateString()}`}
                  onDelete={() => setEndDate(null)}
                  color="info"
                  variant="outlined"
                  size="small"
                />
              )}
              {(selectedVendor || selectedStatus || selectedRegion || selectedParentDealer || selectedChildDealer || startDate || endDate) && (
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
      )}
    </Box>
  );
};

export default ShopboardRequestFilters;

