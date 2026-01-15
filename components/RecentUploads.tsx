import React from 'react';
import { Download, FileText, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { RecentUpload, InvoiceStatus } from '../types';

const MOCK_DATA: RecentUpload[] = [
  { id: '1', filename: 'Factura_Suministros_001.pdf', date: 'Hace 2 min', status: 'processing', size: '1.2 MB' },
  { id: '2', filename: 'Servicios_Limpieza_Oct.pdf', date: 'Hace 2 horas', status: 'completed', size: '0.8 MB' },
  { id: '3', filename: 'Compra_Equipos_Dell.pdf', date: 'Ayer, 14:30', status: 'error', size: '4.5 MB' },
  { id: '4', filename: 'Licencias_Adobe_2023.pdf', date: '23 Oct, 10:00', status: 'completed', size: '2.1 MB' },
];

const StatusBadge: React.FC<{ status: InvoiceStatus }> = ({ status }) => {
  switch (status) {
    case 'processing':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
          <Clock size={12} className="animate-pulse" />
          Procesando
        </span>
      );
    case 'completed':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
          <CheckCircle2 size={12} />
          Completado
        </span>
      );
    case 'error':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-[#9e1c22] border border-red-200">
          <XCircle size={12} />
          Error OCR
        </span>
      );
    default:
      return null;
  }
};

export const RecentUploads: React.FC = () => {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4 px-1">
        <h3 className="text-base font-semibold text-slate-900">Últimas Subidas</h3>
        <button className="text-sm text-[#9e1c22] hover:text-[#85161b] font-medium transition-colors">Ver todo el historial</button>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500 font-medium">
                <th className="px-6 py-4">Archivo</th>
                <th className="px-6 py-4">Fecha</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {MOCK_DATA.map((item) => (
                <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                        <FileText size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate max-w-[150px] sm:max-w-[200px]">
                          {item.filename}
                        </p>
                        <p className="text-xs text-slate-500">{item.size}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">
                    {item.date}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      className="inline-flex items-center justify-center w-8 h-8 rounded-full text-slate-400 hover:text-[#9e1c22] hover:bg-red-50 transition-colors"
                      title="Descargar Original"
                    >
                      <Download size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};