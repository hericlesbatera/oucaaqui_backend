/**
 * Helper para detectar ambiente e gerenciar downloads
 */

export const isMobileApp = () => {
    if (typeof window === 'undefined') return false;
    
    // Verificar se está em Capacitor (mobile app)
    const hasCapacitor = window.Capacitor !== undefined;
    
    if (!hasCapacitor) return false;
    
    // Se tem Capacitor, verificar se é realmente um app (não web)
    const platform = window.Capacitor.getPlatform?.();
    const isNativeApp = platform === 'android' || platform === 'ios';
    
    console.log('🔧 Platform:', platform, 'isNativeApp:', isNativeApp);
    
    return isNativeApp;
};

export const isDesktop = () => {
    return !isMobileApp();
};

export const getPlatform = () => {
    if (!isMobileApp()) return 'desktop';
    return window.Capacitor.getPlatform?.() || 'web';
};

/**
 * Função unificada de download
 * @param {Object} params
 * @param {Object} params.album - Dados do álbum
 * @param {Array} params.albumSongs - Lista de músicas
 * @param {Function} params.onDesktop - Callback para download desktop (ZIP/RAR)
 * @param {Function} params.onMobile - Callback para download mobile (MP3s individuais)
 * @param {Function} params.onProgress - Callback de progresso
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
        console.log('========== DOWNLOAD ==========');
        console.log('isMobileApp():', isMobile);
        console.log('window.Capacitor:', window.Capacitor);
        if (window.Capacitor) {
            console.log('Platform:', window.Capacitor.getPlatform?.());
        }
        console.log('=============================');
        
        if (isMobile) {
            console.log('🎵 Detectado: Mobile App - Baixando MP3s individuais');
            return await onMobile?.({ album, albumSongs, onProgress });
        } else {
            console.log('💻 Detectado: Desktop/Web - Baixando ZIP');
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
