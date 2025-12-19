import React from 'react';
import { useAuth } from '../../context/AuthContext';

const Favoritos = () => {
  const { user } = useAuth();

  return (
    <div className="p-8">
      <h1>Favoritos</h1>
      <p>Carregando...</p>
    </div>
  );
};

export default Favoritos;
