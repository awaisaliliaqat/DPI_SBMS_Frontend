import * as React from 'react';
import PropTypes from 'prop-types';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Drawer, { drawerClasses } from '@mui/material/Drawer';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import MenuButton from './MenuButton';
import DynamicMenuContent from '../../components/DynamicMenuContent';
import CardAlert from './CardAlert';
import { useAuth } from '../../auth/AuthContext';

// Helper function to get user initials for avatar
const getUserInitials = (username, email) => {
  if (username) {
    return username.charAt(0).toUpperCase();
  }
  if (email) {
    return email.charAt(0).toUpperCase();
  }
  return 'U'; // Default fallback
};

// Helper function to generate avatar color based on username
const stringToColor = (string) => {
  let hash = 0;
  let i;

  for (i = 0; i < string.length; i += 1) {
    hash = string.charCodeAt(i) + ((hash << 5) - hash);
  }

  let color = '#';

  for (i = 0; i < 3; i += 1) {
    const value = (hash >> (i * 8)) & 0xff;
    color += `00${value.toString(16)}`.slice(-2);
  }

  return color;
};

const stringAvatar = (username, email) => {
  const name = username || email || 'User';
  return {
    sx: {
      bgcolor: stringToColor(name),
      width: 24,
      height: 24,
    },
    children: getUserInitials(username, email),
  };
};

function SideMenuMobile({ open, toggleDrawer }) {
  const { user, logout, loading } = useAuth();

  const handleLogout = () => {
    toggleDrawer(false)();
    logout();
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={toggleDrawer(false)}
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        [`& .${drawerClasses.paper}`]: {
          backgroundImage: 'none',
          backgroundColor: 'background.paper',
        },
      }}
    >
      <Stack
        sx={{
          maxWidth: '70dvw',
          height: '100%',
        }}
      >
        <Stack direction="row" sx={{ p: 2, pb: 0, gap: 1 }}>
          <Stack
            direction="row"
            sx={{ gap: 1, alignItems: 'center', flexGrow: 1, p: 1 }}
          >
            {loading ? (
              <Avatar sx={{ width: 24, height: 24 }}>?</Avatar>
            ) : (
              <Avatar
                {...stringAvatar(user?.username, user?.email)}
                alt={user?.username || user?.email || 'User'}
                sx={{ width: 24, height: 24 }}
              />
            )}
            <Typography 
              component="p" 
              variant="h6"
              sx={{
                textTransform: 'capitalize',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {loading ? 'Loading...' : (user?.username || 'Unknown User')}
            </Typography>
          </Stack>
          {/* <MenuButton showBadge>
            <NotificationsRoundedIcon />
          </MenuButton> */}
        </Stack>
        <Divider />
        <Stack sx={{ flexGrow: 1 }}>
          <DynamicMenuContent />
          <Divider />
        </Stack>
        {/* <CardAlert /> */}
        <Stack sx={{ p: 2 }}>
          <Button 
            variant="outlined" 
            fullWidth 
            startIcon={<LogoutRoundedIcon />}
            onClick={handleLogout}
          >
            Logout
          </Button>
        </Stack>
      </Stack>
    </Drawer>
  );
}

SideMenuMobile.propTypes = {
  open: PropTypes.bool,
  toggleDrawer: PropTypes.func.isRequired,
};

export default SideMenuMobile;
