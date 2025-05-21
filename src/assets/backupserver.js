const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mediasoup = require('mediasoup');
const cors = require('cors');
const Room = require('./room');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Mediasoup settings
const mediasoupSettings = {
  worker: {
    rtcMinPort: 10000,
    rtcMaxPort: 10100,
    logLevel: 'warn',
    logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp']
  },
  router: {
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
        parameters: {
          minptime: 10,
          useinbandfec: 1
        }
      },
      {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {
          'x-google-start-bitrate': 1000
        }
      },
      {
        kind: 'video',
        mimeType: 'video/H264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,
          'profile-level-id': '42e01f',
          'level-asymmetry-allowed': 1
        }
      }
    ]
  }
};

let worker;
let rooms = new Map();

async function createWorker() {
  worker = await mediasoup.createWorker(mediasoupSettings.worker);

  worker.on('died', () => {
    console.error('mediasoup worker died, exiting...');
    process.exit(1);
  });

  return worker;
}

// Health check endpoint
app.get('/health', (req, res) => {
  const roomStatus = Array.from(rooms.values()).map(room => ({
    roomId: room.roomId,
    peers: room.getPeers().size,
    health: room.checkHealth()
  }));

  res.json({
    status: 'ok',
    mediasoupVersion: mediasoup.version,
    workerPid: worker ? worker.pid : 'none',
    rooms: roomStatus
  });
});

// Consumer validation endpoint
app.post('/validate-consumer/:roomId', express.json(), (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const { producerId, rtpCapabilities } = req.body;

  if (!producerId || !rtpCapabilities) {
    return res.status(400).json({ error: 'Missing producerId or rtpCapabilities' });
  }

  try {
    const canConsume = room.router.canConsume({
      producerId,
      rtpCapabilities
    });

    res.json({
      canConsume,
      routerCapabilities: room.getRouterRtpCapabilities()
    });
  } catch (err) {
    res.status(400).json({
      error: err.message,
      details: {
        producerId,
        rtpCapabilities
      }
    });
  }
});

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');

  // Close all rooms
  for (const [roomId, room] of rooms) {
    room.getPeers().forEach(peer => room.removePeer(peer.id));
    rooms.delete(roomId);
    console.log(`Closed room ${roomId}`);
  }

  // Close worker
  if (worker) {
    await worker.close();
    console.log('Mediasoup worker closed');
  }

  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

// Initialize mediasoup worker
async function startServer() {
  try {
    console.log(`Starting server with mediasoup v${mediasoup.version}`);

    worker = await createWorker();
    console.log(`Mediasoup worker created (PID: ${worker.pid})`);

    io.on('connection', async (socket) => {
      console.log('Client connected:', socket.id);

      // Helper for error handling
      const wrapAsync = (fn) => async (data, callback) => {
        try {
          const result = await fn(data);
          callback({ success: true, ...result });
        } catch (err) {
          console.error(`Error in ${fn.name || 'handler'}:`, err);
          callback({
            success: false,
            error: err.message,
            details: data
          });
        }
      };
      const logError = (context, error, details = {}) => {
        console.error({
          timestamp: new Date().toISOString(),
          context,
          message: error.message,
          stack: error.stack,
          details
        });
      };

      // Update createRoom handler with admin controls
      socket.on('createRoom', async ({ roomId, name }, callback) => {
        try {
          if (rooms.has(roomId)) {
            return callback({ success: false, error: 'Room already exists' });
          }

          const router = await worker.createRouter({
            mediaCodecs: mediasoupSettings.router.mediaCodecs
          });
          
          rooms.set(roomId, new Room(router, roomId));
          const room = rooms.get(roomId);

          // Enhanced admin properties
          const peerDetails = {
            id: socket.id,
            name: name || 'Admin',
            isAdmin: true,
            handRaise: false,
            isVideoOn: false,
            isAudioOn: false,
            sharingScreen: false,
            isAdmitted: true, // Admin is automatically admitted
            pendingApproval: false
          };

          await room.addPeer(socket.id, peerDetails);
          socket.join(roomId);

          const users = Array.from(room.getPeers().values());
          
          callback({ 
            success: true,
            roomId,
            users,
            isAdmin: true
          });

          // Send initial room state
          const rtpCapabilities = room.getRouterRtpCapabilities();
          socket.emit('routerCapabilities', rtpCapabilities);
        } catch (err) {
          console.error('Error creating room:', err);
          callback({ success: false, error: err.message });
        }
      });

      // New request-to-join handler
      socket.on('request-to-join', async ({ roomId, name }, callback) => {
        try {
          const room = rooms.get(roomId);
          if (!room) {
            return callback({ success: false, error: 'Room not found' });
          }

          const peerDetails = {
            id: socket.id,
            name: name || 'Anonymous',
            isAdmin: false,
            handRaise: false,
            isVideoOn: false,
            isAudioOn: false,
            sharingScreen: false,
            isAdmitted: false,
            pendingApproval: true
          };

          // Store pending participant
          room.addPendingPeer(socket.id, peerDetails);

          // Notify admins about join request
          const admins = Array.from(room.getPeers().values())
            .filter(peer => peer.isAdmin)
            .map(peer => peer.id);

          admins.forEach(adminId => {
            io.to(adminId).emit('join-request', {
              peerId: socket.id,
              name: peerDetails.name
            });
          });

          callback({ 
            success: true, 
            message: 'Join request sent to admin' 
          });

        } catch (err) {
          callback({ success: false, error: err.message });
        }
      });

      // Admin admits participant
      socket.on('admit-participant', async ({ roomId, peerId }, callback) => {
        try {
          const room = rooms.get(roomId);
          if (!room) {
            return callback({ success: false, error: 'Room not found' });
          }

          // Verify admin status
          const adminPeer = room.getPeerDetails(socket.id);
          if (!adminPeer?.isAdmin) {
            return callback({ success: false, error: 'Unauthorized' });
          }

          const pendingPeer = room.getPendingPeer(peerId);
          if (!pendingPeer) {
            return callback({ success: false, error: 'Pending peer not found' });
          }

          // Admit the participant
          pendingPeer.isAdmitted = true;
          pendingPeer.pendingApproval = false;
          await room.addPeer(peerId, pendingPeer);
          room.removePendingPeer(peerId);

          // Notify admitted participant
          io.to(peerId).emit('admitted', {
            roomId,
            rtpCapabilities: room.getRouterRtpCapabilities()
          });
          
          // Notify all room participants
          const users = Array.from(room.getPeers().values());
          io.to(roomId).emit('participants-updated', { users });

          callback({ success: true });
        } catch (err) {
          callback({ success: false, error: err.message });
        }
      });

      // Media control events
      socket.on('toggle-media', async ({ roomId, type, enabled }, callback) => {
        try {
          const room = rooms.get(roomId);
          if (!room) {
            return callback({ success: false, error: 'Room not found' });
          }

          const peer = room.getPeerDetails(socket.id);
          if (!peer) {
            return callback({ success: false, error: 'Peer not found' });
          }

          if (type === 'video') {
            peer.isVideoOn = enabled;
          } else if (type === 'audio') {
            peer.isAudioOn = enabled;
          }

          room.updatePeerDetails(socket.id, peer);

          // Notify all participants about media state change
          io.to(roomId).emit('peer-media-toggle', {
            peerId: socket.id,
            type,
            enabled
          });

          callback({ success: true });
        } catch (err) {
          callback({ success: false, error: err.message });
        }
      });

      // Screen sharing events
      socket.on('toggle-screenshare', async ({ roomId, enabled }, callback) => {
        try {
          const room = rooms.get(roomId);
          if (!room) {
            return callback({ success: false, error: 'Room not found' });
          }

          const peer = room.getPeerDetails(socket.id);
          if (!peer) {
            return callback({ success: false, error: 'Peer not found' });
          }

          peer.sharingScreen = enabled;
          room.updatePeerDetails(socket.id, peer);

          io.to(roomId).emit('screenshare-toggle', {
            peerId: socket.id,
            enabled
          });

          callback({ success: true });
        } catch (err) {
          callback({ success: false, error: err.message });
        }
      });

      // Chat messages
      socket.on('send-message', async ({ roomId, message }, callback) => {
        try {
          const room = rooms.get(roomId);
          if (!room) {
            return callback({ success: false, error: 'Room not found' });
          }

          const peer = room.getPeerDetails(socket.id);
          if (!peer) {
            return callback({ success: false, error: 'Peer not found' });
          }

          const messageData = {
            senderId: socket.id,
            senderName: peer.name,
            message,
            timestamp: new Date().toISOString()
          };

          // Broadcast message to all room participants
          io.to(roomId).emit('new-message', messageData);
          callback({ success: true });
        } catch (err) {
          callback({ success: false, error: err.message });
        }
      });

      // Get participants list
      socket.on('get-participants', async ({ roomId }, callback) => {
        try {
          const room = rooms.get(roomId);
          if (!room) {
            return callback({ success: false, error: 'Room not found' });
          }

          const participants = Array.from(room.getPeers().values()).map(peer => ({
            id: peer.id,
            name: peer.name,
            isAdmin: peer.isAdmin,
            isVideoOn: peer.isVideoOn,
            isAudioOn: peer.isAudioOn,
            sharingScreen: peer.sharingScreen,
            handRaise: peer.handRaise
          }));

          callback({ 
            success: true, 
            participants 
          });
        } catch (err) {
          callback({ success: false, error: err.message });
        }
      });

      // Update joinRoom handler to include participant list updates
      socket.on('joinRoom', async ({ roomId, name }, callback) => {
        try {
          console.log(`${name} (${socket.id}) joining room ${roomId}`);

          if (!rooms.has(roomId)) {
            return callback({ success: false, error: 'Room does not exist' });
          }

          Array.from(socket.rooms).forEach(room => {
            if (room !== socket.id) socket.leave(room);
          });

          const room = rooms.get(roomId);
          
          const peerDetails = {
            id: socket.id,
            name: name || 'Anonymous',
            isAdmin: false,
            handRaise: false,
            isVideoOn: true,
            isAudioOn: true,
            sharingScreen: false
          };

          await room.addPeer(socket.id, peerDetails);

          socket.join(roomId, () => {
            console.log(`Socket ${socket.id} joined room ${roomId}`);
          });

          // Get all users in room with their current states
          const users = Array.from(room.getPeers().values()).map(peer => ({
            id: peer.id,
            name: peer.name,
            isAdmin: peer.isAdmin,
            handRaise: peer.handRaise,
            isVideoOn: peer.isVideoOn,
            isAudioOn: peer.isAudioOn,
            sharingScreen: peer.sharingScreen
          }));

          // Notify all participants (including the new one) about updated user list
          io.to(roomId).emit('participants-updated', {
            users,
            joiningPeer: {
              peerId: socket.id,
              ...peerDetails
            }
          });

          // Send initial data to joining participant
          callback({ 
            success: true,
            users,
            currentPeer: peerDetails
          });
          
          const rtpCapabilities = room.getRouterRtpCapabilities();
          socket.emit('routerCapabilities', rtpCapabilities);

          const producers = room.getProducerList();
          socket.emit('producerList', producers);

        } catch (err) {
          console.error('Error joining room:', err);
          callback({ success: false, error: err.message });
        }
      });

      // Transport creation
      socket.on('createWebRtcTransport', wrapAsync(async ({ direction }) => {
        const roomId = Array.from(socket.rooms).find(room => room !== socket.id);
        if (!roomId) throw new Error('Not in a room');

        const room = rooms.get(roomId);
        if (!room) throw new Error('Room not found');

        const { transport, params } = await room.createWebRtcTransport(socket.id, direction);
        return { params };
      }));

      // Transport connection
      socket.on('connectTransport', wrapAsync(async ({ transportId, dtlsParameters }) => {
        const roomId = Array.from(socket.rooms).find(room => room !== socket.id);
        if (!roomId) throw new Error('Not in a room');

        const room = rooms.get(roomId);
        if (!room) throw new Error('Room not found');

        await room.connectTransport(socket.id, transportId, dtlsParameters);
        return { transportId };
      }));

      // Producer creation
      socket.on('produce', wrapAsync(async ({ transportId, kind, rtpParameters, appData }) => {
        const roomId = Array.from(socket.rooms).find(room => room !== socket.id);
        if (!roomId) throw new Error('Not in a room');

        const room = rooms.get(roomId);
        if (!room) throw new Error('Room not found');

        const { producerId } = await room.produce(socket.id, transportId, kind, rtpParameters, appData);

        // Notify other peers
        socket.to(roomId).emit('newProducer', {
          peerId: socket.id,
          producerId,
          kind,
          appData // Include appData in newProducer event
        });

        return { producerId };
      }));

      // Consumer creation
      socket.on('consume', wrapAsync(async ({ transportId, producerId, rtpCapabilities }) => {
        const roomId = Array.from(socket.rooms).find(room => room !== socket.id);
        if (!roomId) throw new Error('Not in a room');

        const room = rooms.get(roomId);
        if (!room) throw new Error('Room not found');

        const { params } = await room.consume(socket.id, transportId, producerId, rtpCapabilities);
        return { params };
      }));

      // Consumer resumption
      socket.on('resumeConsumer', wrapAsync(async ({ consumerId }) => {
        const roomId = Array.from(socket.rooms).find(room => room !== socket.id);
        if (!roomId) throw new Error('Not in a room');

        const room = rooms.get(roomId);
        if (!room) throw new Error('Room not found');

        await room.resumeConsumer(socket.id, consumerId);
        return { consumerId };
      }));

      socket.on('reconnect', async ({ peerId, roomId }, callback) => {
        try {
          const room = rooms.get(roomId);
          if (!room) {
            return callback({ success: false, error: 'Room not found' });
          }

          // Check if peer exists and update socket ID
          if (room.getPeers().has(peerId)) {
            await room.updatePeerSocket(peerId, socket.id);

            // Re-join the socket.io room
            await socket.join(roomId);

            // Send room state
            const rtpCapabilities = room.getRouterRtpCapabilities();
            socket.emit('routerCapabilities', rtpCapabilities);

            // Send existing producers
            const producers = room.getProducerList();
            socket.emit('producerList', producers);

            callback({ success: true });
          } else {
            callback({ success: false, error: 'Peer not found' });
          }
        } catch (err) {
          console.error('Error in reconnect:', err);
          callback({ success: false, error: err.message });
        }
      });

      // Update peer properties
      socket.on('updatePeerProperties', async ({ property, value }, callback) => {
        try {
          const roomId = Array.from(socket.rooms).find(room => room !== socket.id);
          if (!roomId) throw new Error('Not in a room');

          const room = rooms.get(roomId);
          if (!room) throw new Error('Room not found');

          const peer = room.getPeerDetails(socket.id);
          if (!peer) throw new Error('Peer not found');

          // Update the specific property
          peer[property] = value;
          room.updatePeerDetails(socket.id, peer);

          // Notify other peers about the update
          socket.to(roomId).emit('peerPropertiesUpdated', {
            peerId: socket.id,
            property,
            value
          });

          callback({ success: true });
        } catch (err) {
          console.error('Error updating peer properties:', err);
          callback({ success: false, error: err.message });
        }
      });

      // Disconnect handler
      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);

        // Find and clean up all rooms this peer was in
        Array.from(rooms.entries()).forEach(([roomId, room]) => {
          if (room.getPeers().has(socket.id)) {
            const peerDetails = room.getPeerDetails(socket.id);
            const peerName = peerDetails ? peerDetails.name : 'Unknown';
            room.removePeer(socket.id);
            socket.to(roomId).emit('peerClosed', { peerId: socket.id,peerName });

            // Clean up empty rooms
            if (room.getPeers().size === 0) {
              rooms.delete(roomId);
              console.log(`Room ${roomId} closed (no more peers)`);
            }
          }
        });
      });
    });

    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
      console.log(`Mediasoup worker running (PID: ${worker.pid})`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();