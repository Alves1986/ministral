import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { getSupabase } from '../services/supabaseService';
import { Organization } from '../types';

interface PaymentSuccessScreenProps {
  onRefreshOrg: () => Promise<void>;
  orgId: string;
}

export const PaymentSuccessScreen: React.FC<PaymentSuccessScreenProps> = ({ onRefreshOrg, orgId }) => {
  const [status, setStatus] = useState<'processing' | 'success'>('processing');

  useEffect(() => {
    let interval: NodeJS.Timeout;
    let attempts = 0;
    const maxAttempts = 15; // 30 seconds (15 * 2 seconds)

    const checkStatus = async () => {
      try {
        const sb = getSupabase();
        if (!sb) return;

        const { data, error } = await sb
          .from('organizations')
          .select('billing_status')
          .eq('id', orgId)
          .single();

        if (error) {
          console.error("Error fetching org billing_status:", error);
        } else if (data?.billing_status === 'active') {
          setStatus('success');
          if (interval) clearInterval(interval);
          await onRefreshOrg();
        }

        attempts++;
        if (attempts >= maxAttempts && status === 'processing') {
           // Fallback, clear interval so it doesn't loop forever, maybe it takes a while
           if (interval) clearInterval(interval);
        }
      } catch (e) {
        console.error(e);
      }
    };

    if (status === 'processing') {
      interval = setInterval(checkStatus, 2000);
      checkStatus(); // immediate first check
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [orgId, status, onRefreshOrg]);

  const handleDashboardRedirect = () => {
    const cleanUrl = window.location.pathname;
    window.location.replace(cleanUrl);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-[#0F172A] p-6">
      <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 text-center shadow-xl">
        {status === 'processing' ? (
          <div className="flex flex-col items-center animate-pulse">
            <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mb-6">
              <Loader2 className="animate-spin text-blue-500" size={40} />
            </div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Processando pagamento...</h2>
            <p className="text-zinc-500 dark:text-zinc-400">
              Aguarde um momento enquanto confirmamos sua assinatura com a operadora do cartão.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 animate-bounce">
              <CheckCircle2 className="text-emerald-500" size={40} />
            </div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Pagamento Confirmado!</h2>
            <p className="text-zinc-500 dark:text-zinc-400 mb-8">
              Sua assinatura foi ativada com sucesso. Obrigado por fazer parte!
            </p>
            <button 
              onClick={handleDashboardRedirect}
              className="w-full py-3 bg-ministral-500 hover:bg-ministral-600 text-white font-bold rounded-xl transition-all active:scale-95 shadow-lg shadow-ministral-500/20"
            >
              Ir para o Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
