import { useState, useCallback, useEffect } from 'react';
import { Filesystem, Directory, FilesystemDirectory, Encoding } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { CapacitorHttp } from '@capacitor/core';
import { Http } from '@capacitor-community/http';

const DOWNLOADS_DIR = 'music_downloads';
const METADATA_KEY = 'downloaded_albums';

// Função utilitária para verificar se o Capacitor está disponível
export const isCapacitorAvailable = () => {
    if (typeof window === 'undefined' || !window.Capacitor) return false;
    let isNative = false;
    if (typeof window.Capacitor.isNativePlatform === 'function') {
        isNative = window.Capacitor.isNativePlatform();
    } else if (window.Capacitor.isNativePlatform === true) {
        isNative = true;
    }
    const platform = window.Capacitor.getPlatform?.();
    if (platform === 'android' || platform === 'ios') {
        isNative = true;
    }
    return isNative;
};

// Salvar metadados em cache local
const saveMetadata = async (downloads) => {
    await Preferences.set({
        key: METADATA_KEY,
        value: JSON.stringify(downloads)
    });
};

// Carregar metadados do cache
const loadMetadata = async () => {
    try {
        const { value } = await Preferences.get({ key: METADATA_KEY });
        return value ? JSON.parse(value) : [];
    } catch (error) {
        console.error('Erro ao carregar metadados:', error);
        return [];
    }
};

// Criar pasta de downloads se não existir
const ensureDownloadsDir = async () => {
    if (!isCapacitorAvailable()) return;

    try {
        await Filesystem.mkdir({
            path: DOWNLOADS_DIR,
            directory: Directory.Data,
            recursive: true
        });
    } catch (error) {
        console.log('Pasta de downloads já existe ou erro ao criar:', error.message);
    }
};

// Converter URL para arquivo local
const downloadFile = async (url, fileName, albumDir) => {
    const startTime = Date.now();
    
    try {
        if (!url) {
            throw new Error(`URL vazia para arquivo ${fileName}`);
        }

        console.log(`Iniciando download: ${fileName}`);
        console.log(`   URL: ${url}`);

        // Tentar baixar diretamente com Http.downloadFile
        try {
            const albumPath = `${DOWNLOADS_DIR}/${albumDir}`;
            try { await Filesystem.mkdir({ path: albumPath, directory: Directory.Data, recursive: true }); } catch {}
            const filePath = `${albumPath}/${fileName}`;
            console.log(`   Usando Http.downloadFile -> ${filePath}`);
            const res = await Http.downloadFile({
                url,
                filePath,
                fileDirectory: FilesystemDirectory.Data,
                method: 'GET'
            });
            console.log(`   Http.downloadFile OK: ${JSON.stringify(res)}`);
            return true;
        } catch (httpErr) {
            console.warn(`   Http.downloadFile falhou: ${httpErr.message}. Fallback para CapacitorHttp...`);
        }

        // Usar CapacitorHttp nativo (ignora CORS)
        let base64Data;
        
        try {
            console.log(`   Usando CapacitorHttp (nativo)...`);
            const response = await CapacitorHttp.get({
                url: url,
                responseType: 'blob',
                headers: {
                    'Accept': 'audio/mpeg,audio/*,*/*'
                }
            });
            
            if (response.status !== 200) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            base64Data = response.data;
            console.log(`   CapacitorHttp OK - ${(base64Data?.length || 0)} chars`);
            
        } catch (nativeError) {
            console.warn(`   CapacitorHttp falhou: ${nativeError.message}, tentando fetch...`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 120000);
            
            try {
                const response = await fetch(url, {
                    method: 'GET',
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                const blob = await response.blob();
                if (blob.size === 0) {
                    throw new Error('Arquivo vazio');
                }
                
                base64Data = await blobToBase64(blob);
                console.log(`   Fetch OK - ${blob.size} bytes`);
                
            } catch (fetchError) {
                clearTimeout(timeoutId);
                throw new Error(`Download falhou: ${fetchError.message}`);
            }
        }

        // Remove o prefixo data:audio/mpeg;base64, se existir
        const cleanBase64 = base64Data?.includes?.(',')
            ? base64Data.split(',')[1]
            : base64Data;

        if (!cleanBase64 || cleanBase64.length === 0) {
            throw new Error(`Base64 vazio para ${fileName}`);
        }

        // Criar pasta do álbum
        const albumPath = `${DOWNLOADS_DIR}/${albumDir}`;

        try {
            await Filesystem.mkdir({
                path: albumPath,
                directory: Directory.Data,
                recursive: true
            });
            console.log(`Pasta criada/verificada: ${albumPath}`);
        } catch (mkdirError) {
            if (mkdirError.message && mkdirError.message.includes('exist')) {
                console.log(`Pasta já existe: ${albumPath}`);
            } else {
                throw mkdirError;
            }
        }

        // Salvar arquivo em base64
        const filePath = `${albumPath}/${fileName}`;
        console.log(`Salvando arquivo: ${filePath}`);
        console.log(`   Tamanho base64: ${cleanBase64.length} caracteres (${(cleanBase64.length / 1024 / 1024).toFixed(2)}MB)`);

        const writeResult = await Filesystem.writeFile({
            path: filePath,
            data: cleanBase64,
            directory: Directory.Data,
            encoding: Encoding.Base64
        });

        const elapsed = Date.now() - startTime;
        console.log(`Arquivo salvo com sucesso: ${filePath}`);
        console.log(`   Tempo total: ${elapsed}ms (${(elapsed / 1000).toFixed(2)}s)`);
        console.log(`   Resultado: ${JSON.stringify(writeResult)}`);
        return true;
    } catch (error) {
        const elapsed = Date.now() - startTime;
        console.error(`Erro ao baixar arquivo ${fileName} (apos ${(elapsed / 1000).toFixed(2)}s):`, error);
        console.error(`   Mensagem: ${error.message}`);
        if (error.stack) {
            console.error(`   Stack: ${error.stack}`);
        }
        throw error;
    }
};

// Converter Blob para Base64 com timeout e otimização
const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
        try {
            const timeoutId = setTimeout(() => {
                reject(new Error('Timeout na conversao Base64 - arquivo muito grande ou conexao lenta'));
            }, 60000);

            const reader = new FileReader();

            reader.onloadend = () => {
                clearTimeout(timeoutId);
                try {
                    if (!reader.result) {
                        throw new Error('FileReader retornou resultado vazio');
                    }

                    const base64 = reader.result.includes(',')
                        ? reader.result.split(',')[1]
                        : reader.result;

                    if (!base64 || base64.length === 0) {
                        throw new Error('Base64 esta vazio apos split');
                    }

                    console.log(`Blob convertido para base64 (${base64.length} chars, ${(base64.length / 1024 / 1024).toFixed(2)}MB)`);
                    resolve(reader.result);
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = (error) => {
                clearTimeout(timeoutId);
                console.error('Erro no FileReader:', error);
                reject(new Error(`FileReader error: ${error.message}`));
            };

            reader.onprogress = (event) => {
                if (event.lengthComputable) {
                    const progress = (event.loaded / event.total * 100).toFixed(0);
                    const mb = (event.loaded / 1024 / 1024).toFixed(2);
                    console.log(`   Progresso conversao: ${progress}% (${mb}MB)`);
                }
            };

            reader.readAsDataURL(blob);
        } catch (error) {
            reject(error);
        }
    });
};

// Deletar arquivo
const deleteFile = async (filePath) => {
    if (!isCapacitorAvailable()) return;

    try {
        await Filesystem.deleteFile({
            path: filePath,
            directory: Directory.Data
        });
    } catch (error) {
        console.error('Erro ao deletar arquivo:', error);
        throw error;
    }
};

// Deletar pasta do álbum
const deleteDirectory = async (dirPath) => {
    if (!isCapacitorAvailable()) return;

    try {
        await Filesystem.rmdir({
            path: dirPath,
            directory: Directory.Data,
            recursive: true
        });
    } catch (error) {
        console.error('Erro ao deletar pasta:', error);
        throw error;
    }
};

// Sanitizar nomes de arquivo
function sanitizePath(name) {
    return name
        .replace(/[<>:"/\\|?*]/g, '_')
        .replace(/\s+/g, '_')
        .substring(0, 100);
}

// Hook customizado
export const useCapacitorDownloads = (onSongDownloadStart) => {
    const [downloads, setDownloads] = useState([]);
    const [loading, setLoading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState({});

    // Inicializar
    useEffect(() => {
        if (isCapacitorAvailable()) {
            ensureDownloadsDir();
            loadDownloads();
        }
    }, []);

    const loadDownloads = useCallback(async () => {
        setLoading(true);
        try {
            const metadata = await loadMetadata();
            setDownloads(metadata);
        } catch (error) {
            console.error('Erro ao carregar downloads:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const downloadAlbum = useCallback(async (album, songs) => {
        const debugLogs = [];
        const originalLog = console.log;
        const originalError = console.error;

        const captureLog = (...args) => {
            originalLog(...args);
            debugLogs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
        };

        console.log = captureLog;
        console.error = captureLog;

        try {
            console.log('==========================================');
            console.log('INICIANDO DOWNLOAD DE ALBUM');
            console.log('==========================================');
            console.log('Album:', {
                id: album?.id,
                title: album?.title,
                artist: album?.artist_name
            });
            console.log('Numero de musicas:', songs?.length);
            console.log('Capacitor disponivel:', isCapacitorAvailable());

            if (!isCapacitorAvailable()) {
                console.error('Capacitor nao disponivel! Abortando download.');
                throw new Error('Capacitor nao disponivel para download de arquivo');
            }

            if (!album || !album.id || !album.title) {
                console.error('Album invalido:', album);
                throw new Error('Dados do album invalidos');
            }

            if (!songs || songs.length === 0) {
                console.error('Nenhuma musica para baixar');
                throw new Error('Album sem musicas');
            }

            const albumDir = sanitizePath(album.title);
            console.log('Pasta do album:', albumDir);
            console.log('==========================================');

            // Validar URLs antes de começar
            const songsWithValidURLs = songs.filter(song => {
                const url = song?.audioUrl || song?.audio_url || song?.url;
                return !!url;
            });

            console.log(`Musicas com URL valida: ${songsWithValidURLs.length}/${songs.length}`);

            if (songsWithValidURLs.length === 0) {
                console.error('Nenhuma musica possui URL de audio valida!');
                throw new Error('Nenhuma musica possui URL de audio valida. Verifique se as musicas foram carregadas corretamente.');
            }

            const downloadedSongs = [];
            let successCount = 0;
            let failCount = 0;
            let lastError = '';

            // iniciar progresso em 0
            setDownloadProgress(prev => ({
                ...prev,
                [album.id]: { current: 0, total: songsWithValidURLs.length }
            }));

            for (let i = 0; i < songs.length; i++) {
                const song = songs[i];

                if (!song) {
                    console.warn(`Musica ${i + 1} e invalida (null/undefined)`);
                    failCount++;
                    continue;
                }

                const songUrl = song.audioUrl || song.audio_url || song.url;
                const fileName = `${String(i + 1).padStart(2, '0')} - ${sanitizePath(song.title || 'desconhecido')}.mp3`;

                console.log(`\nMUSICA ${i + 1}/${songs.length}`);
                console.log(`   Titulo: ${song.title}`);
                console.log(`   ID: ${song.id}`);
                console.log(`   URL: ${songUrl ? 'presente' : 'VAZIA'}`);

                if (!songUrl) {
                    console.error(`URL nao encontrada para: ${song.title}`);
                    failCount++;
                    continue;
                }

                // Callback para informar qual música está sendo baixada
                if (onSongDownloadStart) {
                    onSongDownloadStart({
                        song: song.title,
                        index: successCount + failCount + 1,
                        total: songsWithValidURLs.length
                    });
                }

                try {
                    console.log(`   Iniciando download...`);
                    await downloadFile(songUrl, fileName, albumDir);

                    downloadedSongs.push({
                        id: song.id,
                        title: song.title,
                        fileName: fileName
                    });

                    console.log(`   SUCESSO`);
                    successCount++;
                    setDownloadProgress(prev => ({
                        ...prev,
                        [album.id]: { current: successCount, total: songsWithValidURLs.length }
                    }));
                } catch (error) {
                    console.error(`   FALHA: ${error.message}`);
                    lastError = `${song.title}: ${error.message}`;
                    failCount++;
                    setDownloadProgress(prev => ({
                        ...prev,
                        [album.id]: { current: successCount, total: songsWithValidURLs.length, failed: failCount, lastError }
                    }));
                }
            }

            console.log('\n==========================================');
            console.log('RESUMO DO DOWNLOAD');
            console.log(`   Sucesso: ${successCount}/${songsWithValidURLs.length}`);
            console.log(`   Falha: ${failCount}/${songsWithValidURLs.length}`);
            console.log(`   Ultimo erro: ${lastError}`);
            console.log('==========================================\n');

            // Verificar se alguma música foi baixada com sucesso
            if (downloadedSongs.length === 0) {
                console.error('Nenhuma musica foi baixada com sucesso!');
                const errorMsg = lastError 
                    ? `Erro: ${lastError}` 
                    : 'Verifique sua conexao e espaco disponivel.';
                throw new Error(`Falha ao baixar. ${errorMsg}`);
            }
            
            // Se algumas músicas falharam mas outras funcionaram, continuar com as que funcionaram
            if (failCount > 0 && successCount > 0) {
                console.warn(`Download parcial: ${successCount} de ${songs.length} musicas baixadas`);
            }

            // Salvar metadados do álbum
            const albumDownload = {
                albumId: album.id,
                title: album.title,
                artist: album.artist_name || album.artistName || 'Desconhecido',
                coverUrl: album.cover_url || album.coverImage,
                albumDir: albumDir,
                downloadedAt: new Date().toISOString(),
                songCount: downloadedSongs.length,
                totalSongs: songs.length,
                songs: downloadedSongs
            };

            console.log('Salvando metadados:', {
                albumId: albumDownload.albumId,
                title: albumDownload.title,
                musicas: albumDownload.songs.length
            });

            let updatedDownloads = [...downloads, albumDownload];

            // Salvar metadados
            try {
                await saveMetadata(updatedDownloads);
                console.log('Metadados salvos com sucesso');
            } catch (saveError) {
                console.error('Erro ao salvar metadados:', saveError);
                console.warn('Tentando salvar metadados simplificados...');
                try {
                    const simplifiedDownload = {
                        albumId: album.id,
                        title: album.title,
                        artist: album.artist_name || 'Desconhecido',
                        albumDir: sanitizePath(album.title),
                        downloadedAt: new Date().toISOString(),
                        songCount: downloadedSongs.length,
                        totalSongs: songs.length,
                        songs: downloadedSongs.map(s => ({ id: s.id, title: s.title, fileName: s.fileName }))
                    };
                    updatedDownloads = [...downloads, simplifiedDownload];
                    await saveMetadata(updatedDownloads);
                    console.log('Metadados simplificados salvos');
                } catch (retryError) {
                    console.error('Falha ao salvar metadados mesmo simplificados:', retryError);
                    console.warn('Musicas baixadas mas metadados nao salvos');
                }
            }

            // Atualizar estado
            setDownloads(updatedDownloads);

            setDownloadProgress(prev => {
                const newProgress = { ...prev };
                delete newProgress[album.id];
                return newProgress;
            });

            console.log('DOWNLOAD CONCLUIDO COM SUCESSO');
            console.log('   Album:', albumDownload.title);
            console.log('   Musicas:', downloadedSongs.length);
            console.log('==========================================\n');

            // Restaurar console originais
            console.log = originalLog;
            console.error = originalError;
            
            return albumDownload;
        } catch (error) {
            console.error('ERRO GERAL NO DOWNLOAD:', error);
            console.error('   Mensagem:', error.message);
            console.error('   Stack:', error.stack);

            // Restaurar console originais
            console.log = originalLog;
            console.error = originalError;
            
            // Adicionar logs de debug ao erro
            const errorWithDebug = new Error(error.message);
            errorWithDebug.debugLogs = debugLogs.slice(-50);
            errorWithDebug.stack = error.stack;
            
            // Limpar progresso em caso de erro
            setDownloadProgress(prev => {
                const newProgress = { ...prev };
                delete newProgress[album.id];
                return newProgress;
            });

            throw errorWithDebug;
        }
    }, [downloads, onSongDownloadStart]);

    const downloadSong = useCallback(async (song, album) => {
        if (!isCapacitorAvailable()) {
            throw new Error('Capacitor nao disponivel');
        }

        try {
            const albumDir = sanitizePath(album.title);
            const fileName = `${sanitizePath(song.title)}.mp3`;

            await downloadFile(song.url, fileName, albumDir);

            const updatedDownloads = downloads.map(dl => {
                if (dl.albumId === album.id) {
                    return {
                        ...dl,
                        songs: [...dl.songs, { id: song.id, title: song.title, fileName }],
                        songCount: dl.songs.length + 1
                    };
                }
                return dl;
            });

            setDownloads(updatedDownloads);
            await saveMetadata(updatedDownloads);

            return true;
        } catch (error) {
            console.error('Erro ao baixar musica:', error);
            throw error;
        }
    }, [downloads]);

    const deleteDownloadedAlbum = useCallback(async (albumId) => {
        if (!isCapacitorAvailable()) return;

        try {
            const album = downloads.find(d => d.albumId === albumId);
            if (album) {
                await deleteDirectory(`${DOWNLOADS_DIR}/${album.albumDir}`);
                const updated = downloads.filter(d => d.albumId !== albumId);
                setDownloads(updated);
                await saveMetadata(updated);
            }
        } catch (error) {
            console.error('Erro ao deletar album:', error);
            throw error;
        }
    }, [downloads]);

    const deleteDownloadedSong = useCallback(async (albumId, songId, fileName) => {
        if (!isCapacitorAvailable()) return;

        try {
            const album = downloads.find(d => d.albumId === albumId);
            if (album) {
                const filePath = `${DOWNLOADS_DIR}/${album.albumDir}/${fileName}`;
                await deleteFile(filePath);

                const updated = downloads.map(dl => {
                    if (dl.albumId === albumId) {
                        return {
                            ...dl,
                            songs: dl.songs.filter(s => s.id !== songId),
                            songCount: dl.songs.length - 1
                        };
                    }
                    return dl;
                }).filter(dl => dl.songCount > 0);

                setDownloads(updated);
                await saveMetadata(updated);
            }
        } catch (error) {
            console.error('Erro ao deletar musica:', error);
            throw error;
        }
    }, [downloads]);

    const isAlbumDownloaded = useCallback((albumId) => {
        return downloads.some(d => d.albumId === albumId);
    }, [downloads]);

    const getDownloadedAlbum = useCallback((albumId) => {
        return downloads.find(d => d.albumId === albumId);
    }, [downloads]);

    return {
        downloads,
        loading,
        downloadProgress,
        downloadAlbum,
        downloadSong,
        deleteDownloadedAlbum,
        deleteDownloadedSong,
        isAlbumDownloaded,
        getDownloadedAlbum,
        loadDownloads,
        isCapacitorAvailable: isCapacitorAvailable()
    };
};

export default useCapacitorDownloads;
