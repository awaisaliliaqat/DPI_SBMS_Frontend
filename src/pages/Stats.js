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
  Assignment as AssignmentIcon,
  AttachMoney as MoneyIcon,
  AccountBalance as BudgetIcon,
  AccountBalanceWallet as RemainingBudgetIcon,
  Inventory as QuantityIcon,
} from '@mui/icons-material';
import { useAuth } from '../auth/AuthContext';
import PageContainer from '../components/PageContainer';
import { useApi } from '../hooks/useApi';
import ShopboardRequestFilters from '../components/ShopboardRequestFilters';

export default function Stats() {
  const { user } = useAuth();
  const { get } = useApi();

  const canRead = user?.permissions?.statistics?.includes('read') || false;

  const [loading, setLoading] = React.useState(true);
  const [isInitialLoad, setIsInitialLoad] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [stats, setStats] = React.useState({
    mode: 'default',
    totalRequests: 0,
    totalRevenue: 0,
    totalQuantity: 0,
    totalAmount: 0,
  });

  const [budgetData, setBudgetData] = React.useState({
    hasBudget: false,
    totalBudget: 0,
    totalSpent: 0,
    remainingBudget: 0,
    carryForward: 0,
    availableBudget: 0,
  });

  const [filters, setFilters] = React.useState({
    vendor: null,
    status: null,
    region: null,
    parentDealer: null,
    childDealer: null,
    salesHead: null,
    requestType: null,
    startDate: null,
    endDate: null,
  });

  const handleFilterChange = React.useCallback((newFilters) => {
    setFilters((prevFilters) => {
      const hasChanged =
        prevFilters.vendor !== newFilters.vendor ||
        prevFilters.status !== newFilters.status ||
        prevFilters.region !== newFilters.region ||
        prevFilters.parentDealer !== newFilters.parentDealer ||
        prevFilters.childDealer !== newFilters.childDealer ||
        prevFilters.salesHead !== newFilters.salesHead ||
        prevFilters.requestType !== newFilters.requestType ||
        prevFilters.startDate !== newFilters.startDate ||
        prevFilters.endDate !== newFilters.endDate;

      return hasChanged ? newFilters : prevFilters;
    });
  }, []);

  const filtersRef = React.useRef(filters);
  React.useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  React.useEffect(() => {
    const fetchStats = async () => {
      if (!canRead) {
        setLoading(false);
        setIsInitialLoad(false);
        return;
      }

      try {
        if (isInitialLoad) {
          setLoading(true);
        }

        const currentFilters = filtersRef.current;
        const queryParams = new URLSearchParams();

        if (currentFilters.vendor && currentFilters.vendor.id) {
          queryParams.append('vendor_id', currentFilters.vendor.id.toString());
        }

        if (currentFilters.status && currentFilters.status.value) {
          queryParams.append('status', currentFilters.status.value);
        }

        if (currentFilters.region && currentFilters.region.name) {
          queryParams.append('region', currentFilters.region.name);
        }

        if (currentFilters.parentDealer && currentFilters.parentDealer.code) {
          queryParams.append('parent_dealer_code', currentFilters.parentDealer.code);
        }

        if (currentFilters.childDealer && currentFilters.childDealer.code) {
          queryParams.append('child_dealer_code', currentFilters.childDealer.code);
        }

        if (currentFilters.salesHead && currentFilters.salesHead.sh_codes && currentFilters.salesHead.sh_codes[0]) {
          queryParams.append('sales_head_code', currentFilters.salesHead.sh_codes[0]);
        }

        if (currentFilters.requestType && currentFilters.requestType.id) {
          queryParams.append('request_type_id', currentFilters.requestType.id.toString());
        }

        if (currentFilters.startDate && currentFilters.endDate) {
          queryParams.append('start_date', currentFilters.startDate);
          queryParams.append('end_date', currentFilters.endDate);
        }

        const apiUrl = `/api/statistics?${queryParams.toString()}`;
        const response = await get(apiUrl);

        if (response.success && response.data) {
          const isRequestTypeMode = response.data.mode === 'request_type' || !!currentFilters.requestType?.id;
          setStats({
            mode: isRequestTypeMode ? 'request_type' : 'default',
            totalRequests: response.data.totalRequests || 0,
            totalRevenue: response.data.totalCost || 0,
            totalQuantity: response.data.totalQuantity || 0,
            totalAmount: response.data.totalAmount || 0,
          });
        } else {
          setStats({
            mode: 'default',
            totalRequests: 0,
            totalRevenue: 0,
            totalQuantity: 0,
            totalAmount: 0,
          });
        }
      } catch (err) {
        console.error('Error fetching statistics:', err);
        setError('Failed to load statistics');
        setStats({
          mode: 'default',
          totalRequests: 0,
          totalRevenue: 0,
          totalQuantity: 0,
          totalAmount: 0,
        });
      } finally {
        setLoading(false);
        setIsInitialLoad(false);
      }
    };

    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead, filters]);

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
        const queryParams = new URLSearchParams();

        if (currentFilters.startDate && currentFilters.endDate) {
          queryParams.append('start_date', currentFilters.startDate);
          queryParams.append('end_date', currentFilters.endDate);
        }

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
  }, [canRead, filters.startDate, filters.endDate]);

  if (!canRead) {
    return (
      <PageContainer title="Statistics" breadcrumbs={[{ title: 'Statistics' }]}>
        <Alert severity="error" sx={{ mb: 2 }}>
          You do not have permission to view this page
        </Alert>
      </PageContainer>
    );
  }

  const isRequestTypeMode = stats.mode === 'request_type' || !!filters.requestType?.id;
  const requestTypeName = filters.requestType?.name || 'Request Type';

  const formatMoney = (amount) =>
    `Rs ${(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const primaryCards = isRequestTypeMode
    ? [
        {
          title: `Total Quantity (${requestTypeName})`,
          value: (stats.totalQuantity || 0).toLocaleString('en-US'),
          icon: <QuantityIcon sx={{ fontSize: 40 }} />,
          color: '#1565c0',
          bgColor: '#e3f2fd',
        },
        {
          title: `Amount (${requestTypeName})`,
          value: formatMoney(stats.totalAmount),
          icon: <MoneyIcon sx={{ fontSize: 40 }} />,
          color: '#2e7d32',
          bgColor: '#e8f5e9',
        },
      ]
    : [
        {
          title: 'Total Requests',
          value: stats.totalRequests,
          icon: <AssignmentIcon sx={{ fontSize: 40 }} />,
          color: '#1976d2',
          bgColor: '#e3f2fd',
        },
        {
          title: 'Total Cost',
          value: formatMoney(stats.totalRevenue),
          icon: <MoneyIcon sx={{ fontSize: 40 }} />,
          color: '#2e7d32',
          bgColor: '#e8f5e9',
        },
      ];

  const budgetCards = [
    {
      title: 'Budget',
      value: (() => {
        if (!budgetData.hasBudget) return 'No Budget';
        return formatMoney(budgetData.availableBudget);
      })(),
      icon: <BudgetIcon sx={{ fontSize: 40 }} />,
      color: '#9c27b0',
      bgColor: '#f3e5f5',
      subtitle:
        budgetData.hasBudget && budgetData.carryForward !== 0
          ? `Carry Forward: ${formatMoney(budgetData.carryForward)}`
          : null,
    },
    {
      title: 'Remaining Budget',
      value: (() => {
        if (!budgetData.hasBudget) return 'No Budget';
        return formatMoney(budgetData.remainingBudget);
      })(),
      icon: <RemainingBudgetIcon sx={{ fontSize: 40 }} />,
      color: (budgetData.remainingBudget || 0) < 0 ? '#d32f2f' : '#2e7d32',
      bgColor: (budgetData.remainingBudget || 0) < 0 ? '#ffebee' : '#e8f5e9',
    },
  ].filter((card) => {
    if ((card.title === 'Budget' || card.title === 'Remaining Budget') && !budgetData.hasBudget) {
      return false;
    }
    return true;
  });

  const statCards = [...primaryCards, ...budgetCards];

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

        <ShopboardRequestFilters
          onFilterChange={handleFilterChange}
          loading={loading && isInitialLoad}
          filteredCount={0}
          showFilteredCount={false}
          showRequestTypeFilter
        />

        <Grid container spacing={3}>
          {statCards.map((card, index) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={`${card.title}-${index}`}>
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
                      color:
                        card.title === 'Remaining Budget' && budgetData.remainingBudget < 0
                          ? '#d32f2f'
                          : '#1a237e',
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
