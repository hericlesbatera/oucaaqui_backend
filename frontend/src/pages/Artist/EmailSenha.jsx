import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { toast } from '../../hooks/use-toast';
import { authApi } from '../../lib/authApi';
import LoadingSpinner from '../../components/LoadingSpinner';

const EmailSenha = () => {
  const { user } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setLoadingPassword(true);

    try {
      if (!newPassword || !confirmPassword) {
        toast({
          title: 'Erro',
          description: 'Todos os campos são obrigatórios',
          variant: 'destructive'
        });
        setLoadingPassword(false);
        return;
      }

      if (newPassword !== confirmPassword) {
        toast({
          title: 'Erro',
          description: 'As novas senhas não coincidem',
          variant: 'destructive'
        });
        setLoadingPassword(false);
        return;
      }

      if (newPassword.length < 6) {
        toast({
          title: 'Erro',
          description: 'A senha deve ter pelo menos 6 caracteres',
          variant: 'destructive'
        });
        setLoadingPassword(false);
        return;
      }

      const { data, error } = await authApi.changePassword(
        user?.id,
        newPassword
      );

      if (error) {
        throw new Error(error.detail || error.message || 'Erro ao alterar senha');
      }

      toast({
        title: 'Sucesso!',
        description: 'Senha alterada com sucesso'
      });

      // Clear form
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao alterar senha',
        variant: 'destructive'
      });
    } finally {
      setLoadingPassword(false);
    }
  };

  const handleEmailChange = async (e) => {
    e.preventDefault();
    setLoadingEmail(true);

    try {
      if (!newEmail) {
        toast({
          title: 'Erro',
          description: 'Email é obrigatório',
          variant: 'destructive'
        });
        setLoadingEmail(false);
        return;
      }

      if (newEmail === user?.email) {
        toast({
          title: 'Erro',
          description: 'O novo email deve ser diferente do atual',
          variant: 'destructive'
        });
        setLoadingEmail(false);
        return;
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail)) {
        toast({
          title: 'Erro',
          description: 'Email inválido',
          variant: 'destructive'
        });
        setLoadingEmail(false);
        return;
      }

      const { data, error } = await authApi.changeEmail(user?.id, newEmail);

      if (error) {
        throw new Error(error.detail || error.message || 'Erro ao alterar email');
      }

      toast({
        title: 'Sucesso!',
        description: 'Email alterado com sucesso'
      });

      // Clear form
      setNewEmail('');
    } catch (error) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao alterar email',
        variant: 'destructive'
      });
    } finally {
      setLoadingEmail(false);
    }
  };

  const handleDeleteProfile = async () => {
    if (!window.confirm('Tem certeza que deseja deletar seu perfil? Esta ação é irreversível.')) {
      return;
    }

    // TODO: Implementar deleção de perfil quando endpoint estiver disponível
    toast({
      title: 'Aviso',
      description: 'Funcionalidade de deleção será implementada em breve',
      variant: 'destructive'
    });
  };

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <LoadingSpinner size="large" text="Carregando..." />
      </div>
    );
  }

  return (
    <div className="bg-gray-50 w-full">
        <div className="max-w-2xl mx-auto p-4 md:p-8">
          <h1 className="text-xl md:text-2xl font-bold mb-8 flex items-center gap-2 text-black">
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-lock text-red-600">
              <rect width="18" height="11" x="3" y="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Email e senha
          </h1>

          <div className="space-y-3">
            {/* Email Section */}
            <div className="bg-white rounded-lg p-4 md:p-6 border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Email</h2>
              <p className="text-sm text-gray-600 mb-4">Apenas letras</p>
              <Input
                type="email"
                value={user?.email || ''}
                disabled
                className="bg-gray-100 disabled:opacity-70"
              />
            </div>

            {/* Change Email Section */}
            <form onSubmit={handleEmailChange} className="bg-white rounded-lg p-4 md:p-6 border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Alterar Email</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Novo Email
                  </label>
                  <Input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="novo.email@exemplo.com"
                    disabled={loadingEmail}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loadingEmail}
                  className="w-full bg-red-600 hover:bg-red-700 text-white"
                >
                  {loadingEmail ? 'Salvando...' : 'Alterar Email'}
                </Button>
              </div>
            </form>

            {/* Change Password Section */}
            <form onSubmit={handlePasswordChange} className="bg-white rounded-lg p-4 md:p-6 border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Alterar Senha</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nova Senha
                  </label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nova senha"
                    disabled={loadingPassword}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirmar Nova Senha
                  </label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirmar nova senha"
                    disabled={loadingPassword}
                  />
                  <p className="text-xs text-gray-600 mt-1">Mínimo 6 caracteres</p>
                </div>

                <Button
                  type="submit"
                  disabled={loadingPassword}
                  className="w-full bg-red-600 hover:bg-red-700 text-white"
                >
                  {loadingPassword ? 'Salvando...' : 'Alterar Senha'}
                </Button>
              </div>
            </form>

            {/* Delete Profile Section */}
            <div className="bg-white rounded-lg p-4 md:p-6 border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Deletar Perfil</h2>
              <p className="text-sm text-gray-600 mb-4">Apagar o perfil é uma ação irreversível</p>
              <Button
                onClick={handleDeleteProfile}
                variant="outline"
                className="text-red-600 border-red-600 hover:bg-red-50"
              >
                Deletar Perfil
              </Button>
            </div>
          </div>
        </div>
    </div>
  );
};

export default EmailSenha;
