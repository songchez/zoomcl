const socket = io();
const welcome= document.querySelector("#welcome");
const form = welcome.querySelector("form");
const room = document.querySelector("#room");
const myface = document.getElementById("myface");
const mutebtn = document.getElementById("mute");
const mutebtnicon = mutebtn.querySelector("i")
const camerabtn = document.getElementById("camera");
const camerabtnicon = camerabtn.querySelector("i")
const cameraselect = document.getElementById("cameras");
const call = document.getElementById("call");

//default(숨김)
room.hidden = true;
call.hidden = true;

//변경 가능한 전역변수 미리 할당
let roomname;
let nickname;
let h3 = document.querySelector("h3");
let myStream;
let mediaerror = false;
let muted = false;
let cameraoff = false;
let mypeerconnection;

 //내 비디오
//TODO: 카메라셀렉트
async function getCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(device => device.kind === "videoinput");
        const currentcamera = myStream.getVideoTracks()[0];
        console.log("실험");//두번실행됨
        cameras.forEach(camera => {
            const option = document.createElement("option")
            option.value = camera.deviceId;
            option.innerText = camera.label;
            if(currentcamera.label ==camera.label){
                option.selected =  true;
            }
            cameraselect.appendChild(option);
        })
        if(cameras.length === 0){
            mediaerror = true;
            console.log("카메라없음");
        }
    } catch (error) {
        console.log(error)
    }
}

// TODO: 비디오 가져오기
async function getMedia(deviceId) {
    const initialConstrains = {
        audio : true,
        video : { facingMode: "user"},
    }
    const cameraConstrains = {
        audio : true,
        video : {deviceId: {exact : deviceId}},
    }
    try {
        myStream = await navigator.mediaDevices.getUserMedia(
            deviceId? cameraConstrains : initialConstrains
        );
        myface.srcObject = myStream;
        if (!deviceId) {
            await getCameras();
        }
    } catch(e){
        console.log(e)
    }
}


//TODO:방입장과 메시지 입력!!!!
//메시지 입력
function addmessage(message) {
    const chatlog = room.querySelector("#chatlog");
    chatlog.append(message+"\n");
}

function handleMessageSubmit(event) {
    event.preventDefault();
    const input = room.querySelector("input");
    const value = input.value;
    socket.emit("new_message", input.value, roomname, ()=>{
        addmessage(`You: ${value}`);
    });
    input.value=""
}
//방 입장_2
async function initcall() {
    //videostart
    //if(!mediaerror){}
    call.hidden = false;
    await getMedia();
    handlemuteclick();
    handlecameraclick();
    makeconnection();
    //chatstart
    room.hidden = false;
    welcome.hidden = true;
    h3.innerText = `Room ${roomname}`;
    addmessage(`${nickname} 님 환영합니다! 💕`);
    //메시지 입력
    const form = room.querySelector("form");
    form.addEventListener("submit", handleMessageSubmit);
    //console.log("The Room Connected!!");
}

//방 입장_1
async function handleroomsubmit(event) {
    event.preventDefault();
    const roomname_input = form.querySelector("#roomname_input");
    const nickname_input = form.querySelector("#nickname_input");
    nickname = nickname_input.value;
    roomname = roomname_input.value;
    //닉네임 서버로 보내기
    socket.emit("nickname", nickname);
    //입장함수 호출
    await initcall();
    socket.emit("enter_room", roomname_input.value);
    roomname_input.value = "";
}

form.addEventListener("submit", handleroomsubmit);


// TODO: 뮤트와 카메라 버튼
function handlemuteclick() {
    myStream.getAudioTracks().forEach(track => (track.enabled = !track.enabled));
    if(!muted){
        mutebtn.style.backgroundColor = "black";
        mutebtnicon.innerHTML = "&#xf131";
        muted = true;
    }else{
        mutebtn.style.backgroundColor = "red";
        mutebtnicon.innerHTML = "&#xf130";
        muted = false;
    }
}
function handlecameraclick() {
    myStream.getVideoTracks().forEach(track => (track.enabled = !track.enabled));
    if(!cameraoff){
        camerabtn.style.backgroundColor = "black";
        camerabtnicon.innerHTML = "&#xf03d";
        cameraoff = true;
    }else{
        camerabtn.style.backgroundColor = "red";
        camerabtn.style.color = "white";
        cameraoff = false;
    }
}
mutebtn.addEventListener("click", handlemuteclick);
camerabtn.addEventListener("click", handlecameraclick);

//TODO:카메라선택
async function handlecameraselect() {
    await getMedia(cameraselect.value);
    if(mypeerconnection){
        const videotrack = myStream.getVideoTracks()[0]
        const videosender = mypeerconnection.getSenders().find((sender)=>sender.track === "video");
    videosender.replaceTrack(videotrack);
    }
}
//왜 실행되는 것일까????
if(!call.hidden){
    cameraselect.addEventListener("input", handlecameraselect());
} 

//TODO:해당함수가 호출 후 백엔드에서 호출(emit)되어졌을 때(다른쪽 브라우저와 연결할때 사용, 서버통신)
socket.on("welcome", (nickname, newCount)=>{
    addmessage(`${nickname} 님이 들어오셨습니다🎉 반갑게 인사해주세요!!`);
    h3.innerText = `Room ${roomname} (${newCount}) `;
});

socket.on("bye", (nick,newCount)=>{
    addmessage(`${nick}님이 나가셨습니다 👋`);
    h3.innerText = `Room ${roomname} (${newCount}) `;
});

socket.on("new_message", addmessage);
//(msg)=>{addmessage(msg)}와 똑같음(쉽게 파라미터를 넣어줌)

socket.on("room_change", (rooms)=>{
    const roomlist = welcome.querySelector("ul");
    roomlist.innerText = "";
    rooms.forEach(room => {
        const li = document.createElement("li");
        li.innerText = room;
        roomlist.append(li);
    });
});
//video백엔드 with webRTC code
//보내기(프론트에서 실행->서버로전달)
socket.on("welcome_2", async ()=>{
    const offer = await mypeerconnection.createOffer();
    mypeerconnection.setLocalDescription(offer);
    //갔다가
    console.log("sent the offer");
    socket.emit("offer", offer, roomname);
});

//받기.(다른함수,백엔드에서 실행)
socket.on("offer", async offer =>{
    console.log("received the offer");
    mypeerconnection.setRemoteDescription(offer);
    const answer = await mypeerconnection.createAnswer();
    mypeerconnection.setLocalDescription(answer);
    socket.emit("answer", answer, roomname);
    console.log("sent the answer");
})
socket.on("answer", answer=>{
    console.log("received the answer");
    mypeerconnection.setRemoteDescription(answer);
})

//icecadidate
socket.on("ice", ice=>{
    console.log("receive the ICE");
    mypeerconnection.addIceCandidate(ice);
})

function makeconnection() {
    mypeerconnection = new RTCPeerConnection();
    mypeerconnection.addEventListener("icecandidate", handleice)
    mypeerconnection.addEventListener("addstream", handleaddstream)
    myStream.getTracks().forEach(tracks =>{
        mypeerconnection.addTrack(tracks, myStream);        
    });
}

function handleice(data) {
    socket.emit("ice", data.candiate, roomname);
    console.log("sent cadidate");
}
function handleaddstream(data) {
    const peerstream = document.getElementById("peerface");
    peerstream.srcObject =data.stream;
    console.log("peer connection complite");
}