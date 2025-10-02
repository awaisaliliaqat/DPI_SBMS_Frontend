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
  showPasswordChange = false,
  onTogglePasswordChange,
  isEditMode = false,
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
    
    const rawValue = formData[name] || '';
    const value = valueFormatter ? valueFormatter(rawValue) : rawValue;
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
          <FormControl 
            key={name} 
            fullWidth 
            margin="normal" 
            error={!!error}
            disabled={isDisabled}
          >
            <InputLabel>{label}{required ? ' *' : ''}</InputLabel>
            <Select
              value={value}
              label={label}
              onChange={(e) => handleChange(name, e.target.value)}
              onBlur={() => handleBlur(name)}
              variant={isViewMode ? "filled" : "outlined"}
              readOnly={isViewMode}
            >
              {options?.map(option => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
            {error && <FormHelperText>{error}</FormHelperText>}
          </FormControl>
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
          field.render ? field.render(value, (val) => handleChange(name, val), isViewMode) : null
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
          {customContent && (
            <Box sx={{ mt: 3 }}>
              {customContent}
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          {mode === 'view' ? 'Close' : 'Cancel'}
        </Button>
        
        {mode !== 'view' && (
          <Button 
            onClick={handleSubmit} 
            variant="contained" 
            disabled={loading}
          >
            {loading ? 'Saving...' : mode === 'edit' ? 'Update' : 'Create'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default DynamicModal;