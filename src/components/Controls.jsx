import React from 'react';
import { FaUsers } from 'react-icons/fa6';
import {
  FiMic,
  FiMicOff,
  FiVideo,
  FiVideoOff,
  FiMonitor,
  FiMessageSquare,
  FiLogOut,
  FiUser,
  FiSettings
} from 'react-icons/fi';
import { MdOutlineDownloadForOffline } from "react-icons/md";
import { PiHandPalmDuotone } from 'react-icons/pi';
const Controls = ({
  isMuted,
  videoUrl,
  isVideoOff,
  isScreenSharing,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onLeaveRoom,
  onToggleChat,
  chatOpen,
  someoneshare,
  setVideoUrl,
  peerId,
  onToggleparticipants,
  showparticipants,
  onTogglehandraise,
  handraiseoption
}) => {
  return (
    <div className="p-3 relative">
      {videoUrl && (
        <div className="absolute left-2 bottom-2 p-2 group bg-gray-100 backdrop-blur-md rounded-full  cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-blue-300/30 border border-gray-300">
          <a
            href={videoUrl}
            download="page-recording.webm"
            className="flex items-center "
            onClick={() => {
              setVideoUrl(null); // Clear videoUrl after initiating download
            }}
          >
            <MdOutlineDownloadForOffline className="size-6 text-blue-500" />
            <button
              className="w-0 opacity-0 group-hover:w-auto group-hover:opacity-100 group-hover:px-2 transition-all duration-300 ease-in-out text-blue-500 font-semibold text-sm"
            >
              Download
            </button>
          </a>
        </div>
      )}

      <div className="flex justify-center space-x-4">
        <button
          onClick={onToggleAudio}
          className={`p-3 rounded-full transition-all ${isMuted ?
            'bg-red-400 text-white shadow-lg shadow-red-400/30' :
            'bg-gray-200 text-gray-700 hover:bg-blue-200 hover:text-gray-900'}`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <FiMicOff className="h-5 w-5" /> : <FiMic className="h-5 w-5" />}
        </button>

        <button
          onClick={onToggleVideo}
          className={`p-3 rounded-full transition-all ${isVideoOff ?
            'bg-red-400 text-white shadow-lg shadow-red-400/30' :
            'bg-gray-200 text-gray-700 hover:bg-blue-200 hover:text-gray-900'}`}
          title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
        >
          {isVideoOff ? <FiVideoOff className="h-5 w-5" /> : <FiVideo className="h-5 w-5" />}
        </button>

        <button
          onClick={onToggleScreenShare}
          disabled={someoneshare && peerId !== someoneshare?.id}
          className={`${someoneshare && peerId !== someoneshare?.id ? 'opacity-50 cursor-not-allowed' : ''} p-3 rounded-full transition-all ${isScreenSharing ?
            'bg-green-400 text-white shadow-lg shadow-green-400/30' :
            'bg-gray-200 text-gray-700 hover:bg-blue-200 hover:text-gray-900'}`}
          title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
        >
          <FiMonitor className="h-5 w-5" />
        </button>
        <button
          onClick={onTogglehandraise}
          className={`p-3 rounded-full transition-all ${handraiseoption ?
            'bg-yellow-500 text-white shadow-lg shadow-yellow-500/30' :
            'bg-gray-200 text-gray-700 hover:bg-yellow-200 hover:text-gray-900'}`}
          title={'hand raise'}
        >
          <PiHandPalmDuotone  className="h-5 w-5" />
        </button>
        <button
          onClick={onToggleparticipants}
          className={`p-3 rounded-full transition-all ${showparticipants ?
            'bg-purple-500 text-white shadow-lg shadow-purple-500/30' :
            'bg-gray-200 text-gray-700 hover:bg-purple-200 hover:text-gray-900'}`}
          title={showparticipants ? 'Hide chat' : 'Show chat'}
        >
          <FaUsers  className="h-5 w-5" />
        </button>

        <button
          onClick={onToggleChat}
          className={`p-3 rounded-full transition-all ${chatOpen ?
            'bg-blue-500 text-white shadow-lg shadow-blue-500/30' :
            'bg-gray-200 text-gray-700 hover:bg-blue-200 hover:text-gray-900'}`}
          title={chatOpen ? 'Hide Participants' : 'Show Participants'}
        >
          <FiMessageSquare className="h-5 w-5" />
        </button>

        <button
          onClick={onLeaveRoom}
          className="p-3 rounded-full bg-red-400 text-white shadow-lg shadow-red-400/30 hover:bg-red-500 transition-all"
          title="Leave room"
        >
          <FiLogOut className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export default Controls;