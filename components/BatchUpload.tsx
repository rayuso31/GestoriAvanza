import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, FileText, CheckCircle, AlertCircle, Eye, EyeOff, Download, RefreshCw, Trash2, ArrowRight } from 'lucide-react';

interface ExtractedData {
    fecha: string | null;
    numero_factura: string | null;
    base_imponible: number | null;
    cuota_iva: number | null;
    total: number | null;
    proveedor: string | null;
    cif_proveedor: string | null; // Nuevo campo
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

    // Configuración global (simulada por ahora)
    const [providerCode, setProviderCode] = useState('00000');

    // URL del Webhook de Extracción (apuntando al nuevo endpoint 'extract')
    // Nota: Ajusta la URL base según tu .env.local, aquí asumimos la misma base pero path 'extract'
    // O mejor, usa una variable de entorno especifica si cambia el workflow ID.
    // Por ahora usaremos la variable de entorno y reemplazaremos '/test' por '/extract' o asumimos que el usuario lo cambia.
    // Para la demo, usaré la URL cruda si no está en .env, pero lo ideal es VITE_N8N_EXTRACTION_URL
    const WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL?.replace('/test', '/extract') || '';

    const handleFiles = (newFiles: FileList | null) => {
        if (!newFiles) return;

        const newInvoices: InvoiceRequest[] = Array.from(newFiles).map(file => ({
            id: Math.random().toString(36).substr(2, 9),
            file,
            status: 'pending'
        }));

        setInvoices(prev => [...prev, ...newInvoices]);
        processQueue([...invoices, ...newInvoices]);
    };

    const processQueue = async (currentQueue: InvoiceRequest[]) => {
        const pending = currentQueue.filter(inv => inv.status === 'pending');

        // Procesamos uno a uno para no saturar (o en paralelo limitado)
        // Para simplificar, uno a uno.
        for (const inv of pending) {
            await processInvoice(inv.id, inv.file);
        }
    };

    const processInvoice = async (id: string, file: File) => {
        setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status: 'processing' } : inv));

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('providerCode', providerCode);
            formData.append('filename', file.name);

            const response = await fetch(WEBHOOK_URL, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) throw new Error('Error en conexión n8n');

            const result = await response.json();
            // El workflow devuelve { data: { ...extractedData, _metadata: ... } }
            // Aseguramos compatibilidad
            const extracted = result.data || result;

            setInvoices(prev => prev.map(inv =>
                inv.id === id ? { ...inv, status: 'success', data: extracted } : inv
            ));

            // Auto-seleccionar el primero que termina si no hay nada seleccionado
            if (!selectedInvoiceId) setSelectedInvoiceId(id);

        } catch (err) {
            console.error(err);
            setInvoices(prev => prev.map(inv =>
                inv.id === id ? { ...inv, status: 'error', error: 'Fallo al procesar' } : inv
            ));
        }
    };

    const updateField = (id: string, field: keyof ExtractedData, value: string | number) => {
        setInvoices(prev => prev.map(inv => {
            if (inv.id !== id || !inv.data) return inv;
            return {
                ...inv,
                data: {
                    ...inv.data,
                    [field]: value
                }
            };
        }));
    };

    const removeInvoice = (id: string) => {
        setInvoices(prev => prev.filter(i => i.id !== id));
        if (selectedInvoiceId === id) setSelectedInvoiceId(null);
    };

    // URL para Exportar Excel Final
    // Asumimos que el usuario configurará el webhook de exportación similar al de extracción o actualizaremos .env
    const EXPORT_WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL?.replace('/test', '/export-excel') || '';

    const handleExport = async () => {
        const validInvoices = invoices.filter(i => i.status === 'success' && i.data);
        if (validInvoices.length === 0) return alert('No hay facturas validadas para exportar.');

        // 🔥 VALIDACIÓN: Verificar campos obligatorios
        const invalidInvoices = validInvoices.filter(inv =>
            !inv.data?.fecha ||
            !inv.data?.total ||
            inv.data.total === 0
        );

        if (invalidInvoices.length > 0) {
            const invalidNames = invalidInvoices.map(inv => inv.file.name).join(', ');
            return alert(`⚠️ Las siguientes facturas tienen campos vacíos (Fecha o Total):\n\n${invalidNames}\n\nPor favor, completa todos los campos antes de exportar.`);
        }

        try {
            // Preparamos el payload: array de objetos limpios
            const payload = {
                invoices: validInvoices.map(inv => ({
                    filename: inv.file.name,
                    data: inv.data
                }))
            };

            const response = await fetch(EXPORT_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) throw new Error('Error generando Excel');

            // Descargar el archivo binario
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `REMESA_CONTASOL_${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);

            // Opcional: Limpiar la cola tras exportar
            if (confirm('Exportación correcta. ¿Limpiar la lista?')) {
                setInvoices([]);
                setSelectedInvoiceId(null);
            }

        } catch (err) {
            console.error(err);
            alert('Error en la exportación: ' + err);
        }
    };

    // Drag & Drop Handlers
    const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
    };

    // Render Helpers
    const selectedInvoice = invoices.find(i => i.id === selectedInvoiceId);
    const pdfUrl = selectedInvoice ? URL.createObjectURL(selectedInvoice.file) : null;

    // Limpieza de ObjectURL para evitar memory leaks
    useEffect(() => {
        return () => {
            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        };
    }, [selectedInvoice]);

    return (
        <div className="w-full bg-slate-50 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[800px]">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white rounded-t-xl">
                <h2 className="font-semibold text-slate-700 flex items-center gap-2">
                    Procesamiento por Lotes
                    {invoices.length > 0 && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border transition-colors ${invoices.filter(i => i.status === 'processing').length > 0
                                ? 'bg-indigo-100 text-indigo-700 border-indigo-300 animate-pulse'
                                : invoices.filter(i => i.status === 'success').length === invoices.length
                                    ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                            {invoices.filter(i => i.status === 'processing').length > 0
                                ? `⏳ ${invoices.filter(i => i.status === 'success').length}/${invoices.length}`
                                : `✓ ${invoices.filter(i => i.status === 'success').length}/${invoices.length}`}
                        </span>
                    )}
                </h2>

                <div className="flex gap-3">
                    <label className="flex items-center gap-2 text-sm text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-200 transition-colors">
                        {showPdf ? <Eye size={16} /> : <EyeOff size={16} />}
                        <span>Multivista</span>
                        <input type="checkbox" checked={showPdf} onChange={e => setShowPdf(e.target.checked)} className="hidden" />
                    </label>

                    <button onClick={handleExport} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg font-medium text-sm flex items-center gap-2 transition-all">
                        <Download size={16} />
                        Exportar Excel
                    </button>
                </div>
            </div>

            {/* Main Content: Split View */}
            <div className="flex-1 flex overflow-hidden">

                {/* Left: Invoice List / Table */}
                <div className={`flex flex-col bg-white transition-all duration-300 ${showPdf && selectedInvoice ? 'w-1/2 border-r border-slate-200' : 'w-full'}`}>

                    {/* Drop Zone (Mini if items exist) */}
                    <div
                        onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
                        className={`p-4 border-b border-dashed border-slate-300 bg-slate-50 transition-colors ${isDragging ? 'bg-indigo-50 border-indigo-400' : ''}`}
                    >
                        <div className="flex flex-col items-center justify-center gap-2 text-slate-500 py-4">
                            <Upload size={24} className={isDragging ? 'text-indigo-500' : 'text-slate-400'} />
                            <p className="text-sm">Arrastra más facturas aquí o <label className="text-indigo-600 font-medium cursor-pointer hover:underline">explora<input type="file" multiple className="hidden" onChange={e => handleFiles(e.target.files)} /></label></p>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="flex-1 overflow-y-auto">
                        {invoices.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
                                <FileText size={48} className="mb-4 opacity-50" />
                                <p>No hay facturas en cola</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0 shadow-sm z-10">
                                    <tr>
                                        <th className="px-3 py-2">Estado</th>
                                        <th className="px-3 py-2 w-32">Fecha</th>
                                        <th className="px-3 py-2">Proveedor</th>
                                        <th className="px-3 py-2 text-right">Total</th>
                                        <th className="px-3 py-2 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {invoices.map(invoice => (
                                        <tr
                                            key={invoice.id}
                                            onClick={() => setSelectedInvoiceId(invoice.id)}
                                            className={`cursor-pointer group hover:bg-slate-50 transition-colors ${selectedInvoiceId === invoice.id ? 'bg-indigo-50 hover:bg-indigo-50' : ''}`}
                                        >
                                            <td className="px-3 py-3">
                                                {invoice.status === 'pending' && <span className="w-2 h-2 rounded-full bg-slate-300 block" />}
                                                {invoice.status === 'processing' && <RefreshCw className="animate-spin text-indigo-500" size={16} />}
                                                {invoice.status === 'success' && <CheckCircle className="text-emerald-500" size={16} />}
                                                {invoice.status === 'error' && <AlertCircle className="text-rose-500" size={16} />}
                                            </td>

                                            {/* Campos Editables (Solo si success) */}
                                            <td className="px-3 py-3">
                                                {invoice.status === 'success' ? (
                                                    <input
                                                        type="text"
                                                        value={invoice.data?.fecha || ''}
                                                        onChange={(e) => updateField(invoice.id, 'fecha', e.target.value)}
                                                        className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none"
                                                        placeholder="DD/MM/YYYY"
                                                    />
                                                ) : (
                                                    <span className="text-slate-400 text-xs">{invoice.file.name}</span>
                                                )}
                                            </td>

                                            <td className="px-3 py-3 font-medium text-slate-700">
                                                {invoice.status === 'success' ? (
                                                    <input
                                                        type="text"
                                                        value={invoice.data?.proveedor || ''}
                                                        onChange={(e) => updateField(invoice.id, 'proveedor', e.target.value)}
                                                        className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none"
                                                        placeholder="Proveedor..."
                                                    />
                                                ) : <span>...</span>}
                                            </td>

                                            <td className="px-3 py-3 text-right font-mono text-slate-600">
                                                {invoice.status === 'success' ? (
                                                    <input
                                                        type="number"
                                                        value={invoice.data?.total || ''}
                                                        onChange={(e) => updateField(invoice.id, 'total', parseFloat(e.target.value))}
                                                        className="w-full text-right bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none"
                                                        placeholder="0.00"
                                                    />
                                                ) : <span>---</span>}
                                            </td>

                                            <td className="px-3 py-3">
                                                <button onClick={(e) => { e.stopPropagation(); removeInvoice(invoice.id); }} className="text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Right: PDF Preview */}
                {showPdf && selectedInvoice && (
                    <div className="w-1/2 bg-slate-100 flex flex-col h-full border-l border-slate-200">
                        <div className="p-2 border-b border-slate-200 bg-white flex justify-between items-center px-4">
                            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 truncate max-w-[200px]">
                                {selectedInvoice.file.name}
                            </span>
                            <a href={pdfUrl!} download={selectedInvoice.file.name} className="text-indigo-600 hover:text-indigo-700 text-xs font-medium">Descargar Original</a>
                        </div>
                        <div className="flex-1 relative">
                            <iframe src={pdfUrl!} className="w-full h-full" title="PDF Preview" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
