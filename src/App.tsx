import React, { useState, useEffect, useRef } from 'react';
import { Send, FileText, Loader2, CheckCircle, AlertCircle, Package, RefreshCw } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { motion } from 'motion/react';

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
  const rowsRef = useRef(rows);

  // Keep rowsRef in sync with rows for async access
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

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
      orientation: 'landscape',
      unit: 'mm',
      format: 'a6' // 148mm x 105mm
    });

    const width = 148;
    const height = 105;

    // Background
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, width, height, 'F');

    // Header / Logo area
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, width, 20, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('CUBITT', 10, 13);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('SHIPPING SERVICE', width - 10, 13, { align: 'right' });

    // Main Content
    doc.setTextColor(0, 0, 0);
    
    // Left Column: Details
    // From
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('FROM / REMITENTE:', 10, 35);
    doc.setFont('helvetica', 'normal');
    doc.text('Cubitt Logistics Center', 10, 40);
    doc.text('Panama City, Panama', 10, 44);

    // To
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('TO / DESTINATARIO:', 10, 55);
    doc.setFontSize(11);
    doc.text(row.name || 'Valued Customer', 10, 61);
    doc.setFontSize(7);
    doc.text(row.email, 10, 66);

    // Vertical Divider
    doc.setDrawColor(200, 200, 200);
    doc.line(70, 30, 70, 90);

    // Right Column: Tracking
    const rightColX = 75;
    
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('TRACKING NUMBER / NÚMERO DE GUÍA', rightColX, 35);
    
    doc.setFontSize(18);
    doc.setTextColor(0, 0, 0);
    doc.setFont('courier', 'bold');
    doc.text(row.guide || 'PENDING', rightColX, 45);

    // Call to action
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text('Copia tu número de guía y consúltalo acá:', rightColX, 60);

    // Button/Link
    doc.setFillColor(0, 0, 0);
    doc.roundedRect(rightColX, 65, 60, 10, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('RASTREAR ENVÍO', rightColX + 30, 71.5, { align: 'center' });
    doc.link(rightColX, 65, 60, 10, { url: 'https://unoexpresspanama.com/' });

    // Stamp
    doc.setDrawColor(40, 205, 65); // Apple Green
    doc.setTextColor(40, 205, 65);
    doc.setLineWidth(0.5);
    doc.roundedRect(width - 35, 85, 25, 8, 2, 2, 'D');
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('ENVIADO', width - 22.5, 90, { align: 'center' });

    // Footer
    doc.setFontSize(6);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 10, 100);
    doc.text('Thank you for choosing Cubitt.', width - 10, 100, { align: 'right' });

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

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('Respuesta inválida del servidor');
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
    <div className="min-h-screen bg-[#F5F5F7] font-sans text-[#1D1D1F] relative overflow-hidden">
      {/* Vibrant Mesh Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-rose-100 via-sky-100 to-violet-200 opacity-80" />
      
      {/* Ambient Background Blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-400/20 rounded-full blur-[120px] pointer-events-none mix-blend-multiply animate-pulse" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-purple-400/20 rounded-full blur-[120px] pointer-events-none mix-blend-multiply animate-pulse" />
      <div className="absolute top-[40%] left-[40%] w-[40%] h-[40%] bg-pink-300/20 rounded-full blur-[100px] pointer-events-none mix-blend-multiply" />
      
      {/* Apple-style Header */}
      <header className="bg-white/70 backdrop-blur-xl sticky top-0 z-50 border-b border-white/20 shadow-sm supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="text-black/80" size={20} />
            <span className="font-semibold tracking-tight text-black/90">Cubitt Dispatch</span>
            
            {/* Config Status Indicator */}
            <div className={`ml-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border backdrop-blur-md ${
              configStatus === 'ok' 
                ? 'bg-green-50/50 text-green-700 border-green-200/50' 
                : configStatus === 'error' 
                  ? 'bg-red-50/50 text-red-700 border-red-200/50'
                  : 'bg-slate-50/50 text-slate-600 border-slate-200/50'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                configStatus === 'ok' ? 'bg-green-500' : configStatus === 'error' ? 'bg-red-500' : 'bg-slate-400'
              }`} />
              {configStatus === 'ok' ? 'Sistema Listo' : configStatus === 'error' ? 'Error Config' : 'Verificando...'}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Header actions if needed */}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        
        <div className="bg-white/60 backdrop-blur-2xl rounded-[2rem] shadow-xl p-8 border border-white/40 ring-1 ring-white/50">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-[#1D1D1F] uppercase drop-shadow-sm">
              Notificaciones de Envío
            </h1>
            <button 
              onClick={sendAll}
              disabled={isGlobalSending}
              className="bg-[#0071E3]/90 hover:bg-[#0077ED] text-white text-sm font-medium px-6 py-2.5 rounded-full shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 backdrop-blur-sm"
            >
              {isGlobalSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Enviar Todos
            </button>
          </div>

          <div className="overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-6 p-4 border-b border-black/5 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <div className="col-span-3 pl-2">Nombre del Cliente</div>
              <div className="col-span-4">Correo Electrónico</div>
              <div className="col-span-3">Número de Guía</div>
              <div className="col-span-2 text-center">Acciones</div>
            </div>

            {/* Rows */}
            <div id="clientes" className="divide-y divide-black/5">
              {rows.map((row) => (
                <motion.div 
                  key={row.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: row.id * 0.05 }}
                  className="grid grid-cols-12 gap-6 p-6 items-center group hover:bg-white/40 transition-colors rounded-xl"
                >
                  {/* Name Input */}
                  <div className="col-span-3">
                    <input
                      type="text"
                      placeholder="Juan Pérez"
                      value={row.name}
                      onChange={(e) => handleInputChange(row.id, 'name', e.target.value)}
                      className="nombre w-full bg-transparent border-b border-transparent focus:border-slate-400/50 p-2 text-[15px] font-medium text-slate-800 placeholder:text-slate-400 focus:ring-0 transition-all"
                    />
                  </div>

                  {/* Email Input */}
                  <div className="col-span-4">
                    <input
                      type="email"
                      placeholder="juan@ejemplo.com"
                      value={row.email}
                      onChange={(e) => handleInputChange(row.id, 'email', e.target.value)}
                      className="w-full bg-transparent border-b border-transparent focus:border-slate-400/50 p-2 text-[15px] text-slate-600 placeholder:text-slate-400 focus:ring-0 transition-all"
                    />
                  </div>

                  {/* Guide Input */}
                  <div className="col-span-3">
                    <input
                      type="text"
                      placeholder="00XXXXXXX"
                      value={row.guide}
                      onChange={(e) => handleInputChange(row.id, 'guide', e.target.value)}
                      className="guia w-full bg-transparent border-b border-transparent focus:border-slate-400/50 p-2 text-[15px] font-mono text-slate-500 placeholder:text-slate-400 focus:ring-0 transition-all uppercase"
                    />
                  </div>

                  {/* Actions */}
                  <div className="col-span-2 flex items-center justify-center gap-3">
                    {row.status === 'idle' && (
                      <>
                        <button
                          onClick={() => previewPDF(row)}
                          disabled={!row.name || !row.guide}
                          className="p-2.5 text-slate-500 hover:text-slate-700 hover:bg-white/60 rounded-full transition-colors disabled:opacity-30 backdrop-blur-sm"
                          title="Ver PDF"
                        >
                          <FileText size={18} strokeWidth={1.5} />
                        </button>
                        <button
                          onClick={() => sendEmail(row)}
                          disabled={!row.email || !row.name || !row.guide}
                          className="p-2.5 text-slate-500 hover:text-[#0071E3] hover:bg-blue-50/50 rounded-full transition-colors disabled:opacity-30 backdrop-blur-sm"
                          title="Enviar Correo"
                        >
                          <Send size={18} strokeWidth={1.5} />
                        </button>
                      </>
                    )}
                    
                    {row.status === 'sending' && (
                      <Loader2 size={20} className="text-[#0071E3] animate-spin" />
                    )}
                    
                    {row.status === 'success' && (
                      <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50/60 border border-emerald-100/50 px-3 py-1 rounded-full backdrop-blur-sm">
                        <CheckCircle size={14} />
                        <span className="text-xs font-semibold uppercase tracking-wide">Enviado</span>
                      </div>
                    )}

                    {row.status === 'error' && (
                      <div className="flex items-center gap-2">
                        <div className="group/error relative">
                          <AlertCircle size={20} className="text-red-400 cursor-help" />
                          <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-white/90 backdrop-blur-xl text-red-600 text-xs rounded-xl shadow-xl border border-red-100 opacity-0 group-hover/error:opacity-100 pointer-events-none z-10">
                            {row.errorMessage || 'Error al enviar'}
                          </div>
                        </div>
                        <button
                          onClick={() => resetRow(row.id)}
                          className="p-2 text-slate-400 hover:text-[#0071E3] hover:bg-white/60 rounded-full transition-colors"
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
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs text-slate-400 font-medium tracking-wide uppercase drop-shadow-sm">
            Sistema de Notificaciones Cubitt Dispatch
          </p>
        </div>
      </main>
    </div>
  );
}
