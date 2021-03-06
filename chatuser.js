const axios = require('axios');
/** Functionality related to chatting. */

// Room is an abstraction of a chat channel
const Room = require('./Room');

/** ChatUser is a individual connection from client -> server to chat. */

class ChatUser {
  /** make chat: store connection-device, rooom */

  constructor(send, roomName) {
    this._send = send; // "send" function for this user
    this.room = Room.get(roomName); // room user will be in
    this.name = null; // becomes the username of the visitor

    console.log(`created chat in ${this.room.name}`);
  }

  /** send msgs to this client using underlying connection-send-function */

  send(data) {
    try {
      this._send(data);
    } catch {
      // If trying to send to a user fails, ignore it
    }
  }

  /** handle joining: add to room members, announce join */

  handleJoin(name) {
    this.name = name;
    this.room.join(this);
    this.room.broadcast({
      type: 'note',
      text: `${this.name} joined "${this.room.name}".`
    });
  }

  /** handle a chat: broadcast to room. */

  handleChat(text) {
    this.room.broadcast({
      name: this.name,
      type: 'chat',
      text: text
    });
  }

  /** handle a joke: broadcast to only this user */
  async handleJoke() {
    const jokeReq = await axios.get('https://icanhazdadjoke.com', {
      headers: { Accept: 'text/plain' }
    });
    const joke = jokeReq.data;
    this.send(JSON.stringify({ type: 'joke', text: joke }));
  }

  /** handle members: broadcast to only this user */
  handleMembers() {
    let membersList = 'In room: ';
    const members = this.room.members;
    members.forEach(member => (membersList += member.name + ', '));
    this.send(
      JSON.stringify({
        type: 'members',
        text: membersList.slice(0, membersList.length - 2)
      })
    );
  }

  /** handle priv: broadcast to only this user and the user specified */
  handlePriv(text, user) {
    const members = this.room.members;
    let memberFound = false;
    members.forEach(member => {
      if (member.name === user) {
        memberFound = true;
        this.send(JSON.stringify({ type: 'priv', text, from: 'me', to: user }));
        member.send(
          JSON.stringify({ type: 'priv', text, from: this.name, to: 'me' })
        );
      }
    });
    if (!memberFound) {
      return this.send(
        JSON.stringify({ type: 'priv', text: 'User not found' })
      );
    }
  }

  /** Handle messages from client:
   *
   * - {type: "join", name: username} : join
   * - {type: "chat", text: msg }     : chat
   */

  handleMessage(jsonData) {
    let msg = JSON.parse(jsonData);

    if (msg.type === 'join') this.handleJoin(msg.name);
    else if (msg.type === 'chat') this.handleChat(msg.text);
    else if (msg.type === 'joke') this.handleJoke();
    else if (msg.type === 'members') this.handleMembers();
    else if (msg.type === 'priv') this.handlePriv(msg.text, msg.user);
    else throw new Error(`bad message: ${msg.type}`);
  }

  /** Connection was closed: leave room, announce exit to others */

  handleClose() {
    this.room.leave(this);
    this.room.broadcast({
      type: 'note',
      text: `${this.name} left ${this.room.name}.`
    });
  }
}

module.exports = ChatUser;
