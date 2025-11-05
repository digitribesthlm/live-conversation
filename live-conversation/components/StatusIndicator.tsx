
import React from 'react';

interface StatusIndicatorProps {
  status: 'idle' | 'connecting' | 'listening' | 'speaking' | 'error';
}

const statusConfig = {
  idle: { text: 'Ready to connect', color: 'bg-gray-500' },
  connecting: { text: 'Connecting...', color: 'bg-yellow-500 animate-pulse' },
  listening: { text: 'Listening...', color: 'bg-green-500 animate-pulse' },
  speaking: { text: 'Gemini is speaking...', color: 'bg-blue-500 animate-pulse' },
  error: { text: 'Connection Error', color: 'bg-red-500' },
};

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status }) => {
  const { text, color } = statusConfig[status];

  return (
    <div className="flex items-center justify-center space-x-3 p-2 rounded-full bg-gray-800/50">
      <span className={`w-3 h-3 rounded-full ${color}`}></span>
      <span className="text-sm font-medium text-gray-300">{text}</span>
    </div>
  );
};

export default StatusIndicator;
