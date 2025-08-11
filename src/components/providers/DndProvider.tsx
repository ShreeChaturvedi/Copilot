import React from 'react';
import { DndProvider as ReactDndProvider } from 'react-dnd';
import { useEffect, useState } from 'react';
import type { BackendFactory } from 'dnd-core';

interface DndProviderProps {
  children: React.ReactNode;
}

export const DndProvider: React.FC<DndProviderProps> = ({ children }) => {
  const [Backend, setBackend] = useState<BackendFactory | null>(null);
  useEffect(() => {
    let mounted = true;
    import('react-dnd-html5-backend').then((m) => {
      if (mounted) setBackend(() => m.HTML5Backend as unknown as BackendFactory);
    });
    return () => {
      mounted = false;
    };
  }, []);
  if (!Backend) return <>{children}</>;
  return <ReactDndProvider backend={Backend}>{children}</ReactDndProvider>;
};