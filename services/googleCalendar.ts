import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import type { FirebaseApp } from 'firebase/app';

// Dynamic import or type assertions to handle potential missing file safely during build
let firebaseConfig: any = {};
try {
  // @ts-ignore
  firebaseConfig = require('../firebase-applet-config.json');
} catch (e) {
  console.warn('firebase-applet-config.json missing');
}

let app: FirebaseApp | undefined;
if (getApps().length === 0 && Object.keys(firebaseConfig).length > 0) {
  app = initializeApp(firebaseConfig);
} else if (getApps().length > 0) {
    app = getApps()[0];
}

const auth = app ? getAuth(app) : null;

const provider = new GoogleAuthProvider();
// Request Calendar scopes
provider.addScope('https://www.googleapis.com/auth/calendar.events');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  if (!auth) return () => {};
  
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (!auth) throw new Error('Firebase Auth not initialized');
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logoutGoogle = async () => {
    if (!auth) return;
    await signOut(auth);
    cachedAccessToken = null;
};

export const syncEventToGoogleCalendar = async (
    accessToken: string,
    eventDetails: { title: string, isoDate: string, description?: string }
) => {
    const { title, isoDate, description } = eventDetails;
    
    // Google Calendar API uses RFC3339 format.
    // Assuming isoDate is in local time, we convert properly
    const startDate = new Date(isoDate);
    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000); // Assume 2 hours duration

    const event = {
        summary: title,
        description: description || '',
        start: {
            dateTime: startDate.toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
            dateTime: endDate.toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
    };

    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
    });

    if (!res.ok) {
        const errorData = await res.json();
        throw new Error(`Failed to sync to Google Calendar: ${errorData.error?.message || res.statusText}`);
    }

    return await res.json();
};

export const autoSyncIfConnected = async (
    eventDetails: { title: string, isoDate: string, description?: string }
) => {
    const token = await getAccessToken();
    if (token) {
        try {
            await syncEventToGoogleCalendar(token, eventDetails);
            console.log('Event auto-synced to Google Calendar');
        } catch (e) {
            console.error('Auto-sync to Google Calendar failed', e);
        }
    }
};
