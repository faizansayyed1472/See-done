import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register PWA service worker for instant offline readiness and background updates
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('[PWA] New version detected, updating service worker cache...');
  },
  onOfflineReady() {
    console.log('[PWA] NAYAB POS is ready to work offline.');
  },
  onRegisteredSW(swScriptUrl, registration) {
    console.log('[PWA] Service Worker registered successfully at:', swScriptUrl);
    if (registration) {
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000);
    }
  },
  onRegisterError(error) {
    console.warn('[PWA] Service worker registration error:', error);
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
