'use client';

import React from 'react';
import { ShoppingListModule } from '@/components/shopping/ShoppingListModule';

export function CompanyShoppingListModal({
  isOpen,
  onClose,
  currentUserName,
  currentEmployeeId,
  canEdit,
}: {
  isOpen: boolean;
  onClose: () => void;
  currentUserName: string;
  currentEmployeeId?: string;
  canEdit: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-[#0B1120] rounded-3xl border border-slate-800 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="overflow-y-auto p-4 sm:p-6 flex-1">
          <ShoppingListModule
            currentUserName={currentUserName}
            currentEmployeeId={currentEmployeeId}
            canEdit={canEdit}
            isEmbeddedModal={true}
            onCloseModal={onClose}
          />
        </div>
      </div>
    </div>
  );
}
