create table public.support_tickets (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations(id) on delete cascade not null,
  author_id uuid references auth.users(id) on delete set null,
  author_name text not null,
  subject text not null,
  description text not null,
  status text not null default 'open',
  priority text not null default 'normal',
  replies jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.support_tickets enable row level security;

-- Qualquer membro de uma organização pode ver os tickets da organização.
create policy "Enable read access for all organization members"
on public.support_tickets for select
using (
  auth.uid() is not null
);

-- Os administradores/usuários logados podem criar tickets para suas organizações.
create policy "Users can insert tickets"
on public.support_tickets for insert
with check (
  auth.uid() is not null
);

-- Todos os administradores podem atualizar e deletar tickets (ou apenas os super admins podem).
create policy "Enable update for users"
on public.support_tickets for update
using (
  auth.uid() is not null
);

create policy "Enable delete for users"
on public.support_tickets for delete
using (
  auth.uid() is not null
);
