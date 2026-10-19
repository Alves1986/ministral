import React from 'react';
import { Loader2, AlertCircle, Info } from 'lucide-react';

interface FeedbackStateProps {
  type: 'loading' | 'error' | 'empty' | 'info';
  title?: string;
  message?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * FeedbackState — Componente compartilhado para estados de loading,
 * erro, vazio e informação. Garante consistência visual em toda a aplicação.
 */
export const FeedbackState: React.FC<FeedbackStateProps> = ({
  type,
  title,
  message,
  icon,
  action
}) => {
  const configs = {
    loading: {
      defaultTitle: 'Carregando...',
      defaultMessage: 'Aguarde enquanto processamos sua solicitação.',
      defaultIcon: <Loader2 size={40} className="animate-spin text-secondary" />,
      containerClass: 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700',
    },
    error: {
      defaultTitle: 'Ocorreu um erro',
      defaultMessage: 'Não foi possível concluir a operação. Tente novamente.',
      defaultIcon: <AlertCircle size={40} className="text-red-500" />,
      containerClass: 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30',
    },
    empty: {
      defaultTitle: 'Nenhum resultado',
      defaultMessage: 'Não há dados para exibir no momento.',
      defaultIcon: <Info size={40} className="text-zinc-300 dark:text-zinc-600" />,
      containerClass: 'bg-zinc-50 dark:bg-zinc-900/50 border-dashed border-zinc-200 dark:border-zinc-800',
    },
    info: {
      defaultTitle: 'Informação',
      defaultMessage: '',
      defaultIcon: <Info size={40} className="text-secondary" />,
      containerClass: 'bg-secondary/5 border-secondary/20',
    },
  };

  const config = configs[type];

  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 rounded-2xl border text-center ${config.containerClass}`}>
      <div className="mb-4">
        {icon || config.defaultIcon}
      </div>
      <p className="font-bold text-zinc-700 dark:text-zinc-200 mb-1">
        {title || config.defaultTitle}
      </p>
      {(message || config.defaultMessage) && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm">
          {message || config.defaultMessage}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-5 py-2.5 bg-secondary hover:bg-secondaryHover text-white text-sm font-bold rounded-xl transition-all shadow-sm shadow-secondary/20 active:scale-95"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};
