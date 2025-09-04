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
const LandingPage = ({ onLogin, onRegister }) => {
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
        <div className="max-w-4xl mx-auto text-center text-white">
          <div className="mb-8 backdrop-blur-lg bg-white/10 rounded-2xl p-8 border border-white/20">
            <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Alumni Connect
            </h1>
            <p className="text-xl mb-8 text-blue-100">
              Connect with your global alumni network. Discover mentors, explore opportunities, and build lasting professional relationships.
            </p>
            
            <div className="flex gap-4 justify-center">
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
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <Card className="bg-white/10 backdrop-blur-lg border-white/20 text-white">
              <CardContent className="p-6 text-center">
                <div className="text-3xl mb-4">🌐</div>
                <h3 className="text-lg font-semibold mb-2">Global Network</h3>
                <p className="text-sm text-blue-100">Connect with alumni worldwide through our interactive 3D visualization</p>
              </CardContent>
            </Card>
            
            <Card className="bg-white/10 backdrop-blur-lg border-white/20 text-white">
              <CardContent className="p-6 text-center">
                <div className="text-3xl mb-4">🤖</div>
                <h3 className="text-lg font-semibold mb-2">AI Matching</h3>
                <p className="text-sm text-blue-100">Get personalized mentor recommendations powered by advanced AI</p>
              </CardContent>
            </Card>
            
            <Card className="bg-white/10 backdrop-blur-lg border-white/20 text-white">
              <CardContent className="p-6 text-center">
                <div className="text-3xl mb-4">💼</div>
                <h3 className="text-lg font-semibold mb-2">Career Growth</h3>
                <p className="text-sm text-blue-100">Discover job opportunities and accelerate your professional journey</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

// Auth Components
const AuthModal = ({ isOpen, onClose, mode, onToggleMode, onAuth }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'Student',
    major: '',
    graduation_year: new Date().getFullYear()
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
      toast.success(mode === 'login' ? 'Welcome back!' : 'Account created successfully!');
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

// Dashboard Components
const Dashboard = ({ user, token, onLogout }) => {
  const [currentView, setCurrentView] = useState('feed');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-900">
      <Header user={user} onLogout={onLogout} currentView={currentView} setCurrentView={setCurrentView} />
      
      <main className="pt-20 px-6">
        <div className="max-w-7xl mx-auto">
          {currentView === 'feed' && <FeedView user={user} token={token} />}
          {currentView === 'directory' && <DirectoryView user={user} token={token} />}
          {currentView === 'mentors' && <MentorView user={user} token={token} />}
          {currentView === 'jobs' && <JobsView user={user} token={token} />}
          {currentView === 'profile' && <ProfileView user={user} token={token} />}
          {currentView === 'admin' && user.role === 'Admin' && <AdminView user={user} token={token} />}
        </div>
      </main>
    </div>
  );
};

const Header = ({ user, onLogout, currentView, setCurrentView }) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/90 backdrop-blur-lg border-b border-slate-700">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <h1 className="text-2xl font-bold text-white">Alumni Connect</h1>
            
            <nav className="hidden md:flex space-x-6">
              <NavButton active={currentView === 'feed'} onClick={() => setCurrentView('feed')}>
                Feed
              </NavButton>
              <NavButton active={currentView === 'directory'} onClick={() => setCurrentView('directory')}>
                Directory
              </NavButton>
              {user.role === 'Student' && (
                <NavButton active={currentView === 'mentors'} onClick={() => setCurrentView('mentors')}>
                  Find Mentors
                </NavButton>
              )}
              <NavButton active={currentView === 'jobs'} onClick={() => setCurrentView('jobs')}>
                Jobs
              </NavButton>
              {user.role === 'Admin' && (
                <NavButton active={currentView === 'admin'} onClick={() => setCurrentView('admin')}>
                  Admin
                </NavButton>
              )}
            </nav>
          </div>
          
          <div className="flex items-center space-x-4">
            <Badge variant="secondary" className="bg-blue-600 text-white">
              {user.role}
            </Badge>
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

// Feed View
const FeedView = ({ user, token }) => {
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const response = await axios.get(`${API}/posts/feed`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPosts(response.data);
    } catch (error) {
      toast.error('Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPost.trim()) return;

    try {
      await axios.post(`${API}/posts`, { content: newPost }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewPost('');
      fetchPosts();
      toast.success('Post created!');
    } catch (error) {
      toast.error('Failed to create post');
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
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
            />
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
              Share Post
            </Button>
          </form>
        </CardContent>
      </Card>

      {posts.map((post) => (
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
                <p className="text-gray-200 mb-4">{post.content}</p>
                <div className="flex items-center space-x-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleLike(post.id)}
                    className="text-gray-400 hover:text-blue-400"
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
      ))}
    </div>
  );
};

// Directory View
const DirectoryView = ({ user, token }) => {
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({ major: '', industry: '', role: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, [filters]);

  const fetchUsers = async () => {
    try {
      const params = new URLSearchParams();
      Object.keys(filters).forEach(key => {
        if (filters[key]) params.append(key, filters[key]);
      });
      
      const response = await axios.get(`${API}/users?${params.toString()}`);
      setUsers(response.data);
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {users.map((person) => (
            <Card key={person.id} className="bg-slate-800 border-slate-700">
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

// Mentor View (Students only)
const MentorView = ({ user, token }) => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [aiPowered, setAiPowered] = useState(false);

  const findMentors = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/ai/mentor-match`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMatches(response.data.matches);
      setAiPowered(response.data.ai_powered);
      toast.success(`Found ${response.data.matches.length} mentor matches!`);
    } catch (error) {
      toast.error('Failed to find mentors');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">AI-Powered Mentor Matching</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-gray-300 mb-6">
            Get personalized mentor recommendations based on your profile, major, and career goals.
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

      {matches.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {matches.map((mentor) => (
            <Card key={mentor.id} className="bg-slate-800 border-slate-700">
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
      )}
    </div>
  );
};

// Jobs View
const JobsView = ({ user, token }) => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateJob, setShowCreateJob] = useState(false);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const response = await axios.get(`${API}/jobs`);
      setJobs(response.data);
    } catch (error) {
      toast.error('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-white">Job Board</CardTitle>
          {user.role === 'Alumni' && (
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
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <Card key={job.id} className="bg-slate-800 border-slate-700">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-white font-semibold text-lg mb-2">{job.title}</h3>
                    <p className="text-blue-400 font-medium mb-2">{job.company}</p>
                    {job.location && (
                      <p className="text-gray-400 text-sm mb-4">📍 {job.location}</p>
                    )}
                    <p className="text-gray-300 mb-4">{job.description}</p>
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

// Profile View
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
      toast.error('Failed to update profile');
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
              <Badge className="bg-blue-600 text-white mt-2">{user.role}</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-white">Email</Label>
                <Input value={user.email} disabled className="bg-slate-700 border-slate-600 text-gray-400" />
              </div>
              <div>
                <Label className="text-white">Major</Label>
                <Input value={user.major || ''} disabled className="bg-slate-700 border-slate-600 text-gray-400" />
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
                  Available as a mentor
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

// Admin View
const AdminView = ({ user, token }) => {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  const fetchPendingUsers = async () => {
    try {
      const response = await axios.get(`${API}/admin/pending-users`, {
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
      await axios.post(`${API}/admin/verify-user/${userId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('User verified successfully!');
      fetchPendingUsers();
    } catch (error) {
      toast.error('Failed to verify user');
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Admin Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-300">Manage user verifications and platform settings.</p>
        </CardContent>
      </Card>

      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Pending User Verifications</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-white text-center py-8">Loading pending users...</div>
          ) : pendingUsers.length === 0 ? (
            <div className="text-gray-400 text-center py-8">No pending verifications</div>
          ) : (
            <div className="space-y-4">
              {pendingUsers.map((pendingUser) => (
                <div key={pendingUser.id} className="flex items-center justify-between p-4 bg-slate-700 rounded-lg">
                  <div>
                    <h4 className="text-white font-semibold">
                      {pendingUser.first_name} {pendingUser.last_name}
                    </h4>
                    <p className="text-gray-300 text-sm">{pendingUser.email}</p>
                    <p className="text-gray-400 text-sm">
                      {pendingUser.role} • {pendingUser.major}
                    </p>
                  </div>
                  <Button 
                    onClick={() => verifyUser(pendingUser.id)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Verify
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Main App Component
const App = () => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
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

  const openLogin = () => {
    setAuthMode('login');
    setShowAuth(true);
  };

  const openRegister = () => {
    setAuthMode('register');
    setShowAuth(true);
  };

  return (
    <div className="App">
      <Toaster />
      
      {!user ? (
        <>
          <LandingPage onLogin={openLogin} onRegister={openRegister} />
          <AuthModal
            isOpen={showAuth}
            onClose={() => setShowAuth(false)}
            mode={authMode}
            onToggleMode={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
            onAuth={handleAuth}
          />
        </>
      ) : (
        <Dashboard user={user} token={token} onLogout={handleLogout} />
      )}
    </div>
  );
};

export default App;