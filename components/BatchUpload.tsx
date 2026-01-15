import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Eye, EyeOff, Download, RefreshCw, Trash2, X, ChevronDown, Loader2 } from 'lucide-react';
import { DocumentType, Deductibility } from '../types';

interface ExtractedData {
    fecha: string | null;
    numero_factura: string | null;
    base_imponible: number | null;
    cuota_iva: number | null;
    total: number | null;
    proveedor: string | null;
    cif_proveedor: string | null;
}

interface InvoiceRequest {
    id: string;
    file: File;
    status: 'pending' | 'processing' | 'success' | 'error';
    data?: ExtractedData;
    error?: string;
}

export const BatchUpload: React.FC = () => {
    const [invoices, setInvoices] = useState<InvoiceRequest[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
    const [showPdf, setShowPdf] = useState(true);

    // Configuración Global (Inputs del diseño original)
    const [providerCode, setProviderCode] = useState('');
    const [docType, setDocType] = useState<DocumentType>(DocumentType.ORDINARY);
    const [deductibility, setDeductibility] = useState<Deductibility>(Deductibility.FULL);

    const WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL?.replace('/test', '/extract') || '';
    const EXPORT_WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL?.replace('/test', '/export-excel') || '';

    const handleFiles = (newFiles: FileList | null) => {
        if (!newFiles) return;

        // Validación básica
        const validFiles = Array.from(newFiles).filter(f => f.type === 'application/pdf');
        if (validFiles.length < newFiles.length) alert('Solo se admiten archivos PDF.');
        if (validFiles.length === 0) return;

        const newInvoices: InvoiceRequest[] = validFiles.map(file => ({
            id: Math.random().toString(36).substr(2, 9),
            file,
            status: 'pending'
        }));

        setInvoices(prev => [...prev, ...newInvoices]);
        // Solo procesamos si ya tenemos providerCode, sino esperamos (o les obligamos a ponerlo antes)
        // Para UX fluida, si no hay providerCode, alertamos O procesamos asumiendo que lo pondrán luego (pero n8n lo necesita)
        // Mi decisión: Si no hay providerCode, pedirlo antes de procesar seria ideal, pero para batch rápido:
        // Permitimos subida, pero marcamos como "pending" y no enviamos hasta que haya codigo?
        // Mejor: Si no hay código, pedimos que lo pongan. O procesamos igual y que n8n devuelva null en proveedor si falla.
        // Mantenemos la lógica simple: Procesamos siempre.
        processQueue([...invoices, ...newInvoices]);
    };

    const processQueue = async (currentQueue: InvoiceRequest[]) => {
        // Nota: Si providerCode está vacío, quizá deberíamos bloquear. 
        // Pero para no bloquear la UI, enviamos cadena vacía y que n8n se apañe.
        const pending = currentQueue.filter(inv => inv.status === 'pending');
        for (const inv of pending) {
            await processInvoice(inv.id, inv.file);
        }
    };

    const processInvoice = async (id: string, file: File) => {
        setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status: 'processing' } : inv));

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('providerCode', providerCode || '00000'); // Valor por defecto si vacio
            formData.append('docType', docType);
            formData.append('deductibility', deductibility);
            formData.append('filename', file.name);

            const response = await fetch(WEBHOOK_URL, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) throw new Error('Error n8n');

            const result = await response.json();
            const extracted = result.data || result;

            setInvoices(prev => prev.map(inv =>
                inv.id === id ? { ...inv, status: 'success', data: extracted } : inv
            ));

            if (!selectedInvoiceId) setSelectedInvoiceId(id);

        } catch (err) {
            console.error(err);
            setInvoices(prev => prev.map(inv =>
                inv.id === id ? { ...inv, status: 'error', error: 'Fallo' } : inv
            ));
        }
    };

    // ... (updateField, removeInvoice igual que antes)
    const updateField = (id: string, field: keyof ExtractedData, value: string | number) => {
        setInvoices(prev => prev.map(inv => {
            if (inv.id !== id || !inv.data) return inv;
            return { ...inv, data: { ...inv.data, [field]: value } };
        }));
    };

    const removeInvoice = (id: string) => {
        setInvoices(prev => prev.filter(i => i.id !== id));
        if (selectedInvoiceId === id) setSelectedInvoiceId(null);
    };

    const handleExport = async () => {
        const validInvoices = invoices.filter(i => i.status === 'success' && i.data);
        if (validInvoices.length === 0) return alert('No hay facturas validadas.');

        const invalidInvoices = validInvoices.filter(inv => !inv.data?.fecha || !inv.data?.total || inv.data.total === 0);
        if (invalidInvoices.length > 0) {
            const names = invalidInvoices.map(i => i.file.name).join(', ');
            return alert(`⚠️ Facturas con datos incompletos (Fecha/Total):\n${names}`);
        }

        try {
            const payload = {
                invoices: validInvoices.map(inv => ({
                    filename: inv.file.name,
                    data: inv.data,
                    // Enviamos también la config global por si acaso
                    metadata: { providerCode, docType, deductibility }
                }))
            };

            const response = await fetch(EXPORT_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) throw new Error('Error export');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `REMESA_${providerCode}_${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);

            if (confirm('¿Limpiar lista?')) {
                setInvoices([]);
                setSelectedInvoiceId(null);
            }
        } catch (err) {
            alert('Error exportando: ' + err);
        }
    };

    // Drag Helpers
    const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
    const onDrop = (e: React.DragEvent) => {
        e.preventDefault(); setIsDragging(false);
        handleFiles(e.dataTransfer.files);
    };

    // PDF Preview URL
    const selectedInvoice = invoices.find(i => i.id === selectedInvoiceId);
    const pdfUrl = selectedInvoice ? URL.createObjectURL(selectedInvoice.file) : null;
    useEffect(() => { return () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }; }, [selectedInvoice]);

    return (
        <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col min-h-[600px] overflow-hidden">

            {/* 1. Header & Config (Estilo UploadCard) */}
            <div className="border-b border-slate-100 bg-slate-50/50">
                <div className="px-6 py-5 flex justify-between items-start">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">Procesamiento por Lotes</h2>
                        <p className="text-sm text-slate-500 mt-1">Sube, revisa y exporta múltiples facturas para Contasol.</p>
                    </div>
                    {/* Badge Progreso */}
                    {invoices.length > 0 && (
                        <div className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-2 ${invoices.every(i => i.status === 'success')
                                ? 'bg-green-100 text-green-700 border-green-200'
                                : 'bg-indigo-50 text-indigo-700 border-indigo-200 animate-pulse'
                            }`}>
                            {invoices.some(i => i.status === 'processing') ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                            {invoices.filter(i => i.status === 'success').length} / {invoices.length} procesadas
                        </div>
                    )}
                </div>

                {/* Grid de Configuración (Compacto) */}
                <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Provider */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">CÓDIGO PROVEEDOR (CONTASOL) *</label>
                        <input
                            type="number"
                            className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-[#9e1c22]/20 focus:border-[#9e1c22] outline-none"
                            placeholder="Ej: 400125"
                            value={providerCode}
                            onChange={(e) => setProviderCode(e.target.value)}
                        />
                    </div>
                    {/* Doc Type */}
                    <div className="relative">
                        <label className="block text-xs font-semibold text-slate-500 mb-1">TIPO DE DOCUMENTO</label>
                        <select
                            className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-[#9e1c22]/20 focus:border-[#9e1c22] outline-none appearance-none bg-white"
                            value={docType}
                            onChange={(e) => setDocType(e.target.value as DocumentType)}
                        >
                            <option value={DocumentType.ORDINARY}>{DocumentType.ORDINARY}</option>
                            <option value={DocumentType.TICKET}>{DocumentType.TICKET}</option>
                            <option value={DocumentType.RECTIFICATION}>{DocumentType.RECTIFICATION}</option>
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-[26px] text-slate-400 pointer-events-none" />
                    </div>
                    {/* Deductibility */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">DEDUCIBILIDAD</label>
                        <button
                            onClick={() => setDeductibility(deductibility === Deductibility.FULL ? Deductibility.NONE : Deductibility.FULL)}
                            className={`w-full h-10 rounded-lg border text-sm font-medium transition-colors flex items-center justify-center gap-2 ${deductibility === Deductibility.FULL
                                    ? 'bg-green-50 border-green-200 text-green-700'
                                    : 'bg-slate-50 border-slate-200 text-slate-600'
                                }`}
                        >
                            {deductibility === Deductibility.FULL ? <CheckCircle2 size={16} /> : <X size={16} />}
                            {deductibility}
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. Main Content Area */}
            <div className="flex-1 flex overflow-hidden relative">

                {/* STATE A: EMPTY INITIAL START (UploadCard style) */}
                {invoices.length === 0 && (
                    <div className="w-full p-8 flex items-center justify-center bg-slate-50/30">
                        <div
                            onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
                            className={`
                                w-full max-w-2xl border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all
                                ${isDragging ? 'border-[#9e1c22] bg-red-50' : 'border-slate-300 hover:border-[#9e1c22]/50 hover:bg-slate-50'}
                            `}
                        >
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-16 h-16 rounded-full bg-red-50 text-[#9e1c22] flex items-center justify-center">
                                    <UploadCloud size={32} />
                                </div>
                                <div>
                                    <p className="text-lg font-medium text-slate-900">Arrastra tus facturas aquí</p>
                                    <p className="text-sm text-slate-500 mt-1">Soporta múltiples archivos PDF simultáneamente</p>
                                </div>
                                <input type="file" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
                                <button className="mt-4 text-[#9e1c22] font-medium hover:underline" onClick={() => (document.querySelector('input[type=file]') as HTMLInputElement)?.click()}>
                                    o haz clic para explorar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* STATE B: LIST & PROCESSING (Table/Split View) */}
                {invoices.length > 0 && (
                    <div className="flex-1 w-full flex overflow-hidden">
                        {/* LEFT: TABLE */}
                        <div className={`flex flex-col bg-white transition-all duration-300 ${showPdf && selectedInvoice ? 'w-1/2 border-r border-slate-200' : 'w-full'}`}>
                            {/* Toolbar */}
                            <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                                <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer select-none">
                                    <input type="checkbox" checked={showPdf} onChange={e => setShowPdf(e.target.checked)} className="rounded text-[#9e1c22] focus:ring-[#9e1c22]" />
                                    {showPdf ? <Eye size={14} /> : <EyeOff size={14} />}
                                    Vista Dividida
                                </label>
                                <div
                                    onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
                                    className={`px-4 py-2 border border-dashed rounded-lg text-xs text-slate-500 flex items-center gap-2 transition-colors ${isDragging ? 'bg-indigo-50 border-indigo-500' : 'bg-slate-50 hover:bg-slate-100'}`}
                                >
                                    <UploadCloud size={14} /> Arrastra más aquí
                                </div>
                            </div>

                            {/* Table */}
                            <div className="flex-1 overflow-y-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50/80 text-slate-500 font-semibold sticky top-0 z-0 backdrop-blur-sm">
                                        <tr>
                                            <th className="px-4 py-3 w-10"></th>
                                            <th className="px-4 py-3">Fecha</th>
                                            <th className="px-4 py-3">Proveedor</th>
                                            <th className="px-4 py-3 text-right">Total</th>
                                            <th className="px-4 py-3 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {invoices.map(inv => (
                                            <tr
                                                key={inv.id}
                                                onClick={() => setSelectedInvoiceId(inv.id)}
                                                className={`cursor-pointer transition-colors group ${selectedInvoiceId === inv.id ? 'bg-[#9e1c22]/5' : 'hover:bg-slate-50'}`}
                                            >
                                                <td className="px-4 py-3">
                                                    {inv.status === 'pending' && <span className="w-2 h-2 rounded-full bg-slate-300 block" />}
                                                    {inv.status === 'processing' && <RefreshCw size={14} className="animate-spin text-indigo-500" />}
                                                    {inv.status === 'success' && <CheckCircle2 size={16} className="text-emerald-500" />}
                                                    {inv.status === 'error' && <AlertCircle size={16} className="text-red-500" />}
                                                </td>
                                                <td className="px-4 py-3 font-mono text-slate-600">
                                                    {inv.status === 'success' ? (
                                                        <input
                                                            value={inv.data?.fecha || ''}
                                                            onChange={e => updateField(inv.id, 'fecha', e.target.value)}
                                                            className="bg-transparent w-full focus:outline-none focus:text-[#9e1c22] hover:text-slate-900"
                                                            placeholder="DD/MM/YYYY"
                                                        />
                                                    ) : <span className="text-xs text-slate-400">{inv.file.name.substring(0, 20)}...</span>}
                                                </td>
                                                <td className="px-4 py-3 font-medium text-slate-700">
                                                    {inv.status === 'success' ? (
                                                        <input
                                                            value={inv.data?.proveedor || ''}
                                                            onChange={e => updateField(inv.id, 'proveedor', e.target.value)}
                                                            className="bg-transparent w-full focus:outline-none focus:text-[#9e1c22]"
                                                            placeholder="Proveedor..."
                                                        />
                                                    ) : <span>...</span>}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono font-medium text-slate-700">
                                                    {inv.status === 'success' ? (
                                                        <input
                                                            type="number"
                                                            value={inv.data?.total || ''}
                                                            onChange={e => updateField(inv.id, 'total', parseFloat(e.target.value))}
                                                            className="bg-transparent w-full text-right focus:outline-none focus:text-[#9e1c22]"
                                                            placeholder="0.00"
                                                        />
                                                    ) : <span>---</span>}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <button onClick={(e) => { e.stopPropagation(); removeInvoice(inv.id); }} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* RIGHT: PDF PREVIEW */}
                        {showPdf && selectedInvoice && (
                            <div className="w-1/2 bg-slate-100 border-l border-slate-200 flex flex-col">
                                <div className="p-2 bg-white border-b border-slate-200 flex justify-between items-center px-4 shadow-sm">
                                    <span className="text-xs font-semibold text-slate-500 truncate">{selectedInvoice.file.name}</span>
                                    <a href={pdfUrl!} download className="text-[#9e1c22] hover:underline text-xs font-medium">Descargar PDF</a>
                                </div>
                                <div className="flex-1 relative bg-slate-200">
                                    <iframe src={pdfUrl!} className="w-full h-full" title="PDF" />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 3. Footer Actions */}
            {invoices.length > 0 && (
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                    <span className="text-xs text-slate-500">
                        {invoices.filter(i => i.status === 'success' && (!i.data?.fecha || !i.data?.total)).length > 0
                            ? '⚠️ Faltan datos en algunas facturas'
                            : 'Todo listo para exportar'}
                    </span>
                    <button
                        onClick={handleExport}
                        disabled={invoices.length === 0}
                        className="bg-[#9e1c22] hover:bg-[#85161b] text-white px-6 py-2.5 rounded-lg flex items-center gap-2 font-medium shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Download size={18} />
                        Exportar Excel ({invoices.filter(i => i.status === 'success').length})
                    </button>
                </div>
            )}
        </div>
    );
};
