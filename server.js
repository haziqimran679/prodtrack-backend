const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

// 1. Set up the server (The Waiter)
const app = express();
app.use(cors()); // Allows your HTML file to talk to this server
app.use(express.json()); // Allows the server to understand JSON data

// 2. Connect to PostgreSQL (The Pantry)
const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME
});

// Test the database connection
pool.connect()
    .then(() => console.log('✅ Connected to PostgreSQL successfully!'))
    .catch(err => console.error('❌ Database connection error:', err.stack));

// 3. A simple test route to make sure the server is listening
app.get('/', (req, res) => {
    res.send('The ProdTrack Server is running!');
});

// --- NEW CODE STARTS HERE ---

// Route to GET all transactions from the database
app.get('/api/transactions', async (req, res) => {
    try {
        // Ask the database for everything in the transactions table
        const dbResult = await pool.query('SELECT * FROM transactions ORDER BY test_datetime ASC');

        // Format the database columns to match exactly what your HTML file expects
        const formattedData = dbResult.rows.map(row => ({
            id: row.id,
            serial: row.serial_no,
            model: row.model_code,
            process: row.process,
            result: row.result,
            failureType: row.failure_type || '',
            remarks: row.remarks || '',
            datetime: row.test_datetime
        }));

        res.json(formattedData); // Send the data back to the website
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch data' });
    }
});

// Route to POST (save) a new transaction
app.post('/api/transactions', async (req, res) => {
    try {
        // Grab the data sent from the HTML form
        const { serial, model, process, result, failureType, remarks, datetime } = req.body;

        // Prepare the SQL query to insert the new data
        const insertQuery = `
            INSERT INTO transactions (serial_no, model_code, process, result, failure_type, remarks, test_datetime)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *;
        `;

        // If failureType is empty, make it NULL for the database
        const dbFailType = failureType === '' ? null : failureType;

        // Save to the database
        await pool.query(insertQuery, [serial, model, process, result, dbFailType, remarks, datetime]);

        // Update your 'unit_summary' view so the database math stays accurate
        await pool.query('REFRESH MATERIALIZED VIEW unit_summary');

        res.json({ success: true, message: 'Saved successfully!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to save data' });
    }
});

// --- NEW CODE ENDS HERE ---

// 4. Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});