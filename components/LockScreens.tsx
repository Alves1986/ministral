import React from 'react';
import { Lock, AlertOctagon, CreditCard, Building2, LogOut } from 'lucide-react';

export const OrganizationInactiveScreen = ({ onLogout }: { onLogout: () => void }) => (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F172A] p-6 text-center">
        <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center mb-6 shadow-2xl border border-zinc-800">
            <Building2 className="text-ministral-500" size={40} />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Organização Inativa</h1>
        <p className="text-zinc-400 max-w-sm mb-8 leading-relaxed">
            Esta organização foi desativada temporariamente. Entre em contato com o administrador para mais informações.
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
            <button 
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-ministral-500 hover:bg-ministral-600 text-white rounded-xl font-bold transition-all"
            >
                <LogOut size={18}/> Sair da Conta
            </button>
        </div>
        <div className="mt-8 text-zinc-500 text-sm">
            Precisa de ajuda? <a href="mailto:contato.ministral@gmail.com" className="text-ministral-500 hover:underline">contato.ministral@gmail.com</a>
        </div>
    </div>
);

export const BillingLockScreen = ({ checkoutUrl, orgId, onLogout, onRefresh }: { checkoutUrl?: string, orgId?: string, onLogout: () => void, onRefresh?: () => void }) => {
    const handleCheckout = () => {
        if (!checkoutUrl) return;
        try {
            const url = new URL(checkoutUrl);
            if (orgId) {
                url.searchParams.set('client_reference_id', orgId);
            }
            window.location.href = url.toString();
        } catch (e) {
            window.location.href = checkoutUrl;
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F172A] p-6 text-center">
            <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mb-6 shadow-2xl border border-red-500/20 animate-pulse">
                <Lock className="text-red-500" size={40} />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Acesso Bloqueado</h1>
            <p className="text-zinc-400 max-w-sm mb-8 leading-relaxed">
                O período de teste expirou ou há pendências no pagamento. Regularize a assinatura para liberar o acesso.
            </p>
            
            <div className="flex flex-col gap-3 w-full max-w-xs">
                {checkoutUrl && (
                    <button 
                        onClick={handleCheckout}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-red-600 to-ministral-500 hover:from-red-500 hover:to-ministral-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-red-900/20 active:scale-95"
                    >
                        <CreditCard size={18}/> Regularizar Agora
                    </button>
                )}
                {onRefresh && (
                    <button 
                        onClick={onRefresh}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 rounded-xl font-bold transition-all active:scale-95"
                    >
                        Já fiz o pagamento — Verificar
                    </button>
                )}
                <button 
                    onClick={onLogout}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl font-bold transition-all"
                >
                    Sair do Sistema
                </button>
            </div>
            
            <div className="mt-8 text-zinc-500 text-sm">
                Precisa de ajuda? <a href="mailto:contato.ministral@gmail.com" className="text-ministral-500 hover:underline">contato.ministral@gmail.com</a>
            </div>
        </div>
    );
};
