import * as React from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  People as PeopleIcon,
  Assignment as AssignmentIcon,
  Store as StoreIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
  AttachMoney as MoneyIcon,
  Assessment as AssessmentIcon,
  AccountBalance as BudgetIcon,
  AccountBalanceWallet as RemainingBudgetIcon,
} from '@mui/icons-material';
import { useAuth } from '../auth/AuthContext';
import PageContainer from '../components/PageContainer';
import { useApi } from '../hooks/useApi';
import ShopboardRequestFilters from '../components/ShopboardRequestFilters';

export default function Stats() {
  const { user } = useAuth();
  const { get } = useApi();

  // Check user permissions
  const canRead = user?.permissions?.statistics?.includes('read') || false;

  const [loading, setLoading] = React.useState(true);
  const [isInitialLoad, setIsInitialLoad] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [stats, setStats] = React.useState({
    totalRequests: 0,
    pendingRequests: 0,
    approvedRequests: 0,
    totalVendors: 0,
    totalDealers: 0,
    totalUsers: 0,
    totalRevenue: 0,
    completedRequests: 0,
  });

  // Budget state
  const [budgetData, setBudgetData] = React.useState({
    hasBudget: false,
    totalBudget: 0,
    totalSpent: 0,
    remainingBudget: 0,
    carryForward: 0,
    availableBudget: 0,
  });

  // Filter state
  const [filters, setFilters] = React.useState({
    vendor: null,
    status: null,
    region: null,
    parentDealer: null,
    childDealer: null,
    salesHead: null,
    startDate: null,
    endDate: null,
  });

  // Handle filter changes - memoized to prevent infinite loops
  const handleFilterChange = React.useCallback((newFilters) => {
    setFilters(prevFilters => {
      // Only update if filters actually changed to prevent unnecessary re-renders
      const hasChanged = 
        prevFilters.vendor !== newFilters.vendor ||
        prevFilters.status !== newFilters.status ||
        prevFilters.region !== newFilters.region ||
        prevFilters.parentDealer !== newFilters.parentDealer ||
        prevFilters.childDealer !== newFilters.childDealer ||
        prevFilters.salesHead !== newFilters.salesHead ||
        prevFilters.startDate !== newFilters.startDate ||
        prevFilters.endDate !== newFilters.endDate;
      
      return hasChanged ? newFilters : prevFilters;
    });
  }, []);

  // Use ref to track filters to avoid recreating fetchStats on every filter change
  const filtersRef = React.useRef(filters);
  React.useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  // Fetch statistics data with filters
  React.useEffect(() => {
    const fetchStats = async () => {
      if (!canRead) {
        setLoading(false);
        setIsInitialLoad(false);
        return;
      }

      try {
        // Only show full loading on initial load, use subtle loading for filter changes
        if (isInitialLoad) {
          setLoading(true);
        }
        
        // Use current filters from ref
        const currentFilters = filtersRef.current;
        
        // Build query parameters from filters
        const queryParams = new URLSearchParams();
        
        // Add vendor filter if selected
        if (currentFilters.vendor && currentFilters.vendor.id) {
          queryParams.append('vendor_id', currentFilters.vendor.id.toString());
        }
        
        // Add status filter if selected
        if (currentFilters.status && currentFilters.status.value) {
          queryParams.append('status', currentFilters.status.value);
        }
        
        // Add region filter if selected
        if (currentFilters.region && currentFilters.region.name) {
          queryParams.append('region', currentFilters.region.name);
        }
        
        // Add parent dealer filter if selected
        if (currentFilters.parentDealer && currentFilters.parentDealer.code) {
          queryParams.append('parent_dealer_code', currentFilters.parentDealer.code);
        }
        
        // Add child dealer filter if selected
        if (currentFilters.childDealer && currentFilters.childDealer.code) {
          queryParams.append('child_dealer_code', currentFilters.childDealer.code);
        }
        
        // Add sales head filter if selected
        if (currentFilters.salesHead && currentFilters.salesHead.sh_codes && currentFilters.salesHead.sh_codes[0]) {
          queryParams.append('sales_head_code', currentFilters.salesHead.sh_codes[0]);
        }
        
        // Add date range filter if both start and end dates are provided
        if (currentFilters.startDate && currentFilters.endDate) {
          queryParams.append('start_date', currentFilters.startDate);
          queryParams.append('end_date', currentFilters.endDate);
        }
        
        const apiUrl = `/api/statistics?${queryParams.toString()}`;
        const response = await get(apiUrl);
        
        if (response.success && response.data) {
          setStats({
            totalRequests: response.data.totalRequests || 0,
            totalRevenue: response.data.totalCost || 0,
            // Keep other stats as 0 for now (can be added later if needed)
            pendingRequests: 0,
            approvedRequests: 0,
            totalVendors: 0,
            totalDealers: 0,
            totalUsers: 0,
            completedRequests: 0,
          });
        } else {
          setStats({
            totalRequests: 0,
            totalRevenue: 0,
            pendingRequests: 0,
            approvedRequests: 0,
            totalVendors: 0,
            totalDealers: 0,
            totalUsers: 0,
            completedRequests: 0,
          });
        }
      } catch (err) {
        console.error('Error fetching statistics:', err);
        setError('Failed to load statistics');
        setStats({
          totalRequests: 0,
          totalRevenue: 0,
          pendingRequests: 0,
          approvedRequests: 0,
          totalVendors: 0,
          totalDealers: 0,
          totalUsers: 0,
          completedRequests: 0,
        });
      } finally {
        setLoading(false);
        setIsInitialLoad(false);
      }
    };

    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead, filters]); // Only depend on canRead and filters, not get

  // Fetch budget data based on date range filter
  React.useEffect(() => {
    const fetchBudget = async () => {
      if (!canRead) {
        setBudgetData({
          hasBudget: false,
          totalBudget: 0,
          totalSpent: 0,
          remainingBudget: 0,
          carryForward: 0,
          availableBudget: 0,
        });
        return;
      }

      try {
        const currentFilters = filtersRef.current;
        
        // Build query parameters for budget API
        const queryParams = new URLSearchParams();
        
        // Add date range filter if both start and end dates are provided
        if (currentFilters.startDate && currentFilters.endDate) {
          queryParams.append('start_date', currentFilters.startDate);
          queryParams.append('end_date', currentFilters.endDate);
        }
        // If no date range, API will default to current month
        
        const apiUrl = `/api/budget-management/date-range?${queryParams.toString()}`;
        const response = await get(apiUrl);
        
        if (response.success && response.data) {
          setBudgetData({
            hasBudget: response.data.hasBudget || false,
            totalBudget: response.data.totalBudget || 0,
            totalSpent: response.data.totalSpent || 0,
            remainingBudget: response.data.remainingBudget || 0,
            carryForward: response.data.carryForward || 0,
            availableBudget: response.data.availableBudget || 0,
          });
        } else {
          setBudgetData({
            hasBudget: false,
            totalBudget: 0,
            totalSpent: 0,
            remainingBudget: 0,
            carryForward: 0,
            availableBudget: 0,
          });
        }
      } catch (err) {
        console.error('Error fetching budget data:', err);
        setBudgetData({
          hasBudget: false,
          totalBudget: 0,
          totalSpent: 0,
          remainingBudget: 0,
          carryForward: 0,
          availableBudget: 0,
        });
      }
    };

    fetchBudget();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead, filters.startDate, filters.endDate]); // Only depend on date filters for budget

  // If user doesn't have read permission, show error message
  if (!canRead) {
    return (
      <PageContainer title="Statistics" breadcrumbs={[{ title: 'Statistics' }]}>
        <Alert severity="error" sx={{ mb: 2 }}>
          You do not have permission to view this page
        </Alert>
      </PageContainer>
    );
  }

  // Statistics cards configuration
  const statCards = [
    {
      title: 'Total Requests',
      value: stats.totalRequests,
      icon: <AssignmentIcon sx={{ fontSize: 40 }} />,
      color: '#1976d2',
      bgColor: '#e3f2fd',
    },
    {
      title: 'Total Cost',
      value: (() => {
        const cost = stats.totalRevenue || 0;
        // Format number with commas for thousands separators
        return `Rs ${cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      })(),
      icon: <MoneyIcon sx={{ fontSize: 40 }} />,
      color: '#2e7d32',
      bgColor: '#e8f5e9',
    },
    {
      title: 'Budget',
      value: (() => {
        if (!budgetData.hasBudget) return 'No Budget';
        const budget = budgetData.availableBudget || 0;
        return `Rs ${budget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      })(),
      icon: <BudgetIcon sx={{ fontSize: 40 }} />,
      color: '#9c27b0',
      bgColor: '#f3e5f5',
      subtitle: budgetData.hasBudget && budgetData.carryForward !== 0 
        ? `Carry Forward: Rs ${budgetData.carryForward.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : null,
    },
    {
      title: 'Remaining Budget',
      value: (() => {
        if (!budgetData.hasBudget) return 'No Budget';
        const remaining = budgetData.remainingBudget || 0;
        return `Rs ${remaining.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      })(),
      icon: <RemainingBudgetIcon sx={{ fontSize: 40 }} />,
      color: (() => {
        const remaining = budgetData.remainingBudget || 0;
        return remaining < 0 ? '#d32f2f' : '#2e7d32';
      })(),
      bgColor: (() => {
        const remaining = budgetData.remainingBudget || 0;
        return remaining < 0 ? '#ffebee' : '#e8f5e9';
      })(),
    },
  ].filter(card => {
    // Filter out budget cards if no budget data
    if ((card.title === 'Budget' || card.title === 'Remaining Budget') && !budgetData.hasBudget) {
      return false;
    }
    return true;
  });

  if (loading) {
    return (
      <PageContainer title="Statistics" breadcrumbs={[{ title: 'Statistics' }]}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <CircularProgress />
        </Box>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer title="Statistics" breadcrumbs={[{ title: 'Statistics' }]}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer title="Statistics" breadcrumbs={[{ title: 'Statistics' }]}>
      <Box sx={{ flexGrow: 1, p: 3, position: 'relative' }}>
        {/* Subtle loading overlay - only show when loading after initial load */}
        {loading && !isInitialLoad && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(255, 255, 255, 0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              pointerEvents: 'none',
            }}
          >
            <CircularProgress size={40} />
          </Box>
        )}

        {/* Search Filters */}
        <ShopboardRequestFilters
          onFilterChange={handleFilterChange}
          loading={loading && isInitialLoad}
          filteredCount={0}
          showFilteredCount={false}
        />

        {/* Statistics Cards Grid */}
        <Grid container spacing={3}>
          {statCards.map((card, index) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={index}>
              <Card
                sx={{
                  height: '100%',
                  borderRadius: 3,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                  transition: 'all 0.3s ease-in-out',
                  opacity: loading && !isInitialLoad ? 0.6 : 1,
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                  },
                  border: '1px solid #e0e0e0',
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Box
                      sx={{
                        width: 64,
                        height: 64,
                        borderRadius: 2,
                        backgroundColor: card.bgColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: card.color,
                      }}
                    >
                      {card.icon}
                    </Box>
                  </Box>
                  <Typography
                    variant="h4"
                    sx={{
                      fontWeight: 700,
                      color: card.title === 'Remaining Budget' && budgetData.remainingBudget < 0 ? '#d32f2f' : '#1a237e',
                      mb: 0.5,
                      fontSize: '2rem',
                    }}
                  >
                    {card.value}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: '#666',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      fontSize: '0.85rem',
                    }}
                  >
                    {card.title}
                  </Typography>
                  {card.subtitle && (
                    <Typography
                      variant="caption"
                      sx={{
                        color: '#666',
                        fontSize: '0.75rem',
                        mt: 0.5,
                        display: 'block',
                      }}
                    >
                      {card.subtitle}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    </PageContainer>
  );
}

