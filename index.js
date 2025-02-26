const express = require('express')
const app = express()
const port = 3000
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');

// create directory 'public'
app.use(express.static('public'));
app.use(express.static('images'));

// Set EJS as templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware เพื่ออ่านข้อมูลจาก form
app.use(express.urlencoded({ extended: true }));
// ---------------------- SESSION-----------------------
// ตั้งค่า session
app.use(session({
  secret: 'my-super-secret-key-@#$$',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } 
}));

// Middleware ตรวจสอบการล็อกอิน
function isAuthenticated(req, res, next) {
  if (req.session.user_id) {
      next();
  } else {
      res.status(401).send('Unauthorized');
  }
}
// Connect to SQLite database
let db = new sqlite3.Database('clothify.db', (err) => {
    if (err) {
        return console.error(err.message);
    }
    console.log('Connected to the SQlite database.');
});



// ---------------------- ADMIN route-----------------------
//หน้าแอดมิน login
app.get('/admin_login', function (req, res) {
    const error = req.query.error || null;
    res.render('admin/admin_login', { error: error });
});

//-------------------------ADMIN action-----------------------
//แอดมินกด login
app.post('/admin_login_action', function (req, res) {
    let formdata = {
        Username: req.body.username,
        Password: req.body.password,
    };
    console.log(formdata);
    const sql = 'SELECT Username, Password FROM Admin WHERE Username = ?';
    db.get(sql, [formdata.Username], function (err, admin) {
        if (err) {
            console.error('Error executing query:', err.message);
            return res.status(500).send('Internal Server Error');
        }
        if (!admin) {//ไม่เจอบัญชี
            return res.redirect('/admin_login?error=user_not_found');
        }

        if (admin.Username !== formdata.Username || admin.Password !== formdata.Password) {
            return res.redirect('/admin_login?error=invalid_credentials');//รหัสหรือบัญชีผิด
        }
        
        res.render('admin/admin_appointment');
    });
  });
// ---------------------- USER route------------------------
app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, '/public/user/landingpage.html'));
});
//หน้าลููกค้าlogin
app.get('/user_login', function (req, res) {
    const success = req.query.success || null;
    res.render('user/user_login', { success: success });
});
//หน้าลูกค้าสมัครสมาชิก
app.get('/user_register', function (req, res) {
    const error = req.query.error || null;
    res.render('user/user_register', { error: error });
});
//หน้าuserhomepage
app.get('/user_homepage', function (req, res) {
    db.get('SELECT FirstName FROM Customer WHERE CustomerID = ? ', [req.session.user_id], (err, row) => {
        if (err || !row) {
            return res.status(401).send('Invalid credentials');
        }
        console.log("Go to user_homepage User ID:", req.session.user_id);
        res.render('user/user_homepage', { firstname: row.FirstName});
    });
});

//หน้าลูกค้าแสดงรายละเอียดแก้ไข/ปรับแต่งสูท
app.get('/user_fix_suit', (req, res) => {
    res.render("user/user_fix_suit");
});
//หน้าจอง
app.get('/user_booking', function (req, res) {
    res.render('user/user_booking',);
});
// //หน้ายืนยันจอง
// app.get('/user_booking', function (req, res) {
//     db.get('SELECT * FROM Customer WHERE CustomerID = ? ', [req.session.user_id], (err, row) => {
//         console.log("User ID:", req.session.user_id);
//         if (err || !row) {
//             return res.status(401).send('Invalid credentials');
//         }
//         res.render('user/user_booking', { userdata: row});
//     });
// });
//-------------------------USER action-----------------------
//ลูกค้ากดสมัครสมาชิก
app.post('/user_register_action', function (req, res) {
    let formdata = {
        username: req.body.username,
        firstname: req.body.firstname,
        lastname: req.body.lastname,
        phone_number: req.body.phone_number,
        password: req.body.password,
        email: req.body.email
    };
    const checkSql = `SELECT * FROM Customer WHERE Username = ? OR Email = ?`;
    db.get(checkSql, [formdata.username, formdata.email], async (err, row) => {
        if (err) {
        console.error('Error checking data:', err.message);
        return res.status(500).send('Internal Server Error');
        }

        if (row) {
            // ถ้าพบ username หรือ emailซ้ำ
            let errorMessage = '';
            if (row.Username === formdata.username) {
                errorMessage = 'username_exists';
            } else if (row.Email === formdata.email) {
                errorMessage = 'email_exists';
            }
            return res.redirect(`/user_register?error=${errorMessage}`);
        }
        let sql = `INSERT INTO Customer (Username, FirstName, LastName, PhoneNumber, Email, Password)
        VALUES (?, ?, ?, ?, ?, ?);`;

        db.run(sql, [formdata.username, formdata.firstname, formdata.lastname, formdata.phone_number, formdata.email, formdata.password], (err) => {
            if (err) {
                console.error('Error inserting data:', err.message);
                return res.redirect('/user_register?error=registration_failed');
              }
              console.log('Data inserted successfully');
              return res.redirect('/user_login?success=true');
        });
    });
});
//ลูกค้ากด login
app.post('/user_login_action', (req, res) => {
    const { username, password } = req.body;

    // ตรวจสอบข้อมูลล็อกอิน
    db.get('SELECT CustomerID FROM Customer WHERE Username = ? AND Password = ?', [username, password], (err, row) => {
        if (err || !row) {
            return res.redirect('/user_login?success=not_found');
        }
        // บันทึก user_id ใน session
        req.session.user_id = row.CustomerID;
        console.log("Start session User ID:", req.session.user_id);
        res.redirect("/user_homepage");
    });

});
//ลูกค้ากด logout
app.get('/user_log_out', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send('Could not log out');
        }
        res.sendFile(path.join(__dirname, '/public/user/landingpage.html'));
    });
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`)
})