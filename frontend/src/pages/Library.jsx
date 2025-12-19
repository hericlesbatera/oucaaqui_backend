import React, { useState, useEffect } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { useTrackPageView } from '../hooks/useTrackPageView';
import { useCapacitorDownloads } from '../hooks/useCapacitorDownloads';
import { useOfflinePlayer } from '../hooks/useOfflinePlayer';
import { supabase } from '../lib/supabaseClient';
import { Play, Heart, Download, FileText, ListMusic, Trash2, Music, ChevronDown } from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from '../hooks/use-toast';

const Library = () => {
    useTrackPageView('library');
    const { playSong } = usePlayer();
    const { user } = useAuth();
    const { downloads, loading: downloadsLoading, deleteDownloadedAlbum } = useCapacitorDownloads();
    const { loadAlbumOfflineURLs } = useOfflinePlayer();
    const [activeTab, setActiveTab] = useState('favoritos');
    const [loading, setLoading] = useState(true);
    const [expandedDownload, setExpandedDownload] = useState(null);
    const [data, setData] = useState({
        favoriteAlbums: [],
        favoritePlaylists: [],
        userPlaylists: []
    });

    useEffect(() => {
        loadLibraryData();
    }, [user?.id]);

    const loadLibraryData = async () => {
        if (!user?.id) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);

            // Carregar álbuns favoritos
            const { data: albumIds } = await supabase
                .from('album_favorites')
                .select('album_id')
                .eq('user_id', user.id);

            let favoriteAlbumsData = [];
            if (albumIds && albumIds.length > 0) {
                const ids = albumIds.map(a => a.album_id);
                const { data: albums } = await supabase
                    .from('albums')
                    .select(`
            *,
            artist:artist_id (
              id,
              slug,
              is_verified
            )
          `)
                    .in('id', ids)
                    .order('created_at', { ascending: false });
                favoriteAlbumsData = albums || [];
            }

            // Carregar playlists favoritas
            const { data: playlistFavIds } = await supabase
                .from('playlist_favorites')
                .select('playlist_id')
                .eq('user_id', user.id);

            let favoritePlaylists = [];
            if (playlistFavIds && playlistFavIds.length > 0) {
                const ids = playlistFavIds.map(p => p.playlist_id);
                const { data: playlists } = await supabase
                    .from('playlists')
                    .select('*')
                    .in('id', ids)
                    .order('created_at', { ascending: false });
                favoritePlaylists = playlists || [];
            }

            // Carregar playlists do usuário
            const { data: userPlaylistsData } = await supabase
                .from('playlists')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            setData({
                favoriteAlbums: favoriteAlbumsData,
                favoritePlaylists: favoritePlaylists,
                userPlaylists: userPlaylistsData || []
            });
        } catch (error) {
            console.error('Erro ao carregar biblioteca:', error);
            toast({
                title: 'Erro',
                description: 'Erro ao carregar dados da biblioteca',
                variant: 'destructive'
            });
        } finally {
            setLoading(false);
        }
    };

    const getCountLabel = () => {
        switch (activeTab) {
            case 'favoritos':
                return `${data.favoriteAlbums.length} favoritos`;
            case 'playlists':
                return `${data.favoritePlaylists.length + data.userPlaylists.length} playlists`;
            case 'downloads':
                return `${downloads.length} downloads`;
            default:
                return '';
        }
    };

    const handlePlayDownloadedAlbum = async (downloadedAlbum) => {
        try {
            // Carregar URLs locais das músicas baixadas
            const songsWithURLs = await loadAlbumOfflineURLs(
                downloadedAlbum.albumDir, 
                downloadedAlbum.songs
            );

            // Criar queue com as músicas
            const queue = songsWithURLs.map(song => ({
                id: song.id,
                title: song.title,
                artist: downloadedAlbum.artist,
                album: downloadedAlbum.title,
                image: downloadedAlbum.coverUrl,
                audioUrl: song.audioUrl,
                isOffline: true,
                albumId: downloadedAlbum.albumId
            }));

            // Tocar primeira música da fila
            if (queue.length > 0) {
                playSong(queue[0], queue);
                toast({
                    title: 'Reproduzindo Offline',
                    description: `${downloadedAlbum.title} - ${downloadedAlbum.artist}`
                });
            }
        } catch (error) {
            console.error('Erro ao reproduzir álbum baixado:', error);
            toast({
                title: 'Erro',
                description: 'Não foi possível reproduzir o álbum',
                variant: 'destructive'
            });
        }
    };

    const TabButton = ({ tab, icon, label }) => (
        <button
            onClick={() => setActiveTab(tab)}
            className={`flex items-center justify-center gap-2 py-3 md:py-2 rounded-lg font-bold text-sm md:text-base border-2 transition-all flex-1 ${
                activeTab === tab
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-white text-red-600 border-red-600 hover:shadow-md'
            }`}
        >
            {icon}
            <span>{label}</span>
        </button>
    );

    return (
        <div className="flex-1 overflow-y-auto bg-white">
            {/* Abas em botões */}
            <div className="px-3 md:px-6 py-4 md:py-6 bg-white border-b border-gray-100">
                <div className="flex gap-3">
                    <TabButton
                        tab="favoritos"
                        icon={<Heart className="w-5 h-5 fill-current" />}
                        label="Favoritos"
                    />
                    <TabButton
                        tab="playlists"
                        icon={<FileText className="w-5 h-5" />}
                        label="Playlists"
                    />
                    <TabButton
                        tab="downloads"
                        icon={<Download className="w-5 h-5" />}
                        label="Downloads"
                    />
                </div>
            </div>

            {/* Contador e botão Ver Lançamentos */}
            <div className="px-3 md:px-6 py-4 bg-white border-b border-gray-100 flex items-center justify-between">
                <span className="text-gray-800 font-medium text-sm">{getCountLabel()}</span>
                {activeTab === 'favoritos' && (
                    <button className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded font-bold text-sm transition-colors flex items-center gap-2 whitespace-nowrap">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                        </svg>
                        Ver Lançamentos
                    </button>
                )}
            </div>

            {/* Conteúdo */}
            <div className="px-4 md:px-6 py-6 bg-white">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
                    </div>
                ) : (
                    <>
                        {activeTab === 'favoritos' && (
                            <div className="space-y-3">
                                {data.favoriteAlbums.length === 0 ? (
                                    <div className="text-center py-12">
                                        <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                        <p className="text-gray-500 text-lg">Nenhum álbum favoritado ainda</p>
                                    </div>
                                ) : (
                                    data.favoriteAlbums.map((album) => (
                                        <div
                                            key={album.id}
                                            className="group cursor-pointer block hover:bg-gray-50 p-3 rounded-lg transition-colors"
                                            onClick={() => {
                                                window.location.href = `/${album.artist?.slug || album.artist_id}/${album.slug || album.id}`;
                                            }}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="relative flex-shrink-0 overflow-hidden rounded-lg shadow-md border-2 border-gray-200">
                                                    <img
                                                        src={album.cover_url}
                                                        alt={album.title}
                                                        className="w-20 h-20 object-cover transform group-hover:scale-105 transition-transform duration-300"
                                                    />
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center">
                                                        <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transform scale-50 group-hover:scale-100 transition-all duration-300">
                                                            <Play className="w-4 h-4 text-white ml-0.5" fill="white" />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="text-gray-900 font-semibold text-xs line-clamp-2 group-hover:text-red-600 transition-colors">
                                                        {album.title}
                                                    </h3>
                                                    <p className="text-gray-600 text-xs mt-0.5">{album.artist_name}</p>
                                                    <p className="text-gray-500 text-xs mt-1">
                                                        {album.total_tracks || 0} músicas
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {activeTab === 'playlists' && (
                            <div className="space-y-3">
                                {data.favoritePlaylists.length === 0 && data.userPlaylists.length === 0 ? (
                                    <div className="text-center py-12">
                                        <ListMusic className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                        <p className="text-gray-500 text-lg">Nenhuma playlist ainda</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Seção de playlists favoritas */}
                                        {data.favoritePlaylists.length > 0 && (
                                            <>
                                                <div className="mb-3 mt-4">
                                                    <p className="text-gray-600 text-xs font-semibold uppercase">Playlists Favoritas</p>
                                                </div>
                                                {data.favoritePlaylists.map((playlist) => (
                                                    <div
                                                        key={playlist.id}
                                                        className="group cursor-pointer block hover:bg-gray-50 p-3 rounded-lg transition-colors"
                                                        onClick={() => {
                                                            window.location.href = `/playlist/${playlist.slug || playlist.id}`;
                                                        }}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <div className="relative flex-shrink-0 overflow-hidden rounded-lg shadow-md border-2 border-gray-200 w-20 h-20 bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center">
                                                                {playlist.cover_url ? (
                                                                    <img
                                                                        src={playlist.cover_url}
                                                                        alt={playlist.title}
                                                                        className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-300"
                                                                    />
                                                                ) : (
                                                                    <ListMusic className="w-6 h-6 text-white opacity-30" />
                                                                )}
                                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center">
                                                                    <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transform scale-50 group-hover:scale-100 transition-all duration-300">
                                                                        <Play className="w-4 h-4 text-white ml-0.5" fill="white" />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <h3 className="text-gray-900 font-semibold text-xs line-clamp-2 group-hover:text-red-600 transition-colors">
                                                                    {playlist.title}
                                                                </h3>
                                                                <p className="text-gray-600 text-xs mt-0.5 line-clamp-1">{playlist.description}</p>
                                                                <p className="text-gray-500 text-xs mt-1">
                                                                    {(playlist.song_ids || []).length} músicas
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </>
                                        )}

                                        {/* Seção de minhas playlists */}
                                        {data.userPlaylists.length > 0 && (
                                            <>
                                                <div className="mb-3 mt-6">
                                                    <p className="text-gray-600 text-xs font-semibold uppercase">Minhas Playlists</p>
                                                </div>
                                                {data.userPlaylists.map((playlist) => (
                                                    <div
                                                        key={playlist.id}
                                                        className="group cursor-pointer block hover:bg-gray-50 p-3 rounded-lg transition-colors"
                                                        onClick={() => {
                                                            window.location.href = `/playlist/${playlist.slug || playlist.id}`;
                                                        }}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <div className="relative flex-shrink-0 overflow-hidden rounded-lg shadow-md border-2 border-gray-200 w-20 h-20 bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center">
                                                                {playlist.cover_url ? (
                                                                    <img
                                                                        src={playlist.cover_url}
                                                                        alt={playlist.title}
                                                                        className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-300"
                                                                    />
                                                                ) : (
                                                                    <ListMusic className="w-6 h-6 text-white opacity-30" />
                                                                )}
                                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center">
                                                                    <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transform scale-50 group-hover:scale-100 transition-all duration-300">
                                                                        <Play className="w-4 h-4 text-white ml-0.5" fill="white" />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <h3 className="text-gray-900 font-semibold text-xs line-clamp-2 group-hover:text-red-600 transition-colors">
                                                                    {playlist.title}
                                                                </h3>
                                                                <p className="text-gray-600 text-xs mt-0.5 line-clamp-1">{playlist.description}</p>
                                                                <p className="text-gray-500 text-xs mt-1">
                                                                    {(playlist.song_ids || []).length} músicas
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </>
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        {activeTab === 'downloads' && (
                            <div className="space-y-3">
                                {downloadsLoading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
                                    </div>
                                ) : downloads.length === 0 ? (
                                    <div className="text-center py-12">
                                        <Download className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                        <p className="text-gray-500 text-lg">Nenhum download ainda</p>
                                        <p className="text-gray-400 text-sm">Baixe músicas e álbuns para ouvi-los offline</p>
                                    </div>
                                ) : (
                                    downloads.map((downloadedAlbum) => (
                                        <div
                                            key={downloadedAlbum.albumId}
                                            className="border border-gray-200 rounded-lg overflow-hidden"
                                        >
                                            {/* Card principal do álbum */}
                                            <div
                                                className="group cursor-pointer block hover:bg-gray-50 p-3 transition-colors"
                                                onClick={() => handlePlayDownloadedAlbum(downloadedAlbum)}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className="relative flex-shrink-0 overflow-hidden rounded-lg shadow-md border-2 border-gray-200">
                                                        <img
                                                            src={downloadedAlbum.coverUrl}
                                                            alt={downloadedAlbum.title}
                                                            className="w-20 h-20 object-cover transform group-hover:scale-105 transition-transform duration-300"
                                                        />
                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center">
                                                            <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transform scale-50 group-hover:scale-100 transition-all duration-300">
                                                                <Play className="w-4 h-4 text-white ml-0.5" fill="white" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="text-gray-900 font-semibold text-xs line-clamp-2 group-hover:text-red-600 transition-colors">
                                                            {downloadedAlbum.title}
                                                        </h3>
                                                        <p className="text-gray-600 text-xs mt-0.5">{downloadedAlbum.artist}</p>
                                                        <p className="text-gray-500 text-xs mt-1">
                                                            {downloadedAlbum.songCount}/{downloadedAlbum.totalSongs} músicas
                                                        </p>
                                                        <p className="text-gray-400 text-xs mt-1">
                                                            {new Date(downloadedAlbum.downloadedAt).toLocaleDateString('pt-BR')}
                                                        </p>
                                                    </div>
                                                    <div className="flex-shrink-0 flex gap-1">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setExpandedDownload(
                                                                    expandedDownload === downloadedAlbum.albumId 
                                                                        ? null 
                                                                        : downloadedAlbum.albumId
                                                                );
                                                            }}
                                                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                                            title={expandedDownload === downloadedAlbum.albumId ? "Recolher" : "Expandir"}
                                                        >
                                                            <ChevronDown 
                                                                className={`w-4 h-4 transition-transform ${
                                                                    expandedDownload === downloadedAlbum.albumId ? 'rotate-180' : ''
                                                                }`} 
                                                            />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                deleteDownloadedAlbum(downloadedAlbum.albumId);
                                                                toast({
                                                                    title: 'Deletado',
                                                                    description: `${downloadedAlbum.title} foi removido`
                                                                });
                                                            }}
                                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Deletar"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Lista de músicas (expansível) */}
                                            {expandedDownload === downloadedAlbum.albumId && (
                                                <div className="border-t border-gray-200 bg-gray-50 divide-y divide-gray-200">
                                                    {downloadedAlbum.songs.map((song, idx) => (
                                                        <div
                                                            key={song.id}
                                                            className="px-3 py-2 text-xs hover:bg-gray-100 cursor-pointer transition-colors flex items-center gap-2"
                                                            onClick={async () => {
                                                                const songsWithURLs = await loadAlbumOfflineURLs(
                                                                    downloadedAlbum.albumDir, 
                                                                    downloadedAlbum.songs
                                                                );
                                                                const queue = songsWithURLs.map(s => ({
                                                                    id: s.id,
                                                                    title: s.title,
                                                                    artist: downloadedAlbum.artist,
                                                                    album: downloadedAlbum.title,
                                                                    image: downloadedAlbum.coverUrl,
                                                                    audioUrl: s.audioUrl,
                                                                    isOffline: true,
                                                                    albumId: downloadedAlbum.albumId
                                                                }));
                                                                playSong(queue[idx], queue);
                                                            }}
                                                        >
                                                            <Play className="w-3 h-3 text-gray-400" fill="currentColor" />
                                                            <span className="text-gray-600 font-medium w-5">{idx + 1}</span>
                                                            <span className="text-gray-700 flex-1 line-clamp-1">{song.title}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default Library;
