import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Send, Sparkles, User, Tractor, Heart, GraduationCap, Bot, ArrowDown } from 'lucide-react';
import MessageBubble from '../components/MessageBubble';
import SchemeCard from '../components/SchemeCard';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const DEMO_PERSONAS = [
  {
    name: 'Ramesh — Farmer, UP',
    description: 'Hindi-speaking BPL farmer with 2 acres',
    icon: Tractor,
    message: 'Main UP ka kisan hoon, 2 acre zameen hai, meri umar 45 saal hai, BPL card bhi hai',
    language: 'hi',
    color: 'from-emerald-500 to-emerald-600',
  },
  {
    name: 'Lakshmi — SHG, Tamil Nadu',
    description: 'Tamil-speaking mother with BPL card',
    icon: Heart,
    message: 'Naan Tamil Nadu-la irukken, en veettula 3 pillaikal irukku, BPL card irukku',
    language: 'ta',
    color: 'from-rose-500 to-rose-600',
  },
  {
    name: 'Arjun — Student, Karnataka',
    description: 'SC student, class 11, low income',
    icon: GraduationCap,
    message: 'I am a SC category student from Karnataka, studying in class 11, family income is 1 lakh per year',
    language: 'en',
    color: 'from-indigo-500 to-indigo-600',
  },
];

function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const sendMessage = async (text, language = 'en') => {
    if (!text.trim()) return;

    setMessages((prev) => [...prev, { type: 'user', text }]);
    setInputText('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/api/check-eligibility`, {
        message: text,
        language,
        userId: 'web-user-' + Date.now(),
      });

      setMessages((prev) => [
        ...prev,
        {
          type: 'bot',
          text: response.data.responseMessage,
          schemes: response.data.schemes,
        },
      ]);
    } catch (error) {
      console.error('Error:', error);
      setMessages((prev) => [
        ...prev,
        {
          type: 'bot',
          text: 'Sorry, something went wrong. Please try again.',
          schemes: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(inputText);
  };

  const handlePersonaClick = (persona) => {
    sendMessage(persona.message, persona.language);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Persona Cards */}
      {messages.length === 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Try a Demo Persona</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {DEMO_PERSONAS.map((persona, idx) => {
              const Icon = persona.icon;
              return (
                <button
                  key={idx}
                  onClick={() => handlePersonaClick(persona)}
                  className="group text-left bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-lg hover:shadow-gray-200/50 transition-all hover:-translate-y-0.5"
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${persona.color} flex items-center justify-center mb-3 shadow-sm`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{persona.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{persona.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Chat Container */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col" style={{ height: messages.length === 0 ? '420px' : '600px' }}>
        {/* Chat Header */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#1E2A38] to-[#3a5068] flex items-center justify-center">
            <Bot className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">JanSaathi Assistant</p>
            <p className="text-xs text-gray-500">Powered by AWS Bedrock &middot; 6 Languages</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs text-gray-500 font-medium">Online</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <Sparkles className="w-7 h-7 text-gray-300" />
              </div>
              <p className="text-base font-semibold text-gray-500">Welcome to JanSaathi</p>
              <p className="text-sm mt-1 text-center max-w-sm">
                Describe your situation in any Indian language to discover government welfare schemes you're eligible for.
              </p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx}>
              <MessageBubble message={msg} />
              {msg.schemes && msg.schemes.length > 0 && (
                <div className="mt-4 ml-10 space-y-3">
                  {msg.schemes.map((scheme) => (
                    <SchemeCard key={scheme.schemeId} scheme={scheme} />
                  ))}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-end gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1E2A38] to-[#3a5068] flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-md px-5 py-3.5 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="border-t border-gray-100 bg-gray-50/50 px-4 py-3">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Describe your situation in any language..."
              className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/50 focus:border-orange-400 placeholder-gray-400 transition-all"
              maxLength={4096}
            />
            <button
              type="submit"
              disabled={loading || !inputText.trim()}
              className="p-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl hover:shadow-lg hover:shadow-orange-200/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ChatPage;
