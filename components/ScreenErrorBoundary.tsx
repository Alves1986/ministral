import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  screenName?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ScreenErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[ScreenErrorBoundary] Error in screen "${this.props.screenName || 'Unknown'}":`, error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 min-h-[350px] w-full text-center bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="w-14 h-14 bg-red-50 dark:bg-red-950/40 text-red-500 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle size={28} />
          </div>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">
            Erro ao carregar {this.props.screenName || 'esta tela'}
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mb-6 leading-relaxed">
            Ocorreu uma instabilidade inesperada ao processar os dados desta tela. O restante do aplicativo continua funcionando normalmente.
          </p>
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-2 px-5 py-2.5 bg-ministral-500 hover:bg-ministral-600 text-white rounded-xl text-sm font-semibold transition-all active:scale-95 shadow-md shadow-ministral-500/20"
          >
            <RefreshCw size={16} />
            Tentar Novamente
          </button>
          {import.meta.env.DEV && this.state.error && (
            <div className="mt-6 p-3 bg-zinc-100 dark:bg-black rounded-lg text-left overflow-auto max-h-32 max-w-lg w-full text-[11px] font-mono text-red-500">
              {this.state.error.toString()}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
export default ScreenErrorBoundary;
