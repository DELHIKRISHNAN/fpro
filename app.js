const express = require('express');
const admin = require('firebase-admin');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const uuid = require('uuid');
const path = require('path');
const { CronJob } = require('cron');
const { DateTime } = require('luxon');
require('dotenv').config(); // Load environment variables from .env file

// Initialize Firebase Admin SDK

// Get the Firebase credentials from environment variables

// Get Firebase credentials from environment variables
const serviceAccount = {
  project_id: process.env.FIREBASE_PROJECT_ID,  
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,  
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});


const db = admin.firestore();

// Initialize Express
const app = express();

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'templates'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'templates')));

// Helper functions
const generateApiKey = () => uuid.v4();

// Cron job to reset daily water usage
const resetDailyUsage = async () => {
    console.log('Manually triggering the reset of water usage and updating water history...');
    
    try {
        const usersSnapshot = await db.collection('users').where('is_admin', '==', false).get();
        console.log(`Found ${usersSnapshot.size} users.`);  // Check if users are found
        if (usersSnapshot.empty) {
            console.log('No users found.');
            return;
        }

        const currentDate = DateTime.now().toISODate();
        
        for (const userDoc of usersSnapshot.docs) {
            const user = userDoc.data();
            const waterUsage = user.water_usage || [];
            const usageHistory = user.usage_history || [];

            console.log(`Updating user: ${userDoc.id}`);  // Log which user is being updated

            if (waterUsage.length > 0) {
                const lastEntry = waterUsage[waterUsage.length - 1];
                usageHistory.push(lastEntry);
            }

            await db.collection('users').doc(userDoc.id).update({
                water_usage: [{ date: currentDate, usage: 0 }],
                usage_history: usageHistory,
            });

            console.log(`Updated water usage for user: ${userDoc.id}`);
        }

        console.log('Water usage reset and history updated successfully!');
    } catch (error) {
        console.error('Error resetting water usage and updating history:', error);
        throw new Error(error);
    }
};



// Initialize admin user
(async () => {
    const adminSnapshot = await db.collection('users').where('username', '==', 'admin').get();
    if (adminSnapshot.empty) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await db.collection('users').add({
            username: 'admin',
            password: hashedPassword,
            is_admin: true,
            water_usage: [{ date: DateTime.now().toISODate(), usage: 0 }],
            usage_history: [],
        });
        console.log('Admin user created.');
    }
})();

// Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'templates', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'templates', 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'templates', 'register.html')));

// Login route
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const userSnapshot = await db.collection('users').where('username', '==', username).get();

    if (!userSnapshot.empty) {
        const userDoc = userSnapshot.docs[0];
        const user = userDoc.data();

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (isPasswordValid) {
            return res.redirect(`/user_dashboard?username=${username}`);
        }
    }

    res.status(401).send('Invalid credentials! Please try again.');
});

// New Admin Login Route
app.post('/admin_login', async (req, res) => {
    const { username, password } = req.body;
    const adminSnapshot = await db.collection('users').where('username', '==', username).where('is_admin', '==', true).get();

    if (!adminSnapshot.empty) {
        const adminDoc = adminSnapshot.docs[0];
        const admin = adminDoc.data();

        const isPasswordValid = await bcrypt.compare(password, admin.password);
        if (isPasswordValid) {
            return res.redirect('/admin_dashboard');
        }
    }

    res.status(401).send('Invalid Admin credentials! Please try again.');
});


// Register route
app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    const userSnapshot = await db.collection('users').where('username', '==', username).get();
    if (!userSnapshot.empty) {
        return res.status(400).send('Username already exists!');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const apiKey = generateApiKey();

    await db.collection('users').add({
        username,
        password: hashedPassword,
        api_key: apiKey,
        water_usage: [{ date: DateTime.now().toISODate(), usage: 0 }],
        usage_history: [],
    });

    res.redirect(`/user_dashboard?username=${username}`);
});

// Admin dashboard
app.get('/admin_dashboard', async (req, res) => {
    const usersSnapshot = await db.collection('users').get();
    const userData = [];

    usersSnapshot.forEach((userDoc) => {
        const user = userDoc.data();

        // Check if water_usage exists and has entries
        const latestEntry = user.water_usage && user.water_usage.length > 0
            ? user.water_usage[user.water_usage.length - 1] // Get the last entry in the array (most recent date)
            : { date: 'N/A', usage: [0] }; // Default to N/A and 0 if no data

        // Get the last usage value of the most recent date
        const latestUsage = latestEntry.usage[latestEntry.usage.length - 1]; // Get the last value in the usage array

        const apiKey = user.api_key || 'N/A';

        // Add only the latest usage value
        userData.push({
            username: user.username,
            api_key: apiKey,
            latest_usage: latestUsage, // Display only the last usage value
        });
    });

    // Log the userData to check the output before rendering
    console.log(userData); 

    res.render('admin_dashboard', { users: userData });
});




// User dashboard
app.get('/user_dashboard', async (req, res) => {
    const { username } = req.query;
    console.log(`Fetching data for username: ${username}`);

    const userSnapshot = await db.collection('users').where('username', '==', username).get();

    if (userSnapshot.empty) {
        console.log("❌ User not found in Firestore!");
        return res.status(404).send('User not found!');
    }

    const user = userSnapshot.docs[0].data();
    const waterUsage = user.water_usage || [];

    console.log(`Fetched water_usage: ${JSON.stringify(waterUsage, null, 2)}`);

    const todayDate = new Date().toLocaleDateString('en-GB'); // "30/01/2025"
    console.log(`Today's Date: ${todayDate}`);

    // 📌 **Line Graph Data (Today's Usage)**
    let todayLabels = [];
    let todayData = [];

    const todayEntry = waterUsage.find(entry => entry.date === todayDate);
    if (todayEntry && Array.isArray(todayEntry.usage)) {
        todayLabels = todayEntry.usage.map((_, index) => `Entry ${index + 1}`);
        todayData = todayEntry.usage;
    }

    console.log(`📊 Line Graph Data: ${JSON.stringify(todayData)}`);

    // 📌 **Bar Graph Data (Last 7 Days' Last Entries)**
    let barLabels = [];
    let barData = [];

    const last7Days = waterUsage.slice(-7);
    last7Days.forEach(entry => {
        if (entry.usage.length > 0) {
            barLabels.push(entry.date);
            barData.push(entry.usage[entry.usage.length - 1]); // Last entry of the day
        }
    });

    console.log(`📊 Bar Graph Data: ${JSON.stringify(barData)}`);

    // 📌 **Table Data (Last 30 Days' Last Entries)**
    let tableData = [];
    const last30Days = waterUsage.slice(-30);
    last30Days.forEach(entry => {
        if (entry.usage.length > 0) {
            tableData.push({
                date: entry.date,
                last_entry: entry.usage[entry.usage.length - 1] // Last entry of the day
            });
        }
    });

    console.log(`📄 Table Data: ${JSON.stringify(tableData)}`);

    return res.render('user_dashboard', {
        user,
        todayLabels, todayData,
        barLabels, barData,
        tableData
    });
});





// Update water usage
app.get('/update_water_usage', async (req, res) => {
    const { apikey, new_usage } = req.query;

    if (!apikey || !new_usage) {
        return res.status(400).json({ error: 'Invalid request. API key and new usage are required.' });
    }

    try {
        // Find the user by API key
        const userSnapshot = await db.collection('users').where('api_key', '==', apikey).get();
        
        if (userSnapshot.empty) {
            return res.status(404).json({ error: 'User not found!' });
        }

        const userDoc = userSnapshot.docs[0];
        const userRef = db.collection('users').doc(userDoc.id);
        const user = userDoc.data();

        console.log("User found:", user.username); // ✅ Debug log

        // Get today's date
        const currentDate = new Date().toLocaleDateString('en-GB'); // "30/01/2025"

        // Ensure `water_usage` exists
        let waterUsage = user.water_usage || [];
        console.log("Before update:", JSON.stringify(waterUsage, null, 2)); // ✅ Debug log

        // Find today's entry
        let todayEntry = waterUsage.find(entry => entry.date === currentDate);

        if (todayEntry) {
            console.log("Existing date found:", currentDate); // ✅ Debug log
            
            // ✅ Ensure `usage` is always an array
            if (!Array.isArray(todayEntry.usage)) {
                console.log("⚠️ `usage` was NOT an array, fixing it now...");
                todayEntry.usage = [];
            }

            todayEntry.usage.push(parseInt(new_usage, 10));
        } else {
            console.log("New date entry created:", currentDate); // ✅ Debug log
            waterUsage.push({ date: currentDate, usage: [parseInt(new_usage, 10)] });
        }

        console.log("After update:", JSON.stringify(waterUsage, null, 2)); // ✅ Debug log

        // ✅ Force Firestore to always store `usage` as an array
        await userRef.update({ water_usage: waterUsage });

        return res.json({ message: 'Water usage updated successfully!', waterUsage });
    } catch (error) {
        console.error('❌ Error updating water usage:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/trigger-reset', async (req, res) => {
    console.log('Manual reset triggered');
    try {
        await resetDailyUsage();
        res.send('Cron job triggered manually.');
    } catch (error) {
        console.error('Error during trigger-reset route:', error);
        res.status(500).send('Error triggering cron job manually.');
    }
});



// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
