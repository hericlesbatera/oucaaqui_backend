import React from 'react';
import { useAuth } from '../../context/AuthContext';

const MyPlaylists = () => {
  const { user } = useAuth();

  return (
    <div className="p-8">
      <h1>Minhas Playlists</h1>
      <p>Carregando...</p>
    </div>
  );
};

export default MyPlaylists;
