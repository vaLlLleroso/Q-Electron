const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const bodyParser = require('body-parser');
const app = express();
const port = 3000;

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'incidentDB',
  password: '12.qw.as.', // Change to your password
  port: 5432, // Default Port
});

app.use(express.static(path.join('')));
app.use(bodyParser.urlencoded({ extended: false }));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '', 'index.html'));
});

app.get('/incidents', (req, res) => {
  const query = 'SELECT * FROM Incidents;';

  pool.query(query, (error, result) => {
    if (error) {
      console.error('Error occurred:', error);
      res.status(500).send('An error occurred while retrieving data from the database.');
    } else {
      const students = result.rows;
      res.json(students);
    }
  });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});