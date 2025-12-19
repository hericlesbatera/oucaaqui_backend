import React from 'react';
import { useAuth } from '../../context/AuthContext';

const UploadNew = () => {
  const { user } = useAuth();

  return (
    <div className="p-8">
      <h1>Upload</h1>
      <p>Carregando...</p>
    </div>
  );
};

export default UploadNew;
