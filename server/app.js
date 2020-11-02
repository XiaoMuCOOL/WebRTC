var express = require('express')
var app = express()
var https = require('https')
var fs = require('fs')
var path = require('path')
var IO = require('socket.io')
var CONFIG = require('../public/config')

var redis = require('redis')
var redisClient = redis.createClient
var pub = redisClient(6379, '127.0.0.1')
var sub = redisClient(6379, '127.0.0.1')

app.use(express.static('dist'))

const key = fs.readFileSync(path.join(__dirname, './ssl/server.key'))
const cert = fs.readFileSync(path.join(__dirname, './ssl/server.pem'))
const credentials = {key, cert}
var server = https.createServer(credentials, app).listen(CONFIG.port)
console.log(`HTTPS 服务已启动，请监听 ${CONFIG.baseUrl} 网址。`)

var io = IO(server)
console.log('Socket 服务已启动。')

// 房间用户名单
var roomUsers = {}
var roomSockets = {}

io.on('connect', function(socket) {
  var roomID = '' // 房间号
  var user = '' // 当前登录用户名

  socket.on('message', function(data) {
    var data = JSON.parse(data)
    switch (data.event) {
      /** 获取房间详情 */
      case 'get_room_info':
        socket.emit(
          'message',
          JSON.stringify({
            event: 'show',
            allUser: roomUsers,
            success: true,
          })
        )
        break
      /** 当有新用户加入时 */
      case 'join':
        user = data.name
        roomID = data.room
        if (!roomUsers[roomID]) {
          roomUsers[roomID] = []
          roomSockets[roomID] = []
          sub.subscribe(roomID)
        }
        // 当昵称重复时
        if (roomUsers[roomID].indexOf(user) !== -1) {
          pub.publish(
            roomID,
            JSON.stringify({
              event: 'join',
              message: '该用户名已存在',
              success: false,
            })
          )
        } else {
          // 保存用户信息于该房间
          roomUsers[roomID].push(user)
          roomSockets[roomID][user] = socket
          socket.name = user
          socket.join(roomID)
          io.emit(
            'message',
            JSON.stringify({
              event: 'show',
              allUser: roomUsers,
              success: true,
            })
          )
          pub.publish(
            roomID,
            JSON.stringify({
              event: 'join',
              users: roomUsers[roomID],
              success: true,
            })
          )
        }
        break
      /** 发送 */
      case 'offer':
        console.log(user, ' 发送消息给: ', data.connectedUser)
        var conn = roomSockets[roomID][data.connectedUser]
        if (conn != null) {
          sendTo(conn, {
            event: 'offer',
            offer: data.offer,
            name: user,
          })
        } else {
          sendTo(socket, {
            event: 'msg',
            message: '未找到此用户',
          })
        }
        break
      /** 答复 */
      case 'answer':
        console.log(user, ' 答复消息给: ', data.connectedUser)
        // i.e. UserB answers UserA
        var conn = roomSockets[roomID][data.connectedUser]
        if (conn != null) {
          sendTo(conn, {
            event: 'answer',
            answer: data.answer,
            name: user,
          })
        }
        break

      case 'candidate':
        console.log(data.name, ' Sending candidate to: ', user)
        var conn = roomSockets[roomID][data.name]
        if (conn != null) {
          sendTo(conn, {
            event: 'candidate',
            candidate: data.candidate,
            name: user,
          })
        }
        break
    }
  })

  socket.on('disconnect', function() {
    if (socket.name) {
      try {
        roomSockets[roomID].splice(roomSockets[roomID].indexOf(socket))
        roomUsers[roomID].splice(roomUsers[roomID].indexOf(socket.name))
        console.log('Disconnecting from ', socket.name)
        pub.publish(
          roomID,
          JSON.stringify({
            event: 'leave',
            name: socket.name,
            users: roomUsers[roomID],
          })
        )
        if (roomUsers[roomID].length == 0) {
          delete roomUsers[roomID]
          delete roomSockets[roomID]
        }
        io.emit(
          'message',
          JSON.stringify({
            event: 'show',
            allUser: roomUsers,
            success: true,
          })
        )
      } catch (err) {
        console.log(err)
      }
    }
  })
})

sub.on('subscribe', function(channel) {
  console.log('subscribe: ' + channel)
})

sub.on('message', function(channel, message) {
  console.log('message channel ' + channel + ': ' + message)
  io.to(channel).emit('message', JSON.parse(message))
})

function sendTo(connection, message) {
  connection.send(message)
}