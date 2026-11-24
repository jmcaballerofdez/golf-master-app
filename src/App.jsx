import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './contexts/AuthContext';
import { AuthProvider } from './contexts/AuthContext';
import Login from './pages/Login';
import { LOGOS } from './logos';
import MapaGeneral from './MapaGeneral';


const APPS = [
  {
    id: 'academia',
    name: 'Academia',
    desc: 'Clases, alumnos, estadísticas y vídeos',
    url: 'https://academia.golfb.es/',
    color: '#C2432E',
    roles: ['alumno', 'academia', 'superadmin'],
  },
  {
    id: 'mantenimiento',
    name: 'Mantenimiento',
    desc: 'Equipo, tareas de campo y maquinaria',
    url: 'https://mantenimiento.golfb.es/',
    color: '#1F6B35',
    roles: ['jardinero', 'greenkeeper', 'mantenimiento', 'superadmin'],
  },
  {
    id: 'recepcion',
    name: 'Recepción',
    desc: 'Ventas, checklist, turnos, fichajes y ausencias',
    url: 'https://recepciongcr.golfb.es/',
    color: '#6D242E',
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
    color: '#A8742E',
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
          {LOGOS[app.id]
            ? <img src={LOGOS[app.id].sym} alt={app.name} style={{ height: 40, width: 'auto', objectFit: 'contain' }} />
            : <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: app.color }} />}
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
            <img src={LOGOS.master.full} alt="Golf B" style={{ height: 56, objectFit: 'contain' }} />
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
        {userRole === 'superadmin' && <AvisoTareas db={db} F={MI_AGENDA_F} onIr={() => setSeccion('tareas')} />}
        {userRole === 'superadmin' && (
          <div className="flex gap-2 mb-8">
            {[['inicio', '🏠 Inicio'], ['personal', '👷 Personal'], ['fichajes', '⏱ Fichajes'], ['necesidades', '🧾 Necesidades'], ['agenda', '📅 Mi agenda'], ['tareas', '✅ Mis tareas'], ['diario', '📓 Diario'], ['clubes', '🏌️ Clubes']].map(([id, label]) => (
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
        ) : userRole === 'superadmin' && seccion === 'diario' ? (
          <DiarioVista db={db} F={MI_AGENDA_F} area="General" ink="#1f2a33" soft="#5C6C62" />
        ) : userRole === 'superadmin' && seccion === 'tareas' ? (
          <MisTareasVista db={db} F={MI_AGENDA_F} ink="#1f2a33" soft="#5C6C62" />
        ) : userRole === 'superadmin' && seccion === 'agenda' ? (
          <MiAgendaVista db={db} F={MI_AGENDA_F} ink="#1f2a33" soft="#5C6C62" />
        ) : userRole === 'superadmin' && seccion === 'clubes' ? (
          <PanelClubes />
        ) : (
        <>
        <h2 className="text-xl font-semibold text-[#1a472a] mb-1">
          Bienvenido, {currentUser?.email?.split('@')[0]}
        </h2>
        <p className="text-gray-500 mb-8">Selecciona una aplicación para continuar</p>

        {userRole === 'superadmin' && <MapaGeneral apps={APPS} />}

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

// ═══════════════════════════════════════════════════════════════════
// MI AGENDA (solo superadmin): eventos personales compartidos entre todas las apps
// (clubes/ciudad-real/agenda_personal) + clases de Academia en solo lectura.
// ═══════════════════════════════════════════════════════════════════
const MA_DIAS = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
const MA_H = 28;
const maIso = (d) => d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
const maSuma = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return maIso(d); };
const maLunes = (iso) => { const d = new Date(iso + "T12:00:00"); return maSuma(iso, -((d.getDay() + 6) % 7)); };
const maMin = (h) => { const [a, b] = String(h || "0:0").split(":"); return (Number(a) || 0) * 60 + (Number(b) || 0); };
const maHora = (m) => String(Math.floor(m / 60)).padStart(2,"0") + ":" + String(m % 60).padStart(2,"0");

const maSegmentos = (e, gIni = "08:00", gFin = "21:00") => {
  const fin = e.fechaFin && e.fechaFin >= e.fecha ? e.fechaFin : e.fecha;
  const hf = e.horaFin || maHora(Math.min(maMin(e.hora) + (e.durMin || 60), 23 * 60 + 59));
  const orig = { fechaOrig: e.fecha, horaOrig: e.hora };
  if (fin === e.fecha) return [{ ...e, ...orig, durMin: e.horaFin ? Math.max(5, maMin(hf) - maMin(e.hora)) : (e.durMin || 60) }];
  const out = [];
  for (let d = e.fecha, n = 0; d <= fin && n < 60; d = maSuma(d, 1), n++) {
    const a = d === e.fecha ? e.hora : gIni, b = d === fin ? hf : gFin;
    out.push({ ...e, ...orig, fecha: d, hora: a, durMin: Math.max(15, maMin(b) - maMin(a)) });
  }
  return out;
};
function MiAgendaVista({ db, F, ink = "#f3f6f4", soft = "#c9d3cc" }) {
  const [lunes, setLunes] = useState(() => maLunes(maIso(new Date())));
  const [personales, setPersonales] = useState([]);
  const [datos, setDatos] = useState({});
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const u1 = F.onSnapshot(F.collection(db, "clubes", "ciudad-real", "agenda_personal"),
      (s) => setPersonales(s.docs.map((d) => ({ ...d.data(), id: d.id, personal: true }))),
      (e) => setError("No se pudo leer la agenda personal: " + e.message));
    const u2 = F.onSnapshot(F.doc(db, "academia", "datos"),
      (s) => setDatos(s.exists() ? s.data() : {}),
      (e) => console.warn("Academia:", e));
    return () => { u1(); u2(); };
  }, []);

  const dias = [0,1,2,3,4,5,6].map((i) => maSuma(lunes, i));
  const domingo = dias[6];
  const hoy = maIso(new Date());

  // Clases de Academia (solo lectura), incluidas las automáticas de infantil
  const clases = [];
  (datos.agendaAdultos || []).forEach((e) => { if (e.tipo !== "personal" && !e.cancelada && e.fecha >= lunes && e.fecha <= domingo) clases.push({ id: e.id, fecha: e.fecha, hora: e.hora, durMin: (e.dur || 2) * 30, titulo: e.titulo || "Clase", tipo: e.tipo }); });
  const omit = datos.agendaOmitidas || [];
  (datos.gruposCurso || []).forEach((g) => {
    const di = ["lunes","martes","miercoles","jueves","viernes","sabado","domingo"].findIndex((x) => (g.dia || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").startsWith(x));
    if (di < 0 || !g.horaIni) return;
    const f = dias[di]; if (f < "2026-10-18") return;
    const ini = Math.floor(maMin(g.horaIni) / 30) * 30;
    const fin = g.horaFin ? maMin(g.horaFin) : ini + 60;
    const hora = maHora(ini);
    if ((datos.agendaAdultos || []).some((e) => e.fecha === f && e.tipo !== "personal" && e.hora === hora)) return;
    if (omit.includes("auto-" + g.id + "-" + f)) return;
    clases.push({ id: "auto-" + g.id + "-" + f, fecha: f, hora, durMin: Math.max(30, fin - ini), titulo: g.nombre || "Grupo infantil", tipo: "escuela" });
  });
  const pers = personales.filter((e) => e.fecha <= domingo && (e.fechaFin || e.fecha) >= lunes).flatMap((e) => maSegmentos(e)).filter((e) => e.fecha >= lunes && e.fecha <= domingo);

  const ini0 = 8 * 60, fin0 = 21 * 60;
  const alto = ((fin0 - ini0) / 30) * MA_H;
  const topDe = (h) => ((Math.max(maMin(h), ini0) - ini0) / 30) * MA_H;

  function carriles(evs) {
    const o = [...evs].sort((a, b) => maMin(a.hora) - maMin(b.hora));
    const fines = []; const res = {};
    o.forEach((e) => { const i = maMin(e.hora), f = i + e.durMin; let l = fines.findIndex((x) => x <= i); if (l < 0) { l = fines.length; fines.push(0); } fines[l] = f; res[e.id] = { lane: l, n: 1, i, f }; });
    o.forEach((e) => { const r = res[e.id]; let mx = r.lane; o.forEach((x) => { const q = res[x.id]; if (q.i < r.f && q.f > r.i) mx = Math.max(mx, q.lane); }); r.n = mx + 1; });
    return res;
  }

  function nuevo(fecha, hora) { setForm({ fecha, hora, fechaFin: fecha, horaFin: maHora(Math.min(maMin(hora) + 60, 23 * 60 + 59)), titulo: "", nota: "" }); setModal("new"); setError(""); }
  function editar(e) { const f0 = e.fechaOrig || e.fecha, h0 = e.horaOrig || e.hora; setForm({ fecha: f0, hora: h0, fechaFin: e.fechaFin || f0, horaFin: e.horaFin || maHora(Math.min(maMin(h0) + (e.durMin || 60), 23 * 60 + 59)), titulo: e.titulo || "", nota: e.nota || "" }); setModal(e.id); setError(""); }
  async function guardar() {
    if (!form.fecha || !form.hora) return;
    const fFin = form.fechaFin || form.fecha, hFin = form.horaFin || maHora(Math.min(maMin(form.hora) + 60, 23 * 60 + 59));
    const durTotal = Math.round((new Date(fFin + "T00:00:00") - new Date(form.fecha + "T00:00:00")) / 864e5) * 1440 + maMin(hFin) - maMin(form.hora);
    if (durTotal < 5) { setError("El final debe ser posterior al inicio."); return; }
    const reg = { titulo: (form.titulo || "").trim() || "Reunión", fecha: form.fecha, hora: form.hora, fechaFin: fFin, horaFin: hFin, durMin: durTotal, nota: (form.nota || "").trim() };
    try {
      if (modal === "new") await F.addDoc(F.collection(db, "clubes", "ciudad-real", "agenda_personal"), { ...reg, creadoEn: Date.now() });
      else await F.updateDoc(F.doc(db, "clubes", "ciudad-real", "agenda_personal", modal), reg);
      setModal(null);
    } catch (e) { setError("No se pudo guardar: " + e.message); }
  }
  async function borrar() {
    if (modal === "new" || !window.confirm("¿Eliminar este evento?")) return;
    try { await F.deleteDoc(F.doc(db, "clubes", "ciudad-real", "agenda_personal", modal)); setModal(null); }
    catch (e) { setError("No se pudo eliminar: " + e.message); }
  }

  const colores = { individual: ["#E3ECFC", "#2A5FD9"], grupo: ["#ECE6F8", "#6B4FBB"], curso: ["#FBEBD8", "#B0651A"], escuela: ["#DDF2E6", "#2E8B57"] };
  const fmt = (iso) => { const d = new Date(iso + "T12:00:00"); return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" }); };
  const inp = { color: "#1f2a33", background: "#fff", width: "100%", border: "1.5px solid #C7D2DC", borderRadius: 8, padding: "8px 10px", fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" };
  const btn = (bg, col) => ({ background: bg, color: col, border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" });

  return (
    <div style={{ color: ink }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <button style={btn("#E6EBF0", "#333")} onClick={() => setLunes(maSuma(lunes, -7))}>◀</button>
        <button style={btn("#E6EBF0", "#333")} onClick={() => setLunes(maLunes(hoy))}>Hoy</button>
        <button style={btn("#E6EBF0", "#333")} onClick={() => setLunes(maSuma(lunes, 7))}>▶</button>
        <div style={{ fontWeight: 800, fontSize: 15 }}>{fmt(lunes)} – {fmt(domingo)}</div>
        <div style={{ flex: 1 }} />
        <button style={btn("#2F6B3F", "#fff")} onClick={() => nuevo(hoy >= lunes && hoy <= domingo ? hoy : lunes, "10:00")}>+ Evento</button>
      </div>
      {error && <div style={{ background: "#FBE4E1", color: "#C0392B", padding: 8, borderRadius: 8, fontSize: 13, marginBottom: 10 }}>{error}</div>}
      <div style={{ overflowX: "auto", border: "1px solid #DCE4EB", borderRadius: 12, background: "#fff", color: "#1f2a33" }}>
        <div style={{ minWidth: 720, display: "grid", gridTemplateColumns: "48px repeat(7,1fr)" }}>
          <div style={{ background: "#F5F8FA", borderBottom: "1px solid #DCE4EB" }} />
          {dias.map((f, i) => (
            <div key={f} style={{ padding: "6px 4px", textAlign: "center", fontSize: 12, fontWeight: 700, borderBottom: "1px solid #DCE4EB", borderLeft: "1px solid #EEF2F5", background: f === hoy ? "#2F6B3F" : "#F5F8FA", color: f === hoy ? "#fff" : "#222" }}>
              {MA_DIAS[i]} {new Date(f + "T12:00:00").getDate()}
            </div>
          ))}
          <div style={{ position: "relative", height: alto }}>
            {Array.from({ length: (fin0 - ini0) / 60 }, (_, k) => (
              <div key={k} style={{ position: "absolute", top: k * 2 * MA_H, width: "100%", fontSize: 10, color: "#6b7a86", textAlign: "right", paddingRight: 5, boxSizing: "border-box" }}>{maHora(ini0 + k * 60)}</div>
            ))}
          </div>
          {dias.map((f) => {
            const evs = [...clases.filter((c) => c.fecha === f), ...pers.filter((p) => p.fecha === f).map((p) => ({ ...p, durMin: p.durMin || 60 }))];
            const car = carriles(evs);
            return (
              <div key={f} style={{ position: "relative", height: alto, borderLeft: "1px solid #EEF2F5" }}>
                {Array.from({ length: (fin0 - ini0) / 30 }, (_, k) => (
                  <div key={k} onClick={() => nuevo(f, maHora(ini0 + k * 30))} style={{ position: "absolute", top: k * MA_H, height: MA_H, width: "100%", boxSizing: "border-box", cursor: "pointer", borderTop: k % 2 === 0 ? "1px solid #DCE4EB" : "1px dotted #E8EEF3" }} />
                ))}
                {evs.map((e) => {
                  const c = car[e.id] || { lane: 0, n: 1 };
                  const col = e.personal ? ["#E6EBF0", "#5C7284"] : (colores[e.tipo] || colores.individual);
                  return (
                    <div key={e.id} onClick={(ev) => { ev.stopPropagation(); e.personal ? editar(e) : setInfo(e); }}
                      style={{ position: "absolute", top: topDe(e.hora) + 1, height: Math.max(15, e.durMin / 30 * MA_H) - 2, left: "calc(" + (c.lane * 100 / c.n) + "% + 2px)", width: "calc(" + (100 / c.n) + "% - 4px)", boxSizing: "border-box", overflow: "hidden", cursor: "pointer", background: col[0], borderLeft: "4px solid " + col[1], borderRadius: 6, padding: "2px 5px", fontSize: 11, lineHeight: 1.25, boxShadow: "0 1px 2px rgba(0,0,0,.08)", opacity: e.personal ? 1 : 0.9 }}>
                      <div style={{ fontWeight: 700, color: col[1] }}>{e.personal ? "" : "🎓 "}{e.titulo}</div>
                      <div style={{ color: "#6b7a86", fontSize: 10 }}>{e.hora}</div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ fontSize: 11, color: soft, marginTop: 8 }}>Pulsa en una hora vacía para añadir un evento. Los eventos grises son tuyos y se sincronizan en todas las apps. Las clases (🎓) se editan en Academia.</div>

      {modal && (
        <div onClick={() => setModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", color: "#1f2a33", borderRadius: 14, padding: 18, width: "100%", maxWidth: 440 }}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 12 }}>{modal === "new" ? "Nuevo evento" : "Editar evento"}</div>
            <label style={{ fontSize: 12, color: "#6b7a86" }}>Título</label>
            <input style={{ ...inp, marginBottom: 10 }} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ej: Reunión con proveedor" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
              <div><label style={{ fontSize: 12, color: "#6b7a86" }}>Fecha inicio</label><input type="date" style={inp} value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value, fechaFin: form.fechaFin < e.target.value ? e.target.value : form.fechaFin })} /></div>
              <div><label style={{ fontSize: 12, color: "#6b7a86" }}>Hora inicio</label><input type="time" style={inp} value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} /></div>
              <div><label style={{ fontSize: 12, color: "#6b7a86" }}>Fecha final</label><input type="date" style={inp} min={form.fecha} value={form.fechaFin || form.fecha} onChange={(e) => setForm({ ...form, fechaFin: e.target.value })} /></div>
              <div><label style={{ fontSize: 12, color: "#6b7a86" }}>Hora final</label><input type="time" style={inp} value={form.horaFin || ""} onChange={(e) => setForm({ ...form, horaFin: e.target.value })} /></div>
            </div>
            <label style={{ fontSize: 12, color: "#6b7a86" }}>Nota</label>
            <textarea rows={2} style={{ ...inp, marginBottom: 12 }} value={form.nota} onChange={(e) => setForm({ ...form, nota: e.target.value })} />
            {error && <div style={{ color: "#C0392B", fontSize: 12, marginBottom: 8 }}>{error}</div>}
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div>{modal !== "new" && <button style={btn("#FBE4E1", "#C0392B")} onClick={borrar}>Eliminar</button>}</div>
              <div style={{ display: "flex", gap: 8 }}><button style={btn("#E6EBF0", "#333")} onClick={() => setModal(null)}>Cancelar</button><button style={btn("#2F6B3F", "#fff")} onClick={guardar}>Guardar</button></div>
            </div>
          </div>
        </div>
      )}
      {info && (
        <div onClick={() => setInfo(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", color: "#1f2a33", borderRadius: 14, padding: 18, width: "100%", maxWidth: 380 }}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>🎓 {info.titulo}</div>
            <div style={{ fontSize: 14, marginBottom: 12 }}>{new Date(info.fecha + "T12:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })} · {info.hora} ({info.durMin} min)</div>
            <div style={{ fontSize: 12, color: "#6b7a86", marginBottom: 14 }}>Las clases se editan en Academia (ahí están los alumnos, la asistencia y los cobros).</div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button style={btn("#E6EBF0", "#333")} onClick={() => setInfo(null)}>Cerrar</button>
              <a href="https://academia.golfb.es/" target="_blank" rel="noreferrer" style={{ ...btn("#2F6B3F", "#fff"), textDecoration: "none" }}>Abrir Academia</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════════
// DIARIO (solo superadmin): diario personal compartido entre todas las apps
// (clubes/ciudad-real/diario_personal)
// ═══════════════════════════════════════════════════════════════════
const DI_AREAS = ["General", "Academia", "Recepción", "Mantenimiento", "Proshop", "Finanzas", "Campo", "Reuniones", "Otros"];
const diIso = (d) => d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
const diHoraAhora = () => { const d = new Date(); return String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0"); };

function DiarioVista({ db, F, area = "General", ink = "#f3f6f4", soft = "#c9d3cc" }) {
  const COL = ["clubes", "ciudad-real", "diario_personal"];
  const [entradas, setEntradas] = useState([]);
  const [error, setError] = useState("");
  const [fecha, setFecha] = useState(diIso(new Date()));
  const [hora, setHora] = useState(diHoraAhora());
  const [tipo, setTipo] = useState("laboral"); // "laboral" | "personal"
  const [areaSel, setAreaSel] = useState(DI_AREAS.includes(area) ? area : "General");
  const [texto, setTexto] = useState("");
  const [editando, setEditando] = useState(null);
  const [filtroArea, setFiltroArea] = useState("");
  const [mes, setMes] = useState(diIso(new Date()).slice(0, 7));
  const [q, setQ] = useState("");

  useEffect(() => {
    const u = F.onSnapshot(F.collection(db, ...COL),
      (s) => setEntradas(s.docs.map((d) => ({ ...d.data(), id: d.id }))),
      (e) => setError("No se pudo leer el diario: " + e.message));
    return () => u();
  }, []);

  const inp = { color: "#1f2a33", background: "#fff", border: "1.5px solid #C7D2DC", borderRadius: 8, padding: "8px 10px", fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" };
  const btn = (bg, col) => ({ background: bg, color: col, border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" });
  const run = async (fn) => { try { setError(""); await fn(); } catch (e) { setError("Error: " + e.message); } };

  const guardar = () => run(async () => {
    if (!texto.trim()) return;
    const reg = { texto: texto.trim(), fecha, hora, area: tipo === "personal" ? "Personal" : areaSel, tipo };
    if (editando) await F.updateDoc(F.doc(db, ...COL, editando), { ...reg, editadoEn: Date.now() });
    else await F.addDoc(F.collection(db, ...COL), { ...reg, creadoEn: Date.now() });
    setTexto(""); setEditando(null); setHora(diHoraAhora());
  });
  const editar = (e) => { setEditando(e.id); setTexto(e.texto); setFecha(e.fecha); setHora(e.hora || ""); setAreaSel(DI_AREAS.includes(e.area) ? e.area : "General"); setTipo(e.tipo === "personal" ? "personal" : "laboral"); window.scrollTo && window.scrollTo({ top: 0, behavior: "smooth" }); };
  const cancelarEdicion = () => { setEditando(null); setTexto(""); setHora(diHoraAhora()); };
  const borrar = (e) => run(async () => { if (window.confirm("¿Eliminar esta entrada del diario?")) await F.deleteDoc(F.doc(db, ...COL, e.id)); });

  const lista = entradas
    .filter((e) => (e.tipo === "personal" ? "personal" : "laboral") === tipo)
    .filter((e) => (!mes || (e.fecha || "").slice(0, 7) === mes) && (!filtroArea || e.area === filtroArea) && (!q.trim() || (e.texto || "").toLowerCase().includes(q.trim().toLowerCase())))
    .sort((a, b) => ((b.fecha || "") + (b.hora || "")).localeCompare((a.fecha || "") + (a.hora || "")) || (b.creadoEn || 0) - (a.creadoEn || 0));
  const porDia = {}; lista.forEach((e) => { (porDia[e.fecha] = porDia[e.fecha] || []).push(e); });
  const dias = Object.keys(porDia).sort().reverse();
  const fmtDia = (f) => { const d = new Date(f + "T12:00:00"); const s = d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); return s.charAt(0).toUpperCase() + s.slice(1); };

  function exportar() {
    const esc = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
    const filas = [["Fecha", "Hora", "Área", "Entrada"].map(esc).join(";")];
    lista.slice().reverse().forEach((e) => filas.push([e.fecha, e.hora, e.area, e.texto].map(esc).join(";")));
    const blob = new Blob(["﻿" + filas.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "diario-" + tipo + "-" + (mes || "todo") + ".csv"; a.click();
  }

  return (
    <div style={{ color: ink }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {[["laboral", "💼 Diario laboral"], ["personal", "🏡 Diario personal"]].map(([k, l]) => (
          <button key={k} onClick={() => { setTipo(k); setEditando(null); setTexto(""); setFiltroArea(""); }}
            style={{ ...btn(tipo === k ? "#2F6B3F" : "#E6EBF0", tipo === k ? "#fff" : "#333"), padding: "9px 16px", fontSize: 14 }}>{l}</button>
        ))}
      </div>
      <div style={{ background: "#fff", color: "#1f2a33", borderRadius: 12, padding: 12, marginBottom: 14, display: "grid", gap: 8 }}>
        <div style={{ fontWeight: 800, fontSize: 14 }}>{editando ? "✏️ Editando entrada" : "📓 Nueva entrada"}</div>
        <textarea rows={4} style={{ ...inp, width: "100%", resize: "vertical" }} placeholder={tipo === "personal" ? "Escribe lo que quieras recordar de tu día…" : "¿Qué has hecho hoy en el club? Escríbelo como quieras…"} value={texto} onChange={(e) => setTexto(e.target.value)} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input type="date" style={inp} value={fecha} onChange={(e) => setFecha(e.target.value)} />
          <input type="time" style={inp} value={hora} onChange={(e) => setHora(e.target.value)} />
          {tipo === "laboral" && <select style={inp} value={areaSel} onChange={(e) => setAreaSel(e.target.value)}>{DI_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}</select>}
          <span style={{ flex: 1 }} />
          {editando && <button style={btn("#E6EBF0", "#333")} onClick={cancelarEdicion}>Cancelar</button>}
          <button style={btn("#2F6B3F", "#fff")} onClick={guardar}>{editando ? "Guardar cambios" : "+ Añadir al diario"}</button>
        </div>
      </div>
      {error && <div style={{ background: "#FBE4E1", color: "#C0392B", padding: 8, borderRadius: 8, fontSize: 13, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <input type="month" style={inp} value={mes} onChange={(e) => setMes(e.target.value)} title="Mes" />
        {tipo === "laboral" && <select style={inp} value={filtroArea} onChange={(e) => setFiltroArea(e.target.value)}><option value="">Todas las áreas</option>{DI_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}</select>}
        <input style={{ ...inp, flex: 1, minWidth: 140 }} placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button style={btn("#E6EBF0", "#333")} onClick={() => setMes("")}>Ver todo</button>
        <button style={btn("#E6EBF0", "#333")} onClick={exportar}>⬇ Excel (CSV)</button>
      </div>
      {dias.length === 0 && <div style={{ color: soft, fontSize: 14 }}>No hay entradas en este periodo.</div>}
      {dias.map((f) => (
        <div key={f} style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6 }}>{fmtDia(f)}</div>
          {porDia[f].map((e) => (
            <div key={e.id} style={{ background: "#fff", color: "#1f2a33", borderRadius: 10, padding: "10px 12px", marginBottom: 6, borderLeft: "4px solid #2F6B3F" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: "#6b7a86", marginBottom: 4 }}>
                <span style={{ fontWeight: 700 }}>{e.hora || ""}</span>
                {tipo === "laboral" && <span style={{ background: "#E6EBF0", borderRadius: 10, padding: "1px 8px", fontWeight: 600 }}>{e.area || "General"}</span>}
                <span style={{ flex: 1 }} />
                <button onClick={() => editar(e)} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 14 }} title="Editar">✏️</button>
                <button onClick={() => borrar(e)} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 14, color: "#9aa7b1" }} title="Eliminar">🗑</button>
              </div>
              <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{e.texto}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

const MI_AGENDA_F = { collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc };

// ═══════════════════════════════════════════════════════════════════
// MIS TAREAS (solo superadmin): lista compartida entre todas las apps
// (clubes/ciudad-real/tareas_personales). Al marcarlas pasan al historial con fecha y hora.
// ═══════════════════════════════════════════════════════════════════
const MT_COL = ["clubes", "ciudad-real", "tareas_personales"];
const mtHoy = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0"); };
const mtFechaHora = (ms) => ms ? new Date(ms).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
function useMisTareas(db, F) {
  const [tareas, setTareas] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const u = F.onSnapshot(F.collection(db, ...MT_COL),
      (s) => setTareas(s.docs.map((d) => ({ ...d.data(), id: d.id }))),
      (e) => setError(e.message));
    return () => u();
  }, []);
  return { tareas, error };
}

function AvisoTareas({ db, F, onIr }) {
  const { tareas } = useMisTareas(db, F);
  const [oculto, setOculto] = useState(false);
  const pend = tareas.filter((t) => !t.hecha);
  if (oculto || pend.length === 0) return null;
  const venc = pend.filter((t) => t.fechaLimite && t.fechaLimite < mtHoy()).length;
  const hoy = pend.filter((t) => t.fechaLimite === mtHoy()).length;
  return (
    <div style={{ background: venc ? "#FBE4E1" : "#FFF4E0", border: "1px solid " + (venc ? "#E2685C" : "#F0C27B"), color: "#1f2a33", borderRadius: 10, padding: "8px 12px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 13 }}>
      <span style={{ fontWeight: 700 }}>✅ Tienes {pend.length} tarea{pend.length !== 1 ? "s" : ""} pendiente{pend.length !== 1 ? "s" : ""}</span>
      {venc > 0 && <span style={{ color: "#C0392B", fontWeight: 700 }}>· {venc} vencida{venc !== 1 ? "s" : ""}</span>}
      {hoy > 0 && <span>· {hoy} para hoy</span>}
      <span style={{ flex: 1 }} />
      <button onClick={onIr} style={{ background: "#2F6B3F", color: "#fff", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Ver tareas</button>
      <button onClick={() => setOculto(true)} style={{ background: "transparent", border: "none", fontSize: 16, cursor: "pointer", color: "#6b7a86" }} title="Ocultar">✕</button>
    </div>
  );
}

function MisTareasVista({ db, F, ink = "#f3f6f4", soft = "#c9d3cc" }) {
  const { tareas, error } = useMisTareas(db, F);
  const [verHist, setVerHist] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [fecha, setFecha] = useState("");
  const [nota, setNota] = useState("");
  const [err, setErr] = useState("");
  const [comp, setComp] = useState(null);
  const [obs, setObs] = useState("");
  const [editObs, setEditObs] = useState(null);
  const hoy = mtHoy();
  const pend = tareas.filter((t) => !t.hecha).sort((a, b) => (a.fechaLimite || "9999").localeCompare(b.fechaLimite || "9999") || (a.creadoEn || 0) - (b.creadoEn || 0));
  const hechas = tareas.filter((t) => t.hecha).sort((a, b) => (b.hechaEn || 0) - (a.hechaEn || 0));
  const inp = { color: "#1f2a33", background: "#fff", border: "1.5px solid #C7D2DC", borderRadius: 8, padding: "8px 10px", fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" };
  const btn = (bg, col) => ({ background: bg, color: col, border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" });
  const run = async (fn) => { try { setErr(""); await fn(); } catch (e) { setErr("Error: " + e.message); } };

  const añadir = () => run(async () => {
    if (!titulo.trim()) return;
    await F.addDoc(F.collection(db, ...MT_COL), { titulo: titulo.trim(), fechaLimite: fecha || "", nota: nota.trim(), hecha: false, creadoEn: Date.now() });
    setTitulo(""); setFecha(""); setNota("");
  });
  const hecha = (t, o) => run(async () => { await F.updateDoc(F.doc(db, ...MT_COL, t.id), { hecha: true, hechaEn: Date.now(), observaciones: (o || "").trim() }); setComp(null); setObs(""); });
  const guardarObs = (t, o) => run(async () => { await F.updateDoc(F.doc(db, ...MT_COL, t.id), { observaciones: (o || "").trim() }); setEditObs(null); });
  const reabrir = (t) => run(() => F.updateDoc(F.doc(db, ...MT_COL, t.id), { hecha: false, hechaEn: null }));
  const borrar = (t) => run(async () => { if (window.confirm("¿Eliminar definitivamente «" + t.titulo + "»?")) await F.deleteDoc(F.doc(db, ...MT_COL, t.id)); });

  return (
    <div style={{ color: ink }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button style={btn(!verHist ? "#2F6B3F" : "#E6EBF0", !verHist ? "#fff" : "#333")} onClick={() => setVerHist(false)}>Pendientes ({pend.length})</button>
        <button style={btn(verHist ? "#2F6B3F" : "#E6EBF0", verHist ? "#fff" : "#333")} onClick={() => setVerHist(true)}>Historial ({hechas.length})</button>
      </div>
      {(error || err) && <div style={{ background: "#FBE4E1", color: "#C0392B", padding: 8, borderRadius: 8, fontSize: 13, marginBottom: 10 }}>{error || err}</div>}
      {!verHist && (
        <>
          <div style={{ background: "#fff", color: "#1f2a33", borderRadius: 12, padding: 12, marginBottom: 14, display: "grid", gap: 8 }}>
            <input style={{ ...inp, width: "100%" }} placeholder="Nueva tarea…" value={titulo} onChange={(e) => setTitulo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") añadir(); }} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input type="date" style={inp} value={fecha} onChange={(e) => setFecha(e.target.value)} title="Fecha límite (opcional)" />
              <input style={{ ...inp, flex: 1, minWidth: 160 }} placeholder="Nota (opcional)" value={nota} onChange={(e) => setNota(e.target.value)} />
              <button style={btn("#2F6B3F", "#fff")} onClick={añadir}>+ Añadir</button>
            </div>
          </div>
          {pend.length === 0 && <div style={{ color: soft, fontSize: 14 }}>🎉 No tienes tareas pendientes.</div>}
          {pend.map((t) => {
            const venc = t.fechaLimite && t.fechaLimite < hoy;
            return (
              <div key={t.id} style={{ background: "#fff", color: "#1f2a33", borderRadius: 10, padding: "10px 12px", marginBottom: 8, display: "flex", alignItems: "center", gap: 10, borderLeft: "4px solid " + (venc ? "#E2685C" : t.fechaLimite === hoy ? "#E0A030" : "#2F6B3F") }}>
                <button onClick={() => { setComp(comp === t.id ? null : t.id); setObs(""); }} title="Marcar como hecha" style={{ width: 26, height: 26, borderRadius: 13, border: "2px solid #2F6B3F", background: "#fff", cursor: "pointer", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{t.titulo}</div>
                  {(t.fechaLimite || t.nota) && <div style={{ fontSize: 12, color: venc ? "#C0392B" : "#6b7a86" }}>{t.fechaLimite ? (venc ? "Vencida: " : "Para: ") + new Date(t.fechaLimite + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : ""}{t.fechaLimite && t.nota ? " · " : ""}{t.nota}</div>}
                  {comp === t.id && (
                    <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                      <textarea autoFocus rows={2} style={{ ...inp, width: "100%", resize: "vertical" }} placeholder="Observaciones de cómo se ha realizado (opcional)…" value={obs} onChange={(e) => setObs(e.target.value)} />
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <button style={btn("#2F6B3F", "#fff")} onClick={() => hecha(t, obs)}>✅ Marcar como hecha</button>
                        <button style={btn("#E6EBF0", "#333")} onClick={() => { setComp(null); setObs(""); }}>Cancelar</button>
                        <span style={{ fontSize: 11, color: "#6b7a86" }}>Se guardará con la fecha y hora de ahora.</span>
                      </div>
                    </div>
                  )}
                </div>
                <button onClick={() => borrar(t)} title="Eliminar" style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 15, color: "#9aa7b1" }}>🗑</button>
              </div>
            );
          })}
        </>
      )}
      {verHist && (
        <>
          {hechas.length === 0 && <div style={{ color: soft, fontSize: 14 }}>Todavía no has completado ninguna tarea.</div>}
          {hechas.map((t) => (
            <div key={t.id} style={{ background: "#fff", color: "#1f2a33", borderRadius: 10, padding: "10px 12px", marginBottom: 8, display: "flex", alignItems: "center", gap: 10, opacity: 0.9 }}>
              <span style={{ fontSize: 18 }}>✅</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, textDecoration: "line-through", color: "#6b7a86" }}>{t.titulo}</div>
                <div style={{ fontSize: 12, color: "#2F6B3F" }}>Realizada el {mtFechaHora(t.hechaEn)}{t.nota ? " · " + t.nota : ""}</div>
                {t.creadoEn && <div style={{ fontSize: 11, color: "#6b7a86" }}>Creada el {mtFechaHora(t.creadoEn)}{t.fechaLimite ? " · Límite: " + new Date(t.fechaLimite + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : ""}</div>}
                {editObs && editObs.id === t.id ? (
                  <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
                    <textarea autoFocus rows={2} style={{ ...inp, width: "100%", resize: "vertical" }} value={editObs.texto} onChange={(e) => setEditObs({ id: t.id, texto: e.target.value })} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button style={btn("#2F6B3F", "#fff")} onClick={() => guardarObs(t, editObs.texto)}>Guardar</button>
                      <button style={btn("#E6EBF0", "#333")} onClick={() => setEditObs(null)}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "#1f2a33", marginTop: 3 }}>
                    {t.observaciones ? <span>📝 {t.observaciones} </span> : <span style={{ color: "#9aa7b1" }}>Sin observaciones </span>}
                    <span onClick={() => setEditObs({ id: t.id, texto: t.observaciones || "" })} style={{ color: "#2F6B3F", cursor: "pointer", fontWeight: 600 }}>{t.observaciones ? "✏️ editar" : "+ añadir observaciones"}</span>
                  </div>
                )}
              </div>
              <button onClick={() => reabrir(t)} style={btn("#E6EBF0", "#333")}>Reabrir</button>
              <button onClick={() => borrar(t)} title="Eliminar" style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 15, color: "#9aa7b1" }}>🗑</button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
