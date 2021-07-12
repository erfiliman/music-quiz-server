const express = require('express');
const bodyParser = require('body-parser')
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const levenshtein = require('fast-levenshtein');
const fetch = require("node-fetch");
const io = new Server(server,{cors:{origin:"*"}});
const cors = require('cors');
const session = require('express-session')
const request = require('request');

const client_id = 'd6a1800401ba45f78e84b9703f8a2bd8';
const client_secret = 'b6c98a4de4b6470db40c37b8e2e5de56';
const corsOptions = {
	origin: '*',
	optionsSuccessStatus: 200 // For legacy browser support
}
app.use(bodyParser.json());

app.use(cors(corsOptions));
app.use(
	session({
		secret: 'erfiliman229812',
		saveUninitialized: true,
	})
)
const rooms = new Map();

app.get('/', (req, res) => {
	res.send("hello");
});

const port = process.env.PORT || 8000;

server.listen(port, () => {
	console.log("App is running on port " + port);
});

app.post('/join', (req, res) => {
	let roomId;
	if (req.body.roomId==undefined)
		roomId = String (Math.round(1001 - 0.5 + Math.random() * (9999 - 1001 + 1)));
	else roomId = req.body.roomId;
	if(!rooms.has(roomId)) {
		rooms.set(
			roomId,
			new Map([
				['users', new Map()],
				['messages', new Map()],
				['history', []],
				['isStart', false],
				['currentQuestion', {}],
				['currentAnswers', {}],
				['hostId', req.body.sessionID==undefined? req.sessionID:req.body.sessionID],
				['countAnswered', 0],
				['Settings', {}],
			])
		)
		res.send({roomId: roomId, sessionID: req.body.sessionID==undefined? req.sessionID:req.body.sessionID, isHost: true});
	} else {
		res.send({roomId: roomId, sessionID: req.body.sessionID==undefined? req.sessionID:req.body.sessionID, isHost: req.body.sessionID==undefined? req.sessionID==rooms.get(roomId).get('hostId'): req.body.sessionID==rooms.get(roomId).get('hostId')});
	}
	console.log(rooms.get(roomId).get('hostId'))
	console.log(req.sessionID)
	console.log(req.body.sessionID)
});


io.on('connection', (socket) => {
	socket.on('JOIN', ({ username, roomId, sessionID, avatar }) => {
		socket.join(roomId);
		rooms.get(roomId).get('users').set(sessionID, {username: username, points: 0, lastResult: 0, avatar: avatar});
		console.log(rooms);
		const users = [...rooms.get(roomId).get('users').values()];
		io.to(roomId).emit('UPDATE_USERS', users);
	});

	socket.on('CHECK_ANSWER', ({ roomId, answer, time, sessionID }) => {
		let correctAnswer = rooms.get(roomId).get('currentQuestion').artists + "-" + rooms.get(roomId).get('currentQuestion').name;
		rooms.get(roomId).set("countAnswered", rooms.get(roomId).get("countAnswered") +1);
		if (levenshtein.get(answer, correctAnswer) < correctAnswer.length * 0.4) {
			let previousPoint = rooms.get(roomId).get('users').get(sessionID).points;
			let username = rooms.get(roomId).get('users').get(sessionID).username;
			let avatar = rooms.get(roomId).get('users').get(sessionID).avatar;
			let lastResult = Math.round((time/rooms.get(roomId).get("Settings").time)*550);
			rooms.get(roomId).get('users').set(sessionID, {username: username, points: previousPoint+lastResult, lastResult: lastResult, avatar: avatar});
		}
	});

	socket.on('UPDATE_USERNAME', ({ roomId, name, sessionID }) => {
		let points = rooms.get(roomId).get('users').get(sessionID).points;
		let lastResult = rooms.get(roomId).get('users').get(sessionID).lastResult;
		let username = name;
		let avatar = rooms.get(roomId).get('users').get(sessionID).avatar;
		rooms.get(roomId).get('users').set(sessionID, {username: username, points: points, lastResult: lastResult, avatar: avatar});
		const users = [...rooms.get(roomId).get('users').values()];
		io.to(roomId).emit('UPDATE_USERS', users);
	});

	socket.on('UPDATE_AVATAR', ({ roomId, avatar, sessionID }) => {
		let points = rooms.get(roomId).get('users').get(sessionID).points;
		let lastResult = rooms.get(roomId).get('users').get(sessionID).lastResult;
		let username = rooms.get(roomId).get('users').get(sessionID).username;
		rooms.get(roomId).get('users').set(sessionID, {username: username, points: points, lastResult: lastResult, avatar: avatar});
		const users = [...rooms.get(roomId).get('users').values()];
		io.to(roomId).emit('UPDATE_USERS', users);
	});

	function refreshToken(token) {
		return new Promise(function (resolve, reject) {
			const authOptions = {
				url: 'https://accounts.spotify.com/api/token',
				headers: {
					'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
				},
				form: {
					grant_type: 'refresh_token',
					refresh_token: token
				},
				json: true
			};
			request.post(authOptions, function(error, response, body) {
				if (!error && response.statusCode === 200) {
					resolve(body.access_token);
				} else {
					reject(error)
				}
			});
		});
	}

	function getToken() {
		return new Promise(function (resolve, reject) {
			const authOptions = {
				url: 'https://accounts.spotify.com/api/token',
				headers: {

					'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
				},
				form: {
					grant_type: 'client_credentials'
				},
				json: true
			};
			request.post(authOptions, function(error, response, body) {
				if (!error && response.statusCode === 200) {
					resolve(body.access_token);
				} else {
					reject(error)
				}
			});
		});
	}

	function getTotal(id, token) {
		return new Promise(function (resolve, reject) {
			const authOptions = {
				url: `https://api.spotify.com/v1/playlists/${id}?market=us`,
				headers: {
					'Authorization': `Bearer ${token}`
				},
				json: true
			};
			request(authOptions, function (error, response, body) {
				if (!error && response.statusCode === 200) {
					console.log(body.tracks.total)
					resolve(body.tracks.total);
				} else {
					reject(error)
				}
			});
		});
	}

		const resetLastResult = (roomId) => {
		rooms.get(roomId).get('users').forEach((value, key, map) => {
			map.get(key).lastResult = 0;
		})
	}



	const startGame = async (roomId, playlist, count, time) => {
		let idPlaylist = "4o6ejPEzNaJhbUl9u0Vb3X";
		rooms.get(roomId).set("countAnswered", 0);
		let token = await getToken();
		let total = await getTotal(idPlaylist, token);
		console.log(total);
		fetch(`https://api.spotify.com/v1/playlists/${idPlaylist}/tracks?market=US&fields=items(track(name, preview_url, artists(name)))&limit=100&offset=${Math.round(Math.random()*(total-10))}`,
			{
				headers: {
					"Accept": "application/json",
					"Content-Type": "application/json",
					"Authorization": `Bearer ${token}`,
				}
			})
			.then((response) => response.json())
			.then(responseJson => {
				console.log(responseJson);
				let items = responseJson.items.sort(() => Math.random() - 0.5);
				while(items[0].track.preview_url==null)
					items = responseJson.items.sort(() => Math.random() - 0.5);
				rooms.get(roomId).set('currentQuestion', {
					preview: items[0].track.preview_url,
					name: items[0].track.name,
					artists: `${items[0].track.artists.map((item) => item.name + " ")}`
				});
				console.log(items[0].track.name);
				let answers = [];
				for (let i = 0; i < 6; i++) {
					answers.push({
						name: items[i].track.name,
						artists: `${items[i].track.artists.map((item) => item.name + " ")}`
					})
				}
				answers = answers.sort(() => Math.random() - 0.5);
				rooms.get(roomId).set('currentAnswers', answers);
				resetLastResult(roomId);
				io.to(roomId).emit('NEW_QUESTION', {
					question: rooms.get(roomId).get("currentQuestion").preview,
					answers: answers
				});
				let seconds = time;
				let x = setInterval(function () {
					seconds--;
					io.to(roomId).emit('SECONDS', seconds);
					if (seconds == -1 || rooms.get(roomId).get('countAnswered') == rooms.get(roomId).get("users").size) {
						clearInterval(x);
						const users = [...rooms.get(roomId).get('users').values()];
						io.to(roomId).emit('RESULT_QUESTION', {users: users, correctAnswer: rooms.get(roomId).get('currentQuestion').artists + " – " + rooms.get(roomId).get('currentQuestion').name});
						setTimeout(()=>{
							if (rooms.get(roomId)) {
								let settings = rooms.get(roomId).get("Settings");
								startGame(roomId, settings.playlist, settings.count, settings.time);
							}
						}, 5000)
					}
				}, 1000);
			})
	}

	socket.on('START_GAME', ({ roomId, playlist, count, time, mode }) => {
		if (!rooms.get(roomId).get('isStart')) {
			rooms.get(roomId).set("isStart", true);
			rooms.get(roomId).set("Settings", {playlist: playlist, count: count, time: time, mode: mode});
			io.to(roomId).emit('START_GAME');
			switch (mode) {
				case 0:
					startGame(roomId, playlist, count, time)
				default:
					return 0;
			}
		}
	});

	socket.on('LEAVE_THE_GAME', ({ roomId, sessionID }) => {
		if (rooms.get(roomId)!=undefined) {
			rooms.get(roomId).get('users').delete(sessionID);
			if (rooms.get(roomId).get('users').size == 0) rooms.delete(roomId);
		}
	});
});



