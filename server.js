var express = require('express'),
	app = express(),
	fs = require('fs'),
	port = 8080,
	http = require('http'),
	// refer http://stackoverflow.com/questions/5998694/how-to-create-an-https-server-in-node-js for Https in node
 	// privateKey  = fs.readFileSync(__dirname+'/ssl/myCA.key', 'utf8'),
	// certificate = fs.readFileSync(__dirname+'/ssl/myCA.pem', 'utf8'),
	// credentials = {key: privateKey, cert: certificate},
	httpsServer = http.createServer(app),
	io = require('socket.io')(httpsServer);
	app.set("view engine", "ejs")
var onlineClients = {}; // maintain all online clients here
var ioVcall = io.of('/videocall'); // create a separate name space for videocall

io.use('transports', ['websocket']); //'flashsocket', 'htmlfile', 'xhr-polling', 'jsonp-polling'

ioVcall.on('connection',function(socket){
		console.log(socket.id+" : on Video server");
		socket.on('publishPresence',function(data){
			console.log('publishPresence',data);
			ioVcall.emit('newPeer',{'peerId':socket.id,'peerName':data.peerName});
			socket.emit('peerList',onlineClients);
			onlineClients[socket.id] = data.peerName;
		});
		socket.on('disconnect',function() {
		    console.log('disconnect : ',socket.id);
		    ioVcall.emit('peerDisconnect',{'peerId':socket.id});
		    delete onlineClients[socket.id];
		});
		socket.on('terminate', function(data) {
			var toUser = data.peer_id;
			console.log('terminate event from '+socket.id+' ---> '+toUser);
			ioVcall.to(toUser).emit('terminate',{'peer_id':socket.id}); 
		});
		socket.on('incomingCall', function(data) {
		    var toUser = data.toUser;
		   	console.log('incomingCall to '+toUser);
		   	ioVcall.to(toUser).emit('incomingCall',{'fromUser':socket.id});
		});
		socket.on('readyForCall', function(data) {
		    var toUser = data.toUser;
		    console.log('readyForCall to : ',toUser);
		   ioVcall.to(toUser).emit('readyForCall',{'fromUser':socket.id});
		});
		socket.on('inviteICE',function(data) {
			var toUser = data.peer_id;
			var ice = data.ice_candidate;
			ioVcall.to(toUser).emit('inviteICE',{'peer_id':socket.id, 'ice_candidate':ice});
			console.log('Sending ICE to '+toUser+' from '+socket.id);
		});
		socket.on('inviteSDP', function(data) {
		    console.log('------> INVITE SDP To : '+data.peer_id);
		    ioVcall.to(data.peer_id).emit('inviteSDP',{'peer_id':socket.id,'sdp':data.sdp});
		});
    socket.on("message", (data) => {
      ioVcall.to(data.peer_id).emit("createMessage", {msg : data.message, 'peer_id':socket.id, userName : data.user});
    });
	});
	ioVcall.on("connect_error", (err) => {
		console.log(`connect_error due to ${err.message}`);
	  });
process.on('uncaughtException', function (err) {
  console.error(err.stack);
  console.log("Node error");
});

httpsServer.listen(port,function(){ // you can use any port
    console.log('https on '+port);
});
app.use(express.static("public"));
app.get("/", (req, res) => {
	res.render(`room`);
  });
