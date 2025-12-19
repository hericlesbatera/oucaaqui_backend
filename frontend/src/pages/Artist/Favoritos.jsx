import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePlayer } from '../../context/PlayerContext';
import { supabase } from '../../lib/supabaseClient';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { toast } from '../../hooks/use-toast';
import { Heart, Music, Disc3, ListMusic, Play, SlidersHorizontal, ChevronDown, Search, Trash2, BadgeCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import FavoriteSongCard from '../../components/FavoriteSongCard';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import LoadingSpinner from '../../components/LoadingSpinner';

const Favoritos = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { playSong } = usePlayer();
  const [activeTab, setActiveTab] = useState('musicas');
  const [searchQuery, setSearchQuery] = useState('');
  const [musicSort, setMusicSort] = useState('recent');
  const [albumSort, setAlbumSort] = useState('recent');
  const [loading, setLoading] = useState(true);
  const [favoritos, setFavoritos] = useState({
    musicas: [],
    albums: [],
    playlists: []
  });

  const sortOptions = [
    { id: 'recent', label: 'MAIS RECENTES' },
    { id: 'plays', label: 'MAIS OUVIDAS' },
  ];

  useEffect(() => {
    loadFavoritos();
  }, [user?.id]);

  const loadFavoritos = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Carregar músicas favoritas
       let favoriteSongs = null;
       
       // Tentar com snake_case na tabela music_favorites
       const { data: songsSnake } = await supabase
         .from('music_favorites')
         .select(`
           music_id,
           created_at,
           songs:music_id (
             id,
             title,
             artist_name,
             cover_url,
             duration,
             artist_id,
             album_id,
             plays,
             audio_url,
             artist:artist_id (
               id,
               is_verified,
               slug
             )
           )
         `)
         .eq('user_id', user.id)
         .order('created_at', { ascending: false });
      
      if (songsSnake && songsSnake.length > 0) {
        // Transforma music_id para song_id para compatibilidade com o resto do código
        favoriteSongs = songsSnake.map(item => ({
          song_id: item.music_id,
          created_at: item.created_at,
          songs: item.songs
        }));
      } else {
        // Fallback: tentar tabela antiga 'favorites' com camelCase
        const { data: songsCamel } = await supabase
          .from('favorites')
          .select(`
            songId,
            createdAt,
            songs:songId (
              id,
              title,
              artist_name,
              cover_url,
              duration,
              artist_id,
              album_id,
              plays,
              audio_url,
              artist:artist_id (
                id,
                is_verified,
                slug
              )
            )
          `)
          .eq('userId', user.id)
          .order('createdAt', { ascending: false });
        
        if (songsCamel && songsCamel.length > 0) {
          favoriteSongs = songsCamel.map(item => ({
            song_id: item.songId,
            created_at: item.createdAt,
            songs: item.songs
          }));
        } else {
          favoriteSongs = [];
        }
      }

      // Carregar álbuns favoritos
      let favoriteAlbumIds = null;
      
      // Tentar primeiro com snake_case
      const { data: albumsSnake } = await supabase
        .from('album_favorites')
        .select('album_id')
        .eq('user_id', user.id);
      
      if (albumsSnake && albumsSnake.length > 0) {
        favoriteAlbumIds = albumsSnake;
      } else {
        // Se não funcionar, tentar com camelCase
        const { data: albumsCamel } = await supabase
          .from('album_favorites')
          .select('albumId')
          .eq('userId', user.id);
        favoriteAlbumIds = albumsCamel;
      }

      const albumIds = favoriteAlbumIds?.map(f => f.album_id || f.albumId) || [];
      let favoriteAlbumsData = [];
      
      if (albumIds.length > 0) {
        const { data } = await supabase
          .from('albums')
          .select(`
            *,
            artist:artist_id (
              id,
              slug,
              is_verified
            )
          `)
          .in('id', albumIds)
          .order('created_at', { ascending: false });
        favoriteAlbumsData = data || [];
      }

      // Carregar playlists favoritas
      let favoritePlaylists = null;
      
      // Tentar com snake_case na tabela playlist_favorites
      const { data: playlistIdsSnake } = await supabase
        .from('playlist_favorites')
        .select('playlist_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      let playlistIds = [];
      
      if (playlistIdsSnake && playlistIdsSnake.length > 0) {
        playlistIds = playlistIdsSnake.map(f => f.playlist_id);
      } else {
        // Se não encontrou com snake_case, tentar com camelCase
        const { data: playlistIdsCamel } = await supabase
          .from('playlist_favorites')
          .select('playlistId')
          .eq('userId', user.id)
          .order('createdAt', { ascending: false });
        
        if (playlistIdsCamel && playlistIdsCamel.length > 0) {
          playlistIds = playlistIdsCamel.map(f => f.playlistId);
        }
      }
      
      // Se encontrou IDs, buscar as playlists
      if (playlistIds.length > 0) {
        const { data } = await supabase
          .from('playlists')
          .select(`
            id, 
            user_id, 
            slug, 
            title, 
            description, 
            cover_url, 
            is_public, 
            song_ids, 
            play_count, 
            created_at, 
            updated_at
          `)
          .in('id', playlistIds)
          .order('created_at', { ascending: false });
        favoritePlaylists = data || [];
      } else {
        favoritePlaylists = [];
      }

      setFavoritos({
        musicas: favoriteSongs || [],
        albums: favoriteAlbumsData,
        playlists: favoritePlaylists || []
      });
    } catch (error) {
      console.error('Erro ao carregar favoritos:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar favoritos',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFavorite = async (type, id) => {
    try {
      console.log(`Removing ${type} favorite:`, id);
      
      if (type === 'musica') {
        // Tentar primeiro com snake_case na tabela music_favorites
        let error = null;
        const { error: errorSnake } = await supabase
          .from('music_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('music_id', id);

        if (errorSnake) {
          console.log('music_favorites delete error, trying old table:', errorSnake);
          // Fallback: tentar tabela antiga 'favorites' com camelCase
          const { error: errorCamel } = await supabase
            .from('favorites')
            .delete()
            .eq('userId', user.id)
            .eq('songId', id);
          error = errorCamel;
        }

        if (error) throw error;

        setFavoritos(prev => ({
          ...prev,
          musicas: prev.musicas.filter(f => (f.song_id || f.songId) !== id)
        }));

        toast({
          title: 'Sucesso',
          description: 'Música removida dos favoritos'
        });
      } else if (type === 'album') {
        // Tentar primeiro com snake_case
        let error = null;
        const { error: errorSnake } = await supabase
          .from('album_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('album_id', id);

        if (errorSnake) {
          console.log('album_favorites snake_case delete error, trying camelCase:', errorSnake);
          // Fallback: tentar com camelCase
          const { error: errorCamel } = await supabase
            .from('album_favorites')
            .delete()
            .eq('userId', user.id)
            .eq('albumId', id);
          error = errorCamel;
        }

        if (error) throw error;

        setFavoritos(prev => ({
          ...prev,
          albums: prev.albums.filter(a => a.id !== id)
        }));

        toast({
          title: 'Sucesso',
          description: 'Álbum removido dos favoritos'
        });
      } else if (type === 'playlist') {
        const { error } = await supabase
          .from('playlist_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('playlist_id', id);

        if (error) throw error;

        setFavoritos(prev => ({
          ...prev,
          playlists: prev.playlists.filter(p => p.id !== id)
        }));

        toast({
          title: 'Sucesso',
          description: 'Playlist removida dos favoritos'
        });
      }
    } catch (error) {
      console.error('Error removing favorite:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao remover dos favoritos',
        variant: 'destructive'
      });
    }
  };

  const filterBySearch = (items, searchField) => {
    return items.filter(item => {
      const searchLower = searchQuery.toLowerCase();
      if (searchField === 'songs') {
        const song = item.songs;
        return (
          song?.title.toLowerCase().includes(searchLower) ||
          song?.artist_name.toLowerCase().includes(searchLower)
        );
      } else if (searchField === 'albums') {
        return (
          item.title?.toLowerCase().includes(searchLower) ||
          item.artist_name?.toLowerCase().includes(searchLower)
        );
      } else if (searchField === 'playlists') {
        return item.title?.toLowerCase().includes(searchLower);
      }
      return true;
    });
  };

  const sortItems = (items, sortType) => {
    const sorted = [...items];
    switch (sortType) {
      case 'plays':
        if (items[0]?.songs) {
          return sorted.sort((a, b) => (b.songs?.plays || 0) - (a.songs?.plays || 0));
        }
        return sorted.sort((a, b) => (b.play_count || 0) - (a.play_count || 0));
      case 'recent':
      default:
        return sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
  };

  const filteredMusicas = filterBySearch(favoritos.musicas, 'songs');
  const filteredAlbums = filterBySearch(favoritos.albums, 'albums');
  const filteredPlaylists = filterBySearch(favoritos.playlists, 'playlists');

  const sortedMusicas = sortItems(filteredMusicas, musicSort);
  const sortedAlbums = sortItems(filteredAlbums, albumSort);

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <LoadingSpinner size="large" text="Carregando..." />
      </div>
    );
  }

  return (
    <div className="bg-gray-50 w-full">
        <div className="max-w-6xl mx-auto p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
              <Heart className="w-8 h-8 text-red-600 fill-red-600" />
              Favoritos
            </h1>
            <p className="text-gray-600">Suas músicas, álbuns e playlists favoritas</p>
          </div>

          {/* Tabs */}
          <div className="flex gap-8 mb-8 border-b border-gray-300">
            <button
              onClick={() => setActiveTab('musicas')}
              className={`pb-4 font-semibold text-lg ${
                activeTab === 'musicas'
                  ? 'text-gray-900 border-b-4 border-red-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              MÚSICAS ({filteredMusicas.length})
            </button>
            <button
              onClick={() => setActiveTab('albums')}
              className={`pb-4 font-semibold text-lg ${
                activeTab === 'albums'
                  ? 'text-gray-900 border-b-4 border-red-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              ÁLBUNS ({filteredAlbums.length})
            </button>
            <button
              onClick={() => setActiveTab('playlists')}
              className={`pb-4 font-semibold text-lg ${
                activeTab === 'playlists'
                  ? 'text-gray-900 border-b-4 border-red-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              PLAYLISTS ({filteredPlaylists.length})
            </button>
          </div>

          {/* Toolbar com Pesquisa e Filtros */}
          <div className="flex items-center justify-between mb-8 gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder={
                  activeTab === 'musicas' ? 'Buscar Músicas' :
                  activeTab === 'albums' ? 'Buscar Álbuns' :
                  'Buscar Playlists'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 rounded-full border-gray-300"
              />
            </div>
            
            {(activeTab === 'musicas' || activeTab === 'albums') && (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm text-gray-700 transition-colors whitespace-nowrap">
                  <SlidersHorizontal className="w-4 h-4" />
                  Filtros
                  <ChevronDown className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white">
                  {sortOptions.map((option) => (
                    <DropdownMenuItem
                      key={option.id}
                      onClick={() => {
                        if (activeTab === 'musicas') {
                          setMusicSort(option.id);
                        } else {
                          setAlbumSort(option.id);
                        }
                      }}
                      className={`cursor-pointer ${
                        (activeTab === 'musicas' ? musicSort : albumSort) === option.id
                          ? 'bg-red-50 text-red-600 font-medium'
                          : ''
                      }`}
                    >
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
            </div>
          ) : (
            <div>
              {/* MÚSICAS - Layout Linear */}
              {activeTab === 'musicas' && (
                <div>
                  {sortedMusicas.length === 0 ? (
                    <div className="text-center py-12">
                      <Music className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-600 text-lg">
                        {searchQuery ? 'Nenhuma música encontrada' : 'Nenhuma música favorita ainda'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {sortedMusicas.map((item) => (
                        <FavoriteSongCard
                          key={item.song_id}
                          song={item}
                          onRemove={() => handleRemoveFavorite('musica', item.song_id)}
                          onPlay={() => {
                            // Mapear música atual com formato esperado pelo player
                            const formattedSong = {
                              id: item.songs?.id,
                              title: item.songs?.title,
                              artist_name: item.songs?.artist_name,
                              artistName: item.songs?.artist_name,
                              cover_url: item.songs?.cover_url,
                              coverImage: item.songs?.cover_url,
                              duration: item.songs?.duration,
                              audioUrl: item.songs?.audio_url,
                              albumId: item.songs?.album_id
                            };
                            
                            // Tocar apenas esta música
                            playSong(formattedSong, [formattedSong]);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* CDS/SINGLES - Layout Grid */}
              {activeTab === 'albums' && (
                <div>
                  {sortedAlbums.length === 0 ? (
                    <div className="text-center py-12">
                      <Disc3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-600 text-lg">
                        {searchQuery ? 'Nenhum álbum encontrado' : 'Nenhum álbum favorito ainda'}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                       {sortedAlbums.map((album) => (
                         <div
                            key={album.id}
                            className="group cursor-pointer"
                            onClick={() => {
                              const artistSlug = album.artist?.slug || album.artist_id;
                              const albumSlug = album.slug || album.id;
                              navigate(`/${artistSlug}/${albumSlug}`);
                            }}
                         >
                           <div className="relative mb-3 overflow-hidden rounded-lg bg-gray-200">
                             {album.cover_url && (
                               <img
                                 src={album.cover_url}
                                 alt={album.title}
                                 className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-300"
                               />
                             )}
                             <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
                               <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all duration-300">
                                 <Play className="w-5 h-5 text-white ml-1" fill="white" />
                               </div>
                             </div>
                           </div>
                           <div className="space-y-1">
                             <h3 className="font-semibold text-gray-900 truncate text-xs">
                               {album.title}
                             </h3>
                             <div className="flex items-center gap-1">
                               <p className="text-xs text-gray-600 truncate">
                                 {album.artist_name}
                               </p>
                               {album.artist?.is_verified && (
                                 <BadgeCheck className="w-3 h-3 text-blue-500 flex-shrink-0" />
                               )}
                             </div>
                           </div>
                           <button
                             onClick={(e) => {
                               e.stopPropagation();
                               handleRemoveFavorite('album', album.id);
                             }}
                             className="mt-2 w-full text-xs text-red-600 hover:bg-red-50 py-2 rounded transition-colors flex items-center justify-center gap-1 font-medium"
                           >
                             <Trash2 className="w-4 h-4" />
                             Remover
                           </button>
                         </div>
                       ))}
                    </div>
                  )}
                </div>
              )}

              {/* PLAYLISTS - Layout Grid */}
              {activeTab === 'playlists' && (
                <div>
                  {filteredPlaylists.length === 0 ? (
                    <div className="text-center py-12">
                      <ListMusic className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-600 text-lg">
                        {searchQuery ? 'Nenhuma playlist encontrada' : 'Nenhuma playlist favorita ainda'}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                       {filteredPlaylists.map((playlist) => (
                         <div
                           key={playlist.id}
                           className="group cursor-pointer"
                         >
                           <div
                             className="relative mb-3 rounded-lg overflow-hidden bg-gradient-to-br from-red-600 to-red-800 cursor-pointer"
                             onClick={() => {
                               navigate(`/playlist/${playlist.slug || playlist.id}`);
                             }}
                           >
                             <div className="aspect-square flex items-center justify-center">
                               <ListMusic className="w-16 h-16 text-white opacity-20" />
                             </div>
                             <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
                               <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all duration-300">
                                 <Play className="w-5 h-5 text-red-600 ml-1" fill="#dc2626" />
                               </div>
                             </div>
                           </div>
                           <div className="space-y-1">
                             <h3 className="font-semibold text-gray-900 truncate text-xs">
                               {playlist.title}
                             </h3>
                             <p className="text-xs text-gray-600">
                               {playlist.song_ids?.length || 0} músicas
                             </p>
                           </div>
                           <button
                             onClick={(e) => {
                               e.stopPropagation();
                               handleRemoveFavorite('playlist', playlist.id);
                             }}
                             className="mt-2 w-full text-xs text-red-600 hover:bg-red-50 py-2 rounded transition-colors flex items-center justify-center gap-1 font-medium"
                           >
                             <Trash2 className="w-4 h-4" />
                             Remover
                           </button>
                         </div>
                       ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Favoritos;
