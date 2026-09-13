import { getValidImageSrc, isValidImageSrc } from '../../utils/imageUtils';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';
import { HeroBanner } from '../../types';
import {

  extractYouTubeVideoId,
  isYouTubeUrl,
  isValidDirectMediaUrl,
  buildYouTubeEmbedUrl,
  getYouTubeThumbnailUrl
} from '../../utils/youtube';

// Configurable video load timeout (ms) — aborts slow/stalled video loading to preserve fast poster experience
const DIRECT_VIDEO_TIMEOUT_MS = 8000;

interface HeroBannerVideoSlideProps {
  banner: HeroBanner;
  isPaused?: boolean;
  shouldReduceMotion?: boolean;
  imageSizeMode?: 'contain' | 'cover';
}

export function HeroBannerVideoSlide({
  banner,
  shouldReduceMotion = false,
  imageSizeMode = 'contain'
}: HeroBannerVideoSlideProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [videoReady, setVideoReady] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isUserPaused, setIsUserPaused] = useState(false);

  // Stale operation & session tracking
  const sessionRef = useRef(0);
  const isMountedRef = useRef(true);
  const userPausedRef = useRef(false);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Responsive device check for mobile video selection
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(max-width: 640px)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(max-width: 640px)');
    const updateMobile = (e: MediaQueryListEvent) => setIsMobile(e.matches);

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', updateMobile);
      return () => mediaQuery.removeEventListener('change', updateMobile);
    } else {
      mediaQuery.addListener(updateMobile);
      return () => mediaQuery.removeListener(updateMobile);
    }
  }, []);

  // Track component mounted state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  // 1. YouTube vs Direct Video Source Resolution
  const rawDesktopUrl = banner.videoUrl?.trim() || '';
  const rawMobileUrl = banner.mobileVideoUrl?.trim() || '';

  // Mobile source selection: use mobileVideoUrl if present, otherwise fallback to videoUrl
  const activeRawVideoUrl = isMobile
    ? (rawMobileUrl || rawDesktopUrl)
    : (rawDesktopUrl || rawMobileUrl);

  const isDesktopYouTube = Boolean(banner.youtubeVideoId) || isYouTubeUrl(rawDesktopUrl);
  const isMobileYouTube = Boolean(banner.mobileYoutubeVideoId) || isYouTubeUrl(rawMobileUrl);

  const isYouTube =
    banner.videoSource === 'youtube' ||
    Boolean(banner.youtubeVideoId) ||
    Boolean(banner.mobileYoutubeVideoId) ||
    (isMobile ? isMobileYouTube : isDesktopYouTube) ||
    isYouTubeUrl(activeRawVideoUrl);

  // Extract YouTube Video IDs safely
  const desktopYouTubeId =
    banner.youtubeVideoId ||
    extractYouTubeVideoId(rawDesktopUrl) ||
    null;

  const mobileYouTubeId =
    banner.mobileYoutubeVideoId ||
    extractYouTubeVideoId(rawMobileUrl) ||
    desktopYouTubeId;

  const activeYouTubeId = isMobile
    ? (mobileYouTubeId || desktopYouTubeId)
    : (desktopYouTubeId || mobileYouTubeId);

  // Direct HTML5 Video URLs (MP4 / WebM / direct playable streams)
  const directVideoSrc = !isYouTube && isValidDirectMediaUrl(activeRawVideoUrl)
    ? activeRawVideoUrl
    : '';

  // 2. Poster Image Hierarchy (Authoritative Base Layer)
  const baseDesktopPoster =
    banner.posterImageUrl ||
    banner.desktopImageUrl ||
    banner.productImageUrl ||
    banner.backgroundImageUrl ||
    (activeYouTubeId ? getYouTubeThumbnailUrl(activeYouTubeId, 'maxresdefault') : '');

  const baseMobilePoster =
    banner.mobilePosterImageUrl ||
    banner.mobileImageUrl ||
    baseDesktopPoster;

  const activePoster = isMobile
    ? (baseMobilePoster || baseDesktopPoster)
    : (baseDesktopPoster || baseMobilePoster);

  // Development Logging for Parity Tracing
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Hero Storefront Debug]', {
        bannerId: banner.id,
        mediaType: banner.mediaType,
        videoSource: banner.videoSource,
        videoUrl: banner.videoUrl,
        mobileVideoUrl: banner.mobileVideoUrl,
        resolvedActiveVideoUrl: activeRawVideoUrl,
        isYouTube,
        activeYouTubeId,
        directVideoSrc,
        posterImageUrl: banner.posterImageUrl,
        mobilePosterImageUrl: banner.mobilePosterImageUrl,
        active: banner.isActive,
        placements: banner.placements
      });
    }
  }, [banner.id, banner.mediaType, banner.videoSource, banner.videoUrl, banner.mobileVideoUrl, activeRawVideoUrl, isYouTube, activeYouTubeId, directVideoSrc, banner.posterImageUrl, banner.mobilePosterImageUrl, banner.isActive, banner.placements]);

  // 3. Reset state & Increment Session Token on slide / source change
  const currentSlideKey = `${banner.id}-${directVideoSrc}-${activeYouTubeId}`;
  const prevSlideKeyRef = useRef(currentSlideKey);

  useEffect(() => {
    if (prevSlideKeyRef.current !== currentSlideKey) {
      prevSlideKeyRef.current = currentSlideKey;
      sessionRef.current += 1;
      userPausedRef.current = false;
      setIsUserPaused(false);
      setIsPlaying(true);
      setVideoReady(false);
      setVideoError(false);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  }, [currentSlideKey]);

  // 4. Safe Playback Helper (Handles Autoplay & User Gesture)
  const attemptPlay = useCallback(async (isUserInitiated = false) => {
    const videoEl = videoRef.current;
    if (!videoEl || !isMountedRef.current || videoError) return;

    // Respect user's explicit pause choice
    if (!isUserInitiated && userPausedRef.current) {
      return;
    }

    const currentSession = sessionRef.current;

    // Enforce strict muted and inline playback parameters for 100% browser policy compliance
    videoEl.muted = true;
    videoEl.defaultMuted = true;
    videoEl.playsInline = true;

    try {
      if (videoEl.paused) {
        const promise = videoEl.play();
        if (promise !== undefined) {
          playPromiseRef.current = promise;
          await promise;
        }
      }
      if (sessionRef.current === currentSession && isMountedRef.current) {
        if (!userPausedRef.current || isUserInitiated) {
          setIsPlaying(true);
          setVideoReady(true);
          setVideoError(false);
        }
      }
    } catch (err: any) {
      if (sessionRef.current !== currentSession || !isMountedRef.current) return;
      if (err?.name === 'AbortError') {
        // Interrupted by normal DOM lifecycle or user action
        return;
      }
      if (err?.name === 'NotAllowedError') {
        // Browser policy restricted unprompted playback (e.g. mobile battery saver mode)
        // Show poster and keep play button available for 1-tap user activation
        if (process.env.NODE_ENV === 'development') {
          console.debug?.('[Hero Banner] Autoplay restricted by browser policy; ready for user activation.');
        }
        setIsPlaying(false);
        return;
      }
      if (process.env.NODE_ENV === 'development') {
        console.debug?.('[Hero Banner] Playback attempt notice:', err?.message || err);
      }
    } finally {
      if (sessionRef.current === currentSession) {
        playPromiseRef.current = null;
      }
    }
  }, [videoError]);

  // 5. Direct HTML5 Video Initialization & Immediate Autoplay Attempt
  useEffect(() => {
    if (isYouTube || !directVideoSrc || shouldReduceMotion || videoError) return;

    const videoEl = videoRef.current;
    if (!videoEl) return;

    videoEl.muted = true;
    videoEl.defaultMuted = true;
    videoEl.playsInline = true;

    if (!userPausedRef.current) {
      // Attempt autoplay immediately
      attemptPlay(false);
    }
  }, [isYouTube, directVideoSrc, shouldReduceMotion, videoError, attemptPlay]);

  // 6. Clean teardown on unmount or slide change
  useEffect(() => {
    const videoEl = videoRef.current;
    return () => {
      if (videoEl) {
        if (playPromiseRef.current) {
          playPromiseRef.current
            .then(() => {
              try {
                videoEl.pause();
              } catch {}
            })
            .catch(() => {});
        } else {
          try {
            videoEl.pause();
          } catch {}
        }
      }
    };
  }, [banner.id, directVideoSrc]);

  const handleVideoReady = useCallback(() => {
    if (isMountedRef.current) {
      setVideoReady(true);
      setVideoError(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (!userPausedRef.current) {
        attemptPlay(false);
      }
    }
  }, [attemptPlay]);

  const handleVideoError = useCallback((e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const el = e.currentTarget;
    if (isMountedRef.current) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Hero Storefront Video Error]', {
          bannerId: banner.id,
          videoUrl: directVideoSrc,
          mediaErrorCode: el?.error?.code,
          mediaErrorMessage: el?.error?.message,
          networkState: el?.networkState,
          readyState: el?.readyState
        });
      }
      setVideoError(true);
    }
  }, [banner.id, directVideoSrc]);

  // 7. User Play/Pause Toggle Handler
  const togglePlayPause = useCallback(() => {
    if (isYouTube) {
      const nextPlaying = !isPlaying;
      setIsPlaying(nextPlaying);
      try {
        const command = nextPlaying
          ? '{"event":"command","func":"playVideo","args":""}'
          : '{"event":"command","func":"pauseVideo","args":""}';
        iframeRef.current?.contentWindow?.postMessage(command, '*');
      } catch {
        // Silently ignore cross-origin notification notices
      }
      return;
    }

    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (isPlaying) {
      // User is pausing the video
      userPausedRef.current = true;
      setIsUserPaused(true);
      setIsPlaying(false);
      try {
        videoEl.pause();
      } catch {}
    } else {
      // User is starting / resuming the video
      userPausedRef.current = false;
      setIsUserPaused(false);
      setIsPlaying(true);
      attemptPlay(true);
    }
  }, [isPlaying, isYouTube, attemptPlay]);

  const hasPoster = Boolean(baseDesktopPoster || baseMobilePoster);
  const canAttemptDirectVideo = !isYouTube && Boolean(directVideoSrc) && !videoError && !shouldReduceMotion;
  const canAttemptYouTube = isYouTube && Boolean(activeYouTubeId) && !videoError && !shouldReduceMotion;

  const youtubeEmbedUrl = canAttemptYouTube && activeYouTubeId
    ? buildYouTubeEmbedUrl(activeYouTubeId, {
        autoplay: true,
        muted: true,
        loop: true,
        controls: false,
        playsinline: true
      })
    : '';

  const showPlayPauseControl = (canAttemptDirectVideo || canAttemptYouTube) && !videoError;

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-[var(--surface-elevated)] transition-colors duration-200">
      {/* 1. Base Poster Image Layer (Authoritative, Instant visual render, zero layout shift) */}
      {hasPoster && (
        <picture className="w-full h-full flex items-center justify-center">
          {baseMobilePoster && baseMobilePoster !== baseDesktopPoster && (
            <source media="(max-width: 640px)" srcSet={baseMobilePoster} />
          )}
          <img
            src={getValidImageSrc(activePoster)}
            alt={banner.title || 'عرض ترويجي'}
            loading="eager"
            decoding="async"
            // @ts-ignore
            fetchPriority="high"
            className={`w-full h-full ${
              imageSizeMode === 'cover'
                ? 'object-cover object-center'
                : 'object-contain object-center'
            } transition-transform duration-700 ease-out group-hover:scale-[1.01]`}
          />
        </picture>
      )}

      {/* 2A. Direct HTML5 Video Layer (.mp4 / .webm) — Native Autoplay with Smooth Fade-In */}
      {canAttemptDirectVideo && (
        <video
          ref={(el) => {
            // @ts-ignore
            videoRef.current = el;
            if (el) {
              el.muted = true;
              el.defaultMuted = true;
              el.playsInline = true;
            }
          }}
          key={`video-${banner.id}-${directVideoSrc}`}
          src={getValidImageSrc(directVideoSrc)}
          poster={activePoster || undefined}
          autoPlay
          muted
          loop
          playsInline
          controls={false}
          disablePictureInPicture
          preload="auto"
          aria-hidden="true"
          tabIndex={-1}
          onLoadedMetadata={handleVideoReady}
          onLoadedData={handleVideoReady}
          onCanPlay={handleVideoReady}
          onCanPlayThrough={handleVideoReady}
          onPlay={() => {
            if (isMountedRef.current) {
              setIsPlaying(true);
              setVideoReady(true);
            }
          }}
          onPlaying={() => {
            if (isMountedRef.current) {
              setIsPlaying(true);
              setVideoReady(true);
            }
          }}
          onPause={() => {
            if (isMountedRef.current && userPausedRef.current) {
              setIsPlaying(false);
            }
          }}
          onTimeUpdate={() => {
            if (!videoReady) handleVideoReady();
          }}
          onError={handleVideoError}
          className={`absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-700 ease-out ${
            imageSizeMode === 'cover'
              ? 'object-cover object-center'
              : 'object-contain object-center'
          } ${videoReady && !videoError ? 'opacity-100' : 'opacity-0'}`}
        />
      )}

      {/* 2B. Official YouTube Embedded Player Layer (Muted, Autoplay, Looping, Inline) */}
      {canAttemptYouTube && youtubeEmbedUrl && (
        <div
          className={`absolute inset-0 w-full h-full pointer-events-none flex items-center justify-center overflow-hidden transition-opacity duration-700 ease-out ${
            videoReady && !videoError ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <iframe
            ref={iframeRef}
            key={`yt-${banner.id}-${activeYouTubeId}`}
            src={getValidImageSrc(youtubeEmbedUrl)}
            title={banner.title || 'فيديو الإعلان'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen={false}
            tabIndex={-1}
            aria-hidden="true"
            onLoad={handleVideoReady}
            onError={() => {
              if (isMountedRef.current) {
                if (process.env.NODE_ENV === 'development') {
                  console.debug?.('[Hero Banner] YouTube embed failed to load:', activeYouTubeId);
                }
                setVideoError(true);
              }
            }}
            className={`pointer-events-none border-0 w-full h-full ${
              imageSizeMode === 'cover'
                ? 'w-[140%] h-[140%] min-w-[140%] min-h-[140%] scale-[1.05] object-cover'
                : 'w-full h-full object-contain'
            }`}
          />
        </div>
      )}

      {/* 3. Dedicated Play/Pause Floating Control (Dark Navy, Gold Accent, Glassmorphism) */}
      {showPlayPauseControl && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            togglePlayPause();
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              togglePlayPause();
            }
          }}
          aria-label={isPlaying ? 'إيقاف الفيديو' : 'تشغيل الفيديو'}
          title={isPlaying ? 'إيقاف الفيديو' : 'تشغيل الفيديو'}
          className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 z-30 pointer-events-auto w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#070C15]/75 hover:bg-[#070C15]/95 text-white hover:text-[#D4AF37] border border-white/20 hover:border-[#D4AF37]/60 backdrop-blur-md shadow-lg shadow-black/50 flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 sm:w-4.5 sm:h-4.5 fill-current text-white/90 transition-colors" />
          ) : (
            <Play className="w-4 h-4 sm:w-4.5 sm:h-4.5 fill-current text-[#D4AF37] translate-x-[-0.5px] transition-colors" />
          )}
        </button>
      )}
    </div>
  );
}


