<template>
  <div class="container">
    <div class="row justify-content-md-center pt-5">
      <div class="col-md-6">
        <h2>WebRTC Demo</h2>
        <br />
        <form class="form" action @submit.prevent="submit()">
          <input class="form-control" type="text" v-model="roomName" placeholder="请输入房间名" />
          <br />
          <button class="btn btn-primary btn-block" type="submit">创建房间</button>
        </form>
      </div>
    </div>
    <br />
    <div class="row justify-content-md-center pt-5">
      <div class="col-md-6">
        <h4 style="text-align: left">当前 Rooms:</h4>
        <table class="table table-bordered">
          <thead>
            <tr>
              <th style="text-align: center">房间号</th>
              <th style="text-align: center">用户</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(room, index) in rooms" :key="index">
              <td>
                <router-link :to="{name: 'room', params: {room: index}}">{{ index }}</router-link>
              </td>
              <td>{{ room.join(', ') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script>
import io from 'socket.io-client'
import * as config from '../../public/config'

const socket = io.connect(config.baseUrl)

export default {
  data() {
    return {
      roomName: '',
      rooms: '',
    }
  },
  created() {
    socket.emit('message', JSON.stringify({ event: 'get_room_info' }))
  },
  mounted() {
    socket.on('message', data => {
      const parseData = JSON.parse(data)
      switch (parseData.event) {
        case 'show':
          this.rooms = parseData.allUser
          break
        default:
          break
      }
    })
  },
  methods: {
    submit() {
      this.$router.push({ name: 'room', params: { room: this.roomName } })
    },
  },
}
</script>

<style>
</style>