var fb = new Firebase("https://webrtc-onboard.firebaseio.com/connections");
var announceRef = fb.child('announce');
var messageRef = fb.child('messages');

var id = Date.now();
$('#pid').text(id);
var remote = null;
var sharedKey = $('#rid').val();
var running = false;

if (navigator.webkitGetUserMedia) {
  console.log("This appears to be Chrome");
} else {
  console.log("We're screwed!");
  // to support Firefox use "moz" as a prefix instead of webkit
}



// ANOUNCE
var announcePresence = function() {
  announceRef.remove(function() {
    announceRef.push({
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
    running = true;
    remote = data.id;

    initiateConnection();
    sendCandidates();

    pc.createOffer(function (offer) {
      pc.setLocalDescription(offer);
      sendMessage(offer);
      console.log('Sending offer to', remote);
      // console.log(JSON.stringify(offer));
      // fb.set({
      //   offer: offer
      // });
      // local = true;
    }, errorHandler, constraints);
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

// Firefox support
// var options = {
//     optional: [
//         {DtlsSrtpKeyAgreement: true},  // Chrome and Firefox to interperate
//         {RtpDataChannels: true}        // use DataChannels API on Firefox
//     ]
// }

var errorHandler = function (err) {
    console.error(err);
};

var constraints = null;
// var constraints = {
//     mandatory: {
//         OfferToReceiveAudio: true,
//         OfferToReceiveVideo: true
//     }
// };


var handleDataChannel = function(event) {
  event.channel.onmessage = handleMessage;
};

var handleError = function (err) {
  console.error("Channel Error: " + err);
};

var handleMessage = function(e) {
  console.log("Received message: " + e.data);
  $('#connections').append('<p><b>' + remote + ':</b> ' + e.data + '</p>');
};

var handleOpen = function() {
  console.info("Connection opened!");
  channel.send("Hello, my name is " + id);
};

var handleClose = function() {
  console.info("Other peer closed connection!");
};

var sendCandidates = function() {
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
      console.log('Sending candidate to', remote);
      sendMessage(candidate);
    }
    // send("icecandidate", JSON.stringify(e.candidate));
    // pc.onicecandidate = null;
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
    pc.ondatachannel = handleDataChannel;
  } catch (e) {
    console.error("Failed " + e.message)
  }

  channel = pc.createDataChannel("myConnection", channelOptions);
  
  channel.onerror = handleError;
  channel.onmessage = handleMessage;
  channel.onopen = handleOpen;
  channel.onclose = handleClose;
}









messageRef.child(id).on('child_added', function(snapshot){
  var data = snapshot.val();
  console.log("MESSAGE", data.type, "from", data.sender);
  switch (data.type) {
    // Remote client handles WebRTC request
    case 'offer':
      running = true;
      remote = data.sender;
      initiateConnection();
      // Data Channel stuff
      //send cadidates
      sendCandidates();
      pc.setRemoteDescription(new RTCSessionDescription(data));//, function(){
      pc.createAnswer(function (answer) {
        pc.setLocalDescription(answer);
        sendMessage(answer);
        console.warn("Sending answer to", data.sender);
      }, errorHandler, constraints);  
      // });
      break;
    // Answer response to our offer we gave to remote client
    case 'answer':
      pc.setRemoteDescription(new RTCSessionDescription(data));
      break;
    // ICE candidate notification from remote client
    case 'candidate':
      if(running) pc.addIceCandidate(new RTCIceCandidate(data));
      break;
  }

});



announcePresence();


$('#send').submit(function(e) {
  e.preventDefault();
  var msg = $('#text').val();
  channel.send(msg);
  $('#connections').append('<p><b>You: </b>' + msg + '</p>');
})


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

