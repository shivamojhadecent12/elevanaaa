from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, status, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, field_validator
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import jwt
from passlib.context import CryptContext
import google.generativeai as genai
import json
import html
import bleach
from contextlib import asynccontextmanager
import requests

# Define the root directory
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Rate limiting setup
limiter = Limiter(key_func=get_remote_address)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = "alumni-connect-secret-key-production-2024"
ALGORITHM = "HS256"

# Gemini API setup
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

# RocketReach API setup
ROCKETREACH_API_KEY = os.environ.get("ROCKETREACH_API_KEY")
ROCKETREACH_API_URL = "https://api.rocketreach.co/v2/api/person/lookup"

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Correctly define lifespan and app
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup tasks
    logger.info("Application starting up...")
    yield
    # Shutdown tasks
    logger.info("Application shutting down...")
    client.close()

# Create the main app with the lifespan context manager
app = FastAPI(title="Elevanaa API", version="2.0.0", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Input sanitization
def sanitize_input(text: str) -> str:
    """Sanitize user input to prevent XSS"""
    if not text:
        return text
    text = bleach.clean(text, tags=[], attributes={}, strip=True)
    text = html.escape(text)
    return text.strip()

def validate_email(email: str) -> bool:
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

# Models
class Institution(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    website: str
    status: str = "Pending"
    institution_admin_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @field_validator('name')
    def validate_name(cls, v):
        v = sanitize_input(v)
        if not v or len(v) < 3:
            raise ValueError('Institution name must be at least 3 characters')
        return v
    
    @field_validator('website')
    def validate_website(cls, v):
        v = sanitize_input(v)
        if not v.startswith(('http://', 'https://')):
            v = 'https://' + v
        return v

class InstitutionCreate(BaseModel):
    name: str
    website: str
    admin_first_name: str
    admin_last_name: str
    admin_email: EmailStr
    admin_password: str
    
    @field_validator('name', 'admin_first_name', 'admin_last_name')
    def sanitize_text_fields(cls, v):
        return sanitize_input(v)

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    first_name: str
    last_name: str
    role: str
    status: str = "Pending"
    institution_id: Optional[str] = None
    graduation_year: Optional[int] = None
    major: Optional[str] = None
    industry: Optional[str] = None
    location: Optional[str] = None
    company: Optional[str] = None
    profile_picture_url: Optional[str] = None
    is_mentor: bool = False
    connections: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    role: str
    institution_id: Optional[str] = None
    graduation_year: Optional[int] = None
    major: Optional[str] = None
    company: Optional[str] = None
    
    @field_validator('first_name', 'last_name', 'major', 'company')
    def sanitize_text_fields(cls, v):
        if v:
            return sanitize_input(v)
        return v
    
    @field_validator('password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        return v
    
    @field_validator('role')
    def validate_role(cls, v):
        valid_roles = ["Student", "Alumni"]
        if v not in valid_roles:
            raise ValueError(f'Role must be one of: {valid_roles}')
        return v

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserProfile(BaseModel):
    industry: Optional[str] = None
    location: Optional[str] = None
    company: Optional[str] = None
    is_mentor: Optional[bool] = None
    profile_picture_url: Optional[str] = None
    
    @field_validator('industry', 'location', 'company')
    def sanitize_text_fields(cls, v):
        if v:
            return sanitize_input(v)
        return v

class Post(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    author_id: str
    author_name: str
    institution_id: str
    content: str
    likes: List[str] = []
    comments: List[Dict[str, Any]] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PostCreate(BaseModel):
    content: str
    
    @field_validator('content')
    def validate_content(cls, v):
        v = sanitize_input(v)
        if not v or len(v) < 1:
            raise ValueError('Post content cannot be empty')
        if len(v) > 2000:
            raise ValueError('Post content cannot exceed 2000 characters')
        return v

class Comment(BaseModel):
    author_id: str
    author_name: str
    text: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    @field_validator('text')
    def validate_text(cls, v):
        v = sanitize_input(v)
        if not v or len(v) < 1:
            raise ValueError('Comment cannot be empty')
        return v

class Job(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    posted_by: str
    institution_id: str
    title: str
    company: str
    location: Optional[str] = None
    description: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class JobCreate(BaseModel):
    title: str
    company: str
    location: Optional[str] = None
    description: str
    
    @field_validator('title', 'company', 'location', 'description')
    def sanitize_text_fields(cls, v):
        if v:
            return sanitize_input(v)
        return v

class MentorshipRequest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    student_name: str
    mentor_id: str
    mentor_name: str
    status: str = "Pending"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class JobApplication(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    job_id: str
    applicant_id: str
    applicant_name: str
    resume_url: str
    status: str = "Pending"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Chat(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    participants: List[str]
    messages: List[Dict[str, Any]] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
class Message(BaseModel):
    sender_id: str
    sender_name: str
    text: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
# Helper functions
def create_access_token(data: dict):
    return jwt.encode(data, SECRET_KEY, algorithm=ALGORITHM)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_email: str = payload.get("sub")
        if user_email is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        
        user = await db.users.find_one({"email": user_email})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        return User(**user)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

async def require_platform_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "Platform_Admin":
        raise HTTPException(status_code=403, detail="Platform admin access required")
    return current_user

async def require_institution_admin(current_user: User = Depends(get_current_user)):
    if current_user.role not in ["Institution_Admin", "Platform_Admin"]:
        raise HTTPException(status_code=403, detail="Institution admin access required")
    return current_user

def prepare_for_mongo(data):
    if isinstance(data, dict):
        result = {}
        for key, value in data.items():
            if isinstance(value, datetime):
                result[key] = value.isoformat()
            elif isinstance(value, list):
                result[key] = [prepare_for_mongo(item) if isinstance(item, dict) else item for item in value]
            elif isinstance(value, dict):
                result[key] = prepare_for_mongo(value)
            else:
                result[key] = value
        return result
    return data

def parse_from_mongo(item):
    if isinstance(item.get('created_at'), str):
        item['created_at'] = datetime.fromisoformat(item['created_at'])
    return item

# RocketReach helper function
async def get_linkedin_url_from_rocketreach(full_name: str, company_name: str):
    """Fetches LinkedIn URL from RocketReach based on name and company."""
    if not ROCKETREACH_API_KEY:
        raise HTTPException(status_code=500, detail="RocketReach API key not configured")

    headers = {
        "Api-Key": ROCKETREACH_API_KEY
    }
    
    params = {
        "name": full_name,
        "current_employer": company_name
    }

    try:
        response = requests.get(ROCKETREACH_API_URL, params=params, headers=headers)
        response.raise_for_status()
        
        result = response.json()
        
        if result.get("data") and result["data"].get("linkedin_url"):
            return result["data"]["linkedin_url"]
            
    except requests.exceptions.HTTPError as http_err:
        if http_err.response.status_code == 402:
            raise HTTPException(status_code=402, detail="Lookup monthly rate limit reached. Please try again next month.")
        if http_err.response.status_code == 404:
             raise HTTPException(status_code=404, detail="LinkedIn profile not found for this user.")
        logger.error(f"RocketReach API HTTP error: {http_err.response.text}")
        raise HTTPException(status_code=500, detail="Failed to fetch data from external API")
    except requests.exceptions.RequestException as e:
        logger.error(f"RocketReach API request failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch data from external API")
    
    return None

# Root route
@api_router.get("/")
async def root():
    return {"message": "Elevanaa API", "status": "running", "features": ["multi-institution", "ai-powered"]}

# Institution Management Routes
@api_router.post("/institutions/register")
@limiter.limit("3/minute")
async def register_institution(request: Request, institution_data: InstitutionCreate):
    """Register a new institution for approval"""
    
    if not validate_email(institution_data.admin_email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    
    existing_institution = await db.institutions.find_one({"name": institution_data.name})
    if existing_institution:
        raise HTTPException(status_code=400, detail="Institution already registered")
    
    existing_user = await db.users.find_one({"email": institution_data.admin_email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    institution = Institution(
        name=institution_data.name,
        website=institution_data.website
    )
    
    hashed_password = get_password_hash(institution_data.admin_password)
    admin_user = User(
        email=institution_data.admin_email,
        first_name=sanitize_input(institution_data.admin_first_name),
        last_name=sanitize_input(institution_data.admin_last_name),
        role="Institution_Admin",
        status="Pending",
        institution_id=institution.id
    )
    
    institution_mongo = prepare_for_mongo(institution.dict())
    institution_mongo['institution_admin_id'] = admin_user.id
    await db.institutions.insert_one(institution_mongo)
    
    admin_user_mongo = prepare_for_mongo(admin_user.dict())
    admin_user_mongo['password'] = hashed_password
    await db.users.insert_one(admin_user_mongo)
    
    return {
        "message": "Institution registration submitted for review",
        "institution_id": institution.id,
        "status": "pending_approval"
    }

@api_router.get("/institutions", response_model=List[Institution])
async def get_institutions():
    """Get all approved institutions for registration dropdown"""
    institutions = await db.institutions.find({"status": "Approved"}).to_list(length=None)
    return [Institution(**parse_from_mongo(inst)) for inst in institutions]

@api_router.get("/admin/institutions/pending")
async def get_pending_institutions(platform_admin: User = Depends(require_platform_admin)):
    """Platform admin: Get all pending institutions"""
    institutions = await db.institutions.find({"status": "Pending"}).to_list(length=None)
    
    result = []
    for inst in institutions:
        admin_user = await db.users.find_one({"id": inst.get("institution_admin_id")})
        inst_data = Institution(**parse_from_mongo(inst)).dict()
        if admin_user:
            inst_data['admin_details'] = {
                "name": f"{admin_user['first_name']} {admin_user['last_name']}",
                "email": admin_user['email']
            }
        result.append(inst_data)
    
    return result

@api_router.post("/admin/institutions/{institution_id}/approve")
async def approve_institution(institution_id: str, platform_admin: User = Depends(require_platform_admin)):
    """Platform admin: Approve an institution"""
    result = await db.institutions.update_one(
        {"id": institution_id},
        {"$set": {"status": "Approved"}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Institution not found")
    
    await db.users.update_one(
        {"institution_id": institution_id, "role": "Institution_Admin"},
        {"$set": {"status": "Verified"}}
    )
    
    return {"message": "Institution approved successfully"}

@api_router.post("/admin/institutions/{institution_id}/reject")
async def reject_institution(institution_id: str, platform_admin: User = Depends(require_platform_admin)):
    """Platform admin: Reject an institution"""
    result = await db.institutions.update_one(
        {"id": institution_id},
        {"$set": {"status": "Rejected"}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Institution not found")
    
    return {"message": "Institution rejected"}

# Auth routes with rate limiting
@api_router.post("/auth/register")
@limiter.limit("5/minute")
async def register(request: Request, user_data: UserCreate):
    """Register a new user"""
    
    if not validate_email(user_data.email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    if user_data.institution_id:
        institution = await db.institutions.find_one({"id": user_data.institution_id, "status": "Approved"})
        if not institution:
            raise HTTPException(status_code=400, detail="Invalid or unapproved institution")
    
    hashed_password = get_password_hash(user_data.password)
    
    user_dict = user_data.dict()
    del user_dict['password']
    
    user = User(**user_dict)
    user_mongo = prepare_for_mongo(user.dict())
    user_mongo['password'] = hashed_password
    
    await db.users.insert_one(user_mongo)
    
    access_token = create_access_token(data={"sub": user.email})
    
    return {"access_token": access_token, "token_type": "bearer", "user": user}

@api_router.post("/auth/login")
@limiter.limit("10/minute")
async def login(request: Request, user_data: UserLogin):
    """Login user"""
    
    if not validate_email(user_data.email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    
    user = await db.users.find_one({"email": user_data.email})
    if not user or not verify_password(user_data.password, user['password']):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    user_obj = User(**parse_from_mongo(user))
    access_token = create_access_token(data={"sub": user_obj.email})
    
    return {"access_token": access_token, "token_type": "bearer", "user": user_obj}

# User routes
@api_router.get("/users", response_model=List[User])
async def get_users(
    major: Optional[str] = None, 
    industry: Optional[str] = None, 
    role: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get users directory (institution-scoped for Institution Admins)"""
    
    query = {"status": "Verified"}
    
    if current_user.role == "Institution_Admin":
        query["institution_id"] = current_user.institution_id
    
    if major:
        query["major"] = sanitize_input(major)
    if industry:
        query["industry"] = sanitize_input(industry)
    if role:
        query["role"] = sanitize_input(role)
    
    users = await db.users.find(query).to_list(length=None)
    return [User(**parse_from_mongo(user)) for user in users]

@api_router.get("/users/profile")
async def get_profile(current_user: User = Depends(get_current_user)):
    """Get current user profile"""
    return current_user

@api_router.put("/users/profile")
async def update_profile(profile_data: UserProfile, current_user: User = Depends(get_current_user)):
    """Update user profile"""
    update_data = {k: v for k, v in profile_data.dict().items() if v is not None}
    
    if 'is_mentor' in update_data and current_user.role != 'Alumni':
        raise HTTPException(status_code=403, detail="Only alumni can be mentors")
    
    await db.users.update_one(
        {"email": current_user.email},
        {"$set": update_data}
    )
    
    updated_user = await db.users.find_one({"email": current_user.email})
    
    return User(**parse_from_mongo(updated_user))

# Change this endpoint from POST to GET and use query parameters
@api_router.get("/users/get-linkedin")
async def get_user_linkedin(full_name: str, company_name: str):
    """
    Finds a user's LinkedIn profile using RocketReach.
    Requires full name and company name as query parameters.
    """
    if not full_name or not company_name:
        raise HTTPException(status_code=400, detail="Full name and company name are required.")

    linkedin_url = await get_linkedin_url_from_rocketreach(full_name, company_name)
    
    if not linkedin_url:
        raise HTTPException(status_code=404, detail="LinkedIn profile not found for this user.")

    return {"linkedin_url": linkedin_url}


# Posts routes (institution-scoped)
@api_router.get("/posts/feed", response_model=List[Post])
async def get_feed(current_user: User = Depends(get_current_user)):
    """Get posts feed (institution-scoped)"""
    
    query = {}
    if current_user.role != "Platform_Admin":
        query["institution_id"] = current_user.institution_id
    
    posts = await db.posts.find(query).sort("created_at", -1).to_list(length=100)
    return [Post(**parse_from_mongo(post)) for post in posts]

@api_router.post("/posts", response_model=Post)
async def create_post(post_data: PostCreate, current_user: User = Depends(get_current_user)):
    """Create a new post"""
    
    if current_user.status != "Verified":
        raise HTTPException(status_code=403, detail="Account must be verified to post")
    
    post = Post(
        author_id=current_user.id,
        author_name=f"{current_user.first_name} {current_user.last_name}",
        institution_id=current_user.institution_id,
        content=post_data.content
    )
    
    post_mongo = prepare_for_mongo(post.dict())
    await db.posts.insert_one(post_mongo)
    
    return post

@api_router.post("/posts/{post_id}/like")
async def like_post(post_id: str, current_user: User = Depends(get_current_user)):
    """Like/unlike a post"""
    
    post = await db.posts.find_one({"id": sanitize_input(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    likes = post.get('likes', [])
    if current_user.id in likes:
        likes.remove(current_user.id)
    else:
        likes.append(current_user.id)
    
    await db.posts.update_one({"id": post_id}, {"$set": {"likes": likes}})
    return {"liked": current_user.id in likes, "likes_count": len(likes)}

@api_router.post("/posts/{post_id}/comment")
async def add_comment(post_id: str, comment_text: dict, current_user: User = Depends(get_current_user)):
    """Add comment to a post"""
    
    post = await db.posts.find_one({"id": sanitize_input(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    comment = Comment(
        author_id=current_user.id,
        author_name=f"{current_user.first_name} {current_user.last_name}",
        text=sanitize_input(comment_text.get('text', ''))
    )
    
    comments = post.get('comments', [])
    comments.append(prepare_for_mongo(comment.dict()))
    
    await db.posts.update_one({"id": post_id}, {"$set": {"comments": comments}})
    return comment

# Jobs routes (institution-scoped)
@api_router.get("/jobs", response_model=List[Job])
async def get_jobs(current_user: User = Depends(get_current_user)):
    """Get jobs (institution-scoped)"""
    
    query = {}
    if current_user.role != "Platform_Admin":
        query["institution_id"] = current_user.institution_id
        
    jobs = await db.jobs.find(query).to_list(length=50)
    return [Job(**parse_from_mongo(job)) for job in jobs]

@api_router.post("/jobs", response_model=Job)
async def create_job(job_data: JobCreate, current_user: User = Depends(get_current_user)):
    """Create a job posting (Alumni only)"""
    
    if current_user.role not in ["Alumni", "Institution_Admin", "Platform_Admin"]:
        raise HTTPException(status_code=403, detail="Only alumni can post jobs")
    
    if current_user.status != "Verified":
        raise HTTPException(status_code=403, detail="Account must be verified to post jobs")
    
    job = Job(
        posted_by=current_user.id,
        institution_id=current_user.institution_id,
        **job_data.dict()
    )
    
    job_mongo = prepare_for_mongo(job.dict())
    await db.jobs.insert_one(job_mongo)
    
    return job

@api_router.post("/jobs/{job_id}/apply")
@limiter.limit("1/minute")
async def apply_for_job(request: Request, job_id: str, resume: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    """A user can apply for a job by uploading a resume."""

    if current_user.status != "Verified":
        raise HTTPException(status_code=403, detail="Account must be verified to apply for jobs.")

    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    
    resume_url = f"resume/{current_user.id}_{resume.filename}"

    existing_application = await db.job_applications.find_one({
        "job_id": job_id,
        "applicant_id": current_user.id
    })
    if existing_application:
        raise HTTPException(status_code=400, detail="You have already applied for this job.")

    application_data = JobApplication(
        job_id=job_id,
        applicant_id=current_user.id,
        applicant_name=f"{current_user.first_name} {current_user.last_name}",
        resume_url=resume_url
    ).dict()
    
    await db.job_applications.insert_one(application_data)

    return {"message": "Application submitted successfully!", "resume_url": resume_url}

@api_router.get("/jobs/{job_id}/applications", response_model=List[JobApplication])
async def get_job_applications(job_id: str, current_user: User = Depends(get_current_user)):
    """Get all applications for a specific job posting."""
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    if job['posted_by'] != current_user.id:
        raise HTTPException(status_code=403, detail="You are not authorized to view these applications.")
    
    applications = await db.job_applications.find({"job_id": job_id}).to_list(length=None)
    return [JobApplication(**parse_from_mongo(app)) for app in applications]


# AI Mentor Matching with enhanced reliability using Gemini
@api_router.get("/ai/mentor-match")
async def get_mentor_matches(current_user: User = Depends(get_current_user)):
    """Get AI-powered mentor matches (Students only)"""
    
    if current_user.role != "Student":
        raise HTTPException(status_code=403, detail="Only students can request mentor matches")
    
    if current_user.status != "Verified":
        raise HTTPException(status_code=403, detail="Account must be verified to access mentor matching")
    
    try:
        mentors = await db.users.find({
            "role": "Alumni",
            "is_mentor": True,
            "status": "Verified",
            "institution_id": current_user.institution_id
        }).to_list(length=None)
        
        if not mentors:
            return {"matches": [], "message": "No mentors available in your institution", "ai_powered": False}
        
        try:
            model = genai.GenerativeModel('gemini-1.5-flash')
            
            student_profile = {
                "major": current_user.major,
                "graduation_year": current_user.graduation_year,
                "location": current_user.location,
                "industry": current_user.industry
            }
            
            mentor_profiles = []
            for mentor in mentors:
                mentor_profiles.append({
                    "id": mentor["id"],
                    "name": f"{mentor['first_name']} {mentor['last_name']}",
                    "major": mentor.get("major"),
                    "industry": mentor.get("industry"),
                    "location": mentor.get("location")
                })
            
            prompt = f"""
            Student Profile: {json.dumps(student_profile)}
            Available Mentors: {json.dumps(mentor_profiles)}
            
            Analyze compatibility and return the top 5 mentor IDs as a JSON array in order of best match.
            Consider: 1) Major alignment 2) Industry relevance 3) Location proximity 4) Career progression.
            
            Return format: ["mentor-id-1", "mentor-id-2", "mentor-id-3"]
            """
            
            response = await model.generate_content_async(prompt)
            
            raw_text = response.text.strip()
            clean_text = raw_text.split("```json")[-1].split("```")[0].strip()
            
            if not clean_text:
                clean_text = raw_text.split("]")[0] + "]"
            
            mentor_ids = json.loads(clean_text)
            
            if isinstance(mentor_ids, list):
                matched_mentors = []
                for mentor_id in mentor_ids[:5]:
                    mentor = await db.users.find_one({"id": mentor_id})
                    if mentor:
                        matched_mentors.append(User(**parse_from_mongo(mentor)))
                
                if matched_mentors:
                    return {"matches": matched_mentors, "ai_powered": True}

        except Exception as ai_error:
            logging.warning(f"AI matching failed: {ai_error}")
            
        # Fallback to rule-based matching if AI fails
        rule_based_matches = []
        for mentor in mentors:
            score = 0
            
            if mentor.get("major") == current_user.major:
                score += 100
            
            if mentor.get("industry") == current_user.industry:
                score += 50
            
            if mentor.get("location") == current_user.location:
                score += 25
            
            mentor['match_score'] = score
            
        sorted_mentors = sorted(mentors, key=lambda x: x.get('match_score', 0), reverse=True)
        rule_based_matches = [User(**parse_from_mongo(mentor)) for mentor in sorted_mentors[:5]]
        
        return {
            "matches": rule_based_matches,
            "ai_powered": False,
            "fallback": True,
            "message": "Matches generated using advanced compatibility algorithm"
        }
    
    except Exception as e:
        logging.error(f"Mentor matching error: {e}")
        raise HTTPException(status_code=500, detail="Mentor matching temporarily unavailable")

@api_router.post("/mentorship/request/{mentor_id}")
async def request_mentorship(request: Request, mentor_id: str, current_user: User = Depends(get_current_user)):
    """A student can request mentorship from a verified alumni mentor."""
    if current_user.role != "Student" or current_user.status != "Verified":
        raise HTTPException(status_code=403, detail="Only verified students can request mentorship.")

    mentor = await db.users.find_one({"id": mentor_id, "is_mentor": True, "status": "Verified"})
    if not mentor:
        raise HTTPException(status_code=404, detail="Mentor not found or is not available.")

    if current_user.id == mentor_id:
        raise HTTPException(status_code=400, detail="Cannot request mentorship from yourself.")

    existing_request = await db.mentorship_requests.find_one({
        "student_id": current_user.id,
        "mentor_id": mentor_id,
        "status": {"$in": ["Pending", "Accepted"]}
    })
    if existing_request:
        raise HTTPException(status_code=400, detail="Mentorship request already exists.")

    request_id = str(uuid.uuid4())
    mentorship_request = {
        "id": request_id,
        "student_id": current_user.id,
        "student_name": f"{current_user.first_name} {current_user.last_name}",
        "mentor_id": mentor_id,
        "mentor_name": f"{mentor['first_name']} {mentor['last_name']}",
        "status": "Pending",
        "created_at": datetime.now(timezone.utc)
    }
    await db.mentorship_requests.insert_one(mentorship_request)

    return {"message": "Mentorship request sent successfully!", "request_id": request_id}

@api_router.get("/mentorship/requests/pending")
async def get_pending_mentorship_requests(current_user: User = Depends(get_current_user)):
    """Mentor can view pending mentorship requests."""
    if current_user.role != 'Alumni' or not current_user.is_mentor:
        raise HTTPException(status_code=403, detail="You are not authorized to view this page.")

    requests = await db.mentorship_requests.find({
        "mentor_id": current_user.id,
        "status": "Pending"
    }).to_list(length=None)

    return [MentorshipRequest(**parse_from_mongo(req)) for req in requests]

@api_router.post("/mentorship/requests/{request_id}/accept")
async def accept_mentorship_request(request_id: str, current_user: User = Depends(get_current_user)):
    """A mentor can accept a mentorship request from a student."""
    mentorship_request = await db.mentorship_requests.find_one({"id": request_id})

    if not mentorship_request:
        raise HTTPException(status_code=404, detail="Mentorship request not found.")
    
    if mentorship_request['mentor_id'] != current_user.id:
        raise HTTPException(status_code=403, detail="You are not authorized to accept this request.")

    if mentorship_request['status'] != "Pending":
        raise HTTPException(status_code=400, detail="Request is not in a pending state.")
    
    await db.mentorship_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "Accepted"}}
    )

    chat_id = str(uuid.uuid4())
    chat = {
        "id": chat_id,
        "participants": [mentorship_request['student_id'], mentorship_request['mentor_id']],
        "messages": [{
            "sender_id": current_user.id,
            "sender_name": f"{current_user.first_name} {current_user.last_name}",
            "text": "Hello, I have accepted your mentorship request. Let's get started!",
            "created_at": datetime.now(timezone.utc)
        }],
        "created_at": datetime.now(timezone.utc)
    }
    await db.chats.insert_one(chat)

    return {"message": "Mentorship request accepted and chat started!", "chat_id": chat_id}


# Institution Admin routes
@api_router.get("/admin/users/pending")
async def get_pending_users(institution_admin: User = Depends(require_institution_admin)):
    """Institution admin: Get pending users from their institution"""
    
    query = {"status": "Pending"}
    
    if institution_admin.role == "Institution_Admin":
        query["institution_id"] = institution_admin.institution_id
    
    users = await db.users.find(query).to_list(length=None)
    return [User(**parse_from_mongo(user)) for user in users]

@api_router.post("/admin/users/{user_id}/verify")
async def verify_user(user_id: str, institution_admin: User = Depends(require_institution_admin)):
    """Institution admin: Verify a user"""
    
    user = await db.users.find_one({"id": sanitize_input(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if institution_admin.role == "Institution_Admin" and user["institution_id"] != institution_admin.institution_id:
        raise HTTPException(status_code=403, detail="Can only verify users from your institution")
    
    await db.users.update_one({"id": user_id}, {"$set": {"status": "Verified"}})
    return {"message": "User verified successfully"}

@api_router.post("/admin/users/{user_id}/reject")
async def reject_user(user_id: str, institution_admin: User = Depends(require_institution_admin)):
    """Institution admin: Reject a user"""
    
    user = await db.users.find_one({"id": sanitize_input(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if institution_admin.role == "Institution_Admin" and user["institution_id"] != institution_admin.institution_id:
        raise HTTPException(status_code=403, detail="Can only reject users from your institution")
    
    await db.users.update_one({"id": user_id}, {"$set": {"status": "Rejected"}})
    return {"message": "User rejected"}

# Platform Admin route to create initial admin
@api_router.post("/admin/create-platform-admin")
async def create_platform_admin(admin_data: dict):
    """Create initial platform admin (one-time setup)"""
    
    existing_admin = await db.users.find_one({"role": "Platform_Admin"})
    if existing_admin:
        raise HTTPException(status_code=400, detail="Platform admin already exists")
    
    required_fields = ["email", "password", "first_name", "last_name"]
    for field in required_fields:
        if field not in admin_data:
            raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
    
    hashed_password = get_password_hash(admin_data["password"])
    
    admin_user = User(
        email=admin_data["email"],
        first_name=sanitize_input(admin_data["first_name"]),
        last_name=sanitize_input(admin_data["last_name"]),
        role="Platform_Admin",
        status="Verified"
    )
    
    admin_user_mongo = prepare_for_mongo(admin_user.dict())
    admin_user_mongo['password'] = hashed_password
    await db.users.insert_one(admin_user_mongo)
    
    access_token = create_access_token(data={"sub": admin_user.email})
    
    return {
        "message": "Platform admin created successfully",
        "access_token": access_token,
        "user": admin_user
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
