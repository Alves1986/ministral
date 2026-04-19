
import React, { useRef, useEffect } from 'react';
import { Bold, Italic, List, Link as LinkIcon, AlignLeft } from 'lucide-react';

interface Props {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
    className?: string;
}

export const RichTextEditor: React.FC<Props> = ({ value, onChange, placeholder, className }) => {
    const editorRef = useRef<HTMLDivElement>(null);

    // Sync value prop changes
    useEffect(() => {
        if (editorRef.current && value !== editorRef.current.innerHTML) {
            editorRef.current.innerHTML = value;
            // Mover o cursor para o final do conteúdo após atualização
            const range = document.createRange();
            const sel = window.getSelection();
            range.selectNodeContents(editorRef.current);
            range.collapse(false);
            sel?.removeAllRanges();
            sel?.addRange(range);
        }
    }, [value]);

    const execCmd = (command: string, value: string | undefined = undefined) => {
        document.execCommand(command, false, value);
        if (editorRef.current) onChange(editorRef.current.innerHTML);
    };

    const handleInput = () => {
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
    };

    return (
        <div className={`flex flex-col border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-900 focus-within:ring-2 focus-within:ring-blue-500 transition-all ${className}`}>
            {/* Toolbar */}
            <div className="flex items-center gap-1 p-2 bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                <button 
                    type="button"
                    onClick={() => execCmd('bold')} 
                    className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors"
                    title="Negrito"
                >
                    <Bold size={16} />
                </button>
                <button 
                    type="button"
                    onClick={() => execCmd('italic')} 
                    className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors"
                    title="Itálico"
                >
                    <Italic size={16} />
                </button>
                <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-600 mx-1" />
                <button 
                    type="button"
                    onClick={() => execCmd('insertUnorderedList')} 
                    className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors"
                    title="Lista"
                >
                    <List size={16} />
                </button>
                <button 
                    type="button"
                    onClick={() => {
                        const url = prompt('URL do link:');
                        if(url) execCmd('createLink', url);
                    }} 
                    className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors"
                    title="Link"
                >
                    <LinkIcon size={16} />
                </button>
            </div>

            {/* Editor Area */}
            <div
                ref={editorRef}
                contentEditable
                onInput={handleInput}
                className="flex-1 p-3 outline-none min-h-[120px] text-sm text-zinc-800 dark:text-zinc-100 prose prose-sm dark:prose-invert max-w-none overflow-y-auto"
                data-placeholder={placeholder}
                style={{ whiteSpace: 'pre-wrap' }}
            />
            
            {/* Placeholder CSS trick */}
            <style>{`
                [contentEditable]:empty:before {
                    content: attr(data-placeholder);
                    color: #a1a1aa;
                    pointer-events: none;
                    display: block; /* For Firefox */
                }
            `}</style>
        </div>
    );
};
