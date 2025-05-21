import React, { useState, useRef } from 'react';

const MessageInput = ({ onSend }) => {
    const [message, setMessage] = useState('');
    const [file, setFile] = useState(null);
    const fileInputRef = useRef();

    const handleSubmit = (e) => {
        e.preventDefault();
        if (message.trim() || file) {
            onSend(message, file);
            setMessage('');
            setFile(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            if (selectedFile.size > 5 * 1024 * 1024) {
                alert('File size exceeds 5MB limit');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (event) => {
                setFile({
                    name: selectedFile.name,
                    type: selectedFile.type,
                    size: selectedFile.size,
                    data: event.target.result.split(',')[1]
                });
            };
            reader.readAsDataURL(selectedFile);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex space-x-2">
            <div className="flex-1 relative">
                <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <label className="absolute right-2 top-1/2 transform -translate-y-1/2 cursor-pointer">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        accept="image/*,application/pdf"
                    />
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400 hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                </label>
            </div>
            <button
                type="submit"
                className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
            </button>
        </form>
    );
};

export default MessageInput;