import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { captureServerBootstrap } from './lib/serverBootstrap';
import { installChunkRecovery } from './lib/chunkRecovery';

captureServerBootstrap(document);
installChunkRecovery(window);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
