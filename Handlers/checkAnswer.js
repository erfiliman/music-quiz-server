const CheckAnswer = ({ roomId, answer, time, sessionID }) => {
    let correctAnswer;
    let fixLength = 0.4;
    switch (Number.parseInt(rooms.get(roomId).get('typeGame'))) {
        case 0:
            correctAnswer = rooms.get(roomId).get('currentQuestion').artists;
            break;
        case 1:
            correctAnswer = rooms.get(roomId).get('currentQuestion').name;
            break;
        case 2:
            correctAnswer = rooms.get(roomId).get('currentQuestion').source;
            break;
        case 3:
            correctAnswer = rooms.get(roomId).get('currentQuestion').release;
            break;
        default:
            console.log("Warning");
    }
    rooms.get(roomId).set("countAnswered", rooms.get(roomId).get("countAnswered") +1);
    if (rooms.get(roomId).get('typeGame') == 3) {
        if (answer == correctAnswer) {
            let previousPoint = rooms.get(roomId).get('users').get(sessionID).points;
            let username = rooms.get(roomId).get('users').get(sessionID).username;
            let avatar = rooms.get(roomId).get('users').get(sessionID).avatar;
            let lastResult = Math.round((time/rooms.get(roomId).get("Settings").time)*550);
            rooms.get(roomId).get('users').set(sessionID, {username: username, points: previousPoint+lastResult, lastResult: lastResult, avatar: avatar});
        }
    } else if (levenshtein.get(answer, correctAnswer) < correctAnswer.length * fixLength) {
        let previousPoint = rooms.get(roomId).get('users').get(sessionID).points;
        let username = rooms.get(roomId).get('users').get(sessionID).username;
        let avatar = rooms.get(roomId).get('users').get(sessionID).avatar;
        let lastResult = Math.round((time/rooms.get(roomId).get("Settings").time)*550);
        rooms.get(roomId).get('users').set(sessionID, {username: username, points: previousPoint+lastResult, lastResult: lastResult, avatar: avatar});
    }
};

export default CheckAnswer;