import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const { login, resetPassword } = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError('Email o contraseña incorrectos.');
    }
    setLoading(false);
  }

  async function handleReset(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await resetPassword(email);
      setResetSent(true);
    } catch (err) {
      setError('No se pudo enviar el email. Revisa la dirección.');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d2818] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-[#d4af37] tracking-wide">GOLF B</h1>
          <p className="text-white/70 mt-2 text-sm">Panel Maestro · Golf Ciudad Real</p>
        </div>

        <div className="bg-[#123a26] rounded-2xl shadow-2xl p-8 border border-[#d4af37]/20">
          {!showReset ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <h2 className="text-[#d4af37] text-xl font-semibold mb-6">Iniciar sesión</h2>

              <div>
                <label className="block text-white/80 text-sm mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-lg bg-white/10 text-white border border-white/20 focus:border-[#d4af37] focus:outline-none placeholder-white/40"
                  placeholder="tu@email.com"
                />
              </div>

              <div>
                <label className="block text-white/80 text-sm mb-1">Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-lg bg-white/10 text-white border border-white/20 focus:border-[#d4af37] focus:outline-none placeholder-white/40"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <p className="text-red-400 text-sm bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#d4af37] hover:bg-[#c49f2f] text-[#0d2818] font-semibold py-2.5 rounded-lg transition disabled:opacity-50"
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>

              <button
                type="button"
                onClick={() => { setShowReset(true); setError(''); }}
                className="w-full text-white/60 text-sm hover:text-[#d4af37] transition"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </form>
          ) : (
            <div className="space-y-5">
              <h2 className="text-[#d4af37] text-xl font-semibold mb-2">Recuperar contraseña</h2>

              {resetSent ? (
                <p className="text-green-400 text-sm bg-green-900/20 rounded-lg px-3 py-3">
                  Te hemos enviado un email con instrucciones para recuperar tu contraseña.
                </p>
              ) : (
                <form onSubmit={handleReset} className="space-y-5">
                  <p className="text-white/60 text-sm">
                    Introduce tu email y te enviaremos un enlace para restablecer tu contraseña.
                  </p>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-lg bg-white/10 text-white border border-white/20 focus:border-[#d4af37] focus:outline-none placeholder-white/40"
                    placeholder="tu@email.com"
                  />
                  {error && (
                    <p className="text-red-400 text-sm bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#d4af37] hover:bg-[#c49f2f] text-[#0d2818] font-semibold py-2.5 rounded-lg transition disabled:opacity-50"
                  >
                    {loading ? 'Enviando...' : 'Enviar enlace'}
                  </button>
                </form>
              )}

              <button
                type="button"
                onClick={() => { setShowReset(false); setResetSent(false); setError(''); }}
                className="w-full text-white/60 text-sm hover:text-[#d4af37] transition"
              >
                ← Volver al login
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-white/30 text-xs mt-6">
          José Manuel Caballero Fernández · PGA España Nº 1908P
        </p>
      </div>
    </div>
  );
}