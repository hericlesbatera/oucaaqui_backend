import React, { useState } from 'react';
import { Image as ImageIcon, CheckCircle, Upload, AlertCircle, Lock, Globe, Camera, X, Search, Users, UserPlus } from 'lucide-react';
import { Progress } from '../../components/ui/progress';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Card } from '../../components/ui/card';
import { Popover, PopoverTrigger, PopoverContent } from '../../components/ui/popover';
import { useAuth } from '../../context/AuthContext';
import { toast } from '../../hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
import ArtistSidebar from '../../components/Artist/ArtistSidebar';
import { supabase } from '../../lib/supabaseClient';
import { API_URL } from '../../config/api';

const UploadNew = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(1);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadSuccess, setUploadSuccess] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [albumId, setAlbumId] = useState(null);
    const [formData, setFormData] = useState({
        // Step 1
        title: '',
        description: '',
        genre: '',
        tags: [],
        coverImage: null,
        // Step 2
        isPublic: true,
        publishType: 'immediate', // 'immediate', 'private', 'scheduled'
        scheduleDate: '',
        scheduleTime: '',
        releaseDate: '',
        customUrl: '',
        youtubeUrl: '',
        // Step 3
        albumFile: null
    });

    const [tagInput, setTagInput] = useState('');

    const [coverImagePreview, setCoverImagePreview] = useState(null);

    const [genrePopoverOpen, setGenrePopoverOpen] = useState(false);
    
    const [youtubePreview, setYoutubePreview] = useState('');
    const [isLoadingYoutubeThumbnail, setIsLoadingYoutubeThumbnail] = useState(false);

    const [needsComposer, setNeedsComposer] = useState('nao');
    const [needsISRC, setNeedsISRC] = useState('nao');
    const [songs, setSongs] = useState([]);
    const [songMetadata, setSongMetadata] = useState({});
    const [showMetadataSelection, setShowMetadataSelection] = useState(false);

    // Colaboração
    const [collaborators, setCollaborators] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [showCollaboratorsModal, setShowCollaboratorsModal] = useState(false);
    const [selectedCollaborator, setSelectedCollaborator] = useState(null);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleTagKeyDown = (e) => {
        if (e.key === 'Enter' && tagInput.trim()) {
            e.preventDefault();
            if (!formData.tags.includes(tagInput.trim())) {
                setFormData(prev => ({
                    ...prev,
                    tags: [...prev.tags, tagInput.trim()]
                }));
            }
            setTagInput('');
        }
    };

    const removeTag = (indexToRemove) => {
        setFormData(prev => ({
            ...prev,
            tags: prev.tags.filter((_, index) => index !== indexToRemove)
        }));
    };

    const getYouTubeVideoId = (url) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return match && match[2].length === 11 ? match[2] : null;
    };

    const getYouTubeThumbnail = (videoId) => {
        return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    };

    const handleYoutubeUrlChange = (e) => {
        const url = e.target.value;
        setFormData(prev => ({ ...prev, youtubeUrl: url }));

        if (url) {
            setIsLoadingYoutubeThumbnail(true);
            const videoId = getYouTubeVideoId(url);
            
            if (videoId) {
                setYoutubePreview(getYouTubeThumbnail(videoId));
            } else {
                setYoutubePreview('');
            }
            setIsLoadingYoutubeThumbnail(false);
        } else {
            setYoutubePreview('');
        }
    };

    // Buscar artistas colaboradores com debounce
    const handleSearchArtists = async (query) => {
        setSearchQuery(query);

        if (!query.trim()) {
            setSearchResults([]);
            setShowSearchResults(false);
            return;
        }

        setSearching(true);
        setShowSearchResults(true);
        
        try {
            const response = await fetch(
                `${API_URL}/api/artists/search?q=${encodeURIComponent(query)}`
            );

            if (response.ok) {
                const data = await response.json();
                console.log('Artistas encontrados:', data);
                setSearchResults(Array.isArray(data) ? data : []);
            } else {
                console.error('Erro na resposta:', response.status);
                setSearchResults([]);
            }
        } catch (error) {
            console.error('Erro ao buscar artistas:', error);
            setSearchResults([]);
        } finally {
            setSearching(false);
        }
    };

    // Adicionar colaborador
    const handleAddCollaborator = (artist) => {
        if (!collaborators.find(c => c.id === artist.id)) {
            // Adicionar com status de "pendente"
            setCollaborators([...collaborators, {
                ...artist,
                status: 'pending'  // Status: pending, accepted, rejected
            }]);
            // Limpar busca depois de adicionar
            setTimeout(() => {
                setSearchQuery('');
                setSearchResults([]);
                setShowSearchResults(false);
            }, 100);
        }
    };

    // Remover colaborador
    const handleRemoveCollaborator = (artistId) => {
        setCollaborators(collaborators.filter(c => c.id !== artistId));
    };

    const handleFileChange = (e, fileType) => {
        const file = e.target.files[0];
        if (file) {
            if (fileType === 'coverImage') {
                setFormData(prev => ({ ...prev, [fileType]: file }));
                // Preview da imagem
                const reader = new FileReader();
                reader.onloadend = () => {
                    setCoverImagePreview(reader.result);
                };
                reader.readAsDataURL(file);
            } else {
                setFormData(prev => ({ ...prev, [fileType]: file }));
            }
        }
    };

    // Gerar URL padrão a partir do título
    const generateDefaultUrl = (title) => {
        return title
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')
            .replace(/[^\w-]/g, '');
    };

    const validateStep = (step) => {
        if (step === 1) {
            if (!formData.title.trim()) {
                toast({
                    title: 'Campo obrigatório',
                    description: 'Por favor, preencha o Título do Álbum',
                    variant: 'destructive'
                });
                return false;
            }
            if (!formData.genre) {
                toast({
                    title: 'Campo obrigatório',
                    description: 'Por favor, selecione o Gênero Musical',
                    variant: 'destructive'
                });
                return false;
            }
            if (!formData.coverImage) {
                toast({
                    title: 'Campo obrigatório',
                    description: 'Por favor, envie a Capa do Álbum',
                    variant: 'destructive'
                });
                return false;
            }
        } else if (step === 2) {
            if (!formData.releaseDate) {
                toast({
                    title: 'Campo obrigatório',
                    description: 'Por favor, selecione a Data de Lançamento do álbum',
                    variant: 'destructive'
                });
                return false;
            }
            if (formData.publishType === 'scheduled') {
                if (!formData.scheduleDate || !formData.scheduleTime) {
                    toast({
                        title: 'Campo obrigatório',
                        description: 'Por favor, selecione a data e hora para programar a publicação',
                        variant: 'destructive'
                    });
                    return false;
                }
            }
            if (formData.customUrl && !formData.customUrl.match(/^[a-zA-Z0-9-_]*$/)) {
                toast({
                    title: 'URL inválida',
                    description: 'A URL deve conter apenas letras, números, hífens e underscores',
                    variant: 'destructive'
                });
                return false;
            }
        } else if (step === 3) {
            if (!formData.albumFile) {
                toast({
                    title: 'Campo obrigatório',
                    description: 'Por favor, envie o arquivo ZIP com as músicas',
                    variant: 'destructive'
                });
                return false;
            }
        }
        return true;
    };

    const handleNextStep = () => {
        if (validateStep(currentStep)) {
            if (currentStep < 3) {
                setCurrentStep(currentStep + 1);
            }
        }
    };

    const handlePreviousStep = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateStep(3)) {
            return;
        }

        // Show metadata selection dialog
        setShowMetadataSelection(true);
    };

    const handleMetadataSelection = async () => {
        setShowMetadataSelection(false);

        // If we need metadata, upload first then go to Step 4
        if (needsComposer === 'sim' || needsISRC === 'sim') {
            performUpload(true); // true = go to step 4 after upload
        } else {
            // If no metadata needed, just upload and publish
            performUpload(false);
        }
    };

    const performUpload = async (goToStep4 = false) => {
        setUploading(true);
        setUploadProgress(0);
        setUploadSuccess(false);

        const uploadId = Math.random().toString(36).substring(7); // ID único para rastrear progresso
        let currentProgress = 0; // Use local variable instead of state

        try {
            // Criar FormData para enviar ao backend
            const uploadData = new FormData();
            uploadData.append('uploadId', uploadId); // Enviar ID para o backend rastrear
            uploadData.append('title', formData.title);
            uploadData.append('description', formData.description || '');
            uploadData.append('genre', formData.genre);
            uploadData.append('tags', JSON.stringify(Array.isArray(formData.tags) ? formData.tags : []));
            uploadData.append('isPublic', formData.isPublic !== false);
            uploadData.append('publishType', formData.publishType);
            uploadData.append('videoLink', formData.videoLink || '');
            
            // Garantir formato YYYY-MM-DD para a data
            let releaseDateFormatted = formData.releaseDate;
            if (releaseDateFormatted && !releaseDateFormatted.match(/^\d{4}-\d{2}-\d{2}$/)) {
                // Se não está no formato correto, tentar converter
                const dateObj = new Date(releaseDateFormatted);
                if (!isNaN(dateObj.getTime())) {
                    releaseDateFormatted = dateObj.toISOString().split('T')[0];
                }
            }
            console.log('Release date enviado:', releaseDateFormatted);
            uploadData.append('releaseDate', releaseDateFormatted);
            uploadData.append('customUrl', formData.customUrl || generateDefaultUrl(formData.title));
            uploadData.append('artistId', user?.id || '');
            uploadData.append('artistName', user?.name || 'Artista');
            uploadData.append('youtubeUrl', formData.youtubeUrl || '');
            uploadData.append('albumFile', formData.albumFile);

            // Adicionar campos de agendamento se scheduled
            console.log('publishType:', formData.publishType);
            console.log('scheduleDate (local):', formData.scheduleDate);
            console.log('scheduleTime (local):', formData.scheduleTime);
            if (formData.publishType === 'scheduled') {
                // Horário do Brasil (UTC-3 / Brasília)
                // Se escolheu 02:04, será 02:04 (madrugada em Brasília)
                // Se escolheu 14:04, será 14:04 (tarde em Brasília)
                const brasilDateTime = `${formData.scheduleDate}T${formData.scheduleTime}:00-03:00`;
                
                console.log('Agendamento (Horário de Brasília - UTC-3):', {
                    data: formData.scheduleDate,
                    hora: formData.scheduleTime,
                    datetime: brasilDateTime
                });
                
                uploadData.append('scheduledPublishAt', brasilDateTime);
                console.log('Enviando dados de agendamento (UTC-3):', brasilDateTime);
            }

            // Adicionar campos de compositor e ISRC
            uploadData.append('needsComposer', needsComposer);
            uploadData.append('needsISRC', needsISRC);
            uploadData.append('songMetadata', JSON.stringify(songMetadata));
            uploadData.append('collaborators', JSON.stringify(collaborators.map(c => c.id)));

            if (formData.coverImage) {
                uploadData.append('coverImage', formData.coverImage);
            }

            // Usar SSE para rastrear progresso em tempo real

             // Obter token para SSE
             const { data: { session } } = await supabase.auth.getSession();
             const token = session?.access_token;
             const sseUrl = token 
                 ? `${API_URL}/api/upload-progress/progress/${uploadId}?token=${encodeURIComponent(token)}`
                 : `${API_URL}/api/upload-progress/progress/${uploadId}`;

             // Abrir conexão SSE para progresso
             const eventSource = new EventSource(sseUrl);
             let sseConnected = false;
             let uploadCompleted = false;
             let lastProgressTime = Date.now();

             const ssePromise = new Promise((sseResolve, sseReject) => {
                 const sseTimeout = setTimeout(() => {
                     if (!uploadCompleted) {
                         console.warn('SSE timeout - continuing upload');
                     }
                     try { eventSource.close(); } catch(e) {}
                     sseResolve();
                 }, 600000); // 10 minutos timeout

                 eventSource.onopen = () => {
                     sseConnected = true;
                     console.log(`SSE conectado para upload ${uploadId}`);
                 };

                 eventSource.onmessage = (event) => {
                     try {
                         const data = JSON.parse(event.data);
                         console.log('SSE message recebida:', data);
                         if (data.error) {
                             console.error('SSE error:', data.error);
                             sseReject(new Error(data.error));
                         } else {
                             console.log(`Progress via SSE: ${data.progress}% - ${data.step}`);
                             // Atualizar progresso
                             if (data.progress !== undefined) {
                                 currentProgress = Math.max(data.progress, currentProgress);
                                 setUploadProgress(currentProgress);
                                 lastProgressTime = Date.now();
                                 console.log(`SSE progress: ${currentProgress}%`);
                             }
                             // Checar se completo
                             if (data.progress >= 100 || data.step === 'concluido' || data.step === 'completed') {
                                 console.log('Upload completed via SSE');
                                 uploadCompleted = true;
                                 clearTimeout(sseTimeout);
                                 try { eventSource.close(); } catch(e) {}
                                 sseResolve();
                             }
                         }
                     } catch (e) {
                         console.error('Erro ao parsear mensagem SSE:', e);
                     }
                 };

                 eventSource.onerror = (err) => {
                     console.log('SSE connection error or closed', err);
                     clearTimeout(sseTimeout);
                     try { eventSource.close(); } catch(e) {}
                     if (!uploadCompleted) {
                         console.log('Resolvendo SSE promise apesar do erro');
                         sseResolve(); // Continuar mesmo se SSE falhar
                     }
                 };
             });

             // Enviar arquivo
             const uploadPromise = new Promise(async (resolve, reject) => {
                 try {
                     // Get auth token
                     const { data: { session } } = await supabase.auth.getSession();
                     const token = session?.access_token;
                     
                     if (!token) {
                         reject(new Error('Não autenticado. Por favor, faça login novamente.'));
                         return;
                     }

                     const xhr = new XMLHttpRequest();
                     
                     // Set timeout to 10 minutes (600000ms) for large files
                     xhr.timeout = 600000;

                     xhr.upload.addEventListener('progress', (event) => {
                         if (event.lengthComputable) {
                             // Mostrar progresso dos bytes (0-20% apenas para upload do arquivo)
                             const percentComplete = (event.loaded / event.total) * 20;
                             const xhrProgress = Math.round(percentComplete);
                             
                             // Só atualizar se SSE não enviou progresso recente
                             if (Date.now() - lastProgressTime > 1000) {
                                 currentProgress = Math.max(xhrProgress, currentProgress);
                                 setUploadProgress(currentProgress);
                                 console.log(`Upload bytes: ${event.loaded}/${event.total} = ${xhrProgress}% (current: ${currentProgress}%)`);
                             }
                         }
                     });

                     xhr.addEventListener('load', () => {
                         if (xhr.status === 200 || xhr.status === 201) {
                             console.log('Upload completed');
                             resolve(JSON.parse(xhr.responseText));
                         } else {
                             reject(new Error(JSON.parse(xhr.responseText).detail || 'Erro ao fazer upload'));
                         }
                     });

                     xhr.addEventListener('error', () => {
                         console.error('Upload error');
                         reject(new Error('Erro na conexão'));
                     });

                     xhr.addEventListener('abort', () => {
                         console.error('Upload aborted');
                         reject(new Error('Upload cancelado'));
                     });
                     
                     xhr.addEventListener('timeout', () => {
                         console.error('Upload timeout');
                         reject(new Error('Upload excedeu o tempo limite (10 minutos). Arquivo muito grande?'));
                     });

                     xhr.open('POST', `${API_URL}/api/album-upload/upload`);
                     xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                     xhr.send(uploadData);
                 } catch (error) {
                     reject(error);
                 }
             });

             // Polling fallback - começar imediatamente
             // Não esperar SSE, fazer polling a cada 1 segundo
             const pollingInterval = setInterval(async () => {
                try {
                    if (!uploadCompleted) {
                        const statusUrl = `${API_URL}/api/upload-progress/status/${uploadId}`;
                        console.log(`Polling: ${statusUrl}`);
                        const response = await fetch(statusUrl);
                        if (response.ok) {
                            const data = await response.json();
                            console.log('Polling response:', data);
                            if (data.progress !== undefined) {
                                // Usar Math.max para garantir que sempre aumenta ou fica igual
                                const newProgress = Math.max(data.progress, currentProgress);
                                currentProgress = newProgress;
                                setUploadProgress(newProgress);
                                console.log(`Progress atualizado: ${newProgress}%`);
                            }
                            if (data.progress >= 100 || data.status === 'completed') {
                                console.log('Upload completed via polling');
                                uploadCompleted = true;
                                clearInterval(pollingInterval);
                            }
                        } else {
                            console.log(`Polling returned status ${response.status}`);
                        }
                    }
                } catch (error) {
                    console.error('Erro no polling:', error);
                }
             }, 1000); // Check every 1 second

             // Aguardar ambas as promises
             const response = await uploadPromise;
             clearInterval(pollingInterval);
             await ssePromise; // Aguardar SSE fechar
             try { eventSource.close(); } catch(e) {}

            const result = response;

             // Se preencheu URL do YouTube, adicionar vídeo ao álbum
             if (formData.youtubeUrl && result.album?.id) {
                  try {
                      const videoId = getYouTubeVideoId(formData.youtubeUrl);
                      if (videoId) {
                          const response = await fetch(`${API_URL}/api/artist-videos/add`, {
                              method: 'POST',
                              headers: {
                                  'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({
                                  artist_id: user?.id,
                                  album_id: result.album.id,
                                  video_url: formData.youtubeUrl,
                                  video_id: videoId,
                                  title: result.album.title,
                                  thumbnail: getYouTubeThumbnail(videoId),
                                  is_public: true
                              })
                          });
                          
                          if (!response.ok) {
                              console.error('Erro ao adicionar vídeo:', await response.text());
                          }
                      }
                  } catch (error) {
                      console.error('Erro ao adicionar vídeo do YouTube:', error);
                      // Não falhar o upload por causa disso
                  }
              }

             setUploadProgress(100);
             setUploading(false);
             setUploadSuccess(true);

             // If going to Step 4, extract songs from result
             if (goToStep4 && result.songs) {
                setSongs(result.songs.map((song, index) => ({
                    id: index + 1,
                    name: song.title || `Música ${index + 1}`,
                    composer: '',
                    isrc: ''
                })));

                setTimeout(() => {
                    setUploadSuccess(false);
                    setCurrentStep(4);
                }, 1500);
            } else {
                setAlbumId(result.album.id);
                setShowSuccessModal(true);
            }

        } catch (error) {
            setUploading(false);
            setUploadProgress(0);
            toast({
                title: 'Erro no upload',
                description: error.message || 'Não foi possível enviar o álbum. Tente novamente.',
                variant: 'destructive'
            });
        }
    };

    // Calcular a URL final
    const finalUrl = formData.customUrl || generateDefaultUrl(formData.title);

    return (
        <div className="bg-gray-50 min-h-screen">
            {/* Main Content */}
            <div className="max-w-6xl mx-auto p-4 md:p-8">
                <div className="mb-6 md:mb-8">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1 md:mb-2 flex items-center gap-2 md:gap-3">
                        <Upload className="w-6 md:w-8 h-6 md:h-8 text-red-600 flex-shrink-0" />
                        Upload de Álbum
                    </h1>
                </div>



                {/* Progress Indicator */}
                <div className="mb-6 md:mb-8">
                    <div className="flex items-center justify-between gap-1 md:gap-2">
                        {[1, 2, 3].map((step) => (
                            <React.Fragment key={step}>
                                <div className="flex flex-col items-center flex-1">
                                    <div
                                        className={`w-7 md:w-8 h-7 md:h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all flex-shrink-0 ${step === currentStep
                                            ? 'bg-red-600 text-white scale-110'
                                            : step < currentStep
                                                ? 'bg-green-600 text-white'
                                                : 'bg-gray-300 text-gray-700'
                                            }`}
                                    >
                                        {step < currentStep ? <CheckCircle className="w-3 md:w-3.5 h-3 md:h-3.5" /> : step}
                                    </div>
                                    <p
                                        className={`text-xs leading-tight mt-1 hidden md:block ${step === currentStep ? 'text-red-600 font-semibold' : 'text-gray-600'
                                            }`}
                                        style={{ lineHeight: '1.2' }}
                                    >
                                        {step === 1 && 'Informações\nBásicas'}
                                        {step === 2 && 'Privacidade\ne URL'}
                                        {step === 3 && 'Upload do\nArquivo'}
                                    </p>
                                </div>
                                    {step < 3 && (
                                        <div
                                            className={`flex-1 h-0.5 mx-1 ${step < currentStep ? 'bg-green-600' : 'bg-gray-300'
                                                }`}
                                        />
                                    )}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>

                    {/* Step 1: Basic Information */}
                    {currentStep === 1 && (
                        <Card className="bg-white shadow-sm">
                            <form onSubmit={(e) => { e.preventDefault(); handleNextStep(); }} className="p-4 md:p-8 space-y-6 md:space-y-12">
                                <div>
                                    <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1 md:mb-2">Etapa 1: Informações Básicas</h2>
                                    <p className="text-xs md:text-sm text-gray-600">
                                        Preencha os detalhes do seu álbum
                                    </p>
                                </div>

                                {/* Layout: Capa à esquerda, Informações à direita */}
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8">
                                    {/* Left: Cover Image */}
                                    <div className="md:col-span-3 flex justify-center md:justify-start">
                                        <div className="flex flex-col items-center w-full md:w-auto">
                                            {/* Cover Preview */}
                                            <label
                                                htmlFor="coverImage"
                                                className="w-32 h-32 md:w-44 md:h-44 bg-gray-100 border-2 border-gray-300 rounded-lg overflow-hidden mb-3 md:mb-4 flex items-center justify-center cursor-pointer hover:border-red-500 transition-colors flex-shrink-0"
                                            >
                                                {coverImagePreview ? (
                                                    <img
                                                        src={coverImagePreview}
                                                        alt="Capa do álbum"
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                                                        <ImageIcon className="w-8 md:w-12 h-8 md:h-12 text-gray-400" />
                                                    </div>
                                                )}
                                            </label>

                                            {/* Upload Button */}
                                             <label
                                                 htmlFor="coverImage"
                                                 className="w-32 md:w-44 flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 active:bg-red-800 font-semibold py-2 px-3 rounded-lg cursor-pointer transition-colors mb-2 text-xs md:text-sm"
                                                 style={{ color: 'white' }}
                                             >
                                                 <Camera className="w-3.5 h-3.5 flex-shrink-0" />
                                                 <span className="hidden md:inline">Capa do Álbum</span>
                                                 <span className="md:hidden">Selecionar</span>
                                             </label>
                                            <input
                                                id="coverImage"
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => handleFileChange(e, 'coverImage')}
                                                className="hidden"
                                            />
                                            <p className="text-xs text-gray-500 text-center mt-1 md:mt-2">
                                                Mínimo 500x500px<br className="md:hidden" />JPG, PNG ou GIF
                                            </p>
                                        </div>
                                    </div>

                                    {/* Right: Form Fields */}
                                    <div className="md:col-span-9 space-y-4 md:space-y-5">
                                        {/* Título */}
                                        <div>
                                            <Label htmlFor="title" className="text-gray-700 font-semibold">
                                                Título do Álbum *
                                            </Label>
                                            <Input
                                                id="title"
                                                name="title"
                                                value={formData.title}
                                                onChange={handleInputChange}
                                                placeholder="Ex: Meu Primeiro Álbum"
                                                className="mt-2 border-gray-300 focus:border-red-500 focus:ring-red-500"
                                                required
                                            />
                                        </div>

                                        {/* Descrição */}
                                        <div>
                                            <Label htmlFor="description" className="text-gray-700 font-semibold">
                                                Descrição
                                            </Label>
                                            <Textarea
                                                id="description"
                                                name="description"
                                                value={formData.description}
                                                onChange={(e) => {
                                                    if (e.target.value.length <= 500) {
                                                        setFormData(prev => ({ ...prev, description: e.target.value }));
                                                    }
                                                }}
                                                placeholder="Descreva seu álbum..."
                                                rows={3}
                                                maxLength={500}
                                                className="mt-2 border-gray-300 focus:border-red-500 focus:ring-red-500 resize-none"
                                            />
                                            <p className={`text-xs mt-1 ${formData.description.length >= 500 ? 'text-red-500' : 'text-gray-500'}`}>
                                                {formData.description.length}/500 caracteres
                                            </p>
                                        </div>

                                        {/* Gênero Musical e Tags em Grid */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Gênero Musical */}
                                            <div>
                                                <Label className="text-gray-700 font-semibold">
                                                    Gênero Musical *
                                                </Label>
                                                <Popover open={genrePopoverOpen} onOpenChange={setGenrePopoverOpen}>
                                                    <PopoverTrigger asChild>
                                                        <button className="mt-2 w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 text-left">
                                                            <span className={formData.genre ? 'text-gray-900' : 'text-gray-500'}>
                                                                {formData.genre ? (() => {
                                                                    const genreObj = [
                                                                        { value: 'forro', label: 'Forró' },
                                                                        { value: 'arrocha', label: 'Arrocha' },
                                                                        { value: 'piseiro', label: 'Piseiro' },
                                                                        { value: 'arrochadeira', label: 'Arrochadeira' },
                                                                        { value: 'pagode', label: 'Pagode' },
                                                                        { value: 'sertanejo', label: 'Sertanejo' },
                                                                        { value: 'brega-funk', label: 'Brega Funk' },
                                                                        { value: 'variados', label: 'Variados' },
                                                                        { value: 'samba', label: 'Samba' },
                                                                        { value: 'funk', label: 'Funk' },
                                                                        { value: 'axe', label: 'Axé' },
                                                                        { value: 'reggae', label: 'Reggae' },
                                                                        { value: 'brega', label: 'Brega' },
                                                                        { value: 'gospel', label: 'Gospel' },
                                                                        { value: 'rap-hiphop', label: 'Rap/Hip-Hop' },
                                                                        { value: 'pop', label: 'Pop' },
                                                                        { value: 'mpb', label: 'MPB' },
                                                                        { value: 'rock', label: 'Rock' },
                                                                        { value: 'eletronica', label: 'Eletrônica' },
                                                                        { value: 'podcast', label: 'Podcast' },
                                                                        { value: 'trap', label: 'Trap' },
                                                                        { value: 'frevo', label: 'Frevo' }
                                                                    ].find(g => g.value === formData.genre);
                                                                    return genreObj ? genreObj.label : formData.genre;
                                                                })() : 'Selecione o gênero'}
                                                            </span>
                                                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                                            </svg>
                                                        </button>
                                                    </PopoverTrigger>
                                                    <PopoverContent side="top" align="start" className="w-80 p-0 max-h-80 overflow-y-auto">
                                                        <div className="flex flex-col">
                                                            {[
                                                                { value: 'forro', label: 'Forró' },
                                                                { value: 'arrocha', label: 'Arrocha' },
                                                                { value: 'piseiro', label: 'Piseiro' },
                                                                { value: 'arrochadeira', label: 'Arrochadeira' },
                                                                { value: 'pagode', label: 'Pagode' },
                                                                { value: 'sertanejo', label: 'Sertanejo' },
                                                                { value: 'brega-funk', label: 'Brega Funk' },
                                                                { value: 'variados', label: 'Variados' },
                                                                { value: 'samba', label: 'Samba' },
                                                                { value: 'funk', label: 'Funk' },
                                                                { value: 'axe', label: 'Axé' },
                                                                { value: 'reggae', label: 'Reggae' },
                                                                { value: 'brega', label: 'Brega' },
                                                                { value: 'gospel', label: 'Gospel' },
                                                                { value: 'rap-hiphop', label: 'Rap/Hip-Hop' },
                                                                { value: 'pop', label: 'Pop' },
                                                                { value: 'mpb', label: 'MPB' },
                                                                { value: 'rock', label: 'Rock' },
                                                                { value: 'eletronica', label: 'Eletrônica' },
                                                                { value: 'podcast', label: 'Podcast' },
                                                                { value: 'trap', label: 'Trap' },
                                                                { value: 'frevo', label: 'Frevo' }
                                                            ].map(genre => (
                                                                <button
                                                                    key={genre.value}
                                                                    onClick={() => {
                                                                        setFormData(prev => ({ ...prev, genre: genre.value }));
                                                                        setGenrePopoverOpen(false);
                                                                    }}
                                                                    className={`px-4 py-3 text-left text-sm font-medium transition-all border-2 ${formData.genre === genre.value
                                                                        ? 'bg-red-600 text-white border-red-600'
                                                                        : 'text-red-600 border-transparent hover:bg-red-600 hover:text-white'
                                                                        }`}
                                                                >
                                                                    {genre.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            </div>

                                            {/* Tags */}
                                             <div>
                                                 <Label htmlFor="tags" className="text-gray-700 font-semibold">
                                                     Tags (Digite cada tag separada por ENTER)
                                                 </Label>
                                                 <Input
                                                     id="tags"
                                                     type="text"
                                                     value={tagInput}
                                                     onChange={(e) => setTagInput(e.target.value)}
                                                     onKeyDown={handleTagKeyDown}
                                                     placeholder="Ex: sertanejo, tradicional, nordeste"
                                                     className="mt-2 border-gray-300 focus:border-red-500 focus:ring-red-500"
                                                 />
                                                 {formData.tags.length > 0 && (
                                                     <div className="mt-3 flex flex-wrap gap-2">
                                                         {formData.tags.map((tag, index) => (
                                                             <div
                                                                 key={index}
                                                                 className="bg-red-600 text-white text-xs px-3 py-1 rounded-full flex items-center gap-2"
                                                             >
                                                                 {tag}
                                                                 <button
                                                                     type="button"
                                                                     onClick={() => removeTag(index)}
                                                                     className="text-white hover:text-red-200 font-bold"
                                                                 >
                                                                     ×
                                                                 </button>
                                                             </div>
                                                         ))}
                                                     </div>
                                                 )}
                                             </div>
                                             </div>

                                        {/* Colaboradores Section */}
                                        <div className="border rounded-xl p-3 md:p-5 bg-gradient-to-br from-gray-50 to-white">
                                            <div className="flex items-start gap-3 md:gap-4 mb-3 md:mb-4">
                                                <div className="w-10 md:w-12 h-10 md:h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                                                    <Users className="w-5 md:w-6 h-5 md:h-6 text-red-600" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <Label className="text-gray-900 font-semibold text-base md:text-lg block mb-1">
                                                        Colaboradores
                                                    </Label>
                                                    <p className="text-xs md:text-sm text-gray-600 leading-relaxed">
                                                        Convide outros artistas para colaborar. O álbum aparecerá no perfil de todos os colaboradores que aceitarem.
                                                    </p>
                                                </div>
                                            </div>
                                             
                                            <Button
                                                type="button"
                                                onClick={() => setShowCollaboratorsModal(true)}
                                                variant="outline"
                                                className="w-full border-2 border-dashed border-gray-300 hover:border-red-400 hover:bg-red-50 text-gray-700 hover:text-red-600 font-medium py-3 rounded-lg transition-all flex items-center justify-center gap-2"
                                            >
                                                <UserPlus className="w-5 h-5" />
                                                Convidar colaborador
                                            </Button>

                                            {/* Selected Collaborators */}
                                            {collaborators.length > 0 && (
                                                <div className="mt-4 pt-4 border-t border-gray-200">
                                                    <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                                        <Users className="w-4 h-4" />
                                                        Colaboradores adicionados ({collaborators.length})
                                                    </p>
                                                    <div className="space-y-2">
                                                        {collaborators.map((artist) => (
                                                            <div
                                                                key={artist.id}
                                                                className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow group"
                                                            >
                                                                {artist.profile_image ? (
                                                                    <img
                                                                        src={artist.profile_image}
                                                                        alt={artist.name}
                                                                        className="w-10 h-10 rounded-full object-cover flex-shrink-0 border-2 border-gray-200"
                                                                    />
                                                                ) : (
                                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center flex-shrink-0 text-white text-sm font-bold">
                                                                        {artist.name[0]}
                                                                    </div>
                                                                )}
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <p className="text-sm font-semibold text-gray-900">{artist.name}</p>
                                                                        {artist.verified && (
                                                                            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: '#00bcd4'}}>
                                                                                <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"></path>
                                                                                <path d="m9 12 2 2 4-4"></path>
                                                                            </svg>
                                                                        )}
                                                                    </div>
                                                                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 mt-1">
                                                                        <Clock className="w-3 h-3" />
                                                                        Aguardando resposta
                                                                    </span>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveCollaborator(artist.id)}
                                                                    className="text-gray-400 hover:text-red-600 flex-shrink-0 transition-colors opacity-0 group-hover:opacity-100"
                                                                    title="Remover colaborador"
                                                                >
                                                                    <X className="w-5 h-5" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3 md:gap-4 pt-4 md:pt-6">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        disabled
                                        className="flex-1 opacity-50 cursor-not-allowed text-sm md:text-base py-2 md:py-3"
                                    >
                                        Voltar
                                    </Button>
                                    <Button
                                        type="submit"
                                        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm md:text-base py-2 md:py-3"
                                    >
                                        Próximo
                                    </Button>
                                </div>
                            </form>
                        </Card>
                    )}

                    {/* Step 2: Privacy and URL */}
                    {currentStep === 2 && (
                        <Card className="bg-white shadow-sm">
                            <form onSubmit={(e) => { e.preventDefault(); handleNextStep(); }} className="p-4 md:p-6 space-y-4 md:space-y-6">
                                <div>
                                    <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1 md:mb-2">Etapa 2: Privacidade e URL</h2>
                                    <p className="text-xs md:text-sm text-gray-600">
                                        Configure como seu álbum será acessível
                                    </p>
                                </div>

                                <div className="space-y-4 md:space-y-6">
                                    {/* Visibility Options */}
                                    <div>
                                        <Label className="text-gray-700 font-semibold text-sm md:text-base">Visibilidade do Álbum</Label>
                                        <div className="mt-3 md:mt-4 space-y-2 md:space-y-3">
                                            {/* Public */}
                                            <label className="flex items-start p-3 md:p-4 border-2 rounded-lg cursor-pointer transition-colors gap-3" style={{ borderColor: formData.publishType === 'immediate' ? '#dc2626' : '#d1d5db' }}>
                                                <input
                                                    type="radio"
                                                    name="publishType"
                                                    value="immediate"
                                                    checked={formData.publishType === 'immediate'}
                                                    onChange={() => setFormData(prev => ({ ...prev, publishType: 'immediate' }))}
                                                    className="w-4 h-4 text-red-600 cursor-pointer mt-0.5 flex-shrink-0"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Globe className="w-4 md:w-5 h-4 md:h-5 text-red-600 flex-shrink-0" />
                                                        <span className="font-semibold text-gray-900 text-sm md:text-base">Público</span>
                                                    </div>
                                                    <p className="text-xs md:text-sm text-gray-600">Qualquer pessoa pode acessar e ouvir seu álbum</p>
                                                </div>
                                            </label>

                                            {/* Private */}
                                            <label className="flex items-start p-3 md:p-4 border-2 rounded-lg cursor-pointer transition-colors gap-3" style={{ borderColor: formData.publishType === 'private' ? '#dc2626' : '#d1d5db' }}>
                                                <input
                                                    type="radio"
                                                    name="publishType"
                                                    value="private"
                                                    checked={formData.publishType === 'private'}
                                                    onChange={() => setFormData(prev => ({ ...prev, publishType: 'private' }))}
                                                    className="w-4 h-4 text-red-600 cursor-pointer mt-0.5 flex-shrink-0"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Lock className="w-4 md:w-5 h-4 md:h-5 text-red-600 flex-shrink-0" />
                                                        <span className="font-semibold text-gray-900 text-sm md:text-base">Privado</span>
                                                    </div>
                                                    <p className="text-xs md:text-sm text-gray-600">Apenas você pode acessar este álbum</p>
                                                </div>
                                            </label>

                                            {/* Scheduled */}
                                            <label className="flex items-start p-3 md:p-4 border-2 rounded-lg cursor-pointer transition-colors gap-3" style={{ borderColor: formData.publishType === 'scheduled' ? '#dc2626' : '#d1d5db' }}>
                                                <input
                                                    type="radio"
                                                    name="publishType"
                                                    value="scheduled"
                                                    checked={formData.publishType === 'scheduled'}
                                                    onChange={() => setFormData(prev => ({ ...prev, publishType: 'scheduled' }))}
                                                    className="w-4 h-4 text-red-600 cursor-pointer mt-0.5 flex-shrink-0"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Clock className="w-4 md:w-5 h-4 md:h-5 text-red-600 flex-shrink-0" />
                                                        <span className="font-semibold text-gray-900 text-sm md:text-base">Programar</span>
                                                    </div>
                                                    <p className="text-xs md:text-sm text-gray-600">Selecione uma data e hora para tornar o conteúdo público</p>
                                                </div>
                                            </label>

                                            {/* Schedule Details - Show only when scheduled is selected */}
                                            {formData.publishType === 'scheduled' && (
                                                <div className="ml-7 md:ml-8 space-y-2 md:space-y-3 pt-2">
                                                    <div className="flex flex-col md:flex-row gap-2 md:gap-4">
                                                        <Input
                                                            id="scheduleDate"
                                                            type="date"
                                                            value={formData.scheduleDate}
                                                            onChange={(e) => setFormData(prev => ({ ...prev, scheduleDate: e.target.value }))}
                                                            className="border-gray-300 focus:border-red-500 focus:ring-red-500 h-10 md:h-12 px-3 flex-1 text-sm md:text-base"
                                                            style={{ fontSize: '16px' }}
                                                        />
                                                        <Input
                                                            id="scheduleTime"
                                                            type="time"
                                                            value={formData.scheduleTime}
                                                            onChange={(e) => setFormData(prev => ({ ...prev, scheduleTime: e.target.value }))}
                                                            className="border-gray-300 focus:border-red-500 focus:ring-red-500 h-10 md:h-12 px-3 flex-1 md:flex-initial md:w-32 text-sm md:text-base"
                                                            style={{ fontSize: '16px' }}
                                                        />
                                                    </div>
                                                    <p className="text-xs text-gray-600">
                                                        O álbum será <strong>Privado</strong> antes da data e hora agendada
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Release Date */}
                                    <div>
                                        <Label className="text-gray-700 font-semibold mb-1 block text-sm md:text-base">
                                            Data de Lançamento <span className="text-red-600">*</span>
                                        </Label>
                                        <p className="text-xs md:text-sm text-gray-600 mb-2 md:mb-3">
                                            Escolha a data em que o álbum foi lançado. Isso afeta a ordem como ele aparece no seu perfil.
                                        </p>
                                        <input
                                            type="date"
                                            name="releaseDate"
                                            value={formData.releaseDate || ''}
                                            onChange={(e) => setFormData(prev => ({ ...prev, releaseDate: e.target.value }))}
                                            className="w-full px-3 md:px-4 py-2 border border-gray-300 rounded-lg focus:border-red-500 focus:ring-red-500 focus:outline-none text-sm md:text-base h-10 md:h-12"
                                            style={{ fontSize: '16px' }}
                                            required
                                        />
                                    </div>

                                    {/* Custom URL */}
                                    <div>
                                        <Label htmlFor="customUrl" className="text-gray-700 font-semibold text-sm md:text-base">URL do Álbum</Label>
                                        <div className="mt-2">
                                            <div className="flex items-center bg-gray-100 rounded-lg border border-gray-300 overflow-hidden h-10 md:h-12">
                                                <span className="px-3 md:px-4 py-2 text-gray-600 text-xs md:text-sm font-medium whitespace-nowrap flex-shrink-0">oucaaqui.com/</span>
                                                <Input
                                                    id="customUrl"
                                                    name="customUrl"
                                                    value={formData.customUrl}
                                                    onChange={handleInputChange}
                                                    placeholder={generateDefaultUrl(formData.title) || 'seu-album'}
                                                    className="flex-1 border-0 bg-transparent px-2 md:px-4 py-2 text-gray-900 placeholder-gray-500 text-sm md:text-base h-full"
                                                />
                                            </div>
                                            <p className="text-xs text-gray-500 mt-2">
                                                Se deixar em branco, será usada: <span className="font-semibold">oucaaqui.com/{finalUrl || 'seu-album'}</span>
                                            </p>
                                            <p className="text-xs text-gray-400 mt-1">
                                                Use apenas letras, números, hífens e underscores
                                            </p>
                                        </div>
                                    </div>



                                     {/* YouTube Video for Album */}
                                     <div className="border rounded-lg p-3 md:p-4 bg-gradient-to-br from-red-50 to-white">
                                         <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                                             {/* Preview */}
                                             <div className="order-2 md:order-1">
                                                 <Label className="text-gray-700 font-semibold mb-2 md:mb-3 block text-sm md:text-base">Prévia do Vídeo</Label>
                                                 <div className="bg-gray-200 rounded-lg w-full h-24 md:h-32 flex items-center justify-center overflow-hidden">
                                                     {youtubePreview ? (
                                                         <img src={youtubePreview} alt="YouTube Preview" className="w-full h-full object-cover" />
                                                     ) : (
                                                         <div className="text-gray-400 text-center">
                                                             <svg className="w-8 md:w-12 h-8 md:h-12 mx-auto mb-1 md:mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                             </svg>
                                                             <p className="text-xs md:text-sm">Vídeo do YouTube</p>
                                                         </div>
                                                     )}
                                                 </div>
                                                 <p className="text-xs text-gray-500 mt-1 md:mt-2">
                                                     Será automaticamente vinculado ao álbum
                                                 </p>
                                             </div>

                                             {/* Input */}
                                             <div className="order-1 md:order-2 space-y-2 md:space-y-3">
                                                 <div>
                                                     <Label htmlFor="youtubeUrl" className="text-gray-700 font-semibold text-sm md:text-base">Link do Vídeo (Opcional)</Label>
                                                     <p className="text-xs text-gray-500 mb-1 md:mb-2">Exemplo: https://youtu.be/dQw4w9WgXcQ</p>
                                                     <Input
                                                         id="youtubeUrl"
                                                         type="url"
                                                         value={formData.youtubeUrl}
                                                         onChange={handleYoutubeUrlChange}
                                                         placeholder="https://youtube.com/watch?v=..."
                                                         disabled={isLoadingYoutubeThumbnail}
                                                         className="border-gray-300 focus:border-red-500 focus:ring-red-500 text-sm md:text-base"
                                                     />
                                                 </div>
                                                 <p className="text-xs text-gray-600">
                                                     <strong>Nota:</strong> O vídeo será adicionado automaticamente ao álbum quando você fizer o upload.
                                                 </p>
                                             </div>
                                         </div>
                                     </div>

                                     {/* Preview */}
                                    <div className="bg-gray-50 p-3 md:p-4 rounded-lg border border-gray-200">
                                        <p className="text-xs text-gray-600 font-semibold mb-2">PRÉVIA:</p>
                                        <div className="bg-white p-2 md:p-3 rounded border border-gray-200">
                                            <p className="text-xs md:text-sm text-gray-900 font-semibold truncate"><strong>{formData.title}</strong></p>
                                            <p className="text-xs text-gray-500 mt-1 truncate">oucaaqui.com/{finalUrl || 'seu-album'}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3 md:gap-4 pt-4 md:pt-6">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handlePreviousStep}
                                        className="flex-1 text-sm md:text-base py-2 md:py-3"
                                    >
                                        Voltar
                                    </Button>
                                    <Button
                                        type="submit"
                                        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm md:text-base py-2 md:py-3"
                                    >
                                        Próximo
                                    </Button>
                                </div>
                            </form>
                        </Card>
                    )}

                    {/* Step 3: File Upload */}
                    {currentStep === 3 && (
                        <Card className="bg-white shadow-sm">
                            <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4 md:space-y-6">
                                <div>
                                    <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1 md:mb-2">Etapa 3: Upload do Arquivo</h2>
                                </div>

                                {/* Para Lembrar Box */}
                                <div className="flex items-start gap-2">
                                    <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 512 512" height="1.3em" width="1.3em" xmlns="http://www.w3.org/2000/svg" className="text-red-600 flex-shrink-0 mt-0.5"><path fill="none" strokeLinejoin="round" strokeWidth="32" d="M128 80V64a48.14 48.14 0 0148-48h224a48.14 48.14 0 0148 48v368l-80-64"></path><path fill="none" strokeLinejoin="round" strokeWidth="32" d="M320 96H112a48.14 48.14 0 00-48 48v352l152-128 152 128V144a48.14 48.14 0 00-48-48z"></path></svg>
                                    <div className="flex-1">
                                        <p className="text-gray-700 text-sm md:text-base leading-relaxed">
                                            <span className="font-semibold text-red-600">Para lembrar:</span> realize apenas uploads de sua propriedade ou sobre os quais você detém legalmente os direitos.
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-4 md:space-y-6">
                                    {/* Album File */}
                                    <div>
                                        <Label htmlFor="albumFile" className="text-gray-700 font-semibold text-sm md:text-base">Arquivo ZIP com as Músicas *</Label>
                                        <div className="mt-2 md:mt-4">
                                            <label
                                                htmlFor="albumFile"
                                                className={`flex flex-col items-center justify-center w-full px-4 md:px-6 py-8 md:py-12 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300 ${
                                                    formData.albumFile
                                                        ? 'border-green-500 bg-green-50 hover:bg-green-100'
                                                        : 'border-red-400 bg-white hover:border-red-600 hover:bg-red-50'
                                                }`}
                                            >
                                                <div className="text-center">
                                                    {!formData.albumFile ? (
                                                         <>
                                                             <div className="flex justify-center mb-3 md:mb-4">
                                                                 <svg className="w-8 md:w-12 h-8 md:h-12 text-red-600" viewBox="0 0 512 512" fill="currentColor">
                                                                     <path d="M296 384h-80c-13.3 0-24-10.7-24-24V192h-87.7c-17.8 0-26.7-21.5-14.1-34.1L242.3 5.7c7.5-7.5 19.8-7.5 27.3 0l152.2 152.2c12.6 12.6 3.7 34.1-14.1 34.1H320v168c0 13.3-10.7 24-24 24zm216-8v112c0 13.3-10.7 24-24 24H24c-13.3 0-24-10.7-24-24V376c0-13.3 10.7-24 24-24h136v8c0 30.9 25.1 56 56 56h80c30.9 0 56-25.1 56-56v-8h136c13.3 0 24 10.7 24 24zm-124 88c0-11-9-20-20-20s-20 9-20 20 9 20 20 20 20-9 20-20zm64 0c0-11-9-20-20-20s-20 9-20 20 9 20 20 20 20-9 20-20z" />
                                                                 </svg>
                                                             </div>
                                                             <p className="text-lg md:text-2xl font-bold text-red-600 mb-1">
                                                                  CLIQUE PARA ENVIAR
                                                             </p>
                                                             <p className="text-xs md:text-sm text-gray-600">
                                                                  ZIP com todas as músicas em MP3
                                                             </p>
                                                         </>
                                                     ) : (
                                                         <>
                                                             <div className="flex justify-center mb-2 md:mb-3">
                                                                 <svg className="w-8 md:w-10 h-8 md:h-10 text-green-600" viewBox="0 0 512 512" fill="currentColor">
                                                                     <path d="M504 256c0 137-111 248-248 248S8 393 8 256 119 8 256 8s248 111 248 248zM227.314 387.314l184-184c6.248-6.248 6.248-16.379 0-22.627l-22.627-22.627c-6.248-6.249-16.379-6.249-22.627 0L216 308.745l-52.686-52.686c-6.248-6.248-16.379-6.248-22.627 0l-22.627 22.627c-6.248 6.248-6.248 16.379 0 22.627l104 104c6.249 6.25 16.379 6.25 22.628 0z" />
                                                                 </svg>
                                                             </div>
                                                             <p className="text-base md:text-lg font-bold text-green-700 mb-1 truncate">
                                                                 {formData.albumFile.name}
                                                             </p>
                                                             <p className="text-xs md:text-sm text-green-600">
                                                                 Arquivo selecionado com sucesso!
                                                             </p>
                                                         </>
                                                     )}
                                                 </div>
                                                 <input
                                                     id="albumFile"
                                                     type="file"
                                                     accept=".zip,.rar"
                                                     onChange={(e) => handleFileChange(e, 'albumFile')}
                                                     className="hidden"
                                                     disabled={uploading}
                                                 />
                                             </label>
                                         </div>
                                     </div>

                                     {/* Vale Saber Box */}
                                     <div className="flex items-start gap-2">
                                         <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 256 256" height="1.2em" width="1.2em" xmlns="http://www.w3.org/2000/svg" className="text-red-600 flex-shrink-0 mt-0.5"><path d="M180,232a12,12,0,0,1-12,12H88a12,12,0,0,1,0-24h80A12,12,0,0,1,180,232Zm40-128a91.51,91.51,0,0,1-35.17,72.35A12.26,12.26,0,0,0,180,186v2a20,20,0,0,1-20,20H96a20,20,0,0,1-20-20v-2a12,12,0,0,0-4.7-9.51A91.57,91.57,0,0,1,36,104.52C35.73,54.69,76,13.2,125.79,12A92,92,0,0,1,220,104Zm-24,0a68,68,0,0,0-69.65-68C89.56,36.88,59.8,67.55,60,104.38a67.71,67.71,0,0,0,26.1,53.19A35.87,35.87,0,0,1,100,184h56.1A36.13,36.13,0,0,1,170,157.49,67.68,67.68,0,0,0,196,104Zm-20.07-5.32a48.5,48.5,0,0,0-31.91-40,12,12,0,0,0-8,22.62,24.31,24.31,0,0,1,16.09,20,12,12,0,0,0,23.86-2.64Z"></path></svg>
                                         <p className="text-gray-600 text-xs md:text-base leading-relaxed">
                                             <span className="font-semibold text-red-600">Vale saber:</span> são permitidos arquivos de áudio (mp3, ogg, m4a, .zip ou .rar), de até 250 MB.
                                         </p>
                                     </div>

                                    {/* Upload Progress */}
                                    {uploading && (
                                        <div className="space-y-4 p-5 bg-gradient-to-br from-red-50 to-red-100/50 rounded-xl border-2 border-red-200 shadow-md">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="animate-pulse">
                                                        <div className="w-3 h-3 bg-red-600 rounded-full"></div>
                                                    </div>
                                                    <span className="text-gray-800 font-semibold text-sm">Enviando álbum...</span>
                                                </div>
                                                <span className="text-red-600 font-bold text-lg">{uploadProgress}%</span>
                                            </div>
                                            <div className="space-y-2">
                                                <style>{`
                                                    @keyframes stripes {
                                                        0% { background-position: 0 0; }
                                                        100% { background-position: 40px 0; }
                                                    }
                                                    .animated-stripes {
                                                        background-color: #dc2626;
                                                        background-image: repeating-linear-gradient(
                                                            45deg,
                                                            #dc2626,
                                                            #dc2626 10px,
                                                            #b91c1c 10px,
                                                            #b91c1c 20px
                                                        );
                                                        background-size: 40px 40px;
                                                        animation: stripes 1s linear infinite;
                                                    }
                                                `}</style>
                                                <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden shadow-inner">
                                                    <div
                                                        className="animated-stripes h-full rounded-full transition-all duration-500 ease-out shadow-lg"
                                                        style={{ width: `${uploadProgress}%` }}
                                                    />
                                                </div>
                                                <p className="text-lg text-gray-600 font-bold">
                                                    {uploadProgress < 100 ? '⚠️ Por favor, não feche esta página' : '✓ Upload concluído!'}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                </div>

                                <div className="flex gap-3 md:gap-4 pt-4 md:pt-6">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handlePreviousStep}
                                        disabled={uploading || uploadSuccess}
                                        className="flex-1 text-sm md:text-base py-2 md:py-3"
                                    >
                                        Voltar
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={uploading || uploadSuccess || !formData.albumFile}
                                        className="flex-1 bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm md:text-base py-2 md:py-3 flex items-center justify-center"
                                    >
                                        <Upload className="w-4 md:w-5 h-4 md:h-5 mr-1 md:mr-2 flex-shrink-0" />
                                        <span className="hidden md:inline">{uploading ? `Enviando ${uploadProgress}%...` : uploadSuccess ? 'Enviado!' : 'Publicar Álbum'}</span>
                                        <span className="md:hidden">{uploading ? `${uploadProgress}%` : uploadSuccess ? 'Enviado!' : 'Publicar'}</span>
                                    </Button>
                                </div>
                            </form>
                        </Card>
                    )}

                    {/* Metadata Selection Dialog */}
                    {showMetadataSelection && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                            <Card className="bg-white shadow-lg w-full max-w-2xl mx-auto">
                                <div className="p-6 space-y-6">
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Informações do Álbum</h3>
                                        <p className="text-sm text-gray-600">Selecione se deseja preencher compositor e ISRC das músicas</p>
                                    </div>

                                    <div className="space-y-6">
                                        {/* Compositor */}
                                        <div>
                                            <Label className="text-gray-900 font-semibold mb-4 block">COMPOSITOR(A)</Label>
                                            <p className="text-sm text-gray-600 mb-4">Selecione se há compositor(a) no arquivo.</p>
                                            <div className="flex gap-6">
                                                <label className="flex items-center gap-3 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="composer"
                                                        value="sim"
                                                        checked={needsComposer === 'sim'}
                                                        onChange={(e) => setNeedsComposer(e.target.value)}
                                                        className="w-4 h-4 text-red-600"
                                                    />
                                                    <span className="text-gray-700">Sim</span>
                                                </label>
                                                <label className="flex items-center gap-3 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="composer"
                                                        value="nao"
                                                        checked={needsComposer === 'nao'}
                                                        onChange={(e) => setNeedsComposer(e.target.value)}
                                                        className="w-4 h-4 text-red-600"
                                                    />
                                                    <span className="text-gray-700">Não</span>
                                                </label>
                                            </div>
                                        </div>

                                        {/* ISRC */}
                                        <div>
                                            <Label className="text-gray-900 font-semibold mb-4 block">ISRC</Label>
                                            <p className="text-sm text-gray-600 mb-4">Selecione se as músicas do álbum contêm ISRC (International Standard Recording Code - Código de Gravação Padrão Internacional).</p>
                                            <div className="flex gap-6">
                                                <label className="flex items-center gap-3 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="isrc"
                                                        value="sim"
                                                        checked={needsISRC === 'sim'}
                                                        onChange={(e) => setNeedsISRC(e.target.value)}
                                                        className="w-4 h-4 text-red-600"
                                                    />
                                                    <span className="text-gray-700">Sim</span>
                                                </label>
                                                <label className="flex items-center gap-3 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="isrc"
                                                        value="nao"
                                                        checked={needsISRC === 'nao'}
                                                        onChange={(e) => setNeedsISRC(e.target.value)}
                                                        className="w-4 h-4 text-red-600"
                                                    />
                                                    <span className="text-gray-700">Não</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-4 pt-4">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setShowMetadataSelection(false)}
                                            className="flex-1"
                                        >
                                            Cancelar
                                        </Button>
                                        <Button
                                            onClick={handleMetadataSelection}
                                            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                                        >
                                            Continuar
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    )}

                    {/* Step 4: Song Metadata */}
                    {currentStep === 4 && (
                        <Card className="bg-white shadow-sm">
                            <div className="p-6 space-y-6">
                                <div>
                                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Enviado com sucesso!</h2>
                                    <p className="text-sm text-gray-600">
                                        Preencha mais informações sobre as faixas (Compositores, ISRC, linguagem explícita, etc.)
                                    </p>
                                </div>

                                {/* Songs List */}
                                <div className="space-y-6">
                                    {songs.map((song, index) => (
                                        <div key={song.id} className="space-y-3">
                                            <div>
                                                <h3 className="text-gray-900 font-semibold text-lg">{song.name}</h3>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {needsComposer === 'sim' && (
                                                    <div>
                                                        <Label htmlFor={`composer-${song.id}`} className="text-gray-700 font-semibold mb-2 block">
                                                            Compositores (opcional)
                                                        </Label>
                                                        <Input
                                                            id={`composer-${song.id}`}
                                                            type="text"
                                                            placeholder="Digite aqui o compositor"
                                                            value={songMetadata[song.id]?.composer || ''}
                                                            onChange={(e) => setSongMetadata(prev => ({
                                                                ...prev,
                                                                [song.id]: { ...prev[song.id], composer: e.target.value }
                                                            }))}
                                                            className="border-gray-300 focus:border-red-500 focus:ring-red-500"
                                                        />
                                                    </div>
                                                )}

                                                {needsISRC === 'sim' && (
                                                    <div>
                                                        <Label htmlFor={`isrc-${song.id}`} className="text-gray-700 font-semibold mb-2 block">
                                                            ISRC (opcional)
                                                        </Label>
                                                        <Input
                                                            id={`isrc-${song.id}`}
                                                            type="text"
                                                            placeholder="Insira o ISRC da faixa"
                                                            value={songMetadata[song.id]?.isrc || ''}
                                                            onChange={(e) => setSongMetadata(prev => ({
                                                                ...prev,
                                                                [song.id]: { ...prev[song.id], isrc: e.target.value }
                                                            }))}
                                                            className="border-gray-300 focus:border-red-500 focus:ring-red-500"
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            {index < songs.length - 1 && <hr className="border-gray-200 mt-6" />}
                                        </div>
                                    ))}
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handlePreviousStep}
                                        disabled={uploading}
                                        className="flex-1"
                                    >
                                        Voltar
                                    </Button>
                                    <Button
                                        onClick={() => performUpload(false)}
                                        disabled={uploading}
                                        className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                                    >
                                        <Upload className="w-5 h-5 mr-2" />
                                        {uploading ? `Publicando ${uploadProgress}%...` : 'Publicar'}
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Modal de Colaboradores */}
                    {showCollaboratorsModal && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                            <Card className="bg-white shadow-2xl w-full max-w-lg mx-auto rounded-2xl overflow-hidden">
                                {/* Header */}
                                <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-5">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                                                <Users className="w-5 h-5 text-white" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-white">Convidar Colaboradores</h3>
                                                <p className="text-red-100 text-sm">Busque artistas para colaborar</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setShowCollaboratorsModal(false);
                                                setSearchQuery('');
                                                setSearchResults([]);
                                                setShowSearchResults(false);
                                            }}
                                            className="text-white/80 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-full"
                                        >
                                            <X className="w-6 h-6" />
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="p-6 space-y-4">
                                    {/* Search Input */}
                                    <div className="relative">
                                        <div className="relative flex items-center">
                                            <Search className="absolute left-4 w-5 h-5 text-gray-400 pointer-events-none" />
                                            <Input
                                                type="text"
                                                placeholder="Digite o nome do artista..."
                                                value={searchQuery}
                                                onChange={(e) => handleSearchArtists(e.target.value)}
                                                className="pl-12 pr-4 py-3 h-12 text-base border-2 border-gray-200 focus:border-red-500 focus:ring-red-500 rounded-xl"
                                                autoFocus
                                            />
                                        </div>

                                        {/* Search Results Dropdown */}
                                        {showSearchResults && (
                                            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl z-20 max-h-80 overflow-y-auto border border-gray-200">
                                                {searching && (
                                                    <div className="p-4 text-center text-sm text-gray-500">
                                                        <span className="inline-block animate-spin">⌛</span> Buscando...
                                                    </div>
                                                )}
                                                {!searching && searchResults.length === 0 && searchQuery.trim() && (
                                                    <div className="p-4 text-center text-sm text-gray-500">
                                                        Nenhum artista encontrado para "{searchQuery}"
                                                    </div>
                                                )}
                                                {!searching && searchResults.length > 0 && (
                                                    <div className="py-2">
                                                        {searchResults.map((artist, index) => {
                                                            // Gerar iniciais para avatar
                                                            const initials = artist.name
                                                                .split(' ')
                                                                .slice(0, 2)
                                                                .map(n => n[0])
                                                                .join('')
                                                                .toUpperCase();
                                                            
                                                            const colors = ['bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-orange-500', 'bg-green-500', 'bg-red-500', 'bg-indigo-500', 'bg-cyan-500'];
                                                            const colorIndex = (artist.id || '').charCodeAt(0) % colors.length;
                                                            const bgColor = colors[colorIndex];
                                                            const isAlreadyAdded = collaborators.some(c => c.id === artist.id);

                                                            return (
                                                                <button
                                                                    key={artist.id}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        if (!isAlreadyAdded) {
                                                                            handleAddCollaborator(artist);
                                                                        }
                                                                    }}
                                                                    disabled={isAlreadyAdded}
                                                                    className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                                                                        isAlreadyAdded 
                                                                            ? 'opacity-60 cursor-not-allowed bg-gray-50' 
                                                                            : 'hover:bg-gray-50 cursor-pointer'
                                                                    } ${index < searchResults.length - 1 ? 'border-b border-gray-100' : ''}`}
                                                                >
                                                                    {/* Avatar */}
                                                                    <div className="relative flex-shrink-0">
                                                                        {artist.profile_image ? (
                                                                            <img
                                                                                src={artist.profile_image}
                                                                                alt={artist.name}
                                                                                className="w-14 h-14 rounded-full object-cover border-2 border-gray-200"
                                                                                onError={(e) => {
                                                                                    e.target.style.display = 'none';
                                                                                    e.target.nextSibling?.style.removeProperty('display');
                                                                                }}
                                                                            />
                                                                        ) : null}
                                                                        <div 
                                                                            className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 ${bgColor} font-bold text-white text-base border-2 border-gray-200 ${artist.profile_image ? 'hidden' : ''}`}
                                                                            style={artist.profile_image ? { display: 'none' } : {}}
                                                                        >
                                                                            {initials}
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    {/* Informações do artista */}
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center gap-1.5 mb-1">
                                                                            <p className="text-sm font-semibold text-gray-900">{artist.name}</p>
                                                                            {artist.verified && (
                                                                                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: '#00bcd4'}}>
                                                                                    <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"></path>
                                                                                    <path d="m9 12 2 2 4-4"></path>
                                                                                </svg>
                                                                            )}
                                                                        </div>
                                                                        <div className="space-y-0.5">
                                                                            <p className="text-xs text-gray-600 truncate">
                                                                                @{artist.username || artist.name.toLowerCase().replace(/\s+/g, '')}
                                                                            </p>
                                                                            <p className="text-xs font-medium text-gray-700 flex items-center gap-1">
                                                                                <span>👥</span>
                                                                                <span>{(artist.followers || 0).toLocaleString('pt-BR')} seguidores</span>
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    {/* Status */}
                                                                    {isAlreadyAdded && (
                                                                        <div className="flex-shrink-0 text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                                                            Adicionado
                                                                        </div>
                                                                    )}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Colaboradores adicionados */}
                                    {collaborators.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-gray-200">
                                            <p className="text-sm font-semibold text-gray-700 mb-3">
                                                Colaboradores ({collaborators.length})
                                            </p>
                                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                                 {collaborators.map((artist) => (
                                                     <div
                                                         key={artist.id}
                                                         className="flex items-center justify-between p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                                                     >
                                                         <div className="flex items-center gap-2 flex-1 min-w-0">
                                                             {artist.profile_image ? (
                                                                 <img
                                                                     src={artist.profile_image}
                                                                     alt={artist.name}
                                                                     className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                                                                 />
                                                             ) : (
                                                                 <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                                                     {artist.name.charAt(0)}
                                                                 </div>
                                                             )}
                                                             <div className="min-w-0 flex-1">
                                                                 <div className="flex items-center gap-1 mb-0.5">
                                                                     <p className="text-xs font-medium text-gray-900 truncate">
                                                                         {artist.name}
                                                                     </p>
                                                                     {artist.verified && (
                                                                         <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: '#00bcd4'}}>
                                                                             <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"></path>
                                                                             <path d="m9 12 2 2 4-4"></path>
                                                                         </svg>
                                                                     )}
                                                                 </div>
                                                                 <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 mt-1">
                                                                     <Clock className="w-3 h-3" />
                                                                     Aguardando resposta
                                                                 </span>
                                                             </div>
                                                         </div>
                                                         <button
                                                             type="button"
                                                             onClick={() => handleRemoveCollaborator(artist.id)}
                                                             className="text-gray-400 hover:text-red-600 transition-colors flex-shrink-0 ml-2 hover:bg-red-50 p-1 rounded"
                                                             title="Remover"
                                                         >
                                                             <X className="w-4 h-4" />
                                                         </button>
                                                     </div>
                                                 ))}
                                             </div>
                                        </div>
                                    )}

                                    {/* Action Buttons */}
                                    <div className="flex gap-3 pt-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => {
                                                setShowCollaboratorsModal(false);
                                                setTimeout(() => {
                                                    setSearchQuery('');
                                                    setSearchResults([]);
                                                    setShowSearchResults(false);
                                                }, 100);
                                            }}
                                            className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
                                        >
                                            Cancelar
                                        </Button>
                                        <Button
                                            type="button"
                                            onClick={() => {
                                                setShowCollaboratorsModal(false);
                                                setTimeout(() => {
                                                    setSearchQuery('');
                                                    setSearchResults([]);
                                                    setShowSearchResults(false);
                                                }, 100);
                                            }}
                                            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold"
                                        >
                                            {collaborators.length > 0 ? `Confirmar (${collaborators.length})` : 'Fechar'}
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    )}

                    {showSuccessModal && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                            <Card className="bg-white shadow-2xl w-full max-w-md mx-auto">
                                <div className="p-8 space-y-6 text-center">
                                    <div className="flex justify-center">
                                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                                            <CheckCircle className="w-10 h-10 text-green-600" />
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <h2 className="text-2xl font-bold text-gray-900">Álbum Enviado!</h2>
                                        <p className="text-gray-600">Seu álbum foi enviado com sucesso e já está disponível na plataforma.</p>
                                    </div>

                                    <Button
                                        onClick={() => {
                                            setShowSuccessModal(false);
                                            setFormData({
                                                title: '',
                                                description: '',
                                                genre: '',
                                                tags: [],
                                                coverImage: null,
                                                youtubeUrl: '',
                                                isPublic: true,
                                                publishType: 'immediate',
                                                scheduleDate: '',
                                                scheduleTime: '',
                                                releaseDate: '',
                                                customUrl: '',
                                                albumFile: null
                                            });
                                            setCoverImagePreview(null);
                                            setYoutubePreview('');
                                            setUploadSuccess(false);
                                            setUploadProgress(0);
                                            setCurrentStep(1);
                                            
                                            const fileInputs = document.querySelectorAll('input[type="file"]');
                                            fileInputs.forEach(input => input.value = '');
                                            
                                            navigate('/artist/albums');
                                        }}
                                        className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold"
                                    >
                                        OK
                                    </Button>
                                </div>
                            </Card>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UploadNew;
