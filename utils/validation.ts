export const isValidEmail = (email: string): boolean => {
  // Regex padrão mais rigoroso para validação de e-mail
  // Garante que o domínio tenha pelo menos um ponto e um TLD válido (mínimo 2 letras)
  const emailRegex = /^[a-zA-Z0-9._%+-]+@([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
  
  if (!emailRegex.test(email)) return false;

  const domain = email.split('@')[1].toLowerCase();

  // Bloquear domínios que são claramente de teste, temporários ou falsos
  const blockedDomains = [
    'teste.com',
    'test.com',
    'exemplo.com',
    'example.com',
    'email.com',
    'domain.com',
    'server.com',
    'asdf.com',
    'temp.com',
    'fake.com',
    'mailinator.com',
    'guerrillamail.com'
  ];
  
  // Verifica se o domínio está na lista de bloqueados
  if (blockedDomains.includes(domain)) return false;

  // Bloquear domínios curtos demais ou genéricos sem ponto no meio do que sobrou (já garantido pelo regex, mas reforço)
  if (!domain.includes('.')) return false;

  return true;
};
