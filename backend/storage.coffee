sha1 = require('sha1')
mongoose = require('mongoose')
schemas = require('./schemas')

Thread = mongoose.model('Thread')
Post = mongoose.model('Post')
Category = mongoose.model('Category')
User = mongoose.model('User')
Token = mongoose.model('Token')

TOKEN_DURATION = 86400000

validate = (object, fields, cb) ->
  fields.forEach (field) ->
    if !(cb.hasOwnProperty field)
      cb('Missing property ' + field)
      return
  cb()

# Probably an abomination, but works nicely to
# send any object via dnode
sanitize = (object, blacklist) ->
  newObject = JSON.parse JSON.stringify object
  blacklist.forEach (banned) ->
    delete newObject[banned]
  newObject

without = (object, blacklist = []) ->
  newObject = JSON.parse JSON.stringify object
  blacklist.forEach (banned) ->
    if ( index = newObject.indexOf banned ) != 1
      newObject.splice index, 1
  newObject

generateToken = (user) ->
  token = new Token({
    value: sha1(user + Math.random())
    user: user
    expiration: Date.now() + TOKEN_DURATION
  })
  token.save()
  token.value

class Session
  constructor: (user, @listener) ->
    @user = sanitize(user, ['sha1'])
    @token = generateToken @user.username

  logout: ->
    token = @token
    Token.remove { value: @token }, (err) ->
      console.log 'Session with token ', token, ' logged out.'
    store.removeSession @

class ForumStorage
  constructor: ->
    @sessions = []

  addSession: (session) ->
    console.log 'New session with token ', session.token
    @sessions.push session

  removeSession: (session) ->
    @sessions = without(@sessions, [session])

  notify: (token, method, args) ->
    @sessions.forEach (session) ->
      if session.token != token
        # RPC on other connected clients, ftw
        console.log 'notify -> ', session.user.username, ' of ', method, args
        session.listener[method].apply(null, args)

  startThread: (_thread, _post, cb) ->
    validate _thread, ['categoryId', 'title'], (err) ->
      if (err)
        console.log 'Received invalid thread object ', thread, ' - error = ', err
      else
        thread = new Thread(_thread)
        thread.save()
        cb(thread._id)
        @notify(token, 'newThread', [thread])
        @reply(thread._id, _post)

  reply: (token, threadId, _post, cb) ->
    validate _post, ['threadId', 'userId', 'source'], (err) ->
      if (err)
        console.log 'Received invalid post reply ', thread, ' - error = ', err
      else
        post = new Post(_post)
        post.save()
        Thread.findById threadId, (err, thread) ->
          thread.posts.push(post)
          thread.save()

        cb(post._id)
        @notify(token, 'postReply', [threadId, post])

store = new ForumStorage()

module.exports = {

  store: store 
  Gateway: {
    # storage, of type ForumStorage

    login: (username, password, listener) ->
      # TODO: find User in database, associate with session
      console.log 'Attempted login with username ', username
      User.findOne { username: username }, (err, user) ->
        if (err || !user)
          console.log 'User not found: ', username, ' error: ', err
          cb { status: 'error' }
        else
          session = new Session(user, listener)
          store.addSession session
          listener.onLogin {
            status: 'success'
            session: sanitize(session, ['listener'])
            remote: (name, args) ->
                if args instanceof Array
                  session[name].apply(session, args)
                else
                  session[name].apply(session, [args])
          }
  }

} 


