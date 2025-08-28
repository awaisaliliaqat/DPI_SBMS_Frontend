import * as React from 'react';
import {
  Alert,
  Box,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import ReusableDataTable from '../components/ReusableData';
import PageContainer from '../components/PageContainer';

// Base URL for API
const BASE_URL = 'http://localhost:8080/api';

const INITIAL_PAGE_SIZE = 10;

export default function RoleManagement() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const { user, hasPermission,token } = useAuth();
  const [rowsState, setRowsState] = React.useState({
    rows: [],
    rowCount: 0,
  });

  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  // Table state management
  const [paginationModel, setPaginationModel] = React.useState({
    page: searchParams.get('page') ? Number(searchParams.get('page')) : 0,
    pageSize: searchParams.get('pageSize')
      ? Number(searchParams.get('pageSize'))
      : INITIAL_PAGE_SIZE,
  });

  const [filterModel, setFilterModel] = React.useState(
    searchParams.get('filter')
      ? JSON.parse(searchParams.get('filter') ?? '')
      : { items: [] },
  );

  const [sortModel, setSortModel] = React.useState(
    searchParams.get('sort') ? JSON.parse(searchParams.get('sort') ?? '') : [],
  );

  // URL state synchronization
  const handlePaginationModelChange = React.useCallback(
    (model) => {
      setPaginationModel(model);
      searchParams.set('page', String(model.page));
      searchParams.set('pageSize', String(model.pageSize));
      const newSearchParamsString = searchParams.toString();
      navigate(
        `${pathname}${newSearchParamsString ? '?' : ''}${newSearchParamsString}`,
      );
    },
    [navigate, pathname, searchParams],
  );

  const handleFilterModelChange = React.useCallback(
    (model) => {
      setFilterModel(model);
      if (
        model.items.length > 0 ||
        (model.quickFilterValues && model.quickFilterValues.length > 0)
      ) {
        searchParams.set('filter', JSON.stringify(model));
      } else {
        searchParams.delete('filter');
      }
      const newSearchParamsString = searchParams.toString();
      navigate(
        `${pathname}${newSearchParamsString ? '?' : ''}${newSearchParamsString}`,
      );
    },
    [navigate, pathname, searchParams],
  );

  const handleSortModelChange = React.useCallback(
    (model) => {
      setSortModel(model);
      if (model.length > 0) {
        searchParams.set('sort', JSON.stringify(model));
      } else {
        searchParams.delete('sort');
      }
      const newSearchParamsString = searchParams.toString();
      navigate(
        `${pathname}${newSearchParamsString ? '?' : ''}${newSearchParamsString}`,
      );
    },
    [navigate, pathname, searchParams],
  );

  // API call to fetch roles
  const loadRoles = React.useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      const { page, pageSize } = paginationModel;
      
      // Build API URL with pagination parameters
      const apiUrl = `${BASE_URL}/roles?page=${page}&size=${pageSize}`;
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // Add authorization header if needed
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const rolesData = await response.json();
      
      setRowsState({
        rows: rolesData,
        rowCount: rolesData.length, // Note: This should be total count from server
        // For proper pagination, you'll need to get totalCount from server headers
        // or modify your API to return pagination metadata
      });
      
    } catch (loadError) {
      setError(loadError.message || 'Failed to load roles');
      console.error('Error loading roles:', loadError);
    } finally {
      setIsLoading(false);
    }
  }, [paginationModel]);

  // Load data when component mounts or pagination changes
  React.useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  // Action handlers
  const handleView = React.useCallback((roleData) => {
    navigate(`/roles/${roleData.id}`);
  }, [navigate]);

  const handleEdit = React.useCallback((roleData) => {
    navigate(`/roles/${roleData.id}/edit`);
  }, [navigate]);

  const handleDelete = React.useCallback(
    async (roleData) => {
      const confirmed = window.confirm(
        `Do you wish to delete role "${roleData.name}"?`
      );

      if (confirmed) {
        setIsLoading(true);
        try {
          const response = await fetch(`${BASE_URL}/roles/${roleData.id}`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          // Show success message (you can add a notification system)
          alert('Role deleted successfully!');
          
          // Reload data
          loadRoles();
        } catch (deleteError) {
          alert(`Failed to delete role: ${deleteError.message}`);
        } finally {
          setIsLoading(false);
        }
      }
    },
    [loadRoles],
  );

  const handleCreate = React.useCallback(() => {
    navigate('/roles/new');
  }, [navigate]);

  const handleRefresh = React.useCallback(() => {
    if (!isLoading) {
      loadRoles();
    }
  }, [isLoading, loadRoles]);

  const handleRowClick = React.useCallback(
    ({ row }) => {
      navigate(`/roles/${row.id}`);
    },
    [navigate],
  );

  // Column definitions for roles
  const columns = React.useMemo(
    () => [
      { 
        field: 'id', 
        headerName: 'ID',
        width: 70,
      },
      {
        field: 'name',
        headerName: 'Role Name',
        width: 140,
      },
      {
        field: 'description',
        headerName: 'Description',
        width: 220,
      },
      {
        field: 'default',
        headerName: 'Default',
        type: 'boolean',
        width: 100,
        renderCell: (params) => (
          <Chip
            label={params.value ? 'Yes' : 'No'}
            variant="outlined"
            size="small"
            color={params.value ? 'success' : 'default'}
          />
        ),
      },
       {
      field: 'createdAt',
      headerName: 'Created At',
      width: 180,
      valueFormatter: (params) => {
        if (!params.value) return '';
        try {
          const date = new Date(params.value);
          return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        } catch (error) {
          return params.value;
        }
      },
      renderCell: (params) => {
        if (!params.value) return '';
        try {
          const date = new Date(params.value);
          return (
            <Typography variant="body2">
              {date.toLocaleDateString()} 
              <br />
              {date.toLocaleTimeString()}
            </Typography>
          );
        } catch (error) {
          return params.value;
        }
      },
    },
    ],
    [],
  );

  // Check permissions
  // if (!hasPermission('role', 'manage')) {
  //   return (
  //     <PageContainer title="Role Management">
  //       <Alert severity="warning">
  //         You don't have permission to manage roles.
  //       </Alert>
  //     </PageContainer>
  //   );
  // }

  const pageTitle = 'Role Management';

  return (
    <PageContainer
      title={pageTitle}
      breadcrumbs={[{ title: pageTitle }]}
    >
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <ReusableDataTable
        data={rowsState.rows}
        columns={columns}
        loading={isLoading}
        error={error}
        
        // Pagination
        paginationModel={paginationModel}
        onPaginationModelChange={handlePaginationModelChange}
        rowCount={rowsState.rowCount}
        paginationMode="server"
        
        // Sorting
        sortModel={sortModel}
        onSortModelChange={handleSortModelChange}
        sortingMode="server"
        
        // Filtering
        filterModel={filterModel}
        onFilterModelChange={handleFilterModelChange}
        filterMode="server"
        
        // Actions
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onCreate={handleCreate}
        onRefresh={handleRefresh}
        
        // Row interaction
        onRowClick={handleRowClick}
        
        // Configuration
        pageSizeOptions={[5, 10, 25, 50]}
        showToolbar={true}
      />
    </PageContainer>
  );
}



