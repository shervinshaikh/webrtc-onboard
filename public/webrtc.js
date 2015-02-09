var fb = new Firebase("https://webrtc-onboard.firebaseio.com/connections");
var announceRef = fb.child('announce');
var messageRef = fb.child('messages');

var sharedKey = $('#rid').val();
var chatRef = fb.child('chat').child(sharedKey);

var id = Date.now();
var remoteId = null;
var localStream = null;
var remoteStream = null;
$('#pid').text(id);

if (navigator.webkitGetUserMedia) {
  console.log("This appears to be Chrome");
} else {
  console.log("We're screwed!");
  // to support Firefox use "moz" as a prefix instead of webkit
}



// ANOUNCE
// TODO: What happens when sharedKey changes for WebRTC?
var announceChild = null;
var announcePresence = function() {
  announceChild = announceRef.push({
    sharedKey: sharedKey, 
    id: id
  });
  console.log("Announced:", {
    sharedKey: sharedKey, 
    id: id
  });

  navigator.webkitGetUserMedia({
    "audio": true,
    "video": true
  }, function (stream){
    $('#localVideo')[0].src = URL.createObjectURL(stream);
    localStream = stream;
    beginWebRTC(outgoingPC);
  }, function(e){
    console.error(e);
  });
};

announceRef.on('child_added', function(snapshot){
  var data = snapshot.val();
  if(data.sharedKey === sharedKey && data.id !== id){
    console.log("Matched with", data.id);
    remoteId = data.id;

    beginWebRTC(outgoingPC);
  }
});



// SENDING MESSAGES
var sendMessage = function(message) {
  message.sender = id;
  messageRef.child(remoteId).push(message);
}


// CONNECTION
var config = {
  iceServers: [
    {url: "stun:23.21.150.121"},
    {url: "stun:stun.l.google.com:19302"}
  ]
};

var errorHandler = function (err) {
    console.error(err);
};

var constraints = {
    mandatory: {
        OfferToReceiveAudio: true,
        OfferToReceiveVideo: true
    }
};


var outgoingPC = null;
var incomingPC = null;
var channel = null;
var isConnectionReady = false;

// Options are not well supported on Chrome yet
var channelOptions = {};
// var channelOptions = {
//   ordered: false, // do not guarantee order
//   maxRetransmitTime: 3000, // in milliseconds
// };

var initiateConnection = function() {
  try {
    outgoingPC = new webkitRTCPeerConnection(config);
    incomingPC = new webkitRTCPeerConnection(config);
  } catch (e) {
    console.error("Failed " + e.message);
    return;
  }

  outgoingPC.onaddstream = handleAddStream;
  incomingPC.onaddstream = handleAddStream;

  outgoingPC.onicecandidatestatechange = handleIceCandidateStateChange(outgoingPC);
  incomingPC.onicecandidatestatechange = handleIceCandidateStateChange(incomingPC);

  outgoingPC.onicecandidate = function(e) { 
    handleIceCandidate(e, outgoingPC, true);
  };
  incomingPC.onicecandidate = function(e) {
    handleIceCandidate(e, incomingPC, false);
  };

  isConnectionReady = true;
  beginWebRTC(outgoingPC);
}

var handleAddStream = function(e) {
  console.log('REMOTE stream coming in!');
  console.log(e.stream);
  $('#remoteVideo')[0].src = URL.createObjectURL(e.stream); 
};

var handleIceCandidateStateChange = function(peerConnection) {
  if(peerConnection.iceConnectionState === 'disconnected'){
    console.log('Client disconnected');
    announcePresence();
  }
};

var handleIceCandidate = function(e, peerConnection, incoming) {
  // candidate exists in e.candidate
  // console.warn(pc);
  var candidate = e.candidate;
  if(candidate){
    // console.warn(candidate);
    candidate.type = 'candidate';
    candidate.incoming = incoming;
    console.log('SENDING candidate onicecandidate(e) to', remoteId);
    sendMessage(candidate);
  }
  // send only the first candidate
  peerConnection.onicecandidate = null;
};

var onSdpSuccess = function(e){
  console.log('sdp success');
};

var onSdpFailure = function(e) {
  console.error(e);
};






var beginWebRTC = function(peerConnection){
  if(localStream === null || !isConnectionReady || remoteId === null){
    // everything is not ready yet so return
    return;
  }
  outgoingPC.addStream(localStream);

  peerConnection.createOffer(function (offer) {
    console.log('SENDING offer setLocalDescription(offer) to', remoteId);
    peerConnection.setLocalDescription(offer, onSdpSuccess, onSdpFailure);
    sendMessage(offer);
  }, errorHandler, constraints);
}

messageRef.child(id).on('child_added', function(snapshot){
  var data = snapshot.val();
  // console.log("MESSAGE", data.type, "from", data.sender);
  switch (data.type) {
    // Remote client handles WebRTC request
    case 'offer':
      remoteId = data.sender;

      console.log("RECEIVED offer setRemoteDescription(offer)", "from", data.sender);
      var sdp = new RTCSessionDescription(data)
      incomingPC.setRemoteDescription(sdp, onSdpSuccess, onSdpFailure);

      incomingPC.createAnswer(function (answer) {
        console.log("SENDING answer setLocalDescription(answer)", "to", data.sender);
        incomingPC.setLocalDescription(answer, onSdpSuccess, onSdpFailure);
        sendMessage(answer);
      }, errorHandler, constraints);
      break;
    // Answer response to our offer we gave to remote client
    case 'answer':
      console.log("RECEIVED answer setRemoteDescription(answer)", "from", data.sender);
      var sdp = new RTCSessionDescription(data);
      outgoingPC.setRemoteDescription(sdp, onSdpSuccess, onSdpFailure);
      break;
    // ICE candidate notification from remote client
    case 'candidate':
      console.log("RECEIVED candidate addIceCandidate(candidate)", "from", data.sender);
      if(data.incoming){
        incomingPC.addIceCandidate(new RTCIceCandidate(data));
      } else {
        outgoingPC.addIceCandidate(new RTCIceCandidate(data));
      }
      break;
    case 'leave':
      console.warn("End call...");
      $('#remoteVideo')[0].src = "";

      outgoingPC.close();
      incomingPC.close();

      remoteId = null;
      initiateConnection();
      break;
  }

});


// CHAT - sending/receiving messages through Firebase
$('#send').submit(function(e) {
  e.preventDefault();
  var msg = $('#text').val();
  // channel.send(msg);
  console.log(msg);
  chatRef.push({
    sender: id,
    text: msg
  });
});

var childAdded = chatRef.on('child_added', function(snapshot) {
  var data = snapshot.val();
  $('#messages').append('<p><b>' + data.sender + ': </b>' + data.text + '</p>');
});

$('#connect').click(function(){
  console.log('click');
  sharedKey = $('#rid').val();
  chatRef.off('child_added', childAdded);
  $('#messages').empty();
  $('#connections').empty();

  chatRef = fb.child('chat').child(sharedKey);
  childAdded = chatRef.on('child_added', function(snapshot) {
    var data = snapshot.val();
    $('#messages').append('<p><b>' + data.sender + ': </b>' + data.text + '</p>');
  });
  announcePresence();
});

$('#clear').click(function(){
  chatRef.remove();
  $('#messages').empty();
});




window.onbeforeunload = function(e) {
  // TODO: getUserMedia failes when Firebase doesn't have any announcements
  sendMessage({type: 'leave'});

  outgoingPC.close();
  incomingPC.close();
  announceChild.remove();
};


announcePresence();
initiateConnection();