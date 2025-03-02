const express = require('express')
const app = express()
const port = 3000
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
// ยยย
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
//หน้าแอดมิน แสดงรายการนัด
app.get('/admin_appointment', function (req, res) {
    const query = `
        SELECT 
            A.AppointmentID AS id,
            C.FirstName || ' ' || C.LastName AS customerName,
            A.Status AS status,
            E.FirstName || ' ' || E.LastName AS employeeName,
            A.AppointmentDate AS date,
            A.TimeSlot AS timeSlot,
            A.Service AS service
        FROM Appointment A
        LEFT JOIN Customer C ON A.CustomerID = C.CustomerID
        LEFT JOIN Employee E ON A.EmployeeID = E.EmployeeID
        `;

        // ดึงข้อมูลจากฐานข้อมูล
        db.all(query, [], (err, rows) => {
            if (err) {
                console.error('เกิดข้อผิดพลาดในการดึงข้อมูล:', err.message);
                return res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูล');
            }

            // ส่งข้อมูลไปยัง EJS template
            res.render('admin/admin_appointment', { appointments: rows });
        });
});
//หน้าแอดมิน แสดงข้อมูลลูกค้า
app.get('/admin_customer', function (req, res) {
    const sql = `
        SELECT CustomerID, FirstName, LastName, PhoneNumber, Email
        FROM Customer
    `;

    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูลลูกค้า');
        }
        res.render('admin/admin_customer', { customers: rows });
    });
});
// admin Route สำหรับแสดงข้อมูลพนักงาน
app.get('/admin_employee', function (req, res) {
    const sql = 'SELECT * FROM Employee';
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูลพนักงาน');
        }
        res.render('admin/admin_employee', { employees: rows });
    });
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
        res.redirect("/admin_appointment");
    });
});
// admin กด logout
app.get('/admin_log_out', (req, res) => {
    res.redirect("/admin_login");
});
// admin เพิ่มพนักงาน
app.post('/admin/employees/add', function (req, res) {
    const { Username, Password, FirstName, LastName } = req.body;
    const sql = 'INSERT INTO Employee (Username, Password, FirstName, LastName) VALUES (?, ?, ?, ?)';
    db.run(sql, [Username, Password, FirstName, LastName], function (err) {
        if (err) {
            return res.status(500).send('เกิดข้อผิดพลาดในการเพิ่มพนักงาน');
        }
        res.redirect('/admin_employee');
    });
});
// admin ลบพนักงาน
app.post('/admin_employee_delete:id', function (req, res) {
    const { id } = req.params;
    const sql = 'DELETE FROM Employee WHERE EmployeeID = ?';
    db.run(sql, [id], function (err) {
        if (err) {
            return res.status(500).send('เกิดข้อผิดพลาดในการลบพนักงาน');
        }
        res.redirect('/admin_employee');
    });
});
// ---------------------- USER route------------------------
app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, '/public/user/landingpage.html'));
});
//หน้าลููกค้าดูรายละเอียดแบบไม่ login
app.get('/no_login_detail', function (req, res) {
    res.sendFile(path.join(__dirname, '/public/user/no_login_detail.html'));
});
//หน้าลููกค้าดูรายละเอียดซ่อมสูทแบบไม่ login
app.get('/no_login_fix_suit', function (req, res) {
    res.sendFile(path.join(__dirname, '/public/user/no_login_fix_suit.html'));
});
//หน้าลููกค้าดูรายละเอียดซ่อมสูทแบบไม่ login
app.get('/no_login_new_suit', function (req, res) {
    res.sendFile(path.join(__dirname, '/public/user/no_login_new_suit.html'));
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
        res.render('user/user_homepage', { firstname: row.FirstName });
    });
});

//หน้าลูกค้าแสดงตัดสูทใหม่
app.get('/user_new_suit', (req, res) => {
    res.render("user/user_new_suit");
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

// ---------------------- EMPLOYEE route-----------------------
//หน้าพนักงาน login
app.get('/employee_login', function (req, res) {
    const success = req.query.success || null;
    res.render('employee/employee_login', { success: success });
}
);
//homepage พนักงาน
app.get('/employee_homepage', function (req, res) {
    const employeeID = req.session.employee_id;

    // ตรวจสอบว่าพนักงานเข้าสู่ระบบหรือไม่
    if (!employeeID) {
        return res.redirect('/employee_login'); // เปลี่ยนเส้นทางไปยังหน้า login
    }

    // ดึงข้อมูลพนักงานจากฐานข้อมูล
    db.get('SELECT FirstName, LastName FROM Employee WHERE EmployeeID = ?', [employeeID], (err, employee) => {
        if (err || !employee) {
            return res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูลพนักงาน');
        }

        // ดึงข้อมูลนัดลูกค้าที่เกี่ยวข้องกับพนักงาน
        const sql = `
            SELECT 
                Appointment.AppointmentID,
                Appointment.AppointmentDate,
                Appointment.TimeSlot,
                Appointment.Service,
                Appointment.Status,
                Customer.FirstName AS CustomerFirstName,
                Customer.LastName AS CustomerLastName
            FROM Appointment
            LEFT JOIN Customer ON Appointment.CustomerID = Customer.CustomerID
            WHERE Appointment.EmployeeID = ? OR Appointment.EmployeeID IS NULL
        `;

        db.all(sql, [employeeID], (err, appointments) => {
            if (err) {
                return res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูลนัดลูกค้า');
            }
            res.render('employee/employee_homepage', { 
                employee: employee, 
                appointments: appointments 
            });
        });
    });
});
// ---------------------- EMPLOYEE action----------------------
app.post('/employee_login_action', (req, res) => {
    const { username, password } = req.body;

    // ตรวจสอบข้อมูลล็อกอิน
    db.get('SELECT EmployeeID FROM Employee WHERE Username = ? AND Password = ?', [username, password], (err, row) => {
        if (err || !row) {
            return res.redirect('/employee_login?success=not_found');
        }
        // บันทึก user_id ใน session
        console.log(row);
        req.session.employee_id = row.EmployeeID;
        console.log("Start session Employee ID:", req.session.employee_id);
        res.redirect("/employee_homepage");
    });
});
//พนักงานกด logout
app.get('/employee_logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send('Could not log out');
        }
        res.redirect("/employee_login");
    });
});
//พนักงานกดรับนัด
app.post('/employee/accept_appointment/:id', function (req, res) {
    const appointmentID = req.params.id;
    const employeeID = req.session.employee_id;

    // อัปเดต EmployeeID และสถานะในตาราง Appointment
    const sql = `
        UPDATE Appointment
        SET EmployeeID = ?, Status = 'จอง'
        WHERE AppointmentID = ? AND Status = 'รอการยืนยัน'
    `;

    db.run(sql, [employeeID, appointmentID], function (err) {
        if (err) {
            return res.status(500).send('เกิดข้อผิดพลาดในการจองนัด');
        }
        if (this.changes === 0) {
            return res.status(400).send('ไม่สามารถจองนัดนี้ได้');
        }
        res.redirect('/employee_homepage');
    });
});
app.listen(port, () => {
    console.log(`Server is running on port ${port}`)
})