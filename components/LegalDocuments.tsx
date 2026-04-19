
import React from 'react';
import { X, Shield, FileText, ArrowLeft, Mail } from 'lucide-react';

export type LegalDocType = 'terms' | 'privacy' | null;

// --- CONTEÚDO PURO (Reutilizável) ---
const LegalContent: React.FC<{ type: LegalDocType }> = ({ type }) => {
  if (type === 'terms') {
      return (
        <div className="space-y-4 text-zinc-700 dark:text-zinc-300 text-sm leading-relaxed text-justify">
          <p><strong>Última atualização: {new Date().toLocaleDateString('pt-BR')}</strong></p>
          
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mt-4">1. Aceitação dos Termos</h3>
          <p>Ao acessar e utilizar o sistema <strong>Ministral</strong>, você concorda em cumprir e ficar vinculado aos seguintes termos e condições de uso. Se você não concordar com estes termos, não deverá utilizar o serviço.</p>

          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mt-4">2. Descrição do Serviço</h3>
          <p>O Ministral é uma ferramenta de gestão de escalas, disponibilidade e comunicação para equipes voluntárias e ministeriais. O serviço é fornecido "como está", sem garantias de que será ininterrupto ou livre de erros.</p>

          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mt-4">3. Responsabilidades do Usuário</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>Você é responsável por manter a confidencialidade de sua senha e conta.</li>
            <li>Você concorda em fornecer informações verdadeiras e precisas sobre sua disponibilidade.</li>
            <li>É proibido usar o sistema para fins ilegais ou não autorizados pela liderança da equipe.</li>
          </ul>

          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mt-4">4. Propriedade Intelectual</h3>
          <p>Todo o código-fonte, design, logotipos e funcionalidades do sistema são propriedade exclusiva dos desenvolvedores ou licenciados para a organização. O uso não autorizado de qualquer material é estritamente proibido.</p>

          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mt-4">5. Encerramento</h3>
          <p>A administração reserva-se o direito de suspender ou encerrar sua conta a qualquer momento, por qualquer motivo, incluindo, sem limitação, a violação destes Termos de Uso.</p>
        </div>
      );
    }

    if (type === 'privacy') {
      return (
        <div className="space-y-4 text-zinc-700 dark:text-zinc-300 text-sm leading-relaxed text-justify">
          <p><strong>Última atualização: {new Date().toLocaleDateString('pt-BR')}</strong></p>

          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mt-4">1. Coleta de Informações</h3>
          <p>Para o funcionamento adequado das escalas, coletamos as seguintes informações pessoais:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Nome completo (para identificação na escala).</li>
            <li>E-mail (para login e recuperação de senha).</li>
            <li>Telefone/WhatsApp (para comunicação urgente e notificações).</li>
            <li>Foto de perfil (opcional, para identificação visual).</li>
            <li>Dados de disponibilidade (datas em que você pode ou não servir).</li>
          </ul>

          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mt-4">2. Uso das Informações</h3>
          <p>Seus dados são utilizados exclusivamente para:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Organização e geração de escalas de voluntários.</li>
            <li>Envio de notificações sobre eventos, trocas e avisos.</li>
            <li>Gestão administrativa da equipe.</li>
          </ul>
          <p>Nós <strong>não</strong> vendemos, trocamos ou transferimos suas informações pessoais para terceiros externos para fins de marketing.</p>

          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mt-4">3. Segurança dos Dados</h3>
          <p>Implementamos medidas de segurança para manter suas informações pessoais protegidas. Os dados são armazenados em bancos de dados seguros (Supabase) com autenticação criptografada.</p>

          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mt-4">4. Dados do Google (Limited Use Policy)</h3>
          <p>O uso de informações recebidas das APIs do Google por este aplicativo adere à <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer" className="text-ministral-500 hover:underline">Política de Dados do Usuário dos Serviços de API do Google</a>, incluindo os requisitos de uso limitado.</p>
          <p>Ao utilizar o login com Google:</p>
          <ul className="list-disc pl-5 space-y-1">
             <li>Acessamos apenas seu nome, e-mail e foto de perfil para criar sua conta no sistema.</li>
             <li>Não compartilhamos seus dados do Google com ferramentas de IA de terceiros para fins de treinamento.</li>
             <li>Não armazenamos dados além do necessário para a identificação do usuário na escala.</li>
          </ul>

          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mt-4">5. Seus Direitos</h3>
          <p>Você tem o direito de acessar, corrigir ou solicitar a exclusão de seus dados pessoais a qualquer momento. Para excluir sua conta, entre em contato com o administrador do sistema ou utilize a opção de exclusão nas configurações (se disponível).</p>

          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mt-4">6. Alterações nesta Política</h3>
          <p>Podemos atualizar nossa Política de Privacidade periodicamente. Recomendamos que você revise esta página regularmente para quaisquer alterações.</p>

          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mt-4">7. Contato</h3>
          <p>Se você tiver dúvidas sobre esta Política de Privacidade, entre em contato conosco:</p>
          <div className="flex items-center gap-2 mt-2 p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg w-fit">
             <Mail size={16} className="text-zinc-500"/>
             <span className="font-medium text-zinc-700 dark:text-zinc-300">contato@ministerio.com</span>
          </div>
        </div>
      );
    }
    return null;
};

// --- MODAL (Uso interno no App) ---
interface Props {
  isOpen: boolean;
  type: LegalDocType;
  onClose: () => void;
}

export const LegalModal: React.FC<Props> = ({ isOpen, type, onClose }) => {
  if (!isOpen || !type) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${type === 'terms' ? 'bg-ministral-100 text-ministral-600 dark:bg-ministral-900/30' : 'bg-ministral-gold/10 text-ministral-gold dark:bg-ministral-gold/30'}`}>
               {type === 'terms' ? <FileText size={20}/> : <Shield size={20}/>}
            </div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
              {type === 'terms' ? 'Termos de Uso' : 'Política de Privacidade'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
           <LegalContent type={type} />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 bg-ministral-500 text-white font-bold rounded-xl hover:opacity-90 transition-opacity"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
};
