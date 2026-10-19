import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Mic, Square, Loader2, Play, Pause } from 'lucide-react';
import { getSupabase } from '../services/supabase/client';
import { useAppStore } from '../store/appStore';
import { useToast } from './Toast';
import { TeamMemberProfile } from '../types';

interface Message {
  id: string;
  sender_profile_id: string;
  content_type: 'text' | 'audio';
  content: string;
  created_at: string;
}

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventIso: string;
  eventTitle: string;
  members: TeamMemberProfile[];
}

export const EventChatModal: React.FC<ChatModalProps> = ({ isOpen, onClose, eventIso, eventTitle, members }) => {
  const { ministryId, currentUser } = useAppStore();
  const orgId = currentUser?.organizationId;
  const { addToast } = useToast();
  const supabase = getSupabase()!;

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen && orgId && ministryId) {
      loadMessages();
      
      const subscription = supabase
        .channel(`chat_${eventIso}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'event_messages',
            filter: `event_iso=eq.${eventIso}`
          },
          (payload) => {
            setMessages((prev) => [...prev, payload.new as Message]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
      };
    }
  }, [isOpen, eventIso, orgId, ministryId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    const { data, error } = await supabase
      .from('event_messages')
      .select('*')
      .eq('organization_id', orgId)
      .eq('ministry_id', ministryId)
      .eq('event_iso', eventIso)
      .order('created_at', { ascending: true });

    if (error) {
      console.error(error);
      addToast('Erro ao carregar mensagens.', 'error');
    } else {
      setMessages(data || []);
    }
  };

  const handleSendText = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || !orgId || !ministryId || !currentUser) return;

    setIsSending(true);
    const { error } = await supabase.from('event_messages').insert({
      organization_id: orgId,
      ministry_id: ministryId,
      event_iso: eventIso,
      sender_profile_id: currentUser.id,
      content_type: 'text',
      content: inputText.trim()
    });

    if (error) {
      console.error(error);
      addToast('Erro ao enviar mensagem', 'error');
    } else {
      setInputText('');
    }
    setIsSending(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await uploadAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((prev) => prev + 1), 1000);
    } catch (err) {
      console.error(err);
      addToast('Permissão de microfone negada ou indisponível.', 'error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const uploadAudio = async (blob: Blob) => {
    setIsSending(true);
    try {
      const fileName = `${Date.now()}_${currentUser?.id}.webm`;
      const { data, error } = await supabase.storage
        .from('chat_audio')
        .upload(fileName, blob, { contentType: 'audio/webm' });

      if (error) throw error;

      const { data: urlData } = supabase.storage.from('chat_audio').getPublicUrl(fileName);
      
      const { error: dbError } = await supabase.from('event_messages').insert({
        organization_id: orgId,
        ministry_id: ministryId,
        event_iso: eventIso,
        sender_profile_id: currentUser?.id,
        content_type: 'audio',
        content: urlData.publicUrl
      });

      if (dbError) throw dbError;
    } catch (error) {
      console.error(error);
      addToast('Erro ao enviar áudio.', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const getSenderName = (id: string) => {
    if (id === currentUser?.id) return 'Você';
    const member = members.find(m => m.id === id);
    return member?.name.split(' ')[0] || 'Desconhecido';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-50 dark:bg-zinc-900 w-full max-w-lg h-[80vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up border border-zinc-200 dark:border-zinc-800">
        
        {/* Header */}
        <div className="bg-secondary p-4 flex items-center justify-between text-white shrink-0">
          <div>
            <h2 className="font-bold text-lg leading-tight">Chat do Evento</h2>
            <p className="text-xs text-white/80">{eventTitle}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-gradient-to-b from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-950">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-zinc-400 text-sm">
              Nenhuma mensagem ainda. Comece a conversa!
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.sender_profile_id === currentUser?.id;
              return (
                <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] text-zinc-400 mb-1 ml-1">{getSenderName(msg.sender_profile_id)}</span>
                  <div className={`max-w-[80%] rounded-2xl p-3 ${isMine ? 'bg-secondary text-white rounded-tr-sm' : 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-tl-sm shadow-sm'}`}>
                    {msg.content_type === 'text' ? (
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                    ) : (
                      <audio controls className="h-10 max-w-[200px]" src={msg.content} />
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-400 mt-1 mr-1">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700 shrink-0">
          {isRecording ? (
            <div className="flex items-center justify-between bg-red-50 dark:bg-red-900/20 rounded-full p-2 pr-4 border border-red-200 dark:border-red-900/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center animate-pulse">
                  <Mic size={20} className="text-white" />
                </div>
                <span className="text-red-500 font-mono font-bold">{formatTime(recordingTime)}</span>
              </div>
              <button onClick={stopRecording} className="text-zinc-500 hover:text-red-500 p-2">
                <Square size={20} />
              </button>
            </div>
          ) : (
            <form onSubmit={handleSendText} className="flex items-end gap-2">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Digite uma mensagem..."
                className="flex-1 max-h-32 min-h-[44px] bg-zinc-100 dark:bg-zinc-900 border-transparent focus:border-secondary focus:ring-1 focus:ring-secondary rounded-2xl p-3 text-sm resize-none custom-scrollbar text-zinc-900 dark:text-white"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendText();
                  }
                }}
              />
              {inputText.trim() ? (
                <button type="submit" disabled={isSending} className="w-11 h-11 shrink-0 rounded-full bg-secondary flex items-center justify-center text-white shadow-sm hover:bg-secondaryHover transition-colors disabled:opacity-50">
                  {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="ml-1" />}
                </button>
              ) : (
                <button type="button" onClick={startRecording} disabled={isSending} className="w-11 h-11 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-300 shadow-sm hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors disabled:opacity-50">
                  <Mic size={20} />
                </button>
              )}
            </form>
          )}
        </div>

      </div>
    </div>
  );
};
