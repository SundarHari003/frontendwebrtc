import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  currentUser: null,
  currentRoom: null,
  participants: [],
  pendingRequests: [],
  connectionStatus: 'disconnected', // 'connected', 'connecting', 'disconnected', 'error'
  mediaState: {
    videoEnabled: true,
    audioEnabled: true,
    screenShareEnabled: false
  },
  error: null
};

export const roomSlice = createSlice({
  name: 'room',
  initialState,
  reducers: {
    setUser: (state, action) => {
      state.currentUser = action.payload;
    },
    setRoom: (state, action) => {
      state.currentRoom = action.payload;
    },
    resetRoom: (state) => {
      return initialState;
    },
    setConnectionStatus: (state, action) => {
      state.connectionStatus = action.payload;
    },
    addParticipant: (state, action) => {
      state.participants.push(action.payload);
    },
    removeParticipant: (state, action) => {
      state.participants = state.participants.filter(p => p.id !== action.payload);
    },
    updateParticipant: (state, action) => {
      const index = state.participants.findIndex(p => p.id === action.payload.userId);
      if (index !== -1) {
        state.participants[index] = { ...state.participants[index], ...action.payload };
      }
    },
    setParticipants: (state, action) => {
      state.participants = action.payload;
    },
    setPendingRequests: (state, action) => {
      state.pendingRequests = action.payload;
    },
    setMediaState: (state, action) => {
      state.mediaState = { ...state.mediaState, ...action.payload };
    },
    setError: (state, action) => {
      state.error = action.payload;
    }
  }
});

export const {
  setUser,
  setRoom,
  resetRoom,
  setConnectionStatus,
  addParticipant,
  removeParticipant,
  updateParticipant,
  setParticipants,
  setPendingRequests,
  setMediaState,
  setError
} = roomSlice.actions;

export default roomSlice.reducer;