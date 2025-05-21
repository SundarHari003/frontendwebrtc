import { io } from 'socket.io-client';
export const safeEmit = async (socket, event, data, options = {}) => {
    const { timeout = 10000, retries = 3 } = options;

    if (!socket) throw new Error(`Socket not initialized for ${event}`);

    // Wait for connection if not connected
    if (!socket.connected) {
        await new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                socket.off('connect', resolve);
                reject(new Error(`Socket connection timeout for ${event}`));
            }, timeout);

            socket.once('connect', () => {
                clearTimeout(timer);
                resolve();
            });
        });
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    socket.off(event, reject);
                    reject(new Error(`Timeout for ${event}`));
                }, timeout);

                socket.emit(event, data, (response) => {
                    clearTimeout(timer);
                    if (response?.error) {
                        reject(new Error(response.error));
                    } else {
                        resolve(response);
                    }
                });
            });
        } catch (err) {
            if (attempt === retries) throw err;
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
    }
};

export const initializeSocket = (url, options = {}) => {
    const socket = io(url, {
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        randomizationFactor: 0.5,
        timeout: 20000,
        transports: ['websocket'],
        autoConnect: false,
        ...options
    });

    return socket;
};

export const configureSocketEvents = (socket, handlers) => {
    // Connection events
    socket.on('connect', () => {
        console.log('Socket connected:', socket.id);
        handlers.onConnect?.();
    });

    socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        handlers.onDisconnect?.(reason);
    });

    socket.on('connect_error', (error) => {
        console.log('Socket connection error:', error.message);
        handlers.onConnectError?.(error);
    });

    socket.on('reconnect', (attempt) => {
        console.log(`Socket reconnected after ${attempt} attempts`);
        handlers.onReconnect?.(attempt);
    });

    socket.on('reconnect_attempt', (attempt) => {
        console.log(`Socket reconnection attempt ${attempt}`);
        handlers.onReconnectAttempt?.(attempt);
    });

    socket.on('reconnect_error', (error) => {
        console.log('Socket reconnection error:', error.message);
        handlers.onReconnectError?.(error);
    });

    socket.on('reconnect_failed', () => {
        console.log('Socket reconnection failed');
        handlers.onReconnectFailed?.();
    });

    // Custom application events
    if (handlers.onApproved) socket.on('approved', handlers.onApproved);
    if (handlers.onRejected) socket.on('rejected', handlers.onRejected);
    if (handlers.onParticipantsUpdated) socket.on('participantsUpdated', handlers.onParticipantsUpdated);
    if (handlers.onUserRequest) socket.on('userRequest', handlers.onUserRequest);
    if (handlers.onUserJoined) socket.on('userJoined', handlers.onUserJoined);
    if (handlers.onUserLeft) socket.on('userLeft', handlers.onUserLeft);
    if (handlers.onRoomClosed) socket.on('roomClosed', handlers.onRoomClosed);
    if (handlers.onVideoToggled) socket.on('videoToggled', handlers.onVideoToggled);
    if (handlers.onAudioToggled) socket.on('audioToggled', handlers.onAudioToggled);
    if (handlers.onMediaForced) socket.on('mediaForced', handlers.onMediaForced);
    if (handlers.onNewProducer) socket.on('newProducer', handlers.onNewProducer);
    if (handlers.onRestartIce) socket.on('restartIce', handlers.onRestartIce);

    return () => {
        socket.off('connect');
        socket.off('disconnect');
        socket.off('connect_error');
        socket.off('reconnect');
        socket.off('reconnect_attempt');
        socket.off('reconnect_error');
        socket.off('reconnect_failed');

        // Remove custom event listeners
        if (handlers.onApproved) socket.off('approved');
        if (handlers.onRejected) socket.off('rejected');
        if (handlers.onParticipantsUpdated) socket.off('participantsUpdated');
        if (handlers.onUserRequest) socket.off('userRequest');
        if (handlers.onUserJoined) socket.off('userJoined');
        if (handlers.onUserLeft) socket.off('userLeft');
        if (handlers.onRoomClosed) socket.off('roomClosed');
        if (handlers.onVideoToggled) socket.off('videoToggled');
        if (handlers.onAudioToggled) socket.off('audioToggled');
        if (handlers.onMediaForced) socket.off('mediaForced');
        if (handlers.onNewProducer) socket.off('newProducer');
        if (handlers.onRestartIce) socket.off('restartIce');
    };
};