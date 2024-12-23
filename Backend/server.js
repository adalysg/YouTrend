const express = require('express');
const oracledb = require('oracledb');
const bodyParser = require('body-parser');
const cors = require('cors');  // CORS middleware allows domain communication
require('dotenv').config({ path: '../.env' });

// DB Queries
const { fetchTimeDaySuccess, fetchDisabledVideos, fetchTrendingData, fetchEventInfo, fetchPopularityData, fetchSentimentData } = require('../Backend/dbQueries');

const app = express();
const PORT = 5000;

app.use(bodyParser.json());
app.use(cors());  // Enable CORS for all routes

async function connectToDatabase() {
    try {
        await oracledb.createPool({
            user: process.env.ORACLE_USER,
            password: process.env.ORACLE_PASSWORD,
            connectString: process.env.ORACLE_CONNECTION_STRING,
        });
        console.log("Connected to Oracle Database!");
    } catch (err) {
        console.error("Failed to connect to database", err);
    }
}

app.get('/', (req, res) => {
    res.send("API is working!");
});

// GET ALL Data from "User" table in DB
app.get('/api/users/get', async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection();
        const result = await connection.execute(`SELECT * FROM "User"`);
        console.log(result);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error fetching data");
    } finally {
        if (connection) {
            await connection.close();
        }
    }
});

// To-Do: GET specific user's info

// POST (send) Data to "User" table in DB
app.post('/api/users/send', async (req, res) => {
    if (!req.body) {
        return res.status(400).send("Request body is missing");
    }
    
    const { user_name, password, country_name } = req.body; // add queries
    let connection;

    try {
        connection = await oracledb.getConnection();

         // handles queries of type blob
        // const queriesBlob = queries ? Buffer.from(queries, 'base64') : null;

        const sql_insert = `INSERT INTO "User" (user_name, "password", country_name) VALUES (:user_name, :password, :country_name)`; // add queriesBlob

        await connection.execute(sql_insert, {
            user_name: user_name,
            password: password,
            // queries: queriesBlob,
            country_name: country_name
        });

        await connection.commit();

        res.status(201).send("User created successfully");

    } catch (err) {
        console.error("Error inserting data:", err.message);
        res.status(500).send("Error inserting data");
    } finally {
        if (connection) {
            await connection.close();
        }
    }
});

// Time & Day Success Query Routes
app.get('/api/time-date-success', async (req, res) => {
    const { country, category_id: categoryId, start_date: startDate, end_date: endDate, tag } = req.query || {};

    console.log("Received query parameters:", req.query);

    try {
        const data = await fetchTimeDaySuccess({ country, categoryId, startDate, endDate, tag });
        return res.json(data);
      } catch (err) {
        console.error("Error fetching time/date data:", err);
        return res.status(500).json({ error: "Error fetching time/date data", details: err.message });
      }
})

// Disabled Videos Query Routes
app.get('/api/disabled-videos', async (req, res) => {
  const { country, category_id: categoryId, start_date: startDate, end_date: endDate, tag, comments_disabled: commentsDisabled, ratings_disabled: ratingsDisabled, video_error_or_removed: videoRemoved } = req.query || {};

  console.log("Received query parameters:", req.query);

  try {
      const result = await fetchDisabledVideos({
          country, 
          categoryId, 
          startDate, 
          endDate, 
          tag, 
          commentsDisabled: commentsDisabled === 'True', // Convert to boolean
          ratingsDisabled: ratingsDisabled === 'True',   // Convert to boolean
          videoRemoved: videoRemoved === 'True'          // Convert to boolean
      });

      return res.json(result);

  } catch (err) {
      console.error("Error in /disabled-videos route:", err);
      return res.status(500).json({ error: "Internal server error" });
  }

})

// Events Query Routes
app.get('/api/trending-data', async (req, res) => {
    const { country, category_id: categoryId, start_date: startDate, end_date: endDate, tag } = req.query || {};

    try {
      const trendingData = await fetchTrendingData({
          country,
          categoryId,
          startDate,
          endDate,
          tag
      });

      return res.json(trendingData);
    } catch (err) {
      return res.status(500).send("Error fetching trending data");
    }
});

app.get('/api/event-info', async (req, res) => {
    const { event_name: eventName } = req.query;
  
    try {
      const eventData = await fetchEventInfo(eventName);
      
      if (eventData.length > 0) {
        res.json(eventData);
      } else {
        res.status(404).send("Event not found");
      }
    } catch (err) {
      res.status(500).send("Error fetching event information");
    }
  });

// Popularity Query Routes
app.get('/api/popularity-data', async (req, res) => {
    const { country, category_id: categoryId, start_date: startDate, end_date: endDate, tag } = req.query || {}; // extra input? selection?

    console.log("Received query parameters:", req.query);

  try {
    const popularityData = await fetchPopularityData({
      country,
      categoryId,
      startDate,
      endDate,
      tag
    });

    res.json(popularityData);
  } catch (err) {
    res.status(500).send("Error fetching popularity data");
  }
})

// Sentiment Query Routes
app.get('/api/sentiment-data', async (req, res) => {
  const { country, category_id: categoryId, start_date: startDate, end_date: endDate, tag } = req.query || {};
    
    try {
        const sentimentData = await fetchSentimentData({
          country,
          categoryId,
          startDate,
          endDate,
          tag
        });
    
        res.json(sentimentData);
      } catch (err) {
        res.status(500).send("Error fetching sentiment data");
      }
})


app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    connectToDatabase();
});

app.post('/api/users/login', async (req, res) => {
  const { email, password } = req.body;
  let connection;
  try {
      connection = await oracledb.getConnection();
      const query = `SELECT * FROM "User" WHERE email = :email AND password = :password`;
      const result = await connection.execute(query, [email, password]);

      if (result.rows.length > 0) {
          res.json({ success: true, user: result.rows[0] }); // Return user data if found
      } else {
          res.status(401).json({ success: false, message: "Invalid credentials" });
      }
  } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
      if (connection) {
          await connection.close();
      }
  }
});

