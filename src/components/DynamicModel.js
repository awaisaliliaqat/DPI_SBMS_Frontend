import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  IconButton,
  Chip,
  FormHelperText,
  Switch,
  FormControlLabel,
  Divider,
  Alert,
  Tooltip,
  Autocomplete,
  CircularProgress,
} from '@mui/material';
import { Close, Edit, Visibility, VpnKey, Cancel } from '@mui/icons-material';

const DynamicModal = ({
  open,
  onClose,
  mode, // 'create', 'view', or 'edit'
  title,
  initialData = {},
  fields = [],
  onSubmit,
  loading = false,
  customContent = null,
  headerContent = null,
  showPasswordChange = false,
  onTogglePasswordChange,
  isEditMode = false,
  submitButtonText = null, // Custom submit button text
  onTestCredentials = null, // Function to test credentials
  testingCredentials = false, // Loading state for testing credentials
}) => {
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  // Initialize form data when modal opens or initialData changes
  useEffect(() => {
    if (open) {
      setFormData(initialData);
      setErrors({});
      setTouched({});
    }
  }, [open, initialData]);

  // Clear password fields when password change is canceled, or initialize when enabled
  useEffect(() => {
    if (isEditMode) {
      if (!showPasswordChange) {
        // Clear password fields when password change is canceled
        setFormData(prev => {
          const { password, confirmPassword, ...rest } = prev;
          return rest;
        });
        setErrors(prev => {
          const { password, confirmPassword, ...rest } = prev;
          return rest;
        });
        setTouched(prev => {
          const { password, confirmPassword, ...rest } = prev;
          return rest;
        });
      } else {
        // Initialize password fields when password change is enabled
        setFormData(prev => ({
          ...prev,
          password: prev.password || '',
          confirmPassword: prev.confirmPassword || '',
        }));
      }
    }
  }, [showPasswordChange, isEditMode]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Validate field if it's been touched
    if (touched[field]) {
      validateField(field, value);
    }
  };

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    validateField(field, formData[field]);
  };

  const validateField = (fieldName, value) => {
    const field = fields.find(f => f.name === fieldName);
    if (field && field.validate) {
      const error = field.validate(value, formData);
      setErrors(prev => ({ ...prev, [fieldName]: error }));
      return error;
    }
    return '';
  };

  const validateForm = () => {
    const newErrors = {};
    let isValid = true;
    
    fields.forEach(field => {
      if (field.required && !formData[field.name]) {
        newErrors[field.name] = `${field.label} is required`;
        isValid = false;
      } else if (field.validate) {
        const error = field.validate(formData[field.name], formData);
        if (error) {
          newErrors[field.name] = error;
          isValid = false;
        }
      }
    });

    // Additional password validation for edit mode
    if (isEditMode && showPasswordChange) {
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = () => {
    // Mark all fields as touched
    const allTouched = {};
    fields.forEach(field => {
      allTouched[field.name] = true;
    });
    setTouched(allTouched);
    
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const renderField = (field) => {
    const { 
      name, 
      label, 
      type, 
      options, 
      required, 
      disabled, 
      multiline, 
      rows, 
      placeholder,
      tooltip,
      inputProps = {},
      validate,
      valueFormatter,
      ...otherProps
    } = field;
    
    const rawValue = formData[name];
    // For multi-select, default to empty array if undefined/null
    const defaultValue = field.multiple ? [] : '';
    const rawValueWithDefault = rawValue !== undefined && rawValue !== null ? rawValue : defaultValue;
    const value = valueFormatter ? valueFormatter(rawValueWithDefault) : rawValueWithDefault;
    const error = errors[name] || '';
    const isViewMode = mode === 'view';
    const isDisabled = isViewMode || disabled;

    const fieldElement = (
      <>
        {type === 'text' || type === 'email' || type === 'password' || type === 'number' ? (
          <TextField
            key={name}
            fullWidth
            type={type}
            label={label}
            value={value}
            onChange={(e) => handleChange(name, e.target.value)}
            onBlur={() => handleBlur(name)}
            error={!!error}
            helperText={error}
            required={required}
            disabled={isDisabled}
            multiline={multiline}
            rows={rows}
            margin="normal"
            variant={isViewMode ? "filled" : "outlined"}
            placeholder={placeholder}
            inputProps={inputProps}
            InputProps={{
              readOnly: isViewMode,
              ...otherProps.inputProps,
            }}
          />
        ) : type === 'select' ? (
          // Use Autocomplete for select fields with search functionality
          field.multiple ? (
            // Multiple select with Autocomplete
            <Autocomplete
              key={name}
              multiple
              options={options || []}
              getOptionLabel={(option) => option.label || ''}
              value={
                Array.isArray(value) 
                  ? options?.filter(opt => value.includes(opt.value)) || []
                  : []
              }
              onChange={(event, newValue) => {
                const selectedValues = newValue.map(item => item.value);
                handleChange(name, selectedValues);
              }}
              onBlur={() => handleBlur(name)}
              disabled={isDisabled}
              loading={field.loading}
              disableListWrap
              disableCloseOnSelect
              limitTags={3}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={label + (required ? ' *' : '')}
                  error={!!error}
                  helperText={error || field.helperText}
                  margin="normal"
                  variant={isViewMode ? "filled" : "outlined"}
                  placeholder={isViewMode ? "" : "Search and select..."}
                  InputProps={{
                    ...params.InputProps,
                    readOnly: isViewMode,
                    endAdornment: (
                      <>
                        {field.loading ? <CircularProgress color="inherit" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                    sx: {
                      maxHeight: '120px',
                      overflowY: 'auto',
                      flexWrap: 'wrap',
                      '&::-webkit-scrollbar': {
                        width: '8px',
                      },
                      '&::-webkit-scrollbar-track': {
                        background: '#f1f1f1',
                      },
                      '&::-webkit-scrollbar-thumb': {
                        background: '#888',
                        borderRadius: '4px',
                      },
                      '&::-webkit-scrollbar-thumb:hover': {
                        background: '#555',
                      },
                    }
                  }}
                />
              )}
              renderTags={(tagValue, getTagProps) =>
                tagValue.map((option, index) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    {...getTagProps({ index })}
                    size="small"
                    disabled={isViewMode}
                  />
                ))
              }
              ListboxProps={{
                style: {
                  maxHeight: '300px',
                },
              }}
              PopperComponent={(props) => (
                <Box 
                  {...props} 
                  sx={{ 
                    zIndex: 1300,
                    '& .MuiAutocomplete-listbox': {
                      maxHeight: '300px',
                      overflow: 'auto',
                    }
                  }}
                  placement="bottom-start"
                  modifiers={[
                    {
                      name: 'flip',
                      enabled: false,
                    },
                    {
                      name: 'preventOverflow',
                      enabled: true,
                      options: {
                        altAxis: true,
                        altBoundary: true,
                        tether: true,
                        rootBoundary: 'viewport',
                        padding: 8,
                      },
                    },
                  ]}
                />
              )}
              isOptionEqualToValue={(option, value) => option.value === value.value}
              readOnly={isViewMode}
              disableClearable={isViewMode}
              filterSelectedOptions
              sx={{ 
                mt: 1,
                '& .MuiAutocomplete-tag': {
                  maxWidth: 'calc(100% - 50px)',
                },
              }}
            />
          ) : (
            // Single select with Autocomplete
            <Autocomplete
              key={name}
              options={options || []}
              getOptionLabel={(option) => option.label || ''}
              value={options?.find(opt => opt.value === value) || null}
              onChange={(event, newValue) => {
                handleChange(name, newValue ? newValue.value : '');
              }}
              onBlur={() => handleBlur(name)}
              disabled={isDisabled}
              loading={field.loading}
              disableListWrap
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={label + (required ? ' *' : '')}
                  error={!!error}
                  helperText={error || field.helperText}
                  margin="normal"
                  variant={isViewMode ? "filled" : "outlined"}
                  placeholder={isViewMode ? "" : "Search and select..."}
                  InputProps={{
                    ...params.InputProps,
                    readOnly: isViewMode,
                    endAdornment: (
                      <>
                        {field.loading ? <CircularProgress color="inherit" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              ListboxProps={{
                style: {
                  maxHeight: '300px',
                },
              }}
              PopperComponent={(props) => (
                <Box 
                  {...props} 
                  sx={{ 
                    zIndex: 1300,
                  }}
                  placement="bottom-start"
                  modifiers={[
                    {
                      name: 'flip',
                      enabled: false,
                    },
                    {
                      name: 'preventOverflow',
                      enabled: true,
                      options: {
                        altAxis: true,
                        altBoundary: true,
                        tether: true,
                        rootBoundary: 'viewport',
                        padding: 8,
                      },
                    },
                  ]}
                />
              )}
              isOptionEqualToValue={(option, value) => option.value === value.value}
              readOnly={isViewMode}
              disableClearable={isViewMode}
              sx={{ mt: 1 }}
            />
          )
        ) : type === 'checkbox' ? (
          <FormControlLabel
            key={name}
            control={
              <Switch
                checked={!!value}
                onChange={(e) => handleChange(name, e.target.checked)}
                disabled={isDisabled}
                color="primary"
              />
            }
            label={label}
            sx={{ mt: 2 }}
          />
        ) : type === 'custom' ? (
          field.render ? field.render(value, (val) => handleChange(name, val), isViewMode, formData) : null
        ) : isViewMode ? (
          <Box key={name} sx={{ mt: 2 }}>
            <Typography variant="body2" color="textSecondary">
              {label}
            </Typography>
            <Typography variant="body1">
              {value || '-'}
            </Typography>
          </Box>
        ) : (
          <TextField
            key={name}
            fullWidth
            label={label}
            value={value}
            onChange={(e) => handleChange(name, e.target.value)}
            onBlur={() => handleBlur(name)}
            error={!!error}
            helperText={error}
            required={required}
            disabled={isDisabled}
            margin="normal"
          />
        )}
      </>
    );

    return tooltip ? (
      <Tooltip key={name} title={tooltip} placement="top-start" arrow>
        {fieldElement}
      </Tooltip>
    ) : fieldElement;
  };

  // Separate fields into sections
  const passwordFields = fields.filter(field => 
    field.type === 'password' || field.name === 'confirmPassword'
  );
  const otherFields = fields.filter(field => 
    field.type !== 'password' && field.name !== 'confirmPassword'
  );

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      scroll="paper"
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center">
            {mode === 'view' && <Visibility sx={{ mr: 1 }} />}
            {mode === 'edit' && <Edit sx={{ mr: 1 }} />}
            <Typography variant="h6">{title}</Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Box component="form" sx={{ mt: 1 }}>
          {headerContent}
          {/* Regular form fields */}
          {otherFields.map(field => renderField(field))}
          
          {/* Password change section for edit mode */}
          {isEditMode && (
            <Box sx={{ mt: 3 }}>
              <Divider sx={{ mb: 2 }} />
              
              <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Typography variant="h6" color="textSecondary">
                  Password Settings
                </Typography>
                
                {!showPasswordChange ? (
                  <Button
                    variant="outlined"
                    startIcon={<VpnKey />}
                    onClick={onTogglePasswordChange}
                    size="small"
                    color="primary"
                  >
                    Change Password
                  </Button>
                ) : (
                  <Button
                    variant="text"
                    startIcon={<Cancel />}
                    onClick={onTogglePasswordChange}
                    size="small"
                    color="secondary"
                  >
                    Cancel Password Change
                  </Button>
                )}
              </Box>

              {showPasswordChange && (
                <Box>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      Password must be at least 5 characters long.
                    </Typography>
                  </Alert>
                  
                  {passwordFields.map(field => renderField(field))}
                </Box>
              )}

              {!showPasswordChange && (
                <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic' }}>
                  Click "Change Password" to modify the user's password
                </Typography>
              )}
            </Box>
          )}

          {/* For create mode, show password field normally */}
          {mode === 'create' && passwordFields.map(field => renderField(field))}
          
          {/* Add custom content section */}
          {customContent && formData && (
            <Box sx={{ mt: 3 }}>
              {typeof customContent === 'function' 
                ? customContent({ formData, setFormData, mode })
                : customContent}
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          {mode === 'view' ? 'Close' : 'Cancel'}
        </Button>
        
        {mode !== 'view' && (
          <>
            {onTestCredentials && (
              <Button 
                onClick={() => onTestCredentials(formData)} 
                variant="outlined"
                color="primary"
                disabled={loading || testingCredentials}
                sx={{ mr: 'auto' }}
              >
                {testingCredentials ? 'Testing...' : 'Test Credentials'}
              </Button>
            )}
            <Button 
              onClick={handleSubmit} 
              variant="contained" 
              disabled={loading || testingCredentials}
            >
              {loading 
                ? 'Saving...' 
                : submitButtonText 
                  ? submitButtonText 
                  : mode === 'edit' 
                    ? 'Update' 
                    : 'Create'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default DynamicModal;