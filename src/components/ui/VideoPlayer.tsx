import React from 'react';

interface VideoPlayerProps {
    url: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ url }) => {
    if (!url) return null;

    // YouTube parser
    const getYouTubeId = (urlStr: string) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
        const match = urlStr.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    // Instagram parser
    const getInstagramShortcode = (urlStr: string) => {
        const match = urlStr.match(/instagram\.com\/(?:p|reel|tv)\/([a-zA-Z0-9_\-]+)/i);
        return match && match[1] ? match[1] : null;
    };

    // Facebook checker
    const isFacebook = (urlStr: string) => {
        return urlStr.includes('facebook.com') || urlStr.includes('fb.watch');
    };

    const ytId = getYouTubeId(url);
    const igCode = getInstagramShortcode(url);

    if (ytId) {
        return (
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-slate-100 shadow-sm">
                <iframe
                    src={`https://www.youtube.com/embed/${ytId}`}
                    title="YouTube video player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                />
            </div>
        );
    }

    if (igCode) {
        return (
            <div className="relative w-full overflow-hidden bg-slate-50 border border-slate-100 rounded-2xl shadow-sm flex justify-center py-4">
                <iframe
                    src={`https://www.instagram.com/p/${igCode}/embed/`}
                    title="Instagram Embed"
                    frameBorder="0"
                    scrolling="no"
                    allowTransparency
                    allowFullScreen
                    className="w-full max-w-[400px] min-h-[500px] aspect-[9/16] rounded-xl border border-slate-200"
                />
            </div>
        );
    }

    if (isFacebook(url)) {
        return (
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-slate-100 shadow-sm">
                <iframe
                    src={`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=0&width=560`}
                    title="Facebook video player"
                    frameBorder="0"
                    allowFullScreen
                    allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                    className="absolute inset-0 w-full h-full"
                />
            </div>
        );
    }

    // Fallback link
    return (
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 text-center">
            <span className="material-symbols-outlined text-accent text-3xl mb-2">play_circle</span>
            <p className="text-sm font-semibold text-primary mb-1">Video Walkthrough Available</p>
            <p className="text-xs text-slate-500 mb-4">Click the link below to watch the video tour on the provider's platform.</p>
            <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 bg-accent/10 hover:bg-accent text-accent hover:text-primary px-4 py-2 rounded-xl text-xs font-bold transition-all"
            >
                Watch Video <span className="material-symbols-outlined text-sm">open_in_new</span>
            </a>
        </div>
    );
};

export default VideoPlayer;
