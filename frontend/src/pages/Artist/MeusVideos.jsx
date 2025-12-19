import React from 'react';
import { useAuth } from '../../context/AuthContext';

const MeusVideos = () => {
  const { user } = useAuth();

  return (
    <div className="p-8">
      <h1>Meus Vídeos</h1>
      <p>Carregando...</p>
    </div>
  );
};

export default MeusVideos;
