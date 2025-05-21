import React, { useEffect, useRef } from 'react';

const Video = ({ stream, muted, className = '' }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }

    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      className={className}
      onLoadedMetadata={() => videoRef.current.play()}
    />
  );
};

export default Video;