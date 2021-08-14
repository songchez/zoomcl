//ssh -i desktop/awspemkey/sanchez.pem ec2-user@ec2-18-188-79-70.us-east-2.compute.amazonaws.com
//리눅스 서버접속맨
import express from "express";
import http from "http";
import { Server } from "socket.io";
import { instrument } from "@socket.io/admin-ui";

const app = express();

app.set('view engine', "pug");
app.set('views',__dirname + "/views");
app.use('/public', express.static(__dirname + '/public')); 


app.get("/", (req, res) => res.render("home"));
app.get('/*' , (req , res)=>{
   res.redirect('/')
})
//로컬호스트 주소(호스트코드)
const handle = () => console.log("listening on http://localhost:3000");

const httpserver = http.createServer(app);
const wsServer = new Server(httpserver, {
   cors: {
     origin: ["https://admin.socket.io"],
     credentials: true
   }
 });

instrument(wsServer, {
   auth: false
 });

//private룸과 public룸을 구분시킴(sids에 없는 방이름)
function publicrooms() {
   const{
      sockets: {
         adapter: { sids, rooms }}
      } = wsServer;
   //같은 뜻
   //const sids = wsServer.sockets.adapter.sids;
   //const room = wsServer.sockets.adapter.rooms;
   const publicrooms = [];
   rooms.forEach((_, key) => {
      if (sids.get(key) == undefined) {
         publicrooms.push(key);
      }
   });
   return publicrooms;
}

//방 인원수 세기
function countRoom(roomName) {
   return wsServer.sockets.adapter.rooms.get(roomName)?.size
}

wsServer.on("connection", (socket) => {
   socket["nickname"] = "Anon";
   //뭐가 일어났는지 확인하는 용도
   socket.onAny((event) => {
      console.log(`Socket Event:${event}`);
   });
   socket.on("offer", (offer, roomname)=>{
      socket.to(roomname).emit("offer", offer)
   })
   socket.on("answer", (answer,roomName)=>{
      socket.to(roomname).emit("answer",answer);  
   })
   socket.on("enter_room", (room_name) => {
         socket.join(room_name);
         socket.to(room_name).emit("welcome", socket.nickname, countRoom(room_name));
         socket.to(room_name).emit("welcome_2");
         wsServer.sockets.emit("room_change", publicrooms());
   });
   socket.on("disconnecting", () => {
      socket.rooms.forEach((room) => socket.to(room).emit("bye", socket.nickname, countRoom(room) - 1));
   });
   socket.on("disconnect",() =>{
      wsServer.sockets.emit("room_change", publicrooms());
   });
   socket.on("new_message", (msg, room, done)=>{
      socket.to(room).emit("new_message", `${socket.nickname} : ${msg}`);
      done();
   });
   socket.on("nickname", nickname => socket["nickname"] = nickname);
 });

httpserver.listen(3000, handle);
