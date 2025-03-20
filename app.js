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
app.post("/register", async (req, res) => {
    try {
        const { name, username, phone, consumer_number, email, address, password } = req.body;

        // Check if username already exists
        const userSnapshot = await db.collection("users").where("username", "==", username).get();
        if (!userSnapshot.empty) {
            return res.status(400).send("Username already exists!");
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const apiKey = generateApiKey();

        // Add user to Firestore
        await db.collection("users").add({
            name,
            username,
            phone,
            consumer_number,
            email,
            address,
            password: hashedPassword,
            api_key: apiKey,
            water_usage: [{ date: DateTime.now().toISODate(), usage: 0 }],
            usage_history: [],
            water_limit: 0,
            createdAt: admin.firestore.Timestamp.now(),
        });

        res.redirect(`/user_dashboard?username=${username}`);
    } catch (error) {
        console.error("Error registering user:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Admin dashboard
// ✅ Add this GET route to render the admin dashboard
app.get('/admin_dashboard', async (req, res) => {
    try {
        const usersSnapshot = await db.collection('users').get();
        const users = usersSnapshot.docs.map(doc => {
            const data = doc.data();
            const waterUsageArray = data.water_usage || [];


            const latestEntry = data.water_usage && data.water_usage.length > 0
            ? data.water_usage[data.water_usage.length - 1]
            : { date: 'N/A', usage: [0] };
        
            // Extract only the last entered usage value
            const latestUsage = latestEntry.usage[latestEntry.usage.length - 1];
        
            return {
                username: doc.id,
                ...data,
                latest_usage: latestUsage  // Ensure this is a single value, not an array
            };
        });     

        

        res.render('admin_dashboard', { users }); // Ensure 'admin_dashboard.ejs' exists in the views folder
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).send("Internal Server Error");
    }
});

// ✅ POST request to update water limit
app.post('/admin_dashboard', async (req, res) => {
    try {
        const { username, amount } = req.body;
        console.log('username = ', username)
        console.log('amount = ', amount)

        if (!username || !amount) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // Query Firestore to find the document where username matches
        const usersRef = db.collection('users');
        const querySnapshot = await usersRef.where('username', '==', username).get();

        if (querySnapshot.empty) {
            return res.status(404).json({ error: "User not found" });
        }

        let userDocId;
        let userData;
        querySnapshot.forEach((doc) => {
            userDocId = doc.id; // Get the document ID
            userData = doc.data(); // Get user data
        });

        // Reference to the user's document
        const userDocRef = db.collection('users').doc(userDocId);

        // Increment the existing limit by the received amount
        await userDocRef.update({
            water_limit: admin.firestore.FieldValue.increment(amount)
        });

        // Remove the last processed extra water request
        if (userData.extra_water_requests && userData.extra_water_requests.length > 0) {
            const updatedRequests = [...userData.extra_water_requests];
            updatedRequests.pop(); // Remove the last request

            await userDocRef.update({ extra_water_requests: updatedRequests });
        }

        console.log(`Added ${amount} to user ${username}'s limit and removed last request`);
        res.status(200).json({ message: `Limit increased by ${amount} successfully`, success: true });

    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});








app.post('/set_water_limit', async (req, res) => {
    const { apikey, water_limit } = req.query;

    if (!apikey || !water_limit) {
        return res.status(400).json({ error: 'API key and water limit are required.' });
    }

    try {
        const userSnapshot = await db.collection('users').where('api_key', '==', apikey).get();

        if (userSnapshot.empty) {
            return res.status(404).json({ error: 'User not found!' });
        }

        const userDoc = userSnapshot.docs[0];
        const userRef = db.collection('users').doc(userDoc.id);

        await userRef.update({ water_limit: parseInt(water_limit, 10) });

        return res.json({ message: 'Water limit updated successfully!' });
    } catch (error) {
        console.error('❌ Error updating water limit:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});



app.get('/get_water_limit', async (req, res) => {
    try {
        const limitDoc = await db.collection('config').doc('water_limit').get();

        if (!limitDoc.exists) {
            return res.status(404).json({ error: 'No water usage limit found.' });
        }

        const limitData = limitDoc.data();
        return res.json({ limit: limitData.limit });
    } catch (error) {
        console.error('Error fetching water usage limit:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});


// User dashboard
app.get('/user_dashboard', async (req, res) => {
    const { username, from } = req.query;
    console.log(`Fetching data for username: ${username}`);
    const userSnapshot = await db.collection('users').where('username', '==', username).get();

    if (userSnapshot.empty) {
        console.log("❌ User not found in Firestore!");
        return res.status(404).send('User not found!');
    }

    const user = userSnapshot.docs[0].data();
    const waterUsage = user.water_usage || [];
    console.log(`Fetched water_usage: ${JSON.stringify(waterUsage, null, 2)}`);

    const todayDate = new Date().toLocaleDateString('en-GB');
    console.log(`Today's Date: ${todayDate}`);

    let todayLabels = [];
    let todayData = [];
    const todayEntry = waterUsage.find(entry => entry.date === todayDate);
    if (todayEntry && Array.isArray(todayEntry.usage)) {
        todayLabels = todayEntry.usage.map((_, index) => `Entry ${index + 1}`);
        todayData = todayEntry.usage;
    }
    console.log(`📊 Line Graph Data: ${JSON.stringify(todayData)}`);

    let barLabels = [];
    let barData = [];
    const last7Days = waterUsage.slice(-7);
    last7Days.forEach(entry => {
        if (entry.usage.length > 0) {
            barLabels.push(entry.date);
            barData.push(entry.usage[entry.usage.length - 1]);
        }
    });
    console.log(`📊 Bar Graph Data: ${JSON.stringify(barData)}`);

    let tableData = [];
    const last30Days = waterUsage.slice(-30);
    last30Days.forEach(entry => {
        if (entry.usage.length > 0) {
            tableData.push({
                date: entry.date,
                last_entry: entry.usage[entry.usage.length - 1]
            });
        }
    });
    console.log(`📄 Table Data: ${JSON.stringify(tableData)}`);

    const latestUsage = todayEntry && todayEntry.usage.length > 0 ? todayEntry.usage[todayEntry.usage.length - 1] : 0;
    const limitDoc = await db.collection('config').doc('water_limit').get();
    const waterLimit = user.water_limit ?? "not set";
    console.log(`🚰 Latest Usage: ${latestUsage}, Water Limit: ${waterLimit}`);

    // ✅ Added functionality for redirect from '/request-extra-water'
    if (from === 'request-extra-water') {
        console.log('🔄 Redirected from extra water request page');
    }

    return res.render('user_dashboard', {
        user,
        todayLabels, todayData,
        barLabels, barData,
        tableData,
        latestUsage, waterLimit,
        from // Added 'from' parameter to pass context to the frontend
    });
});

app.get('/user_details', async (req, res) => {
    const username = req.query.username;

    if (!username) {
        return res.status(400).send("Username is required");
    }

    try {
        // Fetch user details from Firestore
        const userSnapshot = await db.collection('users').where('username', '==', username).get();

        if (userSnapshot.empty) {
            return res.status(404).send("User not found");
        }

        const user = userSnapshot.docs[0].data(); // Get the first matching user

        // Extract last water usage
        let lastWaterUsage = "No data";
        if (user.water_usage && user.water_usage.length > 0) {
            const todayEntry = user.water_usage[user.water_usage.length - 1];
            lastWaterUsage = todayEntry.usage[todayEntry.usage.length - 1] || "No data";
        }

        // Render user_details.ejs with user data
        res.render('user_details', { user, lastWaterUsage });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
});








// Update water usage
app.get('/update_water_usage', async (req, res) => {
    const { apikey, new_usage, bar } = req.query; // Added 'bar' parameter

    if (!apikey) {
        return res.status(400).json({ error: 'Invalid request. API key is required.' });
    }

    try {
        // Find the user by API key
        const userSnapshot = await db.collection('users').where('api_key', '==', apikey).get();
        
        if (userSnapshot.empty) {
            return res.status(404).json({ error: 'User not found!' });
        }

        const userDoc = userSnapshot.docs[0];
        const userRef = db.collection('users').doc(userDoc.id);
        const userData = userDoc.data();

        // Get user's water limit from Firestore (updated by admin dashboard)
        const waterLimit = userData.water_limit || 'Not Set';

        // If new_usage is 0, do NOT update, just return water limit
        if (parseInt(new_usage, 10) === 0) {
            return res.json({ waterLimit });
        }

        // Get today's date
        const currentDate = new Date().toLocaleDateString('en-GB'); // "08/02/2025"

        // Ensure `water_usage` exists
        let waterUsage = userData.water_usage || [];
        let todayEntry = waterUsage.find(entry => entry.date === currentDate);

        if (todayEntry) {
            if (!Array.isArray(todayEntry.usage)) {
                todayEntry.usage = [];
            }
            todayEntry.usage.push(parseInt(new_usage, 10));
        } else {
            waterUsage.push({ date: currentDate, usage: [parseInt(new_usage, 10)] });
        }

        // Prepare update data
        let updateData = { water_usage: waterUsage };

        // If 'bar' parameter exists, update pressure value
        if (bar !== undefined) {
            updateData.pressure = parseFloat(bar); // Store pressure value
        }

        // Update Firestore
        await userRef.update(updateData);

        return res.json({ waterLimit, pressure: updateData.pressure || userData.pressure });

    } catch (error) {
        console.error('Error updating water usage:', error);
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

app.get('/request-extra-water', async (req, res) => {
    try {
        const username = req.query.username || ''; 

        if (!username) {
            return res.status(400).send("Username is required");
        }

        const extraWater = req.query.extraWater;

        if (!extraWater) {
            return res.render('extra_water_request', { username }); 
        }

        const userRef = db.collection('users').where('username', '==', username);
        const snapshot = await userRef.get();

        if (snapshot.empty) {
            return res.status(404).send("User not found");
        }

        snapshot.forEach(async (doc) => {
            const userDoc = doc.ref;
            await userDoc.update({
                extra_water_requests: admin.firestore.FieldValue.arrayUnion({
                    amount: parseInt(extraWater),
                    date: new Date().toISOString()
                })
            });
        });
        res.render('request_extra_water', { username });
        // ✅ Redirect to the specific user's dashboard using their username
        res.redirect(`/user_dashboard?username=${username}`);
    } catch (error) {
        console.error("Error processing request:", error);
        res.status(500).send("Internal Server Error");
    }
});







// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

