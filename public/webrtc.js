var fb = new Firebase("https://webrtc-onboard.firebaseio.com/connections");
var announceRef = fb.child('announce');
var messageRef = fb.child('messages');


var id = Date.now();
$('#pid').text(id);
$('#call')[0].disabled = true;
var remote = null;
var sharedKey = $('#rid').val();
var chatRef = fb.child('chat').child(sharedKey);
// var running = false;
var localStream = null;
var remoteStream = null;

if (navigator.webkitGetUserMedia) {
  console.log("This appears to be Chrome");
} else {
  console.log("We're screwed!");
  // to support Firefox use "moz" as a prefix instead of webkit
}



// ANOUNCE
// What happens when sharedKey changes for WebRTC?
var announceChild = null;
var announcePresence = function() {
  announceRef.remove(function() {
    announceChild = announceRef.push({
      sharedKey: sharedKey, 
      id: id
    });
  });
  console.log("Announced:", {
    sharedKey: sharedKey, 
    id: id
  });
};

announceRef.on('child_added', function(snapshot){
  var data = snapshot.val();
  if(data.sharedKey === sharedKey && data.id !== id){
    console.log("Matched with", data.id);
    remote = data.id;

    // $('#call')[0].disabled = false;
    beginWebRTC(pc1);
    // sendMessage(localStream);
    // console.log('SENDING stream to' + remote);

    // TODO: let them know we're matched on Firebase
  }
});



// SENDING MESSAGES
var sendMessage = function(message) {
  message.sender = id;
  messageRef.child(remote).push(message);
}



var config = {
  iceServers: [
    // {url: "stun:23.21.150.121"},
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



// CONNECTION
var pc1 = null;
var pc2 = null;
var channel = null;

// Options are not well supported on Chrome yet
var channelOptions = {};
// var channelOptions = {
//   ordered: false, // do not guarantee order
//   maxRetransmitTime: 3000, // in milliseconds
// };

var initiateConnection = function() {
  try {
    pc1 = new webkitRTCPeerConnection(config);
    pc2 = new webkitRTCPeerConnection(config);
  } catch (e) {
    console.error("Failed " + e.message)
  }

  pc1.onaddstream = handleAddStream;
  pc2.onaddstream = handleAddStream;
  // pc1.onremotestream = function(e) {
  //   console.log('onremotestream');
  //   $('#remoteVideo')[0].src = URL.createObjectURL(e.stream); 
  // };

  pc1.onicecandidatestatechange = handleIceCandidateStateChange(pc1);
  pc2.onicecandidatestatechange = handleIceCandidateStateChange(pc2);

  pc1.onicecandidate = function(e) { 
    handleIceCandidate(e, pc1, true);
  };
  pc2.onicecandidate = function(e) {
    handleIceCandidate(e, pc2, false);
  };
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
}

var handleIceCandidate = function(e, peerConnection, incoming) {
  // candidate exists in e.candidate
  // console.warn(pc);
  var candidate = e.candidate;
  if(candidate){
    // console.warn(candidate);
    candidate.type = 'candidate';
    candidate.incoming = incoming;
    console.log('SENDING candidate onicecandidate(e) to', remote);
    sendMessage(candidate);
  }
  // send only the first candidate
  peerConnection.onicecandidate = null;
}


  announcePresence();
  initiateConnection();

navigator.webkitGetUserMedia({
  "audio": true,
  "video": true
}, function (stream){


  // TODO: What if connection isn't ready yet??
  pc1.addStream(stream);
  $('#localVideo')[0].src = URL.createObjectURL(stream);
  console.log(stream);

  localStream = stream;
  localStream.type = 'stream';
}, function(e){
  console.error(e);
});






var beginWebRTC = function(peerConnection){
  peerConnection.createOffer(function (offer) {
    console.log('SENDING offer setLocalDescription(offer) to', remote);
    peerConnection.setLocalDescription(offer);
    sendMessage(offer);
  }, errorHandler, constraints);
}

messageRef.child(id).on('child_added', function(snapshot){
  var data = snapshot.val();
  // console.log(id, data.sender);
  // console.log("MESSAGE", data.type, "from", data.sender);
  switch (data.type) {
    // Remote client handles WebRTC request
    case 'offer':
      // running = true;
      remote = data.sender;

      console.log("RECEIVED offer setRemoteDescription(offer)", "from", data.sender);
      pc2.setRemoteDescription(new RTCSessionDescription(data));//, function(){
      pc2.createAnswer(function (answer) {
        console.log("SENDING answer setLocalDescription(answer)", "to", data.sender);
        pc2.setLocalDescription(answer);
        sendMessage(answer);
        // console.warn("Sending answer to", data.sender);
      }, errorHandler, constraints);
      // });
      break;
    // Answer response to our offer we gave to remote client
    case 'answer':
      console.log("RECEIVED answer setRemoteDescription(answer)", "from", data.sender);
      pc1.setRemoteDescription(new RTCSessionDescription(data));
      break;
    // ICE candidate notification from remote client
    case 'candidate':
      // if(running) 
      console.log("RECEIVED candidate addIceCandidate(candidate)", "from", data.sender);
      // pc1 = outgoing
      // pc2 = incoming
      if(data.incoming){
        pc2.addIceCandidate(new RTCIceCandidate(data));
      } else {
        pc1.addIceCandidate(new RTCIceCandidate(data));
      }
      break;
    case 'leave':
      console.warn("LEAVING>........");
      pc1.close();
      pc2.close();

      // set to null
      // pc1 = null;
      // pc2 = null;
      initiateConnection();
      // console.log("..RECEIVED stream addStream(stream)", "from", data.sender);
      // pc2.addStream(data);
      // console.log("received stream....");
      break;
  }

});


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
  // TODO: send Firebase to close
  sendMessage({type: 'leave'});

  pc1.close();
  pc2.close();
  // announceChild.remove();
};

// var RTCPeerConnection = null;
// var getUserMedia = null;
// var attachMediaStream = null;
// var reattachMediaStream = null;

// // ?????????
// // Attach a media stream to an element. 
// attachMediaStream = function(element, stream) {
//   if (typeof element.srcObject !== 'undefined') {
//     element.srcObject = stream;
//   } else if (typeof element.mozSrcObject !== 'undefined') {
//     element.mozSrcObject = stream;
//   } else if (typeof element.src !== 'undefined') {
//     element.src = URL.createObjectURL(stream);
//   } else {
//     console.log('Error attaching stream to element.');
//   }
// };

// // ?????????
// reattachMediaStream = function(to, from) {
//   to.src = from.src;
// };

