# S-W-M Portal

A web-based **Smart Water Management Portal** for monitoring and managing user water consumption. The system provides separate user and administrator dashboards, tracks daily and historical water usage, manages water limits, supports extra-water requests, and provides API endpoints for updating usage data.

## Features

### User Features

* User registration and login
* User dashboard
* Daily water-consumption tracking
* Historical water-usage records
* Water-consumption charts and reports
* Personal water-usage limit
* Request additional water allocation
* API key for updating water usage
* Pressure monitoring
* View user details

### Admin Features

* Admin login
* Admin dashboard
* View registered users
* Monitor user water consumption
* Increase individual users' water limits
* Manage extra-water requests
* Monitor water-usage information

### Automated Features

* Automatic daily water-usage reset
* Previous usage is stored in usage history
* Firebase Firestore is used for persistent data storage
* Passwords are hashed using `bcryptjs`
* API keys are generated automatically for registered users

## Technology Stack

* **Backend:** Node.js, Express.js
* **Frontend:** HTML, CSS, JavaScript, EJS
* **Database:** Firebase Firestore
* **Authentication:** Firebase Authentication / custom Express authentication
* **Charts:** Chart.js
* **Password Hashing:** bcryptjs
* **Scheduling:** node-cron
* **Date & Time:** Luxon
* **Environment Configuration:** dotenv

## Project Structure

```text
S-W-M-Portal/
│
├── .vscode/
├── templates/
│   ├── index.html
│   ├── login.html
│   ├── register.html
│   └── *.ejs
│
├── app.js
├── auth.js
├── firebaseConfig.js
├── package.json
├── package-lock.json
├── .env
├── .gitignore
└── README.md
```

## Prerequisites

Before running the project, make sure you have installed:

* Node.js
* npm
* A Firebase project
* Firebase Firestore enabled
* Firebase credentials for the server

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/DELHIKRISHNAN/S-W-M-Portal.git
cd S-W-M-Portal
```

### 2. Install dependencies

```bash
npm install
```

The project uses packages including Express, Firebase Admin, EJS, bcryptjs, Chart.js, dotenv, cron, Luxon, and express-session.

### 3. Configure Firebase

Create a Firebase project and enable **Cloud Firestore**.

The server expects Firebase Admin credentials through environment variables:

```env
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY="your_private_key"
FIREBASE_CLIENT_EMAIL=your_service_account_email
PORT=8080
```

> **Important:** Never commit your Firebase private key or other secrets to GitHub.

The application initializes Firebase Admin using these environment variables and connects to Firestore.

### 4. Start the application

```bash
npm start
```

The server runs on:

```text
http://localhost:8080
```

The default start script runs `node app.js`.

## Application Flow

```text
                    ┌─────────────────────┐
                    │   S-W-M Portal      │
                    └──────────┬──────────┘
                               │
               ┌───────────────┴───────────────┐
               │                               │
        ┌──────▼──────┐                 ┌──────▼──────┐
        │    User     │                 │    Admin    │
        │   Portal    │                 │   Portal    │
        └──────┬──────┘                 └──────┬──────┘
               │                               │
        ┌──────▼──────┐                 ┌──────▼──────┐
        │ Registration│                 │ User Mgmt.  │
        │   / Login   │                 │ & Monitoring│
        └──────┬──────┘                 └──────┬──────┘
               │                               │
        ┌──────▼──────┐                 ┌──────▼──────┐
        │   Water     │                 │    Water    │
        │   Usage     │                 │    Limits   │
        └──────┬──────┘                 └──────┬──────┘
               │                               │
               └──────────────┬────────────────┘
                              │
                       ┌──────▼──────┐
                       │  Firebase   │
                       │  Firestore  │
                       └─────────────┘
```

## Main Routes

### General

| Method | Route       | Description       |
| ------ | ----------- | ----------------- |
| GET    | `/`         | Home page         |
| GET    | `/login`    | User login page   |
| GET    | `/register` | Registration page |

### Authentication

| Method | Route          | Description                   |
| ------ | -------------- | ----------------------------- |
| POST   | `/login`       | Authenticate a user           |
| POST   | `/admin_login` | Authenticate an administrator |
| POST   | `/register`    | Register a new user           |

### User

| Method | Route                  | Description              |
| ------ | ---------------------- | ------------------------ |
| GET    | `/user_dashboard`      | Display user dashboard   |
| GET    | `/user_details`        | Display user information |
| GET    | `/update_water_usage`  | Update water consumption |
| GET    | `/request-extra-water` | Request additional water |
| GET    | `/get_water_limit`     | Retrieve water limit     |

### Admin

| Method | Route              | Description                     |
| ------ | ------------------ | ------------------------------- |
| GET    | `/admin_dashboard` | Display administrator dashboard |
| POST   | `/admin_dashboard` | Increase a user's water limit   |

### API

| Method | Route                 | Description                            |
| ------ | --------------------- | -------------------------------------- |
| POST   | `/set_water_limit`    | Set water limit using an API key       |
| GET    | `/update_water_usage` | Update water usage using an API key    |
| GET    | `/trigger-reset`      | Manually trigger the daily usage reset |

The application implements these routes directly in `app.js`.

## Water Usage Tracking

Water usage is stored in Firestore under each user's record.

A usage record contains information similar to:

```json
{
  "date": "08/02/2025",
  "usage": [20, 35, 50]
}
```

The application uses this information to generate:

* Current-day usage information
* Recent usage charts
* Seven-day usage data
* Thirty-day usage history
* Latest recorded consumption

The dashboard also compares consumption against the user's configured water limit.

## API Usage

### Update Water Usage

```text
GET /update_water_usage?apikey=YOUR_API_KEY&new_usage=VALUE
```

Example:

```text
http://localhost:8080/update_water_usage?apikey=YOUR_API_KEY&new_usage=50
```

The endpoint can also receive a pressure value:

```text
http://localhost:8080/update_water_usage?apikey=YOUR_API_KEY&new_usage=50&bar=2.5
```

### Set Water Limit

```text
POST /set_water_limit?apikey=YOUR_API_KEY&water_limit=VALUE
```

Example:

```text
http://localhost:8080/set_water_limit?apikey=YOUR_API_KEY&water_limit=100
```

The API key is generated automatically when a user registers.

## Database

The application uses **Firebase Cloud Firestore**.

The primary collection used by the application is:

```text
users
```

User records can contain fields such as:

```text
name
username
phone
consumer_number
email
address
password
api_key
water_usage
usage_history
water_limit
pressure
extra_water_requests
createdAt
is_admin
```

A configuration document is also used for water-limit information:

```text
config/
└── water_limit
```

## Automatic Water Usage Reset

The application includes functionality for resetting daily water usage.

During a reset:

1. Existing water usage is retrieved.
2. The latest usage record is added to usage history.
3. The user's current usage is reset.
4. A new usage record is created for the current date.

There is also a manual endpoint for triggering the reset:

```text
GET /trigger-reset
```

This functionality is implemented in `app.js` using Firestore and Luxon.

## Security

The project includes password hashing using `bcryptjs` before passwords are stored in Firestore.

For production deployment, additional security measures should be implemented, including:

* HTTPS
* Secure session management
* Strong Firebase security rules
* Input validation
* API authentication and authorization
* Rate limiting
* CSRF protection
* Secure HTTP headers
* Proper secret management
* Removal of development/debug endpoints

**Do not expose `.env` or Firebase service-account credentials publicly.**

## Development

To run the project during development:

```bash
npm install
npm start
```

Then open:

```text
http://localhost:8080
```

## Future Improvements

Possible improvements include:

* Real-time water-consumption monitoring
* IoT/sensor integration
* Email/SMS notifications
* Water-limit alerts
* More detailed analytics
* Role-based authorization
* Improved API security
* Responsive mobile UI
* Docker deployment
* Automated testing
* Production deployment configuration

## License

This project currently does not specify an open-source license.

If you intend to make the project open source, add an appropriate `LICENSE` file.

## Author

**DELHIKRISHNAN**

GitHub:
https://github.com/DELHIKRISHNAN

## Repository

https://github.com/DELHIKRISHNAN/S-W-M-Portal

```

### Note

The repository itself currently has **no README file and no repository description**, so the above is a newly prepared README based on the actual source files rather than a copy of an existing README.
```
