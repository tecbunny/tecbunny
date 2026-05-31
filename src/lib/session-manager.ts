'use client';

import { createClient } from '@/lib/supabase/client';

import { logger } from './logger';

const SESSION_STORAGE_KEY = 'tecbunny:session-start';
const SESSION_EXPIRED_BROADCAST_KEY = 'tecbunny:session-expired';
const SESSION_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour
export const SESSION_EXPIRED_EVENT = 'tecbunny:session-expired-event';

export class SessionManager {
  private static instance: SessionManager;
  private supabase = createClient();
  private refreshInterval: NodeJS.Timeout | null = null;
  private expiryTimer: NodeJS.Timeout | null = null;
  private isExpiring = false;

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  registerSessionStart(startTimestamp: number = Date.now()) {
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(SESSION_STORAGE_KEY, String(startTimestamp));
    } catch (error) {
      logger.warn('Unable to persist session start time', { error });
    }

    this.startSessionTimer(startTimestamp);
  }

  clearSessionTracking(resetExpiring = true) {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      } catch (error) {
        logger.warn('Unable to clear session start time', { error });
      }
    }

    this.clearExpiryTimer();
    if (resetExpiring) {
      this.isExpiring = false;
    }
  }

  ensureSessionTimer() {
    this.startSessionTimer();
  }

  startSessionRefresh() {
    // Clear any existing interval
    this.stopSessionRefresh();
    this.startSessionTimer();
    
    // Refresh session every 30 minutes (tokens expire after 1 hour)
    this.refreshInterval = setInterval(async () => {
      try {
        const { data: { session }, error } = await this.supabase.auth.getSession();
        
        if (error) {
          logger.error('Session refresh error', { error });
          return;
        }
        
        if (session) {
          // Force a token refresh
          await this.supabase.auth.refreshSession();
          logger.debug('Session refreshed successfully');
        } else {
          logger.debug('No active session to refresh');
        }
      } catch (error) {
        logger.error('Session refresh failed', { error });
      }
    }, 30 * 60 * 1000); // 30 minutes
  }

  stopSessionRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    this.clearExpiryTimer();
    this.isExpiring = false;
  }

  async checkSessionValidity(): Promise<boolean> {
    if (this.isSessionExpired()) {
      this.handleSessionExpiry();
      return false;
    }

    try {
      const { data: { session }, error } = await this.supabase.auth.getSession();
      
      if (error) {
        logger.error('Session check error', { error });
        return false;
      }
      
      return !!session;
    } catch (error) {
      logger.error('Session validity check failed', { error });
      return false;
    }
  }

  async forceRefreshSession() {
    try {
      const { data, error } = await this.supabase.auth.refreshSession();
      if (error) {
        logger.error('Force refresh error', { error });
        return false;
      }
      return !!data.session;
    } catch (error) {
      logger.error('Force refresh failed', { error });
      return false;
    }
  }

  private getStoredSessionStart(): number | null {
    if (typeof window === 'undefined') return null;

    try {
      const value = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (!value) {
        return null;
      }
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    } catch (error) {
      logger.warn('Unable to read session start time', { error });
      return null;
    }
  }

  private startSessionTimer(startTimestamp?: number) {
    if (typeof window === 'undefined') return;

    const sessionStart = typeof startTimestamp === 'number'
      ? startTimestamp
      : this.getStoredSessionStart();

    if (!sessionStart) {
      this.clearExpiryTimer();
      return;
    }

    const elapsed = Date.now() - sessionStart;

    if (elapsed >= SESSION_TIMEOUT_MS) {
      this.handleSessionExpiry();
      return;
    }

    const remaining = SESSION_TIMEOUT_MS - elapsed;

    this.clearExpiryTimer();
    this.expiryTimer = setTimeout(() => this.handleSessionExpiry(), remaining);
  }

  private clearExpiryTimer() {
    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
  }

  private isSessionExpired(): boolean {
    const sessionStart = this.getStoredSessionStart();
    return typeof sessionStart === 'number' && Date.now() - sessionStart >= SESSION_TIMEOUT_MS;
  }

  private broadcastSessionExpiry() {
    if (typeof window === 'undefined') return;

    try {
      const timestamp = Date.now().toString();
      window.localStorage.setItem(SESSION_EXPIRED_BROADCAST_KEY, timestamp);
    } catch (error) {
      logger.warn('Unable to broadcast session expiry', { error });
    }

    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  }

  private handleSessionExpiry = () => {
    if (this.isExpiring) {
      return;
    }

    this.isExpiring = true;

    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }

    this.clearSessionTracking(false);
    this.broadcastSessionExpiry();
    this.isExpiring = false;
  };
}

// Initialize session manager only on client side
if (typeof window !== 'undefined') {
  const sessionManager = SessionManager.getInstance();
  
  // Start session management when page loads
  window.addEventListener('load', () => {
    sessionManager.startSessionRefresh();
  });
  
  // Stop session refresh when page is hidden/unloaded
  window.addEventListener('beforeunload', () => {
    sessionManager.stopSessionRefresh();
  });
  
  // Handle page visibility changes
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // Page became visible, check session validity
      sessionManager.checkSessionValidity();
    }
  });

  // Listen for cross-tab updates to session start/expiry
  window.addEventListener('storage', (event) => {
    if (event.key === SESSION_STORAGE_KEY) {
      if (event.newValue) {
        const parsed = Number(event.newValue);
        if (Number.isFinite(parsed)) {
          sessionManager.registerSessionStart(parsed);
        }
      } else {
  sessionManager.clearSessionTracking();
      }
    }

    if (event.key === SESSION_EXPIRED_BROADCAST_KEY && event.newValue) {
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    }
  });
}