import React from 'react';
import { X } from 'lucide-react';

export const DownloadProgressModal = ({ 
  isOpen, 
  status, 
  progress, 
  albumTitle,
  songCount,
  currentSong,
  onClose 
}) => {
  if (!isOpen) return null;

  const getStatusMessage = () => {
    switch (status) {
      case 'preparing':
        return 'Preparando download...';
      case 'downloading':
        return 'Baixando arquivo...';
      case 'completed':
        return 'Download iniciado!';
      default:
        return 'Processando...';
    }
  };

  const getStatusDescription = () => {
    switch (status) {
      case 'preparing':
        return `Reunindo ${songCount} músicas para compactação`;
      case 'downloading':
        return `Transferindo arquivo para seu computador`;
      case 'completed':
        return `${albumTitle} foi baixado com sucesso`;
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
        {status === 'preparing' && currentSong && (
          <div className="mb-6 p-3 bg-gray-100 dark:bg-gray-800 rounded">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Processando: <span className="font-medium">{currentSong}</span>
            </p>
          </div>
        )}

        {/* Loading Animation */}
        {status !== 'completed' && (
          <div className="flex justify-center mb-6">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
            </div>
          </div>
        )}

        {/* Description */}
        {status !== 'completed' && (
          <p className="text-xs text-gray-500 dark:text-gray-500 text-center">
            Não feche esta janela até o download ser concluído
          </p>
        )}

        {/* Success Message */}
        {status === 'completed' && (
          <div className="text-center mb-6">
            <div className="text-4xl mb-4">✅</div>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              {getStatusDescription()}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              O arquivo está sendo salvo em seu computador
            </p>
          </div>
        )}

        {/* Close Button */}
        {status === 'completed' && (
          <button
            onClick={onClose}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition"
          >
            Fechar
          </button>
        )}
      </div>
    </div>
  );
};

export default DownloadProgressModal;
