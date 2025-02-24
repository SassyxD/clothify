const express = require('express')
const app = express()
const port = 3000

const path = require('path');

// create directory 'public'
app.use(express.static('public'));
app.use(express.static('images'));

// ---------------------- USER route-----------------------
app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname, '/public/user/landingpage.html'));
});

app.get('/user_login', function(req, res) {
  res.sendFile(path.join(__dirname, '/public/user/user_login.html'));
});

app.get('/user_register', function(req, res) {
  res.sendFile(path.join(__dirname, '/public/user/user_register.html'));
});
//-------------------------USER action-----------------------
app.get('/user_register_acc', function(req, res) {
  res.render("ok");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})

