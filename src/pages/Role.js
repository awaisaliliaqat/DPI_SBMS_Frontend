import * as React from 'react';
import {
  Alert,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  FormGroup,
  Checkbox,
  FormControlLabel,
  CircularProgress,
} from '@mui/material';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useApi } from '../hooks/useApi';
import ReusableDataTable from '../components/ReusableData';
import PageContainer from '../components/PageContainer';
import DynamicModal from '../components/DynamicModel';
import { Close, Add } from '@mui/icons-material';
import { PERMISSIONS,BASE_URL } from '../constants/Constants';

const INITIAL_PAGE_SIZE = 10;


export default function RoleManagement() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  
  const { user, hasPermission, token } = useAuth();

  console.log("user permissions ", user);

  // Check user permissions
  const canRead = user?.permissions?.role?.includes('read') || false;
  const canCreate = user?.permissions?.role?.includes('create') || false;
  const canUpdate = user?.permissions?.role?.includes('update') || false;
  const canDelete = user?.permissions?.role?.includes('delete') || false;

   const { get, post, put, del } = useApi(); // Use the hook
  const [rowsState, setRowsState] = React.useState({
    rows: [],
    rowCount: 0,
  });

  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  
  // Modal state
  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalMode, setModalMode] = React.useState('view');
  const [selectedRole, setSelectedRole] = React.useState(null);

  // Permission management state
  const [selectedFeature, setSelectedFeature] = React.useState('');
  const [selectedPermissions, setSelectedPermissions] = React.useState({});
  const [rolePermissions, setRolePermissions] = React.useState([]);

  // Features state (fetched from API)
  const [features, setFeatures] = React.useState([]);
  const [loadingFeatures, setLoadingFeatures] = React.useState(false);
  const [featuresError, setFeaturesError] = React.useState(null);

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

  // Check if user has read permission on mount
  React.useEffect(() => {
    if (!canRead) {
      setError('You do not have permission to view this page');
      // Optionally redirect to unauthorized page
      // navigate('/unauthorized');
    }
  }, [canRead, navigate]);

  // Define role form fields
  const roleFields = [
    {
      name: 'name',
      label: 'Role Name',
      type: 'text',
      required: true,
    },
    {
      name: 'description',
      label: 'Description',
      type: 'text',
      multiline: true,
      rows: 3,
    },
  ];

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

    const fetchFeatures = React.useCallback(async () => {
    setLoadingFeatures(true);
    setFeaturesError(null);
    
    try {
      const response = await fetch(`${BASE_URL}/api/tabs/all`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.data) {
        // Transform API response to match our expected format
        const formattedFeatures = data.data.map(tab => ({
          id: tab.id,
          name: tab.displayName || tab.name,
          originalData: tab
        }));
        
        setFeatures(formattedFeatures);
      } else {
        throw new Error(data.message || 'Failed to fetch features');
      }
    } catch (error) {
      setFeaturesError(error.message || 'Failed to load features');
      console.error('Error loading features:', error);
    } finally {
      setLoadingFeatures(false);
    }
  }, [token]);

  // Load features when modal opens
  React.useEffect(() => {
    if (modalOpen) {
      fetchFeatures();
    }
  }, [modalOpen, fetchFeatures]);


  const handlePermissionChange = (permissionId, isChecked) => {
    setSelectedPermissions(prev => ({
      ...prev,
      [permissionId]: isChecked
    }));
  };

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

  const groupPermissionsByFeature = (permissions) => {
    const grouped = {};
    
    permissions.forEach(perm => {
      if (!grouped[perm.featureId]) {
        grouped[perm.featureId] = {
          featureName: perm.featureName,
          operations: []
        };
      }
      grouped[perm.featureId].operations.push(...perm.operations);
    });
    
    return grouped;
  };
  
  const getPermissionNames = (operations) => {
    return operations
      .map(op => PERMISSIONS.find(p => p.id === op)?.name || op)
      .join(', ');
  };

  const getFeatureName = (featureId) => {
    return features.find(f => f.id === featureId)?.name || `Feature ${featureId}`;
  };
  
  const handleRemoveFeaturePermissions = (featureId) => {
    setRolePermissions(rolePermissions.filter(perm => perm.featureId !== featureId));
  };

  // API call to fetch roles with pagination
  const loadRoles = React.useCallback(async () => {
    if (!canRead) return; // Don't load data if user doesn't have read permission
    
    setError(null);
    setIsLoading(true);

    try {
      const { page, pageSize } = paginationModel;
      
      const apiUrl = `/api/roles/with-permissions?page=${page}&size=${pageSize}`;
      
      const rolesData = await get(apiUrl);
      
      // Handle both paginated and non-paginated responses
      if (Array.isArray(rolesData)) {
        // Direct array response
        setRowsState({
          rows: rolesData,
          rowCount: rolesData.length,
        });
      } else if (rolesData.content) {
        // Paginated response
        setRowsState({
          rows: rolesData.content,
          rowCount: rolesData.totalElements || rolesData.content.length,
        });
      } else {
        // Fallback
        setRowsState({
          rows: [],
          rowCount: 0,
        });
      }
      
    } catch (loadError) {
      setError(loadError.message || 'Failed to load roles');
      console.error('Error loading roles:', loadError);
    } finally {
      setIsLoading(false);
    }
  }, [paginationModel, get, canRead]);

  // Load data when component mounts or pagination changes
  React.useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  // Action handlers - updated to use modal
  const handleView = React.useCallback((roleData) => {
    if (!canRead) return;
    setSelectedRole(roleData);
    setRolePermissions(roleData.permissions || []);
    setModalMode('view');
    setModalOpen(true);
  }, [canRead]);

  const handleEdit = React.useCallback((roleData) => {
    if (!canUpdate) return;
    setSelectedRole(roleData);
    setRolePermissions(roleData.permissions || []);
    setModalMode('edit');
    setModalOpen(true);
  }, [canUpdate]);

  const handleDelete = React.useCallback(
    async (roleData) => {
      if (!canDelete) return;
      
      const confirmed = window.confirm(
        `Do you wish to delete role "${roleData.name}"?`
      );

      if (confirmed) {
        setIsLoading(true);
        try {
          await del(`/api/roles/${roleData.id}`);
          alert('Role deleted successfully!');
          loadRoles();
        } catch (deleteError) {
          alert(`Failed to delete role: ${deleteError.message}`);
        } finally {
          setIsLoading(false);
        }
      }
    },
    [loadRoles, del, canDelete],
  );
  
  const handleCreate = React.useCallback(() => {
    if (!canCreate) return;
    setSelectedRole({});
    setRolePermissions([]);
    setModalMode('create');
    setModalOpen(true);
  }, [canCreate]);

  const handleRefresh = React.useCallback(() => {
    if (!isLoading && canRead) {
      loadRoles();
    }
  }, [isLoading, loadRoles, canRead]);

  const handleRowClick = React.useCallback(
    ({ row }) => {
      handleView(row);
    },
    [handleView],
  );

  const transformPermissionsForApi = (permissions) => {
    const groupedByFeature = {};
    
    permissions.forEach(perm => {
      perm.operations.forEach(operation => {
        if (!groupedByFeature[perm.featureId]) {
          groupedByFeature[perm.featureId] = {
            featureId: parseInt(perm.featureId),
            operations: []
          };
        }
        if (!groupedByFeature[perm.featureId].operations.includes(operation)) {
          groupedByFeature[perm.featureId].operations.push(operation);
        }
      });
    });
    
    return Object.values(groupedByFeature);
  };

  // Handle permission selection
  const handleAddPermissions = () => {
    if (!selectedFeature) {
      alert('Please select a feature first');
      return;
    }

    // Get selected permission IDs
    const selectedOperations = Object.keys(selectedPermissions).filter(
      permissionId => selectedPermissions[permissionId]
    );

    if (selectedOperations.length === 0) {
      alert('Please select at least one permission');
      return;
    }

    // Check if feature already exists in permissions
    const existingFeatureIndex = rolePermissions.findIndex(
      perm => perm.featureId === parseInt(selectedFeature)
    );

    if (existingFeatureIndex >= 0) {
      // Update existing feature permissions
      const updatedPermissions = [...rolePermissions];
      const existingOperations = updatedPermissions[existingFeatureIndex].operations;
      
      // Add new operations that don't already exist
      selectedOperations.forEach(operation => {
        if (!existingOperations.includes(operation)) {
          existingOperations.push(operation);
        }
      });
      
      setRolePermissions(updatedPermissions);
    } else {
      // Create new permission entry
      const selectedFeatureData = features.find(f => f.id === parseInt(selectedFeature));
      const newPermission = {
        featureId: parseInt(selectedFeature),
        featureName: selectedFeatureData?.name || `Feature ${selectedFeature}`,
        operations: selectedOperations,
      };

      setRolePermissions([...rolePermissions, newPermission]);
    }
    
    // Reset selections
    setSelectedFeature('');
    setSelectedPermissions({});
  };
  
  const handleModalSubmit = async (formData) => {
    if (rolePermissions.length === 0) {
      alert('Please add at least one permission');
      return;
    }

    setIsLoading(true);
    try {
      const transformedPermissions = transformPermissionsForApi(rolePermissions);
      
      const submitData = {
        name: formData.name,
        description: formData.description,
        isDefault: formData.isDefault || false,
        permissions: transformedPermissions,
      };

      let response;
      
      if (modalMode === 'create') {
        response = await post('/api/roles/add-role-permission', submitData);
      } else {
        response = await put(`/api/roles/${selectedRole.id}/permissions`, submitData);
      }

      alert(`Role ${modalMode === 'create' ? 'created' : 'updated'} successfully!`);
      setModalOpen(false);
      loadRoles();
    } catch (submitError) {
      alert(`Failed to ${modalMode} role: ${submitError.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const PermissionManager = () => {
    const groupedPermissions = groupPermissionsByFeature(rolePermissions);
    
    return (
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Permissions
          </Typography>
          
          {modalMode !== 'view' && (
            <Grid container spacing={2} alignItems="flex-start">
              {/* Feature selection */}
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Feature *</InputLabel>
                  <Select
                    value={selectedFeature}
                    label="Feature *"
                    onChange={(e) => setSelectedFeature(e.target.value)}
                    sx={{ minWidth: 180 }}
                    disabled={loadingFeatures}
                  >
                    {loadingFeatures ? (
                      <MenuItem disabled>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <CircularProgress size={20} sx={{ mr: 1 }} />
                          Loading features...
                        </Box>
                      </MenuItem>
                    ) : featuresError ? (
                      <MenuItem disabled>
                        Error loading features
                      </MenuItem>
                    ) : (
                      features.map(feature => (
                        <MenuItem key={feature.id} value={feature.id}>
                          {feature.name}
                        </MenuItem>
                      ))
                    )}
                  </Select>
                </FormControl>
                {featuresError && (
                  <Typography variant="caption" color="error">
                    {featuresError}
                  </Typography>
                )}
              </Grid>
              
              {/* Permissions checkboxes */}
              <Grid item xs={12} md={6}>
                <FormControl component="fieldset" fullWidth>
                  <Typography variant="subtitle2" gutterBottom>
                    Select Permissions *
                  </Typography>
                  <FormGroup row>
                    {PERMISSIONS.map(permission => (
                      <FormControlLabel
                        key={permission.id}
                        control={
                          <Checkbox
                            checked={!!selectedPermissions[permission.id]}
                            onChange={(e) => handlePermissionChange(permission.id, e.target.checked)}
                            disabled={!selectedFeature || loadingFeatures}
                          />
                        }
                        label={permission.name}
                        sx={{ mr: 2 }}
                      />
                    ))}
                  </FormGroup>
                </FormControl>
              </Grid>
              
              {/* Add button */}
              <Grid item xs={12} md={2}>
                <Button 
                  variant="contained" 
                  onClick={handleAddPermissions}
                  startIcon={<Add />}
                  fullWidth
                  disabled={!selectedFeature || Object.values(selectedPermissions).every(val => !val) || loadingFeatures}
                  sx={{ height: '56px' }}
                >
                  Add
                </Button>
              </Grid>
            </Grid>
          )}
          
          {rolePermissions.length > 0 && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" gutterBottom>
                Current Permissions ({rolePermissions.length})
              </Typography>
              <List dense sx={{ maxHeight: 200, overflow: 'auto' }}>
                {Object.entries(groupedPermissions).map(([featureId, featureData]) => (
                  <ListItem key={featureId} divider>
                    <ListItemText 
                      primary={featureData.featureName}
                      secondary={getPermissionNames(featureData.operations)}
                      sx={{
                        '& .MuiListItemText-primary': {
                          fontWeight: 'bold',
                          fontSize: '1rem',
                        },
                        '& .MuiListItemText-secondary': {
                          fontSize: '0.9rem',
                          color: 'text.primary',
                          mt: 0.5,
                        }
                      }}
                    />
                    {modalMode !== 'view' && (
                      <ListItemSecondaryAction>
                        <IconButton 
                          edge="end" 
                          aria-label="delete"
                          onClick={() => handleRemoveFeaturePermissions(parseInt(featureId))}
                          size="small"
                          color="error"
                        >
                          <Close />
                        </IconButton>
                      </ListItemSecondaryAction>
                    )}
                  </ListItem>
                ))}
              </List>
            </>
          )}

          {/* Validation message */}
          {rolePermissions.length === 0 && modalMode !== 'view' && (
            <Typography variant="body2" color="error" sx={{ mt: 1 }}>
              At least one permission is required
            </Typography>
          )}
        </CardContent>
      </Card>
    );
  };

  // Column definitions for roles (removed permissions column)
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
        width: 200,
      },
      {
        field: 'description',
        headerName: 'Description',
        width: 250,
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

  const pageTitle = 'Role Management';

  // If user doesn't have read permission, show error message
  if (!canRead) {
    return (
      <PageContainer title={pageTitle} breadcrumbs={[{ title: pageTitle }]}>
        <Alert severity="error" sx={{ mb: 2 }}>
          You do not have permission to view this page
        </Alert>
      </PageContainer>
    );
  }

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
        
        // Actions - conditionally show based on permissions
        onView={canRead ? handleView : null}
        onEdit={canUpdate ? handleEdit : null}
        onDelete={canDelete ? handleDelete : null}
        onCreate={canCreate ? handleCreate : null}
        onRefresh={canRead ? handleRefresh : null}
        
        // Row interaction
        onRowClick={canRead ? handleRowClick : null}
        
        // Configuration
        pageSizeOptions={[5, 10, 25, 50]}
        showToolbar={true}
      />

      {/* Dynamic Modal with Permission Manager */}
      <DynamicModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        mode={modalMode}
        title={`${modalMode === 'create' ? 'Create' : modalMode === 'edit' ? 'Edit' : 'View'} Role`}
        initialData={selectedRole || {}}
        fields={roleFields}
        onSubmit={handleModalSubmit}
        loading={isLoading}
        customContent={<PermissionManager />}
      />
    </PageContainer>
  );
}