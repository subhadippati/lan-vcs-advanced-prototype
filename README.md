LAN Version Control System – Advanced Prototype Backend

A lightweight, LAN-based version control and collaboration backend that allows multiple users to upload, manage, and retrieve file versions in real-time without relying on the internet. This system supports role-based access, file locking, concurrency handling, real-time updates via WebSockets, and admin monitoring features.

🚀 Features
Core

File upload with automatic versioning

Download any previous version

SHA-256 file integrity verification

Local file storage

JSON-based metadata persistence

Collaboration

File locking to prevent overwrite conflicts

Concurrency-safe operations

Real-time file update notifications (WebSockets)

Security & Roles

Token-based authentication (prototype)

Role-based access (Admin / User)

Protected endpoints

Admin Tools

View active file locks

Force unlock files

View activity logs

System monitoring endpoints

🧱 Tech Stack

Node.js

Express.js

Socket.IO

Multer (file uploads)

Crypto (SHA-256 hashing)

Local filesystem storage

JSON-based persistence
