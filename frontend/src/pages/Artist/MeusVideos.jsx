import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { toast } from '../../hooks/use-toast';
import { Play, Video, Trash2, Plus, Copy, Check } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';

const MeusVideos = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [selectedAlbum, setSelectedAlbum] = useState('');
  const [addToProfile, setAddToProfile] = useState(false);
  const [videosProfile, setVideosProfile] = useState([]);
  const [videosAlbum, setVideosAlbum] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [thumbnail, setThumbnail] = useState('');
  const [isLoadingThumbnail, setIsLoadingThumbnail] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const loadData = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Carregar álbuns do artista
      const { data: albumsData } = await supabase
        .from('albums')
        .select('id, title, slug')
        .eq('artist_id', user.id)
        .order('created_at', { ascending: false });

      setAlbums(albumsData || []);

      // Carregar vídeos do perfil (vídeos públicos)
      const { data: profileVideos, error: profileError } = await supabase
        .from('artist_videos')
        .select('*')
        .eq('artist_id', user.id)
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (!profileError) {
        setVideosProfile(profileVideos || []);
      }

      // Carregar vídeos do CD (vídeos que têm album_id)
      const { data: albumVideos, error: albumError } = await supabase
        .from('artist_videos')
        .select('*')
        .eq('artist_id', user.id)
        .not('album_id', 'is', null)
        .order('created_at', { ascending: false });

      if (!albumError) {
        setVideosAlbum(albumVideos || []);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar os dados',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getYouTubeVideoId = (url) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const getYouTubeThumbnail = (videoId) => {
    return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  };

  const getYouTubeTitle = async (url) => {
    try {
      const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
      if (response.ok) {
        const data = await response.json();
        return data.title || '';
      }
    } catch (error) {
      console.log('Erro ao buscar título do YouTube:', error);
    }
    return '';
  };

  const handleUrlChange = async (e) => {
    const url = e.target.value;
    setVideoUrl(url);

    if (url) {
      setIsLoadingThumbnail(true);
      const videoId = getYouTubeVideoId(url);
      
      if (videoId) {
        setThumbnail(getYouTubeThumbnail(videoId));
        const title = await getYouTubeTitle(url);
        if (title && !videoTitle) {
          setVideoTitle(title);
        }
      }
      setIsLoadingThumbnail(false);
    }
  };

  const handleAddVideo = async () => {
    if (!videoUrl || !videoTitle) {
      toast({
        title: 'Erro',
        description: 'Preencha a URL e o título do vídeo',
        variant: 'destructive'
      });
      return;
    }

    const videoId = getYouTubeVideoId(videoUrl);
    if (!videoId) {
      toast({
        title: 'Erro',
        description: 'URL do YouTube inválida',
        variant: 'destructive'
      });
      return;
    }

    // Se selecionou um CD, o vídeo vai para "Vídeos no CD"
    // Se marcou "Adicionar ao perfil", o vídeo vai para "Vídeos no Perfil"
    // Não podem ser ambos simultaneamente
    const isForAlbum = !!selectedAlbum;
    const isForProfile = addToProfile && !selectedAlbum;

    try {
      const { data, error } = await supabase
        .from('artist_videos')
        .insert({
          artist_id: user.id,
          video_url: videoUrl,
          video_id: videoId,
          title: videoTitle,
          thumbnail: thumbnail,
          album_id: isForAlbum ? selectedAlbum : null,
          is_public: isForProfile,
          created_at: new Date().toISOString()
        })
        .select();

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: isForAlbum 
          ? 'Vídeo adicionado ao CD com sucesso'
          : 'Vídeo adicionado ao seu perfil com sucesso'
      });

      // Reset form
      setVideoUrl('');
      setVideoTitle('');
      setSelectedAlbum('');
      setAddToProfile(false);
      setThumbnail('');

      // Reload videos
      loadData();
    } catch (error) {
      console.error('Erro ao adicionar vídeo:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao adicionar vídeo',
        variant: 'destructive'
      });
    }
  };

  const handleRemoveVideo = async (videoId) => {
    try {
      const { error } = await supabase
        .from('artist_videos')
        .delete()
        .eq('id', videoId)
        .eq('artist_id', user.id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Vídeo removido com sucesso'
      });

      loadData();
    } catch (error) {
      console.error('Erro ao remover vídeo:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao remover vídeo',
        variant: 'destructive'
      });
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
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
        <div className="max-w-6xl mx-auto p-4 md:p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
              <Play className="w-8 h-8 text-red-600" />
              Meus Vídeos
            </h1>
            <p className="text-gray-600">Adicione e gerencie seus vídeos do YouTube</p>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Form Section */}
              <div className="bg-white rounded-lg p-4 md:p-8 border border-gray-200">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Adicionar Novo Vídeo</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {/* Preview */}
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">PREVIEW DO VÍDEO</h3>
                    <div className="bg-gray-200 rounded-lg w-full h-48 flex items-center justify-center overflow-hidden">
                      {thumbnail ? (
                        <img src={thumbnail} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <Video className="w-12 h-12 text-gray-400" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      A imagem preview do vídeo é inserida automaticamente :)
                    </p>
                  </div>

                  {/* Form Fields */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Link do vídeo (Ex: https://youtu.be/EPquJPEilnPI)
                      </label>
                      <Input
                        type="text"
                        value={videoUrl}
                        onChange={handleUrlChange}
                        placeholder="https://youtube.com/watch?v=..."
                        className="border-gray-300"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Título do vídeo (O título do vídeo é inserido automaticamente)
                      </label>
                      <Input
                        type="text"
                        value={videoTitle}
                        onChange={(e) => setVideoTitle(e.target.value)}
                        placeholder="Título do vídeo"
                        className="border-gray-300"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Selecione o CD
                      </label>
                      <select
                        value={selectedAlbum}
                        onChange={(e) => setSelectedAlbum(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                      >
                        <option value="">Nenhum CD</option>
                        {albums.map((album) => (
                          <option key={album.id} value={album.id}>
                            {album.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Checkbox and Button */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="addToProfile"
                      checked={addToProfile}
                      onChange={(e) => setAddToProfile(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-red-600 cursor-pointer"
                    />
                    <label htmlFor="addToProfile" className="text-sm text-gray-700 cursor-pointer">
                      Adicionar vídeo ao meu perfil
                    </label>
                  </div>
                  <Button
                    onClick={handleAddVideo}
                    disabled={isLoadingThumbnail}
                    className="bg-red-600 hover:bg-red-700 text-white rounded-full px-6 md:px-8 h-10 font-semibold w-full sm:w-auto"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    ADICIONAR VÍDEO
                  </Button>
                </div>
              </div>

              {/* Videos Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Vídeos no CD */}
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Vídeos no CD</h3>
                  <div className="space-y-3">
                    {videosAlbum.length === 0 ? (
                      <p className="text-gray-500 text-sm">Nenhum vídeo adicionado a CDs</p>
                    ) : (
                      videosAlbum.map((video) => (
                           <div
                             key={video.id}
                             className="bg-white rounded-lg p-4 border border-gray-200 hover:border-red-600 transition-colors flex gap-4"
                           >
                             <img
                               src={video.thumbnail || getYouTubeThumbnail(video.video_id)}
                               alt={video.title}
                               className="w-24 h-16 rounded object-cover flex-shrink-0"
                             />
                             <div className="flex-1 min-w-0">
                               <h4 className="font-semibold text-gray-900 text-sm mb-2 truncate">
                                 {video.title}
                               </h4>
                               <div className="text-xs text-gray-500 mb-3 break-all">
                                 <div className="flex items-center justify-between gap-2">
                                   <span className="truncate">{video.video_url}</span>
                                   <button
                                     onClick={() => copyToClipboard(video.video_url)}
                                     className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                                   >
                                     {copiedId === video.video_url ? (
                                       <Check className="w-4 h-4 text-green-600" />
                                     ) : (
                                       <Copy className="w-4 h-4" />
                                     )}
                                   </button>
                                 </div>
                               </div>
                               <button
                                 onClick={() => handleRemoveVideo(video.id)}
                                 className="text-xs text-red-600 hover:bg-red-50 py-2 px-3 rounded transition-colors flex items-center gap-1 font-medium"
                               >
                                 <Trash2 className="w-4 h-4" />
                                 Remover
                               </button>
                             </div>
                           </div>
                         ))
                    )}
                  </div>
                </div>

                {/* Vídeos no Perfil */}
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Vídeos no Perfil</h3>
                  <div className="space-y-3">
                    {videosProfile.length === 0 ? (
                      <p className="text-gray-500 text-sm">Nenhum vídeo no seu perfil</p>
                    ) : (
                      videosProfile.map((video) => (
                         <div
                           key={video.id}
                           className="bg-white rounded-lg p-4 border border-gray-200 hover:border-red-600 transition-colors flex gap-4"
                         >
                           <img
                             src={video.thumbnail || getYouTubeThumbnail(video.video_id)}
                             alt={video.title}
                             className="w-24 h-16 rounded object-cover flex-shrink-0"
                           />
                           <div className="flex-1 min-w-0">
                             <h4 className="font-semibold text-gray-900 text-sm mb-2 truncate">
                               {video.title}
                             </h4>
                             <div className="text-xs text-gray-500 mb-3 break-all">
                               <div className="flex items-center justify-between gap-2">
                                 <span className="truncate">{video.video_url}</span>
                                 <button
                                   onClick={() => copyToClipboard(video.video_url)}
                                   className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                                 >
                                   {copiedId === video.video_url ? (
                                     <Check className="w-4 h-4 text-green-600" />
                                   ) : (
                                     <Copy className="w-4 h-4" />
                                   )}
                                 </button>
                               </div>
                             </div>
                             <button
                               onClick={() => handleRemoveVideo(video.id)}
                               className="text-xs text-red-600 hover:bg-red-50 py-2 px-3 rounded transition-colors flex items-center gap-1 font-medium"
                             >
                               <Trash2 className="w-4 h-4" />
                               Remover
                             </button>
                           </div>
                         </div>
                       ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MeusVideos;
