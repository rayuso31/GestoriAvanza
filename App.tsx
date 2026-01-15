import React from 'react';
import { Header } from './components/Header';
import { BatchUpload } from './components/BatchUpload';
import { RecentUploads } from './components/RecentUploads';

const App: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col text-slate-900">
      <Header />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col items-center gap-10">
        <div className="w-full max-w-xl space-y-8">
          <BatchUpload />
          <RecentUploads />
        </div>
      </main>

      <footer className="py-6 text-center text-slate-400 text-sm">
        &copy; {new Date().getFullYear()} Avanza Portal. Todos los derechos reservados.
      </footer>
    </div>
  );
};

export default App;