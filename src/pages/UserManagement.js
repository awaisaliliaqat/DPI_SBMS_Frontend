import * as React from 'react';
import {
  Alert,
  Chip,
  Typography,
} from '@mui/material';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import ReusableDataTable from '../components/ReusableData';
import PageContainer from '../components/PageContainer';
import DynamicModal from '../components/DynamicModel';
import { BASE_URL } from "../constants/Constants";
import { useApi } from '../hooks/useApi';


const INITIAL_PAGE_SIZE = 10;

export default function UserManagement() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const { user, hasPermission, token } = useAuth();
  const { get, post, put, del } = useApi(); // Use the useApi hook

  const [rowsState, setRowsState] = React.useState({
    rows: [],
    rowCount: 0,
  });

  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  
  // Modal state
  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalMode, setModalMode] = React.useState('view');
  const [selectedUser, setSelectedUser] = React.useState(null);

  // Roles state (fetched from API)
  const [roles, setRoles] = React.useState([]);
  const [loadingRoles, setLoadingRoles] = React.useState(false);
  const [rolesError, setRolesError] = React.useState(null);

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

  // Define user form fields
  const getUserFields = (isCreate = false) => [
    {
      name: 'username',
      label: 'Username',
      type: 'text',
      required: true,
    },
    {
      name: 'email',
      label: 'Email',
      type: 'email',
      required: true,
    },
    ...(isCreate ? [{
      name: 'password',
      label: 'Password',
      type: 'password',
      required: true,
    }] : []),
    {
      name: 'roleId',
      label: 'Role',
      type: 'select',
      required: true,
      options: roles.map(role => ({
        value: role.id,
        label: role.name
      })),
      loading: loadingRoles,
      error: rolesError,
    },
    {
      name: 'isActive',
      label: 'Active',
      type: 'checkbox',
      defaultValue: true,
    },
  ];

  // API call to fetch roles
  const fetchRoles = React.useCallback(async () => {
    setLoadingRoles(true);
    setRolesError(null);
    
    try {
       const data = await get('/api/roles/ids-and-names');
      
      if (Array.isArray(data)) {
        setRoles(data);
      } else {
        throw new Error('Invalid roles data format');
      }
    } catch (error) {
      setRolesError(error.message || 'Failed to load roles');
      console.error('Error loading roles:', error);
    } finally {
      setLoadingRoles(false);
    }
  }, [get]);

  // Load roles when modal opens
  React.useEffect(() => {
    if (modalOpen) {
      fetchRoles();
    }
  }, [modalOpen, fetchRoles]);

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

  // API call to fetch users with pagination
  const loadUsers = React.useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      const { page, pageSize } = paginationModel;
      
      const apiUrl = `/api/users?page=${page}&size=${pageSize}`;
      
      const userData = await get(apiUrl);
      
      // Handle the response structure based on your API
      if (userData.users && Array.isArray(userData.users)) {
        setRowsState({
          rows: userData.users,
          rowCount: userData.totalCount || userData.users.length,
        });
      } else if (Array.isArray(userData)) {
        // Fallback for direct array response
        setRowsState({
          rows: userData,
          rowCount: userData.length,
        });
      } else {
        setRowsState({
          rows: [],
          rowCount: 0,
        });
      }
      
    } catch (loadError) {
      setError(loadError.message || 'Failed to load users');
      console.error('Error loading users:', loadError);
    } finally {
      setIsLoading(false);
    }
  }, [paginationModel, token]);

  // Load data when component mounts or pagination changes
  React.useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Action handlers - updated to use modal
  const handleView = React.useCallback((userData) => {
    setSelectedUser(userData);
    setModalMode('view');
    setModalOpen(true);
  }, []);

  const handleEdit = React.useCallback((userData) => {
    setSelectedUser(userData);
    setModalMode('edit');
    setModalOpen(true);
  }, []);

  const handleDelete = React.useCallback(
    async (userData) => {
      const confirmed = window.confirm(
        `Do you wish to delete user "${userData.username}"?`
      );

      if (confirmed) {
        setIsLoading(true);
        try {
          const response = await fetch(`${BASE_URL}/api/users/${userData.id}`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          alert('User deleted successfully!');
          loadUsers();
        } catch (deleteError) {
          alert(`Failed to delete user: ${deleteError.message}`);
        } finally {
          setIsLoading(false);
        }
      }
    },
    [loadUsers, token],
  );

  const handleCreate = React.useCallback(() => {
    setSelectedUser({ isActive: true }); // Default active to true for new users
    setModalMode('create');
    setModalOpen(true);
  }, []);

  const handleRefresh = React.useCallback(() => {
    if (!isLoading) {
      loadUsers();
    }
  }, [isLoading, loadUsers]);

  const handleRowClick = React.useCallback(
    ({ row }) => {
      handleView(row);
    },
    [handleView],
  );

  // Handle modal submit
  const handleModalSubmit = async (formData) => {
    setIsLoading(true);
    try {
      // Prepare submit data according to API requirements
      const submitData = {
        username: formData.username,
        email: formData.email,
        roleId: parseInt(formData.roleId),
        isActive: formData.isActive !== undefined ? formData.isActive : true,
      };

      // Add password only for create mode
      if (modalMode === 'create') {
        submitData.password = formData.password;
      }

      // let url, method;

      let response;
      
      if (modalMode === 'create') {
        response = await post('/api/users', submitData);
      } else {
        response = await put(`/api/users/${selectedUser.id}`, submitData);
      }

      alert(`User ${modalMode === 'create' ? 'created' : 'updated'} successfully!`);
      setModalOpen(false);
      loadUsers();
    } catch (submitError) {
      alert(`Failed to ${modalMode} user: ${submitError.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Column definitions for users
  const columns = React.useMemo(
    () => [
      { 
        field: 'id', 
        headerName: 'ID',
        width: 70,
      },
      {
        field: 'username',
        headerName: 'Username',
        width: 150,
      },
      {
        field: 'email',
        headerName: 'Email',
        width: 200,
      },
      {
        field: 'roleName',
        headerName: 'Role',
        width: 150,
        renderCell: (params) => (
          <Chip 
            label={params.value || 'No Role'} 
            variant="outlined" 
            size="small"
            color={params.value ? 'primary' : 'default'}
          />
        ),
      },
      {
        field: 'isActive',
        headerName: 'Status',
        width: 100,
        renderCell: (params) => (
          <Chip 
            label={params.value ? 'Active' : 'Inactive'} 
            variant="filled" 
            size="small"
            color={params.value ? 'success' : 'error'}
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

  const pageTitle = 'User Management';

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
        filterMode="client"
        
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

      {/* Dynamic Modal for User CRUD */}
      <DynamicModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        mode={modalMode}
        title={`${modalMode === 'create' ? 'Create' : modalMode === 'edit' ? 'Edit' : 'View'} User`}
        initialData={selectedUser || {}}
        fields={getUserFields(modalMode === 'create')}
        onSubmit={handleModalSubmit}
        loading={isLoading}
      />
    </PageContainer>
  );
}