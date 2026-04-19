import React from 'react';
import { Crown, CheckCircle2, XCircle } from 'lucide-react';
import { Organization } from '../types';

interface PlanScreenProps {
  organization: Organization | null;
  isAdmin: boolean;
}

const PLANS = {
  trial: {
    name: 'Trial', price: 'Gratuito', duration: '30 dias',
    features: [
      { label: 'Até 10 membros por ministério', included: true },
      { label: '1 ministério por organização', included: true },
      { label: 'Editor de Escala básico', included: true },
      { label: 'Disponibilidade inteligente', included: true },
      { label: 'Avisos e Comunicados', included: true },
      { label: 'Ranking e Destaques', included: true },
      { label: 'Relatório Mensal', included: false },
      { label: 'Relatório de Disponibilidade', included: false },
      { label: 'Regras de Escala (conflitos)', included: false },
      { label: 'Gerenciamento de Repertório', included: false },
      { label: 'Notificações Push', included: false },
      { label: 'Integrações Spotify e YouTube', included: false },
      { label: 'Suporte prioritário', included: false },
    ]
  },
  pro: {
    name: 'Pro', price: 'R$ 49,90', duration: 'por mês',
    features: [
      { label: 'Até 50 membros por ministério', included: true },
      { label: 'Até 3 ministérios por organização', included: true },
      { label: 'Editor de Escala completo', included: true },
      { label: 'Disponibilidade inteligente', included: true },
      { label: 'Avisos e Comunicados', included: true },
      { label: 'Ranking e Destaques', included: true },
      { label: 'Relatório Mensal completo', included: true },
      { label: 'Relatório de Disponibilidade', included: true },
      { label: 'Regras de Escala (conflitos)', included: true },
      { label: 'Gerenciamento de Repertório', included: true },
      { label: 'Notificações Push', included: true },
      { label: 'Integrações Spotify e YouTube', included: true },
      { label: 'Suporte prioritário via WhatsApp', included: true },
    ]
  },
  enterprise: {
    name: 'Enterprise', price: 'R$ 99,90', duration: 'por mês',
    features: [
      { label: 'Membros ilimitados', included: true },
      { label: 'Ministérios ilimitados', included: true },
      { label: 'Múltiplos administradores', included: true },
      { label: 'Suporte dedicado via WhatsApp/Call', included: true },
      { label: 'Relatórios avançados e customizados', included: true },
      { label: 'Treinamento para equipe', included: true },
      { label: 'SLA de disponibilidade', included: true },
      { label: 'Backup extra de dados', included: true },
    ]
  }
};

export const PlanScreen: React.FC<PlanScreenProps> = ({ organization, isAdmin }) => {
  const daysLeft = organization?.trial_ends_at
    ? Math.ceil((new Date(organization.trial_ends_at).getTime() - Date.now()) / 86400000)
    : null;
  const isTrialExpired = daysLeft !== null && daysLeft <= 0;
  const isPro = organization?.plan_type === 'pro';
  const isEnterprise = organization?.plan_type === 'enterprise';
  const checkoutUrl = organization?.checkout_url || null;

  const handleUpgrade = (planType: string) => {
    if (checkoutUrl && organization?.id) {
      const url = new URL(checkoutUrl);
      url.searchParams.set('client_reference_id', organization.id);
      url.searchParams.set('metadata[plan_type]', planType);
      window.open(url.toString(), '_blank');
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-ministral-50 dark:bg-ministral-600/20 text-ministral-500 dark:text-ministral-100">
            <Crown size={24} />
          </div>
          <h1 className="text-2xl font-bold text-zinc-800 dark:text-white">Plano e Assinatura</h1>
        </div>
        <p className="text-zinc-500 dark:text-zinc-400">Gerencie sua assinatura e conheça os recursos disponíveis</p>
      </div>

      <div className="mb-8">
        {isEnterprise ? (
          <div className="bg-ministral-gold/10 dark:bg-ministral-gold/20 border border-ministral-gold/30 rounded-xl p-4 flex items-center gap-4">
            <div className="bg-ministral-gold text-white text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">
              Plano Enterprise Ativo
            </div>
            <p className="text-ministral-gold dark:text-ministral-gold text-sm font-medium">
              Sua organização está no plano ilimitado com suporte dedicado.
            </p>
          </div>
        ) : isPro ? (
          <div className="bg-ministral-50 dark:bg-ministral-600/20 border border-ministral-100 dark:border-ministral-500/30 rounded-xl p-4 flex items-center gap-4">
            <div className="bg-ministral-500 text-white text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">
              Plano Pro Ativo
            </div>
            <p className="text-ministral-700 dark:text-ministral-100 text-sm font-medium">
              Você tem acesso completo aos recursos do plano Pro.
            </p>
          </div>
        ) : isTrialExpired ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-pulse">
            <div>
              <p className="text-red-700 dark:text-red-300 font-bold">Seu período de teste expirou.</p>
              <p className="text-red-600/80 dark:text-red-400/80 text-sm">Faça o upgrade para continuar usando o sistema.</p>
            </div>
            <button 
              onClick={() => handleUpgrade('pro')}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg whitespace-nowrap transition-colors"
            >
              Fazer Upgrade
            </button>
          </div>
        ) : daysLeft !== null ? (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-xl p-4">
            <div className="flex items-center gap-4 mb-3">
              <div className="bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">
                Período de Teste — {daysLeft} dias restantes
              </div>
            </div>
            <div className="w-full bg-amber-200 dark:bg-amber-900/50 rounded-full h-2">
              <div 
                className="bg-amber-500 h-2 rounded-full transition-all" 
                style={{ width: `${Math.max(0, Math.min(100, ((30 - daysLeft) / 30) * 100))}%` }}
              ></div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Trial Card */}
        <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-6 flex flex-col">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-zinc-800 dark:text-white mb-2">{PLANS.trial.name}</h3>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-zinc-800 dark:text-white">{PLANS.trial.price}</span>
            </div>
            <p className="text-zinc-500 text-sm mt-1">{PLANS.trial.duration}</p>
          </div>
          
          <div className="flex-1 space-y-3 mb-8">
            {PLANS.trial.features.map((feature, idx) => (
              <div key={idx} className="flex items-start gap-3">
                {feature.included ? (
                  <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={18} />
                ) : (
                  <XCircle className="text-zinc-400 dark:text-zinc-600 shrink-0 mt-0.5" size={18} />
                )}
                <span className={`text-sm ${feature.included ? 'text-zinc-700 dark:text-zinc-300' : 'text-zinc-400 dark:text-zinc-500 line-through'}`}>
                  {feature.label}
                </span>
              </div>
            ))}
          </div>

          <button 
            disabled
            className="w-full py-3 rounded-xl font-bold text-sm bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 cursor-not-allowed"
          >
            {(organization?.plan_type === 'trial' && !isTrialExpired) ? 'Plano Atual' : 'Plano Básico'}
          </button>
        </div>

        {/* Pro Card */}
        <div className={`bg-white dark:bg-zinc-900 border-2 ${!isEnterprise ? 'border-ministral-500' : 'border-zinc-200 dark:border-zinc-700'} rounded-2xl p-6 flex flex-col relative ${!isEnterprise ? 'shadow-xl shadow-ministral-500/10' : ''}`}>
          {!isEnterprise && !isPro && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-ministral-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              Recomendado
            </div>
          )}
          
          <div className="mb-6">
            <h3 className="text-xl font-bold text-ministral-500 dark:text-ministral-400 mb-2">{PLANS.pro.name}</h3>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black text-zinc-800 dark:text-white">{PLANS.pro.price}</span>
              <span className="text-zinc-500 font-medium">/mês</span>
            </div>
          </div>
          
          <div className="flex-1 space-y-3 mb-8">
            {PLANS.pro.features.map((feature, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <CheckCircle2 className="text-ministral-500 dark:text-ministral-400 shrink-0 mt-0.5" size={18} />
                <span className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">
                  {feature.label}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-auto">
            {isPro ? (
              <button 
                disabled
                className="w-full py-3 rounded-xl font-bold text-sm bg-ministral-500/10 text-ministral-600 dark:text-ministral-400 border border-ministral-500/20 cursor-not-allowed flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={18} /> Plano Ativo
              </button>
            ) : isEnterprise ? (
              <button 
                disabled
                className="w-full py-3 rounded-xl font-bold text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed"
              >
                Incluído no Enterprise
              </button>
            ) : checkoutUrl ? (
              <button 
                onClick={() => handleUpgrade('pro')}
                className="w-full py-3 rounded-xl font-bold text-sm bg-ministral-500 hover:bg-ministral-600 text-white transition-colors shadow-lg shadow-ministral-500/20 active:scale-95"
              >
                Fazer Upgrade para Pro →
              </button>
            ) : (
              <div className="text-center p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 text-sm font-medium">
                Entre em contato com o suporte
              </div>
            )}
          </div>
        </div>

        {/* Enterprise Card */}
        <div className={`bg-zinc-900 border-2 ${isEnterprise ? 'border-ministral-gold' : 'border-zinc-800'} rounded-2xl p-6 flex flex-col relative shadow-xl shadow-black/20`}>
          <div className="mb-6">
            <h3 className="text-xl font-bold text-ministral-gold mb-2">{PLANS.enterprise.name}</h3>
            <p className="text-zinc-400 text-xs mb-4">Plano completo para igrejas que precisam de controle total e suporte dedicado.</p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-white">{PLANS.enterprise.price}</span>
              <span className="text-zinc-400 font-medium">/mês</span>
            </div>
          </div>
          
          <div className="flex-1 space-y-3 mb-8">
            {PLANS.enterprise.features.map((feature, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <CheckCircle2 className="text-ministral-gold shrink-0 mt-0.5" size={18} />
                <span className="text-sm text-zinc-300 font-medium">
                  {feature.label}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-auto">
            {isEnterprise ? (
              <button 
                disabled
                className="w-full py-3 rounded-xl font-bold text-sm bg-ministral-gold/10 text-ministral-gold border border-ministral-gold/20 cursor-not-allowed flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={18} /> Plano Ativo
              </button>
            ) : checkoutUrl ? (
              <button 
                onClick={() => handleUpgrade('enterprise')}
                className="w-full py-3 rounded-xl font-bold text-sm bg-white hover:bg-zinc-200 text-zinc-900 transition-colors shadow-lg shadow-white/5 active:scale-95"
              >
                Contratar Enterprise →
              </button>
            ) : (
              <div className="text-center p-3 rounded-xl bg-zinc-800 text-zinc-400 text-sm font-medium">
                Entre em contato com o suporte
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-12 text-center text-sm text-zinc-500">
        Dúvidas sobre o plano? Entre em contato com o suporte.
      </div>
    </div>
  );
};
