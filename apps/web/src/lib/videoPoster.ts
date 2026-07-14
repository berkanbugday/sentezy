/** Draw a frame from a video file to a canvas and return a JPEG object URL — a
 *  reliable cross-browser thumbnail (a bare <video> often paints a blank tile). */
export function videoPoster(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = URL.createObjectURL(file);
    const done = (out: string | null) => {
      URL.revokeObjectURL(video.src);
      resolve(out);
    };
    video.onloadeddata = () => {
      video.currentTime = Math.min(0.1, (video.duration || 1) / 2);
    };
    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx || !canvas.width) return done(null);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => done(blob ? URL.createObjectURL(blob) : null), "image/jpeg", 0.8);
      } catch {
        done(null);
      }
    };
    video.onerror = () => done(null);
  });
}
