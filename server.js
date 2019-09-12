const express = require('express');
const app = express();
const bodyParser = require('body-parser');

const shortid = require('shortid');
const cors = require('cors');

const mongoose = require('mongoose');
mongoose.connect(process.env.MLAB_URI || 'mongodb://localhost/exercise-track' );

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  exercises: [{
    description: { type: String, required: true },
    duration: { type: Number, required: true },
    date: { type: String, default: new Date().toISOString().slice(0,10) }
  }]
});

const User = mongoose.model('User', userSchema);

app.use(cors());

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

app.use(express.static('public'));
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

app.post('/api/exercise/new-user', function(req, res) {
  const user = new User({ username: req.body.username });
  
  user.save(function (err, data) {
    if (err) return res.json({ error: "Invalid User"});
    return res.json({ _id: data._id, username: data.username });
  });
});

app.get('/api/exercise/users', function(req, res) {
  User.find({}, function (err, data) {
    if (err) return res.json({ error: "Invalid Users"})
    return res.json(data.map(({ _id, username}) => ({ _id, username })));
  });
});

app.post('/api/exercise/add', function(req, res) {
  User.findById(req.body.userId, function(err, data) {
    if (err) return res.json({ error: "Invalid Exercise" });
    
    data.exercises.push(req.body);
    data.markModified('exercises');
    
    data.save(function(err, data) {
      if (err) return res.json({ error: "Invalid Exercise" }); 
      return res.json({ _id: data._id, username: data.username, exercises: data.exercises[data.exercises.length - 1] });
    });
  });
});

app.get('/api/exercise/log', function(req, res) {
  if (!req.query.userId) {
    return res.json({ error: "Invalid userId" });
  }
  
  User.findOne({ _id: req.query.userId }, function (err, data) {
    if (err) return res.json({ error: "Invalid Users"});
    
    const from = req.query.from ? req.query.from.split('-') : null;
    const to = req.query.to ? req.query.to.split('-') : null;
    const fromDate = from ? new Date(from[0], from[1] - 1, from[2]) : null;
    const toDate = to ? new Date(to[0], to[1] - 1, to[2]) : null;
    
    let filteredExercises = data.exercises.filter((exercise) => {
      let filtered = false;
      let date = exercise.date ? exercise.date.split('-') : null;
      let dateDate = date ? new Date(date[0], date[1] - 1, date[2]) : null;
      if (from && dateDate <= fromDate) {
        filtered = true;
      }
      if (to && dateDate >= toDate) {
        filtered = true;
      }
      return !filtered;
    });
    
    if (req.query.limit) {
      filteredExercises = filteredExercises.slice(0, req.query.limit);
    }
    
    return res.json({ _id: data._id, username: data.username, exercises: filteredExercises, count: filteredExercises.length });
  });
});

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage;

  if (err.errors) {
    // mongoose validation error
    errCode = 400; // bad request
    const keys = Object.keys(err.errors);
    // report the first validation error
    errMessage = err.errors[keys[0]].message;
  } else {
    // generic or custom error
    errCode = err.status || 500;
    errMessage = err.message || 'Internal Server Error';
  }
  res.status(errCode).type('txt')
    .send(errMessage);
});

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'});
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
});