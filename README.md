# JEE Growth Tracker

A modern platform for JEE aspirants to track their preparation progress with real-time analytics, personalized insights, and comprehensive performance monitoring.

## 🚀 Features

- **Real-time Progress Tracking**: Monitor your JEE preparation progress with live updates
- **Analytics Dashboard**: Comprehensive analytics to understand strengths and areas for improvement
- **Study Planning**: Smart study schedules and time management tools
- **Timer & Reminders**: Built-in study timer and reminder system
- **Dark Mode**: Beautiful dark theme support
- **Responsive Design**: Works perfectly on all devices
- **Firebase Integration**: Secure authentication and data storage

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Styling**: Tailwind CSS
- **Backend**: Node.js, Express.js
- **Database**: Firebase (Firestore)
- **Authentication**: Firebase Auth
- **Deployment**: Render

## 📦 Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build CSS:
   ```bash
   npm run build-css
   ```
4. Start development server:
   ```bash
   npm run dev
   ```

## 🚀 Deployment on Render

### Prerequisites
- Render account
- Git repository with your code
- Firebase project configured

### Steps to Deploy

1. **Push to Git Repository**
   ```bash
   git add .
   git commit -m "Ready for Render deployment"
   git push origin main
   ```

2. **Create New Web Service on Render**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "Web Service"
   - Connect your Git repository
   - Select "Static Site" as the service type
   - Set Build Command: `npm run build`
   - Set Publish Directory: `public`
   - Add environment variables from `.env.production`

3. **Configure Environment Variables**
   Add these in Render Dashboard:
   ```
   NODE_ENV=production
   FIREBASE_API_KEY=your_firebase_api_key
   FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
   FIREBASE_PROJECT_ID=your_project_id
   FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
   FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   FIREBASE_APP_ID=your_app_id
   ```

4. **Deploy**
   - Click "Create Web Service"
   - Render will automatically build and deploy your site
   - Your site will be available at: `https://your-service-name.onrender.com`

### Configuration Files

- `render.yaml` - Render service configuration
- `.env.production` - Production environment variables
- `package.json` - Build scripts and dependencies

## 📁 Project Structure

```
Website/
├── public/                 # Static files for deployment
│   ├── css/              # Compiled CSS
│   ├── js/                # JavaScript files
│   ├── *.html            # HTML pages
│   └── assets/            # Images and assets
├── src/
│   └── input.css          # Tailwind input file
├── server.js              # Express server
├── package.json           # Dependencies and scripts
├── render.yaml           # Render configuration
└── .env.production       # Environment variables
```

## 🔧 Environment Setup

1. **Firebase Configuration**
   - Create Firebase project
   - Enable Authentication and Firestore
   - Get configuration keys
   - Update `js/firebase-config.js`

2. **Tailwind CSS**
   ```bash
   npm run build-css    # Watch for changes
   npm run build        # Build once
   ```

## 📱 Features

### Authentication
- Google Sign-In
- User profile management
- Secure session handling

### Navigation
- Responsive navigation bar
- Dark mode toggle
- User state display

### Pages
- **Home**: Landing page with features
- **Dashboard**: Analytics and stats
- **Study Log**: Track study sessions
- **Timer**: Pomodoro timer
- **Progress**: Performance charts
- **Reminders**: Study reminders

## 🎯 Production Ready

The website is fully optimized for production deployment:

✅ **Security Headers**: CSP, X-Frame-Options, X-Content-Type-Options
✅ **Performance**: Optimized CSS, minified assets
✅ **SEO**: Meta tags, proper structure
✅ **Responsive**: Mobile-first design
✅ **Authentication**: Firebase integration
✅ **Dark Mode**: Beautiful dark theme
✅ **Cross-browser**: Compatible with all modern browsers

## 🌐 Live Demo

Deploy your site and access it at: `https://your-service-name.onrender.com`

## 📞 Support

For any issues or questions, please check the browser console for detailed error messages.

---

**Built with ❤️ for JEE aspirants**
