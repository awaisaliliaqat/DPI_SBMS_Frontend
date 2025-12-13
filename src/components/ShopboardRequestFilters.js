import * as React from 'react';
import {
  Box,
  Autocomplete,
  TextField,
  Grid,
  Chip,
  CircularProgress,
  Typography,
  Button,
  IconButton,
  Popover,
  Paper,
} from '@mui/material';
import {
  Business as VendorIcon,
  CheckCircle as StatusIcon,
  LocationOn as RegionIcon,
  AccountTree as ParentDealerIcon,
  Person as ChildDealerIcon,
  CalendarToday as DateIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
  Close as CloseIcon,
  Group as SalesHeadIcon,
} from '@mui/icons-material';
import { useApi } from '../hooks/useApi';

const ShopboardRequestFilters = ({ 
  onFilterChange,
  loading = false,
  filteredCount = 0,
  showFilteredCount = false
}) => {
  const [selectedVendor, setSelectedVendor] = React.useState(null);
  const [selectedStatus, setSelectedStatus] = React.useState(null);
  const [selectedRegion, setSelectedRegion] = React.useState(null);
  const [selectedParentDealer, setSelectedParentDealer] = React.useState(null);
  const [selectedChildDealer, setSelectedChildDealer] = React.useState(null);
  const [selectedSalesHead, setSelectedSalesHead] = React.useState(null);
  const [startDate, setStartDate] = React.useState(null);
  const [endDate, setEndDate] = React.useState(null);
  const [dateRangeAnchor, setDateRangeAnchor] = React.useState(null);
  const [vendors, setVendors] = React.useState([]);
  const [regions, setRegions] = React.useState([]);
  const [parentDealers, setParentDealers] = React.useState([]);
  const [childDealers, setChildDealers] = React.useState([]);
  const [salesHeads, setSalesHeads] = React.useState([]);
  const [statuses, setStatuses] = React.useState([]);
  const [loadingVendors, setLoadingVendors] = React.useState(false);
  const [loadingRegions, setLoadingRegions] = React.useState(false);
  const [loadingParentDealers, setLoadingParentDealers] = React.useState(false);
  const [loadingChildDealers, setLoadingChildDealers] = React.useState(false);
  const [loadingSalesHeads, setLoadingSalesHeads] = React.useState(false);
  const [loadingStatuses, setLoadingStatuses] = React.useState(false);
  const { get } = useApi();

  // Fetch vendors from API
  React.useEffect(() => {
    const fetchVendors = async () => {
      setLoadingVendors(true);
      try {
        const response = await get('/api/users/vendors');
        if (response.success && Array.isArray(response.data)) {
          // Transform vendors to include user_id for filtering
          // API returns: { id: username (CardCode), name: card_name, user_id: user.id }
          const transformedVendors = response.data.map(vendor => ({
            id: vendor.user_id, // Use user_id for filtering (matches vendor_code in shopboard_requests)
            name: vendor.name || 'Unknown Vendor', // card_name from API
            username: vendor.id || '', // username (CardCode) from API - this is the 'id' field in API response
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

  // Fetch statuses from API
  React.useEffect(() => {
    const fetchStatuses = async () => {
      setLoadingStatuses(true);
      try {
        const response = await get('/api/shopboard-requests/statuses');
        if (response.success && Array.isArray(response.data)) {
          // Transform API response to match filter format
          // Maintain the order from API (no sorting) - slug is used for filtering, displayName for display
          const transformedStatuses = response.data.map(status => ({
            value: status.slug, // slug is the original status name (used for backend filtering)
            label: status.displayName // displayName is the human-readable name (shown in dropdown)
          }));
          setStatuses(transformedStatuses);
        }
      } catch (error) {
        console.error('Error fetching statuses:', error);
        setStatuses([]);
      } finally {
        setLoadingStatuses(false);
      }
    };

    fetchStatuses();
  }, [get]);

  // Fetch sales heads from API
  React.useEffect(() => {
    const fetchSalesHeads = async () => {
      setLoadingSalesHeads(true);
      try {
        const response = await get('/api/all-areaheads');
        if (response.success && Array.isArray(response.data)) {
          setSalesHeads(response.data);
        }
      } catch (error) {
        console.error('Error fetching sales heads:', error);
        setSalesHeads([]);
      } finally {
        setLoadingSalesHeads(false);
      }
    };

    fetchSalesHeads();
  }, [get]);

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
  // Note: onFilterChange is intentionally excluded from dependencies to prevent infinite loops
  React.useEffect(() => {
    if (onFilterChange) {
      onFilterChange({
        vendor: selectedVendor,
        status: selectedStatus,
        region: selectedRegion,
        parentDealer: selectedParentDealer,
        childDealer: selectedChildDealer,
        salesHead: selectedSalesHead,
        startDate: startDate,
        endDate: endDate
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVendor, selectedStatus, selectedRegion, selectedParentDealer, selectedChildDealer, selectedSalesHead, startDate, endDate]);

  const handleClearFilters = () => {
    setSelectedVendor(null);
    setSelectedStatus(null);
    setSelectedRegion(null);
    setSelectedParentDealer(null);
    setSelectedChildDealer(null);
    setSelectedSalesHead(null);
    setStartDate(null);
    setEndDate(null);
  };

  const hasActiveFilters = selectedVendor !== null || selectedStatus !== null || selectedRegion !== null || selectedParentDealer !== null || selectedChildDealer !== null || selectedSalesHead !== null || startDate !== null || endDate !== null;

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleDateRangeClick = (event) => {
    setDateRangeAnchor(event.currentTarget);
  };

  const handleDateRangeClose = () => {
    setDateRangeAnchor(null);
  };

  const dateRangeOpen = Boolean(dateRangeAnchor);

  return (
    <Box sx={{ 
      mb: 3, 
      p: 3, 
      backgroundColor: '#ffffff', 
      borderRadius: 3, 
      border: '1px solid #e0e7ff',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
    }}>
      {/* Filter Header */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        mb: 2.5,
        pb: 2,
        borderBottom: '2px solid #f0f4ff'
      }}>
        <Typography variant="h6" sx={{ 
          fontWeight: 600, 
          color: '#1a237e',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          fontSize: '1.1rem'
        }}>
          <FilterListIcon sx={{ fontSize: '1.3rem' }} />
          Filters
        </Typography>
        {hasActiveFilters && (
          <Button
            size="small"
            onClick={handleClearFilters}
            startIcon={<ClearIcon />}
            sx={{ 
              textTransform: 'none',
              color: '#666',
              '&:hover': {
                backgroundColor: '#f5f5f5'
              }
            }}
          >
            Clear All
          </Button>
        )}
      </Box>

      {/* Filter Grid - Row 1: Primary Filters */}
      <Grid container spacing={2.5} sx={{ mb: 2 }}>
        {/* Vendor Name Filter */}
        <Grid item xs={12} sm={6} md={3}>
          <Autocomplete
            size="small"
            options={vendors}
            getOptionLabel={(option) => {
              if (!option) return '';
              const cardName = option.name || '';
              const username = option.username || '';
              return username ? `${cardName} (${username})` : cardName;
            }}
            filterOptions={(options, { inputValue }) => {
              const searchValue = inputValue.toLowerCase().trim();
              if (!searchValue) return options;
              
              return options.filter(option => {
                const cardName = (option.name || '').toLowerCase();
                const username = (option.username || '').toLowerCase();
                return cardName.includes(searchValue) || username.includes(searchValue);
              });
            }}
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
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <>
                      <VendorIcon sx={{ mr: 1, color: 'action.active', fontSize: '1.2rem' }} />
                      {params.InputProps.startAdornment}
                    </>
                  ),
                }}
                sx={{
                  minWidth: '280px',
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#fafbff',
                    '&:hover': {
                      backgroundColor: '#f5f7ff',
                    },
                    '&.Mui-focused': {
                      backgroundColor: '#ffffff',
                    }
                  }
                }}
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
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <>
                      <StatusIcon sx={{ mr: 1, color: 'action.active', fontSize: '1.2rem' }} />
                      {params.InputProps.startAdornment}
                    </>
                  ),
                }}
                sx={{
                  minWidth: '280px',
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#fafbff',
                    '&:hover': {
                      backgroundColor: '#f5f7ff',
                    },
                    '&.Mui-focused': {
                      backgroundColor: '#ffffff',
                    }
                  }
                }}
              />
            )}
            isOptionEqualToValue={(option, value) => option.value === value?.value}
            noOptionsText="No statuses found"
            loading={loadingStatuses}
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
            getOptionLabel={(option) => option.name || ''}
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
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <>
                      <RegionIcon sx={{ mr: 1, color: 'action.active', fontSize: '1.2rem' }} />
                      {params.InputProps.startAdornment}
                    </>
                  ),
                }}
                sx={{
                  minWidth: '280px',
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#fafbff',
                    '&:hover': {
                      backgroundColor: '#f5f7ff',
                    },
                    '&.Mui-focused': {
                      backgroundColor: '#ffffff',
                    }
                  }
                }}
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

        {/* Date Range Filter - Combined (Moved to Row 1) */}
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            size="small"
            label="Date Range"
            placeholder="Select date range"
            value={startDate && endDate ? `${formatDate(startDate)} - ${formatDate(endDate)}` : startDate ? `${formatDate(startDate)} - ...` : endDate ? `... - ${formatDate(endDate)}` : ''}
            onClick={handleDateRangeClick}
            variant="outlined"
            fullWidth
            disabled={loading}
            InputProps={{
              startAdornment: <DateIcon sx={{ mr: 1, color: 'action.active', fontSize: '1.2rem' }} />,
              readOnly: true,
              endAdornment: (startDate || endDate) && (
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setStartDate(null);
                    setEndDate(null);
                  }}
                  sx={{ mr: 0.5 }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              ),
            }}
            sx={{
              cursor: 'pointer',
              minWidth: '280px',
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#fafbff',
                '&:hover': {
                  backgroundColor: '#f5f7ff',
                },
                '&.Mui-focused': {
                  backgroundColor: '#ffffff',
                }
              }
            }}
          />
          <Popover
            open={dateRangeOpen}
            anchorEl={dateRangeAnchor}
            onClose={handleDateRangeClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'left',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'left',
            }}
          >
            <Paper sx={{ p: 2, minWidth: 300 }}>
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Select Date Range
                </Typography>
                <IconButton size="small" onClick={handleDateRangeClose}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  size="small"
                  label="Start Date"
                  type="date"
                  value={startDate || ''}
                  onChange={(e) => setStartDate(e.target.value || null)}
                  variant="outlined"
                  fullWidth
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
                <TextField
                  size="small"
                  label="End Date"
                  type="date"
                  value={endDate || ''}
                  onChange={(e) => setEndDate(e.target.value || null)}
                  variant="outlined"
                  fullWidth
                  InputLabelProps={{
                    shrink: true,
                  }}
                  inputProps={{
                    min: startDate || undefined
                  }}
                />
                <Button
                  variant="contained"
                  onClick={handleDateRangeClose}
                  fullWidth
                  sx={{ mt: 1 }}
                >
                  Apply
                </Button>
              </Box>
            </Paper>
          </Popover>
        </Grid>

      </Grid>

      {/* Filter Grid - Row 2: Secondary Filters */}
      <Grid container spacing={2.5}>
        {/* Parent Dealer Filter - Only enabled when region is selected */}
        <Grid item xs={12} sm={6} md={3}>
          <Autocomplete
            size="small"
            options={parentDealers}
            getOptionLabel={(option) => {
              if (!option) return '';
              const name = option.name || '';
              const code = option.code || '';
              return code ? `${name} (${code})` : name;
            }}
            filterOptions={(options, { inputValue }) => {
              const searchValue = inputValue.toLowerCase().trim();
              if (!searchValue) return options;
              
              return options.filter(option => {
                const name = (option.name || '').toLowerCase();
                const code = (option.code || '').toLowerCase();
                return name.includes(searchValue) || code.includes(searchValue);
              });
            }}
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
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <>
                      <ParentDealerIcon sx={{ mr: 1, color: 'action.active', fontSize: '1.2rem' }} />
                      {params.InputProps.startAdornment}
                    </>
                  ),
                }}
                sx={{
                  minWidth: '280px',
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#fafbff',
                    '&:hover': {
                      backgroundColor: '#f5f7ff',
                    },
                    '&.Mui-focused': {
                      backgroundColor: '#ffffff',
                    }
                  }
                }}
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
            getOptionLabel={(option) => {
              if (!option) return '';
              const name = option.name || '';
              const code = option.code || '';
              return code ? `${name} (${code})` : name;
            }}
            filterOptions={(options, { inputValue }) => {
              const searchValue = inputValue.toLowerCase().trim();
              if (!searchValue) return options;
              
              return options.filter(option => {
                const name = (option.name || '').toLowerCase();
                const code = (option.code || '').toLowerCase();
                return name.includes(searchValue) || code.includes(searchValue);
              });
            }}
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
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <>
                      <ChildDealerIcon sx={{ mr: 1, color: 'action.active', fontSize: '1.2rem' }} />
                      {params.InputProps.startAdornment}
                    </>
                  ),
                }}
                sx={{
                  minWidth: '280px',
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#fafbff',
                    '&:hover': {
                      backgroundColor: '#f5f7ff',
                    },
                    '&.Mui-focused': {
                      backgroundColor: '#ffffff',
                    }
                  }
                }}
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

        {/* Sales Head Filter */}
        <Grid item xs={12} sm={6} md={3}>
          <Autocomplete
            size="small"
            options={salesHeads}
            getOptionLabel={(option) => {
              if (!option) return '';
              const name = option.sh_name || '';
              const firstCode = option.sh_codes?.[0] || '';
              return firstCode ? `${name} (${firstCode})` : name;
            }}
            value={selectedSalesHead}
            onChange={(event, newValue) => {
              setSelectedSalesHead(newValue);
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Sales Head"
                placeholder="Select sales head..."
                variant="outlined"
                fullWidth
                disabled={loading}
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <>
                      <SalesHeadIcon sx={{ mr: 1, color: 'action.active', fontSize: '1.2rem' }} />
                      {params.InputProps.startAdornment}
                    </>
                  ),
                }}
                sx={{
                  minWidth: '280px',
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#fafbff',
                    '&:hover': {
                      backgroundColor: '#f5f7ff',
                    },
                    '&.Mui-focused': {
                      backgroundColor: '#ffffff',
                    }
                  }
                }}
              />
            )}
            isOptionEqualToValue={(option, value) => option.sh_name === value?.sh_name}
            noOptionsText="No sales heads found"
            loading={loadingSalesHeads}
            componentsProps={{
              popper: {
                style: { zIndex: 1305 },
                placement: 'bottom-start'
              }
            }}
          />
        </Grid>

        {/* Filtered Results Count */}
        {showFilteredCount && hasActiveFilters && (
          <Grid item xs={12} sm={6} md={3}>
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                height: '100%',
                minHeight: '40px',
                px: 2,
                py: 1,
                backgroundColor: '#e3f2fd',
                borderRadius: 1,
                border: '1px solid #90caf9'
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#1976d2' }}>
                {filteredCount} result{filteredCount !== 1 ? 's' : ''} found
              </Typography>
            </Box>
          </Grid>
        )}
      </Grid>

      {/* Active Filters Display - Enhanced */}
      {hasActiveFilters && (
        <Box sx={{ 
          mt: 3, 
          pt: 2.5, 
          borderTop: '1px solid #e0e7ff',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1.5,
          alignItems: 'center'
        }}>
          <Typography variant="caption" sx={{ 
            color: '#666', 
            fontWeight: 500,
            mr: 1,
            fontSize: '0.85rem'
          }}>
            Active Filters:
          </Typography>
          {selectedVendor && (
            <Chip
              label={`Vendor: ${selectedVendor.name}`}
              onDelete={() => setSelectedVendor(null)}
              color="primary"
              variant="filled"
              size="small"
              sx={{
                fontWeight: 500,
                '& .MuiChip-deleteIcon': {
                  fontSize: '1rem'
                }
              }}
            />
          )}
          {selectedStatus && (
            <Chip
              label={`Status: ${selectedStatus.label}`}
              onDelete={() => setSelectedStatus(null)}
              color="secondary"
              variant="filled"
              size="small"
              sx={{
                fontWeight: 500,
                '& .MuiChip-deleteIcon': {
                  fontSize: '1rem'
                }
              }}
            />
          )}
          {selectedRegion && (
            <Chip
              label={`Region: ${selectedRegion.name || ''}`}
              onDelete={() => setSelectedRegion(null)}
              color="info"
              variant="filled"
              size="small"
              sx={{
                fontWeight: 500,
                '& .MuiChip-deleteIcon': {
                  fontSize: '1rem'
                }
              }}
            />
          )}
          {selectedParentDealer && (
            <Chip
              label={`Parent: ${selectedParentDealer.code ? `${selectedParentDealer.name} (${selectedParentDealer.code})` : selectedParentDealer.name || selectedParentDealer.code}`}
              onDelete={() => setSelectedParentDealer(null)}
              color="warning"
              variant="filled"
              size="small"
              sx={{
                fontWeight: 500,
                '& .MuiChip-deleteIcon': {
                  fontSize: '1rem'
                }
              }}
            />
          )}
          {selectedChildDealer && (
            <Chip
              label={`Child: ${selectedChildDealer.code ? `${selectedChildDealer.name} (${selectedChildDealer.code})` : selectedChildDealer.name || selectedChildDealer.code}`}
              onDelete={() => setSelectedChildDealer(null)}
              color="success"
              variant="filled"
              size="small"
              sx={{
                fontWeight: 500,
                '& .MuiChip-deleteIcon': {
                  fontSize: '1rem'
                }
              }}
            />
          )}
          {selectedSalesHead && (
            <Chip
              label={`Sales Head: ${selectedSalesHead.sh_name}`}
              onDelete={() => setSelectedSalesHead(null)}
              color="error"
              variant="filled"
              size="small"
              sx={{
                fontWeight: 500,
                '& .MuiChip-deleteIcon': {
                  fontSize: '1rem'
                }
              }}
            />
          )}
          {(startDate || endDate) && (
            <Chip
              label={`Date: ${startDate ? formatDate(startDate) : '...'} - ${endDate ? formatDate(endDate) : '...'}`}
              onDelete={() => {
                setStartDate(null);
                setEndDate(null);
              }}
              color="info"
              variant="filled"
              size="small"
              sx={{
                fontWeight: 500,
                '& .MuiChip-deleteIcon': {
                  fontSize: '1rem'
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

