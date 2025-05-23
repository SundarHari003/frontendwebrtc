import React, { useEffect, useRef } from 'react';

const Video = ({ Videostream, Audiostream, muted, className = '', islocal, stream }) => {
  const videoRef = useRef(null);
  function mergeMediaStreams(videoStream, audioStream) {
    const combinedStream = new MediaStream();

    if (videoStream) {
      videoStream.getVideoTracks().forEach((track) => combinedStream.addTrack(track));
    }

    if (audioStream) {
      audioStream.getAudioTracks().forEach((track) => combinedStream.addTrack(track));
    }

    return combinedStream;
  }
  useEffect(() => {
    if (videoRef.current && Videostream) {
      videoRef.current.srcObject = mergeMediaStreams(Videostream, Audiostream);
    }
    if (islocal) {
      videoRef.current.srcObject = stream;
    }

    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [stream, Videostream, Audiostream]);

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