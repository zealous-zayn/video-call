
const socket = io("/videocall",{transports:['websocket']},{secure: true});
const videoGrid = document.getElementById("video-grid");
const myVideo = document.createElement("video");
const showChat = document.querySelector("#showChat");
const backBtn = document.querySelector(".header__back");
myVideo.muted = true;
let cfg = {
	id 					: null,
	localStream			: null,
	RTCP_options 		: [{
    urls: ["stun:eu-turn4.xirsys.com","stun:stun.services.mozilla.com","stun:stun.l.google.com:19302"]
},
{
    username: "ml0jh0qMKZKd9P_9C0UIBY2G0nSQMCFBUXGlk6IXDJf8G2uiCymg9WwbEJTMwVeiAAAAAF2__hNSaW5vbGVl",
    credential: "4dd454a6-feee-11e9-b185-6adcafebbb45",
    urls: [
        "turn:eu-turn4.xirsys.com:80?transport=udp",
        "turn:eu-turn4.xirsys.com:3478?transport=tcp"
    ]
}],
	name				: null
};
backBtn.addEventListener("click", () => {
  document.querySelector(".main__left").style.display = "flex";
  document.querySelector(".main__left").style.flex = "1";
  document.querySelector(".main__right").style.display = "none";
  document.querySelector(".header__back").style.display = "none";
});

showChat.addEventListener("click", () => {
  document.querySelector(".main__right").style.display = "flex";
  document.querySelector(".main__right").style.flex = "1";
  document.querySelector(".main__left").style.display = "none";
  document.querySelector(".header__back").style.display = "block";
});

const user = prompt("Enter your name");
socket.on('connect',()=>{
  cfg.id = socket.id;
  cfg.name = user;
  console.log(cfg.name)
  socket.emit('publishPresence',{"peerName":cfg.name});
  console.info(cfg.id,' : connected....');

});
socket.on('newPeer', function(data) {
  console.log('newPeer : ',data);
  if(data.peerId != cfg.id)
  $('#contactList').append('<option id='+data.peerId+' value="'+data.peerId+'">'+data.peerName+'</option>');
});
socket.on('peerDisconnect', function(data) {
    console.log('peerDisconnect ',data);
    //$('#'+_getId(data.peerId)).remove();
});
socket.on('terminate', function(data) {
    console.log('terminate request from : '+data.peer_id);
  pc.hangupfrom = 'remote';
  pc.close();
});
socket.on('peerList',function(data) {
  console.log('peerList : ',data);
    for(let i in data){
      if(cfg.id != i){
      $('#contactList').append('<option id='+i+' value="'+i+'">'+data[i]+'</option>');
      }
    }
});
socket.on('incomingCall', function(data) {
    var fromUser = data.fromUser;
    console.log('Incoming 100  INVITE');
    setPC(fromUser, function() {
      console.log("set pc incoming")
      socket.emit('readyForCall',{"toUser":fromUser});
        console.log('Outgoing 180 READY ', fromUser);
    });
});
socket.on('readyForCall', function(data) {
  console.log('Incoming 180 READY',data);
    var fromUser = data.fromUser;
    _createOffer(fromUser);
});
socket.on('inviteICE',function(data) {
  console.log('incoming ICE ',data.ice_candidate);
  var ice = data.ice_candidate;
  var fromUser = data.peer_id;
  pc.addIceCandidate(new RTCIceCandidate(ice)).catch(errorHandler);
});
socket.on('inviteSDP', function(data) {
  console.log('Incoming inviteSDP \n',data.sdp.sdp);
    pc.setRemoteDescription(new RTCSessionDescription(data.sdp)).then(function() {
        if(data.sdp.type == 'offer') {
            pc.createAnswer().then(function(description){
              console.log('createAnswer() success');
          pc.setLocalDescription(description).then(function() {
              socket.emit('inviteSDP',{'sdp': pc.localDescription, 'peer_id':data.peer_id});
              console.log('Outgoing inviteSDP ANSWER',pc.localDescription,' : ',data.peer_id);
          }).catch(errorHandler);	            	
            }).catch(errorHandler);
        }
    }).catch(errorHandler);	
});
navigator.mediaDevices
  .getUserMedia({
    audio: true,
    video: true,
  })
  .then((stream) => {
    cfg.localStream = stream;
    addVideoStream(myVideo, stream);

  });

  function _getId(e){
    return e.replace('/videocall#','');
  }
  function signalInvite(user){
    setPC(user, function(pc) {
      console.log('Sending Invite Signal to '+user);
      socket.emit('incomingCall',{"toUser": user});
      console.log('Outgoing 100 INVITE');
    });
  }
  /* Media functions */
  function setPC(User, cb){
      pc = new RTCPeerConnection({ 'iceServers': cfg.RTCP_options });
      pc.hangupfrom = null;
      remoteSocket = User;
      pc.onicecandidate = function(event){ // ICE genarated
      if (!event || !event.candidate) return;
      console.log('sending ICE to ',User,'\n',event.candidate);
        socket.emit('inviteICE', {
            'peer_id': User,
            'ice_candidate':  event.candidate
        });
      };
      cfg.localStream.getTracks().forEach(e=>{
        pc.addTrack(e,cfg.localStream);
      })
      pc.onaddstream = function(event) {
          console.log("Got Remote Steam ", event);
          const video = document.createElement("video");
          addVideoStream(video, event.stream);   
      };
      pc.oniceconnectionstatechange = function(e){
        var iceState = this.iceConnectionState;
        console.log('oniceconnectionstatechange : ',iceState);
        if(iceState == "disconnected" && pc.hangupfrom == null){ // this comes if disconnect is from remote
          pc.hangupfrom = 'remote';
          pc.close();
        }
        if(iceState == "closed" && pc.hangupfrom == null){ // this comes if disconnect is from local
          pc.hangupfrom = 'local';
        }
      };
      pc.onremovestream = function(e){
        console.log('onremovestream \n',e);	
      };
      pc.onsignalingstatechange = function(e){
        var signalState = pc.signalingState;
        console.log('onsignalingstatechange pc is :'+ signalState);
        if(signalState == 'closed'){
          pc = null;
        }
      };
      console.log('RTCPeerConnection pc success: \n',pc);
      cb(pc);
  }
  function _createOffer(toUser){
    console.log('_createOffer started...',toUser);
    pc.createOffer().then(function(description){
      console.log('createOffer() Success');
        pc.setLocalDescription(description).then(function() {
            socket.emit('inviteSDP',{'sdp': pc.localDescription, 'peer_id': toUser}); // doubt
            console.log('Outgoing inviteSDP OFFER \n',pc.localDescription.sdp,' : ',toUser);
        }).catch(errorHandler);		
    }).catch(errorHandler);
  }
  function errorHandler(error) {
      console.warn('errorHandler ',error);
  }
  


const addVideoStream = (video, stream) => {
  video.srcObject = stream;
  video.addEventListener("loadedmetadata", () => {
    video.play();
    videoGrid.append(video);
  });
};

let text = document.querySelector("#chat_message");
let send = document.getElementById("send");
let messages = document.querySelector(".messages");

send.addEventListener("click", (e) => {
  if (text.value.length !== 0) {
    const peerBlegId = $('#contactList option:selected').val();
    socket.emit("message", {peer_id:peerBlegId,message:text.value,user: user});
    messages.innerHTML =
    messages.innerHTML +
    `<div class="message">
        <b><i class="far fa-user-circle"></i> <span>Me</span> </b>
        <span>${text.value}</span>
    </div>`;
    text.value = "";
  }
});

text.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && text.value.length !== 0) {
    socket.emit("message", text.value);
    text.value = "";
  }
});

const inviteButton = document.querySelector("#inviteButton");
const muteButton = document.querySelector("#muteButton");
const stopVideo = document.querySelector("#stopVideo");
muteButton.addEventListener("click", () => {
  const enabled = cfg.localStream.getAudioTracks()[0].enabled;
  if (enabled) {
    cfg.localStream.getAudioTracks()[0].enabled = false;
    html = `<i class="fas fa-microphone-slash"></i>`;
    muteButton.classList.toggle("background__red");
    muteButton.innerHTML = html;
  } else {
    cfg.localStream.getAudioTracks()[0].enabled = true;
    html = `<i class="fas fa-microphone"></i>`;
    muteButton.classList.toggle("background__red");
    muteButton.innerHTML = html;
  }
});

stopVideo.addEventListener("click", () => {
  const enabled = cfg.localStream.getVideoTracks()[0].enabled;
  if (enabled) {
    cfg.localStream.getVideoTracks()[0].enabled = false;
    html = `<i class="fas fa-video-slash"></i>`;
    stopVideo.classList.toggle("background__red");
    stopVideo.innerHTML = html;
  } else {
    cfg.localStream.getVideoTracks()[0].enabled = true;
    html = `<i class="fas fa-video"></i>`;
    stopVideo.classList.toggle("background__red");
    stopVideo.innerHTML = html;
  }
});

inviteButton.addEventListener("click", (e) => {
  const peerBlegId = $('#contactList option:selected').val();
		//const peerBlegName = $('#contactList option:selected').text();
		if(peerBlegId){
			signalInvite(peerBlegId);
		}
});

socket.on("createMessage", (data) => {
  console.log(data)
  messages.innerHTML =
    messages.innerHTML +
    `<div class="message">
        <b><i class="far fa-user-circle"></i> <span> ${
          cfg.id === data.peer_id ? "me" : data.userName
        }</span> </b>
        <span>${data.msg}</span>
    </div>`;
});
