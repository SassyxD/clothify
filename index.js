const express = require('express')
const app = express()
const port = 3000
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
//const session = require('express-session');

// create directory 'public'
app.use(express.static('public'));
app.use(express.static('images'));

// ตั้งค่า session
// app.use(session({
//   secret: 'my-suoer-secret-key-@#$$',
//   resave: false,
//   saveUninitialized: true,
//   cookie: { secure: false } 
// }));

// Connect to SQLite database
let db = new sqlite3.Database('clothify.db', (err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log('Connected to the SQlite database.');
});

// Middleware ตรวจสอบการล็อกอิน
// function isAuthenticated(req, res, next) {
//   if (req.session.user_id) {
//       next();
//   } else {
//       res.status(401).send('Unauthorized');
//   }
// }


// ---------------------- ADMIN route-----------------------
app.get('/admin_login', function (req, res) {
  res.sendFile(path.join(__dirname, '/public/admin/admin_login.html'));
});

//-------------------------ADMIN action-----------------------

// ---------------------- USER route------------------------
app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, '/public/user/landingpage.html'));
});
//หน้าลููกค้าlogin
app.get('/user_login', function (req, res) {
  res.sendFile(path.join(__dirname, '/public/user/user_login.html'));
});
//หน้าลูกค้าสมัครสมาชิก
app.get('/user_register', function (req, res) {
  res.sendFile(path.join(__dirname, '/public/user/user_register.html'));
});
//-------------------------USER action-----------------------
app.get('/user_register_acc', function (req, res) {
  let formdata = {
    username: req.query.username,
    firstname: req.query.firstname,
    lastname: req.query.lastname,
    phone_number: req.query.phone_number,
    password: req.query.password,
    email: req.query.email
  };

  let sql = `INSERT INTO Customer (Username, FirstName, LastName, PhoneNumber, Email, Password)
  VALUES (?, ?, ?, ?, ?, ?);`;

  db.run(sql, [formdata.username, formdata.firstname, formdata.lastname, formdata.phone_number, formdata.email, formdata.password], (err) => {
    if (err) {
      return console.error('Error inserting data:', err.message);
    }
    console.log('Data inserted successfully');
    res.send(`
      <script>
        alert('สมัครบัญชีเสร็จสิ้น!');
        window.location.href = '/user_login';
      </script>
    `);
  });
});

// app.post('/user_login_action', (req, res) => {
//   const { username, password } = req.body;

//   // ตรวจสอบข้อมูลล็อกอิน
//   db.get('SELECT id FROM users WHERE Username = ? AND Password = ?', [username, password], (err, row) => {
//       if (err || !row) {
//           return res.status(401).send('Invalid credentials');
//       }
//       // บันทึก user_id ใน session
//       req.session.user_id = row.id;
//       res.send('Login successful');
//   });
// });

app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})

