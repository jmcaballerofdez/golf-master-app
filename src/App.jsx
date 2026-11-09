import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './contexts/AuthContext';
import { AuthProvider } from './contexts/AuthContext';
import Login from './pages/Login';

const LOGO_GOLFB_DORADO = "data:image/png;base64,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";

const APPS = [
  {
    id: 'academia',
    name: 'Academia',
    desc: 'Clases, alumnos, estadísticas y vídeos',
    url: 'https://academia.golfb.es/',
    color: '#1a472a',
    roles: ['alumno', 'academia', 'superadmin'],
  },
  {
    id: 'mantenimiento',
    name: 'Mantenimiento',
    desc: 'Equipo, tareas de campo y maquinaria',
    url: 'https://mantenimiento.golfb.es/',
    color: '#2d5a3d',
    roles: ['jardinero', 'greenkeeper', 'mantenimiento', 'superadmin'],
  },
  {
    id: 'recepcion',
    name: 'Recepción',
    desc: 'Ventas, checklist, turnos, fichajes y ausencias',
    url: 'https://recepciongcr.golfb.es/',
    color: '#7C2A35',
    roles: ['recepcion', 'responsable_recepcion', 'admin', 'superadmin'],
  },
  {
    id: 'proshop',
    name: 'Proshop',
    desc: 'TPV, fichajes, productos y ofertas',
    url: 'https://proshop.golfb.es/',
    color: '#8c1c1c',
    roles: ['proshop', 'superadmin'],
  },
  {
    id: 'finanzas',
    name: 'Finanzas',
    desc: 'Transacciones, presupuestos y metas',
    url: 'https://finanzas.golfb.es/',
    color: '#b8863c',
    roles: ['finanzas', 'superadmin'],
  },
];

// ─── Utilidades de fecha ────────────────────────────────────────────
function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function aFecha(valor) {
  if (!valor) return null;
  if (valor?.toDate) return valor.toDate();
  const d = new Date(valor);
  return isNaN(d) ? null : d;
}
function euros(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(n || 0));
}

// ─── Datos globales en tiempo real de las 4 apps ────────────────────
function useDatosGlobales(activo) {
const { tenantId } = useAuth();
  const [clases, setClases] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [transacciones, setTransacciones] = useState([]);
  const [fichajes, setFichajes] = useState([]);
  const [fichajesProshop, setFichajesProshop] = useState([]);
  const [tareas, setTareas] = useState([]);

  useEffect(() => {
    if (!activo) return;
    const unsubs = [
      onSnapshot(collection(db, 'academia_clases'), (snap) =>
        setClases(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
      onSnapshot(collection(db, 'clubes', tenantId, 'proshop_ventas'), (snap) =>
        setVentas(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
      onSnapshot(collection(db, 'clubes', tenantId, 'finanzas_transacciones'), (snap) =>
        setTransacciones(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
      onSnapshot(collection(db, 'clubes', tenantId, 'mant_fichajes'), (snap) =>
        setFichajes(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
      onSnapshot(collection(db, 'clubes', tenantId, 'proshop_fichajes'), (snap) =>
        setFichajesProshop(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
      onSnapshot(collection(db, 'clubes', tenantId, 'mant_tareas'), (snap) =>
        setTareas(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [activo]);

  const hoy = hoyISO();

  const clasesHoy = clases
    .filter((c) => c.fecha === hoy)
    .sort((a, b) => (a.horaInicio || '').localeCompare(b.horaInicio || ''));
  const minutosHoy = clasesHoy.reduce((s, c) => s + Number(c.duracion || 0), 0);

  const ventasHoy = ventas.filter((v) => {
    const f = aFecha(v.creadoEn);
    return f && f.toISOString().slice(0, 10) === hoy;
  });
  const totalVentasHoy = ventasHoy.reduce((s, v) => s + Number(v.total || 0), 0);

  const gastosHoy = transacciones.filter(
    (t) => t.type === 'expense' && (t.date || '').slice(0, 10) === hoy
  );
  const totalGastosHoy = gastosHoy.reduce((s, g) => s + Number(g.amount || 0), 0);

  // Último fichaje de cada empleado hoy → si es "entrada", sigue trabajando
  const ultimoPorEmpleado = {};
  fichajes.forEach((f) => {
    const m = aFecha(f.momento);
    if (!m || m.toISOString().slice(0, 10) !== hoy) return;
    if (!ultimoPorEmpleado[f.empleado] || m > ultimoPorEmpleado[f.empleado].momento) {
      ultimoPorEmpleado[f.empleado] = { tipo: f.tipo, momento: m };
    }
  });
  const personalActivo = Object.entries(ultimoPorEmpleado)
    .filter(([, v]) => v.tipo === 'entrada')
    .map(([nombre, v]) => ({ nombre, entrada: v.momento, dept: 'Mantenimiento' }));

  // Recepción/Proshop: sesión abierta = entrada sin salida
  fichajesProshop.forEach((f) => {
    if (f.entrada && !f.salida) {
      const e = aFecha(f.entrada);
      if (e && !personalActivo.some((p) => p.nombre === f.empleadoNombre)) {
        personalActivo.push({ nombre: f.empleadoNombre, entrada: e, dept: 'Recepción' });
      }
    }
  });

  const tareasPendientes = tareas
    .filter((t) => t.estado !== 'Completada' && t.estado !== 'Hecha')
    .sort((a, b) => (a.fechaLimite || '9999').localeCompare(b.fechaLimite || '9999'));

  return { clasesHoy, minutosHoy, totalVentasHoy, ventasHoy, totalGastosHoy, personalActivo, tareasPendientes, fichajes, fichajesProshop };
}

// ─── Panel de mando (solo superadmin) ───────────────────────────────
function StatMini({ label, valor, sub, color }) {
  return (
    <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
      <div className="h-[3px]" style={{ background: color }} />
      <div className="p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">{label}</p>
        <p className="text-2xl font-bold text-[#1a472a]">{valor}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PERSONAL — Registro de trabajadores del club + convenios colectivos
// Cada trabajador se asigna a un convenio (Instalaciones Deportivas,
// Jardinería, u otros que se creen). Hereda horas anuales y vacaciones
// del convenio, con posibilidad de excepción individual. Datos en
// Firestore bajo clubes/{tenantId}/ para el modelo multi-club.
// ═══════════════════════════════════════════════════════════════════
const DEPARTAMENTOS = [
  { id: 'Mantenimiento', color: '#2d5a3d' },
  { id: 'Recepción', color: '#8c1c1c' },
  { id: 'Dirección', color: '#b8863c' },
  { id: 'Academia', color: '#1a472a' },
];
const TIPOS_CONTRATO = ['Indefinido', 'Temporal', 'Fijo-discontinuo', 'Formación/Prácticas', 'Otro'];

const CONVENIOS_EJEMPLO = [
  {
    nombre: 'V Convenio Estatal de Instalaciones Deportivas y Gimnasios',
    horasAnuales: 1750,
    diasVacaciones: 30,
    tipoVacaciones: 'naturales',
    diasAsuntosPropios: 2,
    notas: 'Valores de ejemplo — verifica horas y vacaciones con el texto vigente del convenio.',
  },
  {
    nombre: 'Convenio de Jardinería',
    horasAnuales: 1776,
    diasVacaciones: 22,
    tipoVacaciones: 'laborables',
    diasAsuntosPropios: 2,
    notas: 'Valores de ejemplo — verifica horas y vacaciones con el convenio provincial aplicable.',
  },
];

function usePersonal(activo) {
  const { tenantId } = useAuth();
  const [empleados, setEmpleados] = useState([]);
  const [convenios, setConvenios] = useState([]);
  const [cfgCostes, setCfgCostes] = useState({ ssPct: 31.5 });
  useEffect(() => {
    if (!activo) return;
    const u1 = onSnapshot(collection(db, 'clubes', tenantId, 'personal_empleados'), (snap) =>
      setEmpleados(snap.docs.map((d) => ({ ...d.data(), id: d.id })))
    );
    const u2 = onSnapshot(collection(db, 'clubes', tenantId, 'personal_convenios'), (snap) =>
      setConvenios(snap.docs.map((d) => ({ ...d.data(), id: d.id })))
    );
    const u3 = onSnapshot(doc(db, 'clubes', tenantId, 'personal_config', 'costes'), (snap) => {
      if (snap.exists()) setCfgCostes({ ssPct: 31.5, ...snap.data() });
    });
    return () => { u1(); u2(); u3(); };
  }, [activo]);
  return { empleados, convenios, cfgCostes };
}

// Coste de empresa de un empleado: bruto anual + Seguridad Social a
// cargo de la empresa (% global configurable, con excepción por
// empleado). Devuelve null si no se ha informado el salario.
function costeEmpleado(emp, convenios, ssPctGlobal) {
  const bruto = Number(emp.salarioBrutoAnual || 0);
  if (!bruto) return null;
  const ssPct = emp.ssPctOverride !== '' && emp.ssPctOverride != null ? Number(emp.ssPctOverride) : Number(ssPctGlobal || 31.5);
  const anual = bruto * (1 + ssPct / 100);
  const horas = condicionesEfectivas(emp, convenios).horasAnuales;
  return { bruto, ssPct, anual, mensual: anual / 12, hora: horas > 0 ? anual / horas : null };
}

function antiguedadTexto(fechaAlta) {
  const f = aFecha(fechaAlta);
  if (!f) return '—';
  const meses = Math.max(0, Math.floor((Date.now() - f.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
  const a = Math.floor(meses / 12), m = meses % 12;
  return a > 0 ? `${a} año${a !== 1 ? 's' : ''}${m > 0 ? ` y ${m} mes${m !== 1 ? 'es' : ''}` : ''}` : `${m} mes${m !== 1 ? 'es' : ''}`;
}

function condicionesEfectivas(emp, convenios) {
  const conv = convenios.find((c) => c.id === emp.convenioId);
  const jornada = Number(emp.jornadaPct || 100) / 100;
  const horasBase = emp.horasAnualesOverride !== '' && emp.horasAnualesOverride != null
    ? Number(emp.horasAnualesOverride)
    : Number(conv?.horasAnuales || 0);
  const vacaciones = emp.diasVacacionesOverride !== '' && emp.diasVacacionesOverride != null
    ? Number(emp.diasVacacionesOverride)
    : Number(conv?.diasVacaciones || 0);
  return {
    convenio: conv || null,
    horasAnuales: Math.round(horasBase * jornada),
    diasVacaciones: vacaciones,
    tipoVacaciones: conv?.tipoVacaciones || 'naturales',
    asuntosPropios: Number(conv?.diasAsuntosPropios || 0),
  };
}

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a472a]/30';
const labelCls = 'block text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1';

function CampoP({ label, children }) {
  return <div className="mb-3"><label className={labelCls}>{label}</label>{children}</div>;
}

function ModalP({ titulo, onCerrar, children }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-[#1a472a]">{titulo}</h3>
          <button onClick={onCerrar} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

const EMPLEADO_VACIO = {
  nombre: '', dni: '', departamento: 'Mantenimiento', puesto: '', telefono: '', email: '',
  fechaAlta: '', tipoContrato: 'Indefinido', jornadaPct: 100, convenioId: '',
  horasAnualesOverride: '', diasVacacionesOverride: '',
  salarioBrutoAnual: '', ssPctOverride: '',
  estado: 'activo', notas: '',
  docs: { contrato: false, nominas: false, epis: false, prl: false },
};

function PersonalView() {
  const { empleados, convenios, cfgCostes } = usePersonal(true);
  const { tenantId } = useAuth();
  const [modalCostes, setModalCostes] = useState(false);
  const [formSsPct, setFormSsPct] = useState('');
  const [modalEmpleado, setModalEmpleado] = useState(null); // 'nuevo' | id
  const [formE, setFormE] = useState(EMPLEADO_VACIO);
  const [verConvenios, setVerConvenios] = useState(false);
  const [modalConvenio, setModalConvenio] = useState(null); // 'nuevo' | id
  const [formC, setFormC] = useState({});
  const [filtroDep, setFiltroDep] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('activo');
  const [busqueda, setBusqueda] = useState('');
  const [guardando, setGuardando] = useState(false);

  const activos = empleados.filter((e) => e.estado !== 'baja');
  const antigMedia = (() => {
    const fechas = activos.map((e) => aFecha(e.fechaAlta)).filter(Boolean);
    if (!fechas.length) return '—';
    const mesesMed = fechas.reduce((s, f) => s + (Date.now() - f.getTime()), 0) / fechas.length / (1000 * 60 * 60 * 24 * 30.44);
    return mesesMed >= 12 ? `${(mesesMed / 12).toFixed(1)} años` : `${Math.round(mesesMed)} meses`;
  })();

  const filtrados = empleados
    .filter((e) => (filtroEstado === 'todos' ? true : (e.estado || 'activo') === filtroEstado))
    .filter((e) => (filtroDep === 'todos' ? true : e.departamento === filtroDep))
    .filter((e) => (e.nombre || '').toLowerCase().includes(busqueda.toLowerCase()))
    .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

  function abrirNuevoEmpleado() { setFormE({ ...EMPLEADO_VACIO, convenioId: convenios[0]?.id || '' }); setModalEmpleado('nuevo'); }
  function abrirEditarEmpleado(e) { setFormE({ ...EMPLEADO_VACIO, ...e }); setModalEmpleado(e.id); }

  async function guardarEmpleado() {
    if (!formE.nombre.trim()) { alert('El nombre es obligatorio.'); return; }
    setGuardando(true);
    try {
      const datos = { ...formE };
      delete datos.id;
      if (modalEmpleado === 'nuevo') {
        await addDoc(collection(db, 'clubes', tenantId, 'personal_empleados'), { ...datos, creadoEn: new Date().toISOString() });
      } else {
        await updateDoc(doc(db, 'clubes', tenantId, 'personal_empleados', modalEmpleado), datos);
      }
      setModalEmpleado(null);
    } catch (e) { console.warn(e); alert('No se pudo guardar. Revisa la consola.'); }
    setGuardando(false);
  }

  async function eliminarEmpleado() {
    if (!confirm('¿Eliminar definitivamente esta ficha? Si el trabajador ha causado baja, es mejor cambiar su estado a "Baja" y conservar el histórico.')) return;
    try { await deleteDoc(doc(db, 'clubes', tenantId, 'personal_empleados', modalEmpleado)); setModalEmpleado(null); }
    catch (e) { console.warn(e); alert('No se pudo eliminar.'); }
  }

  function abrirNuevoConvenio() {
    setFormC({ nombre: '', horasAnuales: 1750, diasVacaciones: 30, tipoVacaciones: 'naturales', diasAsuntosPropios: 0, notas: '' });
    setModalConvenio('nuevo');
  }
  function abrirEditarConvenio(c) { setFormC({ ...c }); setModalConvenio(c.id); }

  async function guardarConvenio() {
    if (!formC.nombre?.trim()) { alert('El nombre del convenio es obligatorio.'); return; }
    setGuardando(true);
    try {
      const datos = { ...formC }; delete datos.id;
      if (modalConvenio === 'nuevo') await addDoc(collection(db, 'clubes', tenantId, 'personal_convenios'), datos);
      else await updateDoc(doc(db, 'clubes', tenantId, 'personal_convenios', modalConvenio), datos);
      setModalConvenio(null);
    } catch (e) { console.warn(e); alert('No se pudo guardar el convenio.'); }
    setGuardando(false);
  }

  async function eliminarConvenio(c) {
    const enUso = empleados.filter((e) => e.convenioId === c.id).length;
    if (enUso > 0) { alert(`No se puede eliminar: ${enUso} trabajador(es) tienen asignado este convenio. Reasígnalos primero.`); return; }
    if (!confirm(`¿Eliminar el convenio "${c.nombre}"?`)) return;
    try { await deleteDoc(doc(db, 'clubes', tenantId, 'personal_convenios', c.id)); } catch (e) { console.warn(e); }
  }

  async function crearConveniosEjemplo() {
    setGuardando(true);
    try { for (const c of CONVENIOS_EJEMPLO) await addDoc(collection(db, 'clubes', tenantId, 'personal_convenios'), c); }
    catch (e) { console.warn(e); }
    setGuardando(false);
  }

  const depColor = (d) => DEPARTAMENTOS.find((x) => x.id === d)?.color || '#666';

  return (
    <div className="mb-10">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#d4af37] mb-1">Recursos humanos</p>
          <h2 className="text-xl font-semibold text-[#1a472a]">Personal del club</h2>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setVerConvenios(true)}
            className="bg-white border border-gray-200 hover:border-[#1a472a]/40 text-[#1a472a] text-sm px-4 py-2 rounded-lg transition">
            ⚖️ Convenios
          </button>
          <button onClick={abrirNuevoEmpleado}
            className="bg-[#1a472a] hover:bg-[#143a22] text-white text-sm px-4 py-2 rounded-lg transition">
            + Añadir trabajador
          </button>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatMini label="Plantilla activa" valor={activos.length}
          sub={empleados.length - activos.length > 0 ? `${empleados.length - activos.length} en baja` : 'Sin bajas'} color="#1a472a" />
        {DEPARTAMENTOS.slice(0, 3).map((d) => (
          <StatMini key={d.id} label={d.id} valor={activos.filter((e) => e.departamento === d.id).length}
            sub="trabajadores" color={d.color} />
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatMini label="Academia" valor={activos.filter((e) => e.departamento === 'Academia').length} sub="trabajadores" color="#1a472a" />
        <StatMini label="Antigüedad media" valor={antigMedia} sub="plantilla activa" color="#b8863c" />
        <StatMini label="Convenios" valor={convenios.length} sub="configurados" color="#2d5a3d" />
        <StatMini label="Jornada media" valor={activos.length ? Math.round(activos.reduce((s, e) => s + Number(e.jornadaPct || 100), 0) / activos.length) + '%' : '—'} sub="de la plantilla" color="#8c1c1c" />
      </div>

      {/* ── Coste de plantilla (solo superadmin ve esta pantalla) ── */}
      {(() => {
        const conCoste = activos.map((e) => ({ e, c: costeEmpleado(e, convenios, cfgCostes.ssPct) })).filter((x) => x.c);
        const anual = conCoste.reduce((s, x) => s + x.c.anual, 0);
        const porDept = {};
        conCoste.forEach((x) => { porDept[x.e.departamento] = (porDept[x.e.departamento] || 0) + x.c.anual; });
        const horasVal = conCoste.map((x) => x.c.hora).filter(Boolean);
        const horaMedia = horasVal.length ? horasVal.reduce((s, h) => s + h, 0) / horasVal.length : 0;
        const eur = (n) => Number(n || 0).toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €';
        return (
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5 mb-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <p className="text-sm font-semibold text-[#1a472a]">💶 Coste de plantilla (empresa)</p>
              <button onClick={() => { setFormSsPct(String(cfgCostes.ssPct)); setModalCostes(true); }}
                className="text-xs text-[#1a472a] border border-gray-200 rounded-lg px-3 py-1.5 hover:border-[#1a472a]/40">
                ⚙️ Seg. Social: {cfgCostes.ssPct}%
              </button>
            </div>
            {conCoste.length === 0 ? (
              <p className="text-xs text-gray-400">Introduce el salario bruto anual en las fichas para calcular el coste de empresa (bruto + {cfgCostes.ssPct}% de SS), el coste mensual y el coste por hora según el convenio de cada trabajador.</p>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div><p className="text-[11px] uppercase tracking-wider text-gray-400">Anual</p><p className="text-xl font-bold text-[#1a472a]">{eur(anual)}</p></div>
                <div><p className="text-[11px] uppercase tracking-wider text-gray-400">Mensual</p><p className="text-xl font-bold text-[#1a472a]">{eur(anual / 12)}</p></div>
                <div><p className="text-[11px] uppercase tracking-wider text-gray-400">Coste/hora medio</p><p className="text-xl font-bold text-[#b8863c]">{horaMedia ? horaMedia.toLocaleString('es-ES', { maximumFractionDigits: 2 }) + ' €' : '—'}</p></div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-gray-400">Por departamento</p>
                  {Object.entries(porDept).sort((a, b) => b[1] - a[1]).map(([d, v]) => (
                    <p key={d} className="text-xs text-gray-600">{d}: <b>{eur(v)}</b></p>
                  ))}
                </div>
              </div>
            )}
            {conCoste.length > 0 && conCoste.length < activos.length && (
              <p className="text-[11px] text-amber-600 mt-3">⚠️ {activos.length - conCoste.length} trabajador(es) activos sin salario informado — el total es parcial.</p>
            )}
          </div>
        );
      })()}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input placeholder="🔍 Buscar por nombre…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-56 bg-white" />
        <select value={filtroDep} onChange={(e) => setFiltroDep(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="todos">Todos los departamentos</option>
          {DEPARTAMENTOS.map((d) => <option key={d.id} value={d.id}>{d.id}</option>)}
        </select>
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="activo">Activos</option>
          <option value="baja">En baja</option>
          <option value="todos">Todos</option>
        </select>
      </div>

      {/* Lista */}
      {filtrados.length === 0 && (
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-8 text-center text-sm text-gray-400">
          {empleados.length === 0 ? 'Todavía no hay trabajadores registrados. Añade el primero con el botón de arriba.' : 'Ningún trabajador coincide con el filtro.'}
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {filtrados.map((e) => {
          const cond = condicionesEfectivas(e, convenios);
          return (
            <button key={e.id} onClick={() => abrirEditarEmpleado(e)}
              className="text-left bg-white rounded-2xl border border-black/5 shadow-sm hover:shadow-md transition p-4 flex gap-4 items-start">
              <span className="w-1.5 self-stretch rounded-full" style={{ background: depColor(e.departamento) }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-[#1a472a] truncate">{e.nombre}</p>
                  {e.estado === 'baja'
                    ? <span className="text-[10px] font-bold uppercase bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">Baja</span>
                    : <span className="text-[10px] font-bold uppercase rounded-full px-2 py-0.5 text-white" style={{ background: depColor(e.departamento) }}>{e.departamento}</span>}
                </div>
                <p className="text-xs text-gray-500 truncate">{e.puesto || 'Sin puesto definido'}{e.fechaAlta ? ` · ${antiguedadTexto(e.fechaAlta)} de antigüedad` : ''}</p>
                <p className="text-xs text-gray-400 mt-1 truncate">
                  {cond.convenio ? cond.convenio.nombre : '⚠️ Sin convenio asignado'}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  ⏱ {cond.horasAnuales || '—'} h/año{Number(e.jornadaPct || 100) !== 100 ? ` (jornada ${e.jornadaPct}%)` : ''} · 🏖 {cond.diasVacaciones || '—'} días {cond.tipoVacaciones}
                  {(e.horasAnualesOverride || e.diasVacacionesOverride) ? ' · condiciones pactadas' : ''}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Modal trabajador ── */}
      {modalEmpleado && (
        <ModalP titulo={modalEmpleado === 'nuevo' ? 'Nuevo trabajador' : 'Ficha de ' + (formE.nombre || 'trabajador')} onCerrar={() => setModalEmpleado(null)}>
          <div className="grid grid-cols-2 gap-x-4">
            <div className="col-span-2"><CampoP label="Nombre completo *"><input className={inputCls} value={formE.nombre} onChange={(e) => setFormE({ ...formE, nombre: e.target.value })} /></CampoP></div>
            <CampoP label="DNI / NIE"><input className={inputCls} value={formE.dni} onChange={(e) => setFormE({ ...formE, dni: e.target.value })} /></CampoP>
            <CampoP label="Departamento">
              <select className={inputCls} value={formE.departamento} onChange={(e) => setFormE({ ...formE, departamento: e.target.value })}>
                {DEPARTAMENTOS.map((d) => <option key={d.id} value={d.id}>{d.id}</option>)}
              </select>
            </CampoP>
            <div className="col-span-2"><CampoP label="Puesto"><input className={inputCls} placeholder="p. ej. Oficial jardinero, Recepcionista…" value={formE.puesto} onChange={(e) => setFormE({ ...formE, puesto: e.target.value })} /></CampoP></div>
            <CampoP label="Teléfono"><input className={inputCls} value={formE.telefono} onChange={(e) => setFormE({ ...formE, telefono: e.target.value })} /></CampoP>
            <CampoP label="Email"><input className={inputCls} value={formE.email} onChange={(e) => setFormE({ ...formE, email: e.target.value })} /></CampoP>
            <CampoP label="Fecha de alta"><input type="date" className={inputCls} value={formE.fechaAlta} onChange={(e) => setFormE({ ...formE, fechaAlta: e.target.value })} /></CampoP>
            <CampoP label="Tipo de contrato">
              <select className={inputCls} value={formE.tipoContrato} onChange={(e) => setFormE({ ...formE, tipoContrato: e.target.value })}>
                {TIPOS_CONTRATO.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </CampoP>
            <CampoP label="Jornada (%)"><input type="number" min="1" max="100" className={inputCls} value={formE.jornadaPct} onChange={(e) => setFormE({ ...formE, jornadaPct: e.target.value })} /></CampoP>
            <CampoP label="Estado">
              <select className={inputCls} value={formE.estado} onChange={(e) => setFormE({ ...formE, estado: e.target.value })}>
                <option value="activo">Activo</option><option value="baja">Baja</option>
              </select>
            </CampoP>
            <div className="col-span-2">
              <CampoP label="Convenio colectivo">
                <select className={inputCls} value={formE.convenioId} onChange={(e) => setFormE({ ...formE, convenioId: e.target.value })}>
                  <option value="">— Sin convenio —</option>
                  {convenios.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
                {convenios.length === 0 && <p className="text-xs text-amber-600 mt-1">No hay convenios creados todavía — créalos desde el botón ⚖️ Convenios.</p>}
              </CampoP>
            </div>
            <CampoP label="Horas/año (excepción)"><input type="number" className={inputCls} placeholder="Hereda del convenio" value={formE.horasAnualesOverride} onChange={(e) => setFormE({ ...formE, horasAnualesOverride: e.target.value })} /></CampoP>
            <CampoP label="Días vacaciones (excepción)"><input type="number" className={inputCls} placeholder="Hereda del convenio" value={formE.diasVacacionesOverride} onChange={(e) => setFormE({ ...formE, diasVacacionesOverride: e.target.value })} /></CampoP>
            <CampoP label="Salario bruto anual (€)"><input type="number" className={inputCls} placeholder="Solo lo ves tú" value={formE.salarioBrutoAnual} onChange={(e) => setFormE({ ...formE, salarioBrutoAnual: e.target.value })} /></CampoP>
            <CampoP label="% SS empresa (excepción)"><input type="number" step="0.1" className={inputCls} placeholder={`Global: ${cfgCostes.ssPct}%`} value={formE.ssPctOverride} onChange={(e) => setFormE({ ...formE, ssPctOverride: e.target.value })} /></CampoP>
            <div className="col-span-2">
              <CampoP label="Documentación entregada">
                <div className="flex flex-wrap gap-3 text-sm">
                  {[['contrato', 'Contrato firmado'], ['nominas', 'Nóminas al día'], ['epis', 'EPIs entregados'], ['prl', 'Formación PRL']].map(([k, l]) => (
                    <label key={k} className="flex items-center gap-1.5 text-gray-600">
                      <input type="checkbox" checked={!!formE.docs?.[k]} onChange={(e) => setFormE({ ...formE, docs: { ...formE.docs, [k]: e.target.checked } })} />
                      {l}
                    </label>
                  ))}
                </div>
              </CampoP>
            </div>
            <div className="col-span-2"><CampoP label="Notas"><textarea rows="2" className={inputCls} value={formE.notas} onChange={(e) => setFormE({ ...formE, notas: e.target.value })} /></CampoP></div>
          </div>
          {(() => {
            const cond = condicionesEfectivas(formE, convenios);
            const coste = costeEmpleado(formE, convenios, cfgCostes.ssPct);
            return (
              <div className="bg-[#f8faf9] border border-[#1a472a]/10 rounded-xl px-4 py-3 text-xs text-gray-600 mb-4">
                <b className="text-[#1a472a]">Condiciones efectivas:</b> {cond.horasAnuales || '—'} h/año · {cond.diasVacaciones || '—'} días de vacaciones ({cond.tipoVacaciones}){cond.asuntosPropios ? ` · ${cond.asuntosPropios} de asuntos propios` : ''}
                {coste && (
                  <div className="mt-1.5 pt-1.5 border-t border-[#1a472a]/10">
                    <b className="text-[#1a472a]">Coste de empresa:</b> {coste.anual.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €/año ({coste.mensual.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €/mes) con SS al {coste.ssPct}%{coste.hora ? ` · ${coste.hora.toLocaleString('es-ES', { maximumFractionDigits: 2 })} €/hora` : ''}
                  </div>
                )}
              </div>
            );
          })()}
          <div className="flex items-center justify-between">
            {modalEmpleado !== 'nuevo'
              ? <button onClick={eliminarEmpleado} className="text-red-600 text-sm hover:underline">Eliminar ficha</button>
              : <span />}
            <div className="flex gap-2">
              <button onClick={() => setModalEmpleado(null)} className="border border-gray-200 text-gray-600 text-sm px-4 py-2 rounded-lg">Cancelar</button>
              <button onClick={guardarEmpleado} disabled={guardando} className="bg-[#1a472a] text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50">{guardando ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </ModalP>
      )}

      {/* ── Modal convenios ── */}
      {verConvenios && (
        <ModalP titulo="Convenios colectivos" onCerrar={() => setVerConvenios(false)}>
          <p className="text-xs text-gray-500 mb-4">
            Define aquí los convenios y sus condiciones. Cada trabajador hereda las horas anuales y vacaciones del convenio que le asignes en su ficha, salvo excepción individual.
          </p>
          {convenios.length === 0 && (
            <div className="text-center mb-4">
              <p className="text-sm text-gray-400 mb-3">No hay convenios todavía.</p>
              <button onClick={crearConveniosEjemplo} disabled={guardando}
                className="bg-[#b8863c] text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50">
                Crear los 2 convenios de partida (Instalaciones Deportivas y Jardinería)
              </button>
            </div>
          )}
          <div className="space-y-2 mb-4">
            {convenios.map((c) => (
              <div key={c.id} className="border border-gray-100 rounded-xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-sm text-[#1a472a]">{c.nombre}</p>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => abrirEditarConvenio(c)} className="text-xs text-[#1a472a] hover:underline">Editar</button>
                    <button onClick={() => eliminarConvenio(c)} className="text-xs text-red-500 hover:underline">Eliminar</button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  ⏱ {c.horasAnuales} h/año · 🏖 {c.diasVacaciones} días {c.tipoVacaciones}{Number(c.diasAsuntosPropios) > 0 ? ` · ${c.diasAsuntosPropios} asuntos propios` : ''} · {empleados.filter((e) => e.convenioId === c.id).length} trabajador(es)
                </p>
                {c.notas && <p className="text-[11px] text-amber-600 mt-1">{c.notas}</p>}
              </div>
            ))}
          </div>
          <button onClick={abrirNuevoConvenio} className="w-full border border-dashed border-gray-300 text-gray-500 text-sm px-4 py-2 rounded-lg hover:border-[#1a472a]/40 hover:text-[#1a472a]">
            + Añadir convenio
          </button>
        </ModalP>
      )}

      {/* ── Modal editar/crear convenio ── */}
      {modalConvenio && (
        <ModalP titulo={modalConvenio === 'nuevo' ? 'Nuevo convenio' : 'Editar convenio'} onCerrar={() => setModalConvenio(null)}>
          <CampoP label="Nombre del convenio *"><input className={inputCls} value={formC.nombre || ''} onChange={(e) => setFormC({ ...formC, nombre: e.target.value })} /></CampoP>
          <div className="grid grid-cols-2 gap-x-4">
            <CampoP label="Horas anuales"><input type="number" className={inputCls} value={formC.horasAnuales || ''} onChange={(e) => setFormC({ ...formC, horasAnuales: e.target.value })} /></CampoP>
            <CampoP label="Días de vacaciones"><input type="number" className={inputCls} value={formC.diasVacaciones || ''} onChange={(e) => setFormC({ ...formC, diasVacaciones: e.target.value })} /></CampoP>
            <CampoP label="Tipo de días">
              <select className={inputCls} value={formC.tipoVacaciones || 'naturales'} onChange={(e) => setFormC({ ...formC, tipoVacaciones: e.target.value })}>
                <option value="naturales">Naturales</option><option value="laborables">Laborables</option>
              </select>
            </CampoP>
            <CampoP label="Días asuntos propios"><input type="number" className={inputCls} value={formC.diasAsuntosPropios || 0} onChange={(e) => setFormC({ ...formC, diasAsuntosPropios: e.target.value })} /></CampoP>
          </div>
          <CampoP label="Notas (pluses, jornada máxima…)"><textarea rows="2" className={inputCls} value={formC.notas || ''} onChange={(e) => setFormC({ ...formC, notas: e.target.value })} /></CampoP>
          <div className="flex justify-end gap-2">
            <button onClick={() => setModalConvenio(null)} className="border border-gray-200 text-gray-600 text-sm px-4 py-2 rounded-lg">Cancelar</button>
            <button onClick={guardarConvenio} disabled={guardando} className="bg-[#1a472a] text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50">{guardando ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </ModalP>
      )}

      {/* ── Modal configuración de costes ── */}
      {modalCostes && (
        <ModalP titulo="Configurar costes de personal" onCerrar={() => setModalCostes(false)}>
          <CampoP label="% de Seguridad Social a cargo de la empresa">
            <input type="number" step="0.1" className={inputCls} value={formSsPct} onChange={(e) => setFormSsPct(e.target.value)} />
          </CampoP>
          <p className="text-xs text-gray-500 mb-4">
            Se aplica sobre el salario bruto para estimar el coste de empresa (en España suele rondar el 30–33% según contingencias). Puedes fijar una excepción por trabajador en su ficha. Cuando tengas el coste exacto de las nóminas, ajusta este porcentaje para que el total cuadre.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setModalCostes(false)} className="border border-gray-200 text-gray-600 text-sm px-4 py-2 rounded-lg">Cancelar</button>
            <button onClick={async () => {
              try { await setDoc(doc(db, 'clubes', tenantId, 'personal_config', 'costes'), { ssPct: Number(formSsPct) || 31.5 }); setModalCostes(false); }
              catch (e) { console.warn(e); alert('No se pudo guardar.'); }
            }} className="bg-[#1a472a] text-white text-sm px-4 py-2 rounded-lg">Guardar</button>
          </div>
        </ModalP>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// FICHAJES — Vista unificada de todo el club
// Combina los fichajes de Mantenimiento (eventos entrada/salida en
// mant_fichajes) y de Recepción/Proshop (sesiones con entrada/salida
// en proshop_fichajes), normalizados a "jornadas" para verlos juntos.
// No modifica ningún dato: solo lee ambas fuentes.
// ═══════════════════════════════════════════════════════════════════
function normalizarJornadas(fichajesMant, fichajesProshop) {
  const jornadas = [];
  // Mantenimiento: eventos sueltos → emparejar entrada con la siguiente salida
  const porEmpleado = {};
  fichajesMant.forEach((f) => {
    const m = aFecha(f.momento);
    if (!m || !f.empleado) return;
    (porEmpleado[f.empleado] = porEmpleado[f.empleado] || []).push({ tipo: f.tipo, momento: m });
  });
  Object.entries(porEmpleado).forEach(([nombre, evs]) => {
    evs.sort((a, b) => a.momento - b.momento);
    let abierta = null;
    evs.forEach((ev) => {
      if (ev.tipo === 'entrada') {
        if (abierta) jornadas.push({ nombre, dept: 'Mantenimiento', entrada: abierta, salida: null });
        abierta = ev.momento;
      } else if (ev.tipo === 'salida' && abierta) {
        jornadas.push({ nombre, dept: 'Mantenimiento', entrada: abierta, salida: ev.momento });
        abierta = null;
      }
    });
    if (abierta) jornadas.push({ nombre, dept: 'Mantenimiento', entrada: abierta, salida: null });
  });
  // Recepción/Proshop: ya vienen como sesiones
  fichajesProshop.forEach((f) => {
    const e = aFecha(f.entrada);
    if (!e || !f.empleadoNombre) return;
    jornadas.push({ nombre: f.empleadoNombre, dept: 'Recepción', entrada: e, salida: aFecha(f.salida) });
  });
  return jornadas.sort((a, b) => b.entrada - a.entrada);
}

function horasDe(j) {
  const fin = j.salida || new Date();
  return Math.max(0, (fin - j.entrada) / 3600000);
}
function fmtHoras(h) {
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  return `${hh}h ${String(mm).padStart(2, '0')}m`;
}

function FichajesGlobal() {
  const { personalActivo, fichajes, fichajesProshop } = useDatosGlobales(true);
  const { empleados, convenios, cfgCostes } = usePersonal(true);
  const [rango, setRango] = useState('hoy'); // hoy | semana | mes
  const [filtroDept, setFiltroDept] = useState('todos');

  // Coste/hora por nombre (si la ficha tiene salario informado)
  const costeHoraPorNombre = {};
  empleados.forEach((e) => {
    const c = costeEmpleado(e, convenios, cfgCostes.ssPct);
    if (c?.hora) costeHoraPorNombre[(e.nombre || '').trim().toLowerCase()] = c.hora;
  });
  const costeDe = (nombre, horas) => {
    const ch = costeHoraPorNombre[(nombre || '').trim().toLowerCase()];
    return ch ? ch * horas : null;
  };

  const jornadas = normalizarJornadas(fichajes, fichajesProshop);

  const ahora = new Date();
  const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const inicioSemana = new Date(inicioHoy); inicioSemana.setDate(inicioHoy.getDate() - ((inicioHoy.getDay() + 6) % 7));
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const desde = rango === 'hoy' ? inicioHoy : rango === 'semana' ? inicioSemana : inicioMes;

  const enRango = jornadas
    .filter((j) => j.entrada >= desde)
    .filter((j) => (filtroDept === 'todos' ? true : j.dept === filtroDept));

  // Totales por persona en el rango
  const totales = {};
  enRango.forEach((j) => {
    totales[j.nombre] = totales[j.nombre] || { horas: 0, dept: j.dept, jornadas: 0 };
    totales[j.nombre].horas += horasDe(j);
    totales[j.nombre].jornadas += 1;
  });
  const listaTotales = Object.entries(totales).sort((a, b) => b[1].horas - a[1].horas);
  const horasTotales = listaTotales.reduce((s, [, v]) => s + v.horas, 0);

  const colorDept = (d) => (d === 'Mantenimiento' ? '#2d5a3d' : '#8c1c1c');

  return (
    <div className="mb-10">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#d4af37] mb-1">Control de jornada</p>
          <h2 className="text-xl font-semibold text-[#1a472a]">Fichajes de todo el club</h2>
        </div>
        <div className="flex gap-2">
          {[['hoy', 'Hoy'], ['semana', 'Esta semana'], ['mes', 'Este mes']].map(([id, l]) => (
            <button key={id} onClick={() => setRango(id)}
              className={`text-sm px-3 py-1.5 rounded-lg transition ${rango === id ? 'bg-[#1a472a] text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatMini label="Trabajando ahora" valor={personalActivo.length}
          sub={personalActivo.length ? personalActivo.map((p) => p.nombre.split(' ')[0]).join(', ') : 'Nadie fichado'} color="#1a472a" />
        <StatMini label={`Horas (${rango === 'hoy' ? 'hoy' : rango === 'semana' ? 'semana' : 'mes'})`} valor={fmtHoras(horasTotales)} sub="todo el club" color="#b8863c" />
        <StatMini label="Mantenimiento" valor={fmtHoras(listaTotales.filter(([, v]) => v.dept === 'Mantenimiento').reduce((s, [, v]) => s + v.horas, 0))} sub="en el periodo" color="#2d5a3d" />
        <StatMini label="Recepción" valor={fmtHoras(listaTotales.filter(([, v]) => v.dept === 'Recepción').reduce((s, [, v]) => s + v.horas, 0))} sub="en el periodo" color="#8c1c1c" />
      </div>

      {/* Trabajando ahora */}
      <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5 mb-5">
        <p className="text-sm font-semibold text-[#1a472a] mb-3">🟢 En jornada ahora mismo</p>
        {personalActivo.length === 0 && <p className="text-xs text-gray-400">Nadie fichado en este momento.</p>}
        <div className="flex flex-wrap gap-2">
          {personalActivo.map((p) => (
            <span key={p.nombre} className="inline-flex items-center gap-2 text-sm bg-gray-50 border border-gray-100 rounded-full pl-2 pr-3 py-1">
              <span className="w-2 h-2 rounded-full" style={{ background: colorDept(p.dept || 'Mantenimiento') }} />
              <span className="text-gray-700">{p.nombre}</span>
              <span className="text-gray-400 text-xs">desde {p.entrada.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Totales por persona */}
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5">
          <p className="text-sm font-semibold text-[#1a472a] mb-3">Horas por persona</p>
          {listaTotales.length === 0 && <p className="text-xs text-gray-400">Sin fichajes en el periodo.</p>}
          <div className="space-y-2">
            {listaTotales.map(([nombre, v]) => {
              const coste = costeDe(nombre, v.horas);
              return (
                <div key={nombre} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: colorDept(v.dept) }} />
                    <span className="truncate">{nombre}</span>
                  </span>
                  <span className="text-gray-500 text-xs flex-shrink-0">{fmtHoras(v.horas)} · {v.jornadas} jorn.{coste ? ` · ~${coste.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €` : ''}</span>
                </div>
              );
            })}
          </div>
          {(() => {
            const total = listaTotales.reduce((s, [n, v]) => s + (costeDe(n, v.horas) || 0), 0);
            return total > 0 ? (
              <p className="text-xs text-gray-500 mt-3 pt-2 border-t border-gray-100">
                Coste estimado del periodo: <b className="text-[#1a472a]">{total.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €</b> <span className="text-gray-400">(horas fichadas × coste/hora de cada ficha)</span>
              </p>
            ) : null;
          })()}
        </div>

        {/* Registro de jornadas */}
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-[#1a472a]">Registro de jornadas</p>
            <select value={filtroDept} onChange={(e) => setFiltroDept(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white">
              <option value="todos">Todos</option>
              <option value="Mantenimiento">Mantenimiento</option>
              <option value="Recepción">Recepción</option>
            </select>
          </div>
          {enRango.length === 0 && <p className="text-xs text-gray-400">Sin jornadas en el periodo.</p>}
          <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
            {enRango.slice(0, 120).map((j, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0 gap-2">
                <span className="text-gray-700 flex items-center gap-2 min-w-0">
                  <span className="text-[9px] font-bold uppercase rounded px-1.5 py-0.5 text-white flex-shrink-0" style={{ background: colorDept(j.dept) }}>{j.dept === 'Mantenimiento' ? 'MANT' : 'RECEP'}</span>
                  <span className="truncate">{j.nombre}</span>
                </span>
                <span className="text-gray-400 text-xs flex-shrink-0">
                  {j.entrada.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })} · {j.entrada.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} → {j.salida ? j.salida.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '🟢 abierta'} · {fmtHoras(horasDe(j))}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminOverview() {
  const { clasesHoy, minutosHoy, totalVentasHoy, totalGastosHoy, personalActivo, tareasPendientes } =
    useDatosGlobales(true);

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#d4af37] mb-1">Panel de mando · hoy</p>
          <h2 className="text-xl font-semibold text-[#1a472a]">Vista global del club</h2>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatMini
          label="Clases hoy"
          valor={clasesHoy.length}
          sub={minutosHoy > 0 ? `${Math.round(minutosHoy / 60 * 10) / 10} h de clase` : 'Sin clases'}
          color="#1a472a"
        />
        <StatMini label="Ventas hoy" valor={euros(totalVentasHoy)} sub="Proshop" color="#8c1c1c" />
        <StatMini label="Gastos hoy" valor={euros(totalGastosHoy)} sub="Finanzas" color="#b8863c" />
        <StatMini
          label="Personal trabajando"
          valor={personalActivo.length}
          sub={personalActivo.length > 0 ? 'Ahora mismo' : 'Nadie fichado'}
          color="#2d5a3d"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5 lg:col-span-1">
          <p className="text-sm font-semibold text-[#1a472a] mb-3">Clases de hoy</p>
          {clasesHoy.length === 0 && <p className="text-xs text-gray-400">Sin clases programadas hoy.</p>}
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {clasesHoy.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{c.alumnoNombre || 'Sin asignar'}</span>
                <span className="text-gray-400 text-xs">{c.horaInicio}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5 lg:col-span-1">
          <p className="text-sm font-semibold text-[#1a472a] mb-3">Personal trabajando ahora</p>
          {personalActivo.length === 0 && <p className="text-xs text-gray-400">Nadie fichado en este momento.</p>}
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {personalActivo.map((p) => (
              <div key={p.nombre} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: p.dept === 'Recepción' ? '#8c1c1c' : '#22c55e' }} />
                  {p.nombre}
                </span>
                <span className="text-gray-400 text-xs">
                  desde {p.entrada.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5 lg:col-span-1">
          <p className="text-sm font-semibold text-[#1a472a] mb-3">Tareas de mantenimiento pendientes</p>
          {tareasPendientes.length === 0 && <p className="text-xs text-gray-400">No hay tareas pendientes.</p>}
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {tareasPendientes.slice(0, 6).map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm gap-2">
                <span className="text-gray-700 truncate">{t.titulo}</span>
                <span className="text-gray-400 text-xs flex-shrink-0">{t.fechaLimite || 'Sin fecha'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AppCard({ app }) {
  return (
    <a
      href={app.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-200 overflow-hidden border border-black/5 hover:-translate-y-1"
    >
      <div
        className="h-2"
        style={{ backgroundColor: app.color }}
      />
      <div className="p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-[#1a472a]">{app.name}</h3>
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: app.color }}
          />
        </div>
        <p className="text-sm text-gray-500">{app.desc}</p>
        <div className="mt-4 text-sm font-medium text-[#d4af37] group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
          Entrar →
        </div>
      </div>
    </a>
  );
}

// ─── Superadmin: qué apps ve cada club según lo contratado ─────────────
const TODOS_LOS_MODULOS = [
  { id: 'academia', label: 'Academia', icon: '⛳' },
  { id: 'mantenimiento', label: 'Mantenimiento', icon: '🌱' },
  { id: 'proshop', label: 'Proshop', icon: '🛒' },
  { id: 'finanzas', label: 'Finanzas', icon: '💶' },
];

function PanelClubes() {
  const [clubes, setClubes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'clubes'), (snap) => {
      setClubes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setCargando(false);
    });
    return unsub;
  }, []);

  async function toggleModulo(clubId, moduloId, valorActual) {
    const key = `${clubId}-${moduloId}`;
    setGuardando(key);
    try {
      const club = clubes.find((c) => c.id === clubId);
      const modulosPrevios = club?.modulosActivos || {};
      await setDoc(
        doc(db, 'clubes', clubId),
        { modulosActivos: { ...modulosPrevios, [moduloId]: !valorActual } },
        { merge: true }
      );
    } catch (e) {
      console.error('Error al actualizar módulo:', e);
      alert('No se pudo guardar el cambio. Inténtalo de nuevo.');
    } finally {
      setGuardando(null);
    }
  }

  if (cargando) {
    return <p className="text-gray-400 text-sm">Cargando clubes…</p>;
  }

  return (
    <div className="mb-10">
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#d4af37] mb-1">Superadmin</p>
        <h2 className="text-xl font-semibold text-[#1a472a]">Clubes y módulos contratados</h2>
        <p className="text-sm text-gray-500 mt-1">
          Activa o desactiva qué aplicaciones ve cada club según lo que tenga contratado.
        </p>
      </div>

      <div className="space-y-4">
        {clubes.map((club) => {
          const modulosActivosClub = club.modulosActivos || {};
          return (
            <div key={club.id} className="bg-white rounded-2xl border border-black/5 shadow-sm p-5">
              <p className="text-sm font-semibold text-[#1a472a] mb-1">{club.nombre || club.id}</p>
              <p className="text-xs text-gray-400 mb-4">ID: {club.id}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {TODOS_LOS_MODULOS.map((mod) => {
                  const activo = modulosActivosClub[mod.id] !== false; // activo por defecto si no existe el campo
                  const key = `${club.id}-${mod.id}`;
                  return (
                    <button
                      key={mod.id}
                      onClick={() => toggleModulo(club.id, mod.id, activo)}
                      disabled={guardando === key}
                      className={`flex items-center justify-between gap-2 text-sm px-3 py-2 rounded-lg border transition ${
                        activo
                          ? 'bg-[#1a472a]/5 border-[#1a472a]/30 text-[#1a472a]'
                          : 'bg-gray-50 border-gray-200 text-gray-400'
                      }`}
                    >
                      <span>{mod.icon} {mod.label}</span>
                      <span className="text-xs font-semibold">
                        {guardando === key ? '…' : activo ? 'ON' : 'OFF'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {clubes.length === 0 && (
          <p className="text-sm text-gray-400">No hay clubes dados de alta en Firestore todavía.</p>
        )}
      </div>
    </div>
  );
}

// ─── Necesidades (compartida entre Recepcion, Mantenimiento y Master) ─
function NecesidadesView() {
  const { tenantId, currentUser } = useAuth();
  const [necesidades, setNecesidades] = useState([]);
  const [modalNueva, setModalNueva] = useState(false);
  const [texto, setTexto] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'clubes', tenantId, 'necesidades'), (snap) =>
      setNecesidades(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => unsub();
  }, [tenantId]);

  function msDeFecha(v) {
    if (!v) return 0;
    if (typeof v === 'string') return new Date(v).getTime() || 0;
    if (typeof v.toDate === 'function') return v.toDate().getTime();
    if (typeof v.seconds === 'number') return v.seconds * 1000;
    return 0;
  }
  const ordenadas = [...necesidades].sort((a, b) => msDeFecha(b.creadoEn) - msDeFecha(a.creadoEn));
  const pendientes = ordenadas.filter((n) => !n.completada);
  const completadas = ordenadas.filter((n) => n.completada);
  const nombreDireccion = currentUser?.email?.split('@')[0] || 'Direccion';

  async function crearNecesidad() {
    if (!texto.trim()) { alert('Escribe la necesidad.'); return; }
    await addDoc(collection(db, 'clubes', tenantId, 'necesidades'), {
      texto: texto.trim(), creadoPor: nombreDireccion, origen: 'Direccion', creadoEn: new Date().toISOString(),
    });
    setTexto('');
    setModalNueva(false);
  }
  async function marcarCompletada(n) {
    await updateDoc(doc(db, 'clubes', tenantId, 'necesidades', n.id), {
      completada: true, completadaPor: nombreDireccion, completadaEn: new Date().toISOString(),
    });
  }
  async function destacharNecesidad(n) {
    if (!confirm('Quitar el tachado de esta necesidad?')) return;
    await updateDoc(doc(db, 'clubes', tenantId, 'necesidades', n.id), {
      completada: false, completadaPor: null, completadaEn: null,
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-[#1a472a]">Necesidades</h2>
          <p className="text-gray-500 text-sm mt-1">Peticiones compartidas entre Recepcion, Mantenimiento y Direccion.</p>
        </div>
        <button onClick={() => { setTexto(''); setModalNueva(true); }}
          className="bg-[#1a472a] hover:bg-[#143620] text-white text-sm font-medium px-4 py-2.5 rounded-lg transition">
          + Nueva necesidad
        </button>
      </div>

      <div className="space-y-2 mb-8">
        {pendientes.length === 0 && <p className="text-sm text-gray-400">No hay necesidades pendientes.</p>}
        {pendientes.map((n) => (
          <div key={n.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
            <button onClick={() => marcarCompletada(n)} className="mt-0.5 w-5 h-5 rounded border-2 border-[#1a472a] flex-shrink-0" aria-label="Marcar como cubierta" />
            <div>
              <p className="text-sm font-medium text-gray-800">{n.texto}</p>
              <p className="text-xs text-gray-400 mt-0.5">Pedido por {n.creadoPor || '?'} · {n.origen}</p>
            </div>
          </div>
        ))}
      </div>

      {completadas.length > 0 && (
        <>
          <p className="text-sm font-medium text-gray-600 mb-3">Cubiertas</p>
          <div className="space-y-2">
            {completadas.map((n) => (
              <div key={n.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3 opacity-60">
                <div className="mt-0.5 w-5 h-5 rounded bg-[#1a472a] flex items-center justify-center flex-shrink-0 text-white text-xs">✓</div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-500 line-through">{n.texto}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Pedido por {n.creadoPor || '?'} · {n.origen} — Cubierto por {n.completadaPor || '?'}</p>
                </div>
                <button onClick={() => destacharNecesidad(n)} className="text-xs underline text-gray-400 flex-shrink-0">Destachar</button>
              </div>
            ))}
          </div>
        </>
      )}

      {modalNueva && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModalNueva(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-lg text-[#1a472a]">Nueva necesidad</h3>
              <button onClick={() => setModalNueva(false)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <div className="p-6">
              <label className="block mb-3.5">
                <span className="block text-[13px] font-medium text-gray-600 mb-1.5">Que se necesita</span>
                <input className={inputCls} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="p.ej. Comprar bolsas de basura" autoFocus />
              </label>
              <button onClick={crearNecesidad} className="bg-[#1a472a] hover:bg-[#143620] text-white text-sm font-medium px-4 py-2.5 rounded-lg transition">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Dashboard() {
  const { currentUser, userRole, modulosActivos, logout } = useAuth();
  const [seccion, setSeccion] = useState('inicio'); // 'inicio' | 'personal' | 'fichajes' | 'clubes'

  const visibleApps = APPS.filter((app) => {
    if (!app.roles.includes(userRole)) return false;
    if (userRole === 'superadmin') return true; // el superadmin siempre ve todas las apps
    if (!modulosActivos) return true; // el club aun no tiene el campo => no bloquea nada (retrocompatible)
    return modulosActivos[app.id] !== false;
  });

  return (
    <div className="min-h-screen bg-[#f8faf9]">
      {/* Header */}
      <header className="bg-[#0d2818] border-b-2 border-[#d4af37]/30">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <img src={LOGO_GOLFB_DORADO} alt="Golf B" style={{ height: 56, objectFit: 'contain' }} />
            <p className="text-white/50 text-xs mt-1">Panel Maestro · Golf Ciudad Real</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-white text-sm">{currentUser?.email}</p>
              <p className="text-[#d4af37] text-xs font-semibold uppercase tracking-wide">{userRole}</p>
            </div>
            <button
              onClick={logout}
              className="bg-white/10 hover:bg-white/20 text-white text-sm px-4 py-2 rounded-lg transition"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        {userRole === 'superadmin' && (
          <div className="flex gap-2 mb-8">
            {[['inicio', '🏠 Inicio'], ['personal', '👷 Personal'], ['fichajes', '⏱ Fichajes'], ['necesidades', '🧾 Necesidades'], ['clubes', '🏌️ Clubes']].map(([id, label]) => (
              <button key={id} onClick={() => setSeccion(id)}
                className={`text-sm px-4 py-2 rounded-lg transition font-medium ${seccion === id ? 'bg-[#1a472a] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-[#1a472a]/40'}`}>
                {label}
              </button>
            ))}
          </div>
        )}

        {userRole === 'superadmin' && seccion === 'personal' ? (
          <PersonalView />
        ) : userRole === 'superadmin' && seccion === 'fichajes' ? (
          <FichajesGlobal />
        ) : userRole === 'superadmin' && seccion === 'necesidades' ? (
          <NecesidadesView />
        ) : userRole === 'superadmin' && seccion === 'clubes' ? (
          <PanelClubes />
        ) : (
        <>
        <h2 className="text-xl font-semibold text-[#1a472a] mb-1">
          Bienvenido, {currentUser?.email?.split('@')[0]}
        </h2>
        <p className="text-gray-500 mb-8">Selecciona una aplicación para continuar</p>

        {userRole === 'superadmin' && <AdminOverview />}

        {visibleApps.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md p-8 text-center">
            <p className="text-gray-500">
              Tu cuenta todavía no tiene un rol asignado. Contacta con el administrador.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {visibleApps.map((app) => (
              <AppCard key={app.id} app={app} />
            ))}
          </div>
        )}
        </>
        )}
      </main>

      <footer className="text-center text-gray-400 text-xs py-8">
        José Manuel Caballero Fernández · PGA España Nº 1908P · Golf B
      </footer>
    </div>
  );
}

function AppContent() {
  const { currentUser } = useAuth();

  if (!currentUser) {
    return <Login />;
  }

  return <Dashboard />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
