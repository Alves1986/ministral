import React, { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';
import { LegalDocType } from './LegalDocuments';

const COOKIE_CONSENT_KEY = 'ministral_cookie_consent_v1';

export interface CookieConsentDecision {
  essential: true;
  analytics: boolean;
  decidedAt: string;
  version: string;
}

export const getCookieConsent = (): CookieConsentDecision | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const CookieConsentBanner: React.FC<{
  onOpenLegal?: (type: LegalDocType) => void;
}> = ({ onOpenLegal }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const existing = getCookieConsent();
    if (!existing) {
      setVisible(true);
    }
  }, []);

  const handleDecision = (acceptAnalytics: boolean) => {
    const decision: CookieConsentDecision = {
      essential: true,
      analytics: acceptAnalytics,
      decidedAt: new Date().toISOString(),
      version: '2026.11',
    };
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(decision));
    } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Aviso de Cookies e Privacidade"
      className="fixed bottom-4 left-4 right-4 z-[140] mx-auto max-w-4xl rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-4 sm:p-5 shadow-2xl animate-slide-up print:hidden"
    >
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-ministral-500/10 text-ministral-500 shrink-0 mt-0.5">
            <Shield size={20} />
          </div>
          <div className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
            <p className="font-bold text-zinc-900 dark:text-white text-sm mb-1">
              Sua privacidade e cookies (LGPD / Guia ANPD)
            </p>
            Utilizamos armazenamento estritamente necessário para autenticação e funcionamento da sua escala. Cookies ou métricas não essenciais permanecem bloqueados até que você escolha aceitar. Consulte nossa{' '}
            {onOpenLegal ? (
              <button
                type="button"
                onClick={() => onOpenLegal('privacy')}
                className="text-ministral-500 font-bold underline hover:opacity-80"
              >
                Política de Privacidade
              </button>
            ) : (
              <a href="/?doc=privacy" className="text-ministral-500 font-bold underline">
                Política de Privacidade
              </a>
            )}
            .
          </div>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full md:w-auto shrink-0">
          <button
            type="button"
            onClick={() => handleDecision(false)}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border-2 border-zinc-300 dark:border-zinc-600 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white text-xs font-black uppercase tracking-wider transition-colors"
          >
            Recusar todos
          </button>
          <button
            type="button"
            onClick={() => handleDecision(true)}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border-2 border-ministral-500 bg-ministral-500 hover:bg-ministral-600 text-white text-xs font-black uppercase tracking-wider transition-colors shadow-sm"
          >
            Aceitar todos
          </button>
        </div>
      </div>
    </div>
  );
};
