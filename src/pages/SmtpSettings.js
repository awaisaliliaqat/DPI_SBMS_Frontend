import * as React from 'react';
import {
  Alert,
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Email as EmailIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { GridActionsCellItem } from '@mui/x-data-grid';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from '../auth/AuthContext';
import { useApi } from '../hooks/useApi';
import ReusableDataTable from '../components/ReusableData';
import PageContainer from '../components/PageContainer';
import DynamicModal from '../components/DynamicModel';

const INITIAL_PAGE_SIZE = 10;

export default function SmtpSettings() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const { user } = useAuth();

  // Check user permissions
  const canRead = user?.permissions?.smtpSettings?.includes('read') || false;
  const canCreate = user?.permissions?.smtpSettings?.includes('create') || false;
  const canUpdate = user?.permissions?.smtpSettings?.includes('update') || false;
  const canDelete = user?.permissions?.smtpSettings?.includes('delete') || false;

  const { get, post, put, del } = useApi();
  const [rowsState, setRowsState] = React.useState({
    rows: [],
    rowCount: 0,
  });

  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  
  // Modal state
  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalMode, setModalMode] = React.useState('view');
  const [selectedSetting, setSelectedSetting] = React.useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [settingToDelete, setSettingToDelete] = React.useState(null);
  const [testLoading, setTestLoading] = React.useState(false);
  
  // Test email dialog state
  const [testEmailDialogOpen, setTestEmailDialogOpen] = React.useState(false);
  const [testEmailSetting, setTestEmailSetting] = React.useState(null);
  const [testEmailTo, setTestEmailTo] = React.useState('');
  const [testEmailText, setTestEmailText] = React.useState('');
  const [sendingTestEmail, setSendingTestEmail] = React.useState(false);
  const [testingCredentials, setTestingCredentials] = React.useState(false);
  
  // Test credentials dialog state
  const [testCredentialsDialogOpen, setTestCredentialsDialogOpen] = React.useState(false);
  const [testCredentialsFormData, setTestCredentialsFormData] = React.useState(null);
  const [testCredentialsTo, setTestCredentialsTo] = React.useState('');
  const [testCredentialsText, setTestCredentialsText] = React.useState('');

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

  // Validation functions
  const validateSmtpHost = (host) => {
    if (!host || host.trim() === '') return 'SMTP Host is required';
    return '';
  };

  const validateSmtpPort = (port) => {
    if (!port) return 'SMTP Port is required';
    const portNum = parseInt(port);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      return 'SMTP Port must be a valid number between 1 and 65535';
    }
    return '';
  };

  const validateUsername = (username) => {
    if (!username || username.trim() === '') return 'Username is required';
    return '';
  };

  const validatePassword = (password) => {
    if (!password || password.trim() === '') return 'Password is required';
    return '';
  };

  const validateFromName = (name) => {
    if (!name || name.trim() === '') return 'From Name is required';
    return '';
  };

  const validateFromEmail = (email) => {
    if (!email || email.trim() === '') return 'From Email is required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return 'Invalid email format';
    return '';
  };

  // Check if user has read permission on mount
  React.useEffect(() => {
    if (!canRead) {
      setError('You do not have permission to view this page');
      toast.error('You do not have permission to view this page', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    }
  }, [canRead]);

  // Define SMTP settings form fields
  const smtpFields = [
    {
      name: 'smtp_host',
      label: 'SMTP Host',
      type: 'text',
      required: true,
      validate: validateSmtpHost,
      tooltip: 'e.g., smtp.gmail.com',
    },
    {
      name: 'smtp_port',
      label: 'SMTP Port',
      type: 'number',
      required: true,
      validate: validateSmtpPort,
      tooltip: 'Common ports: 587 (TLS), 465 (SSL), 25',
    },
    {
      name: 'username',
      label: 'Username',
      type: 'text',
      required: true,
      validate: validateUsername,
      tooltip: 'SMTP username/email',
    },
    {
      name: 'password',
      label: 'Password',
      type: 'password',
      required: true,
      validate: validatePassword,
      tooltip: 'SMTP password (stored in plain text)',
    },
    {
      name: 'from_name',
      label: 'From Name',
      type: 'text',
      required: true,
      validate: validateFromName,
      tooltip: 'Display name for the sender',
    },
    {
      name: 'from_email',
      label: 'From Email',
      type: 'email',
      required: true,
      validate: validateFromEmail,
      tooltip: 'Email address for the sender',
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

  // API call to fetch SMTP settings with pagination
  const loadSmtpSettings = React.useCallback(async () => {
    if (!canRead) return;
    
    setError(null);
    setIsLoading(true);

    try {
      const { page, pageSize } = paginationModel;
      
      const apiUrl = `/api/smtp-settings?page=${page}&size=${pageSize}`;
      
      const settingsData = await get(apiUrl);
      
      if (settingsData.success) {
        setRowsState({
          rows: settingsData.data || [],
          rowCount: settingsData.totalCount || 0,
        });
      } else {
        setRowsState({
          rows: [],
          rowCount: 0,
        });
      }
      
    } catch (loadError) {
      setError(loadError.message || 'Failed to load SMTP settings');
      toast.error('Failed to load SMTP settings', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      console.error('Error loading SMTP settings:', loadError);
    } finally {
      setIsLoading(false);
    }
  }, [paginationModel, get, canRead]);

  // Load data when component mounts or pagination changes
  React.useEffect(() => {
    loadSmtpSettings();
  }, [loadSmtpSettings]);

  // Action handlers
  const handleView = React.useCallback((settingData) => {
    if (!canRead) return;
    setSelectedSetting(settingData);
    setModalMode('view');
    setModalOpen(true);
  }, [canRead]);

  const handleEdit = React.useCallback((settingData) => {
    if (!canUpdate) return;
    setSelectedSetting(settingData);
    setModalMode('edit');
    setModalOpen(true);
  }, [canUpdate]);

  const handleDelete = React.useCallback(
    (settingData) => {
      if (!canDelete) return;
      setSettingToDelete(settingData);
      setDeleteDialogOpen(true);
    },
    [canDelete],
  );

  const confirmDelete = React.useCallback(async () => {
    if (!settingToDelete) return;
    
    setIsLoading(true);
    try {
      await del(`/api/smtp-settings/${settingToDelete.id}`);
      toast.success('SMTP setting deleted successfully!', {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      setDeleteDialogOpen(false);
      setSettingToDelete(null);
      loadSmtpSettings();
    } catch (deleteError) {
      toast.error(`Failed to delete SMTP setting: ${deleteError.message}`, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      setDeleteDialogOpen(false);
    } finally {
      setIsLoading(false);
    }
  }, [settingToDelete, del, loadSmtpSettings]);

  const cancelDelete = React.useCallback(() => {
    setDeleteDialogOpen(false);
    setSettingToDelete(null);
  }, []);
  
  const handleCreate = React.useCallback(() => {
    if (!canCreate) return;
    setSelectedSetting({});
    setModalMode('create');
    setModalOpen(true);
  }, [canCreate]);

  const handleRefresh = React.useCallback(() => {
    if (!isLoading && canRead) {
      loadSmtpSettings();
    }
  }, [isLoading, loadSmtpSettings, canRead]);

  const handleRowClick = React.useCallback(
    ({ row }) => {
      handleView(row);
    },
    [handleView],
  );

  const handleTestConnection = React.useCallback(async (settingId) => {
    setTestLoading(true);
    try {
      await post(`/api/smtp-settings/${settingId}/test`);
      toast.success('SMTP connection test successful!', {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } catch (testError) {
      toast.error(`SMTP connection test failed: ${testError.message}`, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } finally {
      setTestLoading(false);
    }
  }, [post]);

  const handleOpenTestEmailDialog = React.useCallback((settingData) => {
    setTestEmailSetting(settingData);
    setTestEmailTo('');
    setTestEmailText('');
    setTestEmailDialogOpen(true);
  }, []);

  const handleCloseTestEmailDialog = React.useCallback(() => {
    setTestEmailDialogOpen(false);
    setTestEmailSetting(null);
    setTestEmailTo('');
    setTestEmailText('');
  }, []);

  const handleSendTestEmail = React.useCallback(async () => {
    if (!testEmailSetting || !testEmailTo || !testEmailTo.trim()) {
      toast.error('Please enter a recipient email address', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(testEmailTo.trim())) {
      toast.error('Invalid email format', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      return;
    }

    setSendingTestEmail(true);
    try {
      const response = await post(`/api/smtp-settings/${testEmailSetting.id}/send-test-email`, {
        to: testEmailTo.trim(),
        text: testEmailText.trim() || 'This is a test email from the SMTP Settings configuration.'
      });

      if (response.success) {
        toast.success('Test email sent successfully!', {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
        handleCloseTestEmailDialog();
      } else {
        throw new Error(response.message || 'Failed to send test email');
      }
    } catch (error) {
      toast.error(`Failed to send test email: ${error.message}`, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } finally {
      setSendingTestEmail(false);
    }
  }, [testEmailSetting, testEmailTo, testEmailText, post, handleCloseTestEmailDialog]);

  const handleTestCredentials = React.useCallback((formData) => {
    // Validate required fields
    if (!formData.smtp_host || !formData.smtp_port || !formData.username || !formData.password) {
      toast.error('Please fill in all required fields (SMTP Host, Port, Username, Password)', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      return;
    }

    // Open dialog to ask for recipient email and message
    setTestCredentialsFormData(formData);
    setTestCredentialsTo('');
    setTestCredentialsText('');
    setTestCredentialsDialogOpen(true);
  }, []);

  const handleCloseTestCredentialsDialog = React.useCallback(() => {
    setTestCredentialsDialogOpen(false);
    setTestCredentialsFormData(null);
    setTestCredentialsTo('');
    setTestCredentialsText('');
  }, []);

  const handleSendTestCredentialsEmail = React.useCallback(async () => {
    if (!testCredentialsFormData || !testCredentialsTo || !testCredentialsTo.trim()) {
      toast.error('Please enter a recipient email address', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(testCredentialsTo.trim())) {
      toast.error('Invalid email format', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      return;
    }

    setTestingCredentials(true);
    try {
      const response = await post('/api/smtp-settings/test-credentials', {
        smtp_host: testCredentialsFormData.smtp_host,
        smtp_port: testCredentialsFormData.smtp_port,
        secure: testCredentialsFormData.secure || false,
        username: testCredentialsFormData.username,
        password: testCredentialsFormData.password,
        from_name: testCredentialsFormData.from_name,
        from_email: testCredentialsFormData.from_email,
        to: testCredentialsTo.trim(),
        text: testCredentialsText.trim() || 'This is a test email from the SMTP Settings configuration.'
      });

      if (response.success) {
        toast.success('SMTP credentials test successful and test email sent!', {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
        handleCloseTestCredentialsDialog();
      } else {
        throw new Error(response.message || 'Failed to test credentials');
      }
    } catch (error) {
      toast.error(`SMTP credentials test failed: ${error.message}`, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } finally {
      setTestingCredentials(false);
    }
  }, [testCredentialsFormData, testCredentialsTo, testCredentialsText, post, handleCloseTestCredentialsDialog]);

  const handleModalSubmit = async (formData) => {
    // Validate all fields
    const errors = {};
    smtpFields.forEach(field => {
      if (field.validate) {
        const error = field.validate(formData[field.name]);
        if (error) errors[field.name] = error;
      }
    });

    if (Object.keys(errors).length > 0) {
      const firstError = Object.values(errors)[0];
      toast.error(firstError, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      return;
    }

    setIsLoading(true);
    try {
      const submitData = {
        smtp_host: formData.smtp_host.trim(),
        smtp_port: parseInt(formData.smtp_port),
        secure: formData.secure || false,
        username: formData.username.trim(),
        password: formData.password,
        from_name: formData.from_name.trim(),
        from_email: formData.from_email.trim().toLowerCase(),
        is_active: true, // Always set to true by default
        is_default: formData.is_default !== undefined ? formData.is_default : false
      };

      if (modalMode === 'create') {
        await post('/api/smtp-settings', submitData);
      } else {
        await put(`/api/smtp-settings/${selectedSetting.id}`, submitData);
      }

      const successMessage = modalMode === 'create' 
        ? 'SMTP setting created successfully!' 
        : 'SMTP setting updated successfully!';
      
      toast.success(successMessage, {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      
      setModalOpen(false);
      loadSmtpSettings();
    } catch (submitError) {
      let errorMessage = `Failed to ${modalMode} SMTP setting`;
      
      if (submitError.response && submitError.response.data) {
        const serverError = submitError.response.data;
        if (serverError.message) {
          errorMessage = serverError.message;
        } else if (typeof serverError === 'string') {
          errorMessage = serverError;
        } else if (serverError.error) {
          errorMessage = serverError.error;
        }
      } else if (submitError.message) {
        errorMessage = submitError.message;
      }
      
      toast.error(errorMessage, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Custom content for modal - add Secure and Default checkboxes
  const CustomModalContent = ({ formData = {}, setFormData, mode = 'view' }) => {
    // Safety check for formData and setFormData
    if (!formData || !setFormData) {
      return null;
    }

    return (
      <Box sx={{ mt: 2, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 'bold', color: 'text.primary' }}>
          Additional Settings
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.secure || false}
                onChange={(e) => setFormData({ ...formData, secure: e.target.checked })}
                disabled={mode === 'view'}
                color="primary"
              />
            }
            label="Secure (TLS/SSL)"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.is_default || false}
                onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                disabled={mode === 'view'}
                color="primary"
              />
            }
            label="Default"
          />
        </Box>
      </Box>
    );
  };

  // Column definitions
  const columns = React.useMemo(
    () => [
      { 
        field: 'id', 
        headerName: 'ID',
        width: 70,
        align: 'left',
        headerAlign: 'left',
      },
      {
        field: 'smtp_host',
        headerName: 'SMTP Host',
        width: 200,
        align: 'left',
        headerAlign: 'left',
      },
      {
        field: 'smtp_port',
        headerName: 'Port',
        width: 100,
        align: 'left',
        headerAlign: 'left',
      },
      {
        field: 'secure',
        headerName: 'Secure',
        width: 100,
        align: 'left',
        headerAlign: 'left',
        renderCell: (params) => (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Typography variant="body2">
              {params.value ? 'Yes' : 'No'}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'username',
        headerName: 'Username',
        width: 200,
        align: 'left',
        headerAlign: 'left',
      },
      {
        field: 'from_name',
        headerName: 'From Name',
        width: 150,
        align: 'left',
        headerAlign: 'left',
      },
      {
        field: 'from_email',
        headerName: 'From Email',
        width: 200,
        align: 'left',
        headerAlign: 'left',
      },
      {
        field: 'is_active',
        headerName: 'Active',
        width: 100,
        align: 'left',
        headerAlign: 'left',
        renderCell: (params) => (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Typography 
              variant="body2" 
              sx={{ 
                color: params.value ? 'success.main' : 'text.secondary',
                fontWeight: params.value ? 'bold' : 'normal'
              }}
            >
              {params.value ? 'Yes' : 'No'}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'is_default',
        headerName: 'Default',
        width: 100,
        align: 'left',
        headerAlign: 'left',
        renderCell: (params) => (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Typography 
              variant="body2" 
              sx={{ 
                color: params.value ? 'primary.main' : 'text.secondary',
                fontWeight: params.value ? 'bold' : 'normal'
              }}
            >
              {params.value ? 'Yes' : 'No'}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'created_at',
        headerName: 'Created At',
        width: 180,
        align: 'left',
        headerAlign: 'left',
        valueFormatter: (params) => {
          if (!params.value) return '';
          try {
            const date = new Date(params.value);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
          } catch (error) {
            return params.value;
          }
        },
      },
      {
        field: 'actions',
        type: 'actions',
        headerName: 'Actions',
        width: 200,
        getActions: (params) => {
          const row = params.row;
          const actions = [];
          
          // View action
          if (canRead) {
            actions.push(
              <GridActionsCellItem
                key="view"
                icon={<Tooltip title="View"><VisibilityIcon /></Tooltip>}
                label="View"
                onClick={() => handleView(row)}
                color="primary"
              />
            );
          }
          
          // Edit action
          if (canUpdate) {
            actions.push(
              <GridActionsCellItem
                key="edit"
                icon={<Tooltip title="Edit"><EditIcon /></Tooltip>}
                label="Edit"
                onClick={() => handleEdit(row)}
                color="info"
              />
            );
          }
          
          // Send Test Email action
          if (canRead) {
            actions.push(
              <GridActionsCellItem
                key="sendTestEmail"
                icon={<Tooltip title="Send Test Email"><EmailIcon /></Tooltip>}
                label="Send Test Email"
                onClick={() => handleOpenTestEmailDialog(row)}
                color="success"
              />
            );
          }
          
          // Delete action
          if (canDelete) {
            actions.push(
              <GridActionsCellItem
                key="delete"
                icon={<Tooltip title="Delete"><DeleteIcon /></Tooltip>}
                label="Delete"
                onClick={() => handleDelete(row)}
                color="error"
              />
            );
          }
          
          return actions;
        },
      },
    ],
    [canRead, canUpdate, canDelete, handleView, handleEdit, handleDelete],
  );

  const pageTitle = 'SMTP Settings';

  // If user doesn't have read permission, show error message
  if (!canRead) {
    return (
      <PageContainer title={pageTitle} breadcrumbs={[{ title: pageTitle }]}>
        <Alert severity="error" sx={{ mb: 2 }}>
          You do not have permission to view this page
        </Alert>
        
        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
          toastStyle={{
            backgroundColor: '#ffffff',
            color: '#333333',
          }}
        />
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
        
        // Actions - disable default actions since we have custom ones in columns
        onView={null}
        onEdit={null}
        onDelete={null}
        onCreate={canCreate ? handleCreate : null}
        onRefresh={canRead ? handleRefresh : null}
        
        // Row interaction
        onRowClick={canRead ? handleRowClick : null}
        
        // Configuration
        pageSizeOptions={[5, 10, 25, 50]}
        showToolbar={true}
      />

      {/* Dynamic Modal */}
      <DynamicModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        mode={modalMode}
        title={`${modalMode === 'create' ? 'Create' : modalMode === 'edit' ? 'Edit' : 'View'} SMTP Setting`}
        initialData={selectedSetting || {}}
        fields={smtpFields}
        onSubmit={handleModalSubmit}
        loading={isLoading}
        customContent={CustomModalContent}
        submitButtonText={modalMode === 'create' ? 'Save' : 'Update'}
        onTestCredentials={modalMode !== 'view' ? handleTestCredentials : null}
        testingCredentials={testingCredentials}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={cancelDelete}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
        PaperProps={{
          sx: {
            backgroundColor: '#ffffff',
            minWidth: '400px',
          }
        }}
      >
        <DialogTitle 
          id="delete-dialog-title"
          sx={{ 
            color: '#d32f2f',
            fontWeight: 'bold',
          }}
        >
          Confirm Delete
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#333', mb: 2 }}>
            Are you sure you want to delete the SMTP setting for <strong>"{settingToDelete?.smtp_host}"</strong>?
          </Typography>
          <Typography variant="body2" sx={{ color: '#666' }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button 
            onClick={cancelDelete}
            variant="outlined"
            sx={{ 
              color: '#666',
              borderColor: '#ddd',
              '&:hover': {
                borderColor: '#999',
                backgroundColor: '#f5f5f5',
              }
            }}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={confirmDelete}
            variant="contained"
            sx={{
              backgroundColor: '#d32f2f',
              color: '#ffffff',
              '&:hover': {
                backgroundColor: '#c62828',
              },
              '&:disabled': {
                backgroundColor: '#ffcdd2',
                color: '#ffffff',
              }
            }}
            disabled={isLoading}
          >
            {isLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Send Test Email Dialog */}
      <Dialog
        open={testEmailDialogOpen}
        onClose={handleCloseTestEmailDialog}
        aria-labelledby="test-email-dialog-title"
        PaperProps={{
          sx: {
            backgroundColor: '#ffffff',
            minWidth: '500px',
            maxWidth: '600px',
          }
        }}
      >
        <DialogTitle 
          id="test-email-dialog-title"
          sx={{ 
            color: 'primary.main',
            fontWeight: 'bold',
          }}
        >
          Send Test Email
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#333', mb: 2 }}>
            Send a test email using SMTP setting: <strong>{testEmailSetting?.smtp_host}</strong>
          </Typography>
          
          <TextField
            fullWidth
            label="To Email *"
            type="email"
            value={testEmailTo}
            onChange={(e) => setTestEmailTo(e.target.value)}
            variant="outlined"
            required
            sx={{ mb: 2 }}
            helperText="Enter the recipient email address"
          />
          
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Email Text"
            value={testEmailText}
            onChange={(e) => setTestEmailText(e.target.value)}
            variant="outlined"
            placeholder="Enter the email message text (optional)"
            helperText="Leave empty to use default test message"
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button 
            onClick={handleCloseTestEmailDialog}
            variant="outlined"
            sx={{ 
              color: '#666',
              borderColor: '#ddd',
              '&:hover': {
                borderColor: '#999',
                backgroundColor: '#f5f5f5',
              }
            }}
            disabled={sendingTestEmail}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSendTestEmail}
            variant="contained"
            color="primary"
            disabled={sendingTestEmail || !testEmailTo.trim()}
            startIcon={sendingTestEmail ? <CircularProgress size={20} /> : <EmailIcon />}
          >
            {sendingTestEmail ? 'Sending...' : 'Send Test Email'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Test Credentials Dialog */}
      <Dialog
        open={testCredentialsDialogOpen}
        onClose={handleCloseTestCredentialsDialog}
        aria-labelledby="test-credentials-dialog-title"
        PaperProps={{
          sx: {
            backgroundColor: '#ffffff',
            minWidth: '500px',
            maxWidth: '600px',
          }
        }}
      >
        <DialogTitle 
          id="test-credentials-dialog-title"
          sx={{ 
            color: 'primary.main',
            fontWeight: 'bold',
          }}
        >
          Test Credentials & Send Test Email
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#333', mb: 2 }}>
            Test SMTP credentials and send a test email to verify the configuration.
          </Typography>
          
          <TextField
            fullWidth
            label="To Email *"
            type="email"
            value={testCredentialsTo}
            onChange={(e) => setTestCredentialsTo(e.target.value)}
            variant="outlined"
            required
            sx={{ mb: 2 }}
            helperText="Enter the recipient email address"
          />
          
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Email Message"
            value={testCredentialsText}
            onChange={(e) => setTestCredentialsText(e.target.value)}
            variant="outlined"
            placeholder="Enter the email message text (optional)"
            helperText="Leave empty to use default test message"
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button 
            onClick={handleCloseTestCredentialsDialog}
            variant="outlined"
            sx={{ 
              color: '#666',
              borderColor: '#ddd',
              '&:hover': {
                borderColor: '#999',
                backgroundColor: '#f5f5f5',
              }
            }}
            disabled={testingCredentials}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSendTestCredentialsEmail}
            variant="contained"
            color="primary"
            disabled={testingCredentials || !testCredentialsTo.trim()}
            startIcon={testingCredentials ? <CircularProgress size={20} /> : <EmailIcon />}
          >
            {testingCredentials ? 'Testing & Sending...' : 'Test & Send Email'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* React Toastify Container */}
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
        toastStyle={{
          backgroundColor: '#ffffff',
          color: '#333333',
        }}
      />
    </PageContainer>
  );
}

