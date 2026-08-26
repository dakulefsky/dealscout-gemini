import React, { useState } from 'react';
import { Sparkles, Send, Bot, User, Loader2, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ai as aiApi } from '@/lib/api';

export default function AiDealAssistant({ deal }) {
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: `Hi! I'm the DealScout AI Advisor. Ask me anything about the **${deal.title?.substring(0, 45)}...** (specs, competitor comparisons, real-world durability, or value assessment).`,
    },
  ]);

  const quickPrompts = [
    'Is this price genuinely a good discount?',
    'What are the most common complaints?',
    'Who is this product best suited for?',
    'How does it compare to alternatives in this category?',
  ];

  const handleSend = async (customPrompt) => {
    const queryText = customPrompt || question;
    if (!queryText.trim() || isLoading) return;

    const userMsg = { role: 'user', text: queryText };
    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setQuestion('');
    setIsLoading(true);

    try {
      const res = await aiApi.askAssistant({
        dealId: deal.id || deal.asin,
        dealData: deal,
        question: queryText,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: res.answer || 'I could not generate an answer for that question.',
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: '⚠️ Sorry, I encountered an issue analyzing this product. Please try again.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-slate-700/60 overflow-hidden relative">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-inner">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-lg text-white flex items-center gap-2">
              Gemini Deal Advisor
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                AI Powered
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Instant unbiased answers grounded in specifications and customer feedback
            </p>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="space-y-3.5 max-h-72 overflow-y-auto pr-1 mb-6 text-sm">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {m.role === 'assistant' && (
              <div className="w-7 h-7 rounded-xl bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-4 h-4" />
              </div>
            )}
            <div
              className={`p-3.5 rounded-2xl max-w-[85%] leading-relaxed ${
                m.role === 'user'
                  ? 'bg-emerald-600 text-white rounded-br-none'
                  : 'bg-slate-800/90 text-slate-200 border border-slate-700/80 rounded-bl-none prose prose-invert prose-sm'
              }`}
            >
              <div className="whitespace-pre-wrap">{m.text}</div>
            </div>
            {m.role === 'user' && (
              <div className="w-7 h-7 rounded-xl bg-slate-700 text-slate-300 flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3 justify-start items-center text-slate-400 text-xs py-2">
            <div className="w-7 h-7 rounded-xl bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 flex items-center justify-center shrink-0">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
            <span>Analyzing product details with Gemini...</span>
          </div>
        )}
      </div>

      {/* Suggested Prompts */}
      <div className="mb-4">
        <div className="text-xs text-slate-400 mb-2 flex items-center gap-1.5 font-medium">
          <HelpCircle className="w-3.5 h-3.5 text-slate-500" /> Suggested questions:
        </div>
        <div className="flex flex-wrap gap-2">
          {quickPrompts.map((prompt, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSend(prompt)}
              disabled={isLoading}
              className="text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl border border-slate-700/80 transition text-left"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Input bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex gap-2"
      >
        <Input
          type="text"
          placeholder="Ask a question about this deal..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={isLoading}
          className="bg-slate-800/90 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-emerald-500 rounded-xl"
        />
        <Button
          type="submit"
          disabled={isLoading || !question.trim()}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl px-4 shrink-0"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </form>
    </div>
  );
}
