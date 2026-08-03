import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'planeo_tech_preview';

/** Lecture synchrone hors React (hooks de données) */
export function isTechPreviewActive(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

interface TechPreviewContextValue {
  isTechPreview: boolean;
  enableTechPreview: () => void;
  disableTechPreview: () => void;
}

const TechPreviewContext = createContext<TechPreviewContextValue>({
  isTechPreview: false,
  enableTechPreview: () => {},
  disableTechPreview: () => {},
});

export function TechPreviewProvider({ children }: { children: React.ReactNode }) {
  const [isTechPreview, setIsTechPreview] = useState<boolean>(() => isTechPreviewActive());

  useEffect(() => {
    const handler = () => setIsTechPreview(isTechPreviewActive());
    window.addEventListener('planeo-tech-preview', handler);
    return () => window.removeEventListener('planeo-tech-preview', handler);
  }, []);

  const enableTechPreview = useCallback(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
    setIsTechPreview(true);
    window.dispatchEvent(new Event('planeo-tech-preview'));
  }, []);

  const disableTechPreview = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setIsTechPreview(false);
    window.dispatchEvent(new Event('planeo-tech-preview'));
  }, []);

  return (
    <TechPreviewContext.Provider value={{ isTechPreview, enableTechPreview, disableTechPreview }}>
      {children}
    </TechPreviewContext.Provider>
  );
}

export function useTechPreview() {
  return useContext(TechPreviewContext);
}
