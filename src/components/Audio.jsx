import React from 'react'

const Audio = ({stream}) => {
    const audioRef = React.useRef(null);
    React.useEffect(() => {
        if (audioRef.current) {
            audioRef.current.srcObject = stream;
        }
        return () => {
            if (audioRef.current) {
                audioRef.current.srcObject = null;
            }
        };
    }, [stream]);
  return (
    <audio
      ref={audioRef}
      autoPlay
      playsInline
      className=" hidden"
      onLoadedMetadata={() => audioRef.current.play()}
    />
  )
}

export default Audio