import React, { useState, useEffect, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sphere, MeshDistortMaterial, Stars, Text } from '@react-three/drei';
import { useSpring, animated } from '@react-spring/three';
import axios from 'axios';
import './App.css';

// Components
import { Button } from './components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Textarea } from './components/ui/textarea';
import { Badge } from './components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Alert, AlertDescription } from './components/ui/alert';
import { toast } from 'sonner';
import { Toaster } from './components/ui/sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// 3D Globe Component
const Globe = () => {
  const meshRef = React.useRef();
  
  const { scale } = useSpring({
    scale: [1, 1, 1],
    config: { mass: 1, tension: 280, friction: 60 }
  });

  useEffect(() => {
    const interval = setInterval(() => {
      if (meshRef.current) {
        meshRef.current.rotation.y += 0.01;
      }
    }, 16);
    return () => clearInterval(interval);
  }, []);

  return (
    <animated.mesh ref={meshRef} scale={scale}>
      <Sphere args={[2.5, 64, 64]}>
        <MeshDistortMaterial
          color="#4338ca"
          attach="material"
          distort={0.3}
          speed={2}
          roughness={0.4}
          metalness={0.8}
        />
      </Sphere>
    </animated.mesh>
  );
};

// Landing Page Component
const LandingPage = ({ onLogin, onRegister, onRegisterInstitution }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 relative overflow-hidden">
      {/* 3D Background */}
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 10], fov: 75 }}>
          <Suspense fallback={null}>
            <ambientLight intensity={0.4} />
            <pointLight position={[10, 10, 10]} intensity={1} />
            <Globe />
            <Stars
              radius={100}
              depth={50}
              count={5000}
              factor={4}
              saturation={0}
              fade
            />
            <OrbitControls enableZoom={false} enablePan={false} />
          </Suspense>
        </Canvas>
      </div>

      {/* Content Overlay */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-8">
        <div className="max-w-5xl mx-auto text-center text-white">
          <div className="mb-8 backdrop-blur-lg bg-white/10 rounded-2xl p-8 border border-white/20">
            <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Alumni Connect
            </h1>
            <p className="text-xl mb-8 text-blue-100">
              Multi-Institution Alumni Network. Connect globally, grow professionally. AI-powered mentorship matching.
            </p>
            
            <div className="flex gap-4 justify-center flex-wrap">
              <Button 
                onClick={onLogin}
                size="lg" 
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-full"
              >
                Sign In
              </Button>
              <Button 
                onClick={onRegister}
                variant="outline" 
                size="lg"
                className="border-white/30 text-white hover:bg-white/10 px-8 py-3 rounded-full"
              >
                Join Network
              </Button>
              <Button 
                onClick={onRegisterInstitution}
                variant="outline" 
                size="lg"
                className="border-green-400/50 text-green-400 hover:bg-green-400/10 px-8 py-3 rounded-full"
              >
                Register Institution
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-12">
            <Card className="bg-white/10 backdrop-blur-lg border-white/20 text-white">
              <CardContent className="p-6 text-center">
                <div className="text-3xl mb-4">🏫</div>
                <h3 className="text-lg font-semibold mb-2">Multi-Institution</h3>
                <p className="text-sm text-blue-100">Connect across universities and institutions globally</p>
              </CardContent>
            </Card>
            
            <Card className="bg-white/10 backdrop-blur-lg border-white/20 text-white">
              <CardContent className="p-6 text-center">
                <div className="text-3xl mb-4">🌐</div>
                <h3 className="text-lg font-semibold mb-2">Global Network</h3>
                <p className="text-sm text-blue-100">3D visualization of your worldwide alumni connections</p>
              </CardContent>
            </Card>
            
            <Card className="bg-white/10 backdrop-blur-lg border-white/20 text-white">
              <CardContent className="p-6 text-center">
                <div className="text-3xl mb-4">🤖</div>
                <h3 className="text-lg font-semibold mb-2">AI Matching</h3>
                <p className="text-sm text-blue-100">Gemini 2.0 powered mentor recommendations</p>
              </CardContent>
            </Card>
            
            <Card className="bg-white/10 backdrop-blur-lg border-white/20 text-white">
              <CardContent className="p-6 text-center">
                <div className="text-3xl mb-4">💼</div>
                <h3 className="text-lg font-semibold mb-2">Career Growth</h3>
                <p className="text-sm text-blue-100">Institution-specific job opportunities and networking</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

// Institution Registration Modal
const InstitutionRegistrationModal = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    website: '',
    admin_first_name: '',
    admin_last_name: '',
    admin_email: '',
    admin_password: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = mode === 'login' ? 'auth/login' : 'auth/register';
      const response = await axios.post(`${API}/${endpoint}`, formData);

      localStorage.setItem('token', response.data.access_token);
      localStorage.setItem('user', JSON.stringify(response.data.user));

      onAuth(response.data.user, response.data.access_token);

      if (mode === 'register') {
        toast.success('Account created! Pending institution admin approval.');
      } else {
        toast.success('Welcome back!');
      }

      onClose();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg bg-slate-900 text-white border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">Register Your Institution</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Institution Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              required
              placeholder="e.g., Stanford University"
              className="bg-slate-800 border-slate-600"
            />
          </div>
          
          <div>
            <Label htmlFor="website">Official Website</Label>
            <Input
              id="website"
              value={formData.website}
              onChange={(e) => setFormData({...formData, website: e.target.value})}
              required
              placeholder="e.g., https://stanford.edu"
              className="bg-slate-800 border-slate-600"
            />
          </div>
          
          <div className="border-t border-slate-700 pt-4">
            <h4 className="text-lg font-semibold mb-3 text-green-400">Institution Admin Details</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="admin_first_name">First Name</Label>
                <Input
                  id="admin_first_name"
                  value={formData.admin_first_name}
                  onChange={(e) => setFormData({...formData, admin_first_name: e.target.value})}
                  required
                  className="bg-slate-800 border-slate-600"
                />
              </div>
              <div>
                <Label htmlFor="admin_last_name">Last Name</Label>
                <Input
                  id="admin_last_name"
                  value={formData.admin_last_name}
                  onChange={(e) => setFormData({...formData, admin_last_name: e.target.value})}
                  required
                  className="bg-slate-800 border-slate-600"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="admin_email">Admin Email</Label>
              <Input
                id="admin_email"
                type="email"
                value={formData.admin_email}
                onChange={(e) => setFormData({...formData, admin_email: e.target.value})}
                required
                className="bg-slate-800 border-slate-600"
              />
            </div>
            
            <div>
              <Label htmlFor="admin_password">Admin Password</Label>
              <Input
                id="admin_password"
                type="password"
                value={formData.admin_password}
                onChange={(e) => setFormData({...formData, admin_password: e.target.value})}
                required
                className="bg-slate-800 border-slate-600"
              />
            </div>
          </div>
          
          <Alert className="bg-blue-900/50 border-blue-700 text-blue-200">
            <AlertDescription>
              Your institution will be reviewed by our platform administrators. Once approved, you'll become the Institution Admin.
            </AlertDescription>
          </Alert>
          
          <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={loading}>
            {loading ? 'Submitting...' : 'Submit for Review'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Auth Components
const AuthModal = ({ isOpen, onClose, mode, onToggleMode, onAuth, refreshUser }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'Student',
    institution_id: '',
    major: '',
    graduation_year: new Date().getFullYear()
  });
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (mode === 'register') {
      fetchInstitutions();
    }
  }, [mode]);

  const fetchInstitutions = async () => {
    try {
      const response = await axios.get(`${API}/institutions`);
      setInstitutions(response.data);
    } catch (error) {
      console.error('Failed to fetch institutions:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const endpoint = mode === 'login' ? 'auth/login' : 'auth/register';
      const response = await axios.post(`${API}/${endpoint}`, formData);
      
      localStorage.setItem('token', response.data.access_token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      
      onAuth(response.data.user, response.data.access_token);
      
      if (mode === 'register') {
        toast.success('Account created! Pending institution admin approval.');
      } else {
        refreshUser();
        toast.success('Welcome back!');
      }
      
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-slate-900 text-white border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">
            {mode === 'login' ? 'Welcome Back' : 'Join Alumni Connect'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                    required
                    className="bg-slate-800 border-slate-600"
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                    required
                    className="bg-slate-800 border-slate-600"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="institution">Institution</Label>
                <Select value={formData.institution_id} onValueChange={(value) => setFormData({...formData, institution_id: value})}>
                  <SelectTrigger className="bg-slate-800 border-slate-600">
                    <SelectValue placeholder="Select your institution" />
                  </SelectTrigger>
                  <SelectContent>
                    {institutions.map((inst) => (
                      <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="role">Role</Label>
                <Select value={formData.role} onValueChange={(value) => setFormData({...formData, role: value})}>
                  <SelectTrigger className="bg-slate-800 border-slate-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Student">Student</SelectItem>
                    <SelectItem value="Alumni">Alumni</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="major">Major</Label>
                <Input
                  id="major"
                  value={formData.major}
                  onChange={(e) => setFormData({...formData, major: e.target.value})}
                  placeholder="e.g., Computer Science"
                  className="bg-slate-800 border-slate-600"
                />
              </div>
              
              {formData.role === 'Alumni' && (
                <div>
                  <Label htmlFor="graduation_year">Graduation Year</Label>
                  <Input
                    id="graduation_year"
                    type="number"
                    value={formData.graduation_year}
                    onChange={(e) => setFormData({...formData, graduation_year: parseInt(e.target.value)})}
                    className="bg-slate-800 border-slate-600"
                  />
                </div>
              )}
            </>
          )}
          
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              required
              className="bg-slate-800 border-slate-600"
            />
          </div>
          
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              required
              className="bg-slate-800 border-slate-600"
            />
          </div>
          
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Processing...' : (mode === 'login' ? 'Sign In' : 'Create Account')}
          </Button>
          
          <div className="text-center">
            <button
              type="button"
              onClick={onToggleMode}
              className="text-blue-400 hover:text-blue-300 text-sm"
            >
              {mode === 'login' ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Empty State Component
const EmptyState = ({ icon, title, description, action }) => (
  <div className="text-center py-16">
    <div className="text-6xl mb-4 opacity-50">{icon}</div>
    <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
    <p className="text-gray-400 mb-6 max-w-md mx-auto">{description}</p>
    {action}
  </div>
);

// Error State Component
const ErrorState = ({ title, description, onRetry }) => (
  <div className="text-center py-16">
    <div className="text-6xl mb-4 text-red-400">⚠️</div>
    <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
    <p className="text-gray-400 mb-6">{description}</p>
    {onRetry && (
      <Button onClick={onRetry} variant="outline" className="border-red-500 text-red-400 hover:bg-red-500/10">
        Try Again
      </Button>
    )}
  </div>
);

// Dashboard Components
const Dashboard = ({ user, token, onLogout, refreshUser }) => {
  const [currentView, setCurrentView] = useState('feed');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-900">
      <Header user={user} onLogout={onLogout} currentView={currentView} setCurrentView={setCurrentView} />
      
      <main className="pt-20 px-6">
        <div className="max-w-7xl mx-auto">
          {user.status === "Pending" && (
            <Alert className="mb-6 bg-yellow-900/50 border-yellow-700 text-yellow-200">
              <AlertDescription>
                Your account is pending approval from your institution admin. You have limited access until verified.
              </AlertDescription>
            </Alert>
          )}
          
          {currentView === 'feed' && <FeedView user={user} token={token} />}
          {currentView === 'directory' && <DirectoryView user={user} token={token} />}
          {currentView === 'mentors' && <MentorView user={user} token={token} />}
          {currentView === 'jobs' && <JobsView user={user} token={token} />}
          {currentView === 'profile' && <ProfileView user={user} token={token} />}
          {currentView === 'admin' && (user.role === 'Institution_Admin' || user.role === 'Platform_Admin') && <AdminView user={user} token={token} />}
        </div>
      </main>
    </div>
  );
};

const Header = ({ user, onLogout, currentView, setCurrentView }) => {
  const getRoleBadgeColor = (role) => {
    switch(role) {
      case 'Platform_Admin': return 'bg-red-600';
      case 'Institution_Admin': return 'bg-purple-600';
      case 'Alumni': return 'bg-green-600';
      case 'Student': return 'bg-blue-600';
      default: return 'bg-gray-600';
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/90 backdrop-blur-lg border-b border-slate-700">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <h1 className="text-2xl font-bold text-white">Alumni Connect v2.0</h1>
            
            <nav className="hidden md:flex space-x-6">
              <NavButton active={currentView === 'feed'} onClick={() => setCurrentView('feed')}>
                Feed
              </NavButton>
              <NavButton active={currentView === 'directory'} onClick={() => setCurrentView('directory')}>
                Directory
              </NavButton>
              {user.role === 'Student' && user.status === 'Verified' && (
                <NavButton active={currentView === 'mentors'} onClick={() => setCurrentView('mentors')}>
                  Find Mentors
                </NavButton>
              )}
              <NavButton active={currentView === 'jobs'} onClick={() => setCurrentView('jobs')}>
                Jobs
              </NavButton>
              {(user.role === 'Institution_Admin' || user.role === 'Platform_Admin') && (
                <NavButton active={currentView === 'admin'} onClick={() => setCurrentView('admin')}>
                  Admin
                </NavButton>
              )}
            </nav>
          </div>
          
          <div className="flex items-center space-x-4">
            <Badge className={`${getRoleBadgeColor(user.role)} text-white`}>
              {user.role.replace('_', ' ')}
            </Badge>
            {user.status === 'Pending' && (
              <Badge variant="secondary" className="bg-yellow-600 text-white">
                Pending
              </Badge>
            )}
            <Button variant="ghost" onClick={() => setCurrentView('profile')} className="text-white">
              Profile
            </Button>
            <Button variant="ghost" onClick={onLogout} className="text-white">
              Logout
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

const NavButton = ({ children, active, onClick }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-lg transition-all ${
      active 
        ? 'bg-blue-600 text-white' 
        : 'text-gray-300 hover:text-white hover:bg-slate-800'
    }`}
  >
    {children}
  </button>
);

// Feed View with Empty State
const FeedView = ({ user, token }) => {
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      setError(null);
      const response = await axios.get(`${API}/posts/feed`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPosts(response.data);
    } catch (error) {
      setError('Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPost.trim()) return;

    if (user.status !== 'Verified') {
      toast.error('Account must be verified to post');
      return;
    }

    try {
      await axios.post(`${API}/posts`, { content: newPost }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewPost('');
      fetchPosts();
      toast.success('Post created!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create post');
    }
  };

  const handleLike = async (postId) => {
    try {
      await axios.post(`${API}/posts/${postId}/like`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchPosts();
    } catch (error) {
      toast.error('Failed to like post');
    }
  };

  if (loading) {
    return <div className="text-white text-center py-12">Loading feed...</div>;
  }

  if (error) {
    return <ErrorState title="Failed to Load Feed" description={error} onRetry={fetchPosts} />;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {user.status === 'Verified' && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Share an Update</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreatePost} className="space-y-4">
              <Textarea
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                placeholder="What's happening in your professional journey?"
                className="bg-slate-700 border-slate-600 text-white"
                rows="3"
                maxLength="2000"
              />
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">{newPost.length}/2000</span>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                  Share Post
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {posts.length === 0 ? (
        <EmptyState
          icon="📝"
          title="No Posts Yet"
          description="Start connecting with your alumni network by sharing your first post or wait for others to share updates."
          action={user.status === 'Verified' ? null : (
            <p className="text-sm text-gray-500">Verify your account to start posting</p>
          )}
        />
      ) : (
        posts.map((post) => (
          <Card key={post.id} className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <Avatar>
                  <AvatarFallback className="bg-blue-600 text-white">
                    {post.author_name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h4 className="font-semibold text-white">{post.author_name}</h4>
                    <span className="text-gray-400 text-sm">
                      {new Date(post.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-gray-200 mb-4 whitespace-pre-wrap">{post.content}</p>
                  <div className="flex items-center space-x-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleLike(post.id)}
                      className={`text-gray-400 hover:text-red-400 ${
                        post.likes.includes(user.id) ? 'text-red-400' : ''
                      }`}
                    >
                      ❤️ {post.likes.length}
                    </Button>
                    <Button variant="ghost" size="sm" className="text-gray-400">
                      💬 {post.comments.length}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};

// Directory View with Enhanced Filtering
const DirectoryView = ({ user, token }) => {
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({ major: '', industry: '', role: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, [filters]);

  const fetchUsers = async () => {
    try {
      setError(null);
      const params = new URLSearchParams();
      Object.keys(filters).forEach(key => {
        if (filters[key]) params.append(key, filters[key]);
      });
      
      const response = await axios.get(`${API}/users?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data);
    } catch (error) {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return <ErrorState title="Failed to Load Directory" description={error} onRetry={fetchUsers} />;
  }

  return (
    <div className="space-y-6">
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Alumni Directory</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-white">Major</Label>
              <Input
                value={filters.major}
                onChange={(e) => setFilters({...filters, major: e.target.value})}
                placeholder="Filter by major"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div>
              <Label className="text-white">Industry</Label>
              <Input
                value={filters.industry}
                onChange={(e) => setFilters({...filters, industry: e.target.value})}
                placeholder="Filter by industry"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div>
              <Label className="text-white">Role</Label>
              <Select value={filters.role} onValueChange={(value) => setFilters({...filters, role: value})}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All roles</SelectItem>
                  <SelectItem value="Student">Students</SelectItem>
                  <SelectItem value="Alumni">Alumni</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-white text-center py-12">Loading directory...</div>
      ) : users.length === 0 ? (
        <EmptyState
          icon="👥"
          title="No Users Found"
          description="Try adjusting your filters or check back later as more users join your institution."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {users.map((person) => (
            <Card key={person.id} className="bg-slate-800 border-slate-700 card-hover">
              <CardContent className="p-6 text-center">
                <Avatar className="w-16 h-16 mx-auto mb-4">
                  <AvatarFallback className="bg-blue-600 text-white text-lg">
                    {person.first_name[0]}{person.last_name[0]}
                  </AvatarFallback>
                </Avatar>
                <h3 className="text-white font-semibold mb-2">
                  {person.first_name} {person.last_name}
                </h3>
                <div className="space-y-2">
                  <Badge className="bg-blue-600 text-white">{person.role}</Badge>
                  {person.major && (
                    <p className="text-gray-300 text-sm">{person.major}</p>
                  )}
                  {person.industry && (
                    <p className="text-gray-400 text-sm">{person.industry}</p>
                  )}
                  {person.location && (
                    <p className="text-gray-400 text-sm">📍 {person.location}</p>
                  )}
                  {person.is_mentor && (
                    <Badge variant="secondary" className="bg-green-600 text-white">
                      Mentor Available
                    </Badge>
                  )}
                </div>
                <Button className="mt-4 bg-blue-600 hover:bg-blue-700">
                  Connect
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// Enhanced Mentor View with AI Status
const MentorView = ({ user, token }) => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [aiPowered, setAiPowered] = useState(false);
  const [error, setError] = useState(null);

  const findMentors = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API}/ai/mentor-match`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMatches(response.data.matches);
      setAiPowered(response.data.ai_powered);
      toast.success(`Found ${response.data.matches.length} mentor matches!`);
    } catch (error) {
      setError('Failed to find mentors');
      toast.error(error.response?.data?.detail || 'Failed to find mentors');
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return <ErrorState title="Mentor Matching Error" description={error} onRetry={findMentors} />;
  }

  return (
    <div className="space-y-6">
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">AI-Powered Mentor Matching</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-gray-300 mb-6">
            Get personalized mentor recommendations using Gemini 2.0 AI, analyzing your profile, major, and career goals for optimal matches.
          </p>
          <Button 
            onClick={findMentors} 
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? 'Finding Mentors...' : '🤖 Find My Mentors'}
          </Button>
          {aiPowered && (
            <div className="mt-4">
              <Badge className="bg-green-600 text-white">✨ AI-Powered Results</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {matches.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {matches.map((mentor) => (
            <Card key={mentor.id} className="bg-slate-800 border-slate-700 card-hover">
              <CardContent className="p-6 text-center">
                <Avatar className="w-16 h-16 mx-auto mb-4">
                  <AvatarFallback className="bg-green-600 text-white text-lg">
                    {mentor.first_name[0]}{mentor.last_name[0]}
                  </AvatarFallback>
                </Avatar>
                <h3 className="text-white font-semibold mb-2">
                  {mentor.first_name} {mentor.last_name}
                </h3>
                <div className="space-y-2">
                  <Badge className="bg-green-600 text-white">Mentor</Badge>
                  {mentor.major && (
                    <p className="text-gray-300 text-sm">{mentor.major}</p>
                  )}
                  {mentor.industry && (
                    <p className="text-gray-400 text-sm">{mentor.industry}</p>
                  )}
                  {mentor.location && (
                    <p className="text-gray-400 text-sm">📍 {mentor.location}</p>
                  )}
                </div>
                <Button className="mt-4 bg-green-600 hover:bg-green-700">
                  Request Mentorship
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !loading && (
        <EmptyState
          icon="🎯"
          title="No Mentors Found Yet"
          description="Click the button above to discover mentors matched to your profile and career goals."
        />
      )}
    </div>
  );
};

// Enhanced Jobs View
const JobsView = ({ user, token }) => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      setError(null);
      const response = await axios.get(`${API}/jobs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setJobs(response.data);
    } catch (error) {
      setError('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return <ErrorState title="Failed to Load Jobs" description={error} onRetry={fetchJobs} />;
  }

  return (
    <div className="space-y-6">
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-white">Job Board</CardTitle>
          {(user.role === 'Alumni' || user.role === 'Institution_Admin') && user.status === 'Verified' && (
            <Button 
              onClick={() => setShowCreateJob(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Post Job
            </Button>
          )}
        </CardHeader>
      </Card>

      {loading ? (
        <div className="text-white text-center py-12">Loading jobs...</div>
      ) : jobs.length === 0 ? (
        <EmptyState
          icon="💼"
          title="No Jobs Posted Yet"
          description="Be the first to share job opportunities with your institution's network."
          action={
            (user.role === 'Alumni' || user.role === 'Institution_Admin') && user.status === 'Verified' ? (
              <Button onClick={() => setShowCreateJob(true)} className="bg-blue-600 hover:bg-blue-700">
                Post First Job
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <Card key={job.id} className="bg-slate-800 border-slate-700 card-hover">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-white font-semibold text-lg mb-2">{job.title}</h3>
                    <p className="text-blue-400 font-medium mb-2">{job.company}</p>
                    {job.location && (
                      <p className="text-gray-400 text-sm mb-4">📍 {job.location}</p>
                    )}
                    <p className="text-gray-300 mb-4 whitespace-pre-wrap">{job.description}</p>
                    <p className="text-gray-500 text-sm">
                      Posted on {new Date(job.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button className="bg-blue-600 hover:bg-blue-700 ml-4">
                    Apply Now
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// Enhanced Profile View
const ProfileView = ({ user, token }) => {
  const [profile, setProfile] = useState({
    industry: user.industry || '',
    location: user.location || '',
    is_mentor: user.is_mentor || false,
    profile_picture_url: user.profile_picture_url || ''
  });

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API}/users/profile`, profile, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Profile updated successfully!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update profile');
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Profile Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateProfile} className="space-y-6">
            <div className="text-center mb-6">
              <Avatar className="w-24 h-24 mx-auto mb-4">
                <AvatarFallback className="bg-blue-600 text-white text-2xl">
                  {user.first_name[0]}{user.last_name[0]}
                </AvatarFallback>
              </Avatar>
              <h2 className="text-white text-xl font-semibold">
                {user.first_name} {user.last_name}
              </h2>
              <div className="flex justify-center space-x-2 mt-2">
                <Badge className="bg-blue-600 text-white">{user.role.replace('_', ' ')}</Badge>
                <Badge className={user.status === 'Verified' ? 'bg-green-600' : 'bg-yellow-600'}>
                  {user.status}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-white">Email</Label>
                <Input value={user.email} disabled className="bg-slate-700 border-slate-600 text-gray-400" />
              </div>
              <div>
                <Label className="text-white">Major</Label>
                <Input value={user.major || 'Not specified'} disabled className="bg-slate-700 border-slate-600 text-gray-400" />
              </div>
            </div>

            <div>
              <Label className="text-white">Industry</Label>
              <Input
                value={profile.industry}
                onChange={(e) => setProfile({...profile, industry: e.target.value})}
                placeholder="e.g., Technology, Finance, Healthcare"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>

            <div>
              <Label className="text-white">Location</Label>
              <Input
                value={profile.location}
                onChange={(e) => setProfile({...profile, location: e.target.value})}
                placeholder="e.g., San Francisco, CA"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>

            {user.role === 'Alumni' && (
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_mentor"
                  checked={profile.is_mentor}
                  onChange={(e) => setProfile({...profile, is_mentor: e.target.checked})}
                  className="w-4 h-4"
                />
                <Label htmlFor="is_mentor" className="text-white">
                  Available as a mentor to students
                </Label>
              </div>
            )}

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
              Update Profile
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

// Enhanced Admin View with Platform/Institution Separation
const AdminView = ({ user, token }) => {
  const [currentTab, setCurrentTab] = useState(user.role === 'Platform_Admin' ? 'institutions' : 'users');
  
  return (
    <div className="space-y-6">
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">
            {user.role === 'Platform_Admin' ? 'Platform Administration' : 'Institution Administration'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-300">
            {user.role === 'Platform_Admin' 
              ? 'Manage institutions and platform-wide settings.'
              : 'Manage users and content within your institution.'
            }
          </p>
        </CardContent>
      </Card>

      <Tabs value={currentTab} onValueChange={setCurrentTab}>
        <TabsList className="bg-slate-800">
          {user.role === 'Platform_Admin' && (
            <TabsTrigger value="institutions" className="text-white">Institution Approvals</TabsTrigger>
          )}
          <TabsTrigger value="users" className="text-white">User Management</TabsTrigger>
        </TabsList>

        {user.role === 'Platform_Admin' && (
          <TabsContent value="institutions">
            <PlatformAdminInstitutions token={token} />
          </TabsContent>
        )}

        <TabsContent value="users">
          <UserManagement user={user} token={token} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Platform Admin Institution Management
const PlatformAdminInstitutions = ({ token }) => {
  const [pendingInstitutions, setPendingInstitutions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingInstitutions();
  }, []);

  const fetchPendingInstitutions = async () => {
    try {
      const response = await axios.get(`${API}/admin/institutions/pending`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPendingInstitutions(response.data);
    } catch (error) {
      toast.error('Failed to load pending institutions');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (institutionId) => {
    try {
      await axios.post(`${API}/admin/institutions/${institutionId}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Institution approved successfully!');
      fetchPendingInstitutions();
    } catch (error) {
      toast.error('Failed to approve institution');
    }
  };

  const handleReject = async (institutionId) => {
    try {
      await axios.post(`${API}/admin/institutions/${institutionId}/reject`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Institution rejected');
      fetchPendingInstitutions();
    } catch (error) {
      toast.error('Failed to reject institution');
    }
  };

  if (loading) {
    return <div className="text-white text-center py-8">Loading pending institutions...</div>;
  }

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white">Pending Institution Approvals</CardTitle>
      </CardHeader>
      <CardContent>
        {pendingInstitutions.length === 0 ? (
          <EmptyState
            icon="🏫"
            title="No Pending Institutions"
            description="All institution registration requests have been processed."
          />
        ) : (
          <div className="space-y-4">
            {pendingInstitutions.map((institution) => (
              <div key={institution.id} className="flex items-center justify-between p-4 bg-slate-700 rounded-lg">
                <div className="flex-1">
                  <h4 className="text-white font-semibold">{institution.name}</h4>
                  <p className="text-gray-300 text-sm">{institution.website}</p>
                  {institution.admin_details && (
                    <p className="text-gray-400 text-sm">
                      Admin: {institution.admin_details.name} ({institution.admin_details.email})
                    </p>
                  )}
                  <p className="text-gray-500 text-xs">
                    Submitted: {new Date(institution.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Button 
                    onClick={() => handleApprove(institution.id)}
                    className="bg-green-600 hover:bg-green-700"
                    size="sm"
                  >
                    Approve
                  </Button>
                  <Button 
                    onClick={() => handleReject(institution.id)}
                    variant="destructive"
                    size="sm"
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// User Management Component
const UserManagement = ({ user, token }) => {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  const fetchPendingUsers = async () => {
    try {
      const response = await axios.get(`${API}/admin/users/pending`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPendingUsers(response.data);
    } catch (error) {
      toast.error('Failed to load pending users');
    } finally {
      setLoading(false);
    }
  };

  const verifyUser = async (userId) => {
    try {
      await axios.post(`${API}/admin/users/${userId}/verify`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('User verified successfully!');
      fetchPendingUsers();
    } catch (error) {
      toast.error('Failed to verify user');
    }
  };

  const rejectUser = async (userId) => {
    try {
      await axios.post(`${API}/admin/users/${userId}/reject`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('User rejected');
      fetchPendingUsers();
    } catch (error) {
      toast.error('Failed to reject user');
    }
  };

  if (loading) {
    return <div className="text-white text-center py-8">Loading pending users...</div>;
  }

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white">
          Pending User {user.role === 'Platform_Admin' ? 'Verifications' : 'Approvals'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {pendingUsers.length === 0 ? (
          <EmptyState
            icon="✅"
            title="No Pending Users"
            description="All user registration requests have been processed."
          />
        ) : (
          <div className="space-y-4">
            {pendingUsers.map((pendingUser) => (
              <div key={pendingUser.id} className="flex items-center justify-between p-4 bg-slate-700 rounded-lg">
                <div className="flex-1">
                  <h4 className="text-white font-semibold">
                    {pendingUser.first_name} {pendingUser.last_name}
                  </h4>
                  <p className="text-gray-300 text-sm">{pendingUser.email}</p>
                  <div className="flex space-x-2 mt-1">
                    <Badge className="bg-blue-600 text-white text-xs">{pendingUser.role}</Badge>
                    {pendingUser.major && (
                      <Badge variant="secondary" className="text-xs">{pendingUser.major}</Badge>
                    )}
                  </div>
                  <p className="text-gray-500 text-xs mt-1">
                    Registered: {new Date(pendingUser.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Button 
                    onClick={() => verifyUser(pendingUser.id)}
                    className="bg-green-600 hover:bg-green-700"
                    size="sm"
                  >
                    Approve
                  </Button>
                  <Button 
                    onClick={() => rejectUser(pendingUser.id)}
                    variant="destructive"
                    size="sm"
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Main App Component
const App = () => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showInstitutionRegistration, setShowInstitutionRegistration] = useState(false);
  const [authMode, setAuthMode] = useState('login');

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleAuth = (userData, accessToken) => {
    setUser(userData);
    setToken(accessToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setToken(null);
  };
  
  const refreshUser = async () => {
    if (!token) return;
    try {
      const response = await axios.get(`${API}/users/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const refreshedUser = response.data;
      setUser(refreshedUser);
      localStorage.setItem('user', JSON.stringify(refreshedUser));
      console.log('User data refreshed:', refreshedUser);
    } catch (error) {
      console.error("Failed to refresh user data:", error);
    }
  };

  const openLogin = () => {
    setAuthMode('login');
    setShowAuth(true);
  };

  const openRegister = () => {
    setAuthMode('register');
    setShowAuth(true);
  };

  const openInstitutionRegistration = () => {
    setShowInstitutionRegistration(true);
  };

  return (
    <div className="App">
      <Toaster />
      
      {!user ? (
        <>
          <LandingPage 
            onLogin={openLogin} 
            onRegister={openRegister}
            onRegisterInstitution={openInstitutionRegistration}
          />
          <AuthModal
            isOpen={showAuth}
            onClose={() => setShowAuth(false)}
            mode={authMode}
            onToggleMode={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
            onAuth={handleAuth}
            refreshUser={refreshUser}
          />
          <InstitutionRegistrationModal
            isOpen={showInstitutionRegistration}
            onClose={() => setShowInstitutionRegistration(false)}
          />
        </>
      ) : (
        <Dashboard user={user} token={token} onLogout={handleLogout} />
      )}
    </div>
  );
};

export default App;
