import React, { useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { Device } from 'mediasoup-client';
import Video from './Video';
import Controls from './Controls';
import toast from 'react-hot-toast';

const Room = ({ roomId, name, isCreating }) => {
  // State management
  const [socket, setSocket] = useState(null);
  const [device, setDevice] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [screenShareStream, setScreenShareStream] = useState(null);
  const [sendTransport, setSendTransport] = useState(null);
  const [recvTransport, setRecvTransport] = useState(null);
  const [producers, setProducers] = useState([]);
  const [consumers, setConsumers] = useState([]);
  const [producerObjects, setProducerObjects] = useState({});
  const [trackStates, setTrackStates] = useState({
    audio: true,
    video: true,
    screen: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [peerId, setPeerId] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [pendingPeers, setPendingPeers] = useState([]);
  const [isAdmin, setIsAdmin] = useState(isCreating);
  const [isAdmitted, setIsAdmitted] = useState(isCreating); // Admins are auto-admitted
  const [messages, setMessages] = useState([]);
  const [chatMessage, setChatMessage] = useState('');
  const [connectionStats, setConnectionStats] = useState(null);
  const [debugState, setDebugState] = useState('initializing');
  const [isMediaLoading, setIsMediaLoading] = useState(true); // Track WebRTC setup progress

  // Refs for cleanup
  const statsIntervalRef = useRef();
  const chatContainerRef = useRef();

  // Initialize socket connection
  useEffect(() => {
    setDebugState('connecting-socket');
    const newSocket = io('http://localhost:3001', {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      autoConnect: true,
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      setPeerId(newSocket.id);
      setSocket(newSocket);
      setError(null);
      setDebugState('socket-connected');
      toast.success('Connected to server');
      console.log('Socket connected, peerId:', newSocket.id);
    });

    newSocket.on('disconnect', (reason) => {
      setDebugState('socket-disconnected');
      setError('Connection lost. Trying to reconnect...');
      toast.error('Disconnected from server');
      console.log('Socket disconnected:', reason);
    });

    newSocket.on('connect_error', (err) => {
      setDebugState('socket-connection-error');
      setError(`Connection error: ${err.message}`);
      toast.error(`Connection error: ${err.message}`);
      console.log('Socket connect error:', err.message);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Initialize device and join room
  useEffect(() => {
    if (!socket) return;

    setDebugState('initializing-device-and-media');

    const initialize = async () => {
      try {
        setIsLoading(true);

        // Handle room joining based on role
        if (isCreating) {
          socket.emit('createRoom', { roomId, name }, (response) => {
            if (response.success) {
              setParticipants(response.users || []);
              setIsAdmin(true);
              setIsAdmitted(true);
              setIsLoading(false);
              setDebugState('created-room');
              toast.success('Room created successfully');
            } else {
              setError(response.error);
              setIsLoading(false);
              toast.error(response.error);
            }
          });
        } else {
          socket.emit('joinRoom', { roomId, name }, (response) => {
            if (response.success) {
              setParticipants(response.users || []);
              setPeerId(socket.id);
              setIsAdmitted(true);
              setIsLoading(false);
              setDebugState('joined-room');
              toast.success('Joined room successfully');
            } else {
              setError(response.error);
              setIsLoading(false);
              toast.error(response.error);
            }
          });
        }

        // Setup socket event listeners
        socket.on('routerCapabilities', async (capabilities) => {
          try {
            setDebugState('loading-device');
            const newDevice = new Device();
            await newDevice.load({ routerRtpCapabilities: capabilities });
            setDevice(newDevice);
            setDebugState('device-loaded');
            console.log('Device loaded with capabilities:', capabilities);

            const stream = await getMedia();
            console.log('Local stream obtained:', stream);
            setLocalStream(stream);
            setDebugState('media-obtained');
            setIsMediaLoading(false); // Media setup complete
          } catch (err) {
            setDebugState('device-or-media-error');
            setError(`Initialization error: ${err.message}`);
            setIsMediaLoading(false);
            toast.error(`Initialization error: ${err.message}`);
            console.log('Device or media error:', err.message);
          }
        });

        socket.on('admitted', () => {
          setIsAdmitted(true);
          setIsLoading(false); // Allow participant to see room immediately after admission
          setDebugState('admitted');
          toast.success('You have been admitted to the room');
          console.log('Participant admitted to room:', roomId);
          // Request router capabilities after being admitted
          socket.emit('getRouterRtpCapabilities', (response) => {
            if (response.error) {
              setError(response.error);
              setIsMediaLoading(false);
              toast.error(response.error);
              console.log('Get router capabilities error after admission:', response.error);
            }
          });
        });

        socket.on('join-request', ({ peerId, name }) => {
          if (isAdmin) {
            setPendingPeers((prev) => [...prev, { peerId, name }]);
            toast(`Join request from ${name}`, { icon: '🔔' });
            console.log('Join request received from:', name, 'peerId:', peerId);
          }
        });

        socket.on('peerJoined', ({ peerId, peerDetails, users }) => {
          setParticipants(users);
          toast(`${peerDetails.name} joined the room`, { icon: '👤' });
          console.log('Peer joined, updated participants:', users);
        });

        socket.on('peerClosed', ({ peerId }) => {
          setParticipants((prev) => prev.filter((p) => p.id !== peerId));
          setProducers((prev) => prev.filter((p) => p.peerId !== peerId));
          setConsumers((prev) => {
            const peerConsumers = prev.filter((c) => c.peerId === peerId);
            peerConsumers.forEach((consumer) => {
              consumer.consumer.close();
              consumer.stream.getTracks().forEach((track) => track.stop());
            });
            return prev.filter((c) => c.peerId !== peerId);
          });
          toast(`A participant left the room`, { icon: '🚪' });
          console.log('Peer closed, peerId:', peerId);
        });

        socket.on('producerList', (producerList) => {
          setProducers(producerList);
          console.log('Received producer list:', producerList);
        });

        socket.on('newProducer', (producerData) => {
          setProducers((prev) => {
            if (prev.some((p) => p.producerId === producerData.producerId)) return prev;
            return [...prev, producerData];
          });
          console.log('New producer added:', producerData);
        });

        socket.on('peer-media-toggle', ({ peerId, type, enabled }) => {
          setParticipants((prev) =>
            prev.map((p) =>
              p.id === peerId ? { ...p, [`is${type.charAt(0).toUpperCase() + type.slice(1)}On`]: enabled } : p
            )
          );
          toast(`${peerId} ${enabled ? 'enabled' : 'disabled'} ${type}`, { icon: enabled ? '✅' : '❌' });
          console.log(`Peer ${peerId} toggled ${type} to ${enabled}`);
        });

        socket.on('screenshare-toggle', ({ peerId, enabled }) => {
          setParticipants((prev) =>
            prev.map((p) => (p.id === peerId ? { ...p, sharingScreen: enabled } : p))
          );
          toast(`${peerId} ${enabled ? 'started' : 'stopped'} screen sharing`, { icon: enabled ? '🖥️' : '🛑' });
          console.log(`Peer ${peerId} toggled screen sharing to ${enabled}`);
        });

        socket.on('new-message', (messageData) => {
          setMessages((prev) => [...prev, messageData]);
          toast(`${messageData.senderName}: ${messageData.message}`, { icon: '💬' });
          console.log('New message received:', messageData);
        });

        socket.on('participants-updated', ({ users, joiningPeer }) => {
          console.log('Participants updated:', users);
          setParticipants(users);
          
          // Show notification for new participant
          if (joiningPeer && joiningPeer.peerId !== socket.id) {
            toast.success(`${joiningPeer.name} joined the room`, {
              icon: '👤'
            });
          }
        });

        socket.on('peerPropertiesUpdated', ({ peerId, property, value }) => {
          setParticipants((prev) =>
            prev.map((p) => (p.id === peerId ? { ...p, [property]: value } : p))
          );
          console.log(`Peer ${peerId} updated property ${property} to ${value}`);
        });

        socket.on('consumerClosed', ({ consumerId }) => {
          setConsumers((prev) => {
            const consumerToClose = prev.find((c) => c.consumer.id === consumerId);
            if (consumerToClose) {
              consumerToClose.consumer.close();
              consumerToClose.stream.getTracks().forEach((track) => track.stop());
              return prev.filter((c) => c.consumer.id !== consumerId);
            }
            return prev;
          });
          console.log('Consumer closed, consumerId:', consumerId);
        });

      } catch (err) {
        setDebugState('initialization-error');
        setError(`Initialization error: ${err.message}`);
        setIsLoading(false);
        toast.error(`Initialization error: ${err.message}`);
        console.log('Initialization error:', err.message);
      }
    };

    initialize();

    return () => {
      socket.off('routerCapabilities');
      socket.off('admitted');
      socket.off('join-request');
      socket.off('peerJoined');
      socket.off('peerClosed');
      socket.off('producerList');
      socket.off('newProducer');
      socket.off('peer-media-toggle');
      socket.off('screenshare-toggle');
      socket.off('new-message');
      socket.off('participants-updated');
      socket.off('peerPropertiesUpdated');
      socket.off('consumerClosed');
    };
  }, [socket, roomId, name, isCreating, isAdmin]);

  // Get user media
  const getMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          aspectRatio: 16/9,
          frameRate: { ideal: 60, min: 30 },
          facingMode: 'user',
          // Add advanced camera settings
          advanced: [
            {
              zoom: 1.0,
              brightness: 100,
              sharpness: 100,
              contrast: 100,
              saturation: 100,
              focusMode: 'continuous'
            }
          ]
        }
      });
      return stream;
    } catch (err) {
      let errorMessage = 'Failed to access media devices';
      if (err.name === 'NotAllowedError') errorMessage = 'Please allow camera and microphone access';
      else if (err.name === 'NotFoundError') errorMessage = 'No media devices found';
      else if (err.name === 'OverconstrainedError') errorMessage = 'Cannot satisfy requested media constraints';
      setError(errorMessage);
      setIsMediaLoading(false);
      toast.error(errorMessage);
      console.log('Get media error:', errorMessage);
      throw err;
    }
  }, []);

  // Create transports
  useEffect(() => {
    if (!device || !socket || !localStream || !isAdmitted) return;

    const createTransports = async () => {
      try {
        setDebugState('creating-transports');
        const sendTransport = await createTransport('send');
        setSendTransport(sendTransport);
        setDebugState('send-transport-created');
        const recvTransport = await createTransport('recv');
        setRecvTransport(recvTransport);
        setDebugState('recv-transport-created');
        setDebugState('initialization-complete');
        console.log('Transports created successfully');
      } catch (err) {
        setDebugState('transport-creation-error');
        setError(`Error creating transports: ${err.message}`);
        toast.error(`Error creating transports: ${err.message}`);
        console.log('Transport creation error:', err.message);
      }
    };

    createTransports();

    return () => {
      if (sendTransport) sendTransport.close();
      if (recvTransport) recvTransport.close();
    };
  }, [device, socket, localStream, isAdmitted]);

  // Transport creation helper
  const createTransport = useCallback(
    async (direction) => {
      return new Promise((resolve, reject) => {
        socket.emit('createWebRtcTransport', { direction }, (response) => {
          if (response.error) {
            reject(new Error(response.error));
            toast.error(`Error creating ${direction} transport: ${response.error}`);
            console.log(`Create ${direction} transport error:`, response.error);
            return;
          }

          const transport =
            direction === 'send'
              ? device.createSendTransport(response.params)
              : device.createRecvTransport(response.params);

          transport.on('connect', ({ dtlsParameters }, callback, errback) => {
            socket.emit('connectTransport', { transportId: transport.id, dtlsParameters }, (res) => {
              if (res.error) {
                errback(new Error(res.error));
                toast.error(`Error connecting ${direction} transport: ${res.error}`);
                console.log(`Connect ${direction} transport error:`, res.error);
              } else {
                callback();
              }
            });
          });

          if (direction === 'send') {
            transport.on('produce', ({ kind, rtpParameters }, callback, errback) => {
              socket.emit('produce', { transportId: transport.id, kind, rtpParameters }, (res) => {
                if (res.error) {
                  errback(new Error(res.error));
                  toast.error(`Error producing: ${res.error}`);
                  console.log('Produce error:', res.error);
                } else {
                  callback({ id: res.producerId });
                }
              });
            });
          }

          transport.on('connectionstatechange', (state) => {
            if (state === 'failed' || state === 'disconnected') {
              setError(`Transport ${direction} connection failed`);
              toast.error(`Transport ${direction} connection failed`);
              console.log(`Transport ${direction} connection state changed to:`, state);
            }
          });

          resolve(transport);
        });
      });
    },
    [device, socket]
  );

  // Produce media
  useEffect(() => {
    if (!sendTransport || !localStream) return;

    const produceMedia = async () => {
      try {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
          const audioProducer = await sendTransport.produce({
            track: audioTrack,
            codecOptions: { opusStereo: true, opusDtx: true },
            appData: { mediaType: 'audio' },
          });
          setProducerObjects((prev) => ({ ...prev, [audioProducer.id]: audioProducer }));
          console.log('Audio producer created:', audioProducer.id);
        }

        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
          const videoProducer = await sendTransport.produce({
            track: videoTrack,
            encodings: [
              { maxBitrate: 100000, scaleResolutionDownBy: 4 },
              { maxBitrate: 300000, scaleResolutionDownBy: 2 },
              { maxBitrate: 900000 },
            ],
            codecOptions: { videoGoogleStartBitrate: 1000 },
            appData: { mediaType: 'video' },
          });
          setProducerObjects((prev) => ({ ...prev, [videoProducer.id]: videoProducer }));
          console.log('Video producer created:', videoProducer.id);
        }
      } catch (err) {
        setError(`Error producing media: ${err.message}`);
        toast.error(`Error producing media: ${err.message}`);
        console.log('Produce media error:', err.message);
      }
    };

    produceMedia();
  }, [sendTransport, localStream]);

  // Consume producers
  useEffect(() => {
    if (!recvTransport || !device || !socket || producers.length === 0 || !peerId) return;

    const consumeProducers = async () => {
      const producersToConsume = producers.filter(
        (producer) =>
          producer.peerId !== peerId &&
          !consumers.some((c) => c.producerId === producer.producerId)
      );

      if (producersToConsume.length === 0) return;

      try {
        const newConsumers = await Promise.all(producersToConsume.map(createConsumer));
        const successfulConsumers = newConsumers.filter(Boolean);
        if (successfulConsumers.length > 0) {
          setConsumers((prev) => [...prev, ...successfulConsumers]);
          console.log('New consumers added:', successfulConsumers);
        }
      } catch (err) {
        setError(`Error consuming media: ${err.message}`);
        toast.error(`Error consuming media: ${err.message}`);
        console.log('Consume producers error:', err.message);
      }
    };

    consumeProducers();
  }, [producers, recvTransport, device, socket, consumers, peerId]);

  // Consumer creation helper
  const createConsumer = useCallback(
    async (producer) => {
      try {
        const { params } = await new Promise((resolve, reject) => {
          socket.emit(
            'consume',
            {
              transportId: recvTransport.id,
              producerId: producer.producerId,
              rtpCapabilities: device.rtpCapabilities,
            },
            (response) => {
              if (response.error) {
                reject(new Error(response.error));
                console.log('Consume error:', response.error);
              } else {
                resolve(response);
              }
            }
          );
        });

        const consumer = await recvTransport.consume({
          id: params.id,
          producerId: params.producerId,
          kind: params.kind,
          rtpParameters: params.rtpParameters,
        });

        const stream = new MediaStream();
        stream.addTrack(consumer.track);

        await new Promise((resolve) => {
          socket.emit('resumeConsumer', { consumerId: consumer.id }, () => {
            resolve();
          });
        });

        return {
          consumer,
          stream,
          peerId: producer.peerId,
          peerName: producer.peerName,
          producerId: producer.producerId,
          kind: params.kind,
        };
      } catch (err) {
        toast.error(`Error consuming producer: ${err.message}`);
        console.log('Create consumer error:', err.message);
        return null;
      }
    },
    [recvTransport, device, socket]
  );

  // Stats monitoring
  useEffect(() => {
    if (!sendTransport) return;

    statsIntervalRef.current = setInterval(async () => {
      try {
        const stats = await sendTransport.getStats();
        setConnectionStats(stats[0] || {});
      } catch (err) {
        toast.error('Error getting connection stats');
        console.log('Get stats error:', err.message);
      }
    }, 5000);

    return () => {
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    };
  }, [sendTransport]);

  // Control functions
  const toggleAudio = useCallback(() => {
    if (localStream) {
      const newState = !trackStates.audio;
      localStream.getAudioTracks().forEach((track) => (track.enabled = newState));
      setTrackStates((prev) => ({ ...prev, audio: newState }));
      socket.emit('toggle-media', { roomId, type: 'audio', enabled: newState }, (response) => {
        if (response.success) {
          toast.success(newState ? 'Microphone enabled' : 'Microphone muted');
        } else {
          toast.error(response.error);
          console.log('Toggle audio error:', response.error);
        }
      });
      Object.values(producerObjects).forEach((producer) => {
        if (producer.appData.mediaType === 'audio') {
          newState ? producer.resume() : producer.pause();
        }
      });
    }
  }, [localStream, trackStates.audio, socket, roomId, producerObjects]);

  const toggleVideo = useCallback(() => {
    if (localStream) {
      const newState = !trackStates.video;
      localStream.getVideoTracks().forEach((track) => (track.enabled = newState));
      setTrackStates((prev) => ({ ...prev, video: newState }));
      socket.emit('toggle-media', { roomId, type: 'video', enabled: newState }, (response) => {
        if (response.success) {
          toast.success(newState ? 'Camera enabled' : 'Camera disabled');
        } else {
          toast.error(response.error);
          console.log('Toggle video error:', response.error);
        }
      });
      Object.values(producerObjects).forEach((producer) => {
        if (producer.appData.mediaType === 'video') {
          newState ? producer.resume() : producer.pause();
        }
      });
    }
  }, [localStream, trackStates.video, socket, roomId, producerObjects]);

  const toggleScreenShare = useCallback(async () => {
    try {
      if (trackStates.screen) {
        // Optimistically update UI
        const previousScreenShareStream = screenShareStream;
        setScreenShareStream(null);
        setTrackStates((prev) => ({ ...prev, screen: false }));
        
        socket.emit('toggle-screenshare', { roomId, enabled: false }, (response) => {
          if (response.success) {
            if (previousScreenShareStream) {
              previousScreenShareStream.getTracks().forEach((track) => track.stop());
            }
            toast.success('Stopped screen sharing');
          } else {
            // Revert optimistic updates on failure
            setScreenShareStream(previousScreenShareStream);
            setTrackStates((prev) => ({ ...prev, screen: true }));
            toast.error(response.error);
            console.log('Toggle screen share (stop) error:', response.error);
          }
        });
        return;
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
        audio: true,
      });
      
      // Optimistically update UI
      setScreenShareStream(stream);
      setTrackStates((prev) => ({ ...prev, screen: true }));

      const videoTrack = stream.getVideoTracks()[0];
      const screenProducer = await sendTransport.produce({
        track: videoTrack,
        encodings: [{ maxBitrate: 1500000 }],
        codecOptions: { videoGoogleStartBitrate: 1000 },
        appData: { mediaType: 'screen' },
      });

      setProducerObjects((prev) => ({ ...prev, [screenProducer.id]: screenProducer }));

      socket.emit('toggle-screenshare', { roomId, enabled: true }, (response) => {
        if (response.success) {
          toast.success('Started screen sharing');
        } else {
          // Revert optimistic updates on failure
          screenProducer.close();
          stream.getTracks().forEach((track) => track.stop());
          setScreenShareStream(null);
          setTrackStates((prev) => ({ ...prev, screen: false }));
          setProducerObjects((prev) => {
            const newProducers = { ...prev };
            delete newProducers[screenProducer.id];
            return newProducers;
          });
          toast.error(response.error);
          console.log('Toggle screen share (start) error:', response.error);
        }
      });

      videoTrack.onended = () => {
        screenProducer.close();
        setTrackStates((prev) => ({ ...prev, screen: false }));
        setScreenShareStream(null);
        socket.emit('toggle-screenshare', { roomId, enabled: false }, (response) => {
          if (response.success) {
            toast.success('Screen sharing stopped');
          } else {
            toast.error(response.error);
            console.log('Toggle screen share (onended) error:', response.error);
          }
        });
      };
    } catch (err) {
      if (err.name !== 'NotAllowedError') {
        toast.error(`Error toggling screen share: ${err.message}`);
        setTrackStates((prev) => ({ ...prev, screen: false }));
        setScreenShareStream(null);
        console.log('Toggle screen share error:', err.message);
      }
    }
  }, [trackStates.screen, screenShareStream, sendTransport, socket, roomId]);

  const handleAdmitParticipant = (peerId) => {
    socket.emit('admit-participant', { roomId, peerId }, (response) => {
      if (response.success) {
        setPendingPeers((prev) => prev.filter((p) => p.peerId !== peerId));
        toast.success('Participant admitted');
        console.log('Participant admitted:', peerId);
      } else {
        toast.error(response.error);
        console.log('Admit participant error:', response.error);
      }
    });
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (chatMessage.trim()) {
      socket.emit('send-message', { roomId, message: chatMessage }, (response) => {
        if (response.success) {
          setChatMessage('');
          console.log('Message sent:', chatMessage);
        } else {
          toast.error(response.error);
          console.log('Send message error:', response.error);
        }
      });
    }
  };

  const leaveRoom = useCallback(() => {
    if (localStream) localStream.getTracks().forEach((track) => track.stop());
    if (screenShareStream) screenShareStream.getTracks().forEach((track) => track.stop());
    Object.values(producerObjects).forEach((producer) => producer.close());
    consumers.forEach((consumer) => {
      consumer.consumer.close();
      consumer.stream.getTracks().forEach((track) => track.stop());
    });
    if (sendTransport) sendTransport.close();
    if (recvTransport) recvTransport.close();
    if (socket) socket.disconnect();
    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    window.location.reload();
  }, [localStream, screenShareStream, producerObjects, consumers, sendTransport, recvTransport, socket]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Group consumers by peer
  const peerConsumers = {};
  consumers.forEach((consumer) => {
    if (!peerConsumers[consumer.peerId]) {
      peerConsumers[consumer.peerId] = { name: consumer.peerName, media: {} };
    }
    peerConsumers[consumer.peerId].media[consumer.kind] = consumer;
  });

  const adminParticipant = participants.find((p) => p.isAdmin);
  const nonAdminParticipants = participants.filter((p) => !p.isAdmin && p.id !== peerId);
  const localParticipant = participants.find((p) => p.id === peerId);

  // Find the participant currently sharing their screen
  const screenSharingParticipant = participants.find((p) => p.sharingScreen);

  if (!isAdmitted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center text-white">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-lg font-medium">Waiting for admin approval...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 p-4">
        <div className="max-w-md w-full bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="bg-red-600 px-4 py-3">
            <h2 className="text-lg font-bold text-white">Connection Error</h2>
          </div>
          <div className="p-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-white">Something went wrong</h3>
                <div className="mt-2 text-sm text-gray-300">
                  <p>{error}</p>
                  <p className="mt-2 text-xs text-gray-400">Debug state: {debugState}</p>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="w-20 h-20 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-lg text-white font-medium">Initializing room... ({debugState})</p>
          <p className="mt-2 text-sm text-gray-400">This may take a few moments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      <header className="bg-indigo-800 text-white px-6 py-4 shadow-md">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">Room: {roomId}</h1>
          <div className="flex items-center space-x-4">
            <span className="text-sm">Participants: {participants.length}</span>
            {connectionStats && (
              <span className="text-xs bg-indigo-600 px-2 py-1 rounded">
                {connectionStats.type} | {connectionStats.state}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Video Grid */}
        <div className="flex-1 p-4 overflow-y-auto">
          {participants.length === 0 ? (
            <div className="flex items-center justify-center h-full text-white text-lg">
              No participants found. Waiting for others to join...
            </div>
          ) : (
            <div className="grid grid-cols-4 auto-rows-auto gap-4">
              {/* Large Screen (Screen Share or Admin Video) */}
              {screenSharingParticipant ? (
                <div className="col-span-4 bg-gray-800 rounded-lg shadow-lg overflow-hidden border-2 border-indigo-500">
                  <div className="relative aspect-video">
                    {screenSharingParticipant.id === peerId ? (
                      // Local participant is sharing their screen
                      isMediaLoading ? (
                        <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      ) : screenShareStream ? (
                        <Video
                          stream={screenShareStream}
                          muted={true}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                          <div className="w-24 h-24 rounded-full bg-indigo-700 flex items-center justify-center">
                            <span className="text-3xl text-white font-bold">
                              {screenSharingParticipant.name?.charAt(0).toUpperCase() || 'U'}
                            </span>
                          </div>
                        </div>
                      )
                    ) : peerConsumers[screenSharingParticipant.id]?.media.screen ? (
                      // Remote participant is sharing their screen
                      <Video
                        stream={peerConsumers[screenSharingParticipant.id].media.screen.stream}
                        muted={false}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                        <div className="w-24 h-24 rounded-full bg-indigo-700 flex items-center justify-center">
                          <span className="text-3xl text-white font-bold">
                            {screenSharingParticipant.name?.charAt(0).toUpperCase() || 'U'}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 px-2 py-1 rounded text-white text-sm">
                      {screenSharingParticipant.name} {screenSharingParticipant.id === peerId ? '(You)' : screenSharingParticipant.isAdmin ? '(Admin)' : ''}
                      {screenSharingParticipant.id !== peerId && !peerConsumers[screenSharingParticipant.id]?.media.screen && (
                        <span className="ml-2 text-red-400">• Screen Share Not Available</span>
                      )}
                      <span className="ml-2 text-green-400">• Sharing Screen</span>
                    </div>
                    {/* Inset Webcam for the screen-sharing participant */}
                    {screenSharingParticipant.id === peerId && localStream && !isMediaLoading ? (
                      <div className="absolute bottom-4 right-4 w-32 h-24 bg-gray-800 rounded border-2 border-indigo-500">
                        <Video
                          stream={localStream}
                          muted={true}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : screenSharingParticipant.id !== peerId && peerConsumers[screenSharingParticipant.id]?.media.video ? (
                      <div className="absolute bottom-4 right-4 w-32 h-24 bg-gray-800 rounded border-2 border-indigo-500">
                        <Video
                          stream={peerConsumers[screenSharingParticipant.id].media.video.stream}
                          muted={false}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : adminParticipant ? (
                // Default to admin's video if no one is sharing their screen
                <div className="col-span-4 bg-gray-800 rounded-lg shadow-lg overflow-hidden border-2 border-indigo-500">
                  <div className="relative aspect-video">
                    {peerConsumers[adminParticipant.id]?.media.video ? (
                      <Video
                        stream={peerConsumers[adminParticipant.id].media.video.stream}
                        muted={false}
                        className="w-full h-full object-cover"
                      />
                    ) : adminParticipant.id === peerId ? (
                      isMediaLoading ? (
                        <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      ) : localStream ? (
                        <Video
                          stream={localStream}
                          muted={true}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                          <div className="w-24 h-24 rounded-full bg-indigo-700 flex items-center justify-center">
                            <span className="text-3xl text-white font-bold">
                              {adminParticipant.name?.charAt(0).toUpperCase() || 'A'}
                            </span>
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                        <div className="w-24 h-24 rounded-full bg-indigo-700 flex items-center justify-center">
                          <span className="text-3xl text-white font-bold">
                            {adminParticipant.name?.charAt(0).toUpperCase() || 'A'}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 px-2 py-1 rounded text-white text-sm">
                      {adminParticipant.name} {adminParticipant.id === peerId ? '(You)' : '(Admin)'}
                      {!adminParticipant.isVideoOn && (
                        <span className="ml-2 text-red-400">• Video Off</span>
                      )}
                      {!adminParticipant.isAudioOn && (
                        <span className="ml-2 text-red-400">• Muted</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Local Video (if not admin and not currently sharing screen) */}
              {localParticipant && !localParticipant.isAdmin && !localParticipant.sharingScreen && (
                <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border-2 border-indigo-500">
                  <div className="relative aspect-video">
                    {isMediaLoading ? (
                      <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    ) : localStream ? (
                      <Video
                        stream={localStream}
                        muted={true}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                        <div className="w-24 h-24 rounded-full bg-indigo-700 flex items-center justify-center">
                          <span className="text-3xl text-white font-bold">
                            {name?.charAt(0).toUpperCase() || 'U'}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 px-2 py-1 rounded text-white text-sm">
                      {name} (You)
                      {!trackStates.video && localStream && (
                        <span className="ml-2 text-red-400">• Video Off</span>
                      )}
                      {!trackStates.audio && localStream && (
                        <span className="ml-2 text-red-400">• Muted</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Other Participants (excluding the screen sharer) */}
              {nonAdminParticipants
                .filter((participant) => !participant.sharingScreen)
                .map((participant) => (
                  <div
                    key={participant.id}
                    className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border-2 border-gray-600"
                  >
                    <div className="relative aspect-video">
                      {peerConsumers[participant.id]?.media.video ? (
                        <Video
                          stream={peerConsumers[participant.id].media.video.stream}
                          muted={false}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                          <div className="w-24 h-24 rounded-full bg-indigo-700 flex items-center justify-center">
                            <span className="text-3xl text-white font-bold">
                              {participant.name?.charAt(0).toUpperCase() || 'U'}
                            </span>
                          </div>
                        </div>
                      )}
                      <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 px-2 py-1 rounded text-white text-sm">
                        {participant.name}
                        {!participant.isVideoOn && (
                          <span className="ml-2 text-red-400">• Video Off</span>
                        )}
                        {!participant.isAudioOn && (
                          <span className="ml-2 text-red-400">• Muted</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Chat and Admin Panel */}
        <div className="w-80 bg-gray-800 p-4 flex flex-col">
          {/* Pending Join Requests (Admin Only) */}
          {isAdmin && pendingPeers.length > 0 && (
            <div className="mb-4">
              <h3 className="text-lg font-bold text-white mb-2">Pending Join Requests</h3>
              {pendingPeers.map((peer) => (
                <div
                  key={peer.peerId}
                  className="flex justify-between items-center bg-gray-700 p-2 rounded mb-2"
                >
                  <span className="text-white">{peer.name}</span>
                  <button
                    onClick={() => handleAdmitParticipant(peer.peerId)}
                    className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                  >
                    Admit
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Chat */}
          <h3 className="text-lg font-bold text-white mb-2">Chat</h3>
          <div
            ref={chatContainerRef}
            className="flex-1 bg-gray-700 rounded p-2 overflow-y-auto mb-2"
          >
            {messages.length === 0 ? (
              <p className="text-gray-400 text-center">No messages yet.</p>
            ) : (
              messages.map((msg, index) => (
                <div
                  key={index}
                  className={`mb-2 ${msg.senderId === peerId ? 'text-right' : 'text-left'}`}
                >
                  <span className="text-xs text-gray-400">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                  <p className="text-white">
                    <strong>{msg.senderName}:</strong> {msg.message}
                  </p>
                </div>
              ))
            )}
          </div>
          <form onSubmit={sendMessage} className="flex">
            <input
              type="text"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              className="flex-1 bg-gray-600 text-white px-3 py-2 rounded-l focus:outline-none"
              placeholder="Type a message..."
            />
            <button
              type="submit"
              className="bg-indigo-600 text-white px-4 py-2 rounded-r hover:bg-indigo-700"
            >
              Send
            </button>
          </form>
        </div>
      </main>

      <Controls
        isMuted={!trackStates.audio}
        isVideoOff={!trackStates.video}
        isScreenSharing={trackStates.screen}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onToggleScreenShare={toggleScreenShare}
        onLeaveRoom={leaveRoom}
      />
    </div>
  );
};

export default Room;