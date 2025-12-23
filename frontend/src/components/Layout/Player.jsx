import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Volume2, VolumeX, Download, Heart, List, ChevronUp, ChevronDown, Trash2, X, WifiOff } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { useAuth } from '../../context/AuthContext';
import { recordSongDownload } from '../../lib/statsHelper';
import { Slider } from '../ui/slider';
import { Button } from '../ui/button';
import { toast } from '../../hooks/use-toast';
import { formatDuration } from '../../mock';
import { useMusicFavorite } from '../../hooks/use-music-favorite';
import { supabase } from '../../lib/supabaseClient';
import DesktopPlayerModal from './DesktopPlayerModal';
import MobilePlayerSheet from '../MobilePlayerSheet';

const CreatePlaylistIcon = () => (
    <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
        <path fill="none" d="M0 0h24v24H0z"></path>
        <path d="M14 10H3v2h11v-2zm0-4H3v2h11V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM3 16h7v-2H3v2z"></path>
    </svg>
);

const Player = () => {
    const navigate = useNavigate();
    const {
        currentSong,
        isPlaying,
        currentTime,
        duration,
        volume,
        isShuffle,
        repeatMode,
        togglePlay,
        handleNext,
        handlePrevious,
        seekTo,
        setVolume,
        toggleShuffle,
        toggleRepeat,
        queue,
        clearQueue,
        playSong,
        setIsCompactMode
    } = usePlayer();

    const { isPremium, user } = useAuth();
    const [showQueue, setShowQueue] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [isCompact, setIsCompact] = useState(false);
    const [createPlaylistOpen, setCreatePlaylistOpen] = useState(false);
    const [desktopPlayerOpen, setDesktopPlayerOpen] = useState(false);
    const [mobilePlayerOpen, setMobilePlayerOpen] = useState(false);
    const [isClosingPlayer, setIsClosingPlayer] = useState(false);
    const userClosedPlayerRef = useRef(false);
    const [playlistData, setPlaylistData] = useState({
        title: '',
        description: '',
        isPublic: false,
        cover: null
    });

    // Ref para a fila de reprodução (para auto-scroll)
    const queueContainerRef = useRef(null);
    const currentSongRef = useRef(null);

    // Use music favorite hook (must be called before early return)
    const { isFavorite, toggleFavorite, loading: favoriteLoading } = useMusicFavorite(currentSong?.id || null);

    // Auto-scroll da fila para a música atual
    useEffect(() => {
        if (showQueue && currentSongRef.current && queueContainerRef.current) {
            const container = queueContainerRef.current;
            const element = currentSongRef.current;
            
            // Calcular posição para centralizar o elemento
            const containerWidth = container.offsetWidth;
            const elementLeft = element.offsetLeft;
            const elementWidth = element.offsetWidth;
            const scrollPosition = elementLeft - (containerWidth / 2) + (elementWidth / 2);
            
            container.scrollTo({
                left: Math.max(0, scrollPosition),
                behavior: 'smooth'
            });
        }
    }, [showQueue, currentSong?.id]);

    // Função para obter URL do álbum
    const getAlbumUrl = (song) => {
        if (!song) return '#';
        const artistSlug = song.artistSlug || song.artist_slug || song.artistId || song.artist_id;
        const albumSlug = song.albumSlug || song.album_slug || song.albumId || song.album_id;
        if (artistSlug && albumSlug) {
            return `/${artistSlug}/${albumSlug}`;
        }
        return '#';
    };

    // Função para obter URL do artista
    const getArtistUrl = (song) => {
        if (!song) return '#';
        const artistSlug = song.artistSlug || song.artist_slug || song.artistId || song.artist_id;
        if (artistSlug) {
            return `/${artistSlug}`;
        }
        return '#';
    };

    // Abrir player mobile fullscreen ao clicar em play (apenas mobile)
    useEffect(() => {
        if (!currentSong) return;
        
        // Apenas abrir automaticamente em mobile, quando houver mudança de música
        if (isPlaying && window.innerWidth < 768 && !userClosedPlayerRef.current && !isClosingPlayer) {
            // Usar setTimeout para evitar setState síncrono no useEffect
            const timeout = setTimeout(() => {
                setMobilePlayerOpen(true);
                userClosedPlayerRef.current = false;
            }, 0);
            return () => clearTimeout(timeout);
        }
        
        // Ouvir evento customizado para forçar abrir
        const handler = () => {
            if (!isClosingPlayer) {
                setMobilePlayerOpen(true);
                userClosedPlayerRef.current = false;
            }
        };
        window.addEventListener('openMobilePlayer', handler);
        return () => window.removeEventListener('openMobilePlayer', handler);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentSong?.id, isClosingPlayer]);

    if (!currentSong) return null;

    const cleanTitle = (title) => {
        return title?.replace(/\.mp3$/i, '') || '';
    };

    const handleVolumeChange = (value) => {
        setVolume(value[0]);
        setIsMuted(value[0] === 0);
    };

    const toggleMute = () => {
        if (isMuted) {
            setVolume(0.7);
            setIsMuted(false);
        } else {
            setVolume(0);
            setIsMuted(true);
        }
    };

    const handleCreatePlaylist = () => {
        if (!user) {
            toast({
                title: 'Login Necessário',
                description: 'Faça login para criar uma playlist',
                variant: 'destructive'
            });
            return;
        }
        setCreatePlaylistOpen(true);
    };

    const handleDownload = async () => {
        if (!currentSong?.audioUrl) {
            toast({
                title: 'Download Indisponível',
                description: 'Arquivo não disponível',
                variant: 'destructive'
            });
            return;
        }

        toast({
            title: 'Download Iniciado',
            description: `Baixando ${currentSong.title}...`
        });

        try {
            // Registrar download da música
            if (currentSong.id) {
                const albumId = currentSong.albumId || currentSong.album_id || currentSong.albumid;
                recordSongDownload(currentSong.id, albumId);
            }

            const response = await fetch(currentSong.audioUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${currentSong.title}.mp3`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download error:', error);
            toast({
                title: 'Erro no Download',
                description: 'Não foi possível baixar o arquivo',
                variant: 'destructive'
            });
        }
    };

    const handleFavorite = async () => {
        if (!user) {
            toast({
                title: 'Login Necessário',
                description: 'Faça login para adicionar aos favoritos',
                variant: 'destructive'
            });
            return;
        }

        try {
            await toggleFavorite();
            toast({
                title: isFavorite ? 'Removido dos favoritos' : 'Adicionado aos favoritos',
                description: currentSong.title
            });
        } catch (error) {
            toast({
                title: 'Erro',
                description: 'Erro ao atualizar favoritos',
                variant: 'destructive'
            });
        }
    };

    const handleClearQueue = () => {
        clearQueue();
        setShowQueue(false);
        toast({
            title: 'Fila limpa',
            description: 'Todas as músicas foram removidas da fila'
        });
    };

    const handlePlayFromQueue = (song) => {
        playSong(song, queue);
    };

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    // Versão compactada
    if (isCompact) {
        return (
            <div className="fixed bottom-4 right-4 z-50 bg-zinc-900 rounded-lg shadow-2xl p-3 w-64">
                <button
                    onClick={() => {
                        setIsCompact(false);
                        setIsCompactMode(false);
                    }}
                    className="absolute -top-6 right-2 bg-red-600 px-2 py-1 rounded-t hover:bg-red-700 transition"
                    title="Expandir player"
                >
                    <ChevronUp className="w-4 h-4 text-white" />
                </button>
                <div className="flex items-center gap-3">
                    <img
                        src={imageError ? '/images/default-album.png' : currentSong.coverImage}
                        alt={currentSong.title}
                        className="w-12 h-12 rounded object-cover"
                        onError={() => setImageError(true)}
                    />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <p className="text-white font-bold text-xs truncate">{cleanTitle(currentSong.title)}</p>
                            {currentSong?.isOffline && (
                                <div className="flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/20 text-amber-200 rounded text-xs font-medium whitespace-nowrap">
                                    <WifiOff className="w-2.5 h-2.5" />
                                    <span>Offline</span>
                                </div>
                            )}
                        </div>
                        <p className="text-white/70 text-xs truncate">{currentSong.artistName}</p>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={togglePlay}
                            className="text-white hover:bg-red-600 h-7 w-7"
                        >
                            {isPlaying ? <Pause className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4" fill="currentColor" />}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleNext}
                            className="text-white hover:bg-red-600 h-7 w-7"
                        >
                            <SkipForward className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Desktop Player Modal */}
            <DesktopPlayerModal isOpen={desktopPlayerOpen} onClose={() => setDesktopPlayerOpen(false)} />


            {/* Mobile Player Sheet - Fullscreen Overlay (Mobile Only) */}
            {mobilePlayerOpen && currentSong && (
                <div className="md:hidden">
                    <MobilePlayerSheet
                        album={{ artistName: currentSong.artistName || currentSong.artist_name }}
                        currentSong={currentSong}
                        albumSongs={queue}
                        isFavorite={isFavorite}
                        onFavorite={handleFavorite}
                        onSongSelect={handlePlayFromQueue}
                        formatDuration={formatDuration}
                        onClose={() => {
                            setIsClosingPlayer(true);
                            userClosedPlayerRef.current = true;
                            setMobilePlayerOpen(false);
                            // Restaurar após transição
                            setTimeout(() => setIsClosingPlayer(false), 300);
                        }}
                        isPlaying={isPlaying}
                        onPlay={togglePlay}
                        onPause={togglePlay}
                    />
                </div>
            )}

            {/* Desktop Mini Player (visible only on desktop) */}
            <div
                className={`hidden md:flex flex-col fixed bottom-0 left-0 right-0 z-50 shadow-2xl transition-all animate-in slide-in-from-bottom duration-300`}
            >
                {/* Minimize Button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsCompact(true);
                        setIsCompactMode(true);
                    }}
                    className="absolute right-24 -top-6 z-50 bg-zinc-900 border-t border-l border-r border-white/20 px-2 py-1 rounded-t hover:bg-zinc-800 transition"
                    title="Compactar player"
                >
                    <ChevronDown className="w-4 h-4 text-white" />
                </button>

                {/* Main Player */}
                <div className="bg-gradient-to-r from-red-600 to-red-700 border-t border-white/20 px-4 py-2 w-full">
                    <div className="max-w-screen-2xl mx-auto">
                        <div className="flex items-center justify-between gap-4">
                            {/* Song Info */}
                            <div className="flex items-center gap-3 w-72">
                                <Link 
                                    to={getAlbumUrl(currentSong)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="relative group flex-shrink-0"
                                >
                                    <img
                                        src={imageError ? '/images/default-album.png' : currentSong.coverImage}
                                        alt={currentSong.title}
                                        className="w-11 h-11 rounded object-cover shadow-lg group-hover:shadow-xl transition-all group-hover:brightness-90"
                                        onError={() => setImageError(true)}
                                    />
                                </Link>
                                <div className="flex-1 min-w-0">
                                    <Link 
                                        to={getAlbumUrl(currentSong)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="block"
                                    >
                                        <p className="text-white font-bold text-sm truncate hover:text-white/70 transition-colors">{cleanTitle(currentSong.title)}</p>
                                    </Link>
                                    <Link 
                                        to={getArtistUrl(currentSong)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="block"
                                    >
                                        <p className="text-white/80 text-xs truncate hover:text-white/60 transition-colors">{currentSong.artistName}</p>
                                    </Link>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleFavorite();
                                    }}
                                    className="hover:bg-white/20 h-8 w-8"
                                >
                                    <Heart
                                        className={`w-4 h-4 ${isFavorite ? 'fill-white text-white' : 'text-white'
                                            }`}
                                    />
                                </Button>
                            </div>

                            {/* Player Controls */}
                            <div className="flex-1 max-w-2xl">
                                <div className="flex items-center justify-center gap-3 mb-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleShuffle();
                                        }}
                                        className={`hover:bg-white/20 h-8 w-8 ${isShuffle ? 'text-white' : 'text-white/60'
                                            }`}
                                    >
                                        <Shuffle className="w-3.5 h-3.5" />
                                    </Button>

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handlePrevious();
                                        }}
                                        className="text-white hover:bg-white/20 h-8 w-8"
                                    >
                                        <SkipBack className="w-4 h-4" />
                                    </Button>

                                    <Button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            togglePlay();
                                        }}
                                        className="w-10 h-10 rounded-full bg-white hover:bg-gray-100 text-red-600 shadow-lg"
                                    >
                                        {isPlaying ? <Pause className="w-5 h-5" fill="currentColor" /> : <Play className="w-5 h-5 ml-0.5" fill="currentColor" />}
                                    </Button>

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleNext();
                                        }}
                                        className="text-white hover:bg-white/20 h-8 w-8"
                                    >
                                        <SkipForward className="w-4 h-4" />
                                    </Button>

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleRepeat();
                                        }}
                                        className={`hover:bg-white/20 h-8 w-8 ${repeatMode !== 'off' ? 'text-white' : 'text-white/60'
                                            }`}
                                    >
                                        <Repeat className="w-3.5 h-3.5" />
                                        {repeatMode === 'one' && (
                                            <span className="absolute text-xs font-bold">1</span>
                                        )}
                                    </Button>
                                </div>

                                {/* Progress Bar */}
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-white font-medium w-10 text-right">
                                        {formatDuration(Math.floor(currentTime))}
                                    </span>
                                    <Slider
                                        value={[currentTime]}
                                        max={duration || 100}
                                        step={0.1}
                                        onValueChange={(value) => {
                                            seekTo(value[0]);
                                        }}
                                        className="flex-1"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    <span className="text-xs text-white font-medium w-10">
                                        {formatDuration(Math.floor(duration))}
                                    </span>
                                </div>
                            </div>

                            {/* Additional Controls */}
                            <div className="flex items-center gap-2 justify-end flex-shrink-0">
                                <Button
                                    variant="ghost"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDownload();
                                    }}
                                    className="text-white hover:bg-white/20 border border-white/30 px-3 h-8 text-xs"
                                >
                                    <Download className="w-3.5 h-3.5 mr-1.5" />
                                    BAIXAR
                                </Button>

                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleCreatePlaylist();
                                    }}
                                    className="text-white hover:bg-white/20 h-8 w-8"
                                    title="Criar playlist"
                                >
                                    <CreatePlaylistIcon />
                                </Button>

                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowQueue(!showQueue);
                                    }}
                                    className={`text-white hover:bg-white/20 h-8 w-8 ${showQueue ? 'bg-white/20' : ''}`}
                                >
                                    <List className="w-4 h-4" />
                                </Button>

                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleMute();
                                    }}
                                    className="text-white hover:bg-white/20 h-8 w-8"
                                >
                                    {isMuted || volume === 0 ? (
                                        <VolumeX className="w-4 h-4" />
                                    ) : (
                                        <Volume2 className="w-4 h-4" />
                                    )}
                                </Button>

                                <Slider
                                    value={[volume]}
                                    max={1}
                                    step={0.01}
                                    onValueChange={handleVolumeChange}
                                    className="w-20"
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Queue Panel - Below Player */}
                {showQueue && (
                    <div className="w-full bg-zinc-900 border-t border-zinc-800">
                        <div className="max-w-full mx-auto">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                                <div>
                                    <h3 className="text-white font-semibold text-base">Fila de Reprodução</h3>
                                    <p className="text-gray-400 text-xs mt-1">{queue.length} músicas</p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleClearQueue();
                                    }}
                                    className="text-gray-400 hover:text-white hover:bg-zinc-800 h-8 px-3"
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Limpar fila
                                </Button>
                            </div>
                            <div 
                                ref={queueContainerRef}
                                className="overflow-x-auto overflow-y-hidden px-4 py-3 scroll-smooth"
                                style={{ scrollbarWidth: 'thin', scrollbarColor: '#ef4444 #27272a' }}
                            >
                                <div className="flex gap-3">
                                    {queue.map((song, index) => (
                                        <div
                                            key={song.id}
                                            ref={currentSong?.id === song.id ? currentSongRef : null}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handlePlayFromQueue(song);
                                            }}
                                            className={`flex-shrink-0 flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all min-w-[220px] ${currentSong?.id === song.id
                                                ? 'bg-red-600/30 ring-2 ring-red-500'
                                                : 'hover:bg-zinc-800'
                                                }`}
                                        >
                                            <div className="relative">
                                                <img
                                                    src={song.coverImage || '/images/default-album.png'}
                                                    alt={song.title}
                                                    className="w-14 h-14 object-cover rounded"
                                                    onError={(e) => e.target.src = '/images/default-album.png'}
                                                />
                                                {currentSong?.id === song.id && isPlaying && (
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded">
                                                        <div className="flex items-end gap-0.5 h-4">
                                                            <span className="w-1 bg-white rounded-full animate-music-bar-1"></span>
                                                            <span className="w-1 bg-white rounded-full animate-music-bar-2"></span>
                                                            <span className="w-1 bg-white rounded-full animate-music-bar-3"></span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-medium truncate ${currentSong?.id === song.id ? 'text-red-400' : 'text-white'}`}>
                                                    {cleanTitle(song.title)}
                                                </p>
                                                <p className="text-gray-400 text-xs truncate">{song.artistName}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Mobile Player (mini bar) - só aparece se não estiver com o overlay aberto */}
            {!mobilePlayerOpen && (
                <div className={`md:hidden fixed bottom-0 left-0 right-0 z-50 shadow-2xl transition-all animate-in slide-in-from-bottom duration-300 cursor-pointer ${showQueue ? 'h-auto' : ''}`}>
                    {/* Expand Button - Positioned above the player */}
                    <button
                        onClick={() => setMobilePlayerOpen(true)}
                        className="absolute right-4 -top-6 z-50 bg-zinc-900 border-t border-l border-r border-white/20 px-2 py-1 rounded-t hover:bg-zinc-800 transition"
                        title="Expandir player"
                    >
                        <ChevronUp className="w-4 h-4 text-white" />
                    </button>

                    {/* Main Player */}
                    <div className="bg-gradient-to-r from-red-600 to-red-700 border-t border-white/20 px-4 py-3">
                        <div className="max-w-screen-2xl mx-auto">
                            <div className="flex items-center justify-between gap-4">
                                {/* Player Controls */}
                                <div className="flex-1 max-w-2xl">
                                    <div className="flex items-center justify-center gap-3 mb-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={toggleShuffle}
                                            className={`hover:bg-white/20 h-8 w-8 ${isShuffle ? 'text-white' : 'text-white/60'}`}
                                        >
                                            <Shuffle className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={handlePrevious}
                                            className="text-white hover:bg-white/20 h-8 w-8"
                                        >
                                            <SkipBack className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            onClick={togglePlay}
                                            className="w-10 h-10 rounded-full bg-white hover:bg-gray-100 text-red-600 shadow-lg"
                                        >
                                            {isPlaying ? <Pause className="w-5 h-5" fill="currentColor" /> : <Play className="w-5 h-5 ml-0.5" fill="currentColor" />}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={handleNext}
                                            className="text-white hover:bg-white/20 h-8 w-8"
                                        >
                                            <SkipForward className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={toggleRepeat}
                                            className={`hover:bg-white/20 h-8 w-8 ${repeatMode !== 'off' ? 'text-white' : 'text-white/60'}`}
                                        >
                                            <Repeat className="w-3.5 h-3.5" />
                                            {repeatMode === 'one' && (
                                                <span className="absolute text-xs font-bold">1</span>
                                            )}
                                        </Button>
                                    </div>
                                    {/* Progress Bar */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-white font-medium w-10 text-right">
                                            {formatDuration(Math.floor(currentTime))}
                                        </span>
                                        <Slider
                                            value={[currentTime]}
                                            max={duration || 100}
                                            step={0.1}
                                            onValueChange={(value) => seekTo(value[0])}
                                            className="flex-1"
                                        />
                                        <span className="text-xs text-white font-medium w-10">
                                            {formatDuration(Math.floor(duration))}
                                        </span>
                                    </div>
                                </div>
                                {/* Additional Controls - Mobile Only */}
                                <div className="flex items-center gap-1 justify-end flex-shrink-0">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleDownload}
                                        className="text-white hover:bg-white/20 h-8 w-8"
                                        title="Baixar"
                                    >
                                        <Download className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleCreatePlaylist}
                                        className="text-white hover:bg-white/20 h-8 w-8"
                                        title="Adicionar a playlist"
                                    >
                                        <CreatePlaylistIcon />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => clearQueue()}
                                        className="text-white hover:bg-white/20 h-8 w-8"
                                        title="Fechar player"
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Player;
