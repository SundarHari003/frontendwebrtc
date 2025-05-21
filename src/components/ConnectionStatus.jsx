import React, { useEffect, useState } from 'react';

const ConnectionStatus = ({ status, error }) => {
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    if (status !== 'connected' || error) {
      setIsVisible(true);
      const timer = setTimeout(() => setIsVisible(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [status, error]);
  
  if (!isVisible) return null;

  const statusConfig = {
    connected: { bg: 'bg-green-500', text: 'Connected' },
    connecting: { bg: 'bg-blue-500', text: 'Connecting...' },
    disconnected: { bg: 'bg-yellow-500', text: error || 'Disconnected. Reconnecting...' },
    error: { bg: 'bg-red-500', text: error || 'Connection error' }
  };

  const config = statusConfig[status] || statusConfig.error;

  return (
    <div className={`fixed bottom-4 left-4 p-3 rounded-md text-white ${config.bg} shadow-lg flex items-center`}>
      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {status === 'connected' ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        ) : status === 'connecting' ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        )}
      </svg>
      <span>{config.text}</span>
    </div>
  );
};

export default ConnectionStatus;