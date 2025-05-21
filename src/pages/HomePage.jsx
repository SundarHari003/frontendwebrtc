import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setUser } from '../redux/slice/roomSlice';

const HomePage = () => {
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    dispatch(setUser({ name, isAdmin: true, videoEnabled: true, audioEnabled: true }));
    navigate('/room/create');
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (!name.trim() || !roomId.trim()) {
      setError('Please enter your name and room ID');
      return;
    }
    dispatch(setUser({ name, isAdmin: false, videoEnabled: true, audioEnabled: true }));
    navigate(`/room/${roomId}`);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center text-gray-800">Video Conference</h1>
        
        {/* Create Room Section */}
        <form onSubmit={handleCreateRoom} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Your Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your name"
            />
          </div>
          <button
            type="submit"
            className="w-full px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Create New Room
          </button>
        </form>

        <div className="relative flex items-center justify-center">
          <div className="absolute w-full border-t border-gray-300"></div>
          <span className="relative px-2 text-sm text-gray-500 bg-white">OR</span>
        </div>

        {/* Join Room Section */}
        <form onSubmit={handleJoinRoom} className="space-y-4">
          <div>
            <label htmlFor="join-name" className="block text-sm font-medium text-gray-700">
              Your Name
            </label>
            <input
              type="text"
              id="join-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your name"
            />
          </div>
          <div>
            <label htmlFor="room-id" className="block text-sm font-medium text-gray-700">
              Room ID
            </label>
            <input
              type="text"
              id="room-id"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter room ID"
            />
          </div>
          <button
            type="submit"
            className="w-full px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            Join Existing Room
          </button>
        </form>

        {error && (
          <div className="p-3 text-sm text-red-700 bg-red-100 rounded-md">
            {error}
          </div>
        )}

        <div className="text-sm text-gray-600">
          <p className="text-center">
            By joining, you agree to our <a href="#" className="text-blue-600 hover:underline">Terms of Service</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default HomePage;