import * as React from 'react';
import { Alert, Box, Chip, Typography } from '@mui/material';

export default function ManualSurveyHighlight({ request, compact = false }) {
  if (!request?.is_manual_survey) return null;

  const title = request.dealer_code_temp || request.title;
  const location = request.region || request.location_name;
  const instructions = request.instructions;

  if (compact) {
    return (
      <Chip
        label="Manual Survey"
        size="small"
        sx={{
          ml: 1,
          fontWeight: 700,
          backgroundColor: '#fff3e0',
          color: '#e65100',
          border: '1px solid #ff9800',
        }}
      />
    );
  }

  return (
    <Alert
      severity="warning"
      sx={{
        mb: 2,
        backgroundColor: '#fff8e1',
        border: '1px solid #ffb300',
        color: '#e65100',
        '& .MuiAlert-icon': { color: '#ef6c00' },
      }}
    >
      <Typography variant="subtitle1" sx={{ fontWeight: 800, letterSpacing: 0.2 }}>
        This is a Manual Survey
      </Typography>
      <Box sx={{ mt: 0.5, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
        {title ? (
          <Typography variant="body2">
            <strong>Title:</strong> {title}
          </Typography>
        ) : null}
        {location ? (
          <Typography variant="body2">
            <strong>Location:</strong> {location}
          </Typography>
        ) : null}
        {instructions ? (
          <Typography variant="body2">
            <strong>Instructions:</strong> {instructions}
          </Typography>
        ) : null}
      </Box>
    </Alert>
  );
}
