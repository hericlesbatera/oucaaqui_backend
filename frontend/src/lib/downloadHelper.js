/**
 * Helper para detectar ambiente e gerenciar downloads
 */

export const isMobileApp = () => {
    if (typeof window === 'undefined') return false;
    
    try {
        // Método 1: Verificar isNativePlatform (função)
        if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function') {
            const isNative = window.Capacitor.isNativePlatform();
            console.log('✅ Capacitor.isNativePlatform():', isNative);
            if (isNative) return true;
        }
        
        // Método 2: Verificar isNativePlatform (propriedade booleana)
        if (window.Capacitor && window.Capacitor.isNativePlatform === true) {
            console.log('✅ Capacitor.isNativePlatform === true');
            return true;
        }
        
        // Método 3: Verificar getPlatform
        if (window.Capacitor && typeof window.Capacitor.getPlatform === 'function') {
            const platform = window.Capacitor.getPlatform();
            const isNative = platform === 'android' || platform === 'ios';
            console.log('Platform detectado:', platform, 'isNative:', isNative);
            if (isNative) return true;
        }
        
        // Método 4: Verificar se Capacitor existe e não é 'web'
        if (window.Capacitor) {
            const platform = window.Capacitor.getPlatform?.() || 'web';
            if (platform !== 'web') {
                console.log('✅ Capacitor platform não é web:', platform);
                return true;
            }
        }
        
        console.log('❌ Detectado como Desktop/Web');
        return false;
    } catch (error) {
        console.error('Erro ao detectar plataforma:', error);
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
        console.error('Erro ao obter plataforma:', e);
    }
    return 'web';
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
