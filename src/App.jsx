import { useAuth } from './contexts/AuthContext';
import { AuthProvider } from './contexts/AuthContext';
import Login from './pages/Login';

const APPS = [
  {
    id: 'academia',
    name: 'Academia',
    desc: 'Clases, alumnos, estadísticas y vídeos',
    url: 'https://jmcaballerofdez.github.io/golf-academia-app/',
    color: '#1a472a',
    roles: ['alumno', 'academia', 'superadmin'],
  },
  {
    id: 'mantenimiento',
    name: 'Mantenimiento',
    desc: 'Equipo, tareas de campo y maquinaria',
    url: 'https://jmcaballerofdez.github.io/golf-mantenimiento-app/',
    color: '#2d5a3d',
    roles: ['jardinero', 'greenkeeper', 'mantenimiento', 'superadmin'],
  },
  {
    id: 'proshop',
    name: 'Proshop',
    desc: 'TPV, fichajes, productos y ofertas',
    url: 'https://jmcaballerofdez.github.io/golf-proshop-app/',
    color: '#8c1c1c',
    roles: ['proshop', 'superadmin'],
  },
  {
    id: 'finanzas',
    name: 'Finanzas',
    desc: 'Transacciones, presupuestos y metas',
    url: 'https://jmcaballerofdez.github.io/golf-finanzas-app/',
    color: '#b8863c',
    roles: ['finanzas', 'superadmin'],
  },
];

function AppCard({ app }) {
  return (
    <a
      href={app.url}
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

function Dashboard() {
  const { currentUser, userRole, logout } = useAuth();

  const visibleApps = APPS.filter((app) => app.roles.includes(userRole));

  return (
    <div className="min-h-screen bg-[#f8faf9]">
      {/* Header */}
      <header className="bg-[#0d2818] border-b-2 border-[#d4af37]/30">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#d4af37] tracking-wide">GOLF B</h1>
            <p className="text-white/50 text-xs">Panel Maestro · Golf Ciudad Real</p>
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
        <h2 className="text-xl font-semibold text-[#1a472a] mb-1">
          Bienvenido, {currentUser?.email?.split('@')[0]}
        </h2>
        <p className="text-gray-500 mb-8">Selecciona una aplicación para continuar</p>

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
