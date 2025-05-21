import React from 'react';

const ParticipantList = ({
    participants,
    currentUserId,
    isAdmin,
    joinRequests,
    onApproveJoinRequest,
    onToggleParticipantAudio,
    onToggleParticipantVideo,
    onRemoveParticipant
}) => {
    return (
        <div className="h-full overflow-y-auto">
            {/* Join requests (admin only) */}
            {isAdmin && joinRequests.length > 0 && (
                <div className="p-4 border-b border-gray-700">
                    <h3 className="text-sm font-medium text-gray-400 mb-2">Join Requests</h3>
                    {joinRequests.map(request => (
                        <div key={request.peerId} className="flex items-center justify-between py-2">
                            <span className="text-white">{request.name}</span>
                            <div className="flex space-x-2">
                                <button
                                    onClick={() => onApproveJoinRequest(request.peerId, true)}
                                    className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                                >
                                    Approve
                                </button>
                                <button
                                    onClick={() => onApproveJoinRequest(request.peerId, false)}
                                    className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                                >
                                    Deny
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Participants list */}
            <div className="p-4">
                <h3 className="text-sm font-medium text-gray-400 mb-2">
                    Participants ({participants.length})
                </h3>
                <ul className="space-y-2">
                    {participants.map(participant => (
                        <li key={participant.id} className="flex items-center justify-between">
                            <div className="flex items-center">
                                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center mr-2">
                                    <span className="text-white text-sm">
                                        {participant.name?.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <span className={`${
                                    participant.id === currentUserId ? 'text-indigo-400' : 'text-white'
                                }`}>
                                    {participant.name}
                                    {participant.isAdmin && ' (Admin)'}
                                </span>
                                {participant.handRaised && (
                                    <span className="ml-2 text-yellow-400">✋</span>
                                )}
                            </div>

                            {isAdmin && participant.id !== currentUserId && (
                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => onToggleParticipantAudio(participant.id, !participant.audioEnabled)}
                                        className={`p-1 rounded ${
                                            participant.audioEnabled ? 'bg-gray-600 text-white' : 'bg-red-600 text-white'
                                        }`}
                                        title={participant.audioEnabled ? 'Mute' : 'Unmute'}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => onToggleParticipantVideo(participant.id, !participant.videoEnabled)}
                                        className={`p-1 rounded ${
                                            participant.videoEnabled ? 'bg-gray-600 text-white' : 'bg-red-600 text-white'
                                        }`}
                                        title={participant.videoEnabled ? 'Stop Video' : 'Start Video'}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => onRemoveParticipant(participant.id)}
                                        className="p-1 rounded bg-red-600 text-white"
                                        title="Remove"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default ParticipantList;