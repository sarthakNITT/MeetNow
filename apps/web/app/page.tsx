"use client"
import { parse } from "path";
import React, { useRef, useState } from "react";

export default function Home () {
  const [roomId, setRoomId] = useState("");
  const [myPeerId, setMyPeerId] = useState("");
  
  const socketRef = useRef<WebSocket | null>(null);
  
  async function handleConnection () {
    console.log(`Called handleConnection function`);
    const socket = new WebSocket("ws://localhost:8080");
    socketRef.current = socket;
    socket.onmessage = (event: any) => {
      console.log(event.data);
    }
    socket.addEventListener("open", () => {
      console.log(`WebSocket connection opened`);
      const message = JSON.stringify({
        type: "success",
        value: "connection successfull"
      })
      socket.send(message);
    })
    socket.onmessage = (event: any) => {
      const data = JSON.parse(event.data);
      if (data.type === "connection") {
        setMyPeerId(data.value);
        console.log(`My peer ID: ${data.value}`);
      }
    }
  }
  
  async function handleCreateRoom () {
    console.log(`Called handleCreateRoom function`);
    if (!socketRef.current) {
      console.log("Socket not connected. Please connect first.");
      return;
    }
    console.log(1);
    const message = JSON.stringify({
      "type": "join", 
      "roomId": "ROOM123",
      "peerId": myPeerId,
      "name": "Sarthak"
    })
    console.log(2);
    socketRef.current.send(message);
    socketRef.current.onmessage = (event: any) => {
      console.log(event.data);
    }
    console.log(3);
  }

  async function handleJoinRoom () {
    if (!socketRef.current) {
      console.log("Socket not connected. Please connect first.");
      return;
    }
    console.log(1);
    const message = JSON.stringify({
      "type": "join", 
      "roomId": `${roomId}`,
      "peerId": myPeerId,
      "name": "Aarav"
    })
    socketRef.current.send(message);
    socketRef.current.onmessage = async (event: any) => {
      console.log(event.data);
      const parsedData = JSON.parse(event.data);
      if(parsedData.type === "new-peer"){
        parsedData.roomInfo[0].peers.forEach( async(peer: any) => {
          const peerConnection = new RTCPeerConnection();
          const gumStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
          for (const track of gumStream.getTracks()) {
            peerConnection.addTrack(track);
            peerConnection
            .createOffer()
            .then((offer) => peerConnection.setLocalDescription(offer))
            .then(() => {
              socketRef.current?.send(JSON.stringify({
                "type": "offer",
                "from": myPeerId,
                "to": peer.peerId,
                "sdp": `${peerConnection.localDescription?.sdp}`
              }));
            })
            .catch((reason) => {
              console.log(reason);
            });
          }
        })
      }
    }
  }
  return (
    <div className="gap-2 flex">
      <button className="border-[1px] p-2 rounded" onClick={handleConnection}>Click to connect to ws server</button>
      <button className="border-[1px] p-2 rounded" onClick={handleCreateRoom}>Click to create room</button>
      <input className="border-[1px] p-2 rounded" placeholder="Enter room id" value={roomId} onChange={(e)=>setRoomId(e.target.value)} type="text" />
      <button className="border-[1px] p-2 rounded" onClick={handleJoinRoom}>Click to join room</button>
    </div>
  )
}