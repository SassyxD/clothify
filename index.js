const express = require('express')
const app = express()
const port = 3000

const path = require('path');

// create directory 'public'
app.use(express.static('public'));
app.use(express.static('images'));

// Without middleware
app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname, '/public/home.html'));
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})

