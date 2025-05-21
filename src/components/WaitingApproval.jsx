import React from 'react';

const WaitingApproval = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="text-center max-w-md p-6 bg-white rounded-lg shadow-md">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Waiting for Approval</h2>
        <p className="text-gray-600 mb-4">
          Your request to join the room has been sent to the host. Please wait while they approve your request.
        </p>
        <p className="text-sm text-gray-500">
          You will be automatically connected once approved.
        </p>
      </div>
    </div>
  );
};

export default WaitingApproval;