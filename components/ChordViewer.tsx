
import React, { useState, useEffect } from 'react';
import { X, Minus, Plus, Save, Type, Music } from 'lucide-react';
import { transposeText } from '../utils/musicUtils';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    initialContent: string;
    initialKey?: string;
    onSavePreference?: (newKey: string, content: string) => void;
    readOnly?: boolean;
}

export const ChordViewer: React.FC<Props> = ({ 
    isOpen, onClose, title, initialContent, initialKey, onSavePreference, readOnly 
}) => {
    const [transpose, setTranspose] = useState(0);
    const [fontSize, setFontSize] = useState(14);
    const [content, setContent] = useState(initialContent);
    const [viewContent, setViewContent] = useState(initialContent);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        // Reset when opening
        if (isOpen) {
            setContent(initialContent);
            setViewContent(initialContent);
            setTranspose(0);
            setIsEditing(!initialContent); // If empty, start in edit mode
        }
    }, [isOpen, initialContent]);

    useEffect(() => {
        // Apply transposition to view
        if (!isEditing) {
            const transposed = transposeText(content, transpose);
            setViewContent(transposed);
        }
    }, [transpose, content, isEditing]);

    if (!isOpen) return null;

    const handleSave = () => {
        if (onSavePreference) {
            // We save the BASE content (0 transposition) but maybe we want to save the KEY preference
            // In a real app, we'd detect the key from the chords. 
            // For now, we save the content as is.
            onSavePreference(initialKey || 'C', isEditing ? viewContent : content);
        }
        setIsEditing(false);
    };

    return (
        <div className="fixed inset-0 z-[100] flex flex-col bg-white dark:bg-zinc-950 animate-fade-in">
            {/* Header Toolbar */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm z-10">
                <div className="flex items-center gap-3 overflow-hidden">
                    <button onClick={onClose} className="p-2 -ml-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <X size={24} className="text-zinc-600 dark:text-zinc-400"/>
                    </button>
                    <div className="min-w-0">
                        <h2 className="font-bold text-lg text-zinc-900 dark:text-white truncate">{title}</h2>
                        <p className="text-xs text-zinc-500 flex items-center gap-1">
                            {isEditing ? 'Editando Cifra' : `Tom: ${initialKey || 'Original'} ${transpose > 0 ? `+${transpose}` : transpose < 0 ? transpose : ''}`}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {!isEditing && (
                        <>
                            <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1 border border-zinc-200 dark:border-zinc-700">
                                <button onClick={() => setTranspose(t => t - 1)} className="p-2 hover:bg-white dark:hover:bg-zinc-700 rounded-md shadow-sm transition-all active:scale-95"><Minus size={16}/></button>
                                <span className="w-8 text-center font-bold text-sm text-zinc-700 dark:text-zinc-300">{transpose > 0 ? `+${transpose}` : transpose}</span>
                                <button onClick={() => setTranspose(t => t + 1)} className="p-2 hover:bg-white dark:hover:bg-zinc-700 rounded-md shadow-sm transition-all active:scale-95"><Plus size={16}/></button>
                            </div>
                            <div className="hidden sm:flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1 border border-zinc-200 dark:border-zinc-700">
                                <button onClick={() => setFontSize(s => Math.max(10, s - 2))} className="p-2 hover:bg-white dark:hover:bg-zinc-700 rounded-md"><Type size={12}/></button>
                                <button onClick={() => setFontSize(s => Math.min(24, s + 2))} className="p-2 hover:bg-white dark:hover:bg-zinc-700 rounded-md"><Type size={18}/></button>
                            </div>
                        </>
                    )}
                    
                    {!readOnly && (
                        <button 
                            onClick={() => {
                                if (isEditing) handleSave();
                                else {
                                    setTranspose(0);
                                    setIsEditing(true);
                                    setViewContent(content); // Reset to base for editing
                                }
                            }} 
                            className={`p-2.5 rounded-lg font-bold text-white shadow-lg transition-all active:scale-95 flex items-center gap-2 ${isEditing ? 'bg-ministral-500 hover:bg-ministral-600' : 'bg-ministral-500 hover:bg-ministral-600'}`}
                        >
                            {isEditing ? <Save size={18}/> : <span className="text-xs">Editar</span>}
                        </button>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto bg-[#fafafa] dark:bg-[#0c0c0c] relative">
                {isEditing ? (
                    <textarea
                        value={viewContent}
                        onChange={e => setViewContent(e.target.value)}
                        className="w-full h-full p-4 font-mono text-sm bg-transparent text-zinc-900 dark:text-zinc-200 outline-none resize-none"
                        placeholder="Cole a cifra aqui..."
                        autoFocus
                    />
                ) : (
                    <pre 
                        className="p-4 md:p-8 font-mono text-zinc-800 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed transition-all duration-200"
                        style={{ fontSize: `${fontSize}px` }}
                    >
                        {/* Highlighting Chords logic could go here, but simple text replacement is robust */}
                        {viewContent || (
                            <div className="flex flex-col items-center justify-center h-[50vh] text-zinc-400 gap-4 opacity-50">
                                <Music size={48} />
                                <p>Nenhuma cifra cadastrada.</p>
                            </div>
                        )}
                    </pre>
                )}
            </div>
        </div>
    );
};
