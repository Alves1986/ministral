import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State;
  public props: Props;

  constructor(props: Props) {
    super(props);
    this.props = props;
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const isNetworkError = this.state.error?.message?.includes('network') || this.state.error?.message?.includes('fetch') || !navigator.onLine;

      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-6 text-center">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-8 max-w-sm w-full animate-slide-up">
            <div className="w-16 h-16 mx-auto mb-6 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center text-red-600 dark:text-red-400">
              {isNetworkError ? <WifiOff size={32} /> : <AlertTriangle size={32} />}
            </div>
            
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
              {isNetworkError ? "Falha de Conexão" : "Algo deu errado"}
            </h2>
            
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8 leading-relaxed">
              {isNetworkError 
                ? "Não foi possível carregar os dados. Verifique sua internet e tente novamente."
                : "Ocorreu um erro inesperado na aplicação. Nossa equipe foi notificada."}
            </p>

            <button
              onClick={this.handleReload}
              className="w-full py-3.5 bg-ministral-500 text-white rounded-xl font-bold text-sm shadow-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 active:scale-95"
            >
              <RefreshCw size={18} />
              Recarregar Aplicação
            </button>
            
            {this.state.error && process.env.NODE_ENV === 'development' && (
                <div className="mt-6 p-4 bg-zinc-100 dark:bg-black rounded-lg text-left overflow-auto max-h-32 text-[10px] font-mono text-red-500">
                    {this.state.error.toString()}
                </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}