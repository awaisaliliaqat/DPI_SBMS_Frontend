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
  MenuItem,
  Chip,
  Select,
  InputLabel,
  FormControl,
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

  // Fields shared by both SMTP and EWS.
  // Protocol selector and SMTP-only fields are rendered inside CustomModalContent
  // using a plain MUI Select (not Autocomplete) to avoid rendering issues.
  const smtpFields = [
    {
      name: 'smtp_host',
      label: 'Host',
      type: 'text',
      required: true,
      validate: validateSmtpHost,
      tooltip: 'SMTP: e.g. smtp.gmail.com   |   EWS: e.g. webmail.company.com',
    },
    {
      name: 'username',
      label: 'Username',
      type: 'text',
      required: true,
      validate: validateUsername,
      tooltip: 'SMTP username / Exchange account email',
    },
    {
      name: 'password',
      label: 'Password',
      type: 'password',
      required: true,
      validate: validatePassword,
      tooltip: 'Password (stored in plain text)',
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
    const isEws = formData.protocol === 'ews';

    if (isEws) {
      if (!formData.smtp_host || !formData.username || !formData.password) {
        toast.error('Please fill in Host, Username, and Password to test EWS credentials', {
          position: "top-right", autoClose: 5000, hideProgressBar: false,
          closeOnClick: true, pauseOnHover: true, draggable: true,
        });
        return;
      }
    } else {
      if (!formData.smtp_host || !formData.smtp_port || !formData.username || !formData.password) {
        toast.error('Please fill in all required fields (Host, Port, Username, Password)', {
          position: "top-right", autoClose: 5000, hideProgressBar: false,
          closeOnClick: true, pauseOnHover: true, draggable: true,
        });
        return;
      }
    }

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
        protocol: testCredentialsFormData.protocol || 'smtp',
        smtp_host: testCredentialsFormData.smtp_host,
        smtp_port: testCredentialsFormData.smtp_port,
        secure: testCredentialsFormData.secure || false,
        username: testCredentialsFormData.username,
        password: testCredentialsFormData.password,
        from_name: testCredentialsFormData.from_name,
        from_email: testCredentialsFormData.from_email,
        to: testCredentialsTo.trim(),
        text: testCredentialsText.trim() || 'This is a test email from the Email Settings configuration.'
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
    const isEws = formData.protocol === 'ews';

    // Shared field validation
    const sharedErrors = {};
    smtpFields.forEach(field => {
      if (field.validate) {
        const error = field.validate(formData[field.name]);
        if (error) sharedErrors[field.name] = error;
      }
    });

    // SMTP-only field validation
    if (!isEws) {
      const portError = validateSmtpPort(formData.smtp_port);
      if (portError) sharedErrors.smtp_port = portError;
      const fromNameError = validateFromName(formData.from_name);
      if (fromNameError) sharedErrors.from_name = fromNameError;
      const fromEmailError = validateFromEmail(formData.from_email);
      if (fromEmailError) sharedErrors.from_email = fromEmailError;
    }

    if (Object.keys(sharedErrors).length > 0) {
      toast.error(Object.values(sharedErrors)[0], {
        position: "top-right", autoClose: 5000, hideProgressBar: false,
        closeOnClick: true, pauseOnHover: true, draggable: true,
      });
      return;
    }

    setIsLoading(true);
    try {
      const submitData = {
        protocol: formData.protocol || 'smtp',
        smtp_host: formData.smtp_host.trim(),
        smtp_port: isEws ? null : parseInt(formData.smtp_port),
        secure: isEws ? false : (formData.secure || false),
        username: formData.username.trim(),
        password: formData.password,
        from_name: isEws ? null : (formData.from_name ? formData.from_name.trim() : null),
        from_email: isEws ? null : (formData.from_email ? formData.from_email.trim().toLowerCase() : null),
        is_active: true,
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

  // Custom content for modal — renders protocol selector, SMTP-only fields + shared checkboxes
  const CustomModalContent = ({ formData = {}, setFormData, mode = 'view' }) => {
    if (!formData || !setFormData) return null;

    const isEws = formData.protocol === 'ews';
    const isView = mode === 'view';

    const fieldSx = { mb: 2 };

    return (
      <Box sx={{ mt: 1 }}>

        {/* ── Protocol selector (plain Select — no Autocomplete) ───────────── */}
        <FormControl fullWidth sx={{ mb: 2, mt: 1 }} variant={isView ? 'filled' : 'outlined'}>
          <InputLabel id="protocol-label">Protocol *</InputLabel>
          <Select
            labelId="protocol-label"
            value={formData.protocol || 'smtp'}
            label="Protocol *"
            onChange={(e) => setFormData({ ...formData, protocol: e.target.value })}
            disabled={isView}
          >
            <MenuItem value="smtp">SMTP</MenuItem>
            <MenuItem value="ews">Exchange Web Services (EWS)</MenuItem>
          </Select>
        </FormControl>

        {/* ── SMTP-only fields ─────────────────────────────────────────────── */}
        {!isEws && (
          <Box>
            <TextField
              fullWidth
              label="SMTP Port *"
              type="number"
              value={formData.smtp_port || ''}
              onChange={(e) => setFormData({ ...formData, smtp_port: e.target.value })}
              disabled={isView}
              variant="outlined"
              sx={fieldSx}
              helperText="Common ports: 587 (TLS), 465 (SSL), 25"
              inputProps={{ min: 1, max: 65535 }}
            />
            <TextField
              fullWidth
              label="From Name *"
              value={formData.from_name || ''}
              onChange={(e) => setFormData({ ...formData, from_name: e.target.value })}
              disabled={isView}
              variant="outlined"
              sx={fieldSx}
              helperText="Display name shown to recipients"
            />
            <TextField
              fullWidth
              label="From Email *"
              type="email"
              value={formData.from_email || ''}
              onChange={(e) => setFormData({ ...formData, from_email: e.target.value })}
              disabled={isView}
              variant="outlined"
              sx={fieldSx}
              helperText="Sender email address"
            />
          </Box>
        )}

        {/* EWS info banner */}
        {isEws && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 0.5 }}>
              Exchange Web Services (EWS)
            </Typography>
            <Typography variant="body2">
              Only <strong>Host</strong>, <strong>Username</strong> (Exchange email), and <strong>Password</strong> are required.
              Emails are sent via the authenticated Exchange account — no port or From fields needed.
            </Typography>
          </Alert>
        )}

        {/* ── Additional settings ───────────────────────────────────────────── */}
        <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 'bold', color: 'text.primary' }}>
          Additional Settings
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {!isEws && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.secure || false}
                  onChange={(e) => setFormData({ ...formData, secure: e.target.checked })}
                  disabled={isView}
                  color="primary"
                />
              }
              label="Secure (TLS/SSL)"
            />
          )}
          <Box>
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.is_default || false}
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    if (isChecked && !isView) {
                      toast.warning(
                        'From now on this will be the default setting for sending email. Only one setting at a time can be marked as default.',
                        { position: "top-right", autoClose: 6000, hideProgressBar: false, closeOnClick: true, pauseOnHover: true, draggable: true }
                      );
                    }
                    setFormData({ ...formData, is_default: isChecked });
                  }}
                  disabled={isView}
                  color="primary"
                />
              }
              label="Default"
            />
            {formData.is_default && !isView && (
              <Alert
                severity="info"
                sx={{
                  mt: 1.5,
                  backgroundColor: '#e3f2fd',
                  border: '1px solid #90caf9',
                  '& .MuiAlert-icon': { color: '#1976d2' },
                  '& .MuiAlert-message': { color: '#1976d2' }
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 0.5 }}>
                  ⓘ Default Setting Selected
                </Typography>
                <Typography variant="body2">
                  From now on this will be the default setting for sending email. Only one setting at a time can be marked as default. Any existing default setting will be automatically unset.
                </Typography>
              </Alert>
            )}
          </Box>
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
        field: 'protocol',
        headerName: 'Protocol',
        width: 130,
        align: 'left',
        headerAlign: 'left',
        renderCell: (params) => (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Chip
              label={params.value === 'ews' ? 'EWS' : 'SMTP'}
              size="small"
              color={params.value === 'ews' ? 'secondary' : 'primary'}
              variant="outlined"
            />
          </Box>
        ),
      },
      {
        field: 'smtp_host',
        headerName: 'Host',
        width: 200,
        align: 'left',
        headerAlign: 'left',
      },
      {
        field: 'smtp_port',
        headerName: 'Port',
        width: 90,
        align: 'left',
        headerAlign: 'left',
        renderCell: (params) => (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Typography variant="body2">{params.value || '—'}</Typography>
          </Box>
        ),
      },
      {
        field: 'secure',
        headerName: 'Secure',
        width: 90,
        align: 'left',
        headerAlign: 'left',
        renderCell: (params) => (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Typography variant="body2">
              {params.row?.protocol === 'ews' ? '—' : (params.value ? 'Yes' : 'No')}
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
        renderCell: (params) => (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Typography variant="body2">{params.value || '—'}</Typography>
          </Box>
        ),
      },
      {
        field: 'from_email',
        headerName: 'From Email',
        width: 200,
        align: 'left',
        headerAlign: 'left',
        renderCell: (params) => (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Typography variant="body2">{params.value || '—'}</Typography>
          </Box>
        ),
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

  const pageTitle = 'Email Settings';

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
        title={`${modalMode === 'create' ? 'Create' : modalMode === 'edit' ? 'Edit' : 'View'} Email Setting`}
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
            maxWidth: '600px',
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
          
          {/* Show warning if deleting default setting */}
          {settingToDelete?.is_default && (
            <Alert 
              severity="warning" 
              sx={{ 
                mb: 2,
                backgroundColor: '#fff3cd',
                border: '1px solid #ffc107',
                '& .MuiAlert-icon': {
                  color: '#856404',
                },
                '& .MuiAlert-message': {
                  color: '#856404',
                }
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                ⚠️ Warning: You are deleting a default email setting!
              </Typography>
              <Typography variant="body2">
                Email in the system will not be sent if this default setting is deleted. 
                Please ensure you have another SMTP setting configured as default before proceeding.
              </Typography>
            </Alert>
          )}
          
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
            {testCredentialsFormData?.protocol === 'ews'
              ? 'Send a test email via Exchange Web Services (EWS) to verify credentials.'
              : 'Test SMTP credentials and send a test email to verify the configuration.'}
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

