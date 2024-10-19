require('dotenv').config();

// Log the environment variables to check if they are loaded correctly
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD);
console.log('DB_SERVER:', process.env.DB_SERVER);
console.log('DB_NAME:', process.env.DB_NAME);

const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const app = express();

// Database configuration using environment variables
const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: true,
        trustServerCertificate: false
    }
};

// Middleware to parse JSON
app.use(express.json());

// Add CORS middleware
app.use(cors({
    origin: ['https://kdsar-portal.azurewebsites.net', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type'],
}));

// Users CRUD routes

// GET: Fetch all users
app.get('/api/users', async (req, res) => {
    try {
        await sql.connect(config);
        const result = await sql.query`
            SELECT UserId, UserEmail 
            FROM Learners
        `;
        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).send('Error fetching users');
    }
});

// PUT: Update a user by UserId
app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { UserEmail } = req.body;

    if (!UserEmail) {
        return res.status(400).send('User email is required');
    }

    try {
        await sql.connect(config);
        const result = await sql.query`
            UPDATE Learners
            SET UserEmail = ${UserEmail}
            WHERE UserId = ${id};
        `;
        if (result.rowsAffected[0] === 0) {
            return res.status(404).send('User not found');
        }
        res.send('User updated successfully');
    } catch (err) {
        console.error('Error updating user:', err);
        res.status(500).send('Error updating user');
    }
});

// DELETE: Remove a user by UserId
app.delete('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await sql.connect(config);
        const result = await sql.query`
            DELETE FROM Learners WHERE UserId = ${id}
        `;
        if (result.rowsAffected[0] === 0) {
            return res.status(404).send('User not found');
        }
        res.send('User deleted successfully');
    } catch (err) {
        console.error('Error deleting user:', err);
        res.status(500).send('Error deleting user');
    }
});

// DELETE: Remove a user by UserId and delete all associated LearnerData records
app.delete('/api/deleteUserWithLearnerData/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await sql.connect(config);

        // Start a transaction to delete both user and learner data
        const transaction = new sql.Transaction();
        await transaction.begin();

        // Delete associated LearnerData records for the user
        await transaction.request().query`
            DELETE FROM LearnerData WHERE UserId = ${id}
        `;

        // Delete the user
        const result = await transaction.request().query`
            DELETE FROM Learners WHERE UserId = ${id}
        `;

        if (result.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(404).send('User not found');
        }

        await transaction.commit();
        res.send('User and associated learner data deleted successfully');
    } catch (err) {
        console.error('Error deleting user and learner data:', err);
        res.status(500).send('Error deleting user and learner data');
    }
});


// Installations CRUD routes

// GET: Fetch all installations
app.get('/api/installations', async (req, res) => {
    try {
        await sql.connect(config);
        const result = await sql.query`
            SELECT InstallationId, InstallationName, InstallationLocation 
            FROM Installations
        `;
        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching installations:', err);
        res.status(500).send('Error fetching installations');
    }
});

// PUT: Update an installation by InstallationId
app.put('/api/installations/:id', async (req, res) => {
    const { id } = req.params;
    const { InstallationName, InstallationLocation } = req.body;

    if (!InstallationName || !InstallationLocation) {
        return res.status(400).send('Installation name and location are required');
    }

    try {
        await sql.connect(config);
        const result = await sql.query`
            UPDATE Installations
            SET InstallationName = ${InstallationName}, InstallationLocation = ${InstallationLocation}
            WHERE InstallationId = ${id};
        `;
        if (result.rowsAffected[0] === 0) {
            return res.status(404).send('Installation not found');
        }
        res.send('Installation updated successfully');
    } catch (err) {
        console.error('Error updating installation:', err);
        res.status(500).send('Error updating installation');
    }
});

// DELETE: Remove an installation by InstallationId
app.delete('/api/installations/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await sql.connect(config);
        const result = await sql.query`
            DELETE FROM Installations WHERE InstallationId = ${id}
        `;
        if (result.rowsAffected[0] === 0) {
            return res.status(404).send('Installation not found');
        }
        res.send('Installation deleted successfully');
    } catch (err) {
        console.error('Error deleting installation:', err);
        res.status(500).send('Error deleting installation');
    }
});

// LearnerData CRUD route

// GET: Fetch learner data
app.get('/api/getLearnerData', async (req, res) => {
    try {
        await sql.connect(config);
        const result = await sql.query`
            SELECT 
                ld.LearnerDataId, 
                ld.UserId, 
                l.UserEmail,
                ld.TimeSpent, 
                ld.InstallationID,
                i.InstallationName,
                i.InstallationLocation,
                ld.PercentageComplete, 
                ld.CreationDate 
            FROM LearnerData ld
            LEFT JOIN Learners l ON ld.UserId = l.UserId
            LEFT JOIN Installations i ON ld.InstallationID = i.InstallationId
        `;
        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching learner data:', err);
        res.status(500).send(`Error fetching learner data: ${err.message}`);
    }
});




// POST: Add a new installation
app.post('/api/installations', async (req, res) => {
    const { InstallationName, InstallationLocation } = req.body;

    if (!InstallationName || !InstallationLocation) {
        return res.status(400).send('Installation name and location are required');
    }

    try {
        await sql.connect(config);
        const result = await sql.query`
            INSERT INTO Installations (InstallationName, InstallationLocation) 
            VALUES (${InstallationName}, ${InstallationLocation});
            SELECT SCOPE_IDENTITY() AS InstallationId;
        `;
        const newInstallationId = result.recordset[0].InstallationId;
        res.status(201).json({ InstallationId: newInstallationId, InstallationName, InstallationLocation });
    } catch (err) {
        console.error('Error adding installation:', err);
        res.status(500).send('Error adding installation');
    }
});

// CheckOrCreateUser endpoint
app.post('/api/checkOrCreateUser', async (req, res) => {
    const { UserEmail } = req.body;

    if (!UserEmail) {
        return res.status(400).send('User email is required');
    }

    try {
        await sql.connect(config);

        // Check if the user exists
        const checkUserResult = await sql.query`
            SELECT UserId, UserEmail FROM Learners WHERE UserEmail = ${UserEmail}
        `;

        if (checkUserResult.recordset.length > 0) {
            // User already exists, return existing UserId and UserEmail
            const existingUser = checkUserResult.recordset[0];
            return res.json({
                UserId: existingUser.UserId,
                UserEmail: existingUser.UserEmail
            });
        } else {
            // User does not exist, create a new record
            const insertUserResult = await sql.query`
                INSERT INTO Learners (UserEmail) VALUES (${UserEmail});
                SELECT SCOPE_IDENTITY() AS UserId;
            `;
            const newUserId = insertUserResult.recordset[0].UserId;
            return res.json({
                UserId: newUserId,
                UserEmail: UserEmail
            });
        }
    } catch (error) {
        console.error('Error checking or creating user:', error);
        res.status(500).send('Error checking or creating user');
    }
});

// ProgressRecorder endpoint

app.post('/api/progressRecorder', async (req, res) => {
    const { UserId, PercentageComplete, TimeSpent, InstallationId } = req.body;

    // Check if all required fields are present
    if (UserId == null || PercentageComplete == null || TimeSpent == null || InstallationId == null) {
        return res.status(400).send('All fields are required: UserId, PercentageComplete, TimeSpent, InstallationId');
    }

    try {
        await sql.connect(config);

        // Insert progress data into the LearnerData table
        const result = await sql.query`
            INSERT INTO LearnerData (UserId, PercentageComplete, TimeSpent, InstallationID)
            VALUES (${UserId}, ${PercentageComplete}, ${TimeSpent}, ${InstallationId});
        `;
        
        res.status(201).send('Progress recorded successfully');
    } catch (error) {
        console.error('Error recording progress:', error);
        res.status(500).send('Error recording progress');
    }
});

// GET: Fetch learner data for a specific user by UserId
app.get('/api/getLearnerData/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        await sql.connect(config);
        const result = await sql.query`
            SELECT 
                ld.LearnerDataId, 
                ld.UserId, 
                l.UserEmail,
                ld.TimeSpent, 
                ld.InstallationID,
                i.InstallationName,
                i.InstallationLocation,
                ld.PercentageComplete, 
                ld.CreationDate 
            FROM LearnerData ld
            LEFT JOIN Learners l ON ld.UserId = l.UserId
            LEFT JOIN Installations i ON ld.InstallationID = i.InstallationId
            WHERE ld.UserId = ${userId}
        `;
        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching learner data for user:', err);
        res.status(500).send(`Error fetching learner data for user: ${err.message}`);
    }
});


// DELETE: Remove a learner record by LearnerDataId
app.delete('/api/learnerData/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await sql.connect(config);
        const result = await sql.query`
            DELETE FROM LearnerData WHERE LearnerDataId = ${id}
        `;
        if (result.rowsAffected[0] === 0) {
            return res.status(404).send('Learner data not found');
        }
        res.send('Learner data deleted successfully');
    } catch (err) {
        console.error('Error deleting learner data:', err);
        res.status(500).send('Error deleting learner data');
    }
});

// GET: Fetch all activity for a given UserEmail
app.get('/api/getLearnerDataByEmail/:email', async (req, res) => {
    const { email } = req.params;
    try {
        await sql.connect(config);

        // Find the UserId for the given email
        const userResult = await sql.query`
            SELECT UserId, UserEmail FROM Learners WHERE UserEmail = ${email}
        `;

        if (userResult.recordset.length === 0) {
            return res.status(404).send('User not found');
        }

        const { UserId, UserEmail } = userResult.recordset[0];

        // Get all learner data for the found UserId
        const learnerDataResult = await sql.query`
            SELECT 
                ld.LearnerDataId, 
                ld.UserId, 
                l.UserEmail,
                ld.TimeSpent, 
                ld.InstallationID,
                i.InstallationName,
                i.InstallationLocation,
                ld.PercentageComplete, 
                ld.CreationDate 
            FROM LearnerData ld
            LEFT JOIN Learners l ON ld.UserId = l.UserId
            LEFT JOIN Installations i ON ld.InstallationID = i.InstallationId
            WHERE ld.UserId = ${UserId}
        `;

        // Return the user email and associated learner data
        res.json({
            UserEmail,
            learnerData: learnerDataResult.recordset
        });
    } catch (err) {
        console.error('Error fetching learner data by email:', err);
        res.status(500).send(`Error fetching learner data: ${err.message}`);
    }
});


// Default route to verify server status
app.get('/', (req, res) => {
    res.send('Hello World!');
});

// Start the server
const port = process.env.PORT || 8080;
app.listen(port, () => {
    console.log(`App running on port ${port}`);
});
