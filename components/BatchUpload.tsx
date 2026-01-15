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

    // Global Config State
    const [providerCode, setProviderCode] = useState('');
    const [docType, setDocType] = useState<DocumentType>(DocumentType.ORDINARY);
    const [deductibility, setDeductibility] = useState<Deductibility>(Deductibility.FULL);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL?.replace('/test', '/extract') || '';
    const EXPORT_WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL?.replace('/test', '/export-excel') || '';

    // --- Logic ---
    const handleFiles = (newFiles: FileList | null) => {
        if (!newFiles) return;
        const validFiles = Array.from(newFiles).filter(f => f.type === 'application/pdf');
        if (validFiles.length < newFiles.length) alert('Solo se admiten archivos PDF.');
        if (validFiles.length === 0) return;

        const newInvoices: InvoiceRequest[] = validFiles.map(file => ({
            id: Math.random().toString(36).substr(2, 9),
            file,
            status: 'pending'
        }));

        setInvoices(prev => [...prev, ...newInvoices]);
        processQueue([...invoices, ...newInvoices]);
    };

    const processQueue = async (currentQueue: InvoiceRequest[]) => {
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
            formData.append('providerCode', providerCode || '00000');
            formData.append('docType', docType);
            formData.append('deductibility', deductibility);
            formData.append('filename', file.name);

            const response = await fetch(WEBHOOK_URL, { method: 'POST', body: formData });
            if (!response.ok) throw new Error('Error n8n');
            const result = await response.json();
            const extracted = result.data || result;

            setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status: 'success', data: extracted } : inv));
            if (!selectedInvoiceId) setSelectedInvoiceId(id);
        } catch (err) {
            console.error(err);
            setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status: 'error', error: 'Fallo' } : inv));
        }
    };

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
            return alert(`⚠️ Facturas incompletas:\n${names}`);
        }

        try {
            const payload = {
                invoices: validInvoices.map(inv => ({
                    filename: inv.file.name,
                    data: inv.data,
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
            a.download = `REMESA_${providerCode || 'BATCH'}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            if (confirm('¿Limpiar lista?')) {
                setInvoices([]);
                setSelectedInvoiceId(null);
            }
        } catch (err) { alert('Error: ' + err); }
    };

    // Drag Helpers
    const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
    const onDrop = (e: React.DragEvent) => {
        e.preventDefault(); setIsDragging(false);
        handleFiles(e.dataTransfer.files);
    };

    const selectedInvoice = invoices.find(i => i.id === selectedInvoiceId);
    const pdfUrl = selectedInvoice ? URL.createObjectURL(selectedInvoice.file) : null;
    useEffect(() => { return () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }; }, [selectedInvoice]);


    // --- RENDER ---

    // STATE 1: INITIAL UPLOAD (THE ORIGINAL CARD DESIGN)
    if (invoices.length === 0) {
        return (
            <div className="flex justify-center p-6">
                <div className="w-full max-w-[600px] bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
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
                            `}
                            onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                multiple // Allow multiple!
                                accept="application/pdf"
                                onChange={(e) => handleFiles(e.target.files)}
                            />
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-red-50 text-[#9e1c22] flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                    <UploadCloud size={24} strokeWidth={2.5} />
                                </div>
                                <p className="text-sm font-medium text-slate-900">
                                    Arrastra tu PDF aquí o <span className="text-[#9e1c22] underline decoration-red-200 underline-offset-2 hover:decoration-[#9e1c22]">haz clic para buscar</span>
                                </p>
                                <p className="text-xs text-slate-500">Soporta archivos PDF hasta 10MB</p>
                            </div>
                        </div>

                        {/* 2. Provider Code */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-700">
                                Código de Proveedor (Contasol) <span className="text-[#9e1c22]">*</span>
                            </label>
                            <input
                                type="number"
                                value={providerCode}
                                onChange={(e) => setProviderCode(e.target.value)}
                                placeholder="Ej: 400125"
                                className="w-full h-11 px-4 rounded-lg border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#9e1c22]/20 focus:border-[#9e1c22] transition-all shadow-sm"
                            />
                            <p className="text-xs text-slate-500 flex items-center gap-1.5">
                                <AlertCircle size={12} />
                                Introduce el código numérico del proveedor en Contasol.
                            </p>
                        </div>

                        {/* 3. Document Type */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-700">Tipo de Documento</label>
                            <div className="relative">
                                <select
                                    value={docType}
                                    onChange={(e) => setDocType(e.target.value as DocumentType)}
                                    className="w-full h-11 pl-4 pr-10 appearance-none rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#9e1c22]/20 focus:border-[#9e1c22] transition-all shadow-sm cursor-pointer"
                                >
                                    <option value={DocumentType.ORDINARY}>{DocumentType.ORDINARY}</option>
                                    <option value={DocumentType.TICKET}>{DocumentType.TICKET}</option>
                                    <option value={DocumentType.RECTIFICATION}>{DocumentType.RECTIFICATION}</option>
                                </select>
                                <ChevronDown size={16} className="absolute inset-y-0 right-3 my-auto text-slate-500 pointer-events-none" />
                            </div>
                        </div>

                        {/* 4. Deductibility */}
                        <div className="space-y-3">
                            <label className="block text-sm font-medium text-slate-700">¿Es Deducible?</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setDeductibility(Deductibility.FULL)}
                                    className={`
                                        relative flex items-center justify-center gap-2 h-11 px-4 rounded-lg border transition-all text-sm font-medium
                                        ${deductibility === Deductibility.FULL
                                            ? 'bg-green-50 border-green-200 text-green-700 shadow-sm ring-1 ring-green-500/30'
                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'}
                                    `}
                                >
                                    {deductibility === Deductibility.FULL && <CheckCircle2 size={16} />} 100% Deducible
                                </button>
                                <button
                                    onClick={() => setDeductibility(Deductibility.NONE)}
                                    className={`
                                        relative flex items-center justify-center gap-2 h-11 px-4 rounded-lg border transition-all text-sm font-medium
                                        ${deductibility === Deductibility.NONE
                                            ? 'bg-slate-100 border-slate-300 text-slate-900 shadow-sm ring-1 ring-slate-400/30'
                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'}
                                    `}
                                >
                                    No Deducible
                                </button>
                            </div>
                        </div>

                        {/* Action Button (Disabled visually) */}
                        <div className="pt-4">
                            <button disabled className="w-full h-12 rounded-lg font-semibold text-white bg-slate-300 cursor-not-allowed flex items-center justify-center gap-2">
                                Procesar Factura
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // STATE 2: PROCESSING / REVIEW (WIDE VIEW)
    return (
        <div className="w-full bg-slate-50 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[800px] animate-in fade-in duration-300">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white rounded-t-xl">
                <div className="flex items-center gap-3">
                    <h2 className="font-semibold text-slate-700">Procesando Lote</h2>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md border border-slate-200 font-mono">
                        PROV: {providerCode || '---'}
                    </span>
                </div>

                <div className="flex gap-2">
                    {/* Progress Badge */}
                    <span className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-2 ${invoices.every(i => i.status === 'success')
                            ? 'bg-green-100 text-green-700 border-green-200'
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200 animate-pulse'
                        }`}>
                        {invoices.some(i => i.status === 'processing') ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        {invoices.filter(i => i.status === 'success').length} / {invoices.length}
                    </span>
                    <button onClick={handleExport} className="bg-[#9e1c22] hover:bg-[#85161b] text-white px-4 py-1.5 rounded-lg text-sm font-medium flex gap-2 items-center transition-colors">
                        <Download size={16} /> Exportar Excel
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Left: Table */}
                <div className={`flex flex-col bg-white transition-all duration-300 ${showPdf && selectedInvoice ? 'w-1/2 border-r border-slate-200' : 'w-full'}`}>
                    <div className="flex-1 overflow-y-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0 shadow-sm z-10">
                                <tr>
                                    <th className="px-3 py-2 w-10"></th>
                                    <th className="px-3 py-2">Fecha</th>
                                    <th className="px-3 py-2">Proveedor</th>
                                    <th className="px-3 py-2 text-right">Total</th>
                                    <th className="px-3 py-2 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {invoices.map(inv => (
                                    <tr
                                        key={inv.id}
                                        onClick={() => setSelectedInvoiceId(inv.id)}
                                        className={`cursor-pointer hover:bg-slate-50 ${selectedInvoiceId === inv.id ? 'bg-indigo-50' : ''}`}
                                    >
                                        <td className="px-3 py-3">
                                            {inv.status === 'processing' ? <RefreshCw className="animate-spin text-indigo-500" size={16} /> :
                                                inv.status === 'success' ? <CheckCircle2 className="text-emerald-500" size={16} /> :
                                                    inv.status === 'error' ? <AlertCircle className="text-red-500" size={16} /> : <div className="w-4 h-4 bg-slate-200 rounded-full" />}
                                        </td>
                                        <td className="px-3 py-3">{inv.status === 'success' ? <input value={inv.data?.fecha || ''} onChange={e => updateField(inv.id, 'fecha', e.target.value)} className="bg-transparent w-full outline-none" /> : <span className="text-slate-400">...</span>}</td>
                                        <td className="px-3 py-3">{inv.status === 'success' ? <input value={inv.data?.proveedor || ''} onChange={e => updateField(inv.id, 'proveedor', e.target.value)} className="bg-transparent w-full outline-none" /> : <span className="text-slate-400">...</span>}</td>
                                        <td className="px-3 py-3 text-right">{inv.status === 'success' ? <input type="number" value={inv.data?.total || ''} onChange={e => updateField(inv.id, 'total', parseFloat(e.target.value))} className="bg-transparent w-full outline-none text-right" /> : <span className="text-slate-400">...</span>}</td>
                                        <td className="px-3 py-3"><button onClick={e => { e.stopPropagation(); removeInvoice(inv.id) }} className="text-slate-300 hover:text-red-500"><Trash2 size={14} /></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} className="p-3 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-500">
                        Arrastra más facturas aquí para añadir a la cola
                    </div>
                </div>

                {/* Right: PDF */}
                {showPdf && selectedInvoice && (
                    <div className="w-1/2 bg-slate-100 flex flex-col h-full">
                        <div className="p-2 bg-white border-b border-slate-200 flex justify-between px-4">
                            <span className="text-xs font-bold text-slate-500 truncate">{selectedInvoice.file.name}</span>
                        </div>
                        <iframe src={pdfUrl!} className="w-full h-full" title="PDF" />
                    </div>
                )}
            </div>
        </div>
    );
};
