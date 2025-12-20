import React, { useState } from 'react';
import { X, Copy, ChevronDown, ChevronUp } from 'lucide-react';

// DEBUG BUTTON v1.0

export const DownloadProgressModal = ({ 
  isOpen, 
  status, 
  progress, 
  albumTitle,
  songCount,
  currentSong,
  currentSongIndex,
  errorMessage,
  onClose 
}) => {
  const [showDebug, setShowDebug] = useState(false);
  
  if (!isOpen) return null;

  const copyToClipboard = () => {
    const debugInfo = `
ERRO NO DOWNLOAD
================
Álbum: ${albumTitle}
Mensagem: ${errorMessage}
Data: ${new Date().toLocaleString()}
User Agent: ${navigator.userAgent}
URL: ${window.location.href}
================
Console Logs:
${document.querySelector('[data-debug-logs]')?.innerText || 'Nenhum log'}
    `.trim();
    
    navigator.clipboard.writeText(debugInfo).then(() => {
      alert('✅ Erro copiado para clipboard!');
    });
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'preparing':
        return 'Preparando download...';
      case 'downloading':
        return 'Baixando arquivo...';
      case 'completed':
        return 'Download concluído!';
      case 'error':
        return 'Erro no download';
      default:
        return 'Processando...';
    }
  };

  const getStatusDescription = () => {
    switch (status) {
      case 'preparing':
        return `Reunindo ${songCount} músicas para compactação`;
      case 'downloading':
        return `Transferindo para seu celular${currentSongIndex ? ` (${currentSongIndex}/${songCount})` : ''}`;
      case 'completed':
        return `${albumTitle} foi baixado com sucesso`;
      case 'error':
        return errorMessage || 'Ocorreu um erro durante o download';
      default:
        return '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-9999" style={{ zIndex: 9999 }}>
      <div className="bg-white dark:bg-gray-900 rounded-lg p-8 max-w-md w-full mx-4 shadow-xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {getStatusMessage()}
          </h2>
          {status === 'completed' && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={24} />
            </button>
          )}
        </div>

        {/* Album Info */}
        <div className="mb-6">
          <p className="text-gray-600 dark:text-gray-400 font-medium">
            {albumTitle}
          </p>
          {status !== 'completed' && (
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              {getStatusDescription()}
            </p>
          )}
        </div>

        {/* Progress Bar */}
        {status !== 'completed' && (
          <div className="mb-4">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-500 h-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 text-center">
              {Math.round(progress)}%
            </p>
          </div>
        )}

        {/* Current Song Info */}
        {(status === 'preparing' || status === 'downloading') && currentSong && (
          <div className="mb-6 p-3 bg-gray-100 dark:bg-gray-800 rounded">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Atual: <span className="font-medium truncate">{currentSong}</span>
            </p>
          </div>
        )}

        {/* Loading Animation */}
        {status !== 'completed' && status !== 'error' && (
          <div className="flex justify-center mb-6">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
            </div>
          </div>
        )}

        {/* Description */}
        {status !== 'completed' && status !== 'error' && (
          <p className="text-xs text-gray-500 dark:text-gray-500 text-center">
            Não feche esta janela até o download ser concluído
          </p>
        )}

        {/* Error Message */}
        {status === 'error' && (
          <div className="text-center mb-6">
            <div className="text-4xl mb-4">❌</div>
            <p className="text-gray-600 dark:text-gray-400 mb-2 text-sm">
              {getStatusDescription()}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
              Verifique sua conexão e tente novamente
            </p>
            
            {/* Debug Section */}
            <div className="mt-4 border-t border-gray-300 dark:border-gray-700 pt-4">
              <button
                onClick={() => setShowDebug(!showDebug)}
                className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 flex items-center justify-center gap-1 mx-auto mb-2"
              >
                🐛 {showDebug ? 'Ocultar' : 'Mostrar'} DEBUG
                {showDebug ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              
              {showDebug && (
                <div className="bg-gray-900 dark:bg-gray-950 rounded p-3 mb-3 text-left overflow-hidden">
                  <p className="text-xs text-white font-mono mb-2">
                    <span className="text-red-400">❌ Erro:</span>
                  </p>
                  <p className="text-xs text-gray-300 font-mono break-words mb-3 max-h-24 overflow-y-auto">
                    {errorMessage}
                  </p>
                  <p className="text-xs text-white font-mono mb-2">
                    <span className="text-blue-400">📱 Informações:</span>
                  </p>
                  <p className="text-xs text-gray-400 font-mono mb-1">
                    Álbum: {albumTitle}
                  </p>
                  <p className="text-xs text-gray-400 font-mono mb-1">
                    Hora: {new Date().toLocaleTimeString()}
                  </p>
                  <p className="text-xs text-gray-400 font-mono mb-3">
                    URL: {window.location.pathname}
                  </p>
                  
                  <button
                    onClick={copyToClipboard}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs py-1 px-2 rounded flex items-center justify-center gap-1 transition"
                  >
                    <Copy size={12} /> Copiar Erro
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Success Message */}
        {status === 'completed' && (
          <div className="text-center mb-6">
            <div className="text-4xl mb-4">✅</div>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              {getStatusDescription()}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Acesse em Biblioteca → Downloads para ouvir offline
            </p>
          </div>
        )}

        {/* Close Button */}
        {(status === 'completed' || status === 'error') && (
          <button
            onClick={onClose}
            className={`w-full font-medium py-2 px-4 rounded-lg transition text-white ${
              status === 'error'
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {status === 'error' ? 'Fechar' : 'Fechar'}
          </button>
        )}
      </div>
    </div>
  );
};

export default DownloadProgressModal;
