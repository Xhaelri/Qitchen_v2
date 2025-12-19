# 🍽️ Qitchen Backend

A complete backend service for a restaurant application, built with **Node.js**, **Express**, and **MongoDB (Mongoose)**.  
It supports **JWT authentication**, **role-based access (admin & user)**, **product and category management**, **cart and orders**, **reviews**, **address management**, **table reservations**, **Stripe payment integration**, and **Cloudinary image uploads**.

---

## 🚀 Technologies Used

- **Node.js** – JavaScript runtime for building scalable applications
- **Express.js** – Minimalist web framework for APIs
- **MongoDB + Mongoose** – NoSQL database and ODM for schema management
- **JWT (JSON Web Token)** – Secure authentication & authorization
- **Bcrypt** – Password hashing
- **Multer** – File upload middleware
- **Cloudinary** – Image hosting & storage
- **Stripe** – Payment gateway integration
- **CORS** – Cross-origin resource sharing
- **Cookie-Parser** – Cookie handling
- **dotenv** – Environment variable management

---

## 📂 Project Structure

food-restaurant-backend/
│
├── server.js # Entry point of the application
├── db/
│ └── db.js # MongoDB connection logic
├── routes/ # All route files
│ ├── user.route.js
│ ├── product.route.js
│ ├── category.route.js
│ ├── review.route.js
│ ├── cart.route.js
│ ├── address.route.js
│ ├── order.route.js
│ ├── table.route.js # Restaurant tables management
│ └── reservation.route.js # Reservations management
├── models/ # Mongoose models
│ ├── table.model.js
│ └── reservation.model.js
├── controllers/ # Business logic for each resource
├── middlewares/ # Authentication, error handling, etc.
└── utils/ # Helper functions

````

---


---

## 🌟 Features

### 🔐 Authentication & Authorization
- **JWT-based authentication** (Access & Refresh tokens)
- **Role-based access control** (Admin, User)
- Secure password hashing using **bcrypt**

### 👤 User Management
- Register, login, and profile management
- Admin can view all users

### 🍽️ Product & Category Management
- Admin can create, update, delete products
- Cloudinary integration for image uploads
- Category-based product listing

### 🛒 Cart & Orders
- Add, update, and remove cart items
- Checkout using Stripe payment gateway
- Order tracking & management

### 🏠 Address Management
- Save multiple delivery addresses per user

### ⭐ Reviews
- Users can review products with ratings

### 💳 Payment Integration
- **Stripe Checkout** session creation
- Secure payment metadata stored in database

### 🪑 Tables & Reservations (NEW)
- **Admin Dashboard** for managing restaurant tables
- CRUD operations for tables (**create, update, delete, list tables**)
- RESTful APIs for **booking, updating, and cancelling reservations**
- Availability check to prevent **double bookings**
- Link reservations with **users and orders**

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory and configure the following:

```env
PORT=4000
ACCESS_TOKEN_SECRET_KEY=your_access_secret
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_SECRET_KEY=your_refresh_secret
REFRESH_TOKEN_EXPIRY=7d
NODE_ENV=development
MONGODB_URI=your_mongodb_connection_string
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
STRIPE_SECRET_KEY=your_stripe_secret_key
CLIENT_URL=http://localhost:5173

---

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/Xhaelri/Qitchen

# Install dependencies
npm install

# Run development server
npm run server
````

---

## 🛠️ API Endpoints

Base URL: `http://localhost:4000/api/v2`

---

## 📜 License

This project is licensed under the **ISC License**.

---

## 👨‍💻 Author

Developed by **Ali Saleh** – Full Stack Developer
