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

if (navigator.webkitGetUserMedia) {
  console.log("This appears to be Chrome");
} else {
  console.log("We're screwed!");
  // to support Firefox use "moz" as a prefix instead of webkit
}



// ANOUNCE
var announceChild = null;
var announcePresence = function() {
  console.log(sharedKey);
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

var first = true;
announceRef.on('child_added', function(snapshot){
  // if(first){
  //   first = false;
  //   return;
  // }
  var data = snapshot.val();
  console.log(data);
  if(data.sharedKey === sharedKey && data.id !== id){
    console.log("Matched with", data.id);
    // running = true;
    remote = data.id;

    // $('#call')[0].disabled = false;
    beginWebRTC();
    sendMessage(localStream);
    console.log('SENDING stream to' + remote);


    // let them know we're matched

  }
});



// SENDING MESSAGES
var sendMessage = function(message) {
  message.sender = id;
  messageRef.child(remote).push(message);
}



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


var beginWebRTC = function(){
  // initiateConnection();
  // sendCandidates();

  // pc.addStream(localStream);
  pc.createOffer(function (offer) {
    console.log('SENDING offer setLocalDescription(offer) to', remote);
    pc.setLocalDescription(offer);
    sendMessage(offer);
  }, errorHandler, constraints);
}

var sendCandidates = function() {
  pc.onaddstream = function(e) {
    console.log('REMOTE stream coming in!');
    console.log(e.stream);
    $('#remoteVideo')[0].src = URL.createObjectURL(e.stream); 
  };
  // pc.onremotestream = function(e) {
  //   console.log('onremotestream');
  //   $('#remoteVideo')[0].src = URL.createObjectURL(e.stream); 
  // };

  pc.onicecandidatestatechange = function() {
    if(pc.iceConnectionState === 'disconnected'){
      console.log('Client disconnected');
      announcePresence();
    }
  }

  pc.onicecandidate = function(e) {
    // candidate exists in e.candidate
    var candidate = e.candidate;
    if(candidate){
      candidate.type = 'candidate';
      console.log('SENDING candidate onicecandidate(e) to', remote);
      sendMessage(candidate);
    }
    // send("icecandidate", JSON.stringify(e.candidate));
    // send only the first candidate
    pc.onicecandidate = null;
  }
}

// CONNECTION
var pc = null;
var channel = null;

// Options are not well supported on Chrome yet
var channelOptions = {};
// var channelOptions = {
//   ordered: false, // do not guarantee order
//   maxRetransmitTime: 3000, // in milliseconds
// };

var initiateConnection = function() {
  try {
    pc = new webkitRTCPeerConnection(config);
  } catch (e) {
    console.error("Failed " + e.message)
  }
}

announcePresence();
// $('#start').click(function(){
navigator.webkitGetUserMedia({
  "audio": true,
  "video": true
}, function (stream){
  initiateConnection();
  sendCandidates();

  // pc.onaddstream({stream: stream});
  pc.addStream(stream);
  $('#localVideo')[0].src = URL.createObjectURL(stream);
  console.log(stream);

  // beginWebRTC();
  // pc.addStream(stream);

  localStream = stream;
  localStream.type = 'stream';
}, function(e){
  console.error(e);
});
// });


$('#call').click(function(){
  // announcePresence();
  beginWebRTC();
  sendMessage(localStream);
  console.log('SENDING stream to' + remote);
});






messageRef.child(id).on('child_added', function(snapshot){
  var data = snapshot.val();
  // console.log(id, data.sender);
  // console.log("MESSAGE", data.type, "from", data.sender);
  switch (data.type) {
    // Remote client handles WebRTC request
    case 'offer':
      // running = true;
      remote = data.sender;

      initiateConnection();
      sendCandidates();

      console.log("RECEIVED offer setRemoteDescription(offer)", "from", data.sender);
      pc.setRemoteDescription(new RTCSessionDescription(data));//, function(){
      pc.createAnswer(function (answer) {
        console.log("SENDING answer setLocalDescription(answer)", "to", data.sender);
        pc.setLocalDescription(answer);
        sendMessage(answer);
        // console.warn("Sending answer to", data.sender);
      }, errorHandler, constraints);  
      // });
      break;
    // Answer response to our offer we gave to remote client
    case 'answer':
      console.log("RECEIVED answer setRemoteDescription(answer)", "from", data.sender);
      pc.setRemoteDescription(new RTCSessionDescription(data));
      break;
    // ICE candidate notification from remote client
    case 'candidate':
      // if(running) 
      console.log("RECEIVED candidate addIceCandidate(candidate)", "from", data.sender);
      pc.addIceCandidate(new RTCIceCandidate(data));
      break;
    case 'stream':
      console.log("..RECEIVED stream addStream(stream)", "from", data.sender);
      pc.addStream(data);
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
  pc.close();
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

