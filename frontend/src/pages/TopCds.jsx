import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Play, SlidersHorizontal, ChevronDown, BadgeCheck } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useTrackPageView } from '../hooks/useTrackPageView';
import { AdBannerLeft, AdBannerRight } from '../components/AdBanner';
import LoadingSpinner from '../components/LoadingSpinner';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';

const TopCds = () => {
    useTrackPageView('top-cds');
    const [albums, setAlbums] = useState([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('geral');

    const periods = [
        { id: 'dia', label: 'DIA' },
        { id: 'semana', label: 'SEMANA' },
        { id: 'mes', label: 'MÊS' },
        { id: 'geral', label: 'GERAL' },
    ];

    useEffect(() => {
        loadAlbums();
    }, [period]);

    const loadAlbums = async () => {
        setLoading(true);

        try {
            // Buscar artistas primeiro
            const { data: artistsData } = await supabase
                .from('artists')
                .select('id, name, slug, is_verified, avatar_url');
            
            const artistsMap = {};
            if (artistsData) {
                artistsData.forEach(artist => {
                    artistsMap[artist.id] = artist;
                });
            }

            // Buscar todos os álbuns públicos não deletados
            const { data: allAlbums, error } = await supabase
                .from('albums')
                .select('*')
                .or(`is_private.is.null,is_private.eq.false`)
                .is('deleted_at', null)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (!allAlbums) {
                setAlbums([]);
                setLoading(false);
                return;
            }

            // Filtrar localmente para garantir que não há privados
            const publicAlbums = allAlbums.filter(album => !album.is_private);

            // Buscar colaboradores aceitos usando collaboration_invites
            const { data: allCollabInvites } = await supabase
                .from('collaboration_invites')
                .select('album_id, invited_user_id')
                .eq('status', 'accepted');

            // Agrupar colaboradores por album
            const collaboratorsByAlbum = {};

            if (allCollabInvites && allCollabInvites.length > 0) {
                allCollabInvites.forEach(collab => {
                    if (artistsMap[collab.invited_user_id]) {
                        if (!collaboratorsByAlbum[collab.album_id]) {
                            collaboratorsByAlbum[collab.album_id] = [];
                        }
                        collaboratorsByAlbum[collab.album_id].push(artistsMap[collab.invited_user_id]);
                    }
                });
            }

            // Mapear colaboradores nos albums
            const formattedAlbums = publicAlbums.map(album => {
                const artist = artistsMap[album.artist_id] || {};
                const collaborators = collaboratorsByAlbum[album.id] || [];

                return {
                    ...album,
                    artist: artist,
                    artistName: artist.name || album.artist_name || 'Artista',
                    artistSlug: artist.slug || album.artist_id,
                    artistVerified: artist.is_verified || false,
                    collaborators
                };
            });
                    collaborators: collaborators
                };
            });

            // Se o período for 'geral', retorna todos os álbuns ordenados por play_count
            if (period === 'geral') {
                const sorted = [...formattedAlbums]
                    .sort((a, b) => b.play_count - a.play_count);
                setAlbums(sorted);
                setLoading(false);
                return;
            }

            // Para DIA, SEMANA, MÊS, buscar plays e filtrar por data
            const now = new Date();

            let startDate;
            if (period === 'dia') {
                // Criar data do início do DIA ATUAL (00:00:00 da timezone local)
                startDate = new Date(now);
                startDate.setHours(0, 0, 0, 0);
            } else if (period === 'semana') {
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            } else if (period === 'mes') {
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

            // Ordenar álbuns pelos plays do período (só mostra álbuns com plays neste período)
            const sortedAlbums = formattedAlbums
                .filter(album => playCountByAlbum[album.id] > 0) // Só mostra álbuns com plays neste período
                .map(album => ({
                    ...album,
                    period_play_count: playCountByAlbum[album.id] || 0
                }))
                .sort((a, b) => {
                    // Ordena APENAS por plays do período (sem desempate)
                    return b.period_play_count - a.period_play_count;
                });

            setAlbums(sortedAlbums);
        } catch (error) {
            console.error('Erro ao carregar álbuns:', error);
            setAlbums([]);
        }
        setLoading(false);
    };

    const formatNumber = (num) => {
        if (!num) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Content with Ads */}
            <div className="flex justify-center gap-4 px-2">
                <AdBannerLeft />
                <div className="w-full max-w-7xl px-4 py-8">
                    {/* Header like CDS/SINGLES */}
                    <div className="flex items-center justify-between mb-4 pb-2 border-b-2 border-red-600">
                        <div className="flex items-center gap-3">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-red-600">
                                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline>
                                <polyline points="16 7 22 7 22 13"></polyline>
                            </svg>
                            <h2 className="text-2xl font-bold text-black">
                                TOP CDS
                            </h2>
                        </div>
                        <DropdownMenu modal={false}>
                            <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-md text-sm text-gray-700 transition-colors">
                                <SlidersHorizontal className="w-4 h-4" />
                                {periods.find(p => p.id === period)?.label || 'GERAL'}
                                <ChevronDown className="w-4 h-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-white">
                                {periods.map((p) => (
                                    <DropdownMenuItem
                                        key={p.id}
                                        onClick={() => setPeriod(p.id)}
                                        className={`cursor-pointer ${period === p.id ? 'bg-red-50 text-red-600 font-medium' : ''}`}
                                    >
                                        {p.label}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Albums Grid */}
                    {loading ? (
                        <div className="text-center py-12">
                            <LoadingSpinner size="medium" text="Carregando..." />
                        </div>
                    ) : albums.length === 0 ? (
                        <div className="text-center py-16">
                            <TrendingUp className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-gray-700 mb-2">
                                Nenhum CD encontrado
                            </h3>
                            <p className="text-gray-500">
                                Não há CDs para o período selecionado
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                            {albums.map((album, index) => (
                                <div key={album.id}>
                                    <Link
                                        to={`/${album.artist?.slug || album.artist_id}/${album.slug || album.id}`}
                                        className="group cursor-pointer block"
                                    >
                                        <div className="relative mb-3 overflow-hidden rounded-lg shadow-lg">
                                            <div className="absolute top-2 left-2 z-10 bg-red-600 text-white font-bold text-lg w-10 h-10 flex items-center justify-center rounded shadow-lg">
                                                {index + 1}
                                            </div>
                                            <img
                                                src={album.cover_url || '/images/default-cover.jpg'}
                                                alt={album.title}
                                                className="w-full aspect-square object-cover transform group-hover:scale-110 transition-transform duration-300"
                                            />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
                                                <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all duration-300">
                                                    <Play className="w-5 h-5 text-white ml-1" fill="white" />
                                                </div>
                                            </div>
                                        </div>
                                        <h3 className="text-gray-900 font-semibold text-sm mb-1 truncate group-hover:text-red-600 transition-colors">
                                            {album.title}
                                        </h3>
                                    </Link>
                                    <div className="flex items-center gap-1 text-gray-500 text-xs mb-2 flex-wrap">
                                        {/* Artista Principal */}
                                        <Link
                                            to={`/${album.artist?.slug || album.artist_id}`}
                                            className="flex items-center gap-0.5 hover:text-red-600 transition-colors"
                                        >
                                            <span>{album.artist?.name || album.artist_name}</span>
                                            {album.artist?.is_verified && (
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
                                            <span className="font-bold text-gray-700">
                                                {formatNumber(period === 'geral' ? album.play_count : album.period_play_count)}
                                            </span>
                                            <span className="text-gray-500">Plays</span>
                                        </div>
                                        <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded">
                                            <span className="font-bold text-gray-700">{formatNumber(album.download_count)}</span>
                                            <span className="text-gray-500">Downloads</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <AdBannerRight />
            </div>
        </div>
    );
};

export default TopCds;
