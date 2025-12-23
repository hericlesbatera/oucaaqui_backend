/**
 * Helper para detectar ambiente e gerenciar downloads
 */

// Cache para evitar múltiplas verificações
let _isMobileAppCache = null;

export const isMobileApp = () => {
    // Retorna cache se já foi verificado
    if (_isMobileAppCache !== null) return _isMobileAppCache;
    
    if (typeof window === 'undefined') {
        _isMobileAppCache = false;
        return false;
    }
    
    try {
        // Verificar Capacitor
        if (window.Capacitor) {
            if (typeof window.Capacitor.isNativePlatform === 'function') {
                _isMobileAppCache = window.Capacitor.isNativePlatform();
                return _isMobileAppCache;
            }
            if (window.Capacitor.isNativePlatform === true) {
                _isMobileAppCache = true;
                return true;
            }
            if (typeof window.Capacitor.getPlatform === 'function') {
                const platform = window.Capacitor.getPlatform();
                _isMobileAppCache = platform === 'android' || platform === 'ios';
                return _isMobileAppCache;
            }
        }
        
        _isMobileAppCache = false;
        return false;
    } catch (error) {
        _isMobileAppCache = false;
        return false;
    }
};

export const isDesktop = () => {
    return !isMobileApp();
};

export const getPlatform = () => {
    try {
        if (window.Capacitor && typeof window.Capacitor.getPlatform === 'function') {
            return window.Capacitor.getPlatform();
        }
    } catch (e) {
        // Silenciar erro
    }
    return 'web';
};

/**
 * Função unificada de download
 */
export const handleDownload = async ({
    album,
    albumSongs,
    onDesktop,
    onMobile,
    onProgress
}) => {
    try {
        const isMobile = isMobileApp();
        
        if (isMobile) {
            return await onMobile?.({ album, albumSongs, onProgress });
        } else {
            return await onDesktop?.({ album, albumSongs });
        }
    } catch (error) {
        console.error('Erro no download:', error);
        throw error;
    }
};

export default {
    isMobileApp,
    isDesktop,
    getPlatform,
    handleDownload
};
