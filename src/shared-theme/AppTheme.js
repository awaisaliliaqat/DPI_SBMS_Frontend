import * as React from 'react';
import PropTypes from 'prop-types';
import { ThemeProvider, createTheme } from '@mui/material/styles';

import { inputsCustomizations } from './customizations/inputs';
import { dataDisplayCustomizations } from './customizations/dataDisplay';
import { feedbackCustomizations } from './customizations/feedback';
import { navigationCustomizations } from './customizations/navigation';
import { surfacesCustomizations } from './customizations/surfaces';
import { colorSchemes, typography, shadows, shape } from './themePrimitives';

const LIGHT_ATTR = 'data-mui-color-scheme';

// Keeps the app in light mode; resets if something (e.g. theme toggle) changes it
function ForceLightMode({ children }) {
  React.useEffect(() => {
    const el = document.documentElement;
    const force = () => {
      if (el.getAttribute(LIGHT_ATTR) !== 'light') {
        el.setAttribute(LIGHT_ATTR, 'light');
      }
    };
    force();
    const obs = new MutationObserver(force);
    obs.observe(el, { attributes: true, attributeFilter: [LIGHT_ATTR] });
    return () => obs.disconnect();
  }, []);
  return children;
}

function AppTheme(props) {
  const { children, disableCustomTheme, themeComponents } = props;
  const theme = React.useMemo(() => {
    return disableCustomTheme
      ? {}
      : createTheme({
          cssVariables: {
            colorSchemeSelector: LIGHT_ATTR,
            cssVarPrefix: 'template',
          },
          colorSchemes,
          typography,
          shadows,
          shape,
          components: {
            ...dataDisplayCustomizations,
            ...feedbackCustomizations,
            ...navigationCustomizations,
            ...surfacesCustomizations,
            ...themeComponents,
          },
        });
  }, [disableCustomTheme, themeComponents]);
  if (disableCustomTheme) {
    return <React.Fragment>{children}</React.Fragment>;
  }
  return (
    <ThemeProvider theme={theme} disableTransitionOnChange>
      <ForceLightMode>
        {children}
      </ForceLightMode>
    </ThemeProvider>
  );
}

AppTheme.propTypes = {
  children: PropTypes.node,
  /**
   * This is for the docs site. You can ignore it or remove it.
   */
  disableCustomTheme: PropTypes.bool,
  themeComponents: PropTypes.object,
};

export default AppTheme;
