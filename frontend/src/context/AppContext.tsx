import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import * as auth from '../api/auth';
import { getApplications } from '../api/applications';
import { ApiError, getToken, setToken } from '../api/client';
import type { Application, UserProfile } from '../types';
interface Value {
  user: UserProfile | null;
  isAuthenticated: boolean;
  checkingSession: boolean;
  applications: Application[];
  applicationsStatus: 'idle' | 'loading' | 'success' | 'error';
  applicationsError: string | null;
  login: (login: string, password: string) => Promise<void>;
  staffLogin: (login: string, password: string) => Promise<void>;
  demoLogin: (id: string) => Promise<void>;
  logout: () => void;
  refreshApplications: () => Promise<void>;
}
const AppContext = createContext<Value | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [checkingSession, setChecking] = useState(true);
  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationsStatus, setStatus] = useState<Value['applicationsStatus']>('idle');
  const [applicationsError, setError] = useState<string | null>(null);
  const clear = useCallback(() => {
    setToken(null);
    setUser(null);
    setApplications([]);
    setStatus('idle');
    localStorage.removeItem('credit-cabinet:user');
  }, []);
  const loadProfile = useCallback(async () => {
    const me = await auth.getMe();
    if (me.role === 'EMPLOYEE') {
      setUser({
        id: me.login,
        role: 'EMPLOYEE',
        fullName: me.fullName,
        companyName: 'Банк',
        inn: '',
      });
      return;
    }
    if (me.role !== 'CLIENT') throw new Error('Неизвестная роль');
    const p = await auth.getProfile();
    setUser({
      id: me.login,
      role: 'CLIENT',
      fullName: me.fullName,
      firstName: me.fullName.split(/\s+/)[1],
      companyName: p.company.name,
      inn: p.company.inn,
    });
  }, []);
  useEffect(() => {
    let active = true;
    const restore = async () => {
      try {
        if (getToken()) await loadProfile();
      } catch {
        if (active) clear();
      } finally {
        if (active) setChecking(false);
      }
    };
    void restore();
    window.addEventListener('session-expired', clear);
    return () => {
      active = false;
      window.removeEventListener('session-expired', clear);
    };
  }, [clear, loadProfile]);
  const signIn = useCallback(
    async (request: Promise<{ token: string }>) => {
      const r = await request;
      setToken(r.token);
      try {
        await loadProfile();
      } catch (e) {
        clear();
        throw e;
      }
    },
    [clear, loadProfile],
  );
  const login = useCallback((v: string, p: string) => signIn(auth.login(v, p)), [signIn]);
  const demoLogin = useCallback((id: string) => signIn(auth.demoLogin(id)), [signIn]);
  const staffLogin = useCallback((v: string, p: string) => signIn(auth.staffLogin(v, p)), [signIn]);
  const logout = useCallback(() => {
    void auth
      .endSession()
      .catch(() => undefined)
      .finally(clear);
  }, [clear]);
  const refreshApplications = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      setApplications(await getApplications());
      setStatus('success');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) clear();
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    }
  }, [clear]);
  useEffect(() => {
    let active = true;
    if (user)
      getApplications()
        .then((items) => {
          if (active) {
            setApplications(items);
            setStatus('success');
          }
        })
        .catch((e) => {
          if (active) {
            setStatus('error');
            setError(e instanceof Error ? e.message : 'Ошибка загрузки');
          }
        });
    return () => {
      active = false;
    };
  }, [user]);
  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      checkingSession,
      applications,
      applicationsStatus,
      applicationsError,
      login,
      staffLogin,
      demoLogin,
      logout,
      refreshApplications,
    }),
    [
      user,
      checkingSession,
      applications,
      applicationsStatus,
      applicationsError,
      login,
      staffLogin,
      demoLogin,
      logout,
      refreshApplications,
    ],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  const v = useContext(AppContext);
  if (!v) throw new Error('AppProvider required');
  return v;
}
