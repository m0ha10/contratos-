import { useState, useEffect, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import {
  PlusCircle, Trash2, X, Star, Building2, Cpu, TrendingUp,
  FileText, CheckCircle, ChevronRight, RefreshCw, Wifi, WifiOff, AlertTriangle
} from "lucide-react";

const API = "https://api-contratos.m0hasistemas.org";
const JWT = "eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJyb2xlIjogImNvbnRyYXRvc191c2VyIiwgImV4cCI6IDIwOTUyMDcwNjZ9.6CoXK2_I5hLpmwfvyK-HxNEygmFLa-bFWgFv-JpjyIE";
const HDR = { "Content-Type": "application/json", "Authorization": `Bearer ${JWT}`, "Prefer": "return=representation" };

const fCRC = (n) => `₡${Math.round(n || 0).toLocaleString("es-CR")}`;
const TODAY = new Date().toISOString().split("T")[0];
const NEW_BONUS = 10000;

const SERVICES = [
  { label: "Fibra Óptica Residencial", rate: 0.02 },
  { label: "Fibra Óptica Empresarial", rate: 0.03 },
  { label: "Punto a Punto Residencial", rate: 0.03 },
  { label: "Punto a Punto Empresarial", rate: 0.03 },
  { label: "Cámaras Analógicas (Renta)", rate: 0.07 },
  { label: "Cámaras IP (Renta)", rate: 0.07 },
  { label: "Alarmas (Renta)", rate: 0.07 },
  { label: "Alarmas + Cámaras (Renta)", rate: 0.07 },
  { label: "Web Hosting Mensual", rate: 0.05 },
  { label: "SEO / Marketing Web", rate: 0.05 },
  { label: "Mantenimiento Web", rate: 0.05 },
  { label: "Monitoreo", rate: 0.07 },
  { label: "Otro", rate: 0.05 },
];

const get   = (ep) => fetch(`${API}/${ep}`, { headers: HDR }).then(r => r.json());
const post  = (ep, body) => fetch(`${API}/${ep}`, { method: "POST", headers: HDR, body: JSON.stringify(body) }).then(r => r.json());
const patch = (ep, id, body) => fetch(`${API}/${ep}?id=eq.${id}`, { method: "PATCH", headers: HDR, body: JSON.stringify(body) }).then(r => r.json());
const del   = (ep, id) => fetch(`${API}/${ep}?id=eq.${id}`, { method: "DELETE", headers: HDR });

// Calcula si una cuota está vencida
const isOverdue = (contract, paidCount) => {
  if (paidCount >= contract.total_cuotas) return false;
  const start = new Date(contract.fecha_inicio);
  const nextDue = new Date(start);
  nextDue.setMonth(nextDue.getMonth() + paidCount);
  return new Date() > nextDue;
};

export default function App() {
  const [ready, setReady]     = useState(false);
  const [page, setPage]       = useState("dashboard");
  const [sub, setSub]         = useState("recurrentes");
  const [online, setOnline]   = useState(true);
  const [rec, setRec]         = useState([]);
  const [one, setOne]         = useState([]);
  const [sis, setSis]         = useState([]);
  const [pays, setPays]       = useState([]);
  const [resumen, setResumen] = useState({});
  const [modal, setModal]     = useState(null);
  const [selSis, setSelSis]   = useState(null);
  const [form, setForm]       = useState({});
  const [saving, setSaving]   = useState(false);

  const load = useCallback(async () => {
    setReady(false);
    try {
      const [r, o, s, p, rs] = await Promise.all([
        get("dapos_recurrentes?order=id.asc"),
        get("dapos_unicos?order=id.asc"),
        get("sistemas_contratos?order=id.asc"),
        get("sistemas_pagos?order=contrato_id.asc,no_cuota.asc"),
        get("resumen_mes"),
      ]);
      setRec(Array.isArray(r) ? r : []);
      setOne(Array.isArray(o) ? o : []);
      setSis(Array.isArray(s) ? s : []);
      setPays(Array.isArray(p) ? p : []);
      setResumen(Array.isArray(rs) && rs[0] ? rs[0] : {});
      setOnline(true);
    } catch (_) { setOnline(false); }
    setReady(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  const nav = (p, s) => { setPage(p); setSub(s || (p === "dapos" ? "recurrentes" : "contratos")); };
  const closeModal = () => { setModal(null); setForm({}); };

  // Computed
  const activeRec  = rec.filter(r => r.estado === "Activo");
  const totRec     = parseFloat(resumen.comision_recurrente || 0);
  const totOne     = parseFloat(resumen.comision_unicos || 0);
  const sisPays    = (cid) => pays.filter(p => p.contrato_id === cid);
  const sisPaid    = (cid) => sisPays(cid).filter(p => p.estado === "Pagado").reduce((s, p) => s + parseFloat(p.monto), 0);
  const sisPaidCt  = (cid) => sisPays(cid).filter(p => p.estado === "Pagado").length;
  const overdueContracts = sis.filter(s => s.estado === "Activo" && isOverdue(s, sisPaidCt(s.id)));

  // CRUD
  const addRec = async () => {
    setSaving(true);
    const svc = SERVICES.find(s => s.label === form.servicio) || { rate: 0.05 };
    await post("dapos_recurrentes", { no_contrato: form.no_contrato || null, cliente: form.cliente, servicio: form.servicio || "Otro", monto: parseFloat(form.monto) || 0, tasa: svc.rate, fecha_inicio: form.fecha_inicio || TODAY, es_nuevo: !!form.es_nuevo });
    await load(); setSaving(false); closeModal();
  };
  const toggleNuevo = async (r) => { await patch("dapos_recurrentes", r.id, { es_nuevo: !r.es_nuevo }); await load(); };
  const toggleEstadoRec = async (r) => { await patch("dapos_recurrentes", r.id, { estado: r.estado === "Activo" ? "Cancelado" : "Activo" }); await load(); };
  const delRec = async (id) => { await del("dapos_recurrentes", id); await load(); };

  const addOne = async () => {
    setSaving(true);
    await post("dapos_unicos", { no_factura: form.no_factura || null, cliente: form.cliente, descripcion: form.descripcion, monto: parseFloat(form.monto) || 0, fecha: form.fecha || TODAY, estado: "Pendiente" });
    await load(); setSaving(false); closeModal();
  };
  const delOne = async (id) => { await del("dapos_unicos", id); await load(); };

  const addSis = async () => {
    setSaving(true);
    const t = parseFloat(form.monto_total) || 0, m = parseInt(form.total_cuotas) || 12;
    await post("sistemas_contratos", { cliente: form.cliente, telefono: form.telefono || null, sistema: form.sistema, monto_total: t, cuota_mensual: form.cuota_mensual ? parseFloat(form.cuota_mensual) : Math.round(t / m), total_cuotas: m, fecha_inicio: form.fecha_inicio || TODAY, notas: form.notas ? `${form.notas}${form.url_sistema ? ` | URL: ${form.url_sistema}` : ""}` : (form.url_sistema || null) });
    await load(); setSaving(false); closeModal();
  };

  const addPay = async () => {
    setSaving(true);
    const c = sis.find(s => s.id === selSis);
    await post("sistemas_pagos", { contrato_id: selSis, no_cuota: sisPaidCt(selSis) + 1, monto: parseFloat(form.monto) || c.cuota_mensual, fecha_pago: form.fecha || TODAY, estado: "Pagado" });
    await load(); setSaving(false); closeModal();
  };

  // UI Atoms
  const Bdg = ({ s }) => {
    const m = { Activo: "bg-emerald-100 text-emerald-700", Cancelado: "bg-red-100 text-red-600", Pagado: "bg-sky-100 text-sky-700", Pendiente: "bg-amber-100 text-amber-700", Completado: "bg-slate-100 text-slate-500" };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${m[s] || "bg-gray-100 text-gray-600"}`}>{s}</span>;
  };

  const inp = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white";
  const F = ({ lbl, children }) => <div><label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">{lbl}</label>{children}</div>;

  const Mdl = ({ title, onOk, children }) => (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center px-5 py-4 border-b">
          <h3 className="font-bold text-slate-800 text-sm">{title}</h3>
          <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-3.5 overflow-y-auto flex-1">{children}</div>
        <div className="flex gap-2 px-5 py-4 border-t">
          <button onClick={closeModal} className="flex-1 py-2.5 rounded-xl border text-slate-600 text-sm hover:bg-slate-50 font-medium">Cancelar</button>
          <button onClick={onOk} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving && <RefreshCw size={13} className="animate-spin" />} Guardar
          </button>
        </div>
      </div>
    </div>
  );

  const chartData = [
    { m: "Ene", v: 18200 }, { m: "Feb", v: 21000 }, { m: "Mar", v: 26182 },
    { m: "Abr", v: 22450 }, { m: "May", v: totRec },
  ];

  if (!ready) return (
    <div className="min-h-screen bg-[#0a1628] flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-slate-400 text-sm">Conectando...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* Sidebar */}
      <aside className="w-52 bg-[#0a1628] flex flex-col py-5 px-3 flex-shrink-0 min-h-screen">
        <div className="px-2 mb-7">
          <div className="text-emerald-400 text-[10px] font-bold tracking-[0.2em] uppercase mb-1">m0hasistemas</div>
          <div className="text-white text-lg font-bold leading-tight">Contratos</div>
          <div className="flex items-center gap-1.5 mt-1.5">
            {online ? <><Wifi size={10} className="text-emerald-400" /><span className="text-emerald-400 text-[10px]">Conectado</span></>
                    : <><WifiOff size={10} className="text-red-400" /><span className="text-red-400 text-[10px]">Sin conexión</span></>}
          </div>
          {overdueContracts.length > 0 && (
            <div className="mt-2 bg-red-500/20 border border-red-500/30 rounded-lg px-2 py-1.5 flex items-center gap-1.5">
              <AlertTriangle size={11} className="text-red-400 flex-shrink-0" />
              <span className="text-red-300 text-[10px] font-semibold">{overdueContracts.length} cuota{overdueContracts.length > 1 ? "s" : ""} vencida{overdueContracts.length > 1 ? "s" : ""}</span>
            </div>
          )}
        </div>
        <nav className="space-y-0.5 flex-1">
          {[{ k: "dashboard", l: "Dashboard", I: TrendingUp }, { k: "dapos", l: "D-APOS", I: Building2 }, { k: "sistemas", l: "Mis Sistemas", I: Cpu }].map(({ k, l, I }) => (
            <button key={k} onClick={() => nav(k)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${page === k ? "bg-emerald-600 text-white font-semibold shadow-lg shadow-emerald-900/40" : "text-slate-500 hover:text-slate-200 hover:bg-white/5"}`}>
              <I size={15} />{l}
            </button>
          ))}
        </nav>
        <div className="px-2 pt-4 border-t border-white/5">
          <button onClick={load} className="flex items-center gap-2 text-slate-600 text-xs hover:text-slate-400">
            <RefreshCw size={11} /> Actualizar datos
          </button>
          <div className="text-slate-700 text-[10px] mt-2">{new Date().toLocaleString("es-CR", { month: "long", year: "numeric" })}</div>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-5 pb-12">

          {/* DASHBOARD */}
          {page === "dashboard" && (
            <div className="space-y-5">
              <div><h1 className="text-2xl font-bold text-slate-800">Dashboard</h1><p className="text-slate-500 text-sm">Resumen del mes en curso</p></div>

              {overdueContracts.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-red-700 text-sm">Cuotas vencidas sin cobrar</div>
                    <div className="text-red-600 text-xs mt-1 space-y-0.5">
                      {overdueContracts.map(s => (
                        <div key={s.id}>• {s.cliente} — {s.sistema} · Cuota #{sisPaidCt(s.id) + 1} de {s.total_cuotas}</div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { l: "Comisión Recurrente", v: fCRC(totRec), s: `${resumen.contratos_activos || 0} contratos activos`, c: "text-emerald-600", dot: "bg-emerald-400" },
                  { l: "Pagos Únicos", v: fCRC(totOne), s: `${one.length} ventas`, c: "text-sky-600", dot: "bg-sky-400" },
                  { l: "Total D-APOS", v: fCRC(totRec + totOne), s: "comisión total", c: "text-indigo-600", dot: "bg-indigo-400" },
                  { l: "Sistemas en Cuotas", v: String(resumen.sistemas_activos || 0), s: "contratos activos", c: "text-violet-600", dot: "bg-violet-400" },
                ].map((c, i) => (
                  <div key={i} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-1.5 mb-2"><div className={`w-1.5 h-1.5 rounded-full ${c.dot}`} /><span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{c.l}</span></div>
                    <div className={`text-xl font-bold ${c.c}`}>{c.v}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{c.s}</div>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
                <div className="font-semibold text-slate-700 text-sm mb-1">Comisiones Recurrentes D-APOS</div>
                <div className="text-xs text-slate-400 mb-4">Últimos meses</div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={chartData} barSize={28}>
                    <XAxis dataKey="m" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#94a3b8" }} />
                    <YAxis tickFormatter={(v) => `₡${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <Tooltip formatter={(v) => [fCRC(v), "Comisión"]} contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 24px rgba(0,0,0,0.1)" }} />
                    <Bar dataKey="v" fill="#059669" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all group" onClick={() => nav("dapos", "recurrentes")}>
                  <div className="flex justify-between items-center">
                    <div><div className="font-semibold text-slate-700 text-sm mb-1">Contratos Recurrentes D-APOS</div><div className="text-2xl font-bold text-emerald-600">{fCRC(totRec)}</div><div className="text-xs text-slate-400 mt-1">{activeRec.length} activos · {rec.filter(r => r.es_nuevo).length} nuevos este mes</div></div>
                    <ChevronRight size={18} className="text-slate-300 group-hover:text-emerald-400 transition-colors" />
                  </div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 cursor-pointer hover:border-violet-300 hover:shadow-md transition-all group" onClick={() => nav("sistemas", "contratos")}>
                  <div className="flex justify-between items-center">
                    <div><div className="font-semibold text-slate-700 text-sm mb-1">Sistemas en Cuotas Mensuales</div><div className="text-2xl font-bold text-violet-600">{sis.length}</div><div className="text-xs text-slate-400 mt-1">{overdueContracts.length > 0 ? <span className="text-red-500 font-semibold">{overdueContracts.length} con cuota vencida</span> : "al día"}</div></div>
                    <ChevronRight size={18} className="text-slate-300 group-hover:text-violet-400 transition-colors" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* D-APOS */}
          {page === "dapos" && (
            <div className="space-y-5">
              <div><h1 className="text-2xl font-bold text-slate-800">D-APOS</h1><p className="text-slate-500 text-sm">Comisiones por ventas de servicios D-APOS Soluciones Tecnológicas</p></div>
              <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                {[["recurrentes", "Recurrentes"], ["unicos", "Pagos Únicos"]].map(([k, l]) => (
                  <button key={k} onClick={() => setSub(k)} className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${sub === k ? "bg-white shadow text-slate-800" : "text-slate-500 hover:text-slate-700"}`}>{l}</button>
                ))}
              </div>

              {sub === "recurrentes" && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                  <div className="flex justify-between items-center px-5 py-4 border-b">
                    <div className="text-sm text-slate-500"><span>{activeRec.length} contratos activos · </span><span className="font-bold text-emerald-600 text-base">{fCRC(totRec)}</span></div>
                    <button onClick={() => { setForm({}); setModal("addR"); }} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700"><PlusCircle size={15} /> Agregar</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-slate-50">{["Contrato", "Cliente", "Servicio", "Monto", "Comisión", "Nueva", "Estado", ""].map(h => <th key={h} className="text-left py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>)}</tr></thead>
                      <tbody>
                        {rec.map(r => {
                          const comm = r.es_nuevo ? NEW_BONUS : parseFloat(r.monto) * parseFloat(r.tasa);
                          return (
                            <tr key={r.id} className={`border-b border-slate-50 hover:bg-slate-50/80 ${r.estado === "Cancelado" ? "opacity-40" : ""}`}>
                              <td className="py-3 px-4 font-mono text-slate-400 text-xs">{r.no_contrato || "—"}</td>
                              <td className="py-3 px-4 font-medium text-slate-800 max-w-[160px]"><div className="truncate">{r.cliente}</div></td>
                              <td className="py-3 px-4 text-slate-500 text-xs max-w-[130px]"><div className="truncate">{r.servicio}</div></td>
                              <td className="py-3 px-4 text-right tabular-nums">{fCRC(r.monto)}</td>
                              <td className="py-3 px-4 text-right font-bold text-emerald-600 tabular-nums">{fCRC(comm)}</td>
                              <td className="py-3 px-4 text-center">
                                <button onClick={() => toggleNuevo(r)} title="Servicio nuevo → ₡10.000 fijo" className={`w-7 h-7 rounded-lg flex items-center justify-center mx-auto transition-all ${r.es_nuevo ? "bg-amber-400" : "bg-slate-100 hover:bg-amber-100"}`}>
                                  <Star size={12} className={r.es_nuevo ? "text-white fill-white" : "text-slate-300"} />
                                </button>
                              </td>
                              <td className="py-3 px-4"><button onClick={() => toggleEstadoRec(r)}><Bdg s={r.estado} /></button></td>
                              <td className="py-3 px-4"><button onClick={() => delRec(r.id)} className="text-slate-200 hover:text-red-400 p-1"><Trash2 size={13} /></button></td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-emerald-50 border-t border-emerald-100">
                          <td colSpan={4} className="py-3.5 px-4 font-bold text-slate-700 text-sm">Total a Cobrar este Mes</td>
                          <td className="py-3.5 px-4 text-right font-bold text-emerald-700 text-lg tabular-nums">{fCRC(totRec)}</td>
                          <td colSpan={3} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <div className="px-5 py-3 flex items-center gap-2 text-xs text-slate-400 border-t border-slate-50 bg-slate-50/50">
                    <Star size={11} className="text-amber-400 flex-shrink-0" />
                    Activa la estrella en servicios nuevos para aplicar comisión fija de ₡10,000 el primer mes
                  </div>
                </div>
              )}

              {sub === "unicos" && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                  <div className="flex justify-between items-center px-5 py-4 border-b">
                    <div className="text-sm text-slate-500"><span>{one.length} ventas · 1% comisión · </span><span className="font-bold text-sky-600 text-base">{fCRC(totOne)}</span></div>
                    <button onClick={() => { setForm({ fecha: TODAY }); setModal("addO"); }} className="flex items-center gap-2 bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-sky-700"><PlusCircle size={15} /> Agregar</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-slate-50">{["Factura", "Cliente", "Descripción", "Monto", "Comisión (1%)", "Fecha", "Estado", ""].map(h => <th key={h} className="text-left py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>)}</tr></thead>
                      <tbody>
                        {one.map(o => (
                          <tr key={o.id} className="border-b border-slate-50 hover:bg-slate-50/80">
                            <td className="py-3 px-4 font-mono text-slate-400 text-xs">{o.no_factura || "—"}</td>
                            <td className="py-3 px-4 font-medium">{o.cliente}</td>
                            <td className="py-3 px-4 text-slate-500 text-xs">{o.descripcion}</td>
                            <td className="py-3 px-4 text-right tabular-nums">{fCRC(o.monto)}</td>
                            <td className="py-3 px-4 text-right font-bold text-sky-600 tabular-nums">{fCRC(parseFloat(o.monto) * 0.01)}</td>
                            <td className="py-3 px-4 text-slate-400 text-xs">{o.fecha}</td>
                            <td className="py-3 px-4"><Bdg s={o.estado} /></td>
                            <td className="py-3 px-4"><button onClick={() => delOne(o.id)} className="text-slate-200 hover:text-red-400 p-1"><Trash2 size={13} /></button></td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-sky-50 border-t border-sky-100">
                          <td colSpan={4} className="py-3.5 px-4 font-bold text-slate-700 text-sm">Total a Cobrar</td>
                          <td className="py-3.5 px-4 text-right font-bold text-sky-700 text-lg tabular-nums">{fCRC(totOne)}</td>
                          <td colSpan={3} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SISTEMAS */}
          {page === "sistemas" && (
            <div className="space-y-5">
              <div><h1 className="text-2xl font-bold text-slate-800">Mis Sistemas</h1><p className="text-slate-500 text-sm">Contratos de desarrollo con cobro mensual en cuotas</p></div>
              <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                {[["contratos", "Contratos"], ["pagos", "Historial de Pagos"]].map(([k, l]) => (
                  <button key={k} onClick={() => setSub(k)} className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${sub === k ? "bg-white shadow text-slate-800" : "text-slate-500 hover:text-slate-700"}`}>{l}</button>
                ))}
              </div>

              {sub === "contratos" && (
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <button onClick={() => { setForm({}); setModal("addS"); }} className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-violet-700"><PlusCircle size={15} /> Nuevo Contrato</button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {sis.map(s => {
                      const pc = sisPaidCt(s.id), pa = sisPaid(s.id);
                      const pct = Math.min(Math.round((pc / s.total_cuotas) * 100), 100);
                      const pending = parseFloat(s.monto_total) - pa;
                      const overdue = isOverdue(s, pc);
                      const urlMatch = s.notas?.match(/URL:\s*(https?:\/\/[^\s|]+)/);
                      const url = urlMatch ? urlMatch[1].trim() : null;
                      return (
                        <div key={s.id} className={`bg-white rounded-xl p-5 shadow-sm border transition-shadow hover:shadow-md ${overdue ? "border-red-200" : "border-slate-100"}`}>
                          {overdue && (
                            <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3">
                              <AlertTriangle size={13} className="text-red-500 flex-shrink-0" />
                              <span className="text-red-600 text-xs font-semibold">Cuota #{pc + 1} vencida — pendiente de cobro</span>
                            </div>
                          )}
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <div className="font-bold text-slate-800 text-base">{s.cliente}</div>
                              <div className="text-sm text-violet-600 font-semibold">{s.sistema}</div>
                              {s.telefono && <div className="text-xs text-slate-400 mt-0.5">📞 {s.telefono}</div>}
                              {url && <a href={url} target="_blank" rel="noreferrer" className="text-xs text-emerald-600 hover:underline mt-0.5 block">🌐 {url}</a>}
                            </div>
                            <div className="flex flex-col items-end gap-1.5">
                              <Bdg s={s.estado} />
                              <button onClick={() => { if(confirm("¿Eliminar contrato?")) { del("sistemas_contratos", s.id).then(load); } }} className="text-slate-200 hover:text-red-400 p-0.5"><Trash2 size={12} /></button>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 mb-4">
                            {[
                              { l: "Total", v: fCRC(s.monto_total), c: "text-slate-700" },
                              { l: "Cuota", v: fCRC(s.cuota_mensual), c: "text-violet-600" },
                              { l: "Pendiente", v: fCRC(pending), c: pending > 0 ? "text-red-500" : "text-emerald-600" },
                            ].map(({ l, v, c }) => (
                              <div key={l} className="bg-slate-50 rounded-lg p-2.5 text-center">
                                <div className="text-[10px] text-slate-400 font-medium">{l}</div>
                                <div className={`font-bold text-xs mt-0.5 ${c}`}>{v}</div>
                              </div>
                            ))}
                          </div>
                          <div className="mb-1">
                            <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                              <span>{pc} de {s.total_cuotas} cuotas pagadas</span>
                              <span className="font-semibold">{pct}%</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all duration-500 ${overdue ? "bg-red-400" : "bg-violet-500"}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                          <div className="flex gap-2 mt-4">
                            <button onClick={() => { setSelSis(s.id); setModal("viewP"); }} className="flex-1 py-2 text-xs rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center gap-1.5"><FileText size={12} /> Ver Pagos</button>
                            <button onClick={() => { setSelSis(s.id); setForm({ monto: s.cuota_mensual, fecha: TODAY }); setModal("addP"); }} className={`flex-1 py-2 text-xs rounded-lg text-white flex items-center justify-center gap-1.5 font-semibold ${overdue ? "bg-red-500 hover:bg-red-600" : "bg-violet-600 hover:bg-violet-700"}`}>
                              <CheckCircle size={12} /> {overdue ? "¡Cobrar ahora!" : "Registrar Pago"}
                            </button>
                          </div>
                          {s.notas && !url && <div className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-50">📝 {s.notas}</div>}
                          {s.notas && url && s.notas.replace(`| URL: ${url}`, "").replace(`URL: ${url}`, "").trim() && (
                            <div className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-50">📝 {s.notas.replace(`| URL: ${url}`, "").replace(`URL: ${url}`, "").trim()}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {sub === "pagos" && (
                <div className="space-y-4">
                  {sis.map(s => {
                    const ps = sisPays(s.id).sort((a, b) => a.no_cuota - b.no_cuota);
                    return (
                      <div key={s.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="flex justify-between items-center px-5 py-3.5 bg-slate-50 border-b">
                          <div><span className="font-semibold text-slate-700 text-sm">{s.cliente}</span><span className="text-slate-400 text-sm"> · {s.sistema}</span></div>
                          <span className="text-sm font-bold text-violet-600">{fCRC(sisPaid(s.id))} cobrado</span>
                        </div>
                        {ps.length === 0
                          ? <div className="px-5 py-6 text-center text-slate-400 text-sm">Sin pagos registrados</div>
                          : <table className="w-full text-sm">
                              <thead><tr className="border-b border-slate-50">{["Cuota", "Monto", "Fecha", "Estado"].map(h => <th key={h} className="py-2.5 px-4 text-[10px] font-bold text-slate-400 uppercase text-left">{h}</th>)}</tr></thead>
                              <tbody>
                                {ps.map(p => (
                                  <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                                    <td className="py-2.5 px-4 font-medium">Cuota #{p.no_cuota}</td>
                                    <td className="py-2.5 px-4 font-bold tabular-nums">{fCRC(p.monto)}</td>
                                    <td className="py-2.5 px-4 text-slate-400 text-xs">{p.fecha_pago}</td>
                                    <td className="py-2.5 px-4"><Bdg s={p.estado} /></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                        }
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* MODALS */}
      {modal === "addR" && (
        <Mdl title="Agregar Contrato Recurrente D-APOS" onOk={addRec}>
          <F lbl="No. Contrato D-APOS"><input className={inp} placeholder="ej: 12345" value={form.no_contrato || ""} onChange={e => setForm({ ...form, no_contrato: e.target.value })} /></F>
          <F lbl="Cliente"><input className={inp} placeholder="Nombre del cliente" value={form.cliente || ""} onChange={e => setForm({ ...form, cliente: e.target.value })} /></F>
          <F lbl="Tipo de Servicio">
            <select className={inp} value={form.servicio || ""} onChange={e => setForm({ ...form, servicio: e.target.value })}>
              <option value="">Seleccionar...</option>
              {SERVICES.map(s => <option key={s.label} value={s.label}>{s.label} ({(s.rate * 100).toFixed(0)}%)</option>)}
            </select>
          </F>
          <F lbl="Monto del Contrato (₡)"><input className={inp} type="number" placeholder="ej: 25500" value={form.monto || ""} onChange={e => setForm({ ...form, monto: e.target.value })} /></F>
          <F lbl="Fecha de Inicio"><input className={inp} type="date" value={form.fecha_inicio || TODAY} onChange={e => setForm({ ...form, fecha_inicio: e.target.value })} /></F>
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 p-4 rounded-xl">
            <input id="cn" type="checkbox" className="mt-0.5 accent-amber-500 w-4 h-4" checked={!!form.es_nuevo} onChange={e => setForm({ ...form, es_nuevo: e.target.checked })} />
            <label htmlFor="cn" className="text-sm text-amber-800 cursor-pointer">
              <div className="font-bold">¿Nueva instalación este mes?</div>
              <div className="text-xs text-amber-600 mt-0.5">Comisión fija de <strong>₡10,000</strong> en lugar del porcentaje</div>
            </label>
          </div>
          {form.servicio && form.monto && (
            <div className="bg-emerald-50 rounded-xl p-3.5 flex justify-between">
              <span className="text-emerald-700 text-sm">Comisión estimada:</span>
              <span className="font-bold text-emerald-700">{fCRC(form.es_nuevo ? NEW_BONUS : (parseFloat(form.monto) || 0) * (SERVICES.find(s => s.label === form.servicio)?.rate || 0.05))}</span>
            </div>
          )}
        </Mdl>
      )}

      {modal === "addO" && (
        <Mdl title="Agregar Venta / Pago Único" onOk={addOne}>
          <F lbl="No. Factura D-APOS"><input className={inp} placeholder="ej: 12345" value={form.no_factura || ""} onChange={e => setForm({ ...form, no_factura: e.target.value })} /></F>
          <F lbl="Cliente"><input className={inp} placeholder="Nombre del cliente" value={form.cliente || ""} onChange={e => setForm({ ...form, cliente: e.target.value })} /></F>
          <F lbl="Descripción"><input className={inp} placeholder="ej: Venta de equipo, Instalación..." value={form.descripcion || ""} onChange={e => setForm({ ...form, descripcion: e.target.value })} /></F>
          <F lbl="Monto (₡)"><input className={inp} type="number" placeholder="ej: 250000" value={form.monto || ""} onChange={e => setForm({ ...form, monto: e.target.value })} /></F>
          <F lbl="Fecha"><input className={inp} type="date" value={form.fecha || TODAY} onChange={e => setForm({ ...form, fecha: e.target.value })} /></F>
          {form.monto && (
            <div className="bg-sky-50 rounded-xl p-3.5 flex justify-between">
              <span className="text-sky-700 text-sm">Comisión (1%):</span>
              <span className="font-bold text-sky-700">{fCRC((parseFloat(form.monto) || 0) * 0.01)}</span>
            </div>
          )}
        </Mdl>
      )}

      {modal === "addS" && (
        <Mdl title="Nuevo Contrato de Sistema" onOk={addSis}>
          <F lbl="Cliente / Empresa"><input className={inp} placeholder="Nombre del cliente" value={form.cliente || ""} onChange={e => setForm({ ...form, cliente: e.target.value })} /></F>
          <F lbl="Sistema / Producto"><input className={inp} placeholder="ej: Sistema POS, Sistema RRHH, Sitio Web..." value={form.sistema || ""} onChange={e => setForm({ ...form, sistema: e.target.value })} /></F>
          <F lbl="URL del Sistema"><input className={inp} placeholder="ej: https://cliente.m0hasistemas.org" value={form.url_sistema || ""} onChange={e => setForm({ ...form, url_sistema: e.target.value })} /></F>
          <div className="grid grid-cols-2 gap-3">
            <F lbl="Monto Total (₡)"><input className={inp} type="number" placeholder="ej: 850000" value={form.monto_total || ""} onChange={e => setForm({ ...form, monto_total: e.target.value })} /></F>
            <F lbl="Número de Cuotas"><input className={inp} type="number" placeholder="ej: 12" value={form.total_cuotas || ""} onChange={e => setForm({ ...form, total_cuotas: e.target.value })} /></F>
          </div>
          <F lbl="Cuota Mensual (₡) — vacío = automático"><input className={inp} type="number" placeholder="Se calcula automático" value={form.cuota_mensual || ""} onChange={e => setForm({ ...form, cuota_mensual: e.target.value })} /></F>
          <div className="grid grid-cols-2 gap-3">
            <F lbl="Fecha de Inicio (día de cobro)"><input className={inp} type="date" value={form.fecha_inicio || TODAY} onChange={e => setForm({ ...form, fecha_inicio: e.target.value })} /></F>
            <F lbl="Teléfono"><input className={inp} placeholder="88880000" value={form.telefono || ""} onChange={e => setForm({ ...form, telefono: e.target.value })} /></F>
          </div>
          <F lbl="Notas"><input className={inp} placeholder="Detalles adicionales..." value={form.notas || ""} onChange={e => setForm({ ...form, notas: e.target.value })} /></F>
          {form.monto_total && form.total_cuotas && (
            <div className="bg-violet-50 rounded-xl p-3.5 flex justify-between">
              <span className="text-violet-700 text-sm">Cuota mensual:</span>
              <span className="font-bold text-violet-700">{fCRC(Math.round((parseFloat(form.monto_total) || 0) / (parseInt(form.total_cuotas) || 1)))}</span>
            </div>
          )}
        </Mdl>
      )}

      {modal === "addP" && selSis && (() => {
        const c = sis.find(s => s.id === selSis);
        const overdue = isOverdue(c, sisPaidCt(selSis));
        return (
          <Mdl title="Registrar Pago de Cuota" onOk={addPay}>
            <div className={`rounded-xl p-4 ${overdue ? "bg-red-50 border border-red-100" : "bg-violet-50"}`}>
              <div className={`font-bold ${overdue ? "text-red-800" : "text-violet-800"}`}>{c?.cliente}</div>
              <div className={`text-sm mt-0.5 ${overdue ? "text-red-600" : "text-violet-600"}`}>{c?.sistema} · Cuota <strong>#{sisPaidCt(selSis) + 1}</strong> de {c?.total_cuotas}</div>
              <div className="text-xs text-slate-500 mt-1">Pendiente: {fCRC((parseFloat(c?.monto_total) || 0) - sisPaid(selSis))}</div>
            </div>
            <F lbl="Monto Recibido (₡)"><input className={inp} type="number" value={form.monto || ""} onChange={e => setForm({ ...form, monto: e.target.value })} /></F>
            <F lbl="Fecha de Pago"><input className={inp} type="date" value={form.fecha || TODAY} onChange={e => setForm({ ...form, fecha: e.target.value })} /></F>
          </Mdl>
        );
      })()}

      {modal === "viewP" && selSis && (() => {
        const c = sis.find(s => s.id === selSis);
        const ps = sisPays(selSis).sort((a, b) => a.no_cuota - b.no_cuota);
        const paid = sisPaid(selSis);
        return (
          <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
              <div className="flex justify-between items-center px-5 py-4 border-b">
                <div><div className="font-bold">{c?.cliente}</div><div className="text-sm text-violet-600 font-semibold">{c?.sistema}</div></div>
                <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"><X size={16} /></button>
              </div>
              <div className="overflow-y-auto max-h-72 px-5 py-3">
                {ps.length === 0
                  ? <div className="text-center text-slate-400 text-sm py-6">Sin pagos registrados</div>
                  : ps.map(p => (
                    <div key={p.id} className="flex justify-between items-center py-3 border-b border-slate-50 last:border-0">
                      <div><div className="text-sm font-semibold">Cuota #{p.no_cuota}</div><div className="text-xs text-slate-400">{p.fecha_pago}</div></div>
                      <div className="flex items-center gap-2"><span className="font-bold text-sm tabular-nums">{fCRC(p.monto)}</span><Bdg s={p.estado} /></div>
                    </div>
                  ))
                }
              </div>
              <div className="px-5 py-4 border-t space-y-1">
                <div className="flex justify-between text-sm font-bold"><span>Total cobrado:</span><span className="text-violet-600">{fCRC(paid)}</span></div>
                <div className="flex justify-between text-sm font-bold"><span>Pendiente:</span><span className="text-red-500">{fCRC((parseFloat(c?.monto_total) || 0) - paid)}</span></div>
                <button onClick={() => setModal(null)} className="w-full mt-3 py-2.5 rounded-xl border text-slate-600 text-sm hover:bg-slate-50 font-medium">Cerrar</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
