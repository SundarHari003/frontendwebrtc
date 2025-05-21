import React, { useEffect, useRef } from 'react';

const Chat = ({ messages, onSendMessage, inputRef }) => {
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSubmit = (e) => {
        e.preventDefault();
        const message = inputRef.current.value.trim();
        if (message) {
            onSendMessage(message);
        }
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((message, index) => (
                    <div key={index} className="flex">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center mr-2">
                            <span className="text-white text-sm">
                                {message.name?.charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <div className="flex-1">
                            <div className="text-sm font-medium text-indigo-400">
                                {message.name}
                                <span className="ml-2 text-xs text-gray-400">
                                    {new Date(message.timestamp).toLocaleTimeString()}
                                </span>
                            </div>
                            <div className="text-white">{message.message}</div>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSubmit} className="p-4 border-t border-gray-700">
                <div className="flex">
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Type a message..."
                        className="flex-1 bg-gray-700 text-white px-3 py-2 rounded-l focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                        type="submit"
                        className="bg-indigo-600 text-white px-4 py-2 rounded-r hover:bg-indigo-700"
                    >
                        Send
                    </button>
                </div>
            </form>
        </div>
    );
};

export default Chat;