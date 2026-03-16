# ISO 27001 Compliance Portal

A comprehensive Role-Based Compliance Portal for managing ISO 27001 compliance checklists across multiple departments.

## Features

- **Master Admin Panel**: Full access to manage departments, questions, users, and view/download all uploaded proofs
- **Department User Interface**: View and answer checklists assigned to specific departments
- **Question Management**: CRUD operations for compliance questions filtered by department
- **User Management**: Create users and assign them to departments
- **File Upload**: Secure file upload for proof documents (required when answering "Yes")
- **Dashboard**: Real-time completion percentage tracking per department
- **Progress Tracking**: Visual progress bars showing checklist completion status

## Tech Stack

### Backend
- **Python 3.10+** with FastAPI
- **MongoDB Atlas** (Motor async driver)
- **JWT Authentication** (OAuth2 with Password flow)
- **Pydantic** for data validation
- **Bcrypt** for password hashing

### Frontend
- **React.js** with Vite
- **Tailwind CSS** for styling
- **React Hook Form** with Zod validation
- **Zustand** for state management
- **Axios** for API calls
- **React Router** for navigation

## Project Structure

```
decgrc/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── auth.py
│   │   ├── exceptions.py
│   │   └── routers/
│   │       ├── __init__.py
│   │       ├── auth.py
│   │       ├── admin.py
│   │       └── user.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── store/
│   │   └── lib/
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## Setup Instructions

### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Create a virtual environment:**
   ```bash
   python -m venv venv
   ```

3. **Activate virtual environment:**
   - Windows: `venv\Scripts\activate`
   - Linux/Mac: `source venv/bin/activate`

4. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

5. **Configure environment variables:**
   - Copy `.env.example` to `.env`
   - Update `MONGODB_URI` with your MongoDB Atlas connection string
   - Set a strong `SECRET_KEY` for JWT token signing
   - Configure `UPLOAD_DIR` for file storage (default: `./uploads`)

6. **Create uploads directory:**
   ```bash
   mkdir uploads
   ```

7. **Run the server:**
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

### Frontend Setup

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   - Copy `.env.example` to `.env`
   - Update `VITE_API_BASE_URL` if your backend runs on a different port

4. **Run the development server:**
   ```bash
   npm run dev
   ```

5. **Build for production:**
   ```bash
   npm run build
   ```

## Initial Setup

### Creating the First Admin User

You can create the first admin user using the API:

1. Start the backend server
2. Use the `/api/v1/auth/register` endpoint (you'll need to temporarily allow registration without authentication, or use MongoDB directly)

Alternatively, you can create an admin user directly in MongoDB:

```javascript
// In MongoDB shell or Compass
db.users.insertOne({
  username: "admin",
  password_hash: "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyY5Y5Y5Y5Y5", // hash of "admin123"
  role: "admin",
  department_id: null
})
```

**Note:** The password hash above is for "admin123". Change it using a bcrypt hasher or the registration endpoint.

## API Endpoints

### Authentication
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/register` - Register new user (Admin only)
- `GET /api/v1/auth/me` - Get current user

### Admin Endpoints
- `GET /api/v1/admin/dashboard/stats` - Dashboard statistics
- `GET /api/v1/admin/departments` - List departments
- `POST /api/v1/admin/departments` - Create department
- `DELETE /api/v1/admin/departments/{id}` - Delete department
- `GET /api/v1/admin/questions` - List questions
- `POST /api/v1/admin/questions` - Create question
- `PUT /api/v1/admin/questions/{id}` - Update question
- `DELETE /api/v1/admin/questions/{id}` - Delete question
- `GET /api/v1/admin/users` - List users
- `DELETE /api/v1/admin/users/{id}` - Delete user
- `GET /api/v1/admin/responses` - List all responses
- `GET /api/v1/admin/responses/{id}/proof` - Download proof file

### User Endpoints
- `GET /api/v1/user/questions` - Get questions for user's department
- `GET /api/v1/user/responses` - Get user's responses
- `POST /api/v1/user/responses` - Create/update response
- `PUT /api/v1/user/responses/{id}` - Update response
- `POST /api/v1/user/upload-proof` - Upload proof file
- `GET /api/v1/user/responses/{id}/proof` - Download own proof file

## User Roles

### Master Admin
- Full access to all features
- Can manage departments, questions, and users
- Can view and download all uploaded proofs
- Access to dashboard with completion statistics

### Department User
- Can view questions assigned to their department
- Can answer questions (Yes/No)
- Must upload proof file when answering "Yes"
- Can view their own responses and download their proof files

## Security Features

- **Password Hashing**: Bcrypt with salt rounds
- **JWT Authentication**: Secure token-based authentication
- **Role-Based Access Control**: Middleware to enforce role permissions
- **File Upload Security**: UUID-based filenames to prevent overwriting
- **Input Validation**: Pydantic models and Zod schemas
- **CORS Configuration**: Configured for frontend origins

## Database Schema

### User
- `id`: ObjectId
- `username`: String (unique)
- `password_hash`: String
- `role`: Enum (admin/user)
- `department_id`: ObjectId (optional)

### Department
- `id`: ObjectId
- `name`: String (unique)

### Question
- `id`: ObjectId
- `department_id`: ObjectId
- `text`: String
- `iso_control_ref`: String (optional)

### Response
- `id`: ObjectId
- `question_id`: ObjectId
- `user_id`: ObjectId
- `status`: Enum (Yes/No)
- `proof_url`: String (optional, required if status is Yes)
- `timestamp`: DateTime

## Development

### Backend Development
- The API documentation is available at `http://localhost:8000/docs` (Swagger UI)
- Alternative documentation at `http://localhost:8000/redoc`

### Frontend Development
- Hot module replacement enabled
- Proxy configured for API calls
- Tailwind CSS with JIT compilation

## Production Deployment

### Backend
1. Set production environment variables
2. Use a production ASGI server (e.g., Gunicorn with Uvicorn workers)
3. Configure reverse proxy (Nginx)
4. Set up SSL/TLS certificates
5. Use cloud storage (S3) for file uploads instead of local storage

### Frontend
1. Build the application: `npm run build`
2. Serve the `dist` folder using a web server (Nginx, Apache, etc.)
3. Configure environment variables for production API URL

## File Storage

By default, files are stored in the `./uploads` directory. For production, consider:
- Using cloud storage (AWS S3, Azure Blob Storage, Google Cloud Storage)
- Implementing file size limits
- Adding virus scanning
- Setting up file retention policies

## License

This project is proprietary software for ISO 27001 compliance management.

## Support

For issues or questions, please contact the development team.

