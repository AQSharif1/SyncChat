import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getAuthCallbackUrl } from '@/utils/authRedirect';
import { usePlatformStats, roundStatDown } from '@/hooks/usePlatformStats';
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Sparkles, 
  CheckCircle, 
  MessageCircle, 
  Users, 
  Heart, 
  Star,
  ArrowRight,
  Smartphone,
  Globe,
  Zap
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

function StatPill({ value, label }: { value: number; label: string }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (value <= 0) {
      setDisplay(0);
      return;
    }

    const steps = 16;
    const stepMs = 800 / steps;
    let step = 0;

    const interval = setInterval(() => {
      step += 1;
      const next = Math.min(value, Math.round((value * step) / steps));
      setDisplay(next);
      if (step >= steps) clearInterval(interval);
    }, stepMs);

    return () => clearInterval(interval);
  }, [value]);

  return (
    <div className="text-center">
      <div className="text-lg font-bold text-foreground">
        {display.toLocaleString()}+
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function SocialProofStrip() {
  const { totalMembers, activeGroups, activeSeasons, loading } = usePlatformStats();

  const roundedMembers = roundStatDown(totalMembers);
  const roundedGroups = roundStatDown(activeGroups);
  const roundedSeasons = roundStatDown(activeSeasons);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-6 py-4 px-4 border-y border-border/40 max-w-2xl mx-auto">
        {[0, 1, 2].map((i) => (
          <div key={i} className="text-center space-y-2">
            <Skeleton className="h-6 w-16 mx-auto" />
            <Skeleton className="h-3 w-24 mx-auto" />
          </div>
        ))}
      </div>
    );
  }

  if (roundedMembers === 0) return null;

  return (
    <div className="flex items-center justify-center gap-6 py-4 px-4 border-y border-border/40 max-w-2xl mx-auto">
      <StatPill value={roundedMembers} label="people matched" />
      <StatPill value={roundedGroups} label="groups active this week" />
      <StatPill value={roundedSeasons} label="ongoing seasons" />
    </div>
  );
}

export const WelcomingLanding = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showSignupSuccess, setShowSignupSuccess] = useState(false);
  const [signupEmail, setSignupEmail] = useState('');
  const { toast } = useToast();
  const { signUp, signIn } = useAuth();
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // Load saved username on component mount
  React.useEffect(() => {
    const savedEmail = localStorage.getItem('saved_username');
    if (savedEmail) {
      setFormData(prev => ({ ...prev, email: savedEmail }));
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.password) {
      toast({
        title: "Missing information",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Check if email already exists
      const { data: emailExists, error: emailError } = await supabase.rpc('email_exists', {
        check_email: formData.email
      });

      if (emailError) {
        console.error('Email check error:', emailError);
      }

      if (emailExists) {
        toast({
          title: "Email already exists",
          description: "An account with this email already exists. Please sign in instead.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const result = await signUp(formData.email, formData.password);
      
      if (result.error) {
        toast({
          title: "Sign up failed",
          description: result.error,
          variant: "destructive",
        });
      } else {
        setSignupEmail(formData.email);
        setShowSignupSuccess(true);
        setFormData({ email: '', password: '' });
      }
    } catch (error) {
      toast({
        title: "Sign up failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.password) {
      toast({
        title: "Missing information",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await signIn(formData.email, formData.password);
      
      if (result.error) {
        toast({
          title: "Sign in failed",
          description: result.error,
          variant: "destructive",
        });
      } else {
        // Save username for next time
        localStorage.setItem('saved_username', formData.email);
        toast({
          title: "Welcome back!",
          description: "Successfully signed in.",
        });
      }
    } catch (error) {
      toast({
        title: "Sign in failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotPasswordEmail) {
      toast({
        title: "Email required",
        description: "Please enter your email address.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
        redirectTo: getAuthCallbackUrl(),
      });

      if (error) {
        toast({
          title: "Reset failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Reset link sent",
          description: "Check your email for password reset instructions.",
        });
        setShowForgotPassword(false);
        setForgotPasswordEmail('');
      }
    } catch (error) {
      toast({
        title: "Reset failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!signupEmail) return;
    
    setIsLoading(true);
    try {
      const result = await supabase.auth.resend({
        type: 'signup',
        email: signupEmail,
        options: {
          emailRedirectTo: getAuthCallbackUrl(),
        }
      });

      if (result.error) {
        toast({
          title: "Resend failed",
          description: result.error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Verification email sent",
          description: "Please check your email for the verification link.",
        });
      }
    } catch (error) {
      toast({
        title: "Resend failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (showSignupSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md border border-border/60 shadow-sm p-8 text-center">
          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Check Your Email!</h2>
              <p className="text-muted-foreground">
                We sent a verification link to <strong>{signupEmail}</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                Please click the link in your email to verify your account.
              </p>
            </div>
            <div className="space-y-3">
              <Button
                onClick={() => {
                  setShowSignupSuccess(false);
                  setSignupEmail('');
                }}
                className="w-full"
              >
                Back to Sign In
              </Button>
              <Button
                variant="outline"
                onClick={handleResendVerification}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? "Sending..." : "Resend Email"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Can't find the email? Check your spam folder.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (showForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md border border-border/60 shadow-sm p-8">
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold">Reset Password</h2>
              <p className="text-muted-foreground">
                Enter your email to receive reset instructions
              </p>
            </div>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="Enter your email"
                    value={forgotPasswordEmail}
                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForgotPassword(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1"
                >
                  {isLoading ? "Sending..." : "Send Reset Link"}
                </Button>
              </div>
            </form>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* LEFT — Brand statement */}
      <div className="flex-1 flex flex-col justify-between px-8 py-12 md:px-16 md:py-16 bg-[hsl(258_12%_7%)] dark:bg-[hsl(258_12%_5%)] text-white relative overflow-hidden">
        {/* Subtle background texture */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage: `radial-gradient(circle at 30% 60%, hsl(258 62% 54%) 0%, transparent 60%), radial-gradient(circle at 80% 20%, hsl(258 40% 40%) 0%, transparent 50%)`,
          }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[hsl(258_62%_54%)] flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight text-white/90">SyncChat</span>
          </div>
        </div>

        {/* Main statement */}
        <div className="relative z-10 space-y-6 py-16 md:py-0">
          <div className="space-y-4">
            <p className="text-sm font-medium tracking-widest uppercase text-[hsl(258_62%_72%)]">
              Your community is waiting
            </p>
            <h1 className="display-text text-4xl md:text-5xl lg:text-6xl text-white leading-[1.05]">
              Find people
              <br />
              who actually
              <br />
              <span className="text-[hsl(258_62%_72%)]">get you.</span>
            </h1>
            <p className="text-base text-white/60 leading-relaxed max-w-sm">
              SyncChat matches you into a small curated group based on who you are — not what you search for.
            </p>
          </div>

          <div className="space-y-3 pt-4">
            {[
              'Matched by personality, goals & life stage',
              'Groups of 8 — small enough to actually talk',
              'Seasons keep things fresh. Memories last.',
            ].map((point) => (
              <div key={point} className="flex items-center gap-3 text-sm text-white/70">
                <div className="w-1.5 h-1.5 rounded-full bg-[hsl(258_62%_65%)] flex-shrink-0" />
                {point}
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <SocialProofStrip />
        </div>
      </div>

      {/* RIGHT — Auth form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 md:px-12 bg-background">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex items-center gap-2 md:hidden">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <MessageCircle className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-bold text-base tracking-tight">SyncChat</span>
          </div>

          <div className="space-y-1">
            <h2 className="heading-text text-2xl text-foreground">Welcome back</h2>
            <p className="text-sm text-muted-foreground">
              Sign in to your community or create a new account
            </p>
          </div>

          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-muted/60 p-1 rounded-xl h-10">
              <TabsTrigger
                value="signin"
                className="rounded-lg text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                Sign in
              </TabsTrigger>
              <TabsTrigger
                value="signup"
                className="rounded-lg text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                Create account
              </TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="space-y-4 mt-6">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signin-email"
                      name="email"
                      type="email"
                      placeholder="Enter your email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="pl-9"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signin-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className="pl-9 pr-9"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1 h-8 w-8 p-0"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="remember-me"
                      defaultChecked={true}
                      className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                    />
                    <Label htmlFor="remember-me" className="text-sm text-muted-foreground">
                      Remember username
                    </Label>
                  </div>
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-sm p-0 h-auto"
                  >
                    Forgot password?
                  </Button>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 font-semibold primary-glow transition-all"
                >
                  {isLoading ? 'Signing in...' : 'Sign in'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="space-y-4 mt-6">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-email"
                      name="email"
                      type="email"
                      placeholder="Enter your email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="pl-9"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Create a password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className="pl-9 pr-9"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1 h-8 w-8 p-0"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Password must be at least 6 characters long
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 font-semibold primary-glow transition-all"
                >
                  {isLoading ? 'Creating account...' : 'Create account'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <p className="text-xs text-center text-muted-foreground">
            By continuing you agree to our{' '}
            <a
              href="/legal/terms"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              Terms
            </a>{' '}
            and{' '}
            <a
              href="/legal/privacy"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
};


