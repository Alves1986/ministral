
import React from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  stats: Record<string, number>;
  monthName: string;
}

export const StatsModal: React.FC<Props> = ({ isOpen, onClose, stats, monthName }) => {
  if (!isOpen) return null;

  const data = Object.entries(stats)
    .map(([name, count]) => ({ name, count: Number(count) }))
    .sort((a, b) => b.count - a.count);

  const maxVal = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg border border-zinc-200 dark:border-zinc-700 flex flex-col max-h-[80vh]">
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Estatísticas - {monthName}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 text-2xl">&times;</button>
        </div>
        
        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
          {data.length > 0 ? (
            <div className="space-y-4">
               {data.map((item, idx) => (
                  <div key={item.name} className="flex items-center gap-3">
                     <div className="w-24 text-sm text-right truncate text-zinc-500 font-medium" title={item.name}>{item.name}</div>
                     <div className="flex-1 h-6 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden relative">
                        <div 
                          className={`h-full flex items-center justify-end px-2 transition-all duration-500 ${idx % 2 === 0 ? 'bg-blue-600' : 'bg-indigo-500'}`}
                          style={{ width: `${(item.count / maxVal) * 100}%` }}
                        >
                           <span className="text-[10px] text-white font-bold">{item.count}</span>
                        </div>
                     </div>
                  </div>
               ))}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-zinc-500 py-10">
              Nenhuma escala preenchida ainda para gerar dados.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
