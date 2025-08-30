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

  // Initialize form data when modal opens or initialData changes
  useEffect(() => {
    if (open) {
      setFormData(initialData);
      setErrors({});
    }
  }, [open, initialData]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when field is updated
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSubmit = () => {
    // Basic validation
    const newErrors = {};
    fields.forEach(field => {
      if (field.required && !formData[field.name]) {
        newErrors[field.name] = `${field.label} is required`;
      }
    });

    // Additional password validation for edit mode
    if (isEditMode && showPasswordChange) {
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
      if (formData.password && formData.password.length < 6) {
        newErrors.password = 'Password must be at least 6 characters long';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit(formData);
  };

  const renderField = (field) => {
    const { name, label, type, options, required, disabled, multiline, rows, placeholder } = field;
    const value = formData[name] || '';
    const error = errors[name] || '';
    const isViewMode = mode === 'view';
    const isDisabled = isViewMode || disabled;

    switch (type) {
      case 'text':
      case 'email':
      case 'password':
      case 'number':
        return (
          <TextField
            key={name}
            fullWidth
            type={type}
            label={label}
            value={value}
            onChange={(e) => handleChange(name, e.target.value)}
            error={!!error}
            helperText={error}
            required={required}
            disabled={isDisabled}
            multiline={multiline}
            rows={rows}
            margin="normal"
            variant={isViewMode ? "filled" : "outlined"}
            placeholder={placeholder}
            InputProps={{
              readOnly: isViewMode,
            }}
          />
        );

      case 'select':
        return (
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
        );

      case 'checkbox':
        return (
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
        );

      case 'custom':
        return field.render ? field.render(value, (val) => handleChange(name, val), isViewMode) : null;

      default:
        return isViewMode ? (
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
            error={!!error}
            helperText={error}
            required={required}
            disabled={isDisabled}
            margin="normal"
          />
        );
    }
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
                      Leave password fields empty to keep the current password unchanged.
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