import React, { useState, useEffect } from 'react';
import { Send, FileText, Loader2, CheckCircle, AlertCircle, Package, RefreshCw } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { motion, AnimatePresence } from 'motion/react';

interface ShipmentRow {
  id: number;
  name: string;
  email: string;
  guide: string;
  status: 'idle' | 'sending' | 'success' | 'error';
  errorMessage?: string;
}

export default function App() {
  const [rows, setRows] = useState<ShipmentRow[]>(
    Array.from({ length: 10 }, (_, i) => ({
      id: i,
      name: '',
      email: '',
      guide: '',
      status: 'idle',
    }))
  );
  const [isGlobalSending, setIsGlobalSending] = useState(false);
  const [configStatus, setConfigStatus] = useState<'checking' | 'ok' | 'error'>('checking');

  useEffect(() => {
    checkConfig();
  }, []);

  const checkConfig = async () => {
    try {
      const res = await fetch('/api/check-config');
      if (res.ok) {
        setConfigStatus('ok');
      } else {
        setConfigStatus('error');
      }
    } catch (e) {
      setConfigStatus('error');
    }
  };

  const handleInputChange = (id: number, field: keyof ShipmentRow, value: string) => {
    setRows(prev => prev.map(row => {
      if (row.id === id) {
        return { ...row, [field]: value, status: 'idle', errorMessage: undefined };
      }
      return row;
    }));
  };

  const resetRow = (id: number) => {
    setRows(prev => prev.map(row => {
      if (row.id === id) {
        return { ...row, status: 'idle', errorMessage: undefined };
      }
      return row;
    }));
  };

  const generatePDF = (row: ShipmentRow): string => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a6' // Shipping label size-ish
    });

    // Background
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, 105, 148, 'F');

    // Header / Logo area
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, 105, 25, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('CUBITT', 10, 16);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('SHIPPING SERVICE', 105 - 10, 16, { align: 'right' });

    // Main Content
    doc.setTextColor(0, 0, 0);
    
    // Guide Number (Big)
    doc.setFontSize(10);
    doc.text('TRACKING NUMBER / NÚMERO DE GUÍA', 10, 40);
    doc.setFontSize(22);
    doc.setFont('courier', 'bold');
    doc.text(row.guide || 'PENDING', 10, 50);

    // Barcode placeholder -> Link button
    doc.setFillColor(0, 0, 0);
    doc.rect(10, 55, 85, 15, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text('CONSULTA TU GUIA ACA', 52.5, 64, { align: 'center' });
    doc.link(10, 55, 85, 15, { url: 'https://unoexpresspanama.com/' });
    doc.setTextColor(0, 0, 0);

    // Details Grid
    doc.setDrawColor(200, 200, 200);
    doc.line(10, 80, 95, 80);

    // From
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('FROM / REMITENTE:', 10, 90);
    doc.setFont('helvetica', 'normal');
    doc.text('Cubitt Logistics Center', 10, 95);
    doc.text('Panama City, Panama', 10, 99);

    // To
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('TO / DESTINATARIO:', 10, 110);
    doc.setFontSize(12);
    doc.text(row.name || 'Valued Customer', 10, 116);
    doc.setFontSize(8);
    doc.text(row.email, 10, 121);

    // Stamp (Apple Style - Clean Rectangular)
    doc.setDrawColor(40, 205, 65); // Apple Green
    doc.setTextColor(40, 205, 65);
    doc.setLineWidth(0.5);
    doc.roundedRect(72, 100, 28, 10, 2, 2, 'D'); // Rounded rectangle
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('ENVIADO', 86, 106.5, { align: 'center' });

    // Footer
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 10, 140);
    doc.text('Thank you for choosing Cubitt.', 105 - 10, 140, { align: 'right' });

    return doc.output('datauristring');
  };

  const previewPDF = (row: ShipmentRow) => {
    if (!row.name && !row.guide) return;
    const pdfDataUri = generatePDF(row);
    const win = window.open();
    if (win) {
      win.document.write(
        `<iframe src="${pdfDataUri}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`
      );
    }
  };

  const sendEmail = async (row: ShipmentRow) => {
    if (!row.email || !row.name || !row.guide) return;

    setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'sending', errorMessage: undefined } : r));

    try {
      const pdfBase64 = generatePDF(row);
      
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: row.email,
          name: row.name,
          guide: row.guide,
          pdfBase64
        })
      });

      // Handle non-JSON responses safely
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('Respuesta inválida del servidor (posible error de red o configuración)');
      }

      if (!response.ok) {
        throw new Error(data.error || 'Error al enviar');
      }

      setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'success' } : r));
    } catch (error: any) {
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'error', errorMessage: error.message } : r));
    }
  };

  const sendAll = async () => {
    setIsGlobalSending(true);
    const validRows = rows.filter(r => r.name && r.email && r.guide && r.status !== 'success');
    
    for (const row of validRows) {
      await sendEmail(row);
    }
    setIsGlobalSending(false);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] font-sans text-[#1D1D1F]">
      {/* Apple-style Header */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="text-black" size={20} />
            <span className="font-semibold tracking-tight">Cubitt Dispatch</span>
            
            {/* Config Status Indicator */}
            <div className={`ml-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
              configStatus === 'ok' 
                ? 'bg-green-50 text-green-700 border-green-200' 
                : configStatus === 'error' 
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                configStatus === 'ok' ? 'bg-green-500' : configStatus === 'error' ? 'bg-red-500' : 'bg-slate-400'
              }`} />
              {configStatus === 'ok' ? 'Sistema Listo' : configStatus === 'error' ? 'Error Config' : 'Verificando...'}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={sendAll}
              disabled={isGlobalSending}
              className="bg-[#0071E3] hover:bg-[#0077ED] text-white text-sm font-medium px-4 py-1.5 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isGlobalSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Enviar Todos
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-semibold tracking-tight text-[#1D1D1F] mb-3">
            Notificaciones de Envío
          </h1>
          <p className="text-[#86868B] text-lg max-w-2xl mx-auto">
            Completa los detalles para generar guías de envío y notificar a los clientes por correo.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 p-4 border-b border-slate-100 bg-slate-50/50 text-xs font-semibold text-[#86868B] uppercase tracking-wider">
            <div className="col-span-3 pl-2">Nombre del Cliente</div>
            <div className="col-span-4">Correo Electrónico</div>
            <div className="col-span-3">Número de Guía</div>
            <div className="col-span-2 text-center">Acciones</div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-slate-100">
            {rows.map((row) => (
              <motion.div 
                key={row.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: row.id * 0.05 }}
                className="grid grid-cols-12 gap-4 p-4 items-center group hover:bg-slate-50 transition-colors"
              >
                {/* Name Input */}
                <div className="col-span-3">
                  <input
                    type="text"
                    placeholder="Juan Pérez"
                    value={row.name}
                    onChange={(e) => handleInputChange(row.id, 'name', e.target.value)}
                    className="w-full bg-transparent border-none p-2 text-[15px] placeholder:text-slate-300 focus:ring-0 focus:placeholder:text-slate-400 transition-all rounded-lg hover:bg-white focus:bg-white focus:shadow-sm"
                  />
                </div>

                {/* Email Input */}
                <div className="col-span-4">
                  <input
                    type="email"
                    placeholder="juan@ejemplo.com"
                    value={row.email}
                    onChange={(e) => handleInputChange(row.id, 'email', e.target.value)}
                    className="w-full bg-transparent border-none p-2 text-[15px] placeholder:text-slate-300 focus:ring-0 focus:placeholder:text-slate-400 transition-all rounded-lg hover:bg-white focus:bg-white focus:shadow-sm"
                  />
                </div>

                {/* Guide Input */}
                <div className="col-span-3">
                  <input
                    type="text"
                    placeholder="CUB-XXXXXX"
                    value={row.guide}
                    onChange={(e) => handleInputChange(row.id, 'guide', e.target.value)}
                    className="w-full bg-transparent border-none p-2 text-[15px] font-mono text-slate-600 placeholder:text-slate-300 focus:ring-0 focus:placeholder:text-slate-400 transition-all rounded-lg hover:bg-white focus:bg-white focus:shadow-sm"
                  />
                </div>

                {/* Actions */}
                <div className="col-span-2 flex items-center justify-center gap-2">
                  {row.status === 'idle' && (
                    <>
                      <button
                        onClick={() => previewPDF(row)}
                        disabled={!row.name || !row.guide}
                        className="p-2 text-slate-400 hover:text-[#0071E3] hover:bg-blue-50 rounded-full transition-colors disabled:opacity-30"
                        title="Ver PDF"
                      >
                        <FileText size={18} />
                      </button>
                      <button
                        onClick={() => sendEmail(row)}
                        disabled={!row.email || !row.name || !row.guide}
                        className="p-2 text-slate-400 hover:text-[#0071E3] hover:bg-blue-50 rounded-full transition-colors disabled:opacity-30"
                        title="Enviar Correo"
                      >
                        <Send size={18} />
                      </button>
                    </>
                  )}
                  
                  {row.status === 'sending' && (
                    <Loader2 size={20} className="text-[#0071E3] animate-spin" />
                  )}
                  
                  {row.status === 'success' && (
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle size={20} />
                      <span className="text-xs font-medium">Enviado</span>
                    </div>
                  )}

                  {row.status === 'error' && (
                    <div className="flex items-center gap-2">
                      <div className="group/error relative">
                        <AlertCircle size={20} className="text-red-500 cursor-help" />
                        <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-red-50 text-red-600 text-xs rounded-lg shadow-lg opacity-0 group-hover/error:opacity-100 pointer-events-none z-10 border border-red-100">
                          {row.errorMessage || 'Error al enviar'}
                        </div>
                      </div>
                      <button
                        onClick={() => resetRow(row.id)}
                        className="p-1.5 text-slate-400 hover:text-[#0071E3] hover:bg-blue-50 rounded-full transition-colors"
                        title="Reintentar / Editar"
                      >
                        <RefreshCw size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs text-[#86868B]">
            Asegúrate de configurar las variables SMTP en el entorno para habilitar el envío de correos.
          </p>
        </div>
      </main>
    </div>
  );
}
