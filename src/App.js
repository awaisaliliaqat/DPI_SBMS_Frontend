import * as React from 'react';
import './App.css';
import AppRoutes from './routes/AppRoutes';
import { HashRouter } from 'react-router-dom';

const LIGHT_ATTR = 'data-mui-color-scheme';

// Force light theme app-wide (runs on every route, overrides any toggle/storage)
function ForceLightTheme() {
  React.useEffect(() => {
    const el = document.documentElement;
    const force = () => {
      if (el.getAttribute(LIGHT_ATTR) !== 'light') {
        el.setAttribute(LIGHT_ATTR, 'light');
      }
      try {
        localStorage.setItem('mui-mode', 'light');
        localStorage.setItem('mui-color-scheme', 'light');
      } catch (e) {}
    };
    force();
    const obs = new MutationObserver(force);
    obs.observe(el, { attributes: true, attributeFilter: [LIGHT_ATTR] });
    // Re-apply for a few seconds to override any late script (e.g. InitColorSchemeScript reading storage)
    const id = setInterval(force, 200);
    const stop = () => { clearInterval(id); };
    const t = setTimeout(stop, 5000);
    return () => {
      obs.disconnect();
      clearInterval(id);
      clearTimeout(t);
    };
  }, []);
  return null;
}

function App() {
  return (
      <HashRouter>
        <ForceLightTheme />
        <AppRoutes/>
      </HashRouter>
  );
}

export default App;
