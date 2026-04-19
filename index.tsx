import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';

// DEBUG PARA PRODUÇÃO: Adicione isso no main.tsx ou index.tsx envolvendo seu <App />
export const BootupGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    try {
      // 1. Tenta acessar via globais injetadas do vite.config.ts
      // @ts-ignore
      const injectedUrl = typeof __SUPABASE_URL__ !== 'undefined' ? __SUPABASE_URL__ : null;
      // 2. Tenta acessar via import default do VITE
      const envUrl = import.meta.env ? import.meta.env.VITE_SUPABASE_URL : process.env.VITE_SUPABASE_URL;

      const finalUrl = injectedUrl || envUrl;
      
      console.log('--- DIAGNÓSTICO DE AMBIENTE VERCEL ---');
      console.log('Injected URL Presente?', !!injectedUrl);
      console.log('VITE_ ENV URL Presente?', !!envUrl);
      
      if (!finalUrl || finalUrl === 'undefined' || finalUrl === '') {
        setLogs(prev => [...prev, "CRÍTICA: Variáveis URL do Supabase ausentes!"]);
        setHasError(true);
      }
    } catch (err: any) {
      setLogs(prev => [...prev, `Erro na verificação de env: ${err?.message}`]);
      setHasError(true);
    } finally {
      setIsChecking(false);
    }
  }, []);

  if (isChecking) {
    return <div style={{ backgroundColor: '#111', color: '#fff', padding: '2rem', height: '100vh', fontFamily: 'monospace' }}>Verificando ambiente de execução...</div>;
  }

  if (hasError) {
    return (
      <div style={{ backgroundColor: '#222', color: '#ff6b6b', padding: '2rem', height: '100vh', fontFamily: 'monospace' }}>
        <h2>Falha Crítica no Boot do App</h2>
        <ul>{logs.map((L, i) => <li key={i}>{L}</li>)}</ul>
        <p>A Renderização do App foi abortada para evitar Exceptions de Top-level. Verifique as variáveis de ambiente na Vercel.</p>
      </div>
    );
  }

  return <>{children}</>;
};

// Register Service Worker for PWA & Push Notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW registered: ', registration);
      })
      .catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <BootupGuard>
          <App />
        </BootupGuard>
      </ErrorBoundary>
    </React.StrictMode>
  );
}