import React, { useState, useCallback, useRef } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, X, ChevronDown, Loader2, Download } from 'lucide-react';
import { DocumentType, Deductibility } from '../types';

export const UploadCard: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [providerCode, setProviderCode] = useState('');
  const [docType, setDocType] = useState<DocumentType>(DocumentType.ORDINARY);
  const [deductibility, setDeductibility] = useState<Deductibility>(Deductibility.FULL);
  
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === 'application/pdf') {
        setFile(droppedFile);
        setStatus('idle');
      } else {
        alert('Por favor, sube únicamente archivos PDF.');
      }
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setStatus('idle');
    }
  };

  const clearFile = () => {
    setFile(null);
    setStatus('idle');
    setErrorMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = async () => {
    if (!file || !providerCode) return;

    setIsLoading(true);
    setStatus('idle');
    setErrorMessage('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('providerCode', providerCode);
    formData.append('docType', docType);
    formData.append('deductibility', deductibility);

    try {
      const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL;
      
      if (!webhookUrl) {
        throw new Error('La URL del Webhook de n8n no está configurada (VITE_N8N_WEBHOOK_URL).');
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Error al procesar la factura en el servidor.');
      }

      // Check content type to see if it's a blob (Excel) or JSON error
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
         // Maybe the workflow returned JSON instead of file
         const json = await response.json();
         console.log('Respuesta JSON:', json);
         // If success but no file?
      }

      // Download the Excel file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FRE_${providerCode}_${new Date().getTime()}.xlsx`; // Nombre sugerido
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setStatus('success');
      // Optional: Clear after success?
      // clearFile(); 
    } catch (error) {
      console.error(error);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Error desconocido al subir el archivo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
        <h2 className="text-lg font-semibold text-slate-900">Subir Nueva Factura</h2>
        <p className="text-sm text-slate-500 mt-1">Completa los datos para procesar el documento en Contasol.</p>
      </div>

      <div className="p-6 space-y-6">
        {/* 1. File Upload Zone */}
        <div 
          className={`
            relative group border-2 border-dashed rounded-xl p-8 transition-all duration-200 ease-in-out text-center cursor-pointer
            ${isDragging ? 'border-[#9e1c22] bg-red-50' : 'border-slate-300 hover:border-[#9e1c22]/50 hover:bg-slate-50'}
            ${file ? 'bg-slate-50 border-solid border-slate-300' : ''}
            ${status === 'error' ? 'border-red-500 bg-red-50' : ''}
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !file && fileInputRef.current?.click()}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="application/pdf"
            onChange={handleFileSelect}
          />

          {!file ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-red-50 text-[#9e1c22] flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <UploadCloud size={24} strokeWidth={2.5} />
              </div>
              <p className="text-sm font-medium text-slate-900">
                Arrastra tu PDF aquí o <span className="text-[#9e1c22] underline decoration-red-200 underline-offset-2 hover:decoration-[#9e1c22]">haz clic para buscar</span>
              </p>
              <p className="text-xs text-slate-500">
                Soporta archivos PDF hasta 10MB
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3 text-left">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${status === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-50 text-[#9e1c22]'}`}>
                  {status === 'success' ? <CheckCircle2 size={20} /> : <FileText size={20} />}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900 truncate max-w-[200px] sm:max-w-xs">{file.name}</p>
                  <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB • Listo para subir</p>
                </div>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); clearFile(); }}
                className="p-2 text-slate-400 hover:text-[#9e1c22] hover:bg-red-50 rounded-lg transition-colors"
                disabled={isLoading}
              >
                <X size={20} />
              </button>
            </div>
          )}
        </div>

        {/* Error Message */}
        {status === 'error' && (
           <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2 text-sm text-red-600">
             <AlertCircle size={16} className="mt-0.5 shrink-0" />
             <span>{errorMessage || 'Ha ocurrido un error.'}</span>
           </div>
        )}

        {/* Success Message */}
        {status === 'success' && (
           <div className="p-3 bg-green-50 border border-green-100 rounded-lg flex items-start gap-2 text-sm text-green-600">
             <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
             <span>¡Factura procesada con éxito! La descarga del Excel comenzará en breve.</span>
           </div>
        )}

        {/* 2. Provider Code */}
        <div className="space-y-2">
          <label htmlFor="providerCode" className="block text-sm font-medium text-slate-700">
            Código de Proveedor (Contasol) <span className="text-[#9e1c22]">*</span>
          </label>
          <div className="relative">
            <input
              type="number"
              id="providerCode"
              value={providerCode}
              onChange={(e) => setProviderCode(e.target.value)}
              disabled={isLoading}
              placeholder="Ej: 400125"
              className="w-full h-11 px-4 rounded-lg border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#9e1c22]/20 focus:border-[#9e1c22] transition-all shadow-sm disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <AlertCircle size={12} />
            Introduce el código numérico del proveedor en Contasol.
          </p>
        </div>

        {/* 3. Document Type */}
        <div className="space-y-2">
          <label htmlFor="docType" className="block text-sm font-medium text-slate-700">
            Tipo de Documento
          </label>
          <div className="relative">
            <select
              id="docType"
              value={docType}
              onChange={(e) => setDocType(e.target.value as DocumentType)}
              disabled={isLoading}
              className="w-full h-11 pl-4 pr-10 appearance-none rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#9e1c22]/20 focus:border-[#9e1c22] transition-all shadow-sm cursor-pointer disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value={DocumentType.ORDINARY}>{DocumentType.ORDINARY}</option>
              <option value={DocumentType.TICKET}>{DocumentType.TICKET}</option>
              <option value={DocumentType.RECTIFICATION}>{DocumentType.RECTIFICATION}</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-500">
              <ChevronDown size={16} />
            </div>
          </div>
        </div>

        {/* 4. Deductibility Toggle */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            ¿Es Deducible?
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => setDeductibility(Deductibility.FULL)}
              className={`
                relative flex items-center justify-center gap-2 h-11 px-4 rounded-lg border transition-all text-sm font-medium
                ${deductibility === Deductibility.FULL 
                  ? 'bg-green-50 border-green-200 text-green-700 shadow-sm ring-1 ring-green-500/30' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                }
                ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {deductibility === Deductibility.FULL && <CheckCircle2 size={16} className="text-green-600" />}
              100% Deducible
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => setDeductibility(Deductibility.NONE)}
              className={`
                relative flex items-center justify-center gap-2 h-11 px-4 rounded-lg border transition-all text-sm font-medium
                ${deductibility === Deductibility.NONE
                  ? 'bg-slate-100 border-slate-300 text-slate-900 shadow-sm ring-1 ring-slate-400/30' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                }
                ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              No Deducible
            </button>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-4">
          <button
            onClick={handleUpload}
            disabled={!file || !providerCode || isLoading}
            className={`
              w-full h-12 rounded-lg font-semibold text-white shadow-md transition-all duration-200 flex items-center justify-center gap-2
              ${!file || !providerCode || isLoading
                ? 'bg-slate-300 cursor-not-allowed text-slate-500 shadow-none' 
                : 'bg-[#9e1c22] hover:bg-[#85161b] hover:shadow-lg active:transform active:scale-[0.98]'
              }
            `}
          >
            {isLoading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                 Procesar Factura
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};