import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { Plus, Search, ChevronDown, Music, X, Upload, Play, Loader2, Edit, Trash2, SlidersHorizontal, ListMusic } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Card } from '../../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { toast } from '../../hooks/use-toast';
import LoadingSpinner from '../../components/LoadingSpinner';

const MyPlaylists = () => {
  const { user } = useAuth();
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [orderBy, setOrderBy] = useState('recent');
  
  // Create playlist modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createTab, setCreateTab] = useState('create');
  const [newPlaylist, setNewPlaylist] = useState({
    title: '',
    description: '',
    isPrivate: false,
    coverImage: null
  });
  const [coverPreview, setCoverPreview] = useState(null);
  const [creating, setCreating] = useState(false);
  const coverInputRef = useRef(null);

  // Add songs modal
  const [addSongsModalOpen, setAddSongsModalOpen] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [songSearchQuery, setSongSearchQuery] = useState('');
  const [recentAlbums, setRecentAlbums] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchingAlbums, setSearchingAlbums] = useState(false);
  const [albumSongs, setAlbumSongs] = useState([]);
  const [selectedAlbum, setSelectedAlbum] = useState(null);

  // Edit playlist modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', isPrivate: false });
  const [editCoverFile, setEditCoverFile] = useState(null);
  const [editCoverPreview, setEditCoverPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const editCoverInputRef = useRef(null);
  const [playlistSongs, setPlaylistSongs] = useState([]);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [playlistToDelete, setPlaylistToDelete] = useState(null);

  const orderOptions = [
    { value: 'recent', label: 'MAIS RECENTES' },
    { value: 'played', label: 'MAIS OUVIDAS' },
    { value: 'oldest', label: 'MAIS ANTIGOS' }
  ];

  useEffect(() => {
    loadPlaylists();
    loadRecentAlbums();
  }, [user?.id]);

  const loadPlaylists = async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      let query = supabase
        .from('playlists')
        .select('*')
        .eq('user_id', user.id);

      if (orderBy === 'recent') {
        query = query.order('created_at', { ascending: false });
      } else if (orderBy === 'oldest') {
        query = query.order('created_at', { ascending: true });
      } else if (orderBy === 'played') {
        query = query.order('play_count', { ascending: false });
      }

      const { data, error } = await query;
      if (error) throw error;
      setPlaylists(data || []);
    } catch (error) {
      console.error('Erro ao carregar playlists:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentAlbums = async () => {
    // Buscar álbuns recentes
    try {
      const { data } = await supabase
        .from('albums')
        .select('id, title, artist_name, cover_url')
        .order('created_at', { ascending: false })
        .limit(10);
      setRecentAlbums(data || []);
    } catch (error) {
      console.error('Erro ao carregar álbuns recentes:', error);
    }
  };

  const handleCoverChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewPlaylist({ ...newPlaylist, coverImage: file });
      const reader = new FileReader();
      reader.onloadend = () => setCoverPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylist.title || newPlaylist.title.length < 5) {
      toast({
        title: 'Erro',
        description: 'O título deve ter no mínimo 5 caracteres',
        variant: 'destructive'
      });
      return;
    }

    setCreating(true);

    try {
      let coverUrl = null;

      // Upload da capa se fornecida
      if (newPlaylist.coverImage) {
        const fileExt = newPlaylist.coverImage.name.split('.').pop();
        const fileName = `playlists/${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('musica')
          .upload(fileName, newPlaylist.coverImage, { upsert: true });

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('musica')
            .getPublicUrl(fileName);
          coverUrl = publicUrl;
        }
      }

      // Gerar slug a partir do título
      const generateSlug = (text) => {
        return text
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim();
      };

      const slug = generateSlug(newPlaylist.title);

      // Criar playlist
      const { data, error } = await supabase
        .from('playlists')
        .insert({
          user_id: user.id,
          slug: slug,
          title: newPlaylist.title,
          description: newPlaylist.description,
          cover_url: coverUrl,
          is_public: !newPlaylist.isPrivate,
          song_ids: [],
          play_count: 0
        })
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar playlist:', error);
        throw error;
      }

      toast({
        title: 'Playlist criada!',
        description: `"${newPlaylist.title}" foi criada com sucesso`
      });

      setPlaylists([data, ...playlists]);
      setCreateModalOpen(false);
      setNewPlaylist({ title: '', description: '', isPrivate: false, coverImage: null });
      setCoverPreview(null);

      // Abrir modal de adicionar músicas
      setSelectedPlaylist(data);
      setAddSongsModalOpen(true);

    } catch (error) {
      console.error('Erro ao criar playlist:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível criar a playlist',
        variant: 'destructive'
      });
    } finally {
      setCreating(false);
    }
  };

  const searchAlbums = async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearchingAlbums(true);
    try {
      const { data } = await supabase
        .from('albums')
        .select('id, title, artist_name, cover_url')
        .ilike('title', `%${query}%`)
        .limit(10);
      setSearchResults(data || []);
    } catch (error) {
      console.error('Erro na busca:', error);
    } finally {
      setSearchingAlbums(false);
    }
  };

  const loadAlbumSongs = async (album) => {
    setSelectedAlbum(album);
    try {
      const { data } = await supabase
        .from('songs')
        .select('id, title, artist_name, cover_url')
        .eq('album_id', album.id)
        .order('track_number', { ascending: true });
      setAlbumSongs(data || []);
    } catch (error) {
      console.error('Erro ao carregar músicas do álbum:', error);
    }
  };

  const addSongToPlaylist = async (song) => {
    if (!selectedPlaylist) return;

    try {
      const currentSongIds = selectedPlaylist.song_ids || [];
      
      if (currentSongIds.includes(song.id)) {
        toast({
          title: 'Música já adicionada',
          description: 'Esta música já está na playlist'
        });
        return;
      }

      const newSongIds = [...currentSongIds, song.id];

      const { error } = await supabase
        .from('playlists')
        .update({ song_ids: newSongIds })
        .eq('id', selectedPlaylist.id);

      if (error) throw error;

      const updatedPlaylist = { ...selectedPlaylist, song_ids: newSongIds };
      setSelectedPlaylist(updatedPlaylist);
      setEditingPlaylist(updatedPlaylist);
      setPlaylists(playlists.map(p => 
        p.id === selectedPlaylist.id ? { ...p, song_ids: newSongIds } : p
      ));
      setPlaylistSongs([...playlistSongs, { id: song.id, title: song.title, artist_name: song.artist_name, cover_url: song.cover_url }]);

      toast({
        title: 'Música adicionada!',
        description: `"${song.title}" foi adicionada à playlist`
      });
    } catch (error) {
      console.error('Erro ao adicionar música:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível adicionar a música',
        variant: 'destructive'
      });
    }
  };

  const filteredPlaylists = playlists.filter(p =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openEditModal = async (playlist, e) => {
    if (e) e.stopPropagation();
    setEditingPlaylist(playlist);
    setEditForm({
      title: playlist.title,
      description: playlist.description || '',
      isPrivate: !playlist.is_public
    });
    setEditCoverPreview(playlist.cover_url);
    setEditCoverFile(null);
    setEditModalOpen(true);

    // Carregar músicas da playlist
    if (playlist.song_ids && playlist.song_ids.length > 0) {
      const { data: songs } = await supabase
        .from('songs')
        .select('id, title, artist_name, cover_url')
        .in('id', playlist.song_ids);

      if (songs) {
        const orderedSongs = playlist.song_ids
          .map(id => songs.find(s => s.id === id))
          .filter(Boolean);
        setPlaylistSongs(orderedSongs);
      }
    } else {
      setPlaylistSongs([]);
    }
  };

  const handleEditCoverChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setEditCoverFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setEditCoverPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSavePlaylist = async () => {
    if (!editForm.title || editForm.title.length < 5) {
      toast({
        title: 'Erro',
        description: 'O título deve ter no mínimo 5 caracteres',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);

    try {
      let coverUrl = editingPlaylist.cover_url;

      if (editCoverFile) {
        const fileExt = editCoverFile.name.split('.').pop();
        const fileName = `playlists/${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('musica')
          .upload(fileName, editCoverFile, { upsert: true });

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('musica')
            .getPublicUrl(fileName);
          coverUrl = publicUrl;
        }
      }

      const { error } = await supabase
        .from('playlists')
        .update({
          title: editForm.title,
          description: editForm.description,
          cover_url: coverUrl,
          is_public: !editForm.isPrivate
        })
        .eq('id', editingPlaylist.id);

      if (error) throw error;

      toast({
        title: 'Playlist atualizada!',
        description: `"${editForm.title}" foi atualizada`
      });

      setPlaylists(playlists.map(p =>
        p.id === editingPlaylist.id
          ? { ...p, title: editForm.title, description: editForm.description, cover_url: coverUrl, is_public: !editForm.isPrivate }
          : p
      ));

      setEditModalOpen(false);
    } catch (error) {
      console.error('Erro ao atualizar:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar a playlist',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const removeSongFromPlaylist = async (songId) => {
    if (!editingPlaylist) return;

    try {
      const newSongIds = (editingPlaylist.song_ids || []).filter(id => id !== songId);

      const { error } = await supabase
        .from('playlists')
        .update({ song_ids: newSongIds })
        .eq('id', editingPlaylist.id);

      if (error) throw error;

      setEditingPlaylist({ ...editingPlaylist, song_ids: newSongIds });
      setPlaylistSongs(playlistSongs.filter(s => s.id !== songId));
      setPlaylists(playlists.map(p =>
        p.id === editingPlaylist.id ? { ...p, song_ids: newSongIds } : p
      ));

      toast({
        title: 'Música removida',
        description: 'A música foi removida da playlist'
      });
    } catch (error) {
      console.error('Erro ao remover música:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível remover a música',
        variant: 'destructive'
      });
    }
  };

  const handleDeletePlaylist = async () => {
    if (!playlistToDelete) return;

    try {
      const { error } = await supabase
        .from('playlists')
        .delete()
        .eq('id', playlistToDelete.id);

      if (error) throw error;

      toast({
        title: 'Playlist excluída',
        description: `"${playlistToDelete.title}" foi excluída`
      });

      setPlaylists(playlists.filter(p => p.id !== playlistToDelete.id));
      setDeleteDialogOpen(false);
      setPlaylistToDelete(null);
    } catch (error) {
      console.error('Erro ao excluir:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir a playlist',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <LoadingSpinner size="large" text="Carregando..." />
      </div>
    );
  }

  return (
    <div className="bg-gray-50 w-full">
        <div className="max-w-5xl mx-auto p-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <ListMusic className="w-8 h-8 text-red-600" />
              <h1 className="text-3xl font-bold text-gray-900">Minhas Playlists</h1>
            </div>
          </div>

          {/* New Playlist Button */}
          <div className="flex justify-center mb-8">
            <Button
              onClick={() => setCreateModalOpen(true)}
              className="bg-red-600 hover:bg-red-700 text-white rounded-full px-8 py-3"
            >
              <Plus className="w-5 h-5 mr-2" />
              Nova playlist
            </Button>
          </div>

          {/* Toolbar com Pesquisa e Filtros */}
          <div className="flex items-center justify-between mb-6 gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Buscar Playlists"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 rounded-full border-gray-300"
              />
            </div>
            
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm text-gray-700 transition-colors whitespace-nowrap">
                <SlidersHorizontal className="w-4 h-4" />
                Filtros
                <ChevronDown className="w-4 h-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white">
                {orderOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => {
                      setOrderBy(option.value);
                      loadPlaylists();
                    }}
                    className={`cursor-pointer ${
                      orderBy === option.value
                        ? 'bg-red-50 text-red-600 font-medium'
                        : ''
                    }`}
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Playlists List */}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : filteredPlaylists.length === 0 ? (
            <div className="text-center py-12">
              <Music className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">Nenhum Resultado encontrado</h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPlaylists.map(playlist => (
                <Card
                  key={playlist.id}
                  className="p-4 hover:shadow-md transition-shadow cursor-pointer group"
                  onClick={() => openEditModal(playlist)}
                >
                  <div className="flex items-center gap-4">
                    <img
                      src={playlist.cover_url || '/images/default-playlist.jpg'}
                      alt={playlist.title}
                      className="w-16 h-16 rounded object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{playlist.title}</p>
                      <p className="text-sm text-gray-500">
                        {(playlist.song_ids || []).length} músicas
                      </p>
                      {!playlist.is_public && (
                        <span className="text-xs text-red-500">Privada</span>
                      )}
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={(e) => openEditModal(playlist, e)}
                        className="h-8 w-8 border-gray-300 text-gray-600 hover:bg-gray-50"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPlaylistToDelete(playlist);
                          setDeleteDialogOpen(true);
                        }}
                        className="h-8 w-8 border-red-300 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Playlist Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex gap-8 border-b pb-2">
              <button
                onClick={() => setCreateTab('list')}
                className={`font-medium ${createTab === 'list' ? 'text-gray-900' : 'text-gray-400'}`}
              >
                MINHAS PLAYLISTS
              </button>
              <button
                onClick={() => setCreateTab('create')}
                className={`font-medium ${createTab === 'create' ? 'text-red-600' : 'text-gray-400'}`}
              >
                CRIAR PLAYLIST
              </button>
            </div>
          </DialogHeader>

          {createTab === 'create' ? (
            <div className="py-4">
              <div className="flex gap-4 mb-4">
                {/* Cover Upload */}
                <div
                  onClick={() => coverInputRef.current?.click()}
                  className="w-32 h-32 bg-red-500 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-red-600 transition-colors flex-shrink-0"
                >
                  {coverPreview ? (
                    <img src={coverPreview} alt="Capa" className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <>
                      <Music className="w-10 h-10 text-white mb-2" />
                      <span className="text-white text-xs text-center px-2">Adicionar capa da playlist</span>
                    </>
                  )}
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleCoverChange}
                    className="hidden"
                  />
                </div>

                {/* Form */}
                <div className="flex-1 space-y-3">
                  <Input
                    placeholder="Título da playlist"
                    value={newPlaylist.title}
                    onChange={(e) => setNewPlaylist({ ...newPlaylist, title: e.target.value })}
                    maxLength={100}
                  />
                  <p className="text-xs text-gray-500">
                    Mínimo e máximo de caracteres permitidos: 5 a 100<br />
                    Caracteres especiais permitidos: _ # & ( ) [ ]
                  </p>
                  <Textarea
                    placeholder="Descrição"
                    value={newPlaylist.description}
                    onChange={(e) => setNewPlaylist({ ...newPlaylist, description: e.target.value })}
                    rows={3}
                    className="bg-gray-100 border-0"
                  />
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm font-semibold text-gray-700 mb-1">Tamanho máximo da imagem 500x500 px.</p>
                <p className="text-xs text-gray-500">
                  Carregue apenas imagens próprias ou sobre as quais você legalmente detém os direitos.
                </p>
              </div>

              {/* Private Toggle */}
              <div className="flex items-center justify-between mb-6">
                <span className="text-gray-700">Tornar a playlist privada?</span>
                <button
                  onClick={() => setNewPlaylist({ ...newPlaylist, isPrivate: !newPlaylist.isPrivate })}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    newPlaylist.isPrivate ? 'bg-red-600' : 'bg-gray-300'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    newPlaylist.isPrivate ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleCreatePlaylist}
                  disabled={creating}
                  className="bg-red-600 hover:bg-red-700 text-white px-8"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  CRIAR PLAYLIST
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-4 max-h-96 overflow-y-auto">
              {playlists.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Nenhuma playlist criada</p>
              ) : (
                playlists.map(playlist => (
                  <div
                    key={playlist.id}
                    onClick={() => {
                      setSelectedPlaylist(playlist);
                      setCreateModalOpen(false);
                      setAddSongsModalOpen(true);
                    }}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer"
                  >
                    <img
                      src={playlist.cover_url || '/images/default-playlist.jpg'}
                      alt={playlist.title}
                      className="w-12 h-12 rounded object-cover"
                    />
                    <div>
                      <p className="font-medium">{playlist.title}</p>
                      <p className="text-sm text-gray-500">{(playlist.song_ids || []).length} músicas</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Songs Modal */}
      <Dialog open={addSongsModalOpen} onOpenChange={setAddSongsModalOpen}>
        <DialogContent className="max-w-md bg-zinc-900 text-white border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <button onClick={() => {
                if (selectedAlbum) {
                  setSelectedAlbum(null);
                  setAlbumSongs([]);
                } else {
                  setAddSongsModalOpen(false);
                }
              }}>
                ←
              </button>
              {selectedAlbum ? selectedAlbum.title : 'Adicionar a esta playlist'}
            </DialogTitle>
          </DialogHeader>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder="Buscar"
              value={songSearchQuery}
              onChange={(e) => {
                setSongSearchQuery(e.target.value);
                searchAlbums(e.target.value);
              }}
              className="pl-10 bg-zinc-800 border-zinc-700 text-white placeholder-gray-400"
            />
          </div>

          <div className="max-h-96 overflow-y-auto">
            {selectedAlbum ? (
              // Album songs
              <div className="space-y-2">
                {albumSongs.map(song => (
                  <div
                    key={song.id}
                    className="flex items-center gap-3 p-2 hover:bg-zinc-800 rounded"
                  >
                    <img
                      src={song.cover_url || '/placeholder-album.jpg'}
                      alt={song.title}
                      className="w-10 h-10 rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{song.title}</p>
                      <p className="text-xs text-gray-400 truncate">{song.artist_name}</p>
                    </div>
                    <button
                      onClick={() => addSongToPlaylist(song)}
                      className="w-8 h-8 rounded-full border border-gray-500 flex items-center justify-center hover:bg-zinc-700"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : songSearchQuery && searchResults.length > 0 ? (
              // Search results (albums)
              <div className="space-y-2">
                <p className="text-xs text-gray-400 uppercase mb-2">Álbuns encontrados</p>
                {searchResults.map(album => (
                  <div
                    key={album.id}
                    onClick={() => loadAlbumSongs(album)}
                    className="flex items-center gap-3 p-2 hover:bg-zinc-800 rounded cursor-pointer"
                  >
                    <img
                      src={album.cover_url || '/placeholder-album.jpg'}
                      alt={album.title}
                      className="w-10 h-10 rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{album.title}</p>
                      <p className="text-xs text-gray-400 truncate">{album.artist_name}</p>
                    </div>
                    <ChevronDown className="w-4 h-4 -rotate-90" />
                  </div>
                ))}
              </div>
            ) : (
              // Recent albums
              <div className="space-y-2">
                <p className="text-xs text-gray-400 uppercase mb-2">Álbuns recentes</p>
                {recentAlbums.map(album => (
                  <div
                    key={album.id}
                    onClick={() => loadAlbumSongs(album)}
                    className="flex items-center gap-3 p-2 hover:bg-zinc-800 rounded cursor-pointer"
                  >
                    <img
                      src={album.cover_url || '/placeholder-album.jpg'}
                      alt={album.title}
                      className="w-10 h-10 rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{album.title}</p>
                      <p className="text-xs text-gray-400 truncate">{album.artist_name}</p>
                    </div>
                    <ChevronDown className="w-4 h-4 -rotate-90 text-gray-400" />
                  </div>
                ))}

                {recentAlbums.length === 0 && (
                  <div className="text-center py-8">
                    <Music className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400 font-semibold mb-1">Adicione músicas a esta playlist</p>
                    <p className="text-xs text-gray-500">
                      Clique na opção 'Criar/Adicionar' e adicione a música ou um CD as playlists.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Playlist Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Playlist</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <div className="flex gap-4 mb-4">
              {/* Cover Upload */}
              <div
                onClick={() => editCoverInputRef.current?.click()}
                className="w-32 h-32 bg-red-500 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-red-600 transition-colors flex-shrink-0 overflow-hidden"
              >
                {editCoverPreview ? (
                  <img src={editCoverPreview} alt="Capa" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <Music className="w-10 h-10 text-white mb-2" />
                    <span className="text-white text-xs text-center px-2">Alterar capa</span>
                  </>
                )}
                <input
                  ref={editCoverInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleEditCoverChange}
                  className="hidden"
                />
              </div>

              {/* Form */}
              <div className="flex-1 space-y-3">
                <Input
                  placeholder="Título da playlist"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  maxLength={100}
                />
                <Textarea
                  placeholder="Descrição"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                  className="bg-gray-100 border-0"
                />
              </div>
            </div>

            {/* Private Toggle */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-700">Tornar a playlist privada?</span>
              <button
                onClick={() => setEditForm({ ...editForm, isPrivate: !editForm.isPrivate })}
                className={`w-12 h-6 rounded-full transition-colors ${
                  editForm.isPrivate ? 'bg-red-600' : 'bg-gray-300'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  editForm.isPrivate ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            {/* Add songs button */}
            <Button
              onClick={() => {
                setSelectedPlaylist(editingPlaylist);
                setAddSongsModalOpen(true);
              }}
              variant="outline"
              className="w-full mb-4 border-dashed border-2"
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar músicas à playlist
            </Button>

            {/* Songs list */}
            {playlistSongs.length > 0 && (
              <div className="border rounded-lg max-h-48 overflow-y-auto mb-4">
                {playlistSongs.map((song, index) => (
                  <div
                    key={song.id}
                    className="flex items-center gap-3 p-3 border-b last:border-0 hover:bg-gray-50"
                  >
                    <span className="text-gray-500 text-sm w-6">{index + 1}.</span>
                    <img
                      src={song.cover_url || '/placeholder-album.jpg'}
                      alt={song.title}
                      className="w-10 h-10 rounded object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{song.title}</p>
                      <p className="text-xs text-gray-500 truncate">{song.artist_name}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSongFromPlaylist(song.id)}
                      className="h-8 w-8 text-gray-400 hover:text-red-600"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSavePlaylist}
                disabled={saving}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir Playlist</DialogTitle>
          </DialogHeader>
          <p className="text-gray-600 py-4">
            Tem certeza que deseja excluir a playlist "<span className="font-semibold">{playlistToDelete?.title}</span>"? Esta ação não pode ser desfeita.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleDeletePlaylist}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyPlaylists;
