import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { LocaleProvider } from './lib/locale.tsx';

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocaleProvider><App /></LocaleProvider>
  </StrictMode>,
);
