import React, { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { usePWAMode } from '../hooks/usePWAMode';
import { Play, Disc, Disc3, TrendingUp, ChevronLeft, ChevronRight, User, BadgeCheck, Plus, Music, ThumbsUp, Video } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { toast } from '../hooks/use-toast';
import HeroSlider from '../components/HeroSlider';
import HomePopup from '../components/HomePopup';
import LoadingSpinner from '../components/LoadingSpinner';

const HomeImproved = () => {
    const { playSong } = usePlayer();
    const { user } = useAuth();
    const { isOnline } = usePWAMode();
    const lancamentosRef = useRef(null);
    const topCdsRef = useRef(null);
    const generosRef = useRef(null);
    const clipsRef = useRef(null);
    const [topCdsFilter, setTopCdsFilter] = useState('mes');
    const [allAlbums, setAllAlbums] = useState([]);
    const [allArtists, setAllArtists] = useState([]);
    const [topCdsAlbums, setTopCdsAlbums] = useState([]);
    const [followingArtists, setFollowingArtists] = useState(new Set());
    const [recommendedAlbums, setRecommendedAlbums] = useState([]);
    const [clips, setClips] = useState([]);
    const [selectedClipIndex, setSelectedClipIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [isOfflineMode, setIsOfflineMode] = useState(!isOnline);

    const genres = [
        { name: 'Forró', slug: 'forro', imageUrl: '/images/slides/GENEROS/forró.jpg' },
        { name: 'Arrocha', slug: 'arrocha', imageUrl: '/images/slides/GENEROS/ARROCHA.jpg' },
        { name: 'Piseiro', slug: 'piseiro', imageUrl: '/images/slides/GENEROS/PISEIRO.jpg' },
        { name: 'Arrochadeira', slug: 'arrochadeira', imageUrl: '/images/slides/GENEROS/ARROCHADEIRA.jpg' },
        { name: 'Pagode', slug: 'pagode', imageUrl: '/images/slides/GENEROS/PAGODE.jpg' },
        { name: 'Sertanejo', slug: 'sertanejo', imageUrl: '/images/slides/GENEROS/SERTANEJO.jpg' },
        { name: 'Brega Funk', slug: 'brega-funk', imageUrl: '/images/slides/GENEROS/BREGAFUNK.jpg' },
        { name: 'Variados', slug: 'variados', imageUrl: '/images/slides/GENEROS/POP.jpg' },
        { name: 'Samba', slug: 'samba', imageUrl: '/images/slides/GENEROS/SAMBA.jpg' },
        { name: 'Funk', slug: 'funk', imageUrl: '/images/slides/GENEROS/FUNK.jpg' },
        { name: 'Axé', slug: 'axe', imageUrl: '/images/slides/GENEROS/AXÉ.jpg' },
        { name: 'Reggae', slug: 'reggae', imageUrl: '/images/slides/GENEROS/REGGAE.jpg' },
        { name: 'Brega', slug: 'brega', imageUrl: '/images/slides/GENEROS/BREGA.jpg' },
        { name: 'Gospel', slug: 'gospel', imageUrl: '/images/slides/GENEROS/GOSPEL.jpg' },
        { name: 'Rap/Hip-Hop', slug: 'rap-hip-hop', imageUrl: '/images/slides/GENEROS/HIP-HOP.jpg' },
        { name: 'Pop', slug: 'pop', imageUrl: '/images/slides/GENEROS/POP.jpg' },
        { name: 'MPB', slug: 'mpb', imageUrl: '/images/slides/GENEROS/MPB.jpg' },
        { name: 'Rock', slug: 'rock', imageUrl: '/images/slides/GENEROS/ROCK.jpg' },
        { name: 'Eletrônica', slug: 'eletronica', imageUrl: '/images/slides/GENEROS/ELETRÔNICA.jpg' },
        { name: 'Trap', slug: 'trap', imageUrl: '/images/slides/GENEROS/TRAP.jpg' },
        { name: 'Frevo', slug: 'frevo', imageUrl: '/images/slides/GENEROS/FREVO.jpg' },
    ];

    const formatNumber = (num) => {
        if (!num) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    };

    const extractYoutubeId = (url) => {
        if (!url) return '';
        // Extrair ID de diferentes formatos de URL do YouTube
        const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
        return match ? match[1] : '';
    };

    const loadData = async () => {
        try {
                // Não bloqueia loading para toda página - permite slider renderizar
                setLoadError(null);

                // Se offline, não tenta buscar dados online
                if (!isOnline) {
                    console.log('Modo offline ativado');
                    setIsOfflineMode(true);
                    setIsLoading(false);
                    return;
                }

                setIsOfflineMode(false);

                // Paralelizar as queries principais sem timeout
                const [albumsResult, artistsResult, collabResult, clipsResult] = await Promise.all([
                    // Query 1: Álbuns com limite - ordenado por data de lançamento (release_date)
                    supabase
                        .from('albums')
                        .select(`
                *,
                artist:artists(id, name, slug, is_verified)
                `)
                        .eq('is_private', false)
                        .is('deleted_at', null)
                        .order('release_date', { ascending: false, nullsFirst: false })
                        .limit(50),
                    
                    // Query 2: Artistas
                    supabase
                        .from('artists')
                        .select('*')
                        .order('followers_count', { ascending: false })
                        .limit(20),
                    
                    // Query 3: Colaborações
                    supabase
                        .from('collaboration_invites')
                        .select('album_id, invited_user_id')
                        .eq('status', 'accepted'),
                    
                    // Query 4: Vídeos/Clips
                    supabase
                        .from('artist_videos')
                        .select('*')
                        .order('created_at', { ascending: false })
                        .limit(12)
                ]);

                // Processar álbuns
                if (albumsResult.data && albumsResult.data.length > 0) {
                    const supabaseAlbums = albumsResult.data;
                    
                    // Mapear colaboradores
                    const collaboratorsByAlbum = {};
                    if (collabResult.data && collabResult.data.length > 0) {
                        const invitedUserIds = [...new Set(collabResult.data.map(c => c.invited_user_id))];
                        
                        const { data: collabArtists } = await supabase
                            .from('artists')
                            .select('id, name, slug, is_verified')
                            .in('id', invitedUserIds);

                        if (collabArtists) {
                            const artistsMap = {};
                            collabArtists.forEach(artist => {
                                artistsMap[artist.id] = artist;
                            });
                            collabResult.data.forEach(collab => {
                                if (artistsMap[collab.invited_user_id]) {
                                    if (!collaboratorsByAlbum[collab.album_id]) {
                                        collaboratorsByAlbum[collab.album_id] = [];
                                    }
                                    collaboratorsByAlbum[collab.album_id].push(artistsMap[collab.invited_user_id]);
                                }
                            });
                        }
                    }

                    const formattedAlbums = supabaseAlbums.map(album => ({
                        id: album.id,
                        slug: album.slug,
                        title: album.title,
                        artistName: album.artist?.name || album.artist_name,
                        artistId: album.artist_id,
                        artistSlug: album.artist?.slug || album.artist_id,
                        artistVerified: album.artist?.is_verified || false,
                        collaborators: collaboratorsByAlbum[album.id] || [],
                        coverImage: album.cover_url || '/images/default-album.png',
                        releaseYear: album.release_year,
                        playCount: album.play_count || 0,
                        downloadCount: album.download_count || 0
                    }));
                    
                    setAllAlbums(formattedAlbums);
                    
                    if (formattedAlbums.length > 0) {
                        const shuffled = [...formattedAlbums].sort(() => Math.random() - 0.5);
                        setRecommendedAlbums(shuffled.slice(0, 6));
                    }
                }

                // Processar artistas
                const supabaseArtists = artistsResult.data;

            if (supabaseArtists && supabaseArtists.length > 0) {
                // Ordenar artistas apenas por followers_count (evitar query de plays que falha com 400)
                const sortedArtists = supabaseArtists.sort((a, b) => {
                    return (b.followers_count || 0) - (a.followers_count || 0);
                });

                const formattedSupabaseArtists = sortedArtists.map(a => ({
                    id: a.id,
                    slug: a.slug,
                    name: a.name,
                    avatar: a.avatar_url || '/images/default-avatar.png',
                    coverImage: a.cover_url || '',
                    verified: a.is_verified,
                    bio: a.bio
                }));
                setAllArtists(formattedSupabaseArtists);

                // Carregar artistas que o usuário segue (com try-catch para evitar falhas)
                if (user?.id) {
                    try {
                        const { data: follows } = await supabase
                            .from('follows')
                            .select('artist_id')
                            .eq('follower_id', user.id);

                        if (follows) {
                            setFollowingArtists(new Set(follows.map(f => f.artist_id)));
                        }
                    } catch (followError) {
                        console.warn('Erro ao carregar artistas seguidos:', followError);
                        // Continuar sem dados de follows
                    }
                }
            }
            
            // Processar clips
            if (clipsResult.data && clipsResult.data.length > 0) {
                // Filtrar apenas vídeos públicos
                const publicClips = clipsResult.data.filter(v => v.is_public === true);
                
                if (publicClips.length > 0) {
                    // Buscar dados dos artistas
                    const artistIds = [...new Set(publicClips.map(v => v.artist_id))];
                    const { data: artistsData } = await supabase
                        .from('artists')
                        .select('id, name, slug, is_verified')
                        .in('id', artistIds);
                    
                    const artistsMap = {};
                    if (artistsData) {
                        artistsData.forEach(artist => {
                            artistsMap[artist.id] = artist;
                        });
                    }

                    const formattedClips = publicClips.map(video => {
                        const artist = artistsMap[video.artist_id] || {};
                        return {
                            id: video.id,
                            title: video.title,
                            videoUrl: video.video_url,
                            thumbnail: video.thumbnail || '/images/default-album.png',
                            artistName: artist.name || 'Artista Desconhecido',
                            artistSlug: artist.slug || video.artist_id,
                            artistVerified: artist.is_verified || false,
                            createdAt: video.created_at,
                            views: video.views_count || 0
                        };
                    });
                    setClips(formattedClips);
                } else {
                    setClips([]);
                }
            }
                
        } catch (error) {
            console.error('Erro ao carregar dados da home:', error);
            // Mostrar erro apenas se for timeout ou erro crítico
            if (error.message?.includes('Timeout')) {
                setLoadError('Carregamento lento - tentando novamente em breve');
            } else if (error.message?.includes('400')) {
                // Erro 400 geralmente é relacionado a RLS, não mostrar para o usuário
                console.warn('Erro de permissão ao carregar alguns dados');
            } else {
                setLoadError(error.message || 'Erro ao carregar alguns dados');
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();

        // Desabilitar subscription Realtime por enquanto para evitar loop infinito
        // TODO: Reimplementar com debounce se necessário
        // const subscription = supabase
        //     .channel('albums_channel')
        //     .on(
        //         'postgres_changes',
        //         { event: '*', schema: 'public', table: 'albums' },
        //         () => {
        //             // Recarregar dados quando houver qualquer mudança na tabela albums
        //             loadData();
        //         }
        //     )
        //     .subscribe();

        // return () => {
        //     subscription.unsubscribe();
        // };
    }, []);

    // Carregar TOP CDS quando período muda
    useEffect(() => {
        loadTopCds();
    }, [topCdsFilter, allAlbums]);

    const loadTopCds = async () => {
        try {
            if (allAlbums.length === 0) return;



            // Se o período for 'geral', retorna os álbuns ordenados por play_count
            if (topCdsFilter === 'geral') {
                const sorted = [...allAlbums]
                    .sort((a, b) => b.playCount - a.playCount);

                setTopCdsAlbums(sorted);
                return;
            }

            // Para DIA, SEMANA, MÊS, buscar plays e filtrar por data
            const now = new Date();
            let startDate;

            if (topCdsFilter === 'dia') {
                startDate = new Date(now);
                startDate.setHours(0, 0, 0, 0);
            } else if (topCdsFilter === 'semana') {
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            } else if (topCdsFilter === 'mes') {
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            }

            // Buscar plays do período
            const { data: plays, error: playsError } = await supabase
                .from('plays')
                .select('album_id')
                .gte('created_at', startDate.toISOString())
                .lte('created_at', now.toISOString());

            if (playsError) throw playsError;

            // Contar plays por álbum
            const playCountByAlbum = {};
            (plays || []).forEach(play => {
                playCountByAlbum[play.album_id] = (playCountByAlbum[play.album_id] || 0) + 1;
            });

            // Ordenar álbuns pelos plays do período
            const sortedAlbums = allAlbums
                .filter(album => playCountByAlbum[album.id] > 0) // Só mostra álbuns com plays neste período
                .map(album => ({
                    ...album,
                    period_play_count: playCountByAlbum[album.id] || 0
                }))
                .sort((a, b) => {
                    // Ordena APENAS por plays do período (sem desempate)
                    return b.period_play_count - a.period_play_count;
                });



            setTopCdsAlbums(sortedAlbums);
        } catch (error) {
            setTopCdsAlbums([]);
        }
    };

    const scrollSection = (ref, direction) => {
        if (ref.current) {
            const scrollAmount = direction === 'left' ? -800 : 800;
            ref.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    };

    const handleFollow = async (artistId, e) => {
        e.preventDefault();

        if (!user?.id) {
            toast({
                title: 'Erro',
                description: 'Faça login para seguir artistas',
                variant: 'destructive',
            });
            return;
        }

        try {
            const isFollowing = followingArtists.has(artistId);

            if (isFollowing) {
                // Deixar de seguir
                await supabase
                    .from('follows')
                    .delete()
                    .eq('follower_id', user.id)
                    .eq('artist_id', artistId);

                const newFollowing = new Set(followingArtists);
                newFollowing.delete(artistId);
                setFollowingArtists(newFollowing);

                toast({
                    title: 'Sucesso',
                    description: 'Deixou de seguir o artista',
                });
            } else {
                // Seguir
                await supabase
                    .from('follows')
                    .insert([
                        {
                            follower_id: user.id,
                            artist_id: artistId,
                        },
                    ]);

                const newFollowing = new Set(followingArtists);
                newFollowing.add(artistId);
                setFollowingArtists(newFollowing);

                toast({
                    title: 'Sucesso',
                    description: 'Agora você segue este artista',
                });
            }
        } catch (error) {
            toast({
                title: 'Erro',
                description: 'Ocorreu um erro ao seguir o artista',
                variant: 'destructive',
            });
        }
    };




    // Se está carregando, mostrar loader fullscreen
    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-white min-h-screen">
                <LoadingSpinner size="large" text={isOfflineMode ? "Modo Offline" : "Carregando..."} />
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto bg-white relative">
            {/* Content wrapper */}
            <div className="relative">
                {/* Home Popup */}
                <HomePopup />



                {/* Error Banner */}
                {loadError && !isOfflineMode && (
                    <div className="bg-red-50 border border-red-200 px-4 py-3 text-red-800">
                        <p>Erro ao carregar alguns dados: {loadError}</p>
                    </div>
                )}

                {/* Hero Slider */}
                <div className="max-w-7xl mx-auto px-4 py-8">
                    <HeroSlider />
                </div>

                {/* Box Adicionar Artista */}
                <div className="box-adicionar-artista dotted-border">
                    <div className="inner">
                        <div className="mensagem">Divulgue sua banda em nosso site <b>www.oucaaqui.com</b></div>
                        <a href="https://web.archive.org/web/20180329073822/http://jairzinhocds.com.br/contato/" className="btn-twomp">
                            <span className="icon-lapis-enviar"></span>Entre em contato
                        </a>
                    </div>
                </div>

                {/* Main Content */}
                <div className="max-w-7xl mx-auto px-4 py-12">

                {/* Retry Button */}
                {loadError && (
                    <div className="flex justify-center mb-8">
                        <Button
                            onClick={() => loadData()}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            Tentar Novamente
                        </Button>
                    </div>
                )}

                {/* Lançamentos Recentes */}
                {!isOfflineMode && (
                <section className="mb-16 hidden md:block">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <Disc3 className="w-8 h-8 text-red-600" />
                            <h2 className="text-3xl font-bold text-black">Lançamentos Recentes</h2>
                        </div>
                        <div className="flex items-center gap-3">
                            <Link to="/lancamentos" className="text-red-600 hover:text-red-500 font-bold text-sm">
                                VER TODOS
                            </Link>
                            <div className="flex gap-2">
                                <Button
                                    onClick={() => scrollSection(lancamentosRef, 'left')}
                                    size="icon"
                                    variant="outline"
                                    className="w-8 h-8 border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                                <Button
                                    onClick={() => scrollSection(lancamentosRef, 'right')}
                                    size="icon"
                                    variant="outline"
                                    className="w-8 h-8 border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                    <div
                        ref={lancamentosRef}
                        className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth"
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                        {allAlbums.length === 0 ? (
                            <p className="text-gray-500 py-8 w-full">Nenhum lançamento disponível no momento.</p>
                        ) : (
                            allAlbums.map((album) => (
                                <div
                                    key={album.id}
                                    className="flex-shrink-0"
                                    style={{ width: 'calc((100% - 80px) / 6)' }}
                                >
                                    <Link
                                        to={`/${album.artistSlug}/${album.slug || album.id}`}
                                        className="group cursor-pointer block"
                                    >
                                        <div className="relative mb-3 overflow-hidden rounded-lg shadow-lg">
                                            <img
                                                src={album.coverImage}
                                                alt={album.title}
                                                className="w-full aspect-square object-cover transform group-hover:scale-110 transition-transform duration-300"
                                            />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
                                                <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all duration-300">
                                                    <Play className="w-5 h-5 text-white ml-1" fill="white" />
                                                </div>
                                            </div>
                                        </div>
                                        <h3 className="text-black font-semibold text-sm mb-1 truncate group-hover:text-red-600 transition-colors">
                                            {album.title}
                                        </h3>
                                    </Link>
                                    <div className="flex items-center gap-1 text-gray-600 text-xs mb-2 flex-wrap">
                                        {/* Artista Principal */}
                                        <Link
                                            to={`/${album.artistSlug}`}
                                            className="flex items-center gap-0.5 hover:text-red-600 transition-colors"
                                        >
                                            <span>{album.artistName}</span>
                                            {album.artistVerified && (
                                                <BadgeCheck className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                                            )}
                                        </Link>

                                        {/* Colaboradores */}
                                        {album.collaborators && album.collaborators.length > 0 && (
                                            <>
                                                <span>&</span>
                                                {album.collaborators.map((collab, idx) => (
                                                    <Link
                                                        key={collab.id}
                                                        to={`/${collab.slug}`}
                                                        className="flex items-center gap-0.5 hover:text-red-600 transition-colors"
                                                    >
                                                        <span>{collab.name}</span>
                                                        {collab.is_verified && (
                                                            <BadgeCheck className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                                                        )}
                                                    </Link>
                                                ))}
                                            </>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs">
                                        <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded">
                                            <span className="font-bold text-gray-700">{formatNumber(album.period_play_count || album.playCount)}</span>
                                            <span className="text-gray-500">Plays</span>
                                        </div>
                                        <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded">
                                            <span className="font-bold text-gray-700">{formatNumber(album.downloadCount)}</span>
                                            <span className="text-gray-500">Downloads</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>
                )}

                {/* TOP CDS */}
                {!isOfflineMode && (
                <section className="mb-16 hidden md:block">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <TrendingUp className="w-8 h-8 text-red-600" />
                            <h2 className="text-3xl font-bold text-black">TOP CDS</h2>
                            <div className="flex items-center gap-2 text-sm ml-4">
                                <button
                                    onClick={() => setTopCdsFilter('dia')}
                                    className={`font-bold pb-1 transition-colors ${topCdsFilter === 'dia' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-600 hover:text-red-600'
                                        }`}
                                >
                                    DIA
                                </button>
                                <span className="text-gray-400">/</span>
                                <button
                                    onClick={() => setTopCdsFilter('semana')}
                                    className={`font-medium transition-colors ${topCdsFilter === 'semana' ? 'text-red-600 border-b-2 border-red-600 pb-1' : 'text-gray-600 hover:text-red-600'
                                        }`}
                                >
                                    SEMANA
                                </button>
                                <span className="text-gray-400">/</span>
                                <button
                                    onClick={() => setTopCdsFilter('mes')}
                                    className={`font-medium transition-colors ${topCdsFilter === 'mes' ? 'text-red-600 border-b-2 border-red-600 pb-1' : 'text-gray-600 hover:text-red-600'
                                        }`}
                                >
                                    MÊS
                                </button>
                                <span className="text-gray-400">/</span>
                                <button
                                    onClick={() => setTopCdsFilter('geral')}
                                    className={`font-medium transition-colors ${topCdsFilter === 'geral' ? 'text-red-600 border-b-2 border-red-600 pb-1' : 'text-gray-600 hover:text-red-600'
                                        }`}
                                >
                                    GERAL
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Link to="/top-cds" className="text-red-600 hover:text-red-500 font-bold text-sm">
                                VER TODOS
                            </Link>
                            <div className="flex gap-2">
                                <Button
                                    onClick={() => scrollSection(topCdsRef, 'left')}
                                    size="icon"
                                    variant="outline"
                                    className="w-8 h-8 border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                                <Button
                                    onClick={() => scrollSection(topCdsRef, 'right')}
                                    size="icon"
                                    variant="outline"
                                    className="w-8 h-8 border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                    {/* Desktop - Carrossel */}
                    <div
                        ref={topCdsRef}
                        className="hidden md:flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth"
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                        {topCdsAlbums.length === 0 ? (
                            <p className="text-gray-500 py-8">Nenhum CD disponível para este período.</p>
                        ) : (
                            topCdsAlbums.map((album, index) => (
                                <div
                                    key={`${album.id}-${topCdsFilter}`}
                                    className="flex-shrink-0"
                                    style={{ width: 'calc((100% - 80px) / 6)' }}
                                >
                                    <Link
                                        to={`/${album.artistSlug}/${album.slug || album.id}`}
                                        className="group cursor-pointer block"
                                    >
                                        <div className="relative mb-3 overflow-hidden rounded-lg shadow-lg">
                                            <div className="absolute top-2 left-2 z-10 bg-red-600 text-white font-bold text-lg w-10 h-10 flex items-center justify-center rounded shadow-lg">
                                                {index + 1}
                                            </div>
                                            <img
                                                src={album.coverImage}
                                                alt={album.title}
                                                className="w-full aspect-square object-cover transform group-hover:scale-110 transition-transform duration-300"
                                            />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
                                                <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all duration-300">
                                                    <Play className="w-5 h-5 text-white ml-1" fill="white" />
                                                </div>
                                            </div>
                                        </div>
                                        <h3 className="text-black font-semibold text-sm mb-1 truncate group-hover:text-red-600 transition-colors">
                                            {album.title}
                                        </h3>
                                    </Link>
                                    <div className="flex items-center gap-1 text-gray-600 text-xs mb-2 flex-wrap">
                                        {/* Artista Principal */}
                                        <Link
                                            to={`/${album.artistSlug}`}
                                            className="flex items-center gap-0.5 hover:text-red-600 transition-colors"
                                        >
                                            <span>{album.artistName}</span>
                                            {album.artistVerified && (
                                                <BadgeCheck className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                                            )}
                                        </Link>

                                        {/* Colaboradores */}
                                        {album.collaborators && album.collaborators.length > 0 && (
                                            <>
                                                <span>&</span>
                                                {album.collaborators.map((collab, idx) => (
                                                    <Link
                                                        key={collab.id}
                                                        to={`/${collab.slug}`}
                                                        className="flex items-center gap-0.5 hover:text-red-600 transition-colors"
                                                    >
                                                        <span>{collab.name}</span>
                                                        {collab.is_verified && (
                                                            <BadgeCheck className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                                                        )}
                                                    </Link>
                                                ))}
                                            </>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs">
                                        <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded">
                                            <span className="font-bold text-gray-700">{formatNumber(album.period_play_count || album.playCount)}</span>
                                            <span className="text-gray-500">Plays</span>
                                        </div>
                                        <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded">
                                            <span className="font-bold text-gray-700">{formatNumber(album.downloadCount)}</span>
                                            <span className="text-gray-500">Downloads</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    
                    {/* Mobile - Grid */}
                    <div className="md:hidden grid grid-cols-2 lg:grid-cols-6 gap-4">
                        {topCdsAlbums.length === 0 ? (
                            <p className="text-gray-500 py-8 col-span-full">Nenhum CD disponível para este período.</p>
                        ) : (
                            topCdsAlbums.slice(0, 6).map((album, index) => (
                                <div
                                    key={`${album.id}-${topCdsFilter}`}
                                >
                                    <Link
                                        to={`/${album.artistSlug}/${album.slug || album.id}`}
                                        className="group cursor-pointer block"
                                    >
                                        <div className="relative mb-3 overflow-hidden rounded-lg shadow-lg">
                                            <div className="absolute top-2 left-2 z-10 bg-red-600 text-white font-bold text-lg w-10 h-10 flex items-center justify-center rounded shadow-lg">
                                                {index + 1}
                                            </div>
                                            <img
                                                src={album.coverImage}
                                                alt={album.title}
                                                className="w-full aspect-square object-cover transform group-hover:scale-110 transition-transform duration-300"
                                            />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
                                                <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all duration-300">
                                                    <Play className="w-5 h-5 text-white ml-1" fill="white" />
                                                </div>
                                            </div>
                                        </div>
                                        <h3 className="text-black font-semibold text-sm mb-1 truncate group-hover:text-red-600 transition-colors">
                                            {album.title}
                                        </h3>
                                    </Link>
                                    <div className="flex items-center gap-1 text-gray-600 text-xs mb-2 flex-wrap">
                                        <Link
                                            to={`/${album.artistSlug}`}
                                            className="flex items-center gap-0.5 hover:text-red-600 transition-colors"
                                        >
                                            <span>{album.artistName}</span>
                                            {album.artistVerified && (
                                                <BadgeCheck className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                                            )}
                                        </Link>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs">
                                        <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded">
                                            <span className="font-bold text-gray-700">{formatNumber(album.period_play_count || album.playCount)}</span>
                                            <span className="text-gray-500">Plays</span>
                                        </div>
                                        <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded">
                                            <span className="font-bold text-gray-700">{formatNumber(album.downloadCount)}</span>
                                            <span className="text-gray-500">Downloads</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>
                )}

                {/* Artistas em Destaque */}
                {!isOfflineMode && (
                <section className="mb-8 md:mb-16">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <User className="w-8 h-8 text-red-600" />
                            <h2 className="text-3xl font-bold text-black">Artistas em Destaque</h2>
                        </div>
                    </div>
                    {/* Desktop */}
                    <div className="hidden md:grid grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-14">
                        {allArtists.length === 0 ? (
                            <p className="text-gray-500 py-8 col-span-full">Nenhum artista disponível no momento.</p>
                        ) : (
                            allArtists.slice(0, 2).map((artist) => (
                                <div
                                    key={artist.id}
                                    className="flex flex-col items-center text-center"
                                >
                                    <Link
                                        to={`/${artist.slug || artist.id}`}
                                        className="group cursor-pointer mb-1"
                                    >
                                        <div className="relative inline-block">
                                            <img
                                                src={artist.avatar}
                                                alt={artist.name}
                                                className="w-28 h-28 rounded-full object-cover transform group-hover:scale-110 transition-transform duration-300 shadow-lg group-hover:ring-2 group-hover:ring-red-600"
                                            />
                                        </div>
                                    </Link>
                                    <Link
                                        to={`/${artist.slug || artist.id}`}
                                        className="flex items-center gap-1 justify-center text-black font-semibold text-sm mb-1 hover:text-red-600 transition-colors w-full whitespace-nowrap"
                                    >
                                        <span className="text-sm">{artist.name}</span>
                                        {artist.verified && (
                                            <BadgeCheck className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                                        )}
                                    </Link>
                                    <button
                                         onClick={(e) => handleFollow(artist.id, e)}
                                         className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow py-1.5 px-4 h-9 w-[130px] rounded-full font-semibold ${followingArtists.has(artist.id)
                                              ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                              : 'bg-red-600 text-white hover:bg-red-700'
                                              }`}
                                    >
                                         {followingArtists.has(artist.id) ? (
                                             'SEGUINDO'
                                         ) : (
                                             <>
                                                 <Plus className="w-3.5 h-3.5" />
                                                 SEGUIR
                                             </>
                                         )}
                                     </button>
                                </div>
                            ))
                        )}
                    </div>
                    {/* Mobile */}
                    <div className="md:hidden flex gap-6 overflow-x-auto scrollbar-hide scroll-smooth">
                        {allArtists.length === 0 ? (
                            <p className="text-gray-500 py-8 w-full">Nenhum artista disponível no momento.</p>
                        ) : (
                            allArtists.slice(0, 6).map((artist) => (
                                <div
                                    key={artist.id}
                                    className="flex flex-col items-center text-center flex-shrink-0"
                                    style={{ minWidth: '100px' }}
                                >
                                    <Link
                                        to={`/${artist.slug || artist.id}`}
                                        className="group cursor-pointer mb-2"
                                    >
                                        <div className="relative inline-block">
                                            <img
                                                src={artist.avatar}
                                                alt={artist.name}
                                                className="w-20 h-20 rounded-full object-cover transform group-hover:scale-110 transition-transform duration-300 shadow-lg group-hover:ring-2 group-hover:ring-red-600"
                                            />
                                        </div>
                                    </Link>
                                    <Link
                                        to={`/${artist.slug || artist.id}`}
                                        className="flex items-center gap-0.5 justify-center text-black font-semibold text-xs mb-2 hover:text-red-600 transition-colors w-full"
                                    >
                                        <span className="truncate">{artist.name}</span>
                                        {artist.verified && (
                                            <BadgeCheck className="w-2.5 h-2.5 text-blue-500 flex-shrink-0" />
                                        )}
                                    </Link>
                                    <button
                                         onClick={(e) => handleFollow(artist.id, e)}
                                         className={`inline-flex items-center justify-center gap-1 whitespace-nowrap text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-3 [&_svg]:shrink-0 shadow py-1 px-2 h-7 rounded-full font-semibold ${followingArtists.has(artist.id)
                                              ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                              : 'bg-red-600 text-white hover:bg-red-700'
                                              }`}
                                    >
                                         {followingArtists.has(artist.id) ? (
                                             'SIM'
                                         ) : (
                                             <>
                                                 <Plus className="w-2.5 h-2.5" />
                                                 ADD
                                             </>
                                         )}
                                     </button>
                                </div>
                            ))
                        )}
                    </div>
                </section>
                )}

                {/* Ouça Aqui Recomenda */}
                {!isOfflineMode && (
                <section className="mb-8 md:mb-16">
                    <div className="flex items-center gap-2 mb-6 flex-wrap">
                        <ThumbsUp className="w-8 h-8 text-red-600 flex-shrink-0" />
                        <h2 className="text-2xl md:text-3xl font-bold text-black whitespace-nowrap">Ouça Aqui Recomenda!</h2>
                    </div>
                    {/* Desktop */}
                    <div className="hidden md:grid grid-cols-3 lg:grid-cols-6 gap-4">
                        {recommendedAlbums.length === 0 ? (
                            <p className="text-gray-500 py-8 col-span-full">Nenhum álbum disponível no momento.</p>
                        ) : (
                            recommendedAlbums.map((album) => (
                                <div
                                    key={album.id}
                                    className="flex-shrink-0"
                                >
                                    <Link
                                        to={`/${album.artistSlug}/${album.slug || album.id}`}
                                        className="group cursor-pointer block"
                                    >
                                        <div className="relative mb-3 overflow-hidden rounded-lg shadow-lg">
                                            <img
                                                src={album.coverImage}
                                                alt={album.title}
                                                className="w-full aspect-square object-cover transform group-hover:scale-110 transition-transform duration-300"
                                            />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
                                                <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all duration-300">
                                                    <Play className="w-5 h-5 text-white ml-1" fill="white" />
                                                </div>
                                            </div>
                                        </div>
                                        <h3 className="text-black font-semibold text-sm mb-1 truncate group-hover:text-red-600 transition-colors">
                                            {album.title}
                                        </h3>
                                    </Link>
                                    <div className="flex items-center gap-1 text-gray-600 text-xs mb-2 flex-wrap">
                                        {/* Artista Principal */}
                                        <Link
                                            to={`/${album.artistSlug}`}
                                            className="flex items-center gap-0.5 hover:text-red-600 transition-colors"
                                        >
                                            <span>{album.artistName}</span>
                                            {album.artistVerified && (
                                                <BadgeCheck className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                                            )}
                                        </Link>

                                        {/* Colaboradores */}
                                        {album.collaborators && album.collaborators.length > 0 && (
                                             <>
                                                  <span>&</span>
                                                  {album.collaborators.map((collab) => (
                                                      <Link
                                                          key={collab.id}
                                                          to={`/${collab.slug}`}
                                                          className="flex items-center gap-0.5 hover:text-red-600 transition-colors"
                                                      >
                                                          <span>{collab.name}</span>
                                                          {collab.is_verified && (
                                                              <BadgeCheck className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                                                          )}
                                                      </Link>
                                                  ))}
                                              </>
                                          )}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs">
                                        <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded">
                                            <span className="font-bold text-gray-700">{formatNumber(album.playCount)}</span>
                                            <span className="text-gray-500">Plays</span>
                                        </div>
                                        <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded">
                                            <span className="font-bold text-gray-700">{formatNumber(album.downloadCount)}</span>
                                            <span className="text-gray-500">Downloads</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    {/* Mobile */}
                    <div className="md:hidden grid grid-cols-3 gap-2">
                        {recommendedAlbums.length === 0 ? (
                            <p className="text-gray-500 py-8 col-span-full">Nenhum álbum disponível no momento.</p>
                        ) : (
                            recommendedAlbums.map((album) => (
                                <div
                                    key={album.id}
                                    className="flex-shrink-0"
                                >
                                    <Link
                                        to={`/${album.artistSlug}/${album.slug || album.id}`}
                                        className="group cursor-pointer block"
                                    >
                                        <div className="relative mb-2 overflow-hidden rounded-lg shadow-lg">
                                            <img
                                                src={album.coverImage}
                                                alt={album.title}
                                                className="w-full aspect-square object-cover transform group-hover:scale-110 transition-transform duration-300"
                                            />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
                                                <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all duration-300">
                                                    <Play className="w-3 h-3 text-white ml-0.5" fill="white" />
                                                </div>
                                            </div>
                                        </div>
                                        <h3 className="text-black font-semibold text-xs mb-1 truncate group-hover:text-red-600 transition-colors">
                                            {album.title}
                                        </h3>
                                    </Link>
                                    <div className="flex items-center gap-0.5 text-gray-600 text-xs flex-wrap">
                                        {/* Artista Principal */}
                                        <Link
                                            to={`/${album.artistSlug}`}
                                            className="flex items-center gap-0.5 hover:text-red-600 transition-colors truncate"
                                        >
                                            <span className="truncate text-xs">{album.artistName}</span>
                                            {album.artistVerified && (
                                                <BadgeCheck className="w-2.5 h-2.5 text-blue-500 flex-shrink-0" />
                                            )}
                                        </Link>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>
                )}

                {/* CLIPS */}
                {clips.length > 0 && (
                    <section className="mb-16 hidden md:block">
                        <div className="flex items-center gap-3 mb-6">
                            <Video className="w-8 h-8 text-red-600" />
                            <h2 className="text-3xl font-bold text-black">CLIPS</h2>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Vídeo Principal */}
                            <div className="lg:col-span-2">
                                <div className="relative w-full bg-black rounded-lg overflow-hidden shadow-lg">
                                    <div className="relative" style={{ paddingBottom: '56.25%' }}>
                                        <iframe
                                            className="absolute top-0 left-0 w-full h-full"
                                            src={`https://www.youtube.com/embed/${extractYoutubeId(clips[selectedClipIndex].videoUrl)}`}
                                            title={clips[selectedClipIndex].title}
                                            frameBorder="0"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                        ></iframe>
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <h3 className="text-xl font-bold text-black mb-2">{clips[selectedClipIndex].title}</h3>
                                    <Link
                                        to={`/${clips[selectedClipIndex].artistSlug}`}
                                        className="flex items-center gap-1 text-gray-600 hover:text-red-600 transition-colors"
                                    >
                                        <span className="font-semibold">{clips[selectedClipIndex].artistName}</span>
                                        {clips[selectedClipIndex].artistVerified && (
                                            <BadgeCheck className="w-4 h-4 text-blue-500" />
                                        )}
                                    </Link>
                                </div>
                            </div>

                            {/* Lista de Vídeos */}
                            <div className="lg:col-span-1">
                                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                                    {clips.slice(0, 20).map((clip, index) => (
                                        <div
                                            key={clip.id}
                                            className={`flex gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                                                index === selectedClipIndex
                                                    ? 'bg-red-600' 
                                                    : 'bg-gray-100 hover:bg-gray-200'
                                            }`}
                                            onClick={() => {
                                                setSelectedClipIndex(index);
                                            }}
                                        >
                                            <img
                                                src={clip.thumbnail}
                                                alt={clip.title}
                                                className="w-24 h-20 rounded object-cover flex-shrink-0"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <h4 className={`text-sm font-semibold truncate ${index === selectedClipIndex ? 'text-white' : 'text-black'}`}>
                                                    {clip.title}
                                                </h4>
                                                <p className={`text-xs truncate ${index === selectedClipIndex ? 'text-red-100' : 'text-gray-600'}`}>
                                                    {clip.artistName}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* Gêneros */}
                <section className="mb-4 md:mb-16">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <Music className="w-8 h-8 text-red-600" />
                            <h2 className="text-3xl font-bold text-black">Gêneros</h2>
                        </div>
                        {/* Desktop - Navigation Buttons */}
                        <div className="hidden md:flex items-center gap-3">
                            <div className="flex gap-2">
                                <Button
                                    onClick={() => scrollSection(generosRef, 'left')}
                                    size="icon"
                                    variant="outline"
                                    className="w-8 h-8 border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                                <Button
                                    onClick={() => scrollSection(generosRef, 'right')}
                                    size="icon"
                                    variant="outline"
                                    className="w-8 h-8 border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                    {/* Desktop */}
                    <div
                        ref={generosRef}
                        className="hidden md:flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth"
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                        {genres.map((genre) => (
                            <Link
                                key={genre.slug}
                                to={`/genero/${genre.slug}`}
                                className="flex-shrink-0"
                                style={{ width: 'calc((100% - 80px) / 6)' }}
                            >
                                <div
                                    className="h-32 rounded-lg shadow-lg flex items-center justify-center p-4 cursor-pointer group hover:shadow-xl transition-all duration-300 relative overflow-hidden"
                                    style={{
                                        backgroundImage: `linear-gradient(135deg, rgba(0, 0, 0, 0.72) 0%, rgba(0, 0, 0, 0.72) 100%), url('${genre.imageUrl}')`,
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center'
                                    }}
                                >
                                    <div className="absolute inset-0 group-hover:bg-red-600/85 transition-all duration-300" />
                                    <h3 className="text-white font-bold text-lg text-center relative z-10 group-hover:scale-110 transition-transform duration-300">
                                        {genre.name}
                                    </h3>
                                </div>
                            </Link>
                        ))}
                    </div>
                    
                    {/* Mobile */}
                    <div className="md:hidden grid grid-cols-3 gap-3">
                        {genres.map((genre) => (
                            <Link
                                key={genre.slug}
                                to={`/genero/${genre.slug}`}
                                className="flex-shrink-0"
                            >
                                <div
                                    className="h-24 rounded-lg shadow-lg flex items-center justify-center p-2 cursor-pointer group hover:shadow-xl transition-all duration-300 relative overflow-hidden"
                                    style={{
                                        backgroundImage: `linear-gradient(135deg, rgba(0, 0, 0, 0.72) 0%, rgba(0, 0, 0, 0.72) 100%), url('${genre.imageUrl}')`,
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center'
                                    }}
                                >
                                    <div className="absolute inset-0 group-hover:bg-red-600/85 transition-all duration-300" />
                                    <h3 className="text-white font-bold text-sm text-center relative z-10 group-hover:scale-110 transition-transform duration-300">
                                        {genre.name}
                                    </h3>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            </div>
            </div>
        </div>
    );
};

export default HomeImproved;
