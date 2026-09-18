import React, { useState } from 'react';
import { UserRole, LearningStyle, CommunicationStyle } from '../../types';
import {
  registerElder,
  registerChild,
  signInWithGoogle,
  createElderProfileForUser,
  createChildProfileForUser,
  fetchCurrentUserData
} from '../../services/familyService';
import { signInWithEmailAndPassword, User as FirebaseUser } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { X, Lock, Mail, User, Sparkles, AlertCircle, Loader2, Compass, Users } from 'lucide-react';

interface AuthModalProps {
  initialRole?: UserRole;
  isLoginMode?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (role: UserRole) => void;
  onDemoLogin?: (role: UserRole) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  initialRole = 'elder',
  isLoginMode = false,
  isOpen,
  onClose,
  onSuccess,
  onDemoLogin
}) => {
  const [isLogin, setIsLogin] = useState(isLoginMode);
  const [role, setRole] = useState<UserRole>(initialRole);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [age, setAge] = useState<number>(16);
  const [bio, setBio] = useState('');
  const [learningStyle, setLearningStyle] = useState<LearningStyle>('Storytelling');
  const [communicationStyle, setCommunicationStyle] = useState<CommunicationStyle>('Friendly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Profile setup for first-time Google sign in
  const [pendingGoogleUser, setPendingGoogleUser] = useState<FirebaseUser | null>(null);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const user = await signInWithGoogle();
      const existing = await fetchCurrentUserData(user.uid);
      if (existing.user) {
        onSuccess(existing.user.role);
        onClose();
      } else {
        // User needs to finish profile setup
        setPendingGoogleUser(user);
        setName(user.displayName || '');
      }
    } catch (err: any) {
      console.error('Google Sign In error:', err);
      if (err?.code === 'auth/popup-closed-by-user') {
        setError('Sign in was cancelled.');
      } else {
        setError(err?.message || 'Google Sign-In failed. Try 1-Click Demo Account below.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteGoogleProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingGoogleUser) return;
    setError(null);
    setLoading(true);

    try {
      if (role === 'elder') {
        if (!name.trim()) throw new Error('Please enter your name');
        await createElderProfileForUser(
          pendingGoogleUser.uid,
          name.trim(),
          pendingGoogleUser.email || '',
          bio
        );
        onSuccess('elder');
      } else {
        if (!name.trim()) throw new Error('Please enter your name');
        await createChildProfileForUser(
          pendingGoogleUser.uid,
          name.trim(),
          pendingGoogleUser.email || '',
          Number(age) || 16,
          learningStyle,
          communicationStyle
        );
        onSuccess('child');
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to complete profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        onSuccess(role);
      } else {
        if (role === 'elder') {
          if (!name.trim()) throw new Error('Please enter your full name');
          await registerElder(name, email, password, bio);
          onSuccess('elder');
        } else {
          if (!name.trim()) throw new Error('Please enter your name');
          if (!age || age < 4 || age > 100) throw new Error('Please provide a valid age');
          await registerChild(name, email, password, Number(age), learningStyle, communicationStyle);
          onSuccess('child');
        }
      }
      onClose();
    } catch (err: any) {
      console.error('Auth error:', err);
      if (err?.code === 'auth/operation-not-allowed' || err?.message?.includes('operation-not-allowed')) {
        setError('Email/Password auth is not enabled on this Firebase project. Please use "Continue with Google" or the "1-Click Demo Accounts" below.');
      } else if (err?.code === 'auth/user-not-found' || err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
        setError('Invalid credentials. Please use "Continue with Google" or test with a "1-Click Demo Account".');
      } else {
        setError(err?.message || 'Authentication failed. Please check your details.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoClick = (demoRole: UserRole) => {
    if (onDemoLogin) {
      onDemoLogin(demoRole);
    }
    onSuccess(demoRole);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
          <div>
            <h3 className="text-xl font-serif font-bold text-stone-900">
              {pendingGoogleUser
                ? 'Complete Your Profile'
                : isLogin
                ? 'Welcome Back'
                : role === 'elder'
                ? 'Elder Registration'
                : 'Child Registration'}
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              {pendingGoogleUser
                ? `Signed in as ${pendingGoogleUser.email}. Choose how you will use the platform.`
                : isLogin
                ? 'Sign in to access your family mentor account'
                : role === 'elder'
                ? 'Preserve your life experiences with an Elder ID'
                : 'Connect with family elders and explore wisdom'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-600 hover:bg-stone-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* If user just signed in with Google and needs a profile */}
        {pendingGoogleUser ? (
          <form onSubmit={handleCompleteGoogleProfile} className="p-6 space-y-4">
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900">
              Select your role in the family to activate your account:
            </div>

            <div className="grid grid-cols-2 gap-2 p-1 bg-stone-100 rounded-xl">
              <button
                type="button"
                onClick={() => setRole('elder')}
                className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                  role === 'elder'
                    ? 'bg-amber-800 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                I am an Elder
              </button>
              <button
                type="button"
                onClick={() => setRole('child')}
                className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                  role === 'child'
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                I am a Child
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Your Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={role === 'elder' ? 'e.g. Grandfather Robert' : 'e.g. Rahul'}
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-700"
              />
            </div>

            {role === 'child' ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Age</label>
                  <input
                    type="number"
                    min={5}
                    max={100}
                    value={age}
                    onChange={e => setAge(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Learning Style</label>
                  <select
                    value={learningStyle}
                    onChange={e => setLearningStyle(e.target.value as LearningStyle)}
                    className="w-full px-2 py-2 text-xs rounded-lg border border-stone-300 bg-white"
                  >
                    <option value="Storytelling">Storytelling</option>
                    <option value="Conversational">Conversational</option>
                    <option value="Practical">Practical</option>
                  </select>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Bio / Message to Family</label>
                <textarea
                  rows={2}
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Preserving life experiences and lessons for my grandchildren."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-xl font-medium text-sm text-white shadow-sm flex items-center justify-center gap-2 ${
                role === 'elder' ? 'bg-amber-800 hover:bg-amber-900' : 'bg-stone-900 hover:bg-black'
              }`}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Save & Enter Platform</span>
            </button>
          </form>
        ) : (
          <div className="p-6 space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* 1. Primary Google Sign-In */}
            <button
              id="btn-auth-google"
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 font-medium text-sm text-stone-800 shadow-xs flex items-center justify-center gap-3 transition-colors disabled:opacity-60"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* 2. One-Click Instant Demo Options */}
            <div className="pt-2">
              <div className="relative flex items-center justify-center my-3">
                <div className="border-t border-stone-200 w-full" />
                <span className="bg-white px-3 text-[11px] font-medium text-stone-400 uppercase tracking-wider shrink-0">
                  Or Instant Demo Experience
                </span>
                <div className="border-t border-stone-200 w-full" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  id="btn-demo-elder"
                  type="button"
                  onClick={() => handleDemoClick('elder')}
                  className="p-3 text-left rounded-xl border border-amber-200 bg-amber-50/60 hover:bg-amber-100/70 transition-all flex flex-col gap-1 group"
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                    <Users className="w-3.5 h-3.5 text-amber-700" />
                    <span>Demo Elder</span>
                  </div>
                  <span className="text-[11px] text-amber-800/80 line-clamp-1">Grandfather Robert</span>
                  <span className="text-[10px] text-amber-600 font-mono">ID: ELD-DEMO01</span>
                </button>

                <button
                  id="btn-demo-child"
                  type="button"
                  onClick={() => handleDemoClick('child')}
                  className="p-3 text-left rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 transition-all flex flex-col gap-1 group"
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900">
                    <Compass className="w-3.5 h-3.5 text-stone-700" />
                    <span>Demo Child</span>
                  </div>
                  <span className="text-[11px] text-stone-600 line-clamp-1">Rahul (Age 16)</span>
                  <span className="text-[10px] text-stone-500">Connected to Robert</span>
                </button>
              </div>
            </div>

            {/* 3. Optional Email / Password Section */}
            <div className="pt-2">
              <div className="relative flex items-center justify-center my-3">
                <div className="border-t border-stone-200 w-full" />
                <span className="bg-white px-3 text-[11px] font-medium text-stone-400 uppercase tracking-wider shrink-0">
                  Email & Password
                </span>
                <div className="border-t border-stone-200 w-full" />
              </div>

              {/* Role Toggle for Registration */}
              {!isLogin && (
                <div className="grid grid-cols-2 gap-2 p-1 bg-stone-100 rounded-xl mb-3">
                  <button
                    type="button"
                    onClick={() => setRole('elder')}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      role === 'elder'
                        ? 'bg-amber-800 text-white shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    I am an Elder
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('child')}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      role === 'child'
                        ? 'bg-stone-900 text-white shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    I am a Child
                  </button>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                {!isLogin && (
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">Full Name</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                      <input
                        id="input-auth-name"
                        type="text"
                        required
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder={role === 'elder' ? 'Grandfather Robert' : 'Rahul'}
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-700"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                    <input
                      id="input-auth-email"
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="name@family.com"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                    <input
                      id="input-auth-password"
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-700"
                    />
                  </div>
                </div>

                {!isLogin && role === 'child' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-700 mb-1">Age</label>
                      <input
                        type="number"
                        min={5}
                        max={100}
                        value={age}
                        onChange={e => setAge(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-stone-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-700 mb-1">Learning Style</label>
                      <select
                        value={learningStyle}
                        onChange={e => setLearningStyle(e.target.value as LearningStyle)}
                        className="w-full px-2 py-1.5 text-xs rounded-lg border border-stone-300 bg-white"
                      >
                        <option value="Storytelling">Storytelling</option>
                        <option value="Conversational">Conversational</option>
                        <option value="Practical">Practical</option>
                      </select>
                    </div>
                  </div>
                )}

                <button
                  id="btn-auth-submit"
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-lg text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 transition-colors flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isLogin ? 'Sign In with Email' : 'Register with Email'}</span>
                </button>
              </form>
            </div>

            {/* Switch mode */}
            <div className="pt-2 text-center text-xs text-stone-500">
              {isLogin ? (
                <p>
                  Need a new account?{' '}
                  <button
                    type="button"
                    onClick={() => setIsLogin(false)}
                    className="text-amber-800 font-semibold hover:underline"
                  >
                    Register here
                  </button>
                </p>
              ) : (
                <p>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setIsLogin(true)}
                    className="text-amber-800 font-semibold hover:underline"
                  >
                    Sign in here
                  </button>
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
