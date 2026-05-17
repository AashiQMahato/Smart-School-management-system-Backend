# Smart School Management System – Backend

A scalable and role-based backend API for the **Smart School Management System** built using **Node.js, Express.js, and MongoDB**.
The system supports Admin, Teacher, Student, and Parent modules with secure authentication, academic management, scheduling, attendance, results, notifications, fee management, and AI-powered analytics.

---

# 🚀 Features

## 🔐 Authentication & Authorization

* Login-only authentication
* JWT-based authentication
* Role-based access control
* Protected API routes
* Admin-controlled user creation

---

# 👥 Role-Based Modules

## 👨‍💼 Admin Features

* Create & manage users
* Assign teachers & subjects
* Manage classes & sections
* Create schedules/timetables
* Monitor attendance
* Manage fees
* Send notifications
* Access reports & analytics

---

## 👨‍🏫 Teacher Features

* View assigned classes
* View teaching schedule
* Mark attendance
* Manage student marks
* Monitor student performance

---

## 🎓 Student Features

* View attendance
* View timetable
* View results & grades
* AI-powered insights
* Notifications

---

## 👨‍👩‍👧 Parent Features

* Monitor linked students
* View attendance & results
* View fee status
* Notifications & alerts

---

# 🛠️ Tech Stack

## Backend

* Node.js
* Express.js
* MongoDB
* Mongoose
* JWT Authentication
* bcryptjs

## Additional Tools

* dotenv
* cors
* nodemon

---

# 🧠 System Architecture

The backend follows a **role-based architecture** with strict separation of concerns.

### Core Design

* `User` model handles authentication & identity
* Role-specific profiles:

  * Student
  * Teacher
  * Parent
  * Admin
* `profileId` maintains 1-to-1 relationship between User and role profile

---

# 📂 Project Structure

```bash id="4i8qt0"
backend/
├── controllers/
├── routes/
├── models/
├── middleware/
├── services/
├── utils/
├── config/
├── validators/
├── uploads/
└── server.js
```

---

# 🗄️ Main Database Models

## Core Models

* User
* Student
* Teacher
* Parent
* Admin

## Academic Models

* Class
* Subject
* Schedule
* Attendance
* Marks / Results
* Fees
* Notifications

---

# 📅 Schedule Workflow

```text id="7t0bzg"
Admin creates schedule
        ↓
Schedule stored in database
        ↓
Linked to class + subject + teacher
        ↓
Teacher / Student / Parent fetch schedules
```

---

# 🔄 API Workflow

```text id="r0vndw"
Login
   ↓
JWT Authentication
   ↓
Role Verification
   ↓
Profile Fetching
   ↓
Role-Based API Access
```

---

# ⚙️ Installation

## Clone Repository

```bash id="ytr3hy"
git clone <your-backend-repo-url>
cd backend
```

---

## Install Dependencies

```bash id="r95mbd"
npm install
```

---

## Configure Environment Variables

Create a `.env` file:

```env id="g4pmbf"
PORT=5000
MONGO_URI=your_mongodb_connection
JWT_SECRET=your_jwt_secret
CLIENT_URL=http://localhost:5173
```

---

## Run Development Server

```bash id="7q85pd"
npm run dev
```

---

# 🔐 Authentication Flow

```text id="80x7nr"
Admin creates user
        ↓
User logs in
        ↓
JWT token generated
        ↓
Protected route access
```

---

# 📊 Key Features

* RESTful API architecture
* Scalable MongoDB schema design
* Role-based querying
* Clean controller-service structure
* Secure authentication system
* Reference-based relationships

---

# 📱 Supported Modules

* Authentication
* User Management
* Academic Management
* Attendance
* Scheduling
* Results & Marks
* Notifications
* Fee Management
* AI Analytics

---

# 🧹 Development Principles

* Clean architecture
* Modular structure
* Reusable services
* Error handling middleware
* Secure API patterns
* Scalable database relations

---

# 🚀 Future Improvements

* Real-time notifications
* Assignment management
* Online exams
* Chat system
* AI recommendation engine
* Mobile API optimization

---

# 🤝 Contributing

```bash id="u54nvt"
# Create feature branch
git checkout -b feature-name

# Commit changes
git commit -m "Added new feature"

# Push branch
git push origin feature-name
```

---

# 📄 License

This project is licensed under the MIT License.

---

# 👨‍💻 Author

Developed as a modern MERN stack Smart School Management System with role-based academic workflows and scalable backend architecture.
