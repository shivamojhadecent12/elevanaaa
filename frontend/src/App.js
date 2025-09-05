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
      const endpoint = 'auth/register';
      const response = await axios.post(`${API}/${endpoint}`, formData);
      toast.success(response.data.message);
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Registration failed');
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

// Create Job Modal
const CreateJobModal = ({ isOpen, onClose, token, onJobPosted }) => {
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    location: '',
    description: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/jobs`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Job posted successfully!');
      onJobPosted();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to post job');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg bg-slate-900 text-white border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">Post a New Job</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Job Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              className="bg-slate-800 border-slate-600"
            />
          </div>
          <div>
            <Label htmlFor="company">Company</Label>
            <Input
              id="company"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              required
              className="bg-slate-800 border-slate-600"
            />
          </div>
          <div>
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g., Remote, New York, NY"
              className="bg-slate-800 border-slate-600"
            />
          </div>
          <div>
            <Label htmlFor="description">Job Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              className="bg-slate-800 border-slate-600"
              rows={5}
            />
          </div>
          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
            {loading ? 'Posting...' : 'Post Job'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
// Job Apply Modal
const JobApplyModal = ({ isOpen, onClose, token, jobId }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error('Please upload a resume file.');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('resume', file);

    try {
      await axios.post(`${API}/jobs/${jobId}/apply`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        }
      });
      toast.success('Application submitted successfully!');
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit application.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg bg-slate-900 text-white border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">Apply for Job</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="resume">Upload Resume (PDF/DOCX)</Label>
            <Input
              id="resume"
              type="file"
              accept=".pdf,.docx"
              onChange={handleFileChange}
              required
              className="bg-slate-800 border-slate-600"
            />
          </div>
          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
            {loading ? 'Submitting...' : 'Submit Application'}
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
            {mode === 'login' ? 'Welcome Back' : 'Join Elevanaa'}
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

// Chat View
const ChatView = ({ token, chatId, user }) => {
    const [chat, setChat] = useState(null);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchChat();
    }, [chatId]);

    const fetchChat = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`${API}/chats/${chatId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setChat(response.data);
            setError(null);
        } catch (error) {
            setError('Failed to load chat');
            toast.error('Failed to load chat.');
        } finally {
            setLoading(false);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        try {
            await axios.post(`${API}/chats/${chatId}/message`, { text: newMessage }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNewMessage('');
            fetchChat(); // Refresh chat after sending
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to send message');
        }
    };

    if (loading) return <div className="text-white text-center py-12">Loading chat...</div>;
    if (error) return <ErrorState title="Chat Error" description={error} onRetry={fetchChat} />;

    return (
        <Card className="bg-slate-800 border-slate-700 max-w-2xl mx-auto h-[600px] flex flex-col">
            <CardHeader className="border-b border-slate-700">
                <CardTitle className="text-white">
                    Chat with {chat?.participants.find(p => p.id !== user.id)?.name}
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                {chat?.messages.map((msg, index) => (
                    <div
                        key={index}
                        className={`flex ${msg.sender_id === user.id ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`rounded-lg p-3 max-w-[70%] text-sm ${
                                msg.sender_id === user.id
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-700 text-gray-200'
                            }`}
                        >
                            <p>{msg.text}</p>
                            <span className="block text-xs text-right opacity-50 mt-1">
                                {new Date(msg.created_at).toLocaleTimeString()}
                            </span>
                        </div>
                    </div>
                ))}
            </CardContent>
            <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-700">
                <div className="flex space-x-2">
                    <Input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 bg-slate-700 border-slate-600 text-white"
                    />
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                        Send
                    </Button>
                </div>
            </form>
        </Card>
    );
};

// Mentor Requests View
const MentorRequestsView = ({ user, token, setCurrentView }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/mentorship/requests/pending`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRequests(response.data);
      setError(null);
    } catch (error) {
      setError('Failed to load requests.');
      toast.error(error.response?.data?.detail || 'Failed to load mentorship requests');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      const response = await axios.post(`${API}/mentorship/requests/${requestId}/accept`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(response.data.message);
      fetchRequests(); // Refresh the list of requests
      // Automatically navigate to the new chat
      setCurrentView(`chat-${response.data.chat_id}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to accept request.');
    }
  };
  
  const handleRejectRequest = async (requestId) => {
    try {
      await axios.post(`${API}/mentorship/requests/${requestId}/reject`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Mentorship request rejected.');
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject request.');
    }
  };

  if (loading) return <div className="text-white text-center py-12">Loading requests...</div>;
  if (error) return <ErrorState title="Request Error" description={error} onRetry={fetchRequests} />;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Incoming Mentorship Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <EmptyState
              icon="📧"
              title="No Pending Requests"
              description="You have no new mentorship requests at the moment."
            />
          ) : (
            <div className="space-y-4">
              {requests.map(req => (
                <div key={req.id} className="flex items-center justify-between p-4 bg-slate-700 rounded-lg">
                  <div>
                    <h4 className="text-white font-semibold">{req.student_name}</h4>
                    <p className="text-gray-400 text-sm">Requested mentorship</p>
                  </div>
                  <div className="flex space-x-2">
                    <Button 
                      onClick={() => handleAcceptRequest(req.id)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Accept
                    </Button>
                     <Button 
                      onClick={() => handleRejectRequest(req.id)}
                      variant="destructive"
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
    </div>
  );
};
// Dashboard Components
const Dashboard = ({ user, token, onLogout, refreshUser }) => {
  const [currentView, setCurrentView] = useState('feed');
  const [chats, setChats] = useState([]);

  useEffect(() => {
    if (user && user.status === 'Verified') {
      fetchChats();
    }
  }, [user, token]);

  const fetchChats = async () => {
    try {
      const response = await axios.get(`${API}/chats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setChats(response.data);
    } catch (error) {
      console.error('Failed to fetch chats:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-900">
      <Header user={user} onLogout={onLogout} currentView={currentView} setCurrentView={setCurrentView} chatsCount={chats.length} />
      
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
          {currentView === 'mentors' && <MentorView user={user} token={token} setCurrentView={setCurrentView} />}
          {currentView === 'jobs' && <JobsView user={user} token={token} />}
          {currentView === 'profile' && <ProfileView user={user} token={token} refreshUser={refreshUser} />}
          {currentView === 'admin' && (user.role === 'Institution_Admin' || user.role === 'Platform_Admin') && <AdminView user={user} token={token} />}
          {currentView === 'mentor-requests' && user.role === 'Alumni' && user.is_mentor && <MentorRequestsView user={user} token={token} setCurrentView={setCurrentView} />}
          {currentView.startsWith('chat-') && <ChatView user={user} token={token} chatId={currentView.substring(5)} />}
          {currentView === 'chat-list' && <ChatListView user={user} token={token} setCurrentView={setCurrentView} chats={chats} />}
        </div>
      </main>
    </div>
  );
};

const ChatListView = ({ user, token, setCurrentView, chats }) => {
  if (chats.length === 0) {
    return (
      <EmptyState
        icon="💬"
        title="No Active Chats"
        description="You don't have any active chats. Start a conversation by accepting a mentorship request."
      />
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Your Chats</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="space-y-4">
            {chats.map(chat => (
              <div 
                key={chat.id} 
                onClick={() => setCurrentView(`chat-${chat.id}`)}
                className="flex items-center justify-between p-4 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors cursor-pointer"
              >
                <div>
                  <h4 className="text-white font-semibold">{chat.participants.find(p => p.id !== user.id)?.name || 'Unknown User'}</h4>
                  <p className="text-gray-400 text-sm">Last message: {new Date(chat.messages[chat.messages.length - 1]?.created_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default App;
