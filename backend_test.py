import requests
import sys
import json
from datetime import datetime

class AlumniConnectAPITester:
    def __init__(self, base_url="https://alumni-connect-15.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.student_token = None
        self.alumni_token = None
        self.admin_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_post_id = None
        self.created_job_id = None
        self.student_user_id = None
        self.alumni_user_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    print(f"   Response: {response.json()}")
                except:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test API root endpoint"""
        success, response = self.run_test("API Root", "GET", "", 200)
        return success

    def test_student_registration(self):
        """Test student registration"""
        student_data = {
            "email": "student@test.com",
            "password": "password123",
            "first_name": "Test",
            "last_name": "Student",
            "role": "Student",
            "major": "Computer Science",
            "graduation_year": 2025
        }
        
        success, response = self.run_test("Student Registration", "POST", "auth/register", 200, student_data)
        if success and 'access_token' in response:
            self.student_token = response['access_token']
            self.student_user_id = response['user']['id']
            print(f"   Student token obtained: {self.student_token[:20]}...")
        return success

    def test_alumni_registration(self):
        """Test alumni registration"""
        alumni_data = {
            "email": "alumni@test.com",
            "password": "password123",
            "first_name": "Test",
            "last_name": "Alumni",
            "role": "Alumni",
            "major": "Computer Science",
            "graduation_year": 2020
        }
        
        success, response = self.run_test("Alumni Registration", "POST", "auth/register", 200, alumni_data)
        if success and 'access_token' in response:
            self.alumni_token = response['access_token']
            self.alumni_user_id = response['user']['id']
            print(f"   Alumni token obtained: {self.alumni_token[:20]}...")
        return success

    def test_student_login(self):
        """Test student login"""
        login_data = {
            "email": "student@test.com",
            "password": "password123"
        }
        
        success, response = self.run_test("Student Login", "POST", "auth/login", 200, login_data)
        if success and 'access_token' in response:
            self.student_token = response['access_token']
            print(f"   Student login successful")
        return success

    def test_alumni_login(self):
        """Test alumni login"""
        login_data = {
            "email": "alumni@test.com",
            "password": "password123"
        }
        
        success, response = self.run_test("Alumni Login", "POST", "auth/login", 200, login_data)
        if success and 'access_token' in response:
            self.alumni_token = response['access_token']
            print(f"   Alumni login successful")
        return success

    def test_get_profile(self):
        """Test getting user profile"""
        success, response = self.run_test("Get Student Profile", "GET", "users/profile", 200, token=self.student_token)
        return success

    def test_update_profile(self):
        """Test updating user profile"""
        profile_data = {
            "industry": "Technology",
            "location": "San Francisco, CA",
            "is_mentor": True
        }
        
        success, response = self.run_test("Update Alumni Profile", "PUT", "users/profile", 200, profile_data, self.alumni_token)
        return success

    def test_get_users(self):
        """Test getting users directory"""
        success, response = self.run_test("Get Users Directory", "GET", "users", 200)
        return success

    def test_create_post(self):
        """Test creating a post"""
        post_data = {
            "content": "This is a test post from the API testing suite!"
        }
        
        success, response = self.run_test("Create Post", "POST", "posts", 200, post_data, self.student_token)
        if success and 'id' in response:
            self.created_post_id = response['id']
            print(f"   Created post ID: {self.created_post_id}")
        return success

    def test_get_feed(self):
        """Test getting posts feed"""
        success, response = self.run_test("Get Posts Feed", "GET", "posts/feed", 200, token=self.student_token)
        return success

    def test_like_post(self):
        """Test liking a post"""
        if not self.created_post_id:
            print("❌ No post ID available for like test")
            return False
            
        success, response = self.run_test("Like Post", "POST", f"posts/{self.created_post_id}/like", 200, {}, self.alumni_token)
        return success

    def test_add_comment(self):
        """Test adding a comment to a post"""
        if not self.created_post_id:
            print("❌ No post ID available for comment test")
            return False
            
        comment_data = {"text": "Great post! Thanks for sharing."}
        success, response = self.run_test("Add Comment", "POST", f"posts/{self.created_post_id}/comment", 200, comment_data, self.alumni_token)
        return success

    def test_create_job(self):
        """Test creating a job (Alumni only)"""
        job_data = {
            "title": "Software Engineer",
            "company": "Tech Corp",
            "location": "Remote",
            "description": "We are looking for a talented software engineer to join our team."
        }
        
        success, response = self.run_test("Create Job (Alumni)", "POST", "jobs", 200, job_data, self.alumni_token)
        if success and 'id' in response:
            self.created_job_id = response['id']
            print(f"   Created job ID: {self.created_job_id}")
        return success

    def test_create_job_as_student(self):
        """Test creating a job as student (should fail)"""
        job_data = {
            "title": "Test Job",
            "company": "Test Company",
            "description": "This should fail"
        }
        
        success, response = self.run_test("Create Job (Student - Should Fail)", "POST", "jobs", 403, job_data, self.student_token)
        return success

    def test_get_jobs(self):
        """Test getting jobs list"""
        success, response = self.run_test("Get Jobs", "GET", "jobs", 200)
        return success

    def test_ai_mentor_matching(self):
        """Test AI mentor matching (Student only)"""
        success, response = self.run_test("AI Mentor Matching", "GET", "ai/mentor-match", 200, token=self.student_token)
        if success:
            print(f"   Found {len(response.get('matches', []))} mentor matches")
            print(f"   AI Powered: {response.get('ai_powered', False)}")
        return success

    def test_ai_mentor_matching_as_alumni(self):
        """Test AI mentor matching as alumni (should fail)"""
        success, response = self.run_test("AI Mentor Matching (Alumni - Should Fail)", "GET", "ai/mentor-match", 403, token=self.alumni_token)
        return success

    def test_unauthorized_access(self):
        """Test accessing protected endpoints without token"""
        success, response = self.run_test("Unauthorized Access", "GET", "users/profile", 401)
        return success

def main():
    print("🚀 Starting Alumni Connect API Testing Suite")
    print("=" * 60)
    
    tester = AlumniConnectAPITester()
    
    # Test sequence
    tests = [
        ("API Root", tester.test_root_endpoint),
        ("Student Registration", tester.test_student_registration),
        ("Alumni Registration", tester.test_alumni_registration),
        ("Student Login", tester.test_student_login),
        ("Alumni Login", tester.test_alumni_login),
        ("Get Profile", tester.test_get_profile),
        ("Update Profile", tester.test_update_profile),
        ("Get Users", tester.test_get_users),
        ("Create Post", tester.test_create_post),
        ("Get Feed", tester.test_get_feed),
        ("Like Post", tester.test_like_post),
        ("Add Comment", tester.test_add_comment),
        ("Create Job (Alumni)", tester.test_create_job),
        ("Create Job (Student - Should Fail)", tester.test_create_job_as_student),
        ("Get Jobs", tester.test_get_jobs),
        ("AI Mentor Matching", tester.test_ai_mentor_matching),
        ("AI Mentor Matching (Alumni - Should Fail)", tester.test_ai_mentor_matching_as_alumni),
        ("Unauthorized Access", tester.test_unauthorized_access),
    ]
    
    failed_tests = []
    
    for test_name, test_func in tests:
        try:
            if not test_func():
                failed_tests.append(test_name)
        except Exception as e:
            print(f"❌ {test_name} - Exception: {str(e)}")
            failed_tests.append(test_name)
    
    # Print results
    print("\n" + "=" * 60)
    print("📊 TEST RESULTS")
    print("=" * 60)
    print(f"Tests Run: {tester.tests_run}")
    print(f"Tests Passed: {tester.tests_passed}")
    print(f"Tests Failed: {len(failed_tests)}")
    print(f"Success Rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    if failed_tests:
        print(f"\n❌ Failed Tests:")
        for test in failed_tests:
            print(f"   - {test}")
    else:
        print(f"\n🎉 All tests passed!")
    
    return 0 if len(failed_tests) == 0 else 1

if __name__ == "__main__":
    sys.exit(main())