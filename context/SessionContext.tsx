import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
// FONTE ÚNICA DE AUTENTICAÇÃO — não criar hooks alternativos de sessão.
import { 
    fetchUserAllowedMinistries, 
    fetchUserMinistryAccess,
    fetchOrganizationDetails
} from '../services/supabaseService';
import { getSupabase, setServiceOrgContext, clearServiceOrgContext } from '../services/supabase/client';
import { useAppStore } from '../store/appStore';
import { User, Organization } from '../types';

type SessionStatus = 
    | 'idle' 
    | 'authenticating' 
    | 'contextualizing' 
    | 'ready' 
    | 'unauthenticated' 
    | 'error'
    | 'locked_inactive'
    | 'locked_billing';

interface SessionContextValue {
    status: SessionStatus;
    user: User | null;
    error: Error | null;
    organization: Organization | null;
    refreshSession: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export const useSession = () => {
    const context = useContext(SessionContext);
    if (!context) {
        throw new Error('useSession must be used within a SessionProvider');
    }
    return context;
};

interface SessionProviderProps {
    children: ReactNode;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const SessionProvider: React.FC<SessionProviderProps> = ({ children }) => {
    const [status, setStatus] = useState<SessionStatus>('idle');
    const [user, setUser] = useState<User | null>(null);
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [error, setError] = useState<Error | null>(null);
    
    const userRef = useRef<User | null>(null);
    const isProcessingRef = useRef(false);
    const activeChannelRef = useRef<any>(null);

    const isMountedRef = useRef(false);

    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    const processSession = React.useCallback(async (sessionUser: any) => {
        if (!isMountedRef.current) return;
        if (isProcessingRef.current) return;

        const sb = getSupabase();
        if (!sb) return;

        const isSameUser = userRef.current?.id === sessionUser.id;
        if (!isSameUser) {
            setStatus('contextualizing');
        }

        let channel: any = null;

        try {
            isProcessingRef.current = true;
            
            // --- REALTIME SUBSCRIPTION ---
            if (activeChannelRef.current) {
                activeChannelRef.current.unsubscribe();
                activeChannelRef.current = null;
            }

            channel = sb.channel(`profile-sync-${sessionUser.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'profiles',
                        filter: `id=eq.${sessionUser.id}`
                    },
                    (payload: any) => {
                        console.log("[SessionProvider] Realtime profile update:", payload);
                        if (payload.new && payload.new.organization_id) {
                            isProcessingRef.current = false;
                            processSession(sessionUser);
                        }
                    }
                )
                .subscribe();
            
            activeChannelRef.current = channel;

            const fetchProfile = async () => {
                const { data, error } = await sb
                    .from('profiles')
                    .select('*')
                    .eq('id', sessionUser.id)
                    .maybeSingle();
                
                if (error) throw error;
                return data;
            };

            let profile = await fetchProfile();

            if (!profile) {
                console.warn("[SessionProvider] No profile found for user, waiting for Realtime insert...");
                isProcessingRef.current = false;
                
                setTimeout(() => {
                    if (isMountedRef.current && !userRef.current) {
                        setUser(null);
                        setStatus('unauthenticated');
                        if (channel) channel.unsubscribe();
                    }
                }, 10000);
                return;
            }

            const orgId = profile.organization_id || '';
            if (!orgId) {
                isProcessingRef.current = false;
                setTimeout(() => {
                    if (isMountedRef.current && !userRef.current) {
                        setUser(null);
                        setStatus('unauthenticated');
                        if (channel) channel.unsubscribe();
                    }
                }, 10000);
                return;
            }

            if (orgId && activeChannelRef.current) {
                activeChannelRef.current.unsubscribe();
                channel = sb.channel(`sync-org-profile-${sessionUser.id}`)
                    .on(
                        'postgres_changes',
                        { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${sessionUser.id}` },
                        (payload: any) => {
                            console.log("[SessionProvider] Realtime profile update:", payload);
                            isProcessingRef.current = false;
                            processSession(sessionUser);
                        }
                    )
                    .on(
                        'postgres_changes',
                        { event: '*', schema: 'public', table: 'organizations', filter: `id=eq.${orgId}` },
                        (payload: any) => {
                            console.log("[SessionProvider] Realtime organization update:", payload);
                            isProcessingRef.current = false;
                            processSession(sessionUser);
                        }
                    )
                    .subscribe();
                activeChannelRef.current = channel;
            }

            setServiceOrgContext(orgId);

            const orgDetails = await fetchOrganizationDetails(orgId);
            setOrganization(orgDetails);

            if (orgDetails) {
                if (orgDetails.active === false) {
                    if (isMountedRef.current) {
                        setUser({
                            id: profile.id,
                            name: profile.name,
                            email: profile.email,
                            access_role: 'member',
                            organizationId: orgId
                        } as User);
                        setStatus('locked_inactive');
                    }
                    isProcessingRef.current = false;
                    return;
                }

                if (!profile.is_super_admin) {
                    const isTrial = orgDetails.plan_type === 'trial';
                    const trialExpired = isTrial && orgDetails.trial_ends_at && new Date() > new Date(orgDetails.trial_ends_at);
                    const isLocked = orgDetails.access_locked;
                    const badStatus = orgDetails.billing_status && !['active', 'trial'].includes(orgDetails.billing_status);
                    
                    const isPastDue = orgDetails.billing_status === 'past_due';
                    const isCanceled = orgDetails.billing_status === 'canceled';

                    if (isLocked || trialExpired || badStatus || isPastDue || isCanceled) {
                        if (isMountedRef.current) {
                            setUser({
                                id: profile.id,
                                name: profile.name,
                                email: profile.email,
                                access_role: 'member',
                                organizationId: orgId
                            } as User);
                            setStatus('locked_billing');
                        }
                        isProcessingRef.current = false;
                        return;
                    }
                }
            }

            let allowedMinistries: string[] = [];
            let ministry_functions: string[] = [];
            let ministry_role = 'member';
            let activeMinistry = '';

            try {
                allowedMinistries = await fetchUserAllowedMinistries(profile.id, orgId);

                const currentMinistryId = useAppStore.getState().ministryId;
                if (profile.ministry_id && !currentMinistryId) {
                    useAppStore.getState().setMinistryId(profile.ministry_id);
                }

                if (profile.ministry_id && UUID_REGEX.test(profile.ministry_id) && allowedMinistries.includes(profile.ministry_id)) {
                    activeMinistry = profile.ministry_id;
                } else {
                    const localStored = localStorage.getItem('ministry_id');
                    if (localStored && UUID_REGEX.test(localStored) && allowedMinistries.includes(localStored)) {
                        activeMinistry = localStored;
                    } else if (allowedMinistries.length > 0) {
                        activeMinistry = allowedMinistries[0];
                    }
                }

                if (activeMinistry) {
                    const access = await fetchUserMinistryAccess(profile.id, activeMinistry, orgId);
                    ministry_functions = access.functions;
                    ministry_role = access.role;
                }
            } catch (e) {
                console.error("[SessionProvider] Error fetching details (non-critical):", e);
            }

            const authenticatedUser: User = {
                id: profile.id,
                name: profile.name || 'Usuário',
                email: profile.email || sessionUser.email,
                access_role: profile.is_admin ? 'admin' : (ministry_role === 'admin' ? 'admin' : 'member'),
                ministryId: activeMinistry,
                allowedMinistries,
                organizationId: orgId,
                isSuperAdmin: !!profile.is_super_admin,
                isOrgAdmin: !!profile.is_admin,
                isPro: orgDetails?.plan_type === 'pro' || orgDetails?.plan_type === 'enterprise',
                isEnterprise: orgDetails?.plan_type === 'enterprise',
                avatar_url: profile.avatar_url,
                whatsapp: profile.whatsapp,
                birthDate: profile.birth_date,
                ministry_functions
            };

            if (isMountedRef.current) {
                setUser(authenticatedUser);
                setStatus('ready');
            }
            isProcessingRef.current = false;

        } catch (err: any) {
            isProcessingRef.current = false;
            console.error("[SessionProvider] Critical Error:", err);
            if (isMountedRef.current) {
                if (isSameUser) {
                    setStatus('ready');
                } else {
                    setError(err);
                    setStatus('error');
                }
            }
        }
    }, []);

    const refreshSession = async () => {
        const sb = getSupabase();
        const session = await sb?.auth.getSession();
        const sessionUser = session?.data.session?.user;
        if (!sessionUser) return;
        
        await processSession(sessionUser);
    };

    useEffect(() => {
        userRef.current = user;
    }, [user]);

    useEffect(() => {
        const sb = getSupabase();
        if (!sb) {
            console.warn("[SessionProvider] Supabase client missing.");
            setStatus('unauthenticated');
            return;
        }

        const init = async () => {
            if (!isMountedRef.current) return;
            
            if (!userRef.current) {
                setStatus('authenticating');
            }
            
            let session = null;
            try {
                const { data, error: sessionError } = await sb.auth.getSession();
                if (sessionError) throw sessionError;
                session = data.session;
            } catch (e: any) {
                console.error("[SessionProvider] Session error:", e);
                if (isMountedRef.current) {
                    setError(e);
                    setStatus('error'); 
                }
                return;
            }

            if (session?.user) {
                await processSession(session.user);
            } else {
                if (isMountedRef.current) {
                    setUser(null);
                    setStatus('unauthenticated');
                }
            }

            const { data: { subscription } } = sb.auth.onAuthStateChange(async (event, currentSession) => {
                if (!isMountedRef.current) return;

                if (event === 'SIGNED_IN' && currentSession?.user) {
                    await processSession(currentSession.user);
                } else if (event === 'TOKEN_REFRESHED' && currentSession?.user) {
                    await processSession(currentSession.user);
                } else if (event === 'SIGNED_OUT') {
                    setUser(null);
                    setStatus('unauthenticated');
                    clearServiceOrgContext();
                }
            });

            return subscription;
        };

        let authSubscription: any = null;
        init().then(sub => {
            authSubscription = sub;
            if (!isMountedRef.current && authSubscription) {
                authSubscription.unsubscribe();
            }
        });

        return () => {
            if (authSubscription) authSubscription.unsubscribe();
            if (activeChannelRef.current) activeChannelRef.current.unsubscribe();
        };
    }, [processSession]);

    const contextValue: SessionContextValue = { status, user, error, organization, refreshSession };

    return (
        <SessionContext.Provider value={contextValue}>
            {children}
        </SessionContext.Provider>
    );
};