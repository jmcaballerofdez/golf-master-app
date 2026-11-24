import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, doc, getDoc, query, orderBy, limit } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './contexts/AuthContext';
import { LOGOS } from './logos';

// ─── Utilidades ─────────────────────────────────────────────────────
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_C = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const pad = (n) => String(n).padStart(2, '0');
const isoDe = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const aFecha = (v) => {
  if (!v) return null;
  if (v?.toDate) return v.toDate();
  const d = new Date(v);
  return isNaN(d) ? null : d;
};
const eur = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n || 0));
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const entidadDeTx = (t) =>
  (t.entidad === 'personal' || t.entidad === 'piso' ? 'jmcf' : t.entidad) ||
  (t.origen === 'academia' || /academia|pro ?shop/.test(norm(`${t.category} ${t.activity}`)) ? 'jmcf' : 'club');

// Revisión de maquinaria (misma lógica que la app de Mantenimiento)
function nivelRevision(m) {
  const horo = m.horometro === '' || m.horometro == null ? null : Number(m.horometro);
  const intH = Number(m.intervaloHoras) || 0;
  const intD = Number(m.intervaloDias) || 0;
  let horasRest = null;
  if (intH > 0 && horo != null) horasRest = (Number(m.ultimaRevisionHoras) || 0) + intH - horo;
  let fechaProx = null;
  if (intD > 0 && m.ultimaRevisionFecha) {
    const d = new Date(m.ultimaRevisionFecha + 'T00:00:00');
    d.setDate(d.getDate() + intD);
    fechaProx = d;
  } else if (m.proximoMantenimiento) fechaProx = new Date(m.proximoMantenimiento + 'T00:00:00');
  let nivel = 'ok';
  if (horasRest != null) nivel = horasRest <= 0 ? 'vencida' : horasRest <= 25 ? 'pronto' : nivel;
  if (fechaProx) {
    const h = new Date(); h.setHours(0, 0, 0, 0);
    const dias = Math.round((fechaProx - h) / 86400000);
    if (dias < 0) nivel = 'vencida';
    else if (dias <= 15 && nivel !== 'vencida') nivel = 'pronto';
  }
  return nivel;
}

// ─── Datos ──────────────────────────────────────────────────────────
function useColl(ruta, activo = true) {
  const [datos, setDatos] = useState([]);
  useEffect(() => {
    if (!activo) return;
    return onSnapshot(
      collection(db, ...ruta),
      (snap) => setDatos(snap.docs.map((d) => ({ ...d.data(), id: d.id }))),
      (e) => console.error('Mapa general:', ruta.join('/'), e.code || e.message)
    );
  }, [ruta.join('/'), activo]);
  return datos;
}

// Ventas del TPV (Excel) por mes: 13 meses hacia atrás + los mismos meses del año anterior para la comparativa.
function useVentasMes(tenantId, ahora) {
  const [meses, setMeses] = useState({});
  const [fam, setFam] = useState({});
  useEffect(() => {
    let vivo = true;
    const claves = [];
    for (let i = 0; i < 25; i++) {
      const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
      claves.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
    }
    Promise.all(
      claves.map((k) =>
        getDoc(doc(db, 'clubes', tenantId, 'ventas_gcr', k))
          .then((s) => [k, s.exists() ? Number(s.data().total || 0) : null, s.exists() ? s.data().porFamilia || {} : null])
          .catch(() => [k, null, null])
      )
    ).then((r) => {
      if (!vivo) return;
      setMeses(Object.fromEntries(r.map((x) => [x[0], x[1]])));
      setFam(Object.fromEntries(r.map((x) => [x[0], x[2]])));
    });
    return () => { vivo = false; };
  }, [tenantId, ahora.getFullYear(), ahora.getMonth()]);
  return { meses, fam };
}

// ─── Piezas visuales ────────────────────────────────────────────────
const TONO = { rojo: '#B3261E', ambar: '#B7791F', verde: '#2F7D4F', gris: '#6b7a86' };

function Bloque({ app, color, titulo, sub, children }) {
  return (
    <section className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden mb-5">
      <div className="h-[3px]" style={{ background: color }} />
      <div className="p-5">
        <div className="flex items-center gap-3 mb-4">
          {LOGOS[app] && <img src={LOGOS[app].sym} alt="" style={{ height: 30, width: 'auto' }} />}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color }}>{titulo}</p>
            {sub && <p className="text-xs text-gray-400">{sub}</p>}
          </div>
        </div>
        {children}
      </div>
    </section>
  );
}

function Cifra({ label, valor, sub, tono, href }) {
  const c = (
    <div className="rounded-xl border border-gray-100 bg-[#fbfcfb] p-4 h-full hover:border-[#1a472a]/30 transition">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">{label}</p>
      <p className="text-2xl font-bold" style={{ color: tono ? TONO[tono] : '#1a472a' }}>{valor}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
  return href ? <a href={href} target="_blank" rel="noopener noreferrer" className="block">{c}</a> : c;
}

function Delta({ actual, previo, etiqueta, inverso }) {
  if (previo == null || !previo) return <span className="text-gray-400">sin datos de {etiqueta}</span>;
  const p = ((actual - previo) / Math.abs(previo)) * 100;
  const sube = p >= 0;
  return (
    <span style={{ color: sube !== !!inverso ? TONO.verde : TONO.rojo }}>
      {sube ? '▲' : '▼'} {Math.abs(p).toFixed(0)} % <span className="text-gray-400">vs {etiqueta} ({eur(previo)})</span>
    </span>
  );
}

// Barras de los últimos 12 meses; la raya es el mismo mes del año anterior
function GraficoMeses({ serie, color }) {
  const W = 720, H = 150, pl = 8, pr = 8, pt = 14, pb = 22;
  const max = Math.max(1, ...serie.map((s) => Math.max(s.v || 0, s.prev || 0)));
  const bw = (W - pl - pr) / serie.length;
  const y = (v) => pt + (H - pt - pb) * (1 - v / max);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      {serie.map((s, i) => {
        const x = pl + i * bw;
        return (
          <g key={i}>
            {s.v != null && <rect x={x + bw * 0.2} y={y(s.v)} width={bw * 0.6} height={Math.max(1, H - pb - y(s.v))} rx="2" fill={color} opacity={i === serie.length - 1 ? 1 : 0.55} />}
            {s.prev != null && <line x1={x + bw * 0.12} x2={x + bw * 0.88} y1={y(s.prev)} y2={y(s.prev)} stroke="#1f2a33" strokeWidth="1.6" strokeDasharray="3 2" />}
            <text x={x + bw / 2} y={H - 7} textAnchor="middle" fontSize="10" fill="#8a96a0">{s.mes}</text>
            {s.v != null && <text x={x + bw / 2} y={y(Math.max(s.v, s.prev || 0)) - 4} textAnchor="middle" fontSize="9" fill="#5b6872">{s.v >= 1000 ? Math.round(s.v / 1000) + 'k' : Math.round(s.v)}</text>}
          </g>
        );
      })}
    </svg>
  );
}

function Alerta({ tono, titulo, detalle, href, app }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0 hover:bg-[#f6f8f7] -mx-2 px-2 rounded-lg transition">
      <span className="mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: TONO[tono] }} />
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-gray-800">{titulo}</span>
        {detalle && <span className="block text-xs text-gray-500 truncate">{detalle}</span>}
      </span>
      {LOGOS[app] && <img src={LOGOS[app].sym} alt="" style={{ height: 22, width: 'auto', opacity: 0.9 }} />}
    </a>
  );
}

const lista = (arr, f, n = 3) => arr.slice(0, n).map(f).join(', ') + (arr.length > n ? ` y ${arr.length - n} más` : '');
const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;

// ─── Mapa general ───────────────────────────────────────────────────
export default function MapaGeneral({ apps }) {
  const { tenantId } = useAuth();
  const ahora = useMemo(() => new Date(), []);
  const hoy = isoDe(ahora);
  const mesKey = `${ahora.getFullYear()}-${pad(ahora.getMonth() + 1)}`;

  const clases = useColl(['academia_clases']);
  const transacciones = useColl(['clubes', tenantId, 'finanzas_transacciones']);
  const fichMant = useColl(['clubes', tenantId, 'mant_fichajes']);
  const fichProshop = useColl(['clubes', tenantId, 'proshop_fichajes']);
  const tareas = useColl(['clubes', tenantId, 'mant_tareas']);
  const partes = useColl(['clubes', tenantId, 'mant_partes']);
  const maquinaria = useColl(['clubes', tenantId, 'mant_maquinaria']);
  const inventario = useColl(['clubes', tenantId, 'mant_inventario']);
  const zonas = useColl(['clubes', tenantId, 'mant_zonas']);
  const ausencias = useColl(['clubes', tenantId, 'mant_ausencias']);
  const misTareas = useColl(['clubes', 'ciudad-real', 'tareas_personales']);
  const { meses: ventasMes, fam: famMes } = useVentasMes(tenantId, ahora);

  // Último consumo de agua
  const [lecturas, setLecturas] = useState([]);
  useEffect(() => {
    const q = query(collection(db, 'clubes', tenantId, 'mant_lecturas_caudalimetro'), orderBy('momento', 'desc'), limit(600));
    return onSnapshot(q, (s) => setLecturas(s.docs.map((d) => ({ ...d.data(), id: d.id }))), () => {});
  }, [tenantId]);

  const url = (id) => apps.find((a) => a.id === id)?.url || '#';
  const colorApp = (id) => apps.find((a) => a.id === id)?.color || '#1a472a';

  // ── DINERO ──
  const dinero = useMemo(() => {
    const club = transacciones.filter((t) => entidadDeTx(t) === 'club');
    const delMes = (y, m, tipo) =>
      club.filter((t) => {
        const f = aFecha(t.date);
        return t.type === tipo && f && f.getFullYear() === y && f.getMonth() === m;
      }).reduce((s, t) => s + Number(t.amount || 0), 0);
    const y = ahora.getFullYear(), m = ahora.getMonth();
    const tpv = ventasMes[mesKey];
    const tpvAnt = ventasMes[`${y - 1}-${pad(m + 1)}`];
    const gastos = delMes(y, m, 'expense');
    const gastosAnt = delMes(y - 1, m, 'expense');
    // Acumulado del año (enero → mes actual) frente al mismo tramo del año anterior
    let acum = 0, acumAnt = 0, mesesAcum = 0, mesesAcumAnt = 0;
    for (let i = 0; i <= m; i++) {
      const a = ventasMes[`${y}-${pad(i + 1)}`], b = ventasMes[`${y - 1}-${pad(i + 1)}`];
      if (a != null) { acum += a; mesesAcum++; }
      if (b != null) { acumAnt += b; mesesAcumAnt++; }
    }
    const serie = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(y, m - i, 1);
      serie.push({
        mes: MESES_C[d.getMonth()],
        v: ventasMes[`${d.getFullYear()}-${pad(d.getMonth() + 1)}`] ?? null,
        prev: ventasMes[`${d.getFullYear() - 1}-${pad(d.getMonth() + 1)}`] ?? null,
      });
    }
    const sinCuenta = club.filter((t) => t.type === 'expense' && !t.cuenta && ['proveedores', 'nominas'].includes(t.origen) && aFecha(t.date)?.getFullYear() === y);
    // Gastos acumulados del año frente al mismo tramo del año anterior (hasta hoy)
    const hastaHoy = (anio) => club.filter((t) => {
      const f = aFecha(t.date);
      return t.type === 'expense' && f && f.getFullYear() === anio && (f.getMonth() < m || (f.getMonth() === m && f.getDate() <= ahora.getDate()));
    }).reduce((s, t) => s + Number(t.amount || 0), 0);
    const gastosAnio = hastaHoy(y), gastosAnioAnt = hastaHoy(y - 1);
    // Gastos del mes por categoría
    const porCat = {};
    club.forEach((t) => {
      const f = aFecha(t.date);
      if (t.type !== 'expense' || !f || f.getFullYear() !== y || f.getMonth() !== m) return;
      const c = t.category || 'Sin categoría';
      porCat[c] = (porCat[c] || 0) + Number(t.amount || 0);
    });
    const cats = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
    // Mejor y peor mes de ventas (últimos 12 meses completos con datos)
    const conDatos = serie.slice(0, 11).map((s, i) => ({ ...s, i })).filter((s) => s.v != null && s.v > 0);
    const nombreMes = (i) => { const d = new Date(y, m - 11 + i, 1); return `${MESES[d.getMonth()]} ${d.getFullYear()}`; };
    const mejor = conDatos.length ? conDatos.reduce((a, b) => (b.v > a.v ? b : a)) : null;
    const peor = conDatos.length ? conDatos.reduce((a, b) => (b.v < a.v ? b : a)) : null;
    // Familias del TPV: este mes frente al mismo mes del año anterior
    const fa = famMes[mesKey] || {}, fb = famMes[`${y - 1}-${pad(m + 1)}`] || {};
    const familias = [...new Set([...Object.keys(fa), ...Object.keys(fb)])]
      .map((f) => ({ f, a: Number(fa[f]?.total || 0), b: Number(fb[f]?.total || 0) }))
      .filter((x) => x.a || x.b).sort((p, q) => q.a + q.b - (p.a + p.b));
    return { tpv, tpvAnt, gastos, gastosAnt, gastosAnio, gastosAnioAnt, cats, mejor: mejor && { ...mejor, n: nombreMes(mejor.i) }, peor: peor && { ...peor, n: nombreMes(peor.i) }, familias, acum, acumAnt, serie, sinCuenta, comp: mesesAcum === mesesAcumAnt };
  }, [transacciones, ventasMes, famMes]);

  // ── HOY ──
  const hoyClub = useMemo(() => {
    const cl = clases.filter((c) => c.fecha === hoy).sort((a, b) => (a.horaInicio || '').localeCompare(b.horaInicio || ''));
    const ultimo = {};
    fichMant.forEach((f) => {
      const m = aFecha(f.momento);
      if (!m || isoDe(m) !== hoy) return;
      if (!ultimo[f.empleado] || m > ultimo[f.empleado].m) ultimo[f.empleado] = { tipo: f.tipo, m };
    });
    const trabajando = Object.entries(ultimo).filter(([, v]) => v.tipo === 'entrada').map(([n]) => n);
    fichProshop.forEach((f) => {
      if (f.entrada && !f.salida) {
        const e = aFecha(f.entrada);
        if (e && isoDe(e) === hoy && f.empleadoNombre && !trabajando.includes(f.empleadoNombre)) trabajando.push(f.empleadoNombre);
      }
    });
    const abiertos = partes.filter((p) => p.estado !== 'Completada');
    return { cl, trabajando, abiertos };
  }, [clases, fichMant, fichProshop, partes]);

  // ── CAMPO ──
  const campo = useMemo(() => {
    const pend = tareas.filter((t) => t.estado !== 'Completada');
    const venc = pend.filter((t) => t.fechaLimite && t.fechaLimite < hoy);
    const operativas = maquinaria.filter((m) => m.estado === 'Operativa').length;
    const revVenc = maquinaria.filter((m) => nivelRevision(m) === 'vencida');
    const revPronto = maquinaria.filter((m) => nivelRevision(m) === 'pronto');
    const fuera = maquinaria.filter((m) => m.estado === 'Fuera de servicio');
    const sinStock = inventario.filter((p) => (Number(p.stock) || 0) <= 0);
    const stockBajo = inventario.filter((p) => {
      const s = Number(p.stock) || 0, min = Number(p.stockMinimo) || 0;
      return s > 0 && min > 0 && s <= min;
    });
    const zProb = zonas.filter((z) => z.estado === 'Problema');
    const ausPend = ausencias.filter((a) => a.estado === 'Pendiente');
    const graves = hoyClub.abiertos.filter((p) => p.gravedad === 'Grave');
    // Agua: última lectura de cada caudalímetro y diferencia con la anterior
    const porC = {};
    lecturas.forEach((l) => { (porC[l.caudalimetroId] = porC[l.caudalimetroId] || []).push(l); });
    const agua = Object.values(porC).map((ls) => {
      ls.sort((a, b) => (aFecha(b.momento) || 0) - (aFecha(a.momento) || 0));
      const a = ls[0], b = ls[1];
      return { nombre: a.caudalimetroNombre, lectura: a.lectura, dif: b ? a.lectura - b.lectura : null, fecha: aFecha(a.momento) };
    });
    const dia = 86400000, t0 = Date.now();
    const lecEn = (ls, ms) => ls.find((l) => (aFecha(l.momento) || 0) <= ms); // ls ya ordenada desc
    const agua30 = Object.values(porC).map((ls) => {
      const ahoraL = ls[0], hace30 = lecEn(ls, t0 - 30 * dia), hace60 = lecEn(ls, t0 - 60 * dia);
      return {
        nombre: ahoraL.caudalimetroNombre,
        ult: hace30 ? ahoraL.lectura - hace30.lectura : null,
        prev: hace30 && hace60 ? hace30.lectura - hace60.lectura : null,
      };
    });
    return { agua30, pend, venc, operativas, revVenc, revPronto, fuera, sinStock, stockBajo, zProb, ausPend, graves, agua };
  }, [tareas, maquinaria, inventario, zonas, ausencias, lecturas, hoyClub]);

  // ── ALERTAS ──
  const alertas = useMemo(() => {
    const out = [];
    const mt = (tono, titulo, detalle) => out.push({ tono, titulo, detalle, app: 'mantenimiento', href: url('mantenimiento') });
    if (campo.graves.length) mt('rojo', `${plural(campo.graves.length, 'parte grave abierto', 'partes graves abiertos')}`, lista(campo.graves, (p) => p.titulo));
    if (campo.venc.length) mt('rojo', `${plural(campo.venc.length, 'tarea de campo vencida', 'tareas de campo vencidas')}`, lista(campo.venc, (t) => t.titulo));
    if (campo.fuera.length) mt('rojo', `${plural(campo.fuera.length, 'máquina fuera de servicio', 'máquinas fuera de servicio')}`, lista(campo.fuera, (m) => m.nombre));
    if (campo.revVenc.length) mt('rojo', `${plural(campo.revVenc.length, 'revisión de maquinaria vencida', 'revisiones de maquinaria vencidas')}`, lista(campo.revVenc, (m) => m.nombre));
    if (campo.zProb.length) mt('rojo', `${plural(campo.zProb.length, 'zona del campo con problema', 'zonas del campo con problema')}`, lista(campo.zProb, (z) => z.nombre));
    if (campo.sinStock.length) mt('rojo', `${plural(campo.sinStock.length, 'producto sin stock', 'productos sin stock')}`, lista(campo.sinStock, (p) => p.nombre));
    if (campo.stockBajo.length) mt('ambar', `${plural(campo.stockBajo.length, 'producto con stock bajo', 'productos con stock bajo')}`, lista(campo.stockBajo, (p) => p.nombre));
    if (campo.revPronto.length) mt('ambar', `${plural(campo.revPronto.length, 'revisión de maquinaria próxima', 'revisiones de maquinaria próximas')}`, lista(campo.revPronto, (m) => m.nombre));
    if (campo.ausPend.length) mt('ambar', `${plural(campo.ausPend.length, 'solicitud de ausencia por aprobar', 'solicitudes de ausencia por aprobar')}`, '');
    // Fichajes sin cerrar de días anteriores (Proshop/Recepción)
    const sinCerrar = fichProshop.filter((f) => f.entrada && !f.salida && aFecha(f.entrada) && isoDe(aFecha(f.entrada)) < hoy);
    if (sinCerrar.length) out.push({ tono: 'ambar', titulo: `${plural(sinCerrar.length, 'fichaje sin cerrar', 'fichajes sin cerrar')} de días anteriores`, detalle: lista(sinCerrar, (f) => f.empleadoNombre || '—'), app: 'recepcion', href: url('recepcion') });
    if (dinero.sinCuenta.length) out.push({ tono: 'ambar', titulo: `${plural(dinero.sinCuenta.length, 'gasto sin cuenta contable', 'gastos sin cuenta contable')}`, detalle: lista(dinero.sinCuenta, (t) => t.proveedor || t.description || '—'), app: 'finanzas', href: url('finanzas') });
    // Mis tareas personales vencidas
    const mv = misTareas.filter((t) => !t.hecha && t.fechaLimite && t.fechaLimite < hoy);
    if (mv.length) out.push({ tono: 'rojo', titulo: `${plural(mv.length, 'tarea tuya vencida', 'tareas tuyas vencidas')}`, detalle: lista(mv, (t) => t.titulo), app: 'master', href: '#' });
    return out.sort((a, b) => (a.tono === b.tono ? 0 : a.tono === 'rojo' ? -1 : 1));
  }, [campo, dinero, fichProshop, misTareas]);

  const mesNombre = MESES[ahora.getMonth()];
  const colMaster = '#B8962E';

  return (
    <div className="mb-10">
      <div className="flex items-end justify-between mb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#d4af37] mb-1">Mapa general · {ahora.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h2 className="text-xl font-semibold text-[#1a472a]">Lo más importante del club</h2>
        </div>
      </div>

      {/* Alertas arriba: es lo que hay que mirar primero */}
      <Bloque app="master" color={alertas.some((a) => a.tono === 'rojo') ? TONO.rojo : alertas.length ? TONO.ambar : TONO.verde}
        titulo="Alertas y pendientes" sub={alertas.length ? `${alertas.length} ${alertas.length === 1 ? 'aviso' : 'avisos'} · pulsa para abrir la app` : undefined}>
        {alertas.length === 0
          ? <p className="text-sm" style={{ color: TONO.verde }}>✓ Todo en orden: no hay nada que atender ahora mismo.</p>
          : alertas.map((a, i) => <Alerta key={i} {...a} />)}
      </Bloque>

      <Bloque app="finanzas" color={colorApp('finanzas')} titulo={`Dinero · ${mesNombre} ${ahora.getFullYear()}`} sub="Club · ventas del TPV y gastos registrados en Finanzas">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <Cifra label="Ventas del mes (TPV)" valor={dinero.tpv != null ? eur(dinero.tpv) : '—'}
            sub={dinero.tpv != null ? <Delta actual={dinero.tpv} previo={dinero.tpvAnt} etiqueta={`${mesNombre} ${ahora.getFullYear() - 1}`} /> : 'Aún no hay ventas de este mes'} href={url('finanzas')} />
          <Cifra label="Gastos del mes" valor={eur(dinero.gastos)}
            sub={<Delta inverso actual={dinero.gastos} previo={dinero.gastosAnt} etiqueta={`${mesNombre} ${ahora.getFullYear() - 1}`} />} href={url('finanzas')} />
          <Cifra label="Ventas del año" valor={eur(dinero.acum)}
            sub={<Delta actual={dinero.acum} previo={dinero.acumAnt} etiqueta={`${ahora.getFullYear() - 1}`} />} href={url('finanzas')} />
          <Cifra label="Ventas − gastos del mes" valor={dinero.tpv != null ? eur(dinero.tpv - dinero.gastos) : '—'}
            tono={dinero.tpv != null ? (dinero.tpv - dinero.gastos >= 0 ? 'verde' : 'rojo') : undefined}
            sub="Orientativo: faltan gastos aún sin registrar" href={url('finanzas')} />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Ventas de los últimos 12 meses <span className="normal-case font-normal">· raya = mismo mes del año anterior</span></p>
        <GraficoMeses serie={dinero.serie} color={colorApp('finanzas')} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Ventas por familia · {mesNombre} vs {ahora.getFullYear() - 1}</p>
            {dinero.familias.length === 0 ? <p className="text-xs text-gray-400">Sin ventas por familia este mes ni el año pasado.</p> : dinero.familias.map((x) => (
              <div key={x.f} className="flex items-baseline justify-between text-sm py-1.5 border-b border-gray-100 last:border-0">
                <span className="text-gray-700 truncate pr-2">{x.f}</span>
                <span className="text-right whitespace-nowrap">
                  <b className="text-gray-800">{eur(x.a)}</b>
                  <span className="text-xs ml-2" style={{ color: !x.b ? '#8a96a0' : x.a >= x.b ? TONO.verde : TONO.rojo }}>
                    {x.b ? `${x.a >= x.b ? '▲' : '▼'} ${Math.abs(((x.a - x.b) / x.b) * 100).toFixed(0)} %` : 'nuevo'}
                  </span>
                </span>
              </div>
            ))}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Gastos del mes por categoría</p>
            {dinero.cats.length === 0 ? <p className="text-xs text-gray-400">Aún no hay gastos registrados este mes.</p> : dinero.cats.slice(0, 6).map(([c, v]) => (
              <div key={c} className="mb-2">
                <div className="flex justify-between text-xs text-gray-600"><span className="truncate pr-2">{c}</span><b>{eur(v)}</b></div>
                <div className="h-1.5 rounded bg-gray-100 mt-1"><div className="h-1.5 rounded" style={{ width: `${(v / dinero.cats[0][1]) * 100}%`, background: colorApp('finanzas') }} /></div>
              </div>
            ))}
            {dinero.cats.length > 6 && <p className="text-xs text-gray-400">y {dinero.cats.length - 6} categorías más</p>}
          </div>
          <div className="space-y-3">
            <Cifra label={`Gastos del año hasta hoy`} valor={eur(dinero.gastosAnio)} sub={<Delta inverso actual={dinero.gastosAnio} previo={dinero.gastosAnioAnt} etiqueta={`${ahora.getFullYear() - 1}`} />} />
            <Cifra label="Mejor mes de ventas (12 m)" valor={dinero.mejor ? eur(dinero.mejor.v) : '—'} sub={dinero.mejor ? dinero.mejor.n : 'Sin datos'} tono="verde" />
            <Cifra label="Peor mes de ventas (12 m)" valor={dinero.peor ? eur(dinero.peor.v) : '—'} sub={dinero.peor ? dinero.peor.n : 'Sin datos'} />
          </div>
        </div>
      </Bloque>

      <Bloque app="recepcion" color={colorApp('recepcion')} titulo="Hoy en el club" sub="Clases, personal e incidencias">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Cifra label="Clases hoy" valor={hoyClub.cl.length}
            sub={hoyClub.cl.length ? lista(hoyClub.cl, (c) => `${c.horaInicio || ''} ${c.alumnoNombre || c.nombre || ''}`.trim(), 2) : 'Sin clases'} href={url('academia')} />
          <Cifra label="Personal trabajando" valor={hoyClub.trabajando.length}
            sub={hoyClub.trabajando.length ? lista(hoyClub.trabajando, (n) => n, 3) : 'Nadie fichado ahora'} href={url('recepcion')} />
          <Cifra label="Incidencias abiertas" valor={hoyClub.abiertos.length} tono={hoyClub.abiertos.length ? 'ambar' : 'verde'}
            sub={hoyClub.abiertos.length ? lista(hoyClub.abiertos, (p) => p.titulo, 2) : 'Ninguna'} href={url('mantenimiento')} />
          <Cifra label="Mis tareas pendientes" valor={misTareas.filter((t) => !t.hecha).length} sub="Las tuyas, en Mis tareas" />
        </div>
      </Bloque>

      <Bloque app="mantenimiento" color={colorApp('mantenimiento')} titulo="Campo y mantenimiento" sub="Tareas, maquinaria, existencias y agua">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Cifra label="Tareas de campo" valor={campo.pend.length} tono={campo.venc.length ? 'rojo' : undefined}
            sub={campo.venc.length ? `${campo.venc.length} vencidas` : 'Ninguna vencida'} href={url('mantenimiento')} />
          <Cifra label="Maquinaria operativa" valor={`${campo.operativas}/${maquinaria.length}`} tono={campo.fuera.length || campo.revVenc.length ? 'ambar' : undefined}
            sub={campo.revVenc.length ? `${plural(campo.revVenc.length, 'revisión vencida', 'revisiones vencidas')}` : 'Revisiones al día'} href={url('mantenimiento')} />
          <Cifra label="Existencias" valor={campo.sinStock.length + campo.stockBajo.length} tono={campo.sinStock.length ? 'rojo' : campo.stockBajo.length ? 'ambar' : 'verde'}
            sub={campo.sinStock.length + campo.stockBajo.length ? `${campo.sinStock.length} sin stock · ${campo.stockBajo.length} bajos` : 'Todo con stock'} href={url('mantenimiento')} />
          <Cifra label="Agua (última lectura)" valor={campo.agua.length ? `${campo.agua.reduce((s, a) => s + (a.dif || 0), 0).toLocaleString('es-ES', { maximumFractionDigits: 1 })} m³` : '—'}
            sub={campo.agua.length ? campo.agua.map((a) => `${a.nombre}: ${a.dif != null ? (a.dif >= 0 ? '+' : '') + a.dif.toLocaleString('es-ES', { maximumFractionDigits: 1 }) + ' m³' : 'primera lectura'}`).join(' · ') : 'Sin lecturas'} href={url('mantenimiento')} />
        </div>
        {campo.agua30.length > 0 && (
          <div className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Consumo de agua · últimos 30 días frente a los 30 anteriores</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {campo.agua30.map((a) => (
                <div key={a.nombre} className="rounded-xl border border-gray-100 bg-[#fbfcfb] p-3">
                  <p className="text-xs text-gray-500">{a.nombre}</p>
                  <p className="text-lg font-bold" style={{ color: '#1a472a' }}>{a.ult != null ? `${a.ult.toLocaleString('es-ES', { maximumFractionDigits: 0 })} m³` : '—'}</p>
                  <p className="text-xs">
                    {a.ult != null && a.prev ? <span style={{ color: a.ult <= a.prev ? TONO.verde : TONO.ambar }}>{a.ult > a.prev ? '▲' : '▼'} {Math.abs(((a.ult - a.prev) / a.prev) * 100).toFixed(0)} % <span className="text-gray-400">vs {a.prev.toLocaleString('es-ES', { maximumFractionDigits: 0 })} m³</span></span> : <span className="text-gray-400">faltan lecturas para comparar</span>}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Bloque>
    </div>
  );
}
