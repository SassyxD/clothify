const express = require('express')
const app = express()
const port = 3000
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const qrcode = require('qrcode');
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
// admin ดูประวัติลูกค้า
app.get('/admin/customer_appointments/:customerId', (req, res) => {
    const customerId = req.params.customerId;

    // ดึงข้อมูลประวัติการนัดของลูกค้าจากฐานข้อมูล
    const sql = `
    SELECT 
        Appointment.AppointmentID,
        Appointment.AppointmentDate,
        Appointment.TimeSlot,
        Appointment.Service,
        Appointment.Status,
        Employee.FirstName AS EmployeeFirstName,
        Employee.LastName AS EmployeeLastName
    FROM 
        Appointment
    LEFT JOIN 
        Employee ON Appointment.EmployeeID = Employee.EmployeeID
    WHERE 
        Appointment.CustomerID = ?
`;
    db.all(sql, [customerId], (err, appointments) => {
        if (err) {
            console.error('Error fetching appointments:', err.message);
            res.status(500).send('Internal Server Error');
        } else {
            res.render('admin/admin_history', { appointments });
        }
    });
});
// ---------------------- USER route------------------------
app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, '/public/user/landingpage.html'));
});
//หน้าลููกค้าดูรายละเอียดแบบไม่ login
app.get('/no_login_home', function (req, res) {
    res.sendFile(path.join(__dirname, '/public/user/no_login_home.html'));
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
    db.get('SELECT * FROM Customer WHERE CustomerID = ? ', [req.session.user_id], (err, row) => {
        if (err || !row) {
            return res.status(401).send('Invalid credentials');
        }
        console.log("Go to user_homepage User ID:", req.session.user_id);
        res.render('user/user_homepage', { username: row.Username, firstname: row.FirstName });
    });
});

//หน้าลูกค้าแสดงตัดสูทใหม่
app.get('/user_new_suit', (req, res) => {
    db.get('SELECT Username FROM Customer WHERE CustomerID = ? ', [req.session.user_id], (err, row) => {
        if (err || !row) {
            return res.status(401).send('Invalid credentials');
        }
        console.log("Go to user_homepage User ID:", req.session.user_id);
        res.render('user/user_new_suit', { username: row.Username });
    });
});
//หน้าลูกค้าแสดงรายละเอียดแก้ไข/ปรับแต่งสูท
app.get('/user_fix_suit', (req, res) => {
    db.get('SELECT Username FROM Customer WHERE CustomerID = ? ', [req.session.user_id], (err, row) => {
        if (err || !row) {
            return res.status(401).send('Invalid credentials');
        }
        console.log("Go to user_homepage User ID:", req.session.user_id);
        res.render('user/user_fix_suit', { username: row.Username });
    });
});
//หน้าจอง
app.get('/user_booking', function (req, res) {
    db.get('SELECT Username FROM Customer WHERE CustomerID = ? ', [req.session.user_id], (err, row) => {
        if (err || !row) {
            return res.status(401).send('Invalid credentials');
        }
        console.log("Go to user_homepage User ID:", req.session.user_id);
        res.render('user/user_booking', { username: row.Username });
    });
});
//ตรวจการจองซ้ำ
app.post('/check_booking', express.json(), (req, res) => {
    const { date, timeSlot } = req.body;

    // ตรวจสอบว่ามีการจองในวันที่และช่วงเวลานี้แล้วหรือไม่
    const checkSql = `
        SELECT * FROM Appointment
        WHERE AppointmentDate = ? AND TimeSlot = ? AND Status != 'ยกเลิก'
    `;
    db.get(checkSql, [date, timeSlot], (err, row) => {
        if (err) {
            console.error('Error checking appointment:', err.message);
            return res.status(500).json({ isBooked: false });
        }

        // ส่งผลลัพธ์กลับไปยังไคลเอนต์
        res.json({ isBooked: !!row });
    });
});
// Route to display customer appointments
app.get('/user_history', (req, res) => {
    const customerId = req.session.user_id;
    const sql = `
        SELECT 
            Appointment.AppointmentID,
            Appointment.AppointmentDate,
            Appointment.TimeSlot,
            Appointment.Service,
            Appointment.Status
        FROM 
            Appointment
        WHERE 
            Appointment.CustomerID = ?
    `;
    db.all(sql, [customerId], (err, appointments) => {
        if (err) {
            console.error('Error fetching appointments:', err.message);
            res.status(500).send('Internal Server Error');
        } else {
            db.get('SELECT Username FROM Customer WHERE CustomerID = ? ', [req.session.user_id], (err, row) => {
                if (err || !row) {
                    return res.status(401).send('Invalid credentials');
                }
                console.log("Go to user_homepage User ID:", req.session.user_id);
                res.render('user/user_history', { appointments, username: row.Username });
            });
        }
    });
});
//ลูกค้ากดยกเลิก
app.post('/user_history/cancel/:id', (req, res) => {
    const appointmentId = req.params.id;
    const customerId = req.session.user_id;

    const sql = `UPDATE Appointment SET Status = 'ยกเลิก' WHERE AppointmentID = ? AND CustomerID = ?`;
    db.run(sql, [appointmentId, customerId], (err) => {
        if (err) {
            console.error('Error canceling appointment:', err.message);
            res.status(500).send('Internal Server Error');
        } else {
            res.redirect('/user_history');
        }
    });
});
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
// ลูกค้าดูรายละเอียดยืนยัน
app.post('/user_review', (req, res) => {
    const { date, service, gridRadios: time } = req.body;
    db.get('SELECT Username FROM Customer WHERE CustomerID = ? ', [req.session.user_id], (err, row) => {
        if (err || !row) {
            return res.status(401).send('Invalid credentials');
        }
        console.log("Go to user_homepage User ID:", req.session.user_id);
        res.render('user/user_review', { date, service, time, username: row.Username });
    });
});

app.post('/generate-qr', (req, res) => {
    const { date, service, time } = req.body; // รับค่าจาก req.body
    const paymentData = '00020101021129370016A000000677010111011300660000000005802TH530376463048956'; // PromptPay payload

    qrcode.toDataURL(paymentData, (err, url) => {
        if (err) {
            console.error('Error generating QR code:', err);
            res.status(500).send('Error generating QR code');
        } else {
            db.get('SELECT Username FROM Customer WHERE CustomerID = ? ', [req.session.user_id], (err, row) => {
                if (err || !row) {
                    return res.status(401).send('Invalid credentials');
                }
                console.log("Go to user_homepage User ID:", req.session.user_id);
                res.render('user/user_generate_qr', { qrCode: url, date, service, time, username: row.Username });
            });
        }
    });
});

// หน้าขอบคุณ
app.post('/payment-success', (req, res) => {
    const { date, service, time } = req.body; // รับค่าจาก req.body

    // ตรวจสอบข้อมูล
    if (!date || !service || !time) {
        return res.status(400).send('ข้อมูลไม่ครบถ้วน');
    }

    // ตรวจสอบว่าลูกค้าล็อกอินหรือไม่
    const customerId = req.session.user_id;
    if (!customerId) {
        return res.status(401).send('กรุณาล็อกอินก่อนทำการจอง');
    }

    // Insert booking into Appointment table
    const sql = `
        INSERT INTO Appointment (CustomerID, AppointmentDate, TimeSlot, Service, Status)
        VALUES (?, ?, ?, ?, 'รอการยืนยัน')
    `;

    db.run(sql, [customerId, date, time, service], function (err) {
        if (err) {
            console.error('Error saving appointment:', err.message);
            return res.status(500).send('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        } else {
            db.get('SELECT Username FROM Customer WHERE CustomerID = ? ', [req.session.user_id], (err, row) => {
                if (err || !row) {
                    return res.status(401).send('Invalid credentials');
                }
                console.log("Go to user_homepage User ID:", req.session.user_id);
                console.log(`Appointment saved with ID: ${this.lastID}`);
                res.render('user/user_payment_success', { username: row.Username });
            });
        }
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
            WHERE (Appointment.EmployeeID = ? OR Appointment.EmployeeID IS NULL)
                AND Appointment.Status = 'รอการยืนยัน'
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
//หน้าจัดการนัด
app.get('/employee_manage_appointment', (req, res) => {
    const employeeId = req.session.employee_id;
    const sql = `
        SELECT 
            Appointment.AppointmentID,
            Appointment.AppointmentDate,
            Appointment.TimeSlot,
            Appointment.Service,
            Appointment.Status,
            Customer.FirstName,
            Customer.LastName
        FROM 
            Appointment
        INNER JOIN 
            Customer ON Appointment.CustomerID = Customer.CustomerID
        WHERE 
            Appointment.EmployeeID = ? AND Appointment.Status = 'จอง'
    `;
    db.get('SELECT FirstName, LastName FROM Employee WHERE EmployeeID = ?', [employeeId], (err, employee) => {
        if (err || !employee) {
            return res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูลพนักงาน');
        }
        db.all(sql, [employeeId], (err, appointments) => {
            if (err) {
                console.error('Error fetching appointments:', err.message);
                res.status(500).send('Internal Server Error');
            } else {
                res.render('employee/employee_manage_appointment', { appointments, employee });
            }
        });
    });
});
// ---------------------- EMPLOYEE action----------------------
//พนักงานกด log in
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
// พนักงานกดเสร็จนัดหรือยกเลิกนัด
app.post('/employee_manage_appointment/:action/:id', (req, res) => {
    const { action, id } = req.params;
    const employeeId = req.session.employee_id;
    let newStatus;

    switch (action) {
        case 'cancel':
            newStatus = 'ยกเลิก';
            break;
        case 'complete':
            newStatus = 'เสร็จสิ้น';
            break;
        default:
            return res.status(400).send('Invalid action');
    }

    const sql = `UPDATE Appointment SET Status = ? WHERE AppointmentID = ? AND EmployeeID = ?`;
    db.run(sql, [newStatus, id, employeeId], (err) => {
        if (err) {
            console.error('Error updating appointment status:', err.message);
            res.status(500).send('Internal Server Error');
        } else {
            res.redirect('/employee_manage_appointment');
        }
    });
});
app.listen(port, () => {
    console.log(`Server is running on port ${port}`)
})