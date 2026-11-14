import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { ShoppingProvider } from './store/ShoppingContext.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ShoppingProvider>
      <App />
    </ShoppingProvider>
  </StrictMode>,
);
