var RTCPeerConnection = null;
var getUserMedia = null;
var attachMediaStream = null;
var reattachMediaStream = null;

var fb = new Firebase("https://webrtc-onboard.firebaseio.com/connections");

if (navigator.webkitGetUserMedia) {
  console.log("This appears to be Chrome");
} else {
  console.log("We're screwed!");
  // to support Firefox use "moz" as a prefix instead of webkit
}

var config = {
  iceServers: [
    {url: "stun:23.21.150.121"},
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

var pc = new webkitRTCPeerConnection(config);
window.lc = pc;
var pcRef = null;
var pcID = null;
var local = null;

pc.onicecandidate = function(e) {
  // candidate exists in e.candidate
  if(e.candidate == null) { return; }
  // send("icecandidate", JSON.stringify(e.candidate));
  // pcRef = fb.push({
  fb.set({
    icecandidate: JSON.stringify(e.candidate)
  });
  // pcID = pcRef.key();

  console.log(JSON.stringify(e.candidate));
  pc.onicecandidate = null;
}


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


fb.child("offer").on("value", function(snapshot) {
  if(local){
    local = false;
    return;
  }
  var offer = snapshot.val();
  console.log("Got offer:");
  console.log(offer);

  offer = new RTCSessionDescription(offer);
  pc.setRemoteDescription(offer, function(){
    pc.createAnswer(function (answer) {
      ps.setLocalDescription(answer);
      console.warn("Answer!");
      fb.set({
        answer: answer
      })
    }, errorHandler, constraints);
  });


});


// Options are not well supported on Chrome yet
var channelOptions = {};
// var channelOptions = {
//   ordered: false, // do not guarantee order
//   maxRetransmitTime: 3000, // in milliseconds
// };

// can wrap around try/catch block
var channel = pc.createDataChannel("Shervin", channelOptions);

channel.onerror = function (err) {
  console.error("Channel Error:", err);
};

channel.onmessage = function(e) {
  console.log("Got message:", e.data);
};

channel.onopen = function() {
  console.info("Connection opened!");
};

channel.onclose = function() {
  console.info("Other peer closed connection!");
};



pc.createOffer(function (offer) {
  pc.setLocalDescription(offer);
  console.log(offer);
  console.log(JSON.stringify(offer));
  fb.set({
    offer: offer
  });
  local = true;
}, errorHandler, constraints);


// ?????????
// Attach a media stream to an element. 
attachMediaStream = function(element, stream) {
  if (typeof element.srcObject !== 'undefined') {
    element.srcObject = stream;
  } else if (typeof element.mozSrcObject !== 'undefined') {
    element.mozSrcObject = stream;
  } else if (typeof element.src !== 'undefined') {
    element.src = URL.createObjectURL(stream);
  } else {
    console.log('Error attaching stream to element.');
  }
};

// ?????????
reattachMediaStream = function(to, from) {
  to.src = from.src;
};




function trace(text) {
  // This function is used for logging.
  if (text[text.length - 1] == '\n') {
    text = text.substring(0, text.length - 1);
  }
  console.log((performance.now() / 1000).toFixed(3) + ": " + text);
}