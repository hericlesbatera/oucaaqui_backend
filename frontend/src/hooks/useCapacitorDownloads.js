import { useState, useCallback, useEffect } from 'react';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';

const DOWNLOADS_DIR = 'downloads';
const METADATA_KEY = 'downloads_metadata';

// Verificar se está em ambiente Capacitor mobile
const isCapacitorAvailable = () => {
    if (typeof window === 'undefined') return false;
    
    const hasCapacitor = window.Capacitor !== undefined;
    if (!hasCapacitor) return false;
    
    const platform = window.Capacitor.getPlatform?.();
    const isNativeApp = platform === 'android' || platform === 'ios';
    
    return isNativeApp;
};

// Salvar metadados em cache local
const saveMetadata = async (downloads) => {
    try {
        await Preferences.set({
            key: METADATA_KEY,
            value: JSON.stringify(downloads)
        });
    } catch (error) {
        console.error('Erro ao salvar metadados:', error);
    }
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
            directory: Directory.Documents,
            recursive: true
        });
    } catch (error) {
        // Pasta pode já existir
        console.log('Pasta de downloads já existe ou erro ao criar:', error.message);
    }
};

// Converter URL para arquivo local
const downloadFile = async (url, fileName, albumDir) => {
    try {
        const response = await fetch(url, { 
            credentials: 'include' 
        });

        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }

        const blob = await response.blob();
        const base64Data = await blobToBase64(blob);
        
        // Remove o prefixo data:audio/mpeg;base64, se existir
        const cleanBase64 = base64Data.includes(',') 
            ? base64Data.split(',')[1] 
            : base64Data;

        // Criar pasta do álbum
        const albumPath = `${DOWNLOADS_DIR}/${albumDir}`;
        await Filesystem.mkdir({
            path: albumPath,
            directory: Directory.Documents,
            recursive: true
        });

        // Salvar arquivo em base64
        const filePath = `${albumPath}/${fileName}`;
        console.log(`📝 Salvando arquivo: ${filePath}`);
        
        await Filesystem.writeFile({
            path: filePath,
            data: cleanBase64,
            directory: Directory.Documents,
            encoding: Encoding.Base64
        });

        console.log(`✅ Arquivo salvo com sucesso: ${filePath}`);
        return true;
    } catch (error) {
        console.error(`Erro ao baixar arquivo ${fileName}:`, error);
        throw error;
    }
};

// Converter Blob para Base64
const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

// Deletar arquivo
const deleteFile = async (filePath) => {
    if (!isCapacitorAvailable()) return;

    try {
        await Filesystem.deleteFile({
            path: filePath,
            directory: Directory.Documents
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
            directory: Directory.Documents,
            recursive: true
        });
    } catch (error) {
        console.error('Erro ao deletar pasta:', error);
        throw error;
    }
};

// Hook customizado
export const useCapacitorDownloads = () => {
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
        if (!isCapacitorAvailable()) {
            throw new Error('Capacitor não disponível');
        }

        try {
            const albumDir = sanitizePath(album.title);
            const downloadedSongs = [];

            for (let i = 0; i < songs.length; i++) {
                const song = songs[i];
                const fileName = `${String(i + 1).padStart(2, '0')} - ${sanitizePath(song.title)}.mp3`;

                setDownloadProgress(prev => ({
                    ...prev,
                    [album.id]: { current: i + 1, total: songs.length }
                }));

                try {
                    await downloadFile(song.url, fileName, albumDir);
                    downloadedSongs.push({
                        id: song.id,
                        title: song.title,
                        fileName: fileName
                    });
                } catch (error) {
                    console.error(`Erro ao baixar ${song.title}:`, error);
                }
            }

            // Salvar metadados do álbum
            const albumDownload = {
                albumId: album.id,
                title: album.title,
                artist: album.artist_name || 'Desconhecido',
                coverUrl: album.cover_url,
                albumDir: albumDir,
                downloadedAt: new Date().toISOString(),
                songCount: downloadedSongs.length,
                totalSongs: songs.length,
                songs: downloadedSongs
            };

            const updatedDownloads = [...downloads, albumDownload];
            setDownloads(updatedDownloads);
            await saveMetadata(updatedDownloads);

            setDownloadProgress(prev => {
                const newProgress = { ...prev };
                delete newProgress[album.id];
                return newProgress;
            });

            return albumDownload;
        } catch (error) {
            console.error('Erro ao baixar álbum:', error);
            throw error;
        }
    }, [downloads]);

    const downloadSong = useCallback(async (song, album) => {
        if (!isCapacitorAvailable()) {
            throw new Error('Capacitor não disponível');
        }

        try {
            const albumDir = sanitizePath(album.title);
            const fileName = `${sanitizePath(song.title)}.mp3`;

            await downloadFile(song.url, fileName, albumDir);

            // Adicionar às músicas baixadas
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
            console.error('Erro ao baixar música:', error);
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
            console.error('Erro ao deletar álbum:', error);
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
            console.error('Erro ao deletar música:', error);
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

// Sanitizar nomes de arquivo
function sanitizePath(name) {
    return name
        .replace(/[<>:"/\\|?*]/g, '_')
        .replace(/\s+/g, '_')
        .substring(0, 100);
}

export default useCapacitorDownloads;
