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
const typeLabel = ["Guess Artist", "Guess Song", "Guess Source", "Guess release year"];
const hints = [
	{
		value: "50",
		label: "50/50",
		img: "https://image.flaticon.com/icons/png/512/4036/4036377.png",
		isActive: true,
		isUsed: false,
	},
	{
		value: "x2",
		label: "Twice as many points",
		img: "https://www.pinclipart.com/picdir/big/344-3448601_toicon-icon-pictogram-repeat-svg-x2-icon-clipart.png",
		isActive: true,
		isUsed: false,
		multiplier: 1,
	},
]
const playlists = {
	classic: [
		{
			name: "500 Greatest Songs Of All Time",
			id: "5Rrf7mqN8uus2AaQQQNdc1",
		},
		{
			name: "Top hits 2020/2021",
			id: "3EtliZeGzwZqb8nr7r5Zp6",
		},
		{
			name: "All out 00s",
			id: "37i9dQZF1DX4o1oenSJRJd",
		},
		{
			name: "All out 90s",
			id: "37i9dQZF1DXbTxeAdrVG2l",
		},	{
			name: "All out 80s",
			id: "37i9dQZF1DX4UtSsGT1Sbe",
		},
		{
			name: "Rock Classics",
			id: "37i9dQZF1DWXRqgorJj26U",
		},
		{
			name: "Punk Rock Oldschool",
			id: "3pQrkTD3R14lL9wb6kVEcY",
		},
		{
			name: "Best Music of all Time",
			id: "2cyihP2rQm4u2NrmnGG2KF",
		},
		{
			name: "Most popular alternative Rock",
			id: "1nC7MMhwYt4CiRuXvQwbxD",
		},
	],
	ost: [
		{
			name: "Movies Soundtracks",
			id: "3xDZLZNqwNaNQPl54ol6FW",
		},
		{
			name: "Soundtracks Movies, Series, Video games",
			id: "5g7bTkO5gXl9i1z2oFa9Ir",
		},
		{
			name: "Soundtracks Video games",
			id: "3BGckoXAM2qE5Hb2zWbIiX",
		},
		{
			name: "Cartoon Songs",
			id: "0Jem7R54wxydqMWPuiQu1v",
		},
	],
	release: [
		{
			name: "Most popular alternative Rock",
			id: "1nC7MMhwYt4CiRuXvQwbxD",
		},
		{
			name: "500 Greatest Songs Of All Time",
			id: "5Rrf7mqN8uus2AaQQQNdc1",
		},
		{
			name: "Punk Rock Oldschool",
			id: "3pQrkTD3R14lL9wb6kVEcY",
		},
		{
			name: "Best Music of all Time",
			id: "2cyihP2rQm4u2NrmnGG2KF",
		},
		{
			name: "Best Pop Songs of all Time",
			id: "6vI3xbpdPYYJmicjBieLcr",
		},
	]


}

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
				['typeGame', 0],
				['currentAnswers', {}],
				['round', 0],
				['hostId', req.body.sessionID==undefined? req.sessionID:req.body.sessionID],
				['countAnswered', 0],
				['settings', {}],
			])
		)
		res.send({roomId: roomId, sessionID: req.body.sessionID==undefined? req.sessionID:req.body.sessionID, isHost: true, playlists: playlists, hints: hints });
	} else {
		res.send({roomId: roomId, sessionID: req.body.sessionID==undefined? req.sessionID:req.body.sessionID, isHost: req.body.sessionID==undefined? req.sessionID==rooms.get(roomId).get('hostId'): req.body.sessionID==rooms.get(roomId).get('hostId'), playlists: playlists, hints: hints});
	}
	// console.log(rooms.get(roomId).get('hostId'))
	// console.log(req.sessionID)
	// console.log(req.body.sessionID)
});


io.on('connection', (socket) => {
	socket.on('JOIN', ({ username, roomId, sessionID, avatar }) => {
		socket.join(roomId);
		rooms.get(roomId).get('users').set(sessionID, {username: username, points: 0, lastResult: 0, avatar: avatar, hints: hints});
		const users = [...rooms.get(roomId).get('users').values()];
		io.to(roomId).emit('UPDATE_USERS', users);
	});

	const getCorrectAnswer = (roomId) => {
		switch (Number.parseInt(rooms.get(roomId).get('typeGame'))) {
			case 0:
				return rooms.get(roomId).get('currentQuestion').artists;
			case 1:
				return rooms.get(roomId).get('currentQuestion').name;
			case 2:
				return rooms.get(roomId).get('currentQuestion').source;
			case 3:
				return rooms.get(roomId).get('currentQuestion').release;
			default:
				console.log("Warning");
		}
	}

	socket.on('CHECK_ANSWER', ({ roomId, answer, time, sessionID }) => {
		let correctAnswer = getCorrectAnswer(roomId);
		let fixLength = 0.4;
		let multiplier = 1;
		if (rooms.get(roomId).get('users').get(sessionID).hints[1].isActive && rooms.get(roomId).get('users').get(sessionID).hints[1].isUsed)
			multiplier = rooms.get(roomId).get('users').get(sessionID).hints[1].multiplier;
		rooms.get(roomId).set("countAnswered", rooms.get(roomId).get("countAnswered") +1);
		if (rooms.get(roomId).get('typeGame') == 3) {
			if (answer == correctAnswer) {
				let previousPoint = rooms.get(roomId).get('users').get(sessionID).points;
				let lastResult = Math.round((time/rooms.get(roomId).get("settings").time)*550)*multiplier;
				rooms.get(roomId).get('users').set(sessionID, {...rooms.get(roomId).get('users').get(sessionID), points: previousPoint+lastResult, lastResult: lastResult});
			}
		} else if (levenshtein.get(answer, correctAnswer) < correctAnswer.length * fixLength) {
			let previousPoint = rooms.get(roomId).get('users').get(sessionID).points;
			let lastResult = Math.round((time/rooms.get(roomId).get("settings").time)*550)*multiplier;
			rooms.get(roomId).get('users').set(sessionID, {...rooms.get(roomId).get('users').get(sessionID), points: previousPoint+lastResult, lastResult: lastResult});
		}
		rooms.get(roomId).get('users').get(sessionID).hints[1].multiplier = 1;
	});

	socket.on('UPDATE_USERNAME', ({ roomId, name, sessionID }) => {
		rooms.get(roomId).get('users').set(sessionID, {...rooms.get(roomId).get('users').get(sessionID), username: name});
		const users = [...rooms.get(roomId).get('users').values()];
		io.to(roomId).emit('UPDATE_USERS', users);
	});

	socket.on('UPDATE_AVATAR', ({ roomId, avatar, sessionID }) => {
		rooms.get(roomId).get('users').set(sessionID, {...rooms.get(roomId).get('users').get(sessionID), avatar: avatar});
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

	const startGame = async (roomId, idPlaylist, count, time, typeGame, typeAnswer, hints) => {

		if (rooms.get(roomId).get("round")!=rooms.get(roomId).get("settings").count) {
			io.to(roomId).emit('LOADING', true);
			io.to(roomId).emit('SECONDS', time);
			rooms.get(roomId).set("countAnswered", 0);
			rooms.get(roomId).set("round", rooms.get(roomId).get("round")+1);
			let token = await getToken();
			let total = await getTotal(idPlaylist, token);
			fetch(`https://api.spotify.com/v1/playlists/${idPlaylist}/tracks?market=US&fields=items(track(name, album(name, release_date), preview_url, artists(name)))&limit=100&offset=${Math.round(Math.random()*(total-10))}`,
				{
					headers: {
						"Accept": "application/json",
						"Content-Type": "application/json",
						"Authorization": `Bearer ${token}`,
					}
				})
				.then((response) => response.json())
				.then(responseJson => {
					let items = responseJson.items.sort(() => Math.random() - 0.5);
					while(items[0].track.preview_url==null)
						items = responseJson.items.sort(() => Math.random() - 0.5);
					console.log(items[0].track.name);
					rooms.get(roomId).set('currentQuestion', {
						preview: items[0].track.preview_url,
						name: items[0].track.name,
						artists: `${items[0].track.artists[0].name}`,
						// artists: `${items[0].track.artists.map((item) => item.name + " ")}`,
						source: items[0].track.album.name.replace(/ *\([^)]*\) */g, "").replace(/-? Original \w* \w* \w*/ig, "").replace(/ *\[\[^]\]*\) */g, ""),
						release: items[0].track.album.release_date.replace(/-\d*/ig, "")
					});
					// console.log(items[0].track.name);
					let answers = [];
					if (typeGame == "classic") {
						rooms.get(roomId).set('typeGame', Math.round(0 - 0.5 + Math.random() * (1 - 0 + 1)));
						switch (rooms.get(roomId).get('typeGame')) {
							case 0:
								for (let i = 0; i < 6; i++) {
									answers.push({
										value: items[i].track.artists[0].name,
										isActive: false,
										isVisible: true,
									})
								}
								break;
							case 1:
								for (let i = 0; i < 6; i++) {
									answers.push({
										value: items[i].track.name,
										isActive: false,
										isVisible: true,
									})
								}
								break;
							default:
								break;
						}
					} else if(typeGame == "ost") {
						rooms.get(roomId).set('typeGame', 2);
						for (let i = 0; i < 6; i++) {
							answers.push({
								value: items[i].track.album.name.replace(/ *\([^)]*\) */g, "").replace(/-? Original \w* \w* \w*/ig, ""),
								isActive: false,
								isVisible: true,
							})
						}
					} else if(typeGame == "release"){
						rooms.get(roomId).set('typeGame', 3);
						for (let i = 0; i < 6; i++) {
							answers.push({
								value: items[i].track.album.release_date.replace(/-\d*/ig, ""),
								isActive: false,
								isVisible: true,
							})
						}
					}
					answers = answers.sort(() => Math.random() - 0.5);
					rooms.get(roomId).set('currentAnswers', answers);
					resetLastResult(roomId);
					io.to(roomId).emit('NEW_QUESTION', {
						question: rooms.get(roomId).get("currentQuestion").preview,
						answers: answers,
						type: typeLabel[rooms.get(roomId).get('typeGame')]
					});
					let seconds = time;
					let x = setInterval(function () {
						seconds--;
						io.to(roomId).emit('SECONDS', seconds);
						if (seconds == 0  || (rooms.get(roomId)!=undefined && rooms.get(roomId).get('countAnswered') == rooms.get(roomId).get("users").size )) {
							clearInterval(x);
							const users = [...rooms.get(roomId).get('users').values()];
							let correctAnswer = "";
							switch (Number.parseInt(rooms.get(roomId).get('typeGame'))) {
								case 0:
									correctAnswer = rooms.get(roomId).get('currentQuestion').artists + " – " + rooms.get(roomId).get('currentQuestion').name;
									break;
								case 1:
									correctAnswer = rooms.get(roomId).get('currentQuestion').artists + " – " + rooms.get(roomId).get('currentQuestion').name;
									break;
								case 2:
									correctAnswer = rooms.get(roomId).get('currentQuestion').source;
									break;
								case 3:
									correctAnswer = rooms.get(roomId).get('currentQuestion').release;
									break;
								default:
									console.log('Warning');
							}

							io.to(roomId).emit('RESULT_QUESTION', {users: users, correctAnswer: correctAnswer, isEnd: rooms.get(roomId).get("round")==rooms.get(roomId).get("settings").count});
							setTimeout(()=>{
								if (rooms.get(roomId)) {
									let settings = rooms.get(roomId).get("settings");
									startGame(roomId, settings.playlist, settings.count, settings.time, settings.typeGame, settings.typeAnswer, settings.hints);
								}
							}, 5000)
						} else if(rooms.get(roomId)==undefined){
							clearInterval(x);
						}
					}, 1000);
				})
		} else {

		}

	}

	socket.on('START_GAME', ({ roomId, playlist, count, time, mode, typeGame, typeAnswer, hints }) => {
		if (!rooms.get(roomId).get('isStart')) {
			rooms.get(roomId).set("isStart", true);
			rooms.get(roomId).set("settings", {playlist: playlist, count: count, time: time, mode: mode, typeAnswer: typeAnswer, typeGame: typeGame, hints: hints});
			rooms.get(roomId).get('users').forEach((item, key)=> {
				rooms.get(roomId).get('users').set(key, {
					...item,
					hints: hints,
				})
			})
			io.to(roomId).emit('START_GAME');
			switch (mode) {
				case 0:
					startGame(roomId, playlist, count, time, typeGame, typeAnswer, hints);
				default:
					return 0;
			}
		}
	});

	const getIndexCorrectAnswer = (roomId, currentAnswers) => {
		let correctAnswer = getCorrectAnswer(roomId);
		let indexOfCorrect = 0;
		currentAnswers.forEach((item, index)=>{
			if (item.value == correctAnswer) indexOfCorrect = index;
		});
		return indexOfCorrect;
	}

	socket.on('GET_HINT_HALF_CORRECT', ({ roomId, sessionID }) => {
		if(rooms.get(roomId).get('users').get(sessionID).hints[0].isActive && !rooms.get(roomId).get('users').get(sessionID).hints[0].isUsed) {
			rooms.get(roomId).get('users').get(sessionID).hints[0].isUsed = true;
			let currentAnswers = rooms.get(roomId).get('currentAnswers');
			let setOfIndexes = new Set();
			setOfIndexes.add(getIndexCorrectAnswer(roomId, currentAnswers));
			while(setOfIndexes.size!=3)
				setOfIndexes.add(Math.round(0 - 0.5 + Math.random() * (5 - 0 + 1)));
			currentAnswers =  currentAnswers.map((item, index)=> {
				if (setOfIndexes.has(index))
					return {
						...item,
						isVisible: true,
					}
				return {
					...item,
					isVisible: false,
				}
			})
			io.to(socket.id).emit('HINT_HALF_CORRECT', currentAnswers);
			io.to(socket.id).emit('UPDATE_HINTS', rooms.get(roomId).get('users').get(sessionID).hints);
		}
	});

	socket.on('GET_HINT_MULTIPLIER', ({ roomId, sessionID }) => {
		if(rooms.get(roomId).get('users').get(sessionID).hints[1].isActive && !rooms.get(roomId).get('users').get(sessionID).hints[1].isUsed) {
			rooms.get(roomId).get('users').get(sessionID).hints[1].isUsed = true;
			rooms.get(roomId).get('users').get(sessionID).hints[1].multiplier = 2;
			io.to(socket.id).emit('UPDATE_HINTS', rooms.get(roomId).get('users').get(sessionID).hints);
		}
	});



	socket.on('LEAVE_THE_GAME', ({ roomId, sessionID }) => {
		if (rooms.get(roomId)!=undefined) {
			rooms.get(roomId).get('users').delete(sessionID);
			if (rooms.get(roomId).get('users').size == 0) rooms.delete(roomId);
		}
	});
});



