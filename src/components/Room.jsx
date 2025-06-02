import React, { useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { Device } from 'mediasoup-client';
import Video from './Video';
import Controls from './Controls';
import toast from 'react-hot-toast';
import { CiMicrophoneOff } from "react-icons/ci";
import { PiCameraSlashLight, PiHandPalmDuotone } from "react-icons/pi";
import { IoCopyOutline, IoMicOffOutline, IoMicOutline } from "react-icons/io5";
import { FaCirclePlay } from "react-icons/fa6";
import { FaStopCircle } from "react-icons/fa";
import { FiCamera, FiCameraOff } from 'react-icons/fi';
import { HiOutlineUserGroup } from "react-icons/hi";
import { MdOutlineChat, MdScreenShare } from 'react-icons/md';
import Audio from './Audio';
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
  const [chatOpen, setChatOpen] = useState(false);
  const [isuserhandraised, setisuserhandraised] = useState(false);
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
  const [isAdmitted, setIsAdmitted] = useState(isCreating);
  const [messages, setMessages] = useState([]);
  const [chatMessage, setChatMessage] = useState('');
  const [connectionStats, setConnectionStats] = useState(null);
  const [debugState, setDebugState] = useState('initializing');
  const [isMediaLoading, setIsMediaLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const statsIntervalRef = useRef();
  const chatContainerRef = useRef();
  const [copied, setCopied] = useState(false);
  const [showparticipants, setshowparticipants] = useState(false);
  const recordingTimerRef = useRef(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recording, setRecording] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunks = useRef([]);


  const formatRecordingTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${hrs} : ${mins} : ${secs}`;
  };

  // Start recording timer
  const startRecordingTimer = () => {
    setRecordingTime(0);
    recordingTimerRef.current = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);
  };

  // Stop recording timer
  const stopRecordingTimer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'tab', // Suggests the current tab in the prompt
        },
        audio: true, // Include audio if needed
        preferCurrentTab: true, // Chrome-specific hint to prioritize the current tab
      });

      // Stop any existing stream tracks to prevent multiple recordings
      if (mediaRecorderRef.current?.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }

      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'video/webm' });

      // Handle stream end (e.g., when user clicks "Stop Sharing" in Chrome)
      stream.getVideoTracks()[0].onended = () => {
        if (mediaRecorderRef.current?.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
        setRecordingTime(0); // Reset timer
        setRecording(false); // Reset recording state
      };

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunks.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setVideoUrl(url); // Set URL for download button
        stopRecordingTimer();
        chunks.current = [];
        stream.getTracks().forEach(track => track.stop());
        setRecordingTime(0); // Ensure timer is reset
        setRecording(false); // Ensure recording state is reset
      };

      mediaRecorderRef.current.start();
      startRecordingTimer();
      setRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      setRecording(false); // Reset recording state on error
      setRecordingTime(0); // Reset timer on error
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      // No need to set recordingTime or recording here, as onstop handles it
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  // Initialize socket connection
  useEffect(() => {
    setDebugState('connecting-socket');
    const newSocket = io('https://proxy170.r3proxy.com:36981/', {
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
            setIsMediaLoading(false);
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
          setIsLoading(false);
          setDebugState('admitted');
          toast.success('You have been admitted to the room');
          console.log('Participant admitted to room:', roomId);
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

        socket.on('peerClosed', ({ peerId, peerName }) => {
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
          toast(`${peerName} left the room`, { icon: '🚪' });
          console.log('Peer closed, peerId:', peerName);
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

        socket.on('peer-media-toggle', ({ peerId, type, enabled, peerName }) => {
          setParticipants((prev) =>
            prev.map((p) =>
              p.id === peerId ? { ...p, [`is${type.charAt(0).toUpperCase() + type.slice(1)}On`]: enabled } : p
            )
          );
          if (peerId != socket.id) {
            toast(`${peerName} ${enabled ? 'enabled' : 'disabled'} ${type}`, { icon: enabled ? '✅' : '❌' });
          }
          console.log(`Peer ${peerId} toggled ${type} to ${enabled}`);
        });

        socket.on('screenshare-toggle', ({ peerId, enabled, peerName }) => {
          setParticipants((prev) =>
            prev.map((p) => (p.id === peerId ? { ...p, sharingScreen: enabled } : p))
          );
          if (peerId != socket.id && peerName) {
            toast(`${peerName} ${enabled ? 'started' : 'stopped'} screen sharing`, { icon: enabled ? '🖥️' : '🛑' });
          }
          console.log(`Peer ${peerId} toggled screen sharing to ${enabled}`);
        });

        socket.on('handraise-toggle', ({ peerId, enabled, peerName }) => {
          setParticipants((prev) =>
            prev.map((p) => (p.id === peerId ? { ...p, handRaise: enabled } : p))
          );
          if (peerId != socket.id && peerName && enabled) {
            toast(`${peerName} was hand raised `, { icon: '✋' });
          }
        });

        socket.on('new-message', (messageData) => {
          setMessages((prev) => [...prev, messageData]);
          if (messageData.senderId !== socket.id) {
            toast(`${messageData.senderName}: ${messageData.message}`, { icon: '💬' });
          }
          console.log('New message received:', messageData);
        });

        socket.on('participants-updated', ({ users, joiningPeer }) => {
          console.log('Participants updated:', users);
          setParticipants(users);

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
          aspectRatio: 16 / 9,
          frameRate: { ideal: 60, min: 30 },
          facingMode: 'user',
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
          const transoprticeserver = {
            ...response.params, iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              // Add TURN server if available
            ]
          };

          const transport =
            direction === 'send'
              ? device.createSendTransport(transoprticeserver)
              : device.createRecvTransport(transoprticeserver);

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
            transport.on('produce', ({ kind, rtpParameters, appData }, callback, errback) => {
              socket.emit('produce', { transportId: transport.id, kind, rtpParameters, appData }, (res) => {
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
          transport.on('icecandidate', (candidate) => {
            console.log(`ICE candidate for ${direction} transport:`, candidate);
          });

          transport.on('icegatheringstatechange', () => {
            console.log(`ICE gathering state for ${direction} transport:`, transport.iceGatheringState);
          });

          transport.on('icestatechange', (state) => {
            console.log(`ICE connection state for ${direction} transport:`, state);
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
          appData: producer.appData || { mediaType: params.kind }, // Use appData from producer or fallback to kind
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
          mediaType: consumer.appData.mediaType || params.kind, // Include mediaType for categorization
        };
      } catch (err) {
        // toast.error(`Error consuming producer: ${err.message}`);
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
        const stats = await sendTransport;
        setConnectionStats(stats || {});
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
      socket.emit('toggle-media', { roomId, type: 'audio', enabled: newState, name }, (response) => {
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
      socket.emit('toggle-media', { roomId, type: 'video', enabled: newState, name }, (response) => {
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
        const previousScreenShareStream = screenShareStream;
        setScreenShareStream(null);
        setTrackStates((prev) => ({ ...prev, screen: false }));

        socket.emit('toggle-screenshare', { roomId, enabled: false, name }, (response) => {
          if (response.success) {
            if (previousScreenShareStream) {
              previousScreenShareStream.getTracks().forEach((track) => track.stop());
            }
            toast.success('Stopped screen sharing');
          } else {
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
  const togglehandraise = async () => {
    try {
      socket.emit('toggle-handraise', { roomId, enabled: !isuserhandraised, name }, (response) => {
        if (response.success) {
          toast.success(!isuserhandraised ? 'Hand Raised' : 'Hand Downed');
        } else {
          toast.error(response.error);
          console.log('Handle raise error:', response.error);
        }
      });
      setisuserhandraised(!isuserhandraised);
    } catch (error) {
      toast.error(`Error handleraise: ${error.message}`);
    }
  }
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
    // Use mediaType instead of kind to categorize screen sharing
    peerConsumers[consumer.peerId].media[consumer.mediaType] = consumer;
  });

  const adminParticipant = participants.find((p) => p.isAdmin);
  const nonAdminParticipants = participants.filter((p) => !p.isAdmin && p.id !== peerId);
  const localParticipant = participants.find((p) => p.id === peerId);
  const countparti = isAdmin ? 2 : 1;
  const screenSharingParticipant = participants.find((p) => p.sharingScreen);
  const totalNonAdminParticipants = nonAdminParticipants.filter((p) => !p.isAdmin).length;
  const totalPages = Math.ceil(totalNonAdminParticipants / countparti);
  const paginatedParticipants = nonAdminParticipants
    .slice((currentPage - 1) * countparti, currentPage * countparti);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

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

  // if (error) {
  //   return (
  //     <div className="flex items-center justify-center min-h-screen bg-gray-900 p-4">
  //       <div className="max-w-md w-full bg-gray-800 rounded-lg shadow-lg overflow-hidden">
  //         <div className="bg-red-600 px-4 py-3">
  //           <h2 className="text-lg font-bold text-white">Connection Error</h2>
  //         </div>
  //         <div className="p-6">
  //           <div className="flex items-start">
  //             <div className="flex-shrink-0">
  //               <svg
  //                 className="h-6 w-6 text-red-500"
  //                 fill="none"
  //                 viewBox="0 0 24 24"
  //                 stroke="currentColor"
  //               >
  //                 <path
  //                   strokeLinecap="round"
  //                   strokeLinejoin="round"
  //                   strokeWidth={2}
  //                   d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
  //                 />
  //               </svg>
  //             </div>
  //             <div className="ml-3">
  //               <h3 className="text-lg font-medium text-white">Something went wrong</h3>
  //               <div className="mt-2 text-sm text-gray-300">
  //                 <p>{error}</p>
  //                 <p className="mt-2 text-xs text-gray-400">Debug state: {debugState}</p>
  //               </div>
  //             </div>
  //           </div>
  //           <div className="mt-6 flex justify-end space-x-3">
  //             <button
  //               onClick={() => window.location.reload()}
  //               className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
  //             >
  //               Refresh Page
  //             </button>
  //           </div>
  //         </div>
  //       </div>
  //     </div>
  //   );
  // }

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
    <div className="relative h-screen w-full bg-gradient-to-br from-white via-gray-300 to-white overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-gray-100/50 to-white/30 opacity-80"></div>
      <div className="relative h-full w-full flex flex-col font-sans">
        <header className="px-6 py-4 z-10 bg-white/50 backdrop-blur-md border-b border-gray-200/50">
          <div className="flex justify-between items-center">
            {/* Room Info and Admin Badge */}
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center space-x-2">
                {/* <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-teal-500">Room:</span> */}
                <span className="text-gray-800">{roomId}</span>
                <button
                  onClick={handleCopy}
                  title="Copy Room ID"
                  className="text-blue-500 hover:text-teal-500 transition cursor-pointer"
                >
                  <IoCopyOutline size={18} />
                </button>
                {copied && <span className="text-xs text-green-500">Copied!</span>}
              </h1>
              {isAdmin && (
                <span className="bg-gradient-to-r from-blue-500 to-teal-500 text-xs text-white px-3 py-1 rounded-full shadow-md">
                  ADMIN
                </span>
              )}
            </div>

            {/* Participant Count & Connection Status */}
            <div className="flex items-center space-x-6">
              <div className=' flex items-center space-x-2'>
                <div className="flex relative items-center cursor-pointer space-x-2 bg-gray-200 text-gray-800 font-medium backdrop-blur-md rounded-full px-4 py-2 shadow-md">
                  {recording && <span className=' bg-red-500 left-3.5 absolute animate-ping size-3 rounded-full me-2'></span>}
                  <span className=' bg-red-500  size-2 rounded-full me-3'></span>
                  {formatRecordingTime(recordingTime)}
                </div>
                <div>
                  {
                    recording ? (
                      <div onClick={stopRecording}><FaStopCircle className=' size-9 text-red-500 cursor-pointer backdrop-blur-md rounded-full shadow-md' title='stop record' /></div>
                    ) : (
                      <div onClick={startRecording}><FaCirclePlay className=' size-9 text-blue-500 cursor-pointer backdrop-blur-md rounded-full shadow-md' title='start record' /></div>
                    )
                  }
                </div>
              </div>
              {/* <div className="flex items-center space-x-2">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-sm text-gray-700 font-medium">
                  {participants.length} {participants.length === 1 ? 'participant' : 'participants'}
                </span>
              </div> */}

              {/* {connectionStats && (
                <div className="hidden md:flex items-center space-x-2 text-xs text-gray-600 bg-gray-100/50 px-3 py-1 rounded-full">
                  <span>Connection: {connectionStats?._connectionState}</span>
                </div>
              )} */}
            </div>
          </div>
        </header>

        <main className="flex-1 flex overflow-hidden">
          <div className="flex-1 p-6 overflow-y-auto">
            {participants.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-24 h-24 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                  <p className="text-gray-900 text-xl font-semibold">Awaiting participants...</p>
                  <p className="text-gray-500 mt-3 text-sm">Share this room ID to invite others</p>
                </div>
              </div>
            ) : participants.length === 1 ? (
              <div className="flex items-center justify-center h-full">
                <div className="relative w-3/4 h-full max-h-[80vh] aspect-video bg-white/50 rounded-2xl overflow-hidden shadow-md backdrop-blur-sm border border-gray-200/50">
                  {localParticipant ? (
                    isMediaLoading ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80">
                        <div className="w-20 h-20 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    ) : localStream && trackStates.video && localStream ? (
                      <Video
                        Videostream={null}
                        Audiostream={null}
                        islocal={true}
                        stream={localStream}
                        muted={true}
                        className="w-full h-full object-cover rounded-2xl" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80">
                        <div className="text-center">
                          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-blue-200 to-teal-200 flex items-center justify-center mx-auto mb-4 shadow-lg">
                            <span className="text-4xl text-gray-900 font-bold">
                              {localParticipant.name?.charAt(0).toUpperCase() || 'U'}
                            </span>
                          </div>
                          <p className="text-gray-900 text-lg font-medium">{localParticipant.name}</p>
                        </div>
                      </div>
                    )
                  ) : null}
                  <div className={`absolute bottom-4 left-4 bg-gray-100/70  ${(!trackStates.video && localStream || !trackStates.audio && localStream) ? "pe-2 " : " pe-4"} ps-4 py-2 rounded-full text-gray-900 text-sm backdrop-blur-sm flex items-center space-x-2`}>
                    <span>{localParticipant?.name} (You)</span>
                    {!trackStates.video && localStream && (
                      <span className="p-2 text-base bg-red-400/80 text-white rounded-full "><PiCameraSlashLight /></span>
                    )}
                    {!trackStates.audio && localStream && (
                      <span className="p-2 text-base bg-red-400/80 text-white rounded-full "><CiMicrophoneOff /></span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
                <div className="lg:col-span-3 bg-white/50 rounded-2xl overflow-hidden border border-gray-200/50 backdrop-blur-sm shadow-md">
                  <div className="relative w-full h-full max-h-[80vh] aspect-video">
                    {screenSharingParticipant ? (
                      <>
                        {screenSharingParticipant.id === peerId ? (
                          isMediaLoading ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80">
                              <div className="w-20 h-20 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                          ) : screenShareStream ? (
                            <Video
                              islocal={true}
                              Videostream={null}
                              Audiostream={null}
                              stream={screenShareStream}
                              muted={true}
                              className="w-full h-full object-contain rounded-2xl" />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80">
                              <div className="text-center">
                                <div className="w-28 h-28 rounded-full bg-gradient-to-br from-blue-200 to-teal-200 flex items-center justify-center mx-auto mb-4 shadow-lg">
                                  <span className="text-4xl text-gray-900 font-bold">
                                    {screenSharingParticipant.name?.charAt(0).toUpperCase() || 'U'}
                                  </span>
                                </div>
                                <p className="text-gray-900 text-lg font-medium">{screenSharingParticipant.name}</p>
                              </div>
                            </div>
                          )
                        ) : peerConsumers[screenSharingParticipant.id]?.media.screen ? (
                          <Video
                            Videostream={peerConsumers[screenSharingParticipant.id].media.screen.stream}
                            Audiostream={peerConsumers[screenSharingParticipant.id].media.audio.stream}
                            islocal={false}
                            stream={null}
                            muted={false}
                            className="w-full h-full object-contain rounded-2xl"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80">
                            <div className="text-center">
                              <div className="w-28 h-28 rounded-full bg-gradient-to-br from-blue-200 to-teal-200 flex items-center justify-center mx-auto mb-4 shadow-lg">
                                <span className="text-4xl text-gray-900 font-bold">
                                  {screenSharingParticipant.name?.charAt(0).toUpperCase() || 'U'}
                                </span>
                              </div>
                              <p className="text-gray-900 text-lg font-medium">{screenSharingParticipant.name}</p>
                            </div>
                          </div>
                        )}
                        <div className="absolute bottom-4 left-4 bg-gray-100/70 px-4 py-2 rounded-full text-gray-900 text-sm backdrop-blur-sm flex items-center space-x-2">
                          <span className="truncate max-w-xs">
                            {screenSharingParticipant.name} {screenSharingParticipant.id === peerId ? '(You)' : ''}
                          </span>
                          <span className="px-2 py-1 bg-green-400/80 rounded-full text-xs">Screen Sharing</span>
                        </div>
                      </>
                    ) : adminParticipant ? (
                      <>
                        {peerConsumers[adminParticipant.id]?.media.video && adminParticipant.isVideoOn ? (
                          <Video
                            Videostream={peerConsumers[adminParticipant.id].media.video.stream}
                            Audiostream={peerConsumers[adminParticipant.id].media.audio.stream}
                            islocal={false}
                            stream={null}
                            muted={false}
                            className="w-full h-full object-cover rounded-2xl"
                          />
                        ) : adminParticipant.id === peerId ? (
                          isMediaLoading ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80">
                              <div className="w-20 h-20 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                          ) : localStream && adminParticipant.isVideoOn ? (
                            <Video
                              Videostream={null}
                              Audiostream={null}
                              islocal={true}
                              stream={localStream}
                              muted={true}
                              className="w-full h-full object-cover rounded-2xl" />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80">
                              <div className="text-center">
                                <div className="w-28 h-28 rounded-full bg-gradient-to-br from-blue-200 to-teal-200 flex items-center justify-center mx-auto mb-4 shadow-lg">
                                  <span className="text-4xl text-gray-900 font-bold">
                                    {adminParticipant.name?.charAt(0).toUpperCase() || 'A'}
                                  </span>
                                </div>
                                {/* <p className="text-gray-900 text-lg font-medium">{adminParticipant.name}</p> */}
                              </div>
                            </div>
                          )
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80">
                            <div className="text-center">
                              <div className="w-28 h-28 rounded-full bg-gradient-to-br from-blue-200 to-teal-200 flex items-center justify-center mx-auto mb-4 shadow-lg">
                                <span className="text-4xl text-gray-900 font-bold">
                                  {adminParticipant.name?.charAt(0).toUpperCase() || 'A'}
                                </span>
                              </div>
                              {/* <p className="text-gray-900 text-lg font-medium">{adminParticipant.name}</p> */}
                            </div>
                          </div>
                        )}
                        <div className={`absolute bottom-4 left-4 ${adminParticipant.isVideoOn ? "bg-gray-100/70" : " bg-gray-200"}  ${(!adminParticipant.isVideoOn || !adminParticipant.isAudioOn) ? "pe-2 " : " pe-4"} ps-4 py-2 rounded-full text-gray-900 text-sm backdrop-blur-sm flex items-center space-x-2`}>
                          <span>{adminParticipant.name} {adminParticipant.id === peerId ? '(You)' : '(Admin)'}</span>
                          {!adminParticipant.isVideoOn && (
                            <span className="p-2 text-base bg-red-400/80 text-white rounded-full"><PiCameraSlashLight /></span>
                          )}
                          {!adminParticipant.isAudioOn && (
                            <span className="p-2 text-base bg-red-400/80 text-white rounded-full"><CiMicrophoneOff /></span>
                          )}
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className={`lg:col-span-1 flex flex-col ${isAdmin ? "space-y-6" : "space-y-3"}`}>
                  {localParticipant && !localParticipant.isAdmin && !localParticipant.sharingScreen && (
                    <div className="bg-white/50 rounded-2xl overflow-hidden border border-gray-200/50 backdrop-blur-sm shadow-xl">
                      <div className="relative aspect-video">
                        {isMediaLoading ? (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80">
                            <div className="w-20 h-20 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        ) : localStream && trackStates.video && localStream ? (
                          <Video
                            Videostream={null}
                            Audiostream={null}
                            islocal={true}
                            stream={localStream}
                            muted={true}
                            className="w-full h-full object-cover rounded-2xl" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80">
                            <div className="text-center">
                              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-200 to-teal-200 flex items-center justify-center mx-auto mb-3 shadow-lg">
                                <span className="text-3xl text-gray-900 font-bold">
                                  {name?.charAt(0).toUpperCase() || 'U'}
                                </span>
                              </div>
                              <p className="text-gray-900 text-sm font-medium">{name}</p>
                            </div>
                          </div>
                        )}
                        <div className={`absolute bottom-3 left-3 ${trackStates.video && localStream ? "bg-gray-100/70" : " bg-gray-200"} ${(!trackStates.video && localStream && !trackStates.audio && localStream) ? " pe-1" : " pe-2"} ps-2 py-1 rounded-full text-gray-900 text-xs backdrop-blur-sm flex items-center space-x-2`}>
                          <span>You</span>
                          {!trackStates.video && localStream && (
                            <span className="p-1 bg-red-400/80 text-white rounded-full text-sm"><PiCameraSlashLight /></span>
                          )}
                          {!trackStates.audio && localStream && (
                            <span className="p-1 bg-red-400/80 text-white rounded-full text-sm"><CiMicrophoneOff /></span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  {localParticipant.sharingScreen && peerConsumers[adminParticipant.id]?.media.video && (
                    <div className="bg-white/50 rounded-2xl overflow-hidden border border-gray-200/50 backdrop-blur-sm shadow-xl">
                      <div className="relative aspect-video">
                        {isMediaLoading ? (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80">
                            <div className="w-20 h-20 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        ) : peerConsumers[adminParticipant.id].media.video && adminParticipant.isVideoOn ? (
                          <Video
                            Videostream={peerConsumers[adminParticipant.id].media.video.stream}
                            Audiostream={peerConsumers[adminParticipant.id].media.audio.stream}
                            islocal={false}
                            stream={null}
                            muted={true}
                            className="w-full h-full object-cover rounded-2xl" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80">
                            <div className="text-center">
                              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-200 to-teal-200 flex items-center justify-center mx-auto mb-3 shadow-lg">
                                <span className="text-3xl text-gray-900 font-bold">
                                  {adminParticipant.name?.charAt(0).toUpperCase() || 'A'}
                                </span>
                              </div>
                              <p className="text-gray-900 text-sm font-medium">{adminParticipant.name}</p>
                            </div>
                          </div>
                        )}
                        <div className="absolute bottom-3 left-3 bg-gray-100/70 px-3 py-1 rounded-full text-gray-900 text-xs backdrop-blur-sm flex items-center space-x-2">
                          <span>Admin</span>
                          {!adminParticipant.isVideoOn && (
                            <span className="px-2 py-1 bg-red-400/80 rounded-full text-white text-xxs"><PiCameraSlashLight /></span>
                          )}
                          {!adminParticipant.isAudioOn && (
                            <span className="px-2 py-1 bg-red-400/80 rounded-full text-white text-xxs"><CiMicrophoneOff /></span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex-1 flex flex-col space-y-6">
                    <div className="bg-white/50 backdrop-blur-xl rounded-2xl border border-gray-200/50 shadow-xl p-4">
                      <h3 className="text-gray-900 text-lg font-semibold mb-4">Participants ({nonAdminParticipants?.length})</h3>
                      <div className="space-y-4">
                        {paginatedParticipants.map((participant) => (
                          <div
                            key={participant.id}
                            className="bg-white/50 rounded-2xl overflow-hidden border border-gray-200/50 backdrop-blur-sm shadow-xl"
                          >
                            <div className="relative aspect-video">
                              {participant.sharingScreen ? (
                                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-100 to-teal-100 text-gray-900 text-center">
                                  <div>
                                    <p className="text-xl font-bold">{participant.name}</p>
                                    <p className="text-sm mt-1">is sharing their screen</p>
                                  </div>
                                </div>
                              ) : peerConsumers[participant.id]?.media.video && participant.isVideoOn ? (
                                <Video
                                  Videostream={peerConsumers[participant.id].media.video.stream}
                                  Audiostream={peerConsumers[participant.id].media.audio.stream}
                                  islocal={false}
                                  stream={null}
                                  muted={false}
                                  className="w-full h-full object-cover rounded-2xl"
                                />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80">
                                  <div className="text-center">
                                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-200 to-teal-200 flex items-center justify-center mx-auto mb-3 shadow-lg">
                                      <span className="text-3xl text-gray-900 font-bold">
                                        {participant.name?.charAt(0).toUpperCase() || 'U'}
                                      </span>
                                    </div>
                                    {/* <p className="text-gray-900 text-sm font-medium">{participant.name}</p> */}
                                    {
                                      peerConsumers[participant.id]?.media.adio && participant.isAudioOn && (
                                        <Audio
                                          stream={peerConsumers[participant.id].media.audio.stream}
                                        />
                                      )
                                    }
                                  </div>
                                </div>
                              )}
                              <div className={`absolute bottom-3 left-3 ${participant.isVideoOn ? "bg-gray-100/70" : "bg-gray-200"} ${(participant.isVideoOn && participant.isAudioOn) ? " pe-2" : " pe-1"} ps-2 py-1 rounded-full text-gray-900 text-xs backdrop-blur-sm flex items-center space-x-2`}>
                                <span>{participant.name}</span>
                                {!participant.isVideoOn && !participant.shareScreen && (
                                  <span className="p-1 bg-red-400/80 text-white rounded-full text-sm"><PiCameraSlashLight /></span>
                                )}
                                {!participant.isAudioOn && (
                                  <span className="p-1 bg-red-400/80 text-white rounded-full text-sm"><CiMicrophoneOff /></span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        {paginatedParticipants.length === 0 && (
                          <div className="flex-1 flex items-center justify-center">
                            <p className="text-gray-500 text-sm">No participants on this page</p>
                          </div>
                        )}
                      </div>
                      {totalPages > 1 && (
                        <div className="flex justify-between items-center space-x-3 mt-6">
                          <button
                            onClick={() => handlePageChange(currentPage > 1 ? currentPage - 1 : totalPages)}
                            className={`p-3 rounded-full bg-gray-200/50 text-gray-700 hover:bg-blue-300/50 transition-all duration-200 shadow-md ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={currentPage === 1}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                          <span className="text-gray-700 text-sm font-medium">
                            {currentPage} / {totalPages}
                          </span>
                          <button
                            onClick={() => handlePageChange(currentPage < totalPages ? currentPage + 1 : 1)}
                            className={`p-3 rounded-full bg-gray-200/50 text-gray-700 hover:bg-blue-300/50 transition-all duration-200 shadow-md ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={currentPage === totalPages}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div
            className={`absolute z-10 right-6 ${chatOpen ? 'bottom-6' : '-bottom-4'} w-96 bg-white/50 backdrop-blur-xl rounded-2xl border border-gray-200/50 shadow-2xl transition-all duration-500 ease-in-out ${chatOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}
          >
            <div className="p-4 border-b border-gray-200/50 bg-gray-100/50 rounded-t-2xl backdrop-blur-2xl flex justify-between items-center">
              <h3 className="text-gray-900 text-lg font-semibold flex items-center gap-x-2"> <MdOutlineChat className=" size-5" /><span className="mb-1">Chat</span></h3>
              <button onClick={() => setChatOpen(false)} className="text-gray-500 hover:text-gray-900 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
            <div ref={chatContainerRef} className="h-80 p-4 overflow-y-auto">
              {messages.length === 0 ? (
                <p className="text-gray-500 text-center py-10">No messages yet</p>
              ) : (
                messages.map((msg, index) => (
                  <div key={index} className={`mb-4 ${msg.senderId === peerId ? 'text-right' : 'text-left'}`}>
                    <div
                      className={`inline-block max-w-xs px-4 py-2 rounded-xl shadow-md ${msg.senderId === peerId
                        ? 'bg-gradient-to-r from-blue-500 to-teal-500 text-white'
                        : 'bg-gray-200/50 text-gray-900'
                        }`}
                    >
                      <div className="text-xs text-gray-600 mb-1">
                        {msg.senderName} {msg.senderId === peerId && '(You)'}
                      </div>
                      <p className="text-sm">{msg.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 border-t border-gray-200/50">
              <div className="flex">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  className="flex-1 bg-gray-200/50 text-gray-900 px-4 py-2 rounded-l-xl focus:outline-none focus:ring-2 focus:ring-blue-400/50 border border-gray-200/50"
                  placeholder="Type a message..."
                />
                <button
                  type="submit"
                  onClick={sendMessage}
                  className="bg-gradient-to-r from-blue-500 to-teal-500 text-white px-6 py-2 rounded-r-xl hover:from-blue-600 hover:to-teal-600 transition-all"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
          <div
            className={`absolute z-10 left-6 ${showparticipants ? 'bottom-6' : '-bottom-4'} w-96 bg-gray-200 rounded-2xl border border-gray-200/50 shadow-2xl transition-all duration-500 ease-in-out ${showparticipants ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}
          >
            <div className="p-4 border-b border-gray-200/50 bg-gray-100/50 rounded-t-2xl backdrop-blur-2xl flex justify-between items-center">
              <h3 className="text-gray-900 text-lg font-semibold flex items-center gap-x-2"> <HiOutlineUserGroup className=" size-5" /><span className="">Participiants {`(${participants?.length})`}</span></h3>
              <button onClick={() => setshowparticipants(false)} className="text-gray-500 hover:text-gray-900 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
            <div className='max-h-80 overflow-y-auto'>
              {
                participants?.map((per, index) => (
                  <div key={index} className={` flex item-center justify-between p-3 ${(participants.length - 1) === index ? "border-b-0" : "border-b"} border-b-gray-400`}>
                    <div className=' flex items-center justify-center gap-x-1'><span className=' text-gray-800 font-semibold'>{per.name}</span>{per.isAdmin && <span className="bg-gradient-to-r from-blue-500 to-teal-500 text-xs text-white px-3 py-1 rounded-full shadow-md">Admin</span>}<span>{per.id === socket.id && "(You)"}</span></div>
                    <div className=" flex item-center justify-center gap-x-2">
                      {
                        per.sharingScreen && (<MdScreenShare className=' size-5.5 text-blue-600' />)
                      }
                      {
                        per.isVideoOn ? <FiCamera className=' size-5 text-green-600' /> : <FiCameraOff className=' size-5 text-red-500' />
                      }
                      {
                        per.isAudioOn ? <IoMicOutline className=' size-5 text-green-600' /> : <IoMicOffOutline className=' size-5 text-red-500' />
                      }
                      {
                        per.handRaise && (<PiHandPalmDuotone className=' size-5 text-yellow-500' />)
                      }
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        </main>

        <Controls
          peerId={peerId}
          videoUrl={videoUrl}
          isMuted={!trackStates.audio}
          isVideoOff={!trackStates.video}
          isScreenSharing={trackStates.screen}
          onToggleAudio={toggleAudio}
          onToggleVideo={toggleVideo}
          onToggleScreenShare={toggleScreenShare}
          onLeaveRoom={leaveRoom}
          onToggleChat={() => setChatOpen(!chatOpen)}
          showparticipants={showparticipants}
          onToggleparticipants={() => setshowparticipants(!showparticipants)}
          someoneshare={screenSharingParticipant}
          chatOpen={chatOpen}
          setVideoUrl={setVideoUrl}
          handraiseoption={isuserhandraised}
          onTogglehandraise={togglehandraise}
          className="bg-white/50 backdrop-blur-md border-t border-gray-200/50"
        />

        {pendingPeers.length > 0 && (
          <div className="absolute top-24 right-6 w-80 bg-white/50 backdrop-blur-xl rounded-2xl border border-gray-200/50 shadow-2xl z-50">
            <div className="p-4 border-b border-gray-200/50">
              <h3 className="text-gray-900 text-lg font-semibold">Pending Join Requests ({pendingPeers.length})</h3>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {pendingPeers.map((peer) => (
                <div
                  key={peer.peerId}
                  className="p-4 border-b border-gray-200/50 last:border-b-0 flex justify-between items-center hover:bg-gray-100/30 transition-colors"
                >
                  <span className="text-gray-900 text-sm font-medium">{peer.name}</span>
                  {isAdmin && (
                    <button
                      onClick={() => handleAdmitParticipant(peer.peerId)}
                      className="bg-gradient-to-r from-green-400 to-teal-400 text-white px-4 py-1.5 rounded-full text-sm hover:from-green-500 hover:to-teal-500 transition-all shadow-md"
                    >
                      Admit
                    </button>
                  )}
                </div>
              ))}
              {!isAdmin && pendingPeers.length > 0 && (
                <div className="p-4 text-gray-500 text-sm text-center">
                  Waiting for admin to admit these participants.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Room;