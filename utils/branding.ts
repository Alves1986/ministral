import { getSupabase } from '../services/supabase/client';

export function getSystemLogo(theme: 'light' | 'dark') {
  return `/branding/logo-${theme}.png`;
}

export function getLoadingLogo(theme: 'light' | 'dark') {
  return `/branding/loading-${theme}.png`;
}

export function getPublicUrl(path: string, bucket: string = 'logos') {
  const sb = getSupabase();
  if (!sb) return '';
  const { data } = sb.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
