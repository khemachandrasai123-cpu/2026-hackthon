import React from 'react';
import { BookOpen, Users, Compass, ArrowRight, Mic, Heart, MessageSquare, ShieldCheck } from 'lucide-react';
import { UserRole } from '../../types';

interface LandingPageProps {
  onSelectRole: (role: UserRole) => void;
  onOpenLogin: () => void;
  onDemoLogin?: (role: UserRole) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onSelectRole, onOpenLogin, onDemoLogin }) => {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans flex flex-col justify-between">
      {/* Navigation */}
      <header className="border-b border-stone-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-800 flex items-center justify-center text-white shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <span className="text-lg font-serif font-bold text-stone-900 block leading-tight">
                Living Family Mentor
              </span>
              <span className="text-xs text-stone-500 font-sans">
                Private Family Wisdom
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="btn-nav-login"
              onClick={onOpenLogin}
              className="px-4 py-2 rounded-xl text-sm font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors"
            >
              Sign In
            </button>
            <button
              id="btn-nav-get-started"
              onClick={() => onSelectRole('elder')}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-amber-800 hover:bg-amber-900 text-white shadow-xs transition-colors"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-4xl mx-auto px-6 py-12 sm:py-16 text-center flex-1 flex flex-col justify-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-100/80 text-amber-900 text-xs font-semibold mx-auto mb-6 border border-amber-200">
          <Heart className="w-3.5 h-3.5 text-amber-700 fill-amber-700" />
          <span>Real Stories • Real Advice • True Family Heritage</span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif font-bold text-stone-900 tracking-tight leading-tight mb-5">
          Preserve your family's wisdom. <br className="hidden sm:inline" />
          <span className="text-amber-800">For generations to come.</span>
        </h1>

        <p className="text-base sm:text-lg text-stone-600 max-w-xl mx-auto mb-8 leading-relaxed">
          Record life stories and lessons. Young family members can ask questions and receive advice based on real family memories.
        </p>

        {/* 2 Big Clear Role Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto w-full mb-6">
          <button
            id="btn-role-elder"
            onClick={() => onSelectRole('elder')}
            className="p-5 rounded-2xl bg-amber-800 hover:bg-amber-900 text-white shadow-sm transition-all flex items-center justify-between group text-left border border-amber-900"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-amber-700/80 flex items-center justify-center text-amber-100">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <span className="block font-bold text-base">I am an Elder</span>
                <span className="text-xs text-amber-200">Record & share stories</span>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-amber-300 group-hover:translate-x-1 transition-transform" />
          </button>

          <button
            id="btn-role-child"
            onClick={() => onSelectRole('child')}
            className="p-5 rounded-2xl bg-stone-900 hover:bg-black text-white shadow-sm transition-all flex items-center justify-between group text-left"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-stone-800 flex items-center justify-center text-amber-400">
                <Compass className="w-6 h-6" />
              </div>
              <div>
                <span className="block font-bold text-base">I am a Child</span>
                <span className="text-xs text-stone-400">Ask & listen to advice</span>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-stone-300 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* 1-Click Instant Demo Bar */}
        {onDemoLogin && (
          <div className="inline-flex flex-wrap items-center justify-center gap-2 p-2 rounded-xl bg-white border border-stone-200 text-xs text-stone-600 shadow-2xs mx-auto mb-12">
            <span className="font-semibold text-stone-700 pl-2">Try 1-Click Demo:</span>
            <button
              type="button"
              onClick={() => onDemoLogin('elder')}
              className="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 font-semibold transition-colors border border-amber-200"
            >
              Grandpa Robert
            </button>
            <button
              type="button"
              onClick={() => onDemoLogin('child')}
              className="px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-900 font-semibold transition-colors border border-stone-200"
            >
              Rahul (Age 16)
            </button>
          </div>
        )}

        {/* 3 Simple Features */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-3xl mx-auto text-left pt-4">
          <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-2xs">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mb-3">
              <Mic className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-stone-900 mb-1">Speak or Write</h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Record voice stories or quick written memories with ease.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-2xs">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mb-3">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-stone-900 mb-1">Ask Anytime</h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Kids ask real life questions and get advice adapted for their age.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-2xs">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mb-3">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-stone-900 mb-1">100% Real Memories</h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Answers only come from real recordings. Nothing made up.
            </p>
          </div>
        </div>
      </main>

      {/* Clean minimal footer */}
      <footer className="border-t border-stone-200 py-6 text-center text-xs text-stone-400 bg-white">
        <p>Living Family Mentor • Private family wisdom archive</p>
      </footer>
    </div>
  );
};
