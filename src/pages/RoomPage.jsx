import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
// import { io } from 'socket.io-client';
// import * as mediasoupClient from 'mediasoup-client';
import {
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
    setError  // Add this import
} from '../redux/slice/roomSlice';
import { safeEmit, initializeSocket, configureSocketEvents } from '../utils/socketUtils';
// import { usewebRTC } from '../hooks/usewebRTC'
import Participant from '../components/Participant';
import MediaControls from '../components/MediaControls';
import AdminControls from '../components/AdminControls';
import WaitingApproval from '../components/WaitingApproval';
import ParticipantList from '../components/ParticipantList';
import ConnectionStatus from '../components/ConnectionStatus';

const RoomPage = () => {
    const { roomId: paramRoomId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useDispatch();
    const {
        currentUser,
        currentRoom,
        participants,
        pendingRequests,
        connectionStatus,
        mediaState,
        error
    } = useSelector((state) => state.room);

    const [localStream, setLocalStream] = useState(null);
    const [remoteStreams, setRemoteStreams] = useState({});
    const [screenStream, setScreenStream] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const socketRef = useRef(null);
    const isMountedRef = useRef(false);
    const localVideoRef = useRef(null);

    const roomId = paramRoomId === 'create' ? null : paramRoomId;

    const {
        deviceRef,
        transportsRef,
        producersRef,
        consumersRef,
        localStreamRef,
        screenStreamRef,
        loadDevice,
        createTransports,
        getMediaStream,
        produceMedia,
        stopProducer,
        consumeMedia,
        removeConsumer,
        cleanup
    } = usewebRTC(roomId, socketRef.current);

    // Initialize socket connection
    const initializeSocketConnection = useCallback(() => {
        if (socketRef.current?.connected) return;

        const socket = initializeSocket('http://localhost:5000');
        socketRef.current = socket;

        const cleanupSocketEvents = configureSocketEvents(socket, {
            onConnect: async () => {
                try {
                    dispatch(setConnectionStatus('connected'));

                    if (!currentUser) {
                        console.error('User not initialized');
                        navigate('/');
                        return;
                    }

                    if (currentUser.isAdmin) {
                        const response = await safeEmit(socket, 'createRoom', { name: currentUser.name });
                        if (response?.roomId && isMountedRef.current) {
                            dispatch(setRoom({ id: response.roomId, isActive: true }));
                            navigate(`/room/${response.roomId}`, { replace: true });
                            await initializeRoom(response.roomId);
                        }
                    } else if (roomId) {
                        const response = await safeEmit(socket, 'joinRoom', { roomId, name: currentUser.name });
                        if (response.status === 'Waiting for approval' && isMountedRef.current) {
                            dispatch(setRoom({ id: roomId, isActive: false }));
                        }
                    }
                } catch (err) {
                    dispatch(setError(`Connection error: ${err.message}`));
                    dispatch(setConnectionStatus('error'));
                }
            },
            onDisconnect: (reason) => {
                dispatch(setConnectionStatus('disconnected'));
                if (reason !== 'io client disconnect' && isMountedRef.current) {
                    dispatch(setError('Connection lost. Reconnecting...'));
                }
            },
            onReconnect: async (attempt) => {
                dispatch(setConnectionStatus('connected'));
                dispatch(setError(null));
                if (currentRoom?.id && isMountedRef.current) {
                    await initializeRoom(currentRoom.id);
                }
            },
            onReconnectFailed: () => {
                dispatch(setError('Failed to reconnect after multiple attempts'));
                dispatch(setConnectionStatus('error'));
                if (isMountedRef.current) navigate('/');
            },
            onApproved: ({ roomId }) => {
                if (isMountedRef.current) {
                    dispatch(setRoom({ id: roomId, isActive: true }));
                    initializeRoom(roomId);
                }
            },
            onRejected: () => {
                if (isMountedRef.current) {
                    dispatch(resetRoom());
                    dispatch(setError('Join request rejected'));
                    navigate('/');
                }
            },
            onParticipantsUpdated: ({ participants }) => {
                if (isMountedRef.current) dispatch(setParticipants(participants));
            },
            onUserRequest: ({ userId, name }) => {
                if (isMountedRef.current) {
                    dispatch(setPendingRequests([...pendingRequests, { userId, name }]));
                }
            },
            onUserJoined: ({ userId, name, videoEnabled, audioEnabled }) => {
                if (isMountedRef.current) {
                    dispatch(addParticipant({ id: userId, name, videoEnabled, audioEnabled }));
                    dispatch(setPendingRequests(pendingRequests.filter((req) => req.userId !== userId)));
                }
            },
            onUserLeft: ({ userId }) => {
                if (isMountedRef.current) {
                    dispatch(removeParticipant(userId));
                    removeConsumer(userId);
                    setRemoteStreams((prev) => {
                        const newStreams = { ...prev };
                        delete newStreams[userId];
                        return newStreams;
                    });
                }
            },
            onRoomClosed: () => {
                if (isMountedRef.current) {
                    dispatch(resetRoom());
                    dispatch(setError('Room closed by admin'));
                    navigate('/');
                }
            },
            onVideoToggled: ({ userId, enabled }) => {
                if (isMountedRef.current) {
                    dispatch(updateParticipant({ userId, videoEnabled: enabled }));
                    if (userId === socket.id) dispatch(setMediaState({ videoEnabled: enabled }));
                }
            },
            onAudioToggled: ({ userId, enabled }) => {
                if (isMountedRef.current) {
                    dispatch(updateParticipant({ userId, audioEnabled: enabled }));
                    if (userId === socket.id) dispatch(setMediaState({ audioEnabled: enabled }));
                }
            },
            onMediaForced: ({ audioEnabled, videoEnabled }) => {
                if (isMountedRef.current) {
                    dispatch(setMediaState({ audioEnabled, videoEnabled }));
                    if (!audioEnabled) stopProducer('audio');
                    if (!videoEnabled) stopProducer('video');
                }
            },
            onNewProducer: async ({ producerId, kind, socketId, appData }) => {
                if (socketId !== socketRef.current?.id && isMountedRef.current) {
                    try {
                        const { consumer, stream } = await consumeMedia(producerId, socketId, kind);
                        setRemoteStreams(prev => ({ ...prev, [socketId]: stream }));
                    } catch (err) {
                        console.error('Failed to consume new producer:', err);
                    }
                }
            },
            onRestartIce: async ({ direction }) => {
                if (!isMountedRef.current) return;

                try {
                    const response = await safeEmit(socketRef.current, 'createTransport', { roomId, direction });
                    const transportParams = {
                        id: response.id,
                        iceParameters: response.iceParameters,
                        iceCandidates: response.iceCandidates,
                        dtlsParameters: response.dtlsParameters,
                    };

                    if (direction === 'send') {
                        if (transportsRef.current.send && !transportsRef.current.send.closed) {
                            transportsRef.current.send.close();
                        }
                        transportsRef.current.send = deviceRef.current.createSendTransport(transportParams);
                        // Reconfigure transport events and re-produce tracks...
                    } else {
                        if (transportsRef.current.recv && !transportsRef.current.recv.closed) {
                            transportsRef.current.recv.close();
                        }
                        transportsRef.current.recv = deviceRef.current.createRecvTransport(transportParams);
                        // Reconfigure transport events...
                    }
                } catch (err) {
                    console.error('Error restarting ICE:', err);
                }
            }
        });

        socket.connect();

        return () => {
            cleanupSocketEvents();
            socket.disconnect();
        };
    }, [dispatch, navigate, roomId, currentUser, currentRoom, pendingRequests]);

    // Initialize room and media
    const initializeRoom = async (roomId) => {
        if (!socketRef.current?.connected) {
            await new Promise((resolve) => {
                socketRef.current.once('connect', resolve);
            });
        }

        setIsLoading(true);
        try {
            await loadDevice();
            await createTransports(roomId);
            await setupLocalMedia(roomId);

            const { participants } = await new Promise((resolve, reject) => {
                socketRef.current.emit('getParticipants', { roomId }, (response) => {
                    if (response?.error) {
                        reject(new Error(response.error));
                    } else {
                        resolve(response);
                    }
                });
            });

            dispatch(setParticipants(participants));
            dispatch(setError(null));
        } catch (err) {
            console.error('Room initialization failed:', err);
            dispatch(setError(`Room initialization failed: ${err.message}`));
            dispatch(setConnectionStatus('error'));
        } finally {
            setIsLoading(false);
        }
    };

    // Set up local media streams
    const setupLocalMedia = async (roomId) => {
        const constraints = {
            video: mediaState.videoEnabled ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
            audio: mediaState.audioEnabled ? { echoCancellation: true, noiseSuppression: true } : false,
        };

        try {
            const stream = await getMediaStream(constraints);
            localStreamRef.current = stream;
            setLocalStream(stream);
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;

            const producePromises = [];
            if (mediaState.videoEnabled && stream.getVideoTracks().length > 0) {
                producePromises.push(produceMedia('video', stream.getVideoTracks()[0]));
            }
            if (mediaState.audioEnabled && stream.getAudioTracks().length > 0) {
                producePromises.push(produceMedia('audio', stream.getAudioTracks()[0]));
            }
            await Promise.all(producePromises);
        } catch (err) {
            console.error('Error getting media:', err);
            if (mediaState.videoEnabled) {
                // Fallback to audio only if video fails
                const audioStream = await getMediaStream({
                    audio: { echoCancellation: true, noiseSuppression: true },
                    video: false
                });
                localStreamRef.current = audioStream;
                setLocalStream(audioStream);
                if (localVideoRef.current) localVideoRef.current.srcObject = audioStream;

                if (mediaState.audioEnabled && audioStream.getAudioTracks().length > 0) {
                    await produceMedia('audio', audioStream.getAudioTracks()[0]);
                }

                dispatch(setMediaState({ videoEnabled: false }));
            } else {
                throw err;
            }
        }
    };

    // Toggle media (video/audio)
    const toggleMedia = async (type) => {
        const currentState = mediaState[`${type}Enabled`];
        const newState = !currentState;

        try {
            await safeEmit(socketRef.current, `toggle${type.charAt(0).toUpperCase() + type.slice(1)}`, {
                roomId,
                enabled: newState
            });
            dispatch(setMediaState({ [`${type}Enabled`]: newState }));

            if (newState) {
                const stream = await getMediaStream({ [type]: true });
                const track = stream.getTracks()[0];

                if (type === 'video') {
                    const newStream = localStreamRef.current ?
                        new MediaStream([...localStreamRef.current.getTracks(), track]) :
                        new MediaStream([track]);
                    localStreamRef.current = newStream;
                    setLocalStream(newStream);
                    if (localVideoRef.current) localVideoRef.current.srcObject = newStream;
                } else if (localStreamRef.current) {
                    localStreamRef.current.addTrack(track);
                }

                await produceMedia(type, track);
            } else {
                stopProducer(type);

                if (type === 'video' && localStreamRef.current?.getVideoTracks().length > 0) {
                    localStreamRef.current.getVideoTracks()[0].stop();
                    const newStream = new MediaStream(localStreamRef.current.getAudioTracks());
                    localStreamRef.current = newStream;
                    setLocalStream(newStream);
                    if (localVideoRef.current) localVideoRef.current.srcObject = newStream;
                } else if (type === 'audio' && localStreamRef.current?.getAudioTracks().length > 0) {
                    localStreamRef.current.getAudioTracks()[0].stop();
                    const newStream = new MediaStream(localStreamRef.current.getVideoTracks());
                    localStreamRef.current = newStream;
                    setLocalStream(newStream);
                }
            }
        } catch (err) {
            console.error(`Error toggling ${type}:`, err);
            dispatch(setMediaState({ [`${type}Enabled`]: currentState }));
        }
    };

    // Toggle screen sharing
    const toggleScreenShare = async () => {
        const isSharing = screenStreamRef.current !== null;

        try {
            if (isSharing) {
                // Stop screen share
                await safeEmit(socketRef.current, 'stopScreenShare', { roomId });
                stopProducer('screen');
                screenStreamRef.current.getTracks().forEach(track => track.stop());
                screenStreamRef.current = null;
                setScreenStream(null);
            } else {
                // Start screen share
                const stream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: true
                });

                stream.getVideoTracks()[0].onended = () => {
                    if (isMountedRef.current) {
                        toggleScreenShare();
                    }
                };

                screenStreamRef.current = stream;
                setScreenStream(stream);

                await produceMedia('video', stream.getVideoTracks()[0], { source: 'screen' });
                if (stream.getAudioTracks().length > 0) {
                    await produceMedia('audio', stream.getAudioTracks()[0], { source: 'screen' });
                }
            }
        } catch (err) {
            console.error('Error toggling screen share:', err);
        }
    };

    // Leave room
    const leaveRoom = () => {
        cleanup();
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
        }
        dispatch(resetRoom());
        navigate('/');
    };

    // Initialize component
    useEffect(() => {
        isMountedRef.current = true;

        if (!currentUser) {
            const params = new URLSearchParams(location.search);
            const name = params.get('name');
            if (name) {
                dispatch(setUser({
                    name,
                    isAdmin: paramRoomId === 'create',
                    videoEnabled: true,
                    audioEnabled: true
                }));
            } else {
                navigate('/');
                return;
            }
        }

        const cleanupSocket = initializeSocketConnection();

        return () => {
            isMountedRef.current = false;
            cleanupSocket();
            cleanup();
        };
    }, [dispatch, navigate, location.search, paramRoomId, currentUser, initializeSocketConnection, cleanup]);

    if (!currentUser?.isAdmin && !currentRoom?.isActive) {
        return <WaitingApproval />;
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="mt-4 text-lg">
                        {connectionStatus === 'disconnected' ? 'Reconnecting...' : 'Setting up your room...'}
                    </p>
                    {error && <p className="text-red-500 mt-2">{error}</p>}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-gray-100">
            <ConnectionStatus status={connectionStatus} error={error} />

            <header className="bg-white shadow-sm py-4 px-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-semibold text-gray-800">
                            {currentRoom?.id ? `Room: ${currentRoom.id}` : 'Loading room...'}
                        </h1>
                        <p className="text-sm text-gray-500">{participants.length} participant(s) online</p>
                    </div>
                    {currentUser?.isAdmin && (
                        <button
                            onClick={() => navigator.clipboard.writeText(currentRoom.id)}
                            className="bg-blue-100 text-blue-600 px-4 py-2 rounded-md hover:bg-blue-200 transition flex items-center"
                        >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                            </svg>
                            Copy Room ID
                        </button>
                    )}
                </div>
            </header>

            <main className="flex-1 p-6">
                <div className="flex flex-col lg:flex-row gap-6">
                    <div className="lg:w-1/4">
                        <ParticipantList
                            participants={participants}
                            currentUserId={socketRef.current?.id}
                            isAdmin={currentUser?.isAdmin}
                            onMute={(userId, audio, video) =>
                                safeEmit(socketRef.current, 'muteParticipant', {
                                    roomId,
                                    userId,
                                    audioEnabled: audio,
                                    videoEnabled: video
                                })
                            }
                        />
                    </div>

                    <div className="lg:w-3/4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                            <Participant
                                stream={localStream}
                                videoRef={localVideoRef}
                                name={currentUser?.name}
                                isAdmin={currentUser?.isAdmin}
                                isYou={true}
                                videoEnabled={mediaState.videoEnabled}
                                audioEnabled={mediaState.audioEnabled}
                            />

                            {screenStream && (
                                <Participant
                                    stream={screenStream}
                                    name={`${currentUser?.name}'s Screen`}
                                    isYou={true}
                                    videoEnabled={true}
                                    audioEnabled={screenStream.getAudioTracks().length > 0}
                                    screenShareEnabled={true}
                                />
                            )}

                            {participants
                                .filter((p) => p.id !== socketRef.current?.id)
                                .map((participant) => (
                                    <Participant
                                        key={participant.id}
                                        stream={remoteStreams[participant.id]}
                                        name={participant.name}
                                        isAdmin={participant.isAdmin}
                                        videoEnabled={participant.videoEnabled}
                                        audioEnabled={participant.audioEnabled}
                                    />
                                ))}
                        </div>
                    </div>
                </div>

                {currentUser?.isAdmin && (
                    <AdminControls
                        pendingRequests={pendingRequests}
                        participants={participants}
                        onApprove={(userId) => safeEmit(socketRef.current, 'approveUser', { roomId, userId })}
                        onReject={(userId) => safeEmit(socketRef.current, 'rejectUser', { roomId, userId })}
                        onMute={(userId, audio, video) =>
                            safeEmit(socketRef.current, 'muteParticipant', {
                                roomId,
                                userId,
                                audioEnabled: audio,
                                videoEnabled: video
                            })
                        }
                    />
                )}
            </main>

            <footer className="bg-white border-t py-4 px-6">
                <MediaControls
                    videoEnabled={mediaState.videoEnabled}
                    audioEnabled={mediaState.audioEnabled}
                    screenShareEnabled={screenStream !== null}
                    onToggleVideo={() => toggleMedia('video')}
                    onToggleAudio={() => toggleMedia('audio')}
                    onToggleScreenShare={toggleScreenShare}
                    onLeave={leaveRoom}
                />
            </footer>
        </div>
    );
};

export default RoomPage;