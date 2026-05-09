import React, { useState } from 'react';
import { Database, FileText, AlertTriangle, Sparkles, ArrowRight, Plug, Link, CheckCircle2, XCircle, Key } from 'lucide-react';
import { configureSupabaseManual, validateConnection } from '../services/supabaseService';

interface Props {
  onEnterDemo: () => void;
  onConfigured?: () => void; // Callback para notificar o App
}

export const SetupScreen: React.FC<Props> = ({ onEnterDemo, onConfigured }) => {
  const [customUrl, setCustomUrl] = useState("");
  const [customKey, setCustomKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleManualConnect = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!customUrl.trim() || !customKey.trim()) {
          setErrorMsg("Por favor, preencha a URL e a Chave do Supabase.");
          return;
      }

      setIsLoading(true);
      setErrorMsg("");

      // Validação Profissional
      const isValid = await validateConnection(customUrl.trim(), customKey.trim());

      if (isValid) {
          configureSupabaseManual(customUrl.trim(), customKey.trim());
          if (onConfigured) onConfigured();
          // Force reload apenas se necessário, mas o callback deve resolver
      } else {
          setErrorMsg("Não foi possível conectar. Verifique se a URL e a KEY estão corretas e se o banco está ativo.");
      }
      setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white p-4 font-sans relative overflow-hidden">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=2940&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-overlay"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/90 to-zinc-900/80"></div>

      <div className="w-full max-w-lg bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/50 rounded-[2.5rem] p-8 shadow-2xl animate-fade-in relative z-10 my-8 overflow-hidden">
        
        {/* Glow Effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-1 bg-ministral-500/50 blur-[30px]"></div>

        <div className="text-center mb-10">
           <div className="inline-flex p-4 bg-zinc-800/50 rounded-3xl border border-zinc-700/50 shadow-inner mb-6">
             <Database size={40} className="text-ministral-500" />
           </div>
           <h1 className="text-3xl font-black text-white tracking-tight mb-2">Setup do Sistema</h1>
           <p className="text-zinc-400 text-sm font-medium">Conecte sua infraestrutura ou teste agora.</p>
        </div>
        
        {/* Demo Button - High Emphasis */}
        <button 
            onClick={onEnterDemo}
            className="group w-full relative overflow-hidden bg-gradient-to-r from-ministral-600 to-ministral-500 hover:from-ministral-500 hover:to-ministral-400 text-white font-bold py-4 rounded-2xl shadow-lg shadow-ministral-900/20 transition-all active:scale-[0.98] mb-8 border border-white/10"
        >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            <div className="relative flex items-center justify-center gap-3 uppercase tracking-widest text-xs">
                <Sparkles size={16} className="text-yellow-300 animate-pulse" />
                <span>Modo Demonstração</span>
                <ArrowRight size={16} className="opacity-60 group-hover:translate-x-1 transition-transform" />
            </div>
        </button>

        <div className="relative flex items-center py-4 mb-6">
            <div className="flex-grow border-t border-zinc-800"></div>
            <span className="flex-shrink-0 mx-4 text-zinc-600 text-[10px] font-black uppercase tracking-widest">Conexão Privada</span>
            <div className="flex-grow border-t border-zinc-800"></div>
        </div>

        {/* Manual Connection Form */}
        <form onSubmit={handleManualConnect} className="mb-8 space-y-4">
            <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-500 uppercase ml-1">Supabase URL</label>
                <div className="relative group">
                    <Link size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-ministral-gold transition-colors" />
                    <input 
                        type="text" 
                        value={customUrl} 
                        onChange={e => setCustomUrl(e.target.value)} 
                        placeholder="https://xyz.supabase.co" 
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3.5 pl-11 pr-4 text-sm text-white placeholder:text-zinc-700 focus:border-ministral-500/50 focus:ring-1 focus:ring-ministral-500/50 outline-none transition-all font-medium"
                    />
                </div>
            </div>
            <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-500 uppercase ml-1">Anon Key</label>
                <div className="relative group">
                    <Key size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-ministral-gold transition-colors" />
                    <input 
                        type="password" 
                        value={customKey} 
                        onChange={e => setCustomKey(e.target.value)} 
                        placeholder="eyJh..." 
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3.5 pl-11 pr-4 text-sm text-white placeholder:text-zinc-700 focus:border-ministral-500/50 focus:ring-1 focus:ring-ministral-500/50 outline-none transition-all font-medium"
                    />
                </div>
            </div>

            {errorMsg && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 animate-slide-up">
                    <XCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-200 leading-relaxed font-medium">{errorMsg}</p>
                </div>
            )}

            <button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-4 rounded-2xl text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-3 mt-4 disabled:opacity-50 shadow-lg"
            >
                {isLoading ? (
                    <>Verificando Conexão...</>
                ) : (
                    <><Plug size={16} /> Conectar Supabase</>
                )}
            </button>
        </form>

        <div className="bg-zinc-950/50 border border-zinc-800 p-4 rounded-2xl mb-6 flex items-start gap-3">
            <AlertTriangle size={18} className="text-zinc-600 shrink-0 mt-0.5" />
            <p className="text-zinc-500 text-xs leading-relaxed font-medium">
                Dica: Em produção, defina as variáveis de ambiente (VITE_SUPABASE_URL e KEY) no servidor para pular esta etapa.
            </p>
        </div>
      </div>
    </div>
  );
};