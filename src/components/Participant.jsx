import React, { useEffect, useRef } from 'react';

const Participant = ({ 
  stream, 
  videoRef, 
  name, 
  isAdmin, 
  isYou = false, 
  videoEnabled, 
  audioEnabled, 
  screenShareEnabled = false 
}) => {
  const videoElement = useRef(null);
  const audioElement = useRef(null);
  
  useEffect(() => {
    if (!stream) return;
    
    if (videoElement.current && stream.getVideoTracks().length > 0) {
      videoElement.current.srcObject = new MediaStream([stream.getVideoTracks()[0]]);
    }
    
    if (audioElement.current && stream.getAudioTracks().length > 0) {
      audioElement.current.srcObject = new MediaStream([stream.getAudioTracks()[0]]);
    }
    
    return () => {
      if (videoElement.current) videoElement.current.srcObject = null;
      if (audioElement.current) audioElement.current.srcObject = null;
    };
  }, [stream]);

  return (
    <div className={`relative rounded-lg overflow-hidden bg-gray-800 ${screenShareEnabled ? 'border-2 border-yellow-400' : ''}`}>
      {videoEnabled ? (
        <video
          ref={videoRef || videoElement}
          autoPlay
          playsInline
          muted={isYou}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-gray-700 flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-gray-600 flex items-center justify-center">
            <span className="text-2xl text-white">{name?.charAt(0).toUpperCase() || 'U'}</span>
          </div>
        </div>
      )}
      
      {/* Audio element for non-muted participants */}
      {!isYou && audioEnabled && (
        <audio ref={audioElement} autoPlay playsInline />
      )}
      
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {isAdmin && (
              <span className="bg-purple-500 text-white text-xs px-2 py-1 rounded mr-2">Admin</span>
            )}
            <span className="text-white font-medium">
              {name || 'Anonymous'} {isYou && '(You)'}
            </span>
          </div>
          <div className="flex space-x-2">
            {!videoEnabled && (
              <span className="bg-red-500 text-white text-xs px-2 py-1 rounded">
                Video Off
              </span>
            )}
            {!audioEnabled && (
              <span className="bg-red-500 text-white text-xs px-2 py-1 rounded">
                Mic Off
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Participant;