from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import jwt
from passlib.context import CryptContext
from emergentintegrations.llm.chat import LlmChat, UserMessage
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = "your-secret-key-here"  # In production, use a proper secret
ALGORITHM = "HS256"

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    first_name: str
    last_name: str
    role: str  # "Student", "Alumni", "Admin"
    status: str = "Pending"  # "Pending", "Verified"
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
    graduation_year: Optional[int] = None
    major: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserProfile(BaseModel):
    industry: Optional[str] = None
    location: Optional[str] = None
    is_mentor: Optional[bool] = None
    profile_picture_url: Optional[str] = None

class Post(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    author_id: str
    author_name: str
    content: str
    likes: List[str] = []
    comments: List[Dict[str, Any]] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PostCreate(BaseModel):
    content: str

class Comment(BaseModel):
    author_id: str
    author_name: str
    text: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Job(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    posted_by: str
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
    return {"message": "Alumni Connect API", "status": "running"}

# Auth routes
@api_router.post("/auth/register")
async def register(user_data: UserCreate):
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password
    hashed_password = get_password_hash(user_data.password)
    
    # Create user
    user_dict = user_data.dict()
    del user_dict['password']
    
    user = User(**user_dict)
    user_mongo = prepare_for_mongo(user.dict())
    user_mongo['password'] = hashed_password
    
    await db.users.insert_one(user_mongo)
    
    # Create access token
    access_token = create_access_token(data={"sub": user.email})
    
    return {"access_token": access_token, "token_type": "bearer", "user": user}

@api_router.post("/auth/login")
async def login(user_data: UserLogin):
    user = await db.users.find_one({"email": user_data.email})
    if not user or not verify_password(user_data.password, user['password']):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    user_obj = User(**parse_from_mongo(user))
    access_token = create_access_token(data={"sub": user_obj.email})
    
    return {"access_token": access_token, "token_type": "bearer", "user": user_obj}

# User routes
@api_router.get("/users", response_model=List[User])
async def get_users(major: Optional[str] = None, industry: Optional[str] = None, role: Optional[str] = None):
    query = {"status": "Verified"}
    if major:
        query["major"] = major
    if industry:
        query["industry"] = industry
    if role:
        query["role"] = role
    
    users = await db.users.find(query).to_list(length=None)
    return [User(**parse_from_mongo(user)) for user in users]

@api_router.get("/users/profile")
async def get_profile(current_user: User = Depends(get_current_user)):
    return current_user

@api_router.put("/users/profile")
async def update_profile(profile_data: UserProfile, current_user: User = Depends(get_current_user)):
    update_data = {k: v for k, v in profile_data.dict().items() if v is not None}
    
    await db.users.update_one(
        {"email": current_user.email},
        {"$set": update_data}
    )
    
    updated_user = await db.users.find_one({"email": current_user.email})
    return User(**parse_from_mongo(updated_user))

# Posts routes
@api_router.get("/posts/feed", response_model=List[Post])
async def get_feed(current_user: User = Depends(get_current_user)):
    posts = await db.posts.find().sort("created_at", -1).to_list(length=100)
    return [Post(**parse_from_mongo(post)) for post in posts]

@api_router.post("/posts", response_model=Post)
async def create_post(post_data: PostCreate, current_user: User = Depends(get_current_user)):
    post = Post(
        author_id=current_user.id,
        author_name=f"{current_user.first_name} {current_user.last_name}",
        content=post_data.content
    )
    
    post_mongo = prepare_for_mongo(post.dict())
    await db.posts.insert_one(post_mongo)
    
    return post

@api_router.post("/posts/{post_id}/like")
async def like_post(post_id: str, current_user: User = Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id})
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
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    comment = Comment(
        author_id=current_user.id,
        author_name=f"{current_user.first_name} {current_user.last_name}",
        text=comment_text['text']
    )
    
    comments = post.get('comments', [])
    comments.append(prepare_for_mongo(comment.dict()))
    
    await db.posts.update_one({"id": post_id}, {"$set": {"comments": comments}})
    return comment

# Jobs routes
@api_router.get("/jobs", response_model=List[Job])
async def get_jobs():
    jobs = await db.jobs.find().sort("created_at", -1).to_list(length=50)
    return [Job(**parse_from_mongo(job)) for job in jobs]

@api_router.post("/jobs", response_model=Job)
async def create_job(job_data: JobCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != "Alumni":
        raise HTTPException(status_code=403, detail="Only alumni can post jobs")
    
    job = Job(posted_by=current_user.id, **job_data.dict())
    job_mongo = prepare_for_mongo(job.dict())
    await db.jobs.insert_one(job_mongo)
    
    return job

# AI Mentor Matching
@api_router.get("/ai/mentor-match")
async def get_mentor_matches(current_user: User = Depends(get_current_user)):
    if current_user.role != "Student":
        raise HTTPException(status_code=403, detail="Only students can request mentor matches")
    
    try:
        # Initialize Gemini chat for AI matching
        chat = LlmChat(
            api_key=os.environ.get('EMERGENT_LLM_KEY'),
            session_id=f"mentor-match-{current_user.id}",
            system_message="You are an AI mentor matching system. Analyze student profiles and suggest the best mentor matches based on major, industry, location, and career goals."
        ).with_model("gemini", "gemini-2.0-flash")
        
        # Get all potential mentors
        mentors = await db.users.find({
            "role": "Alumni",
            "is_mentor": True,
            "status": "Verified"
        }).to_list(length=None)
        
        if not mentors:
            return {"matches": [], "message": "No mentors available at the moment"}
        
        # Prepare data for AI analysis
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
        
        # Create AI prompt
        prompt = f"""
        Student Profile: {json.dumps(student_profile)}
        Available Mentors: {json.dumps(mentor_profiles)}
        
        Please analyze and rank the top 5 mentors for this student based on:
        1. Major compatibility
        2. Industry alignment
        3. Location proximity
        4. Career progression potential
        
        Return ONLY a JSON array of mentor IDs in ranked order (best matches first).
        Example: ["mentor-id-1", "mentor-id-2", "mentor-id-3"]
        """
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        try:
            # Parse AI response
            mentor_ids = json.loads(response.strip())
            if not isinstance(mentor_ids, list):
                raise ValueError("Invalid response format")
            
            # Get full mentor details for matched IDs
            matched_mentors = []
            for mentor_id in mentor_ids[:5]:  # Top 5 matches
                mentor = await db.users.find_one({"id": mentor_id})
                if mentor:
                    matched_mentors.append(User(**parse_from_mongo(mentor)))
            
            return {"matches": matched_mentors, "ai_powered": True}
            
        except (json.JSONDecodeError, ValueError):
            # Fallback to rule-based matching if AI fails
            rule_based_matches = []
            for mentor in mentors:
                if mentor.get("major") == current_user.major:
                    rule_based_matches.append(User(**parse_from_mongo(mentor)))
            
            return {"matches": rule_based_matches[:5], "ai_powered": False, "fallback": True}
            
    except Exception as e:
        # Ultimate fallback to simple rule-based matching
        mentors = await db.users.find({
            "role": "Alumni",
            "is_mentor": True,
            "status": "Verified",
            "major": current_user.major
        }).to_list(length=5)
        
        return {
            "matches": [User(**parse_from_mongo(mentor)) for mentor in mentors],
            "ai_powered": False,
            "error": "AI matching temporarily unavailable"
        }

# Admin routes
@api_router.get("/admin/pending-users")
async def get_pending_users(current_user: User = Depends(get_current_user)):
    if current_user.role != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    users = await db.users.find({"status": "Pending"}).to_list(length=None)
    return [User(**parse_from_mongo(user)) for user in users]

@api_router.post("/admin/verify-user/{user_id}")
async def verify_user(user_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.users.update_one({"id": user_id}, {"$set": {"status": "Verified"}})
    return {"message": "User verified successfully"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()