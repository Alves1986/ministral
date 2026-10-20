import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

// SW controllerchange: quando o novo Service Worker assume após update,
// recarrega a página de forma limpa para evitar estado inconsistente/tela branca.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}

// Previne erro de tela "Falha de Conexão" quando um novo deploy na Vercel altera os hashes dos chunks (.js):
// O Vite dispara 'vite:preloadError' quando um módulo dinâmico antigo não existe mais no servidor.
window.addEventListener('vite:preloadError', (event: any) => {
  event?.preventDefault?.();
  const key = 'chunk_reload_lock';
  const last = Number(sessionStorage.getItem(key) || 0);
  const now = Date.now();
  if (now - last > 8000) {
    sessionStorage.setItem(key, String(now));
    window.location.reload();
  }
});

window.addEventListener('error', (event) => {
  const msg = event?.message || '';
  if (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('Expected a JavaScript-or-Wasm module script')
  ) {
    const key = 'chunk_reload_lock';
    const last = Number(sessionStorage.getItem(key) || 0);
    const now = Date.now();
    if (now - last > 8000) {
      sessionStorage.setItem(key, String(now));
      window.location.reload();
    }
  }
});

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}
