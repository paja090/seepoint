'use client';

import { createContext, useContext } from 'react';

export const AiQuickTaskContext = createContext<(() => void) | null>(null);
export function useOpenAiQuickTask() { return useContext(AiQuickTaskContext); }
