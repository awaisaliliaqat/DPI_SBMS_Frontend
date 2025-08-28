// pages/UserManagement.js
import React from 'react';
import { Typography, Box, Alert } from '@mui/material';
import { useAuth } from '../auth/AuthContext';
import DataTable from '../components/DataTable';

// Dummy data for the user table
const dummyUsers = [
  {
    id: 1,
    username: 'john_doe',
    email: 'john.doe@diamondpaint.com',
    role: 'Admin',
  },
  {
    id: 2,
    username: 'sarah_smith',
    email: 'sarah.smith@diamondpaint.com',
    role: 'Manager',
  },
  {
    id: 3,
    username: 'mike_wilson',
    email: 'mike.wilson@diamondpaint.com',
    role: 'Sales Rep',
  },
  {
    id: 4,
    username: 'emma_johnson',
    email: 'emma.johnson@diamondpaint.com',
    role: 'Sales Rep',
  },
  {
    id: 5,
    username: 'david_brown',
    email: 'david.brown@diamondpaint.com',
    role: 'Accountant',
  },
  {
    id: 6,
    username: 'lisa_davis',
    email: 'lisa.davis@diamondpaint.com',
    role: 'Manager',
  },
  {
    id: 7,
    username: 'alex_garcia',
    email: 'alex.garcia@diamondpaint.com',
    role: 'Sales Rep',
  },
  {
    id: 8,
    username: 'nancy_miller',
    email: 'nancy.miller@diamondpaint.com',
    role: 'Admin',
  },
  {
    id: 9,
    username: 'robert_jones',
    email: 'robert.jones@diamondpaint.com',
    role: 'Warehouse',
  },
  {
    id: 10,
    username: 'amy_taylor',
    email: 'amy.taylor@diamondpaint.com',
    role: 'Sales Rep',
  },
];

// Table column configuration
const userColumns = [
  {
    id: 'username',
    label: 'Username',
    type: 'avatar', // This will show avatar + username
    align: 'left',
  },
  {
    id: 'email',
    label: 'Email',
    type: 'email', // Special styling for email
    align: 'left',
  },
  {
    id: 'role',
    label: 'Role',
    type: 'chip', // This will show as a chip/badge
    chipColor: 'primary',
    align: 'center',
  },
];

export default function UserManagement() {
  const { user, hasPermission } = useAuth();

  // Action handlers
  const handleView = (userData) => {
    console.log('View user:', userData);
    // Add your view logic here
    alert(`View user: ${userData.username}`);
  };

  const handleEdit = (userData) => {
    console.log('Edit user:', userData);
    // Add your edit logic here
    alert(`Edit user: ${userData.username}`);
  };

  const handleDelete = (userData) => {
    console.log('Delete user:', userData);
    // Add your delete logic here
    if (window.confirm(`Are you sure you want to delete ${userData.username}?`)) {
      alert(`Delete user: ${userData.username}`);
    }
  };

  const handleAdd = () => {
    console.log('Add new user');
    // Add your create new user logic here
    alert('Add new user clicked');
  };

  return (
    <Box sx={{ width: '100%', maxWidth: '1200px' }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 3 }}>
        User Management
      </Typography>

      {!hasPermission('user', 'manage') ? (
        <Alert severity="warning" sx={{ mb: 3 }}>
          You don't have permission to manage users. Contact your administrator for access.
        </Alert>
      ) : (
        <Box>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Manage system users, their roles, and permissions. You can view, edit, or remove users from the system.
          </Typography>


        </Box>
      )}
    </Box>
  );
}