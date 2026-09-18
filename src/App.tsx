import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from './firebase/config';
import { fetchCurrentUserData } from './services/familyService';
import { DEMO_ELDER, DEMO_CHILD } from './services/demoData';
import { AppUser, ElderProfile, ChildProfile, UserRole } from './types';
import { LandingPage } from './components/landing/LandingPage';
import { AuthModal } from './components/auth/AuthModal';
import { ElderDashboard } from './components/elder/ElderDashboard';
import { ChildDashboard } from './components/child/ChildDashboard';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [elderProfile, setElderProfile] = useState<ElderProfile | null>(null);
  const [childProfile, setChildProfile] = useState<ChildProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Auth modal control
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authRole, setAuthRole] = useState<UserRole>('elder');
  const [isLoginMode, setIsLoginMode] = useState(false);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser: User | null) => {
      if (fbUser) {
        setLoading(true);
        const data = await fetchCurrentUserData(fbUser.uid);
        if (data.user) {
          setCurrentUser(data.user);
          setElderProfile(data.elderProfile);
          setChildProfile(data.childProfile);
        } else {
          // User is authenticated in Firebase (e.g. Google sign in) but hasn't created a profile yet
          setIsAuthOpen(true);
        }
        setLoading(false);
      } else {
        // If not a demo user, clear state
        setCurrentUser(prev => (prev?.uid.startsWith('demo-') ? prev : null));
        setElderProfile(prev => (prev?.uid.startsWith('demo-') ? prev : null));
        setChildProfile(prev => (prev?.uid.startsWith('demo-') ? prev : null));
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Sign out warning:', e);
    }
    setCurrentUser(null);
    setElderProfile(null);
    setChildProfile(null);
  };

  const handleOpenAuth = (role: UserRole, login = false) => {
    setAuthRole(role);
    setIsLoginMode(login);
    setIsAuthOpen(true);
  };

  const handleDemoLogin = (role: UserRole) => {
    if (role === 'elder') {
      setCurrentUser({
        uid: DEMO_ELDER.uid,
        name: DEMO_ELDER.name,
        email: 'grandpa.demo@familymentor.local',
        role: 'elder',
        createdAt: new Date().toISOString()
      });
      setElderProfile({
        uid: DEMO_ELDER.uid,
        elderId: DEMO_ELDER.elderId,
        name: DEMO_ELDER.name,
        bio: DEMO_ELDER.bio,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      setChildProfile(null);
    } else {
      setCurrentUser({
        uid: DEMO_CHILD.uid,
        name: DEMO_CHILD.name,
        email: 'rahul.demo@familymentor.local',
        role: 'child',
        createdAt: new Date().toISOString()
      });
      setChildProfile(DEMO_CHILD);
      setElderProfile(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 text-stone-700">
        <Loader2 className="w-8 h-8 animate-spin text-amber-800 mb-3" />
        <p className="text-sm font-medium font-serif">Opening Living Family Mentor archive...</p>
      </div>
    );
  }

  // If logged in as Elder
  if (currentUser?.role === 'elder' && elderProfile) {
    return <ElderDashboard elderProfile={elderProfile} onLogout={handleLogout} />;
  }

  // If logged in as Child
  if (currentUser?.role === 'child' && childProfile) {
    return <ChildDashboard childProfile={childProfile} onLogout={handleLogout} />;
  }

  // Default: Landing Page
  return (
    <>
      <LandingPage
        onSelectRole={role => handleOpenAuth(role, false)}
        onOpenLogin={() => handleOpenAuth('elder', true)}
        onDemoLogin={handleDemoLogin}
      />

      <AuthModal
        isOpen={isAuthOpen}
        initialRole={authRole}
        isLoginMode={isLoginMode}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={async role => {
          if (auth.currentUser) {
            const data = await fetchCurrentUserData(auth.currentUser.uid);
            setCurrentUser(data.user);
            setElderProfile(data.elderProfile);
            setChildProfile(data.childProfile);
          }
        }}
        onDemoLogin={handleDemoLogin}
      />
    </>
  );
}
