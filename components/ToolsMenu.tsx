
import React, { useState, useRef } from 'react';
import { FileText, Trash, ChevronDown, FileDown, RotateCcw, X } from 'lucide-react';
import { useToast } from './Toast';
import { useClickOutside } from '../hooks/useClickOutside';

interface Props {
  onExportIndividual: (member: string) => void;
  onExportFull: () => void;
  onClearMonth: () => void;
  allMembers: string[];
}

export const ToolsMenu: React.FC<Props> = ({ 
  onExportIndividual, 
  onExportFull, 
  onClearMonth,
  allMembers 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();

  useClickOutside(menuRef, () => {
    if (isOpen) setIsOpen(false);
  });

  const handleIndividual = () => {
    if (!selectedMember) {
        addToast("Selecione um membro primeiro", "warning");
        return;
    }
    onExportIndividual(selectedMember);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 border ${
            isOpen 
            ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 border-zinc-300 dark:border-zinc-600' 
            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700'
        }`}
      >
        Ferramentas <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Mobile Overlay */}
          <div 
            className="fixed inset-0 bg-black/50 z-[95] md:hidden" 
            onClick={() => setIsOpen(false)}
          />
          
          <div className={`
              fixed z-[100] bg-white dark:bg-zinc-800 overflow-hidden animate-slide-up
              bottom-0 left-0 right-0 w-full rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.3)] border-t border-zinc-200 dark:border-zinc-700
              md:absolute md:bottom-auto md:left-auto md:right-0 md:top-full md:mt-2 md:w-72 md:rounded-xl md:shadow-xl md:border md:animate-fade-in
              pb-[calc(env(safe-area-inset-bottom)+1rem)] md:pb-0
          `}>
            
            <div className="flex md:hidden justify-between items-center p-4 border-b border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50">
                <span className="font-bold text-zinc-800 dark:text-white">Ferramentas de Escala</span>
                <button onClick={() => setIsOpen(false)} className="p-1 bg-zinc-200 dark:bg-zinc-700 rounded-full text-zinc-500">
                    <X size={20} />
                </button>
            </div>

            <div className="p-4 space-y-1">
              <div className="pb-3 border-b border-zinc-100 dark:border-zinc-700 mb-2">
                <p className="text-xs font-bold text-zinc-500 uppercase mb-2">Exportar Individual</p>
                <div className="flex gap-2">
                  <select 
                    value={selectedMember} 
                    onChange={e => setSelectedMember(e.target.value)}
                    className="w-full text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-600 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="">Selecione...</option>
                    {allMembers.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <button onClick={handleIndividual} className="bg-zinc-100 dark:bg-zinc-700 p-2.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors border border-zinc-200 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200">
                    <FileText size={18} />
                  </button>
                </div>
              </div>
              
              <button onClick={onExportFull} className="w-full text-left px-3 py-3 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg flex items-center gap-3 transition-colors">
                <FileDown size={18} /> Baixar PDF Completo
              </button>
              
              <div className="border-t border-zinc-100 dark:border-zinc-700 my-1"></div>
              
              <button onClick={onClearMonth} className="w-full text-left px-3 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg flex items-center gap-3 transition-colors">
                <Trash size={18} /> Limpar Escala do Mês
              </button>
            </div>
            
            <div className="h-2 md:hidden"></div>
          </div>
        </>
      )}
    </div>
  );
};
