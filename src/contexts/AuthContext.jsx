import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  // null = todavia no se ha comprobado o el club no tiene el campo (no bloquea nada, retrocompatible)
  const [modulosActivos, setModulosActivos] = useState(null);
  const [tenantId, setTenantId] = useState(null);
  const [loading, setLoading] = useState(true);

  async function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  function logout() {
    return signOut(auth);
  }

  function resetPassword(email) {
    return sendPasswordResetEmail(auth, email);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        let miTenantId = null;
        try {
          const userDoc = await getDoc(doc(db, 'Usuarios', user.uid));
          if (userDoc.exists()) {
            setUserRole(userDoc.data().role || 'pendiente');
            // Retrocompatible: si el usuario aún no tiene tenantId asignado
            // (usuarios creados antes de esta migración), se asume Ciudad Real.
            miTenantId = userDoc.data().tenantId || 'ciudad-real';
          } else {
            setUserRole('pendiente');
          }
        } catch (error) {
          console.error('Error al cargar rol:', error);
          setUserRole('pendiente');
        }
        setTenantId(miTenantId);

        if (miTenantId) {
          try {
            const clubDoc = await getDoc(doc(db, 'clubes', miTenantId));
            if (clubDoc.exists() && clubDoc.data().modulosActivos) {
              setModulosActivos(clubDoc.data().modulosActivos);
            } else {
              setModulosActivos(null);
            }
          } catch (error) {
            console.error('Error al cargar modulos activos del tenant:', error);
            setModulosActivos(null);
          }
        }
      } else {
        setUserRole(null);
        setModulosActivos(null);
        setTenantId(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

 const value = {
    currentUser,
    userRole,
    modulosActivos,
    tenantId,
    login,
    logout,
    resetPassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
