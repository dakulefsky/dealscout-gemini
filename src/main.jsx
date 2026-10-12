import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { captureServerBootstrap } from './lib/serverBootstrap';

captureServerBootstrap(document);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
