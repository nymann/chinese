import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { buildContainer, type Container } from './container.js';

const Ctx = createContext<Container | null>(null);

export function ReactContainerProvider({ children }: { children: ReactNode }) {
  const value = useMemo(() => buildContainer(), []);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useContainer(): Container {
  const value = useContext(Ctx);
  if (!value) throw new Error('useContainer must be used inside ReactContainerProvider');
  return value;
}
