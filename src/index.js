import React from 'react';
import ReactDOM from 'react-dom/client';
import InitColorSchemeScript from '@mui/material/InitColorSchemeScript';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Force light theme: clear MUI theme storage and set attribute before React
if (typeof document !== 'undefined' && document.documentElement) {
  try {
    localStorage.setItem('mui-mode', 'light');
    localStorage.setItem('mui-color-scheme', 'light');
  } catch (e) {}
  document.documentElement.setAttribute('data-mui-color-scheme', 'light');
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <InitColorSchemeScript defaultMode="light" />
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
