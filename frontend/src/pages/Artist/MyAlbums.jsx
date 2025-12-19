import React from 'react';
import { useAuth } from '../../context/AuthContext';

const MyAlbums = () => {
  const { user } = useAuth();

  return (
    <div className="p-8">
      <h1>Meus Álbuns</h1>
      <p>Carregando...</p>
    </div>
  );
};

export default MyAlbums;
