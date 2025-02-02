const express = require('express');
const puppeteer = require('puppeteer');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
const PORT = 8080;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Home route
app.get('/', (req, res) => {
  const username = req.cookies.username;
  if (username) {
    res.redirect('/auto');
  } else {
    res.render('login'); 
  }
});

// Handle login and set the cookie
app.post('/login', (req, res) => {
  const { username } = req.body;
  if (username) {
    res.cookie('username', username, { httpOnly: true });
    res.redirect('/auto');
  } else {
    res.render('login', { err: 'Username is required' });
  }
});

// Attendance automation route
app.get('/auto', async (req, res) => {
  const username = req.cookies.username;
  if (!username) {
    return res.redirect('/');
  }

  try {
    const browser = await puppeteer.launch({ headless: true }); // Set headless: true for no browser UI
    const page = await browser.newPage();

    // Step 1: Visit the login page
    await page.goto('https://www.nrcmec.org/Student/login.php');

    // Step 2: Fill the login form
    await page.type('#roll_no', username);  // Fill in the roll number
    await page.type('#password', username);  // Fill in the password

    // Step 3: Click the login button
    await page.click('.btn');
    
    // Wait for the navigation to complete
    await page.waitForNavigation();

    // Step 4: Visit the attendance page
    await page.goto('https://www.nrcmec.org/Student/Date_wise_attendance.php');

    // Wait for the table to load
    await page.waitForSelector('table'); // Adjust the selector to the table on the page

    // Step 5: Extract the table HTML or data
    const tableData = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tbody tr'));
      return rows.map(row => {
        const columns = row.querySelectorAll('td');
        return Array.from(columns).map(column => column.innerText.trim());
      });
    });

    // Step 6: Extract the third <p> tag data inside the .container-user div
    const Attendance = await page.evaluate(() => {
      const container = document.querySelector('.container-user');
      if (container) {
        const pTags = container.querySelectorAll('p');
        return pTags.length >= 3 ? pTags[2].innerText.trim() : null; // Get the third <p> tag (index 2)
      }
      return null;
    });

    // Step 7: Send the data to the frontend
    res.render('show', { tableData, Attendance, error: null , username});

    // Close the browser after automation is done
    await browser.close();
  } catch (error) {
    console.error('Error during automation:', error);
    res.render('show', { tableData: null, Attendance: null, error, username});
  }
});

// Logout and clear cookie
app.post('/logout', (req, res) => {
  res.clearCookie('username');
  res.redirect('/');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});