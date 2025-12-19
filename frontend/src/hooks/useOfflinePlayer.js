import { useState, useCallback } from 'react';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { isCapacitorAvailable } from './useCapacitorDownloads';

const DOWNLOADS_DIR = 'downloads';

/**
 * Hook para gerenciar reprodução de arquivos baixados offline
 * Converte arquivos locais em URLs reproduzíveis
 */
export const useOfflinePlayer = () => {
    const [offlineURLs, setOfflineURLs] = useState({});

    /**
     * Carregar URL reproduzível de uma música baixada
     * @param {string} albumDir - Diretório do álbum (título sanitizado)
     * @param {string} fileName - Nome do arquivo
     * @returns {Promise<string>} - URL do arquivo ou null
     */
    const getOfflineSongURL = useCallback(async (albumDir, fileName) => {
        if (!isCapacitorAvailable()) return null;

        const cacheKey = `${albumDir}/${fileName}`;
        
        // Verificar cache primeiro
        if (offlineURLs[cacheKey]) {
            return offlineURLs[cacheKey];
        }

        try {
            const filePath = `${DOWNLOADS_DIR}/${albumDir}/${fileName}`;
            
            // Ler o arquivo (retorna base64 por padrão)
            const file = await Filesystem.readFile({
                path: filePath,
                directory: Directory.Documents
            });

            // Criar blob URL a partir do base64
            const binaryString = atob(file.data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: 'audio/mpeg' });
            const url = URL.createObjectURL(blob);

            // Cachear
            setOfflineURLs(prev => ({
                ...prev,
                [cacheKey]: url
            }));

            return url;
        } catch (error) {
            console.error(`Erro ao carregar URL offline para ${fileName}:`, error);
            return null;
        }
    }, [offlineURLs]);

    /**
     * Carregar URLs de todas as músicas de um álbum
     * @param {string} albumDir - Diretório do álbum
     * @param {Array} songs - Array de músicas com fileName
     * @returns {Promise<Array>} - Array de músicas com audioUrl preenchida
     */
    const loadAlbumOfflineURLs = useCallback(async (albumDir, songs) => {
        if (!isCapacitorAvailable()) return songs;

        try {
            const songsWithURLs = await Promise.all(
                songs.map(async (song) => {
                    const audioUrl = await getOfflineSongURL(albumDir, song.fileName);
                    return {
                        ...song,
                        audioUrl: audioUrl || song.url, // Fallback para URL online se falhar
                        isOffline: !!audioUrl
                    };
                })
            );
            
            return songsWithURLs;
        } catch (error) {
            console.error('Erro ao carregar URLs offline do álbum:', error);
            return songs;
        }
    }, [getOfflineSongURL]);

    /**
     * Limpar cache de URLs
     */
    const clearURLCache = useCallback(() => {
        Object.values(offlineURLs).forEach(url => {
            URL.revokeObjectURL(url);
        });
        setOfflineURLs({});
    }, [offlineURLs]);

    return {
        getOfflineSongURL,
        loadAlbumOfflineURLs,
        clearURLCache,
        offlineURLs
    };
};

export default useOfflinePlayer;
