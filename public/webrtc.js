angular.module('Hermes', []).controller('videoChatController', function($scope, $location) {
  $scope.inVideoChat = false;

  var loc = $location.search();
  // Room ID
  $scope.roomID = Math.random().toString(36).substr(2, 12);
  if(loc.roomID){
    console.log(loc.roomID);
    $scope.roomID = loc.roomID;
  } else {
    $location.search('roomID', $scope.roomID);
  }

  var fb, announceRef, messageRef, chatRef = null;
  fb = new Firebase("https://webrtc-onboard.firebaseio.com/connections/" + $scope.roomID);
  announceRef = fb.child('announce');
  messageRef = fb.child('messages');

  var id = Date.now() % 1000000;
  var remoteId, localStream, remoteStream = null;
  var stringId = id.toString();
  // $('#pid').text(stringId.substr(0,3) + '-' + stringId.substr(3,6));
  $scope.pid = stringId.substr(0,3) + '-' + stringId.substr(3,6);

  // TODO: add Firefox support and notify if browser not supported
  if (navigator.webkitGetUserMedia) {
    console.log("This appears to be Chrome");
  } else {
    console.log("We're screwed!");
    // to support Firefox use "moz" as a prefix instead of webkit
  }


  // ANOUNCEMENT
  var announceChild = null;
  var announcePresence = function() {
    announceChild = announceRef.push({
      roomID: $scope.roomID,
      id: id
    });
    console.log("Announced:", {
      roomID: $scope.roomID,
      id: id
    });

    // TODO: doing this on page load break something?
    navigator.webkitGetUserMedia({
      "audio": true,
      "video": true
    }, function (stream){
      $('#localVideo')[0].src = URL.createObjectURL(stream);
      // $scope.localSrc = URL.createObjectURL(stream);
      localStream = stream;
      beginWebRTC(outgoingPC);
    }, function(e){
      alert("Error getting Video and Audio. Please try a refresh.");
      console.error(e);
    });
  };


  var handleAnnouncement = function(snapshot){
    var data = snapshot.val();
    if(data.roomID === $scope.roomID && data.id !== id){
      console.log("Matched with", data.id);
      remoteId = data.id;

      beginWebRTC(outgoingPC);
    }
  };

  var announceChildAdded = announceRef.on('child_added', handleAnnouncement);


  // SENDING MESSAGES
  var messages = [];
  var sendMessage = function(message) {
    message.sender = id;
    messages.push(messageRef.push(message));
  };


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
  $scope.isConnectionReady = false;

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

    $scope.isConnectionReady = true;
    console.log('Connection ready!');
    beginWebRTC(outgoingPC);
  };

  var handleAddStream = function(e) {
    console.log('REMOTE stream coming in!');
    console.log(e.stream);
    $('#remoteVideo')[0].src = URL.createObjectURL(e.stream);
    // $scope.remoteSrc = URL.createObjectURL(e.stream);
    $scope.inVideoChat = true;
    $scope.$apply();
  };

  var handleIceCandidateStateChange = function(peerConnection) {
    if(peerConnection.iceConnectionState === 'disconnected'){
      console.log('Client disconnected');
      announcePresence();
    }
  };

  var handleIceCandidate = function(e, peerConnection, incoming) {
    var candidate = e.candidate;
    if(candidate){
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

  // var messageChildAdded = messageRef.on('child_added', handleMessage);
  var messageChildAdded = messageRef.on('child_added', handleMessage);
  var firstMessage = false;

  var beginWebRTC = function(peerConnection){
    console.log('connectionReady', $scope.isConnectionReady);
    if(localStream && $scope.isConnectionReady && remoteId){
      outgoingPC.addStream(localStream);

      peerConnection.createOffer(function (offer) {
        console.log('SENDING offer setLocalDescription(offer) to', remoteId);
        peerConnection.setLocalDescription(offer, onSdpSuccess, onSdpFailure);
        sendMessage(offer);
      }, errorHandler, constraints);
    }
  };

  $scope.connect = function(){
    endCall();
    // TODO update firebase in separate function?
    fb = new Firebase("https://webrtc-onboard.firebaseio.com/connections/" + $scope.roomID);
    announceRef = fb.child('announce');
    messageRef = fb.child('messages');
    console.log('Connecting to new room:', $scope.roomID);

    announceRef.off('child_added', announceChildAdded);
    messageRef.off('child_added', messageChildAdded);
    $('#messages').empty();

    announceChildAdded = announceRef.on('child_added', handleAnnouncement);
    messageChildAdded = messageRef.on('child_added', handleMessage);
    firstMessage = false;

    initiateConnection();
    announcePresence();
  };

  function handleMessage(snapshot){
    if(firstMessage){
      firstMessage = false;
      return;
    }
    var data = snapshot.val();
    if(data.sender === id) return;
    // console.log("MESSAGE", data.type, "from", data.sender);
    switch (data.type) {
      // Remote client handles WebRTC request
      case 'offer':
        remoteId = data.sender;

        console.log("RECEIVED offer setRemoteDescription(offer)", "from", data.sender);
        var sdpOffer = new RTCSessionDescription(data);
        incomingPC.setRemoteDescription(sdpOffer, onSdpSuccess, onSdpFailure);

        incomingPC.createAnswer(function (answer) {
          console.log("SENDING answer setLocalDescription(answer)", "to", data.sender);
          incomingPC.setLocalDescription(answer, onSdpSuccess, onSdpFailure);
          sendMessage(answer);
        }, errorHandler, constraints);
        break;
      // Answer response to our offer we gave to remote client
      case 'answer':
        console.log("RECEIVED answer setRemoteDescription(answer)", "from", data.sender);
        var sdpAnswer = new RTCSessionDescription(data);
        outgoingPC.setRemoteDescription(sdpAnswer, onSdpSuccess, onSdpFailure);
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
        $scope.inVideoChat = false;
        $scope.$apply();

        outgoingPC.close();
        incomingPC.close();

        remoteId = null;
        $scope.isConnectionReady = false;
        initiateConnection();
        break;
    }
  }

  $('#mute').click(function(){
    var isMuted = $('#remoteVideo').prop('muted');
    console.info("isMuted", isMuted);
    $('#remoteVideo').prop('muted', !isMuted);
  });


  var endCall = function(){
    $('#remoteVideo')[0].src = "";
    $scope.inVideoChat = false;
    $scope.$apply();

    remoteId = null;
    $scope.isConnectionReady = false;

    sendMessage({type: 'leave'});

    outgoingPC.close();
    incomingPC.close();

    // Clean up Firebase
    if(announceChild !== null) announceChild.remove();
    for (var i = messages.length - 1; i >= 0; i--) {
      messages[i].remove();
    }
  };

  $('#hangup').click(function(){
    endCall();
  });

  window.onbeforeunload = function(e) {
    endCall();
  };


  initiateConnection();
  // announcePresence();

});