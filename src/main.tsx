import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App.js';
import { ReactContainerProvider } from './composition/ReactContainer.js';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('root element missing');

createRoot(container).render(
  <StrictMode>
    <ReactContainerProvider>
      <App />
    </ReactContainerProvider>
  </StrictMode>,
);
