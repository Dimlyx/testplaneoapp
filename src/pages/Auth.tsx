import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger } from
'@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';
import planeoLogo from '@/assets/planeo-logo.png';

const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères')
});

const emailSchema = z.string().email('Email invalide');

export default function Auth() {
  const navigate = useNavigate();
  const { user, role, signIn, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetEmailError, setResetEmailError] = useState('');
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user && role) {
      if (role === 'super_admin') {
        navigate('/super-admin');
      } else if (role === 'admin') {
        navigate('/admin');
      } else if (role === 'technician') {
        navigate('/technician');
      }
    }
  }, [user, role, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = loginSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    const { error } = await signIn(formData.email, formData.password);
    setLoading(false);

    if (error) {
      toast({
        title: 'Erreur de connexion',
        description: error.message === 'Invalid login credentials' ?
        'Email ou mot de passe incorrect' :
        error.message,
        variant: 'destructive'
      });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetEmailError('');

    const result = emailSchema.safeParse(resetEmail);
    if (!result.success) {
      setResetEmailError('Email invalide');
      return;
    }

    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`
    });
    setResetLoading(false);

    if (error) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Email envoyé',
        description: 'Si un compte existe avec cet email, vous recevrez un lien de réinitialisation.'
      });
      setResetDialogOpen(false);
      setResetEmail('');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>);

  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <img
            src={planeoLogo}
            alt="Planéo - Gestion des interventions SAV"
            className="h-32 mx-auto mb-4" />

        </div>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="text-center">Connexion</CardTitle>
            <CardDescription className="text-center">
              Connectez-vous à votre compte
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="votre@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={loading} />

                {errors.email &&
                <p className="text-sm text-destructive">{errors.email}</p>
                }
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="login-password">Mot de passe</Label>
                  <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        type="button"
                        variant="link"
                        className="px-0 h-auto text-xs text-muted-foreground hover:text-primary">

                        Mot de passe oublié ?
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
                        <DialogDescription>
                          Entrez votre adresse email pour recevoir un lien de réinitialisation.
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleResetPassword} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="reset-email">Email</Label>
                          <Input
                            id="reset-email"
                            type="email"
                            placeholder="votre@email.com"
                            value={resetEmail}
                            onChange={(e) => setResetEmail(e.target.value)}
                            disabled={resetLoading} />

                          {resetEmailError &&
                          <p className="text-sm text-destructive">{resetEmailError}</p>
                          }
                        </div>
                        <Button type="submit" className="w-full" disabled={resetLoading}>
                          {resetLoading ?
                          <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Envoi...
                            </> :

                          'Envoyer le lien'
                          }
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  disabled={loading} />

                {errors.password &&
                <p className="text-sm text-destructive">{errors.password}</p>
                }
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ?
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connexion...
                  </> :

                'Se connecter'
                }
              </Button>

              <p className="text-xs text-center text-muted-foreground">Les comptes sont créés par l'administrateur
www.app.planeo.tech
contact@planeo.tech
numero

              </p>
            </CardContent>
          </form>
        </Card>
      </div>
    </div>);}