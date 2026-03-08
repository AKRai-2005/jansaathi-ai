import { User, Bot } from 'lucide-react';

function MessageBubble({ message }) {
  const isUser = message.type === 'user';

  return (
    <div className={`flex items-end gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser ? 'bg-gradient-to-br from-orange-400 to-orange-600' : 'bg-gradient-to-br from-[#1E2A38] to-[#3a5068]'
      }`}>
        {isUser ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-md px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-2xl rounded-br-md shadow-md shadow-orange-200/50'
            : 'bg-white text-gray-800 rounded-2xl rounded-bl-md shadow-sm border border-gray-100'
        }`}
      >
        <p className="whitespace-pre-wrap">{message.text}</p>
      </div>
    </div>
  );
}

export default MessageBubble;
