import * as React from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Checkbox,
  Typography,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Chip,
  useTheme,
  alpha,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import PlaceIcon from '@mui/icons-material/Place';
import { useMemo, useState, useCallback, useEffect } from 'react';

const VISIBLE_NAMES = 2;
const DIALOG_MAX_HEIGHT = '70vh';
const SEARCH_DEBOUNCE_MS = 180;

/**
 * Debounced value: updates after delay so we don't filter 600 items on every keystroke.
 */
function useDebouncedValue(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const RegionRow = React.memo(function RegionRow({
  region,
  isSelected,
  readOnly,
  primaryColor,
  onToggle,
}) {
  const primaryText = region.name || String(region.id);
  return (
    <ListItemButton
      selected={isSelected}
      onClick={() => onToggle(region.id)}
      disabled={readOnly}
      sx={{
        '&.Mui-selected': {
          backgroundColor: alpha(primaryColor, 0.12),
        },
        '&.Mui-selected:hover': {
          backgroundColor: alpha(primaryColor, 0.18),
        },
      }}
    >
      {!readOnly && (
        <ListItemIcon sx={{ minWidth: 40 }}>
          <Checkbox
            edge="start"
            checked={isSelected}
            tabIndex={-1}
            disableRipple
            size="small"
          />
        </ListItemIcon>
      )}
      <ListItemText
        primary={primaryText}
        primaryTypographyProps={{ fontWeight: isSelected ? 600 : 400 }}
      />
    </ListItemButton>
  );
});

/**
 * Compact summary label: shows first 2 region names + "+N more".
 * Clicking opens a full dialog to view/select all regions.
 */
export default function RegionPicker({
  regions = [],
  value = [],
  onChange,
  disabled = false,
  readOnly = false,
  label = 'Regions',
  error = '',
  helperText = '',
  loading = false,
}) {
  const theme = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedIds = Array.isArray(value) ? value : [];
  const selectedIdsSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedRegions = useMemo(
    () => regions.filter((r) => selectedIdsSet.has(r.id)),
    [regions, selectedIdsSet]
  );

  const searchDebounced = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const searchLower = (searchDebounced || '').trim().toLowerCase();
  const filteredRegions = useMemo(() => {
    if (!searchLower) return regions;
    return regions.filter(
      (r) =>
        (r.name && r.name.toLowerCase().includes(searchLower)) ||
        (r.code && r.code.toLowerCase().includes(searchLower))
    );
  }, [regions, searchLower]);

  const toggleRegion = useCallback(
    (regionId) => {
      if (readOnly) return;
      const next = selectedIdsSet.has(regionId)
        ? selectedIds.filter((id) => id !== regionId)
        : [...selectedIds, regionId];
      onChange(next);
    },
    [selectedIds, selectedIdsSet, onChange, readOnly]
  );

  const handleSelectAll = useCallback(() => {
    if (readOnly) return;
    const allFilteredIds = filteredRegions.map((r) => r.id);
    const allSelected = allFilteredIds.every((id) => selectedIdsSet.has(id));
    if (allSelected) {
      const removeSet = new Set(allFilteredIds);
      onChange(selectedIds.filter((id) => !removeSet.has(id)));
    } else {
      const merged = [...new Set([...selectedIds, ...allFilteredIds])];
      onChange(merged);
    }
  }, [filteredRegions, selectedIds, selectedIdsSet, onChange, readOnly]);

  const handleClosePicker = useCallback(() => {
    setPickerOpen(false);
    setSearch('');
  }, []);

  const firstNames = selectedRegions.slice(0, VISIBLE_NAMES).map((r) => r.name || String(r.id));
  const restCount = selectedRegions.length - VISIBLE_NAMES;
  const summaryLabel =
    restCount > 0
      ? `${firstNames.join(', ')} +${restCount}`
      : firstNames.length > 0
        ? firstNames.join(', ')
        : 'No regions selected';

  const primaryColor = theme.palette.primary.main;
  const chipBg = alpha(primaryColor, 0.08);
  const chipBorder = alpha(primaryColor, 0.3);

  return (
    <Box sx={{ mt: 1, mb: 0 }}>
      <Typography
        variant="subtitle2"
        sx={{
          mb: 0.75,
          color: 'text.secondary',
          fontWeight: 500,
        }}
      >
        {label}
      </Typography>
      <Chip
        icon={<PlaceIcon sx={{ fontSize: 18 }} />}
        label={summaryLabel}
        onClick={() => !disabled && setPickerOpen(true)}
        disabled={disabled}
        variant="outlined"
        sx={{
          minHeight: 40,
          py: 1,
          px: 1.5,
          borderRadius: 2,
          borderColor: error ? 'error.main' : chipBorder,
          backgroundColor: chipBg,
          '&:hover': disabled ? {} : {
            backgroundColor: alpha(primaryColor, 0.14),
            borderColor: primaryColor,
          },
          cursor: disabled ? 'default' : 'pointer',
          fontWeight: 500,
          fontSize: '0.875rem',
        }}
      />
      {(error || helperText) && (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mt: 0.5,
            ml: 1.5,
            color: error ? 'error.main' : 'text.secondary',
          }}
        >
          {error || helperText}
        </Typography>
      )}

      <Dialog
        open={pickerOpen}
        onClose={handleClosePicker}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            maxHeight: DIALOG_MAX_HEIGHT,
            overflow: 'hidden',
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: 1,
            borderColor: 'divider',
            py: 1.5,
          }}
        >
          <Typography variant="h6">
            {readOnly ? 'Selected regions' : 'Select regions'}
          </Typography>
          <IconButton size="small" onClick={handleClosePicker} aria-label="Close">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
          {!readOnly && (
            <>
              <Box sx={{ px: 2, pt: 2, pb: 1 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search regions..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon color="action" />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      backgroundColor: alpha(theme.palette.primary.main, 0.04),
                    },
                  }}
                />
                <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                  <Button size="small" variant="outlined" onClick={handleSelectAll}>
                    {filteredRegions.every((r) => selectedIdsSet.has(r.id))
                      ? 'Deselect all (filtered)'
                      : 'Select all (filtered)'}
                  </Button>
                </Box>
              </Box>
            </>
          )}
          <Box
            sx={{
              flex: 1,
              minHeight: 200,
              maxHeight: 360,
              overflow: 'auto',
              borderTop: 1,
              borderColor: 'divider',
            }}
          >
            {loading ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography color="text.secondary">Loading regions…</Typography>
              </Box>
            ) : filteredRegions.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography color="text.secondary">
                  {search ? 'No regions match your search.' : 'No regions available.'}
                </Typography>
              </Box>
            ) : (
              <List dense disablePadding>
                {filteredRegions.map((region) => (
                  <RegionRow
                    key={region.id}
                    region={region}
                    isSelected={selectedIdsSet.has(region.id)}
                    readOnly={readOnly}
                    primaryColor={primaryColor}
                    onToggle={toggleRegion}
                  />
                ))}
              </List>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ borderTop: 1, borderColor: 'divider', py: 1.5, px: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mr: 'auto' }}>
            {selectedRegions.length} selected
          </Typography>
          <Button variant="contained" onClick={handleClosePicker}>
            Done
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
