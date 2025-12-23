import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { mockAlbums, mockSongs, formatDuration } from '../mock';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { useTrackPageView } from '../hooks/useTrackPageView';
import { useCapacitorDownloads } from '../hooks/useCapacitorDownloads';
import { recordAlbumDownload } from '../lib/statsHelper';
import { handleDownload, isMobileApp } from '../lib/downloadHelper';
import { Play, Heart, Share2, Download, Plus, BadgeCheck, Copy, X, Disc, ThumbsUp, Video } from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from '../hooks/use-toast';
import AlbumSongRow from '../components/AlbumSongRow';
import DownloadProgressModal from '../components/DownloadProgressModal';
import SEO from '../components/SEO';

import LoadingSpinner from '../components/LoadingSpinner';
import { Http } from '@capacitor-community/http';
import { Filesystem, Directory, FilesystemDirectory } from '@capacitor/filesystem';

// Lazy load do CommentSection
const CommentSection = lazy(() => import('../components/CommentSection'));
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '../components/ui/popover';

const AlbumPage = () => {
     useTrackPageView('album');
     const { artistSlug, albumSlug } = useParams();
     const navigate = useNavigate();
     const { playSong, currentSong, isPlaying, togglePlay, setIsFullPlayerOpen } = usePlayer();
     const { user, isPremium } = useAuth();
     const { downloadAlbum, downloadProgress: hookDownloadProgress, isAlbumDownloaded } = useCapacitorDownloads((downloadInfo) => {
        if (downloadInfo) {
            setCurrentDownloadSong(downloadInfo.song);
            setCurrentDownloadIndex(downloadInfo.index);
            const progress = (downloadInfo.index / downloadInfo.total) * 100;
            setLocalDownloadProgress(progress);
        }
     });
     const [isFavorite, setIsFavorite] = useState(false);
     const [album, setAlbum] = useState(null);
     const [albumSongs, setAlbumSongs] = useState([]);
     const [artist, setArtist] = useState(null);
     const [collaborators, setCollaborators] = useState([]);
     const [loading, setLoading] = useState(true);
     const [notFound, setNotFound] = useState(false);
     const [imageError, setImageError] = useState(false);
     const [recommendedAlbums, setRecommendedAlbums] = useState([]);
     const [albumVideo, setAlbumVideo] = useState(null);
     const [showMobilePlayer, setShowMobilePlayer] = useState(false);
       const [currentSongFavorite, setCurrentSongFavorite] = useState(false);
       const [downloadInProgress, setDownloadInProgress] = useState(false);
       const [downloadStatus, setDownloadStatus] = useState('preparing'); // 'preparing', 'downloading', 'completed', 'error'
       const [localDownloadProgress, setLocalDownloadProgress] = useState(0);
       const [downloadModalOpen, setDownloadModalOpen] = useState(false);
       const [downloadErrorMessage, setDownloadErrorMessage] = useState('');
       const [currentDownloadSong, setCurrentDownloadSong] = useState('');
       const [currentDownloadIndex, setCurrentDownloadIndex] = useState(0);

    useEffect(() => {
        let isMounted = true; // Flag para evitar state updates após unmount
        
        const loadAlbum = async () => {
            // Resetar states ao carregar novo álbum
            if (!isMounted) return;
            
            try {
                setLoading(true);
                setNotFound(false);
                setRecommendedAlbums([]);
                setAlbumSongs([]);
                setAlbum(null);
                setArtist(null);
                setCollaborators([]);
                setAlbumVideo(null);
                setIsFavorite(false);
                setImageError(false);
                setDownloadInProgress(false);
                
                // Verificar se artistSlug é um artista válido (não aceita "album" como slug)
                if (artistSlug === 'album') {
                    if (isMounted) {
                        setNotFound(true);
                        setLoading(false);
                    }
                    return;
                }

            // Buscar álbum primeiro (mais importante)
            let { data: supabaseAlbum } = await supabase
                .from('albums')
                .select('*')
                .eq('slug', albumSlug)
                .is('deleted_at', null)  // Excluir álbuns deletados
                .maybeSingle();

            // Se não encontrar por slug, tenta por ID do álbum
            if (!supabaseAlbum) {
                const { data: albumById } = await supabase
                    .from('albums')
                    .select('*')
                    .eq('id', albumSlug)
                    .is('deleted_at', null)  // Excluir álbuns deletados
                    .maybeSingle();
                supabaseAlbum = albumById;
            }
            
            if (!supabaseAlbum) {
                if (isMounted) {
                    setNotFound(true);
                    setLoading(false);
                }
                return;
            }
             
            // Buscar artista em paralelo enquanto processa o álbum
            const artistPromise = (async () => {
                let { data: artistData, error: slugError } = await supabase
                    .from('artists')
                    .select('id, name, slug, avatar_url, cover_url, verified, bio, followers_count')
                    .eq('slug', artistSlug)
                    .maybeSingle();
                
                if (slugError) {
                    console.error('Artist slug query error:', slugError);
                }
            
                // Se não encontrar por slug, tenta por ID
                if (!artistData) {
                    const { data: artistById, error: idError } = await supabase
                        .from('artists')
                        .select('id, name, slug, avatar_url, cover_url, verified, bio, followers_count')
                        .eq('id', artistSlug)
                        .maybeSingle();
                    if (idError) {
                        console.error('Artist ID query error:', idError);
                    }
                    artistData = artistById;
                }
                
                console.log('Artist data loaded:', {
                    slug: artistSlug,
                    artist: artistData?.name,
                    avatar_url: artistData?.avatar_url,
                    verified: artistData?.verified
                });
                
                return artistData;
            })();

            // Buscar músicas enquanto busca artista
            const songsPromise = (async () => {
                // Primeiro, tentar com album_id
                let result = await supabase
                    .from('songs')
                    .select('*')
                    .eq('album_id', supabaseAlbum.id)
                    .order('track_number', { ascending: true });
                
                console.log('Songs query with album_id filter:', {
                    albumId: supabaseAlbum.id,
                    count: result.data?.length,
                    error: result.error,
                    firstSong: result.data?.[0]
                });
                
                // Se nenhuma música encontrada, tentar get ALL songs para debug
                if (!result.data || result.data.length === 0) {
                    console.log('Nenhuma música com album_id. Listando TODAS as músicas para debug...');
                    let allSongs = await supabase
                        .from('songs')
                        .select('id, album_id, title, artist_id')
                        .limit(5);
                    
                    console.log('Amostra de todas as músicas:', {
                        count: allSongs.data?.length,
                        songs: allSongs.data
                    });
                }
                
                return result;
            })();

            // Aguardar artista e músicas em paralelo
            let artistData, songsResult;
            try {
                [artistData, songsResult] = await Promise.all([artistPromise, songsPromise]);
                console.log('Promise.all resolved:', {
                    artistData: !!artistData,
                    songsResult: songsResult
                });
            } catch (error) {
                console.error('⚠️ Erro em Promise.all (não crítico):', error);
                // Continuar mesmo com erro - tentar carregar o que foi possível
                artistData = artistData || null;
                songsResult = songsResult || { data: [], error };
            }

            // Log para debugging
            console.log('Album loading:', {
                albumId: supabaseAlbum.id,
                isPrivate: supabaseAlbum.is_private,
                artistId: supabaseAlbum.artist_id,
                userId: user?.id,
                artistFound: !!artistData,
                artistData: artistData,
                avatar_url: artistData?.avatar_url,
                profile_image: artistData?.profile_image
            });

            if (!artistData) {
                console.warn('Artista não encontrado, mas prosseguindo com álbum');
            }
            
            // Verificar se o álbum é privado e o usuário não é o dono (admin pode ver tudo)
            if (supabaseAlbum.is_private && user?.id !== supabaseAlbum.artist_id && !user?.isAdmin) {
                if (isMounted) {
                    console.warn('Álbum privado e usuário não é o dono');
                    setNotFound(true);
                    setLoading(false);
                }
                return;
            }
            
            if (!isMounted) return;
              // Usar dados do artista se encontrado, senão usar dados do álbum
              setArtist(artistData || { id: supabaseAlbum.artist_id, name: supabaseAlbum.artist_name });

              setAlbum({
                  id: supabaseAlbum.id,
                  slug: supabaseAlbum.slug,
                  title: supabaseAlbum.title,
                  artistName: supabaseAlbum.artist_name,
                  artistId: supabaseAlbum.artist_id,
                  coverImage: supabaseAlbum.cover_url || '/images/default-album.png',
                  releaseYear: supabaseAlbum.release_year,
                  description: supabaseAlbum.description,
                  genre: supabaseAlbum.genre,
                  archiveUrl: supabaseAlbum.archive_url,
                  download_count: supabaseAlbum.download_count || 0,
                  play_count: supabaseAlbum.play_count || 0
              });

              // Fazer o resto em paralelo (menos crítico)
              const [videoResult, collabResult, favResult, recommendedResult] = await Promise.all([
                  // Buscar vídeo
                  supabase
                      .from('artist_videos')
                      .select('id, title, video_url, video_id, thumbnail')
                      .eq('album_id', supabaseAlbum.id)
                      .maybeSingle(),
                  
                  // Buscar colaboradores
                  supabase
                      .from('collaboration_invites')
                      .select('invited_user_id')
                      .eq('album_id', supabaseAlbum.id)
                      .eq('status', 'accepted'),
                  
                  // Buscar favorito
                  user?.id ? supabase
                      .from('album_favorites')
                      .select('id')
                      .eq('user_id', user.id)
                      .eq('album_id', supabaseAlbum.id)
                      .maybeSingle() : Promise.resolve({ data: null }),
                  
                  // Buscar recomendados (sem relação com artists)
                  supabase
                      .from('albums')
                      .select('id, slug, title, artist_name, artist_id, cover_url, play_count, genre')
                      .eq('is_private', false)
                      .is('deleted_at', null)
                      .neq('id', supabaseAlbum.id)
                      .order('play_count', { ascending: false })
                      .limit(30)
              ]);

              // Processar músicas
              const { data: songs, error: songsError } = songsResult;
              console.log('Songs query result:', {
                  albumId: supabaseAlbum.id,
                  songsCount: songs?.length,
                  error: songsError,
                  songs: songs
              });
              
              if (songsError) {
                  console.error('Erro ao carregar músicas:', songsError);
              }
              if (songs && songs.length > 0) {
                  const processedSongs = songs.map(song => {
                      // Garantir que a URL de áudio está completa
                      let audioUrl = song.audio_url;
                      
                      // Se a URL é relativa (começa com 'songs/' ou similar), construir URL completa do Supabase
                      if (audioUrl && !audioUrl.startsWith('http')) {
                          const SUPABASE_URL = 'https://rtdxqthhhwqnlrevzmap.supabase.co';
                          audioUrl = `${SUPABASE_URL}/storage/v1/object/public/${audioUrl}`;
                      }
                      
                      return {
                          id: song.id,
                          title: song.title,
                          artistName: song.artist_name,
                          artistId: song.artist_id,
                          artistSlug: artistData?.slug,
                          albumId: song.album_id,
                          albumSlug: supabaseAlbum.slug,
                          albumName: song.album_name,
                          coverImage: song.cover_url || supabaseAlbum.cover_url || '/images/default-album.png',
                          audioUrl: audioUrl,
                          duration: song.duration || 0,
                          trackNumber: song.track_number,
                          composer: song.composer,
                          isrc: song.isrc
                      };
                  });
                  setAlbumSongs(processedSongs);
                  console.log(`Carregadas ${processedSongs.length} músicas`);
                  // Debug: mostrar URLs de áudio
                  console.log('URLs de áudio das músicas:', processedSongs.map(s => ({ title: s.title, audioUrl: s.audioUrl?.substring(0, 80) + '...' })));
              } else {
                  console.warn('Nenhuma música encontrada para o álbum', {
                      albumId: supabaseAlbum.id,
                      songs: songs
                  });
                  setAlbumSongs([]);
              }

             // Processar vídeo
             const { data: videoData } = videoResult;
             if (videoData) {
                 setAlbumVideo({
                     id: videoData.id,
                     title: videoData.title,
                     url: videoData.video_url,
                     videoId: videoData.video_id,
                     thumbnail: videoData.thumbnail
                 });
             }

             // Processar colaboradores
             const { data: collabData } = collabResult;
             if (collabData && collabData.length > 0) {
                 const collabIds = collabData.map(c => c.invited_user_id);
                 const { data: collabArtists } = await supabase
                     .from('artists')
                     .select('id, name, slug, avatar_url, is_verified')
                     .in('id', collabIds);
             
                 if (collabArtists) {
                     setCollaborators(collabArtists);
                 }
             }

             // Processar favorito
             const { data: favoriteAlbum } = favResult;
             setIsFavorite(!!favoriteAlbum);

             // Processar recomendados
             const { data: allAlbums } = recommendedResult;
             let recommendedList = [];
             
             if (allAlbums && allAlbums.length > 0) {
                 // Filtrar por gênero primeiro
                 const sameGenreAlbums = allAlbums.filter(a => a.genre === supabaseAlbum.genre);
                 
                 if (sameGenreAlbums.length > 0) {
                     // Se tem do mesmo gênero, usar esses
                     recommendedList = sameGenreAlbums.slice(0, 6);
                 } else {
                     // Se não, usar os mais ouvidos geral
                     recommendedList = allAlbums.slice(0, 6);
                 }
             }

             if (recommendedList.length > 0) {
                 // Garantir que nunca ultrapasse 6 álbuns
                 const recommended = recommendedList
                     .slice(0, 6)
                     .map(recAlbum => {
                         return {
                             id: recAlbum.id,
                             slug: recAlbum.slug,
                             title: recAlbum.title,
                             artistName: recAlbum.artist_name,
                             artistId: recAlbum.artist_id,
                             coverImage: recAlbum.cover_url || '/images/default-album.png',
                             playCount: recAlbum.play_count || 0,
                             downloadCount: recAlbum.download_count || 0,
                             artistSlug: recAlbum.artist_id, // Usar artist_id como slug
                             artistVerified: false,
                             collaborators: []
                         };
                     });
                 setRecommendedAlbums(recommended);
             } else {
                 // Garantir que está vazio se não houver recomendados
                 setRecommendedAlbums([]);
             }

             if (isMounted) {
                 setLoading(false);
             }
            } catch (error) {
                console.error('❌ Erro ao carregar álbum:', error);
                if (isMounted) {
                    setLoading(false);
                    setNotFound(true);
                }
            }
            };

            loadAlbum();
            
            // Cleanup function para evitar memory leaks
            return () => {
            isMounted = false;
            };
            }, [artistSlug, albumSlug]);

            // Controlar visibilidade do player global
            useEffect(() => {
            setIsFullPlayerOpen(showMobilePlayer);
            }, [showMobilePlayer, setIsFullPlayerOpen]);

            if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <LoadingSpinner size="medium" text="Carregando álbum..." />
            </div>
        );
    }

    if (notFound || !album) {
        return (
            <div className="fixed inset-0 top-16 bg-white flex flex-col items-center justify-center pb-32">
                <div className="relative mb-6">
                    <div className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center">
                        <Disc className="w-12 h-12 text-red-600" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-red-600 flex items-center justify-center">
                        <X className="w-5 h-5 text-white" />
                    </div>
                </div>
                <p className="text-gray-900 text-2xl font-bold mb-2">Álbum não encontrado</p>
                <p className="text-gray-500 mb-6">O álbum que você procura não existe ou foi removido.</p>
                <Link to="/">
                    <Button className="bg-red-600 hover:bg-red-700 text-white">
                        Voltar para Home
                    </Button>
                </Link>
            </div>
        );
    }

    const handlePlayAlbum = async () => {
        if (albumSongs.length > 0) {
            const isMobile = window.innerWidth < 768;
            
            playSong(albumSongs[0], albumSongs);
            
            // Abrir player mobile imediatamente em dispositivos móveis
            if (isMobile) {
                setTimeout(() => {
                    setShowMobilePlayer(true);
                }, 0);
            }

            // Incrementar play_count
            if (album.id) {
                const { error } = await supabase.rpc('increment_play_count', { album_id: album.id });
                if (!error) {
                    setAlbum(prev => ({ ...prev, play_count: (prev.play_count || 0) + 1 }));
                } else {
                    // Fallback: update direto
                    await supabase
                        .from('albums')
                        .update({ play_count: (album.play_count || 0) + 1 })
                        .eq('id', album.id);
                    setAlbum(prev => ({ ...prev, play_count: (prev.play_count || 0) + 1 }));
                }
            }
        }
    };

    const handleDownloadAlbum = async () => {
        if (!album || !album.id) {
            console.error('❌ Album ou Album ID não disponível');
            toast({
                title: 'Erro',
                description: 'Informações do álbum não disponíveis',
                variant: 'destructive'
            });
            return;
        }

        if (!albumSongs || albumSongs.length === 0) {
            console.error('❌ Nenhuma música encontrada no álbum');
            toast({
                title: 'Erro',
                description: 'Nenhuma música encontrada neste álbum',
                variant: 'destructive'
            });
            return;
        }

        setDownloadInProgress(true);
        setDownloadModalOpen(true);
        setDownloadStatus('preparing');
        setLocalDownloadProgress(0);
        
        try {
            // Registrar download imediatamente
            const songIds = albumSongs.map(s => s?.id).filter(Boolean);
            if (songIds.length > 0) {
                recordAlbumDownload(album.id, songIds);
            }
            setAlbum(prev => prev ? { ...prev, download_count: (prev.download_count || 0) + 1 } : prev);

            // Progresso de preparação mais gradual e realista
            let preparingProgress = 0;
            const preparingInterval = setInterval(() => {
                // Incremento menor e mais gradual (máximo 5% por vez)
                const increment = Math.random() * 3 + 1; // Entre 1% e 4%
                preparingProgress += increment;
                
                // Limitar a 30% durante preparação (o resto vem do download real)
                if (preparingProgress >= 30) {
                    preparingProgress = 30;
                    clearInterval(preparingInterval);
                }
                setLocalDownloadProgress(preparingProgress);
            }, 300);

            // Usar handleDownload para detectar plataforma
            await handleDownload({
                album,
                albumSongs,
                onDesktop: async () => {
                    // Desktop: download ZIP/RAR
                    let downloadUrl = album.archiveUrl;
                    if (!downloadUrl) {
                        const API_URL = process.env.REACT_APP_API_URL || '';
                        downloadUrl = `${API_URL}/api/albums/${album.id}/download`;
                    }

                    clearInterval(preparingInterval);
                    setDownloadStatus('downloading');
                    setLocalDownloadProgress(35); // Começar de 35% após preparação

                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 300000);
                    
                    try {
                        const response = await fetch(downloadUrl, {
                            signal: controller.signal
                        });
                        
                        clearTimeout(timeoutId);
                        
                        if (!response.ok) {
                            throw new Error(`Erro HTTP: ${response.status}`);
                        }

                        // Progresso do download com base no tamanho
                        const contentLength = response.headers.get('content-length');
                        if (contentLength) {
                            let receivedLength = 0;
                            const reader = response.body.getReader();
                            const chunks = [];

                            while (true) {
                                const { done, value } = await reader.read();
                                if (done) break;
                                chunks.push(value);
                                receivedLength += value.length;
                                const progress = 90 + (receivedLength / contentLength) * 10;
                                setLocalDownloadProgress(Math.min(progress, 99));
                            }

                            const blob = new Blob(chunks);
                            const extension = downloadUrl.includes('.rar') ? 'rar' : 'zip';
                            const filename = `${album.title}.${extension}`;
                            
                            const url = window.URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = filename;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            window.URL.revokeObjectURL(url);
                        } else {
                            // Se não houver content-length, faz o download normal
                            const blob = await response.blob();
                            const extension = downloadUrl.includes('.rar') ? 'rar' : 'zip';
                            const filename = `${album.title}.${extension}`;
                            
                            const url = window.URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = filename;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            window.URL.revokeObjectURL(url);
                        }

                        setLocalDownloadProgress(100);
                        setDownloadStatus('completed');
                        setDownloadInProgress(false); // Reset ao completar
                    } catch (fetchError) {
                        clearTimeout(timeoutId);
                        throw fetchError;
                    }
                },
                onMobile: async ({ album: albumData, albumSongs: songs, onProgress }) => {
                    // Mobile: baixar sempre os MP3s individuais, ignorando ZIP
                    clearInterval(preparingInterval);
                    setDownloadStatus('downloading');
                    
                    // Log das músicas para debug
                    console.log('🎵 Músicas para download:', songs.length);
                    songs.forEach((s, i) => {
                        console.log(`   ${i + 1}. ${s.title} - URL: ${s.audioUrl ? 'OK' : 'VAZIA'}`);
                    });
                    
                    // Garantir que todas as músicas têm URLs completas
                    const SUPABASE_URL = 'https://rtdxqthhhwqnlrevzmap.supabase.co';
                    const songsWithUrls = songs.map(song => {
                        let audioUrl = song.audioUrl || song.audio_url || song.url;
                        
                        // Se a URL é relativa, construir URL completa
                        if (audioUrl && !audioUrl.startsWith('http')) {
                            audioUrl = `${SUPABASE_URL}/storage/v1/object/public/${audioUrl}`;
                        }
                        
                        return {
                            ...song,
                            audioUrl: audioUrl
                        };
                    });
                    
                    try {
                        const result = await downloadAlbum(albumData, songsWithUrls);
                        setLocalDownloadProgress(100);
                        setDownloadStatus('completed');
                        return result;
                    } catch (error) {
                        console.error('❌ Erro no download mobile:', error);
                        let errorMsg = error?.message || 'Falha ao baixar. Verifique sua conexão e espaço disponível no celular.';
                        if (error?.debugLogs && error.debugLogs.length > 0) {
                            const lastLog = error.debugLogs[error.debugLogs.length - 1];
                            if (lastLog && !errorMsg.includes(lastLog)) {
                                errorMsg = `${errorMsg}\n\nÚltimo log: ${lastLog}`;
                            }
                        }
                        setDownloadErrorMessage(errorMsg);
                        setDownloadStatus('error');
                        throw error;
                    }
                }
            });

        } catch (error) {
            console.error('Download error:', error);
            setDownloadInProgress(false);
            
            // Se é mobile (Capacitor), mostrar modal com erro
            // Se é desktop, mostrar toast
            const isMobile = window.Capacitor?.isNativePlatform?.() || 
                           (window.Capacitor && window.Capacitor.getPlatform?.() !== 'web');
            
            const errorMsg = error?.message || 'Falha ao baixar. Verifique sua conexão e espaço disponível no celular.';
            
            if (isMobile) {
                // Mobile: mostrar modal com erro
                setDownloadErrorMessage(errorMsg);
                setDownloadStatus('error');
                // Modal já está aberto, só muda o status
            } else {
                // Desktop: fechar modal e mostrar toast
                setDownloadModalOpen(false);
                toast({
                    title: '❌ Erro no Download',
                    description: errorMsg,
                    variant: 'destructive'
                });
            }
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

        if (!album || !album.id) {
            console.error('❌ Album não disponível');
            toast({
                title: 'Erro',
                description: 'Informações do álbum não disponíveis',
                variant: 'destructive'
            });
            return;
        }

        try {
            if (isFavorite) {
                // Remover dos favoritos
                const { error } = await supabase
                    .from('album_favorites')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('album_id', album.id);

                if (error) throw error;
                
                setIsFavorite(false);
                toast({
                    title: 'Removido dos favoritos',
                    description: album.title || 'Álbum'
                });
            } else {
                // Adicionar aos favoritos
                const { error } = await supabase
                    .from('album_favorites')
                    .insert([
                        {
                            user_id: user.id,
                            album_id: album.id,
                            created_at: new Date().toISOString()
                        }
                    ]);

                if (error) throw error;
                
                setIsFavorite(true);
                toast({
                    title: 'Adicionado aos favoritos',
                    description: album.title || 'Álbum'
                });
            }
        } catch (error) {
            console.error('❌ Erro ao favoritar album:', error);
            toast({
                title: 'Erro',
                description: 'Não foi possível favoritar o álbum',
                variant: 'destructive'
            });
        }
    };

    const formatDurationLocal = (seconds) => {
        if (!seconds) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${String(secs).padStart(2, '0')}`;
    };

    const handleMobilePlayerToggle = (song) => {
        // Verificar se é mobile
        const isMobile = window.innerWidth < 768;
        if (isMobile) {
            playSong(song, albumSongs);
            // Usar setTimeout para garantir que o state seja atualizado após o song ser tocado
            setTimeout(() => {
                setShowMobilePlayer(true);
            }, 0);
        } else {
            // Em desktop, apenas tocar a música
            playSong(song, albumSongs);
        }
    };

    const handleCurrentSongFavorite = async () => {
        if (!user) {
            toast({
                title: 'Login Necessário',
                description: 'Faça login para favoritar músicas'
            });
            return;
        }

        try {
            // Toggle favorite - aqui você pode implementar a lógica real
            setCurrentSongFavorite(!currentSongFavorite);
            toast({
                title: currentSongFavorite ? 'Removido dos favoritos' : 'Adicionado aos favoritos',
                description: currentSong?.title
            });
        } catch (error) {
            console.error('Erro ao favoritar:', error);
        }
    };

    return (
        <>
            {/* SEO Meta Tags para compartilhamento em redes sociais */}
            {album && artist && (
                <SEO
                    title={`${album.title} - ${album.genre ? album.genre.charAt(0).toUpperCase() + album.genre.slice(1) : 'Música'}`}
                    description={`Clique agora para baixar e ouvir grátis ${album.title} postado por ${artist?.name || 'Artista'}. ${albumSongs.length} música${albumSongs.length !== 1 ? 's' : ''} disponíveis no Ouça Aqui!`}
                    image={album.coverImage || album.cover_url}
                    url={window.location.href}
                    type="music.album"
                />
            )}
            <div className="min-h-screen bg-white pb-32">
            {/* Album Header */}
            <div className="relative bg-gradient-to-b from-red-900 to-black pt-6 md:pt-20 pb-4 md:pb-8">
                <div className="max-w-7xl mx-auto px-4">
                    {/* Desktop Layout */}
                    <div className="hidden md:flex items-end gap-8">
                         <div
                            className="relative w-64 h-64 group cursor-pointer"
                            onClick={handlePlayAlbum}
                        >
                            <img
                                src={imageError ? '/images/default-album.png' : album.coverImage}
                                alt={album.title}
                                loading="eager"
                                className="w-full h-full rounded-lg shadow-2xl object-cover"
                                onError={() => {
                                    console.error('Erro ao carregar imagem:', album.coverImage);
                                    setImageError(true);
                                }}
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-300 rounded-lg flex items-center justify-center">
                                <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-lg">
                                    <Play className="w-8 h-8 text-white ml-1" fill="white" />
                                </div>
                            </div>
                        </div>
                        <div className="text-white pb-4 flex flex-col justify-between h-56">
                            <div>
                                <p className="text-sm uppercase tracking-wider mb-2">Álbum</p>
                                <h1 className="text-3xl font-bold mb-2 max-w-xl">{album.title}</h1>
                                {album.description && (
                                    <p className="text-gray-300 text-sm max-w-xl leading-relaxed">
                                        <span className="text-gray-400">Descrição:</span> {album.description.length > 150 ? `${album.description.slice(0, 150)}...` : album.description}
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                 {/* Fotos sobrepostas em diagonal */}
                                <div className="flex items-center mr-2" style={{ marginLeft: collaborators.length > 0 ? '4px' : '0' }}>
                                    <Link to={`/${artist?.slug || artistSlug}`} className="hover:z-20 relative z-10" style={{ marginBottom: collaborators.length > 0 ? '8px' : '0' }}>
                                        <img
                                            src={artist?.avatar_url || artist?.cover_url || '/images/default-avatar.png'}
                                            alt={album.artistName}
                                            className="w-8 h-8 rounded-full object-cover border-2 border-white"
                                            onError={(e) => {
                                                console.warn('Avatar failed to load:', {
                                                    src: e.target.src,
                                                    artistId: artist?.id,
                                                    avatar_url: artist?.avatar_url,
                                                    profile_image: artist?.profile_image
                                                });
                                                e.target.src = '/images/default-avatar.png';
                                            }}
                                        />
                                    </Link>
                                    {collaborators.map((collab, index) => (
                                        <Link
                                             key={collab.id}
                                             to={`/${collab.slug}`}
                                             className="hover:z-20 relative"
                                             style={{ zIndex: 9 - index, marginLeft: '-12px', marginTop: '8px' }}
                                         >
                                             <img
                                                  src={collab.avatar_url || '/images/default-avatar.png'}
                                                  alt={collab.name}
                                                  className="w-8 h-8 rounded-full object-cover border-2 border-white"
                                                  onError={(e) => { e.target.src = '/images/default-avatar.png'; }}
                                              />
                                         </Link>
                                     ))}
                                </div>

                                {/* Nomes */}
                                 <div className="flex items-center gap-1">
                                     <Link to={`/${artist?.slug || artistSlug}`} className="flex items-start hover:opacity-80 transition-opacity">
                                         <span className="text-lg">{album.artistName}</span>
                                         {artist?.verified && (
                                             <div className="w-3.5 h-3.5 rounded-full bg-blue-500 flex items-center justify-center ml-0.5 mt-0.5">
                                                 <BadgeCheck className="w-2 h-2 text-white" />
                                             </div>
                                         )}
                                    </Link>

                                    {collaborators.map((collab) => (
                                         <React.Fragment key={collab.id}>
                                             <span className="text-gray-400 mx-1">&</span>
                                             <Link to={`/${collab.slug}`} className="flex items-start hover:opacity-80 transition-opacity">
                                                 <span className="text-lg">{collab.name}</span>
                                                 {collab.is_verified && (
                                                     <div className="w-3.5 h-3.5 rounded-full bg-blue-500 flex items-center justify-center ml-0.5 mt-0.5">
                                                         <BadgeCheck className="w-2 h-2 text-white" />
                                                     </div>
                                                 )}
                                             </Link>
                                         </React.Fragment>
                                     ))}
                                 </div>

                                <span className="text-gray-400">•</span>
                                <span className="text-gray-400">{album.releaseYear}</span>
                                <span className="text-gray-400">•</span>
                                <span className="text-gray-400">{albumSongs.length} músicas</span>
                            </div>
                        </div>
                    </div>
                    
                    {/* Mobile Layout */}
                    <div className="md:hidden flex flex-col items-center text-center text-white">
                        <div
                            className="relative w-48 h-48 group cursor-pointer mb-6"
                            onClick={handlePlayAlbum}
                        >
                            <img
                                src={imageError ? '/images/default-album.png' : album.coverImage}
                                alt={album.title}
                                loading="eager"
                                className="w-full h-full rounded-lg shadow-2xl object-cover"
                                onError={() => {
                                    console.error('Erro ao carregar imagem:', album.coverImage);
                                    setImageError(true);
                                }}
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-300 rounded-lg flex items-center justify-center">
                                <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-lg">
                                    <Play className="w-7 h-7 text-white ml-1" fill="white" />
                                </div>
                            </div>
                        </div>
                        <p className="text-sm uppercase tracking-wider mb-2">Álbum</p>
                        <h1 className="text-2xl font-bold mb-3">{album.title}</h1>
                        <div className="flex items-center gap-2 justify-center mb-2">
                            <Link to={`/${artist?.slug || artistSlug}`} className="flex items-center hover:opacity-80 transition-opacity">
                                <span>{album.artistName}</span>
                                {artist?.verified && (
                                    <BadgeCheck className="w-3.5 h-3.5 text-blue-400 ml-1" />
                                )}
                            </Link>
                        </div>
                        <span className="text-gray-400 text-sm">{album.releaseYear} • {albumSongs.length} músicas</span>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    {/* Desktop Layout */}
                    <div className="hidden md:flex items-center gap-4">
                        <Button
                            onClick={handlePlayAlbum}
                            className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg"
                        >
                            <Play className="w-6 h-6 ml-1" fill="white" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={handleFavorite}
                            className="w-12 h-12 rounded-full border-gray-300 hover:border-red-600"
                        >
                            <Heart
                                className={`w-5 h-5 ${isFavorite ? 'fill-red-600 text-red-600' : 'text-gray-600'
                                    }`}
                            />
                        </Button>
                        <Button
                             onClick={handleDownloadAlbum}
                             disabled={!album || downloadInProgress || (album?.id && isAlbumDownloaded(album.id))}
                             className={`relative text-white px-8 h-12 text-base font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden ${
                                 album?.id && isAlbumDownloaded(album.id)
                                     ? 'bg-green-600 hover:bg-green-600' 
                                     : 'bg-red-600 hover:bg-red-700'
                             }`}
                         >
                             {downloadInProgress && album?.id && hookDownloadProgress[album.id] ? (
                                 <>
                                     <div className="absolute inset-0 bg-red-700 transition-all duration-300" 
                                         style={{ width: `${(hookDownloadProgress[album.id].current / hookDownloadProgress[album.id].total) * 100}%` }}>
                                     </div>
                                     <span className="relative inline-block animate-spin mr-2">⏳</span>
                                     <span className="relative">
                                         BAIXANDO {hookDownloadProgress[album.id].current}/{hookDownloadProgress[album.id].total}...
                                     </span>
                                 </>
                             ) : downloadInProgress ? (
                                 <>
                                     <span className="inline-block animate-spin mr-2">⏳</span>
                                     BAIXANDO...
                                 </>
                             ) : album?.id && isAlbumDownloaded(album.id) ? (
                                 <>
                                     <Download className="w-5 h-5 mr-2" />
                                     JÁ BAIXADO ✓
                                 </>
                             ) : (
                                 <>
                                     <Download className="w-5 h-5 mr-2" />
                                     BAIXAR CD COMPLETO
                                 </>
                             )}
                         </Button>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="w-12 h-12 rounded-full border-gray-300 hover:border-red-600"
                                >
                                    <Share2 className="w-5 h-5 text-gray-600" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-3" side="right" align="center">
                                <div className="flex items-center gap-3">
                                    <button
                                        className="w-12 h-12 rounded-lg bg-green-500 hover:bg-green-600 flex items-center justify-center transition-colors"
                                        onClick={() => {
                                            const url = window.location.href;
                                            window.open(`https://wa.me/?text=${encodeURIComponent(`${album.title} - ${album.artistName}\n${url}`)}`, '_blank');
                                        }}
                                        title="WhatsApp"
                                    >
                                        <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                        </svg>
                                    </button>
                                    <button
                                        className="w-12 h-12 rounded-lg bg-blue-600 hover:bg-blue-700 flex items-center justify-center transition-colors"
                                        onClick={() => {
                                            const url = window.location.href;
                                            window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
                                        }}
                                        title="Facebook"
                                    >
                                        <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                        </svg>
                                    </button>
                                    <button
                                        className="w-12 h-12 rounded-lg bg-black hover:bg-gray-800 flex items-center justify-center transition-colors"
                                        onClick={() => {
                                            const url = window.location.href;
                                            window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(`${album.title} - ${album.artistName}`)}`, '_blank');
                                        }}
                                        title="Twitter / X"
                                    >
                                        <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                        </svg>
                                    </button>
                                    <div className="w-px h-8 bg-gray-300"></div>
                                    <Button
                                        variant="outline"
                                        className="h-10 gap-2"
                                        onClick={() => {
                                            const url = window.location.href;
                                            navigator.clipboard.writeText(url);
                                            toast({
                                                title: 'Link copiado!',
                                                description: 'O link foi copiado para a área de transferência'
                                            });
                                        }}
                                    >
                                        <Copy className="w-4 h-4" />
                                        Copiar Link
                                    </Button>
                                </div>
                            </PopoverContent>
                        </Popover>

                        {/* Spacer */}
                        <div className="flex-1"></div>

                        {/* Stats */}
                        <div className="flex items-center gap-3">
                            <div className="bg-gray-100 border border-gray-200 rounded overflow-hidden">
                                <div className="px-5 py-1.5 text-center">
                                    <span className="text-lg font-bold text-red-600">{album.download_count?.toLocaleString() || 0}</span>
                                </div>
                                <div className="border-t border-gray-300 px-5 py-1 text-center bg-gray-50">
                                    <span className="text-xs text-gray-500">Downloads</span>
                                </div>
                            </div>
                            <div className="bg-gray-100 border border-gray-200 rounded overflow-hidden">
                                <div className="px-5 py-1.5 text-center">
                                    <span className="text-lg font-bold text-gray-800">{album.play_count?.toLocaleString() || 0}</span>
                                </div>
                                <div className="border-t border-gray-300 px-5 py-1 text-center bg-gray-50">
                                    <span className="text-xs text-gray-500">Plays</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Mobile Layout */}
                    <div className="md:hidden flex flex-col items-center gap-4">
                        {/* Play + Heart Buttons */}
                        <div className="flex items-center gap-4">
                            <Button
                                onClick={handlePlayAlbum}
                                className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg"
                            >
                                <Play className="w-6 h-6 ml-1" fill="white" />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={handleFavorite}
                                className="w-12 h-12 rounded-full border-gray-300 hover:border-red-600"
                            >
                                <Heart
                                    className={`w-5 h-5 ${isFavorite ? 'fill-red-600 text-red-600' : 'text-gray-600'
                                        }`}
                                />
                            </Button>
                        </div>
                        
                        {/* Download Button */}
                         <Button
                             onClick={handleDownloadAlbum}
                             disabled={!album || downloadInProgress || (album?.id && isAlbumDownloaded(album.id))}
                             className={`w-full text-white h-12 text-base font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                                 album?.id && isAlbumDownloaded(album.id)
                                     ? 'bg-green-600 hover:bg-green-600' 
                                     : 'bg-red-600 hover:bg-red-700'
                             }`}
                         >
                             {downloadInProgress && album?.id && hookDownloadProgress[album.id] ? (
                                 <>
                                     <span className="inline-block animate-spin mr-2">⏳</span>
                                     BAIXANDO {hookDownloadProgress[album.id].current}/{hookDownloadProgress[album.id].total}...
                                 </>
                             ) : downloadInProgress ? (
                                 <>
                                     <span className="inline-block animate-spin mr-2">⏳</span>
                                     BAIXANDO...
                                 </>
                             ) : album?.id && isAlbumDownloaded(album.id) ? (
                                 <>
                                     <Download className="w-5 h-5 mr-2" />
                                     JÁ BAIXADO ✓
                                 </>
                             ) : (
                                 <>
                                     <Download className="w-5 h-5 mr-2" />
                                     BAIXAR CD COMPLETO
                                 </>
                             )}
                         </Button>
                        
                        {/* Share & Stats */}
                        <div className="flex items-center gap-3 w-full">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="flex-1 h-10 gap-2"
                                    >
                                        <Share2 className="w-4 h-4" />
                                        Compartilhar
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-3" side="top" align="center">
                                    <div className="flex items-center gap-3">
                                        <button
                                            className="w-12 h-12 rounded-lg bg-green-500 hover:bg-green-600 flex items-center justify-center transition-colors"
                                            onClick={() => {
                                                const url = window.location.href;
                                                window.open(`https://wa.me/?text=${encodeURIComponent(`${album.title} - ${album.artistName}\n${url}`)}`, '_blank');
                                            }}
                                            title="WhatsApp"
                                        >
                                            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                            </svg>
                                        </button>
                                        <button
                                            className="w-12 h-12 rounded-lg bg-blue-600 hover:bg-blue-700 flex items-center justify-center transition-colors"
                                            onClick={() => {
                                                const url = window.location.href;
                                                window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
                                            }}
                                            title="Facebook"
                                        >
                                            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                            </svg>
                                        </button>
                                        <button
                                            className="w-12 h-12 rounded-lg bg-black hover:bg-gray-800 flex items-center justify-center transition-colors"
                                            onClick={() => {
                                                const url = window.location.href;
                                                window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(`${album.title} - ${album.artistName}`)}`, '_blank');
                                            }}
                                            title="Twitter / X"
                                        >
                                            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                            </svg>
                                        </button>
                                    </div>
                                </PopoverContent>
                            </Popover>
                            
                            {/* Stats */}
                            <div className="flex-1">
                                <div className="bg-gray-100 border border-gray-200 rounded overflow-hidden">
                                    <div className="px-3 py-1 text-center">
                                        <span className="text-sm font-bold text-red-600">{album.download_count?.toLocaleString() || 0}</span>
                                        <span className="text-xs text-gray-500 block">Downloads</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1">
                                <div className="bg-gray-100 border border-gray-200 rounded overflow-hidden">
                                    <div className="px-3 py-1 text-center">
                                        <span className="text-sm font-bold text-gray-800">{album.play_count?.toLocaleString() || 0}</span>
                                        <span className="text-xs text-gray-500 block">Plays</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Album Video Section */}
            {albumVideo && (
                <div className="max-w-7xl mx-auto px-4 mt-8 mb-8">
                    <div className="flex items-center gap-2 mb-4">
                        <Video className="w-6 h-6 text-red-600" />
                        <h2 className="text-2xl font-bold text-black">VÍDEO</h2>
                    </div>
                    <div className="relative w-full max-w-2xl bg-black rounded-lg overflow-hidden shadow-lg">
                        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                            <iframe
                                className="absolute inset-0 w-full h-full"
                                src={`https://www.youtube.com/embed/${albumVideo.videoId}?autoplay=0&controls=1&modestbranding=1`}
                                title={albumVideo.title}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            ></iframe>
                        </div>
                    </div>
                </div>
            )}

            {/* Songs List */}
            <div className="max-w-7xl mx-auto px-4 mt-8">
                <div className="bg-red-600 text-white px-4 py-3 rounded-t-lg">
                    <h2 className="text-xl font-bold">MÚSICAS DO CD</h2>
                </div>
                <div className="bg-white border border-gray-200 rounded-b-lg">
                    <div style={{ maxHeight: albumSongs.length > 10 ? '550px' : 'auto', overflowY: albumSongs.length > 10 ? 'auto' : 'visible' }}>
                        {albumSongs.map((song, index) => (
                            <AlbumSongRow
                                key={song.id}
                                song={song}
                                index={index}
                                onPlay={() => playSong(song, albumSongs)}
                                onPlayMobile={handleMobilePlayerToggle}
                                formatDuration={formatDurationLocal}
                                isHighlighted={currentSong && currentSong.id === song.id}
                            />
                        ))}
                    </div>

                    {albumSongs.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                            Nenhuma música encontrada neste álbum
                        </div>
                    )}
                </div>
            </div>

            {/* Ouça Aqui Recomenda Section */}
            <div className="max-w-7xl mx-auto px-4 mt-16 mb-16">
                <div className="flex items-center gap-2 mb-6 flex-wrap">
                    <ThumbsUp className="w-6 md:w-8 h-6 md:h-8 text-red-600 flex-shrink-0" />
                    <h2 className="text-xl md:text-2xl font-bold text-black whitespace-nowrap">Ouça Aqui Recomenda!</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                    {recommendedAlbums.length === 0 ? (
                        <p className="text-gray-500 py-8 col-span-full text-center">Nenhum álbum disponível no momento.</p>
                    ) : (
                        recommendedAlbums.map((recAlbum) => (
                            <div key={recAlbum.id}>
                                <Link
                                    to={`/${recAlbum.artistSlug}/${recAlbum.slug || recAlbum.id}`}
                                    className="group cursor-pointer block"
                                >
                                    <div className="relative mb-2 md:mb-3 overflow-hidden rounded-lg shadow-lg">
                                        <img
                                            src={recAlbum.coverImage}
                                            alt={recAlbum.title}
                                            className="w-full aspect-square object-cover transform group-hover:scale-110 transition-transform duration-300"
                                            onError={(e) => { e.target.onerror = null; e.target.src = '/images/default-album.png'; }}
                                        />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
                                            <div className="w-10 md:w-12 h-10 md:h-12 rounded-full bg-red-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all duration-300">
                                                <Play className="w-4 md:w-5 h-4 md:h-5 text-white ml-0.5" fill="white" />
                                            </div>
                                        </div>
                                    </div>
                                    <h3 className="text-gray-900 font-semibold text-xs md:text-sm mb-1 truncate group-hover:text-red-600 transition-colors">
                                        {recAlbum.title}
                                    </h3>
                                </Link>
                                <Link
                                    to={`/${recAlbum.artistSlug}`}
                                    className="flex items-center gap-1 text-gray-500 text-xs truncate hover:text-red-600 transition-colors mb-1 md:mb-2"
                                >
                                    <span className="truncate">{recAlbum.artistName}</span>
                                </Link>
                                <div className="flex items-center gap-1 md:gap-2 text-xs flex-wrap">
                                    <div className="flex items-center gap-1 px-1.5 md:px-2 py-0.5 md:py-1 bg-gray-100 rounded">
                                        <span className="font-bold text-gray-700">{recAlbum.playCount > 999 ? (recAlbum.playCount / 1000).toFixed(1) + 'K' : recAlbum.playCount}</span>
                                        <span className="text-gray-500 hidden sm:inline">Plays</span>
                                    </div>
                                    <div className="flex items-center gap-1 px-1.5 md:px-2 py-0.5 md:py-1 bg-gray-100 rounded">
                                        <span className="font-bold text-gray-700">{recAlbum.downloadCount > 999 ? (recAlbum.downloadCount / 1000).toFixed(1) + 'K' : recAlbum.downloadCount}</span>
                                        <span className="text-gray-500 hidden sm:inline">Downloads</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Comments Section - Lazy loaded */}
              <Suspense fallback={<div className="max-w-7xl mx-auto px-4 mt-16 mb-16 py-8 text-center text-gray-500">Carregando comentários...</div>}>
                <CommentSection albumId={album.id} artistId={album.artistId} />
              </Suspense>

            {/* Download Progress Modal */}
            <DownloadProgressModal
              isOpen={downloadModalOpen}
              status={downloadStatus}
              progress={localDownloadProgress}
              albumTitle={album?.title}
              songCount={albumSongs.length}
              currentSong={currentDownloadSong}
              currentSongIndex={currentDownloadIndex}
              errorMessage={downloadErrorMessage}
              onClose={() => {
                setDownloadModalOpen(false);
                setDownloadStatus('preparing');
                setLocalDownloadProgress(0);
                setDownloadErrorMessage('');
                setCurrentDownloadSong('');
                setCurrentDownloadIndex(0);
                setDownloadInProgress(false); // IMPORTANTE: Reset do estado do botão
              }}
            />

            </div>
        </>
    );
};

export default AlbumPage;
