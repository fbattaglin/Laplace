import { createContext, useContext, useState, type ReactNode } from 'react';

type Mode = 'boardroom' | 'lab';

interface ModeContextValue {
  mode: Mode;
  setMode: (mode: Mode) => void;
  isLab: boolean;
}

const ModeContext = createContext<ModeContextValue>({
  mode: 'boardroom',
  setMode: () => {},
  isLab: false,
});

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>(() => {
    const saved = localStorage.getItem('laplace_mode');
    return (saved === 'lab' ? 'lab' : 'boardroom') as Mode;
  });

  const setMode = (newMode: Mode) => {
    setModeState(newMode);
    localStorage.setItem('laplace_mode', newMode);
  };

  return (
    <ModeContext.Provider value={{ mode, setMode, isLab: mode === 'lab' }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  return useContext(ModeContext);
}
