import React from 'react';
import ReactDOM from 'react-dom/client'; // Usa createRoot para React 18
import App from './App'; // Importa tu componente App

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
