var peer = new Peer({
  key: 'smyszcbxlpk9ms4i',
  debug: 3,
  logFunction: function() {
    var copy = Array.prototype.slice.call(arguments).join(' ');
    console.log(copy);
  }
});
// You can pick your own id
// or omit the id if you want to get a random one from the server.

// Show ID
var connectedPeers = {};
peer.on('open', function(id){
  $('#pid').text(id);
});

// Await connections
peer.on('connection', connect);
peer.on('error', function(err) {
  console.log(err);
})

// Handle a connection object.
function connect(c) {
  // Handle a chat connection.
  if (c.label === 'chat') {
    var chatbox = $('<table class="table"></table>').addClass('connection').addClass('active').attr('id', c.peer);
    var header = $('<h3></h3>').html('Chat with <strong>' + c.peer + '</strong>');
    var messages = $('<div><em>Peer connected.</em></div>').addClass('messages');
    chatbox.append(header);
    chatbox.append(messages);
 
    // Select connection handler.
    chatbox.on('click', function() {
      if ($(this).attr('class').indexOf('active') === -1) {
        $(this).addClass('active');
      } else {
        $(this).removeClass('active');
      }
    });
    $('.filler').hide();
    $('#connections').append(chatbox);
    c.on('data', function(data) {
      messages.append('<div><b class="peer">' + c.peer + '</b>: ' + data +
        '</div>');
        });
        c.on('close', function() {
          alert(c.peer + ' has left the chat.');
          chatbox.remove();
          if ($('.connection').length === 0) {
            $('.filler').show();
          }
          delete connectedPeers[c.peer];
        });
  }
  connectedPeers[c.peer] = 1;
}


$(document).ready(function() {
  // Connect to a peer
  $('#connect').click(function() {
    var requestedPeer = $('#rid').val();
    if (!connectedPeers[requestedPeer]) {
      // Create chat connection
      var c = peer.connect(requestedPeer, {
        label: 'chat',
        serialization: 'none',
        metadata: {message: 'hi i want to chat with you!'}
      });
      c.on('open', function() {
        connect(c);
      });
      c.on('error', function(err) { alert(err); });
    }
    connectedPeers[requestedPeer] = 1;
  });
  // Close a connection.
  $('#close').click(function() {
    eachActiveConnection(function(c) {
      c.close();
    });
  });
  // Send a chat message to all active connections.
  $('#send').submit(function(e) {
    e.preventDefault();
    // For each active connection, send the message.
    var msg = $('#text').val();
    eachActiveConnection(function(c, $c) {
      if (c.label === 'chat') {
        c.send(msg);
        $c.find('.messages').append('<div><b class="you">You: </b>' + msg
          + '</div>');
      }
    });
    $('#text').val('');
    $('#text').focus();
  });
  // Goes through each active peer and calls FN on its connections.
  function eachActiveConnection(fn) {
    var actives = $('.active');
    var checkedIds = {};
    actives.each(function() {
      var peerId = $(this).attr('id');
      if (!checkedIds[peerId]) {
        var conns = peer.connections[peerId];
        for (var i = 0, ii = conns.length; i < ii; i += 1) {
          var conn = conns[i];
          fn(conn, $(this));
        }
      }
      checkedIds[peerId] = 1;
    });
  }
});


// Clean up
window.onunload = window.onbeforeunload = function(e) {
  if (!!peer && !peer.destroyed) {
    peer.destroy();
  }
};