import React, { useRef, useEffect } from 'react';
import { X, Shield, FileText, Building2, Mail, MapPin } from 'lucide-react';

export type LegalDocType = 'terms' | 'privacy' | null;

export const LEGAL_TERMS_VERSION = '2026.11';

const getEnv = (key: string, fallback: string): string => {
  try {
    const metaEnv = (import.meta as any)?.env;
    if (metaEnv && metaEnv[key]) return String(metaEnv[key]);
  } catch {}
  return fallback;
};

export const LEGAL_COMPANY_INFO = {
  name: getEnv('VITE_COMPANY_NAME', 'Ministral Gestão Ministerial (Configurar VITE_COMPANY_NAME)'),
  cnpj: getEnv('VITE_COMPANY_CNPJ', 'Configurar em VITE_COMPANY_CNPJ'),
  address: getEnv('VITE_COMPANY_ADDRESS', 'Configurar endereço físico em VITE_COMPANY_ADDRESS'),
  dpoEmail: getEnv('VITE_DPO_EMAIL', 'contato.ministral@gmail.com'),
  supportEmail: getEnv('VITE_SUPPORT_EMAIL', 'contato.ministral@gmail.com'),
};

// --- CONTEÚDO PURO (Reutilizável) ---
export const LegalContent: React.FC<{ type: LegalDocType }> = ({ type }) => {
  if (type === 'terms') {
    return (
      <div className="space-y-4 text-zinc-700 dark:text-zinc-300 text-sm leading-relaxed text-justify">
        <p>
          <strong>Versão: {LEGAL_TERMS_VERSION} — Última atualização: 18/11/2026</strong>
        </p>

        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mt-4">1. Aceitação dos Termos e Capacidade</h3>
        <p>
          Ao criar uma conta ou utilizar o sistema <strong>Ministral</strong>, você declara ter lido, compreendido e aceitado integralmente estes Termos de Uso e a Política de Privacidade. O cadastro de nova organização exige idade mínima de <strong>18 (dezoito) anos</strong>. Para membros voluntários menores de 12 (doze) anos em ministérios infantis ou de jovens, o tratamento de dados exige o consentimento específico e em destaque de pelo menos um dos pais ou responsável legal (LGPD, art. 14, § 1º).
        </p>

        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mt-4">2. Descrição do Serviço</h3>
        <p>
          O Ministral é uma plataforma SaaS de gestão de escalas, disponibilidade, repertório e comunicação para equipes voluntárias e ministeriais. Buscamos manter alta disponibilidade contínua, mas o serviço pode passar por manutenções programadas ou eventos externos de infraestrutura de terceiros, sem promessa de SLA de 100% livre de falhas.
        </p>

        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mt-4">3. Planos, Renovação Automática, Cancelamento e Reembolso (CDC art. 49)</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Preço Total e Transparência (CDC art. 31):</strong> Os valores exibidos na tela de planos (Pro: R$ 99,00/mês; Enterprise: R$ 149,00/mês) representam o preço final mensal, sem taxas ocultas adicionais.</li>
          <li><strong>Renovação Automática:</strong> As assinaturas mensais são renovadas automaticamente a cada ciclo de 30 dias pelo gateway oficial (Asaas ou Stripe), salvo cancelamento prévio pelo administrador da organização.</li>
          <li><strong>Cancelamento Fácil no App:</strong> O administrador pode cancelar a assinatura a qualquer momento diretamente em <em>Planos e Assinatura → Gerenciar / Cancelar Assinatura</em> ou solicitando pelo suporte, sem multa ou fidelidade, mantendo o acesso até o fim do período já pago.</li>
          <li><strong>Direito de Arrependimento em 7 Dias (CDC art. 49):</strong> Em qualquer contratação ou primeiro pagamento online, o contratante tem o direito de desistir da assinatura no prazo de até <strong>7 (sete) dias corridos</strong> a contar da contratação, com reembolso integral (100%) e imediato dos valores pagos.</li>
        </ul>

        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mt-4">4. Uso de Inteligência Artificial</h3>
        <p>
          O sistema oferece recursos opcionais de Inteligência Artificial (sugestão de escalas, análise de conflitos e revisão de comunicados). Todo conteúdo sugerido por IA é devidamente identificado na interface e deve ser revisado por um líder humano antes de sua aplicação oficial.
        </p>

        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mt-4">5. Conteúdo Gerado por Usuários (UGC), Denúncias e Direitos Autorais</h3>
        <p>
          É proibido publicar no Mural de Avisos ou no Chat do Evento conteúdos ilícitos, ofensivos ou que violem direitos autorais de terceiros. Qualquer membro pode reportar conteúdo inadequado ou violação de direitos autorais diretamente pelo botão <strong>Denunciar</strong> presente nos avisos e no chat, ou pelo canal <span className="font-semibold">{LEGAL_COMPANY_INFO.dpoEmail}</span>.
        </p>

        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mt-4">6. Identificação Empresarial (Decreto nº 7.962/2013, art. 2º)</h3>
        <div className="p-3.5 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl space-y-1 text-xs">
          <p className="flex items-center gap-2"><Building2 size={14} className="text-ministral-500 shrink-0" /> <strong>Razão Social / Responsável:</strong> {LEGAL_COMPANY_INFO.name}</p>
          <p className="flex items-center gap-2"><FileText size={14} className="text-ministral-500 shrink-0" /> <strong>CNPJ:</strong> {LEGAL_COMPANY_INFO.cnpj}</p>
          <p className="flex items-center gap-2"><MapPin size={14} className="text-ministral-500 shrink-0" /> <strong>Endereço:</strong> {LEGAL_COMPANY_INFO.address}</p>
          <p className="flex items-center gap-2"><Mail size={14} className="text-ministral-500 shrink-0" /> <strong>Atendimento e Suporte:</strong> {LEGAL_COMPANY_INFO.supportEmail}</p>
        </div>
      </div>
    );
  }

  if (type === 'privacy') {
    return (
      <div className="space-y-4 text-zinc-700 dark:text-zinc-300 text-sm leading-relaxed text-justify">
        <p>
          <strong>Versão: {LEGAL_TERMS_VERSION} — Última atualização: 18/11/2026</strong>
        </p>

        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mt-4">1. Dados Coletados e Minimização (LGPD art. 6º, III)</h3>
        <p>Coletamos estritamente os dados necessários para a execução das escalas ministeriais:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Nome completo e E-mail:</strong> Identificação na escala, autenticação e alertas essenciais.</li>
          <li><strong>Telefone / WhatsApp:</strong> Comunicação operacional sobre escalas e lembretes de culto.</li>
          <li><strong>Data de Nascimento:</strong> Verificação de faixa etária (consentimento parental quando menor de 12 anos) e mural de aniversariantes da equipe.</li>
          <li><strong>Foto de perfil (opcional), funções ministeriais e datas de disponibilidade:</strong> Gestão das escalas.</li>
          <li><strong>Registros de consentimento:</strong> Data, hora UTC e versão dos termos aceitos (LGPD art. 8º, § 2º).</li>
        </ul>

        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mt-4">2. Finalidade, Marketing e Treinamento de IA</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Seus dados pessoais são utilizados para geração e gestão de escalas, avisos internos da equipe e controle de acesso.</li>
          <li><strong>Comunicações de Marketing (LGPD art. 8º, § 4º):</strong> Só enviamos novidades institucionais caso você tenha marcado o consentimento específico (opt-in separado), podendo cancelar a inscrição a qualquer momento em 1 clique.</li>
          <li><strong>Não Treinamento de IA e Opt-Out:</strong> Não vendemos seus dados e não utilizamos dados pessoais dos membros para treinamento de modelos públicos de Inteligência Artificial. O titular pode desativar o processamento de seus dados por recursos de IA a qualquer momento em <em>Meu Perfil → Privacidade e Proteção de Dados (LGPD)</em>.</li>
        </ul>

        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mt-4">3. Operadores e Suboperadores de Dados (Terceiros)</h3>
        <p>Para operar o serviço com segurança, compartilhamos apenas os dados estritamente necessários com os seguintes operadores de infraestrutura:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Supabase Inc.:</strong> Banco de dados PostgreSQL com Row Level Security (RLS), autenticação criptografada e armazenamento de arquivos.</li>
          <li><strong>Vercel Inc.:</strong> Hospedagem da aplicação web e execução de rotas serverless.</li>
          <li><strong>Asaas Gestão Financeira S.A. e Stripe:</strong> Processamento seguro de pagamentos e assinaturas das organizações contratantes.</li>
          <li><strong>Google LLC (Google OAuth, Google Calendar, YouTube API e Google Gemini) e OpenRouter:</strong> Login social opcional, exportação de agenda, busca de vídeos para repertório e processamento sob demanda de sugestões de escala (sem retenção para treino).</li>
        </ul>

        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mt-4">4. Dados do Google (Google API Services User Data Policy)</h3>
        <p>
          O uso de informações recebidas das APIs do Google por este aplicativo adere à{' '}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer" className="text-ministral-500 hover:underline">
            Política de Dados do Usuário dos Serviços de API do Google
          </a>
          , incluindo os requisitos de Uso Limitado (Limited Use). Não transferimos nem utilizamos dados do Google Workspace/Calendar para publicidade ou treinamento de modelos de IA.
        </p>

        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mt-4">5. Prazos de Retenção e Expurgo de Dados (LGPD arts. 15 e 16)</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Dados de perfil e disponibilidade:</strong> Mantidos enquanto o membro fizer parte da organização ou até a exclusão imediata pelo titular.</li>
          <li><strong>Mensagens e áudios de chat de eventos:</strong> Retidos por até 180 dias após o evento para coordenação da equipe.</li>
          <li><strong>Logs de acesso e segurança:</strong> Retidos por no mínimo 6 meses (Marco Civil da Internet, art. 15).</li>
          <li><strong>Registros fiscais, pagamentos e prova de consentimento:</strong> Retidos por 5 anos para cumprimento de obrigação legal e exercício regular de direitos (LGPD art. 16, I).</li>
        </ul>

        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mt-4">6. Direitos do Titular: Portabilidade e Exclusão (LGPD art. 18)</h3>
        <p>
          Você pode, a qualquer momento e sem custo, acessar, corrigir, <strong>baixar todos os seus dados pessoais (formato JSON ou CSV)</strong>, revogar consentimentos e <strong>excluir permanentemente sua conta</strong> diretamente em <em>Meu Perfil → Privacidade e Proteção de Dados (LGPD)</em>.
        </p>

        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mt-4">7. Cookies e Armazenamento Local (Guia ANPD)</h3>
        <p>
          Utilizamos armazenamento local estritamente necessário para manter sua sessão autenticada e tema visual. Qualquer armazenamento analítico ou não essencial permanece bloqueado por padrão até que você escolha aceitar no banner de privacidade, com opção de mesmo destaque para <strong>Recusar não essenciais</strong>.
        </p>

        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mt-4">8. Encarregado pelo Tratamento de Dados (DPO — LGPD art. 41, § 1º)</h3>
        <p>Para exercer seus direitos ou tirar dúvidas sobre proteção de dados pessoais, contate nosso Encarregado (DPO):</p>
        <div className="flex flex-col gap-1 mt-2 p-3.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl w-fit text-xs">
          <div className="flex items-center gap-2">
            <Mail size={16} className="text-ministral-500" />
            <span className="font-bold text-zinc-800 dark:text-zinc-200">Encarregado de Dados (DPO): {LEGAL_COMPANY_INFO.dpoEmail}</span>
          </div>
          <span className="text-zinc-500 dark:text-zinc-400">Controladora: {LEGAL_COMPANY_INFO.name} — CNPJ: {LEGAL_COMPANY_INFO.cnpj}</span>
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
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      setTimeout(() => modalRef.current?.focus(), 0);
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !type) return null;

  const modalTitle = type === 'terms' ? 'Termos de Uso' : 'Política de Privacidade e LGPD';

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" role="presentation">
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={modalTitle}
        tabIndex={-1}
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[85vh] outline-none"
      >
        
        {/* Header */}
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${type === 'terms' ? 'bg-ministral-100 text-ministral-600 dark:bg-ministral-900/30' : 'bg-ministral-gold/10 text-ministral-gold dark:bg-ministral-gold/30'}`}>
               {type === 'terms' ? <FileText size={20}/> : <Shield size={20}/>}
            </div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
              {modalTitle}
            </h2>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors">
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
