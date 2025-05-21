import { useEffect, useRef, useCallback } from 'react';
import * as mediasoupClient from 'mediasoup-client';
import { useDispatch, useSelector } from 'react-redux';
import { safeEmit } from '../utils/socketUtils';

export const usewebRTC = (roomId, socket) => {
    const dispatch = useDispatch();
    const { currentUser } = useSelector((state) => state.room);

    const deviceRef = useRef(null);
    const transportsRef = useRef({ send: null, recv: null });
    const producersRef = useRef({});
    const consumersRef = useRef({});
    const localStreamRef = useRef(null);
    const screenStreamRef = useRef(null);

    const loadDevice = async () => {
        try {
            if (!deviceRef.current) {
                deviceRef.current = new mediasoupClient.Device();
            }

            if (!deviceRef.current.loaded) {
                // Wait for socket to be ready if needed
                if (!socket?.connected) {
                    await new Promise((resolve) => {
                        if (socket.connected) resolve();
                        socket.once('connect', resolve);
                    });
                }

                const { routerRtpCapabilities } = await new Promise((resolve, reject) => {
                    socket.emit('getRouterRtpCapabilities', { roomId }, (response) => {
                        if (response?.error) {
                            reject(new Error(response.error));
                        } else {
                            resolve(response);
                        }
                    });
                });

                await deviceRef.current.load({ routerRtpCapabilities });
            }
        } catch (err) {
            console.error('Device loading failed:', err);
            throw err;
        }
    };


    const createTransports = async () => {
        try {
            const [sendTransportParams, recvTransportParams] = await Promise.all([
                safeEmit(socket, 'createTransport', { roomId, direction: 'send' }),
                safeEmit(socket, 'createTransport', { roomId, direction: 'recv' }),
            ]);

            if (!sendTransportParams || !recvTransportParams) {
                throw new Error('Failed to create transports');
            }

            const sendTransport = deviceRef.current.createSendTransport(sendTransportParams);
            const recvTransport = deviceRef.current.createRecvTransport(recvTransportParams);

            // Configure transport event handlers
            configureTransportEvents(sendTransport, recvTransport);

            transportsRef.current.send = sendTransport;
            transportsRef.current.recv = recvTransport;
        } catch (err) {
            console.error('Error creating transports:', err);
            throw err;
        }
    };

    const configureTransportEvents = (sendTransport, recvTransport) => {
        sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
            try {
                await safeEmit(socket, 'connectTransport', {
                    roomId,
                    transportId: sendTransport.id,
                    dtlsParameters,
                });
                callback();
            } catch (error) {
                errback(error);
            }
        });

        sendTransport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
            try {
                const { id } = await safeEmit(socket, 'produce', { roomId, kind, rtpParameters, appData });
                callback({ id });
            } catch (error) {
                errback(error);
            }
        });

        sendTransport.on('connectionstatechange', (state) => {
            console.log('Send Transport state:', state);
            if (state === 'disconnected' || state === 'failed') {
                dispatch(setConnectionStatus('disconnected'));
            }
        });

        recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
            try {
                await safeEmit(socket, 'connectTransport', {
                    roomId,
                    transportId: recvTransport.id,
                    dtlsParameters,
                });
                callback();
            } catch (error) {
                errback(error);
            }
        });

        recvTransport.on('connectionstatechange', (state) => {
            console.log('Recv Transport state:', state);
            if (state === 'disconnected' || state === 'failed') {
                dispatch(setConnectionStatus('disconnected'));
            }
        });
    };

    const getMediaStream = async (constraints) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            return stream;
        } catch (err) {
            console.error('Error getting media:', err);
            throw err;
        }
    };

    const produceMedia = async (kind, track, appData = {}) => {
        if (!transportsRef.current.send || transportsRef.current.send.closed) {
            throw new Error('Send transport not available');
        }

        const producer = await transportsRef.current.send.produce({
            track,
            appData: { source: kind, ...appData }
        });

        producersRef.current[kind] = producer;

        producer.on('trackended', () => {
            console.log(`${kind} track ended`);
            stopProducer(kind);
        });

        producer.on('transportclose', () => {
            console.log(`${kind} transport closed`);
            delete producersRef.current[kind];
        });

        return producer;
    };

    const stopProducer = (kind) => {
        if (producersRef.current[kind]) {
            producersRef.current[kind].close();
            delete producersRef.current[kind];
        }
    };

    const consumeMedia = async (producerId, socketId, kind) => {
        if (!deviceRef.current || !transportsRef.current.recv) return;

        try {
            const { rtpCapabilities } = deviceRef.current;
            const response = await safeEmit(socket, 'consume', { roomId, producerId, rtpCapabilities });

            const consumer = await transportsRef.current.recv.consume({
                id: response.id,
                producerId,
                kind: response.kind,
                rtpParameters: response.rtpParameters,
            });

            consumersRef.current[socketId] = consumersRef.current[socketId] || {};
            consumersRef.current[socketId][producerId] = consumer;

            const stream = new MediaStream([consumer.track]);

            await safeEmit(socket, 'resumeConsumer', { roomId, consumerId: consumer.id });

            consumer.on('trackended', () => {
                console.log(`Consumer track ended for ${socketId}`);
                removeConsumer(socketId, producerId);
            });

            consumer.on('transportclose', () => {
                console.log(`Consumer transport closed for ${socketId}`);
                removeConsumer(socketId, producerId);
            });

            return { consumer, stream };
        } catch (err) {
            console.error(`Failed to consume ${producerId}:`, err);
            throw err;
        }
    };

    const removeConsumer = (socketId, producerId) => {
        if (consumersRef.current[socketId]?.[producerId]) {
            consumersRef.current[socketId][producerId].close();
            delete consumersRef.current[socketId][producerId];
        }
    };

    const cleanup = useCallback(() => {
        // Close all producers
        Object.keys(producersRef.current).forEach(kind => {
            if (producersRef.current[kind] && !producersRef.current[kind].closed) {
                producersRef.current[kind].close();
            }
        });
        producersRef.current = {};

        // Close all consumers
        Object.keys(consumersRef.current).forEach(socketId => {
            Object.keys(consumersRef.current[socketId]).forEach(producerId => {
                if (consumersRef.current[socketId][producerId] && !consumersRef.current[socketId][producerId].closed) {
                    consumersRef.current[socketId][producerId].close();
                }
            });
        });
        consumersRef.current = {};

        // Close transports
        if (transportsRef.current.send && !transportsRef.current.send.closed) {
            transportsRef.current.send.close();
        }
        if (transportsRef.current.recv && !transportsRef.current.recv.closed) {
            transportsRef.current.recv.close();
        }
        transportsRef.current = { send: null, recv: null };

        // Stop media streams
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(track => track.stop());
            screenStreamRef.current = null;
        }
    }, []);

    return {
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
    };
};