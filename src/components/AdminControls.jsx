import React from 'react';
const AdminControls = ({ participants, onToggleAudio, onToggleVideo, onKick, onPromote }) => {
  return (
    <div className="p-4 space-y-4 overflow-y-auto">
      <h3 className="text-white font-medium mb-2">Manage Participants</h3>
      
      <div className="space-y-2">
        {participants.map(participant => (
          <div key={participant.id} className="bg-gray-700 p-3 rounded-lg">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-white font-medium">
                  {participant.name}
                  {participant.isAdmin && (
                    <span className="ml-2 text-yellow-400 text-xs">(Admin)</span>
                  )}
                </p>
                <div className="flex space-x-2 mt-1">
                  <span className={`text-xs px-2 py-1 rounded-full ${participant.isAudioOn ? 'bg-green-600' : 'bg-red-600'}`}>
                    {participant.isAudioOn ? 'Audio On' : 'Audio Off'}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full ${participant.isVideoOn ? 'bg-green-600' : 'bg-red-600'}`}>
                    {participant.isVideoOn ? 'Video On' : 'Video Off'}
                  </span>
                </div>
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => onToggleAudio(participant.id)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded"
                  title="Mute participant"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </button>
                
                <button
                  onClick={() => onToggleVideo(participant.id)}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-2 py-1 rounded"
                  title="Disable video"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
                
                {!participant.isAdmin && (
                  <button
                    onClick={() => onPromote(participant.id)}
                    className="bg-yellow-600 hover:bg-yellow-700 text-white text-xs px-2 py-1 rounded"
                    title="Make admin"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                  </button>
                )}
                
                <button
                  onClick={() => onKick(participant.id)}
                  className="bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1 rounded"
                  title="Kick participant"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminControls;