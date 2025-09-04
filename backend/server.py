from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, status
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
# Ensure your GEMINI_API_KEY is set in the .env file
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

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
app = FastAPI(title="Alumni Connect API", version="2.0.0", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Input sanitization
def sanitize_input(text: str) -> str:
    """Sanitize user input to prevent XSS"""
    if not text:
        return text
    # Remove HTML tags and escape special characters
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
    
    @field_validator('first_name', 'last_name', 'major')
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
    is_mentor: Optional[bool] = None
    profile_picture_url: Optional[str] = None
    
    @field_validator('industry', 'location')
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

# Root route
@api_router.get("/")
async def root():
    return {"message": "Alumni Connect API v2.0", "status": "running", "features": ["multi-institution", "ai-powered"]}

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
    
    await db.users.update_one(
        {"email": current_user.email},
        {"$set": update_data}
    )
    
    updated_user = await db.users.find_one({"email": current_user.email})
    return User(**parse_from_mongo(updated_user))

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
        
    jobs = await db.jobs.find(query).sort("created_at", -1).to_list(length=50)
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
            if raw_text.startswith('```json'):
                raw_text = raw_text[7:].strip()
            if raw_text.endswith('```'):
                raw_text = raw_text[:-3].strip()

            mentor_ids = json.loads(raw_text)
            
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
