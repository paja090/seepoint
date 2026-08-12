'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type BasketSurface = {
  id: string;
  name: string;
  carrierId: string;
  carrierCode: string;
  carrierName: string;
  city: string;
  price?: number;
  mediaType: string;
  photoUrl?: string;
};

type OfferBasketContextType = {
  selectedSurfaces: BasketSurface[];
  addSurface: (surface: BasketSurface) => void;
  removeSurface: (surfaceId: string) => void;
  toggleSurface: (surface: BasketSurface) => void;
  clearBasket: () => void;
  isSurfaceSelected: (surfaceId: string) => boolean;
  selectedCount: number;
};

const OfferBasketContext = createContext<OfferBasketContextType | undefined>(undefined);

const STORAGE_KEY = 'seepoint_offer_basket_v1';

export function OfferBasketProvider({ children }: { children: React.ReactNode }) {
  const [selectedSurfaces, setSelectedSurfaces] = useState<BasketSurface[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setSelectedSurfaces(JSON.parse(saved));
      }
    } catch {
      // ignore JSON parse errors
    } finally {
      setIsInitialized(true);
    }
  }, []);

  useEffect(() => {
    if (isInitialized) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedSurfaces));
      } catch {
        // ignore storage quota errors
      }
    }
  }, [selectedSurfaces, isInitialized]);

  const addSurface = (surface: BasketSurface) => {
    setSelectedSurfaces((prev) => {
      if (prev.some((s) => s.id === surface.id)) return prev;
      return [...prev, surface];
    });
  };

  const removeSurface = (surfaceId: string) => {
    setSelectedSurfaces((prev) => prev.filter((s) => s.id !== surfaceId));
  };

  const toggleSurface = (surface: BasketSurface) => {
    if (isSurfaceSelected(surface.id)) {
      removeSurface(surface.id);
    } else {
      addSurface(surface);
    }
  };

  const clearBasket = () => {
    setSelectedSurfaces([]);
  };

  const isSurfaceSelected = (surfaceId: string) => {
    return selectedSurfaces.some((s) => s.id === surfaceId);
  };

  return (
    <OfferBasketContext.Provider
      value={{
        selectedSurfaces,
        addSurface,
        removeSurface,
        toggleSurface,
        clearBasket,
        isSurfaceSelected,
        selectedCount: selectedSurfaces.length,
      }}
    >
      {children}
    </OfferBasketContext.Provider>
  );
}

export function useOfferBasket() {
  const context = useContext(OfferBasketContext);
  if (!context) {
    throw new Error('useOfferBasket must be used within an OfferBasketProvider');
  }
  return context;
}
