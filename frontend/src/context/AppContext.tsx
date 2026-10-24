import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';
import { getApplications } from '../api/applications';
import { login as loginRequest } from '../api/auth';
import { ApiError, getToken, setToken } from '../api/client';
import type { Application, UserProfile } from '../types';

type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

interface AppState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  applications: Application[];
  applicationsStatus: LoadStatus;
  /** Текст ошибки загрузки заявок (например, бэкенд недоступен). */
  applicationsError: string | null;
}

type Action =
  | { type: 'LOGIN_SUCCESS'; user: UserProfile }
  | { type: 'LOGOUT' }
  | { type: 'APPLICATIONS_REQUEST' }
  | { type: 'APPLICATIONS_SUCCESS'; applications: Application[] }
  | { type: 'APPLICATIONS_FAILURE'; error: string };

const USER_KEY = 'credit-cabinet:user';

function readStoredUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

function writeStoredUser(user: UserProfile | null): void {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch {
    /* хранилище недоступно */
  }
}

function createInitialState(): AppState {
  // Сессию восстанавливаем, только если есть и токен, и профиль.
  const user = getToken() ? readStoredUser() : null;
  return {
    user,
    isAuthenticated: Boolean(user),
    applications: [],
    applicationsStatus: 'idle',
    applicationsError: null,
  };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'LOGIN_SUCCESS':
      return { ...state, user: action.user, isAuthenticated: true };
    case 'LOGOUT':
      return {
        user: null,
        isAuthenticated: false,
        applications: [],
        applicationsStatus: 'idle',
        applicationsError: null,
      };
    case 'APPLICATIONS_REQUEST':
      return { ...state, applicationsStatus: 'loading', applicationsError: null };
    case 'APPLICATIONS_SUCCESS':
      return {
        ...state,
        applications: action.applications,
        applicationsStatus: 'success',
        applicationsError: null,
      };
    case 'APPLICATIONS_FAILURE':
      // Список очищаем: интерфейс покажет пустое состояние вместо падения.
      return {
        ...state,
        applications: [],
        applicationsStatus: 'error',
        applicationsError: action.error,
      };
    default:
      return state;
  }
}

interface AppContextValue extends AppState {
  /** Бросает ApiError при неудаче — форма входа сама решает, что показать. */
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshApplications: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);

  const logout = useCallback(() => {
    setToken(null);
    writeStoredUser(null);
    dispatch({ type: 'LOGOUT' });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { token, user } = await loginRequest(email, password);
    setToken(token);
    writeStoredUser(user);
    dispatch({ type: 'LOGIN_SUCCESS', user });
  }, []);

  const refreshApplications = useCallback(async () => {
    dispatch({ type: 'APPLICATIONS_REQUEST' });
    try {
      const applications = await getApplications();
      dispatch({ type: 'APPLICATIONS_SUCCESS', applications });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        logout(); // токен просрочен
        return;
      }
      dispatch({
        type: 'APPLICATIONS_FAILURE',
        error: e instanceof Error ? e.message : 'Не удалось загрузить заявки.',
      });
    }
  }, [logout]);

  // Заявки подгружаем сразу после входа / восстановления сессии.
  useEffect(() => {
    if (state.isAuthenticated) void refreshApplications();
  }, [state.isAuthenticated, refreshApplications]);

  const value = useMemo<AppContextValue>(
    () => ({ ...state, login, logout, refreshApplications }),
    [state, login, logout, refreshApplications],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp нужно вызывать внутри <AppProvider>');
  return ctx;
}
