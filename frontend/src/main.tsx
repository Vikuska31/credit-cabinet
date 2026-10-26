import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@alfalab/core-components/vars/colors-bluetint.css';
import '@alfalab/core-components/vars/colors-addons.css';
import '@alfalab/core-components/vars/shadows-bluetint.css';
import '@alfalab/core-components/vars/border-radius.css';
import '@alfalab/core-components/vars/gaps.css';
import '@alfalab/core-components/vars/typography-vars.css';
import '@alfalab/core-components/vars/common.css';
import './index.css';
import './cabinet.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
