import React, { useState } from 'react';
import { Sparkles, HelpCircle, Loader2, ArrowRight } from 'lucide-react';

interface GuidedInterviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPrompt: (question: string, category: string) => void;
}

export const GuidedInterviewModal: React.FC<GuidedInterviewModalProps> = ({
  isOpen,
  onClose,
  onSelectPrompt
}) => {
  const [category, setCategory] = useState('Life Lessons');
  const [loading, setLoading] = useState(false);
  const [prompts, setPrompts] = useState<Array<{ question: string; category: string; whyItMatters?: string }>>([
    { question: 'What was your childhood like and what was your favorite family tradition?', category: 'Memories' },
    { question: 'What was your first job and what did that first paycheck mean to you?', category: 'Career & Work' },
    { question: 'What was one mistake or failure that taught you something unforgettable?', category: 'Life Lessons' },
    { question: 'What decision are you most proud of in your life?', category: 'Milestones' },
    { question: 'What advice would you give to your 16-year-old self?', category: 'Wisdom' },
    { question: 'What values are most important for our family to continue practicing?', category: 'Values' }
  ]);

  if (!isOpen) return null;

  const handleGenerateFresh = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/interview-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.prompts && data.prompts.length > 0) {
          setPrompts(data.prompts);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-stone-200 overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-6 border-b border-stone-200 bg-amber-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-800 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-serif font-bold text-stone-900">
                Guided Elder Interview
              </h3>
              <p className="text-xs text-stone-600">
                AI-curated reflection prompts to help you recall and preserve meaningful moments
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-stone-100"
          >
            Cancel
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-stone-100">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
              Choose a prompt to answer
            </span>
            <button
              onClick={handleGenerateFresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>Generate New AI Questions</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {prompts.map((p, idx) => (
              <button
                key={idx}
                id={`btn-interview-prompt-${idx}`}
                onClick={() => {
                  onSelectPrompt(p.question, p.category);
                  onClose();
                }}
                className="text-left p-4 rounded-xl border border-stone-200 hover:border-amber-700 hover:bg-amber-50/40 transition-all group flex items-start justify-between gap-4"
              >
                <div>
                  <span className="inline-block text-[11px] font-semibold text-amber-800 uppercase tracking-wide bg-amber-100/70 px-2 py-0.5 rounded-md mb-2">
                    {p.category}
                  </span>
                  <p className="text-base font-serif font-medium text-stone-900 group-hover:text-amber-950">
                    "{p.question}"
                  </p>
                  {p.whyItMatters && (
                    <p className="text-xs text-stone-500 mt-1">{p.whyItMatters}</p>
                  )}
                </div>
                <div className="w-8 h-8 rounded-full bg-stone-100 group-hover:bg-amber-800 group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
