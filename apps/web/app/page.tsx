"use client"
import React, { useRef, useState } from "react";

export default function Home () {
  const [roomId, setRoomId] = useState("");
  const [myPeerId, setMyPeerId] = useState("");
  const [currentRoomId, setCurrentRoomId] = useState("");
  
  const socketRef = useRef<WebSocket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  
  async function handleIncomingOffer(data: any) {
    const peerConnection = new RTCPeerConnection();
    peerConnectionRef.current = peerConnection;
    const gumStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    for (const track of gumStream.getTracks()) {
      peerConnection.addTrack(track);
    }
    
    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.send(JSON.stringify({
          type: "ice-candidate",
          from: myPeerId,
          to: data.from,
          roomId: currentRoomId,
          candidate: event.candidate
        }));
      }
    };
    
    await peerConnection.setRemoteDescription({ type: 'offer', sdp: data.sdp });
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socketRef.current?.send(JSON.stringify({
      type: "answer",
      from: myPeerId,
      to: data.from,
      roomId: currentRoomId,
      sdp: answer.sdp
    }));
  }

  async function handleIncomingAnswer (data: any) {
    await peerConnectionRef.current?.setRemoteDescription({ type: 'answer', sdp: data.sdp })
  }

  async function handleIncomingIceCandidate(data: any) {
    if (peerConnectionRef.current && data.candidate) {
      try {
        await peerConnectionRef.current.addIceCandidate(data.candidate);
      } catch (error) {
        console.error("Error adding ICE candidate:", error);
      }
    }
  }
  
  async function handleNewPeer(data: any) {
    const newPeerId = data.value.split('peerId: ')[1].split(',')[0];
    const newPeerName = data.value.split('peerName: ')[1];
    
    if (newPeerId !== myPeerId) {
      const peerConnection = new RTCPeerConnection();
      peerConnectionRef.current = peerConnection;
      const gumStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      
      for (const track of gumStream.getTracks()) {
        peerConnection.addTrack(track);
      }
      
      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socketRef.current?.send(JSON.stringify({
            type: "ice-candidate",
            from: myPeerId,
            to: newPeerId,
            roomId: data.roomId,
            candidate: event.candidate
          }));
        }
      };
      
      try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socketRef.current?.send(JSON.stringify({
          "type": "offer",
          "from": myPeerId,
          "to": newPeerId,
          "roomId": data.roomId,
          "sdp": offer.sdp
        }));
      } catch (error) {
        console.error("Error creating offer:", error);
      }
    }
  }
  
  async function handleConnection () {
    console.log(`Called handleConnection function`);
    const socket = new WebSocket("ws://localhost:8080");
    socketRef.current = socket;
    socket.addEventListener("open", () => {
      console.log(`WebSocket connection opened`);
      const message = JSON.stringify({
        type: "success",
        value: "connection successfull"
      })
      socket.send(message);
    })
    
    socket.onmessage = async (event: any) => {
      const data = JSON.parse(event.data);
      console.log("Received message:", data);
      
      if (data.type === "connection") {
        setMyPeerId(data.value);
        console.log(`My peer ID: ${data.value}`);
      } else if (data.type === "JoinRequest") {
        const room = data.roomInfo?.find((r: any) => r.roomId === data.roomId);
        if (room && room.peers && room.peers.length > 0) {
          for (const peer of room.peers) {
            if (peer.peerId !== myPeerId) {
              await handleNewPeer({ value: `peerId: ${peer.peerId}, peerName: ${peer.peerName}`, roomId: data.roomId });
            }
          }
        }
      } else if (data.type === "offer") {
        await handleIncomingOffer(data);
      } else if (data.type === "answer") {
        await handleIncomingAnswer(data);
      } else if (data.type === "ice-candidate") {
        await handleIncomingIceCandidate(data);
      } else if (data.type === "new-peer") {
        await handleNewPeer(data);
      }
    }
  }
  
  async function handleCreateRoom () {
    console.log(`Called handleCreateRoom function`);
    if (!socketRef.current) {
      console.log("Socket not connected. Please connect first.");
      return;
    }
    const roomId = "ROOM123";
    setCurrentRoomId(roomId);
    console.log(1);
    const message = JSON.stringify({
      "type": "join", 
      "roomId": roomId,
      "peerId": myPeerId,
      "name": "Sarthak"
    })
    console.log(2);
    socketRef.current.send(message);
    console.log(3);
  }

  async function handleJoinRoom () {
    if (!socketRef.current) {
      console.log("Socket not connected. Please connect first.");
      return;
    }
    setCurrentRoomId(roomId);
    console.log(1);
    const message = JSON.stringify({
      "type": "join", 
      "roomId": roomId,
      "peerId": myPeerId,
      "name": "Aarav"
    })
    socketRef.current.send(message);
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