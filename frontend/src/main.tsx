// frontend/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';
import './styles/index.css';

// Log all VITE_ environment variables loaded for frontend
const viteEnvVars = Object.keys(import.meta.env).filter(key => key.startsWith('VITE_'));
console.log('🔑 Frontend Environment Variables:', viteEnvVars.reduce((acc, key) => {
  acc[key] = import.meta.env[key];
  return acc;
}, {} as Record<string, any>));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
