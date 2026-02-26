# BiteSpeed Backend Test: Identity Reconciliation API

This is a backend web service built for the BiteSpeed Backend Test: Identity Reconciliation task. It links customer orders made with different emails and phone numbers into a single, unified profile using a relational database (PGSQL).

## Tech Stack
* **Node.js** & **Express.js** (Backend server)
* **PostgreSQL** (Database)
* **Sequelize** (ORM for database queries)

## Project Structure
I kept the architecture simple and focused on the core logic:
* `index.js`: Contains the server setup, database connection, table schema, and all the routing logic.
* `package.json`: Contains the project dependencies and startup scripts.
* `.env`: Contains the environment variables for local testing.

<img width="1355" height="330" alt="Screenshot 2026-02-27 041444" src="https://github.com/user-attachments/assets/4249290c-73e1-43b1-ac96-6ee1c44815d2" />


## How to Run Locally

1. **Install dependencies:**
   Open your terminal in the project folder and run:
   ```bash

   npm install

