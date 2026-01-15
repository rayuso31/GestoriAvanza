'use client';

import React from 'react';
import { Bell, User } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Logo */}
        <div className="flex items-center gap-3">
          {/* Logo Icon stylized similar to the swoosh */}
          <div className="w-9 h-9 bg-[#9e1c22] rounded-tl-xl rounded-br-xl flex items-center justify-center shadow-sm">
            <span className="text-white font-serif font-bold text-xl italic">A</span>
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-serif text-2xl font-bold tracking-tight text-[#9e1c22]">
              AVANZA
            </span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold ml-0.5">
              Gestoría
            </span>
          </div>
        </div>

        {/* Right: User Profile & Actions */}
        <div className="flex items-center gap-4">
          <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors relative">
            <Bell size={20} />
            <span className="absolute top-2 right-2 w-2 h-2 bg-[#9e1c22] rounded-full border border-white"></span>
          </button>

          <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-slate-900">Alejandra Avanza</p>
              <p className="text-xs text-slate-500">Administradora</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden">
              <span className="text-[#9e1c22] font-semibold text-sm">AA</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};