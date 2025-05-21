import React, { useState } from 'react';
import Room from './components/Room';
import { Toaster } from 'react-hot-toast';

function App() {
  const [isJoined, setIsJoined] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (roomId && name) {
      setIsJoined(true);
    }
  };

  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (name) {
      const newRoomId = Math.random().toString(36).substring(2, 7);
      console.log(`Room created with ID: ${newRoomId}`);
      
      setRoomId(newRoomId);
      setIsCreating(true);
      setIsJoined(true);
    }
  };

  const toggleMode = () => {
    setIsCreating(!isCreating);
    setRoomId('');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Toaster position="top-right" />
      {!isJoined ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
            <h1 className="text-2xl font-bold mb-6 text-center text-indigo-600">
              {isCreating ? 'Create Video Conference' : 'Join Video Conference'}
            </h1>
            <form onSubmit={isCreating ? handleCreateRoom : handleJoinRoom}>
              {!isCreating && (
                <div className="mb-4">
                  <label htmlFor="roomId" className="block text-gray-700 mb-2">Room ID</label>
                  <input
                    type="text"
                    id="roomId"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter room ID"
                    required
                  />
                </div>
              )}
              <div className="mb-6">
                <label htmlFor="name" className="block text-gray-700 mb-2">Your Name</label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter your name"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition duration-300 mb-4"
              >
                {isCreating ? 'Create Room' : 'Join Room'}
              </button>
              <button
                type="button"
                onClick={toggleMode}
                className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300 transition duration-300"
              >
                {isCreating ? 'Switch to Join Room' : 'Switch to Create Room'}
              </button>
            </form>
          </div>
        </div>
      ) : (
        <Room roomId={roomId} name={name} isCreating={isCreating} />
      )}
    </div>
  );
}

export default App;