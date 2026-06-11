-- Substitua 'email_do_membro@exemplo.com' pelo email do usuário e 'NOVASENHA123' pela senha desejada.
-- Execute este script no SQL Editor do Supabase (dashboard).

UPDATE auth.users
SET encrypted_password = crypt('NOVASENHA123', gen_salt('bf'))
WHERE email = 'email_do_membro@exemplo.com';
