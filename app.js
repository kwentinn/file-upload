var fs = require('fs');
var exec = require('child_process').exec;
var util = require('util');
var express = require('express');
var app = express();

/** socket.io */
var server = require('http').Server(app).listen(8080);
var io = require('socket.io')(server);

app.use('/js', express.static(__dirname + '/js'));
app.get('/', function (req, res, next) {
	res.redirect('/index.html');
});
app.get('/index.html', function (req, res, next) {
	fs.readFile(__dirname + '/index.html', function (err, data) {
		if (err) {
			res.writeHead(500);
			return res.end("Error loading index.html");
		}
		res.writeHead(200);
		res.end(data);
	});
});
app.use(function (req, res, next) {
	// Page non trouvée ? redirection vers /
	res.redirect('/');
});

var DATA_BUFFER_LENGTH = 1 * 1024 * 1024; // 10 MB
var BLOCK_SIZE = 524288;
var ONE_MB = 1024 * 1024;

var files = {};
io.sockets.on('connection', function (socket) {

	// when an upload starts
	socket.on('start', function (data) {

		var name = data['name'];

		console.log('starting upload for file: ' + name + ' size: ' + data['size']);

		files[name] = {
			fileSize : data['size'],
			data : '',
			downloaded : 0,
			startDate : new Date(),
			lastDataReceivedDate : new Date(),
			paused : false,
			pauseData : null,
			cancelled : false
		};

		//console.dir(files);

		var place = 0;
		try {
			var stat = fs.statSync('Temp/' + name);
			if (stat.isFile()) {
				files[name]['downloaded'] = stat.size;
				place = stat.size / BLOCK_SIZE;
			}
		} catch (er) {}
		// it's a new file
		fs.open('Temp/' + name, "a", 0755, function (err, fd) {
			if (err) {
				console.log(err);
			} else {
				files[name]['handler'] = fd; // we store the file handler so we can write to it later
				socket.emit('moreData', {
					'place' : place,
					'percent' : 0,
					'rate' : 0,
					'downloaded' : 0
				});
			}
		});
	});
	socket.on('upload', function (data) {
		var name = data['name'];

		if (files[name]['cancelled'] === true) {
			files[name] = null;
			return;
		}

		files[name]['downloaded'] += data['data'].length;
		files[name]['data'] += data['data'];

		if (files[name]['downloaded'] == files[name]['fileSize']) { // the file is fully loaded
			console.log('[' + name + '] file fully loaded');
			fs.write(files[name]['handler'], files[name]['data'], null, 'Binary', function (err, written) {
				var now = new Date();
				var span = (now - files[name]['startDate'])
				var rate = (files[name]['downloaded'] * 1000) / span;

				// on envoie un message de transfert réussi
				var obj = {
					'name' : name,
					'size' : Math.round(files[name]['fileSize'] / (ONE_MB) * 100) / 100, // MB
					'downloaded' : Math.round(files[name]['downloaded'] / (ONE_MB) * 100) / 100, // MB
					'startDate' : files[name]['startDate'],
					'finishDate' : now,
					'elapsedTime' : span,
					'rate' : (rate / (ONE_MB)).toFixed(3) // MB/s
				};
				console.dir(obj);
				socket.emit('done', obj);
			});
		} else if (files[name]['data'].length > DATA_BUFFER_LENGTH) {

			//console.log('[' + name + '] length = ' + files[name]['data'].length);

			fs.write(files[name]['handler'], files[name]['data'], null, 'Binary', function (err, written) {
				files[name]['data'] = ""; // resets the buffer.
				var rate = (files[name]['downloaded'] * 1000) / (new Date() - files[name]['lastDataReceivedDate']);
				files[name]['lastDataReceivedDate'] = new Date();
				var place = files[name]['downloaded'] / BLOCK_SIZE;
				var percent = (files[name]['downloaded'] / files[name]['fileSize']) * 100;

				var msg = {
					'place' : place,
					'percent' : percent,
					'rate' : (rate / (ONE_MB)).toFixed(3), // MB/s
					'downloaded' : Math.round(files[name]['downloaded'] / (ONE_MB)) // MB
				};

				if (files[name]['paused'] === true) {
					files[name]['pauseData'] = msg;
				} else {
					socket.emit('moreData', msg);
				}
			});

		} else {
			//console.log('file: [' + name + '] downloaded: ' + files[name]['downloaded']);
			var rate = (files[name]['downloaded'] * 1000) / (new Date() - files[name]['lastDataReceivedDate']);
			files[name]['lastDataReceivedDate'] = new Date();
			var place = files[name]['downloaded'] / BLOCK_SIZE;
			var percent = (files[name]['downloaded'] / files[name]['fileSize']) * 100;

			var msg = {
				'place' : place,
				'percent' : percent,
				'rate' : (rate / (ONE_MB)).toFixed(3), // MB/s
				'downloaded' : Math.round(files[name]['downloaded'] / (ONE_MB)) // MB
			};
			//console.dir(msg);
			if (files[name]['paused'] === true) {
				files[name]['pauseData'] = msg;
			} else {
				socket.emit('moreData', msg);
			}
		}
	});
	socket.on('pause', function (data) {
		// 'data' doit contenir le nom du fichier
		console.log('pause event received!');
		console.dir(data);
		var name = data['name'];
		if (files[name]['paused'] === false) {
			files[name]['paused'] = true;
		}
	});
	socket.on('resume', function (data) {
		console.log('\'resume\' event received!');
		var name = data['name'];
		if (files[name]['paused'] === true) {

			files[name]['paused'] = false;

			var msg = files[name]['pauseData'];
			socket.emit('moreData', msg);
			console.dir(msg);
		}
	});
	socket.on('cancel', function (data) {
		console.log('\'cancel\' event received!');
		var name = data['name'];
		files[name]['cancelled'] = true;

		// supprimer le fichier téléchargé...
		fs.unlink('temp/' + name, function (err) {
			if (err)
				console.log("Error occurred !", err);
			else
				console.log('successfully deleted /temp/' + name);
		});
	});
});
